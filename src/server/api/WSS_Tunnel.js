/**
* @file WebSocket tunneling using Sessions connectivity. Once established, the tunneled
* connections may send and retreive arbitrary data (not just JSON-RPC).
*
* @version 0.4.1
*/
async function WSS_Tunnel (sessionObj) {
   if ((namespace.wss == null) || (namespace.wss == undefined)) {
      sendError(JSONRPC_ERRORS.INTERNAL_ERROR, "No WebSocket Session server defined.", sessionObj);
      return (false);
   }
   var requestData = sessionObj.requestObj;
   var requestParams = requestData.params;
   if ((requestParams.server_token == undefined) || (requestParams.server_token == null) || (requestParams.server_token == "")) {
      sendError(JSONRPC_ERRORS.INVALID_PARAMS_ERROR, "Invalid server token.", sessionObj);
      return(false);
   }
   if ((requestParams.user_token == undefined) || (requestParams.user_token == null) || (requestParams.user_token == "")) {
      sendError(JSONRPC_ERRORS.INVALID_PARAMS_ERROR, "Invalid user token.", sessionObj);
      return(false);
   }
   var responseObj = new Object();
   var connectionID = namespace.wss.makeConnectionID(sessionObj); //makeConnectionID defined in WSS_Handshake.js
   var privateID = namespace.wss.getPrivateID(sessionObj); //getPrivateID defined in WSS_Handshake.js
   if (privateID == null) {
      //must have active WSS session!
      sendError(JSONRPC_ERRORS.ACTION_DISALLOWED, "Session not established.", sessionObj);
      return(false);
   }
   var connectionObject = namespace.wss.getConnectionByCID(connectionID, requestParams.user_token, requestParams.server_token);
   if (connectionObject == null) {
      //internal sessions data may be corrupted
      sendError(JSONRPC_ERRORS.INTERNAL_ERROR, "State object for connection not found.", sessionObj);
      return(false);
   }
   var userTunnels = connectionObject.tunnels;
   var numUserTunnels = userTunnels.length;
   var responseObj = new Object();
   if (typeof(requestParams.action) == "string") {
      switch (requestParams.action) {
         case "open":
            //open a new tunnel
            if (numUserTunnels >= rpc_options.max_tunnels_per_connection) {
               sendError(JSONRPC_ERRORS.ACTION_DISALLOWED, "Maximum number of tunnels ("+String(numUserTunnels)+") already open.", sessionObj);
               return(false);
            }
            if (typeof(requestParams.allowPID) != "string") {
               requestParams.allowPID = "*";
            }
            if (typeof(requestParams.tunnelServerMessages) != "boolean") {
               requestParams.tunnelServerMessages = false;
            }
            connectionObject.tunnel = new Object();
            connectionObject.tunnelServerMessages = requestParams.tunnelServerMessages;
            connectionObject.tunnel.endpointPID = privateID;
            connectionObject.tunnel.allowPID = requestParams.allowPID;
            connectionObject.tunnel.alias = requestParams.alias;
            responseObj.type = "tunnel";
            responseObj.status = "open";
            break;
         case "joinAlias":
            //join an existing tunnel
            var endpointConnObj = namespace.wss.tunnel.getConnectionByAlias(requestParams.alias);
            if (endpointConnObj == null) {
               sendError(JSONRPC_ERRORS.INVALID_PARAMS_ERROR, "No matching tunnel.", sessionObj);
               return (false);
            }
            if (((endpointConnObj.tunnel.allowPID == "*") || (endpointConnObj.tunnel.allowPID == privateID)) &&
               ((endpointConnObj.tunnel.joinedPID == undefined) || (endpointConnObj.tunnel.joinedPID == null))) {
               endpointConnObj.tunnel.joinedPID = privateID;
            } else {
               sendError(JSONRPC_ERRORS.ACTION_DISALLOWED, "Tunnel not available.", sessionObj);
               return (false);
            }
            if (typeof(requestParams.tunnelServerMessages) != "boolean") {
               requestParams.tunnelServerMessages = false;
            }
            connectionObject.tunnel = new Object();
            connectionObject.tunnelServerMessages = requestParams.tunnelServerMessages
            connectionObject.tunnel.joinedPID = privateID;
            connectionObject.tunnel.endpointPID = requestParams.endpointPID;
            connectionObject.tunnel.alias = endpointConnObj.tunnel.alias;
            await connectTunnel(endpointConnObj, connectionObject);
            var joinMessage = buildJSONRPC();
            joinMessage.result.type = "tunnel";
            joinMessage.result.status = "joined";
            joinMessage.result.joinedPID = privateID;
            await sendTunnelMessage(endpointConnObj, JSON.stringify(joinMessage));
            responseObj.type = "tunnel";
            responseObj.status = "joined";
            responseObj.endpointPID = requestParams.endpointPID;
            break;
         case "close":
            //close a tunnel -- not yet supported (future version?)
            sendError(JSONRPC_ERRORS.ACTION_DISALLOWED, "Manual tunnel closure not supported.", sessionObj);
            return(false);
            break;
         default:
            sendError(JSONRPC_ERRORS.INVALID_PARAMS_ERROR, "Invalid \"action\" parameter.", sessionObj);
            return(false);
            break;
      }
   } else {
      //no "action" specified so send
      if (requestParams.data == undefined) {
         //null is allowed
         sendError(JSONRPC_ERRORS.INVALID_PARAMS_ERROR, "Missing \"data\" parameter.", sessionObj);
         return(false);
      }
   }
   var requestData = sessionObj.requestObj;
   var responseData = buildJSONRPC();
   //copy id from request to maintain session continuity
   if ((requestData["id"] == null) || (requestData["id"] == undefined)) {
      responseData.id = null;
   } else {
      responseData.id = requestData.id;
   }
   responseData.result = responseObj;
   //use sendTunnelMessage instead of sendResult to ensure that message always gets to recipient, even
   //after a tunnel is established and communication is being intercepted.
   await sendTunnelMessage(connectionObject, JSON.stringify(responseData));
   return(true);
}

/**
* Returns a connection object from <code>namespace.wss.connections</code>
* based on a tunnel alias.
*
* @param {String} alias The tunnel alias for which to retrieve the
* connection object.
*
* @return {Object} The connection object matching the tunnel alias or <code>null</code>
* if no such connection exists. In the unlikely event that more than one matchibng
* connection object exists, only the first one is returned.
*/
function getConnectionByAlias(alias) {
   if ((namespace.wss.connections == undefined) || (namespace.wss.connections == null)) {
      namespace.wss.connections = new Object();
      return (null);
   }
   for (var connectionID in namespace.wss.connections) {
      var connectionsArr = namespace.wss.connections[connectionID];
      for (var count=0; count < connectionsArr.length; count++) {
         var connectionObj = connectionsArr[count];
         if (connectionObj.tunnel != undefined) {
            if (connectionObj.tunnel.alias == alias) {
               return (connectionObj);
            }
         }
      }
   }
   return (null);
}

/**
* Connects two ends of a tunnel by intercepting message sending, receiving, and
* socket closure at the WebSocket level.
*
* @param {Object} connectionObject1 The object containing a <code>socket</code> reference,
* <code>private_id</code>, <code>tunnel</code> object, and other information to connect
* to <code>connectionObject2</code>.
* @param {Object} connectionObject2 The object containing a <code>socket</code> reference,
* <code>private_id</code>, <code>tunnel</code> object, and other information to connect
* to <code>connectionObject1</code>.
*
* @async
*/
async function connectTunnel(connectionObject1, connectionObject2) {
   connectionObject1.socket._send = connectionObject1.socket.send;
   connectionObject1.socket.send = (data) => {
      sendIntercept(connectionObject1, data);
   }
   connectionObject2.socket._send = connectionObject2.socket.send;
   connectionObject2.socket.send = (data) => {
      sendIntercept(connectionObject2, data);
   }
   var msgListeners = connectionObject1.socket.rawListeners("message");
   var closeListeners = connectionObject1.socket.rawListeners("close");
   for (var count=0; count < msgListeners.length; count++) {
      var listenerFunc = msgListeners[count];
      //swap listeners
      connectionObject1.socket.off ("message", listenerFunc);
      connectionObject1.socket.on ("message", (message) => {
         onTunnelMessage(connectionObject1, connectionObject2, message);
      });
   }
   listenerFunc = closeListeners[0];
   connectionObject1.socket.off ("close", listenerFunc);
   connectionObject1.socket.on ("close", (closeEvent) => {
      onTunnelClose(connectionObject1, connectionObject2, listenerFunc, closeEvent);
   });
   msgListeners = connectionObject2.socket.rawListeners("message");
   closeListeners = connectionObject2.socket.rawListeners("close");
   for (count=0; count < msgListeners.length; count++) {
      var listenerFunc = msgListeners[count];
      //swap listeners
      connectionObject2.socket.off ("message", listenerFunc);
      connectionObject2.socket.on ("message", (message) => {
         onTunnelMessage(connectionObject2, connectionObject1, message);
      });
   }
   listenerFunc = closeListeners[0];
   connectionObject2.socket.off ("close", listenerFunc);
   connectionObject2.socket.on ("close", (closeEvent) => {
      onTunnelClose(connectionObject2, connectionObject1, listenerFunc, closeEvent);
   });
   return (true);
}

/**
* Disconnects a single tunnel end, optionally keeping it open for a future
* connection.
*
* @param {Object} connectionObject The connection object containing a <code>socket</code>
* reference, <code>private_id</code>, <code>tunnel</code> information object,
* <code>user_token</code>, <code>server_token</code>, and other information
* for the tunneled connection.
* @param {Boolean} [remain=true] If false, the connection will no longer be available
* for a new connection. A client connection should almost never remain but
* an endpoint may.
*
* @async
*/
async function disconnectTunnel(connectionObject, remain=true) {
   connectionObject.socket.send = connectionObject.socket._send;
   if (remain == false) {
      var msgListeners = connectionObject.socket.rawListeners("message");
      var closeListeners = connectionObject.socket.rawListeners("close");
      for (var count=0; count < msgListeners.length; count++) {
         var listenerFunc = msgListeners[count];
         //swap listeners
         connectionObject.socket.off ("message", listenerFunc);
      }
      listenerFunc = closeListeners[0];
      connectionObject.socket.off ("close", listenerFunc);
   }
   return (true);
}

/**
* A proxy or intercept function for a standard WebSocket <code>send</code> when the
* socket is being tunneled.<br/>
* Typically this function is swapped into the WebSocket instance in
* {@link connectTunnel} where the extra parameter is introduced.
*
* @param {Object} connectionObj The connection object containing a <code>socket</code>
* reference, <code>private_id</code>, <code>tunnel</code> information object,
* <code>tunnelServerMessages</code>, and other information for the tunneled connection.
* @param {*} data The message to send to the tunneled socket.
*
* @async
*/
async function sendIntercept(connectionObj, data) {
   if (connectionObj.tunnelServerMessages == true) {
      connectionObj.socket._send(data);
   }
}

/**
* Sends a message directly to a tunneled WebSocket. Used when the
* message would otherwuise be intercepted after the tunnel has already
* been established (for example, a tunnel "close" message.)
*
* @param {Object} connectionObject The tunneled connection object containing a
* <code>socket</code> reference, <code>tunnel</code> information object,
* and other information for the tunneled connection to send to.
* @param {*} data The data to send to the tunneled connection.
*
* @async
*/
async function sendTunnelMessage(connectionObject, data) {
   if (typeof(connectionObject.socket._send) == "function") {
      //send function intercepted
      connectionObject.socket._send(data);
   } else {
      //send function not intercepted
      connectionObject.socket.send(data);
   }
}

/**
* A proxy or intercept function for a standard WebSocket "message" event when
* the socket is being tunneled that automatically forwards the receiving data to
* the other end of the tunnel.<br/>
* Typically this handler is swapped into the WebSocket instance in
* {@link connectTunnel} where the extra parameter is introduced.
*
* @param {Object} connectionSourceObj The tunneled sending connection object containing a
* <code>socket</code> reference, <code>private_id</code>, <code>tunnel</code> information
* object, <code>tunnelServerMessages</code>, and other information for the tunneled
* connection.
* @param {Object} connectionDestObj The tunneled receiving connection object containing a
* <code>socket</code> reference, <code>private_id</code>, <code>tunnel</code> information
* object, <code>tunnelServerMessages</code>, and other information for the tunneled
* connection.
* @param {*} message The message received from <code>connectionSourceObj</code> to send
* to <code>connectionDestObj</code>.
*
* @async
*/
async function onTunnelMessage(connectionSourceObj, connectionDestObj, message) {
   connectionDestObj.socket._send(message);
}

/**
* A proxy or intercept function for a standard WebSocket "close" event when
* the socket has been closed. The other end of the tunnel is notified and the tunnel
* is either completely removed if closed by the endpoint or re-opened if closed
* by a client. Typically the "close" handler is swapped into the WebSocket instance in
* {@link connectTunnel}.
*
* @param {Object} closedConnObj The tunneled connection that has just closed.
* @param {Object} otherConnObj The connection at the other end of the tunnel.
* @param {Function} nextListener A reference to the next "close" event listener
* registered in the event chain for the closed socket.
* @param {Object} closeEvent The event included in the original "close" dispatch.
*
* @async
*/
async function onTunnelClose(closedConnObj, otherConnObj, nextListener, closeEvent) {
   var closeMessage = buildJSONRPC();
   closeMessage.result.type = "tunnel";
   closeMessage.result.status = "close";
   closeMessage.result.joinedPID = otherConnObj.tunnel.joinedPID;
   closeMessage.result.endpointPID = otherConnObj.tunnel.endpointPID;
   if (closedConnObj.private_id == otherConnObj.tunnel.joinedPID) {
      //tunnel remains available for next connection
      otherConnObj.tunnel.joinedPID = null;
      delete otherConnObj.tunnel.joinedPID;
      this.disconnectTunnel(closedConnObj, false);
      this.disconnectTunnel(otherConnObj, true);
   } else if (closedConnObj.private_id == otherConnObj.tunnel.endpointPID) {
      //tunnel fully closed
      otherConnObj.tunnel.endpointPID = null;
      delete otherConnObj.tunnel.endpointPID;
      otherConnObj.tunnel.joinedPID = null;
      delete otherConnObj.tunnel.joinedPID;
      this.disconnectTunnel(closedConnObj, false);
      this.disconnectTunnel(otherConnObj, false);
   }
   try {
      await sendTunnelMessage(otherConnObj, JSON.stringify(closeMessage));
   } catch (err) {
   }
   nextListener(closeEvent);
}

if (namespace.wss == undefined) {
   namespace.wss = new Object();
}
if (namespace.wss.tunnel == undefined) {
   namespace.wss.tunnel = new Object();
}

namespace.wss.tunnel.getConnectionByAlias = getConnectionByAlias;
