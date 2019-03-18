/**
* @file WebSocket Session connection API endpoint. The handshake MUST be established prior to attempting
* a connection.
*
* @example
* Client Request -> {"jsonrpc":"2.0","method":"WSS_Connect","id":"2,"params":{"user_token":"7060939278321507","server_token":"9789091435706088"}}
* Server Response -> {"jsonrpc":"2.0","result":{"message":"open","options":{},"private_id":"021b92efb9954fa4244c729190e05d2d9b55530d5e4f18da2d3615fdbad9c44d"},"id":"2"}
* Note: SHA256("9789091435706088:7060939278321507") = "021b92efb9954fa4244c729190e05d2d9b55530d5e4f18da2d3615fdbad9c44d";
*
* @version 0.4.1
*/
async function WSS_Connect (sessionObj) {
   if (sessionObj.endpoint.startsWith("ws") == false) {
      sendError(JSONRPC_ERRORS.WRONG_TRANSPORT, "Session must be created through a WebSocket connection.", sessionObj);
      return (false);
   }
   try {
      if ((namespace.websocket["connections"] == undefined) || (namespace.websocket["connections"] == null)) {
         namespace.websocket.connections = new Array();
      }
   } catch (err) {
      console.error(err.stack);
   }
   var requestData = sessionObj.requestObj;
   var requestParams = requestData.params;
   if (typeof(requestParams["options"]) != "object") {
      sendError(JSONRPC_ERRORS.INVALID_PARAMS_ERROR, "Connection options not supplied or not an object.", sessionObj);
      return (false);
   }
   var responseObj = new Object();
   var connectionID = namespace.websocket.makeConnectionID(sessionObj); //makeConnectionID defined in WebSocket_Handshake.js
   var resultObj = new Object(); //result to send in response
   resultObj.message = null; //single word response message
   resultObj.connect = new Array(); //list of already connected peers (may be empty)
   resultObj.options = new Array(); //associated list of peer options (as of v0.4.1)
   if ((namespace.websocket.connections[connectionID] == null) || (namespace.websocket.connections[connectionID] == undefined)) {
      sendError(JSONRPC_ERRORS.SESSION_CLOSE, "Session handshake not established.", sessionObj);
      return (false);
   }
   if (namespace.websocket.connections[connectionID].length == 0) {
      sendError(JSONRPC_ERRORS.SESSION_CLOSE, "Session handshake not established.", sessionObj);
      return (false);
   }
   for (var count = 0; count < namespace.websocket.connections[connectionID].length; count++) {
      var connectionObj = namespace.websocket.connections[connectionID][count];
      if (connectionObj.user_token == requestParams.user_token) {
         if (connectionObj.server_token == requestParams.server_token) {
            if (connectionObj.socket == null) {
               connectionObj.socket = sessionObj.serverResponse; //assign outgoing WebSockket instance
               connectionObj.last_update = new Date();
               connectionObj.private_id = namespace.websocket.makePrivateID(connectionObj.server_token, connectionObj.user_token);
               connectionObj.options = requestParams.options; //as of v0.4.1s
               connectionObj.socket.addEventListener("close", handleWebSocketClose);
               resultObj.message = "open";
               resultObj.private_id = connectionObj.private_id;
               //notify other peers of new connection
               var activeSessions = namespace.websocket.allSessions(true);
               for (var count = 0; count < activeSessions.length; count++) {
                  //don't include sender in broadcast
                  if (activeSessions[count].user_token != requestParams.user_token) {
                     var messageObj = buildJSONRPC();
                     messageObj.result.type = "session";
                     messageObj.result.connect = connectionObj.private_id;
                     messageObj.result.options = requestParams.options;
                     activeSessions[count].socket.send(JSON.stringify(messageObj));
                     resultObj.connect.push(activeSessions[count].private_id);
                     resultObj.options.push(activeSessions[count].options);
                  }
               }
               sendResult(resultObj, sessionObj);
               return(true);
            } else {
               //socket already exists! do nothing except return error
               sendError(JSONRPC_ERRORS.SESSION_CLOSE, "Socket session exists.", sessionObj);
               return(false);
            }
         } else {
            //server tokens match but user tokens do not (send generic error)
            sendError(JSONRPC_ERRORS.SESSION_CLOSE, "Token mismatch.", sessionObj);
            return(false);
         }
      }
   }
   //something else went wrong
   sendError(JSONRPC_ERRORS.SESSION_CLOSE, "Socket session can't be established at this time.", sessionObj);
   return(false);
}

/**
* Handles a WebSocket close / disconnect event and notifies all active / live
* sessions of the disconnection.
*
* @param {Event} event A standard WebSocket close event.
*/
function handleWebSocketClose(event) {
   try{
      for (var connectionID in namespace.websocket.connections) {
         if ((namespace.websocket.connections[connectionID] != undefined) && (namespace.websocket.connections[connectionID] != null)) {
            for (var count = 0; count < namespace.websocket.connections[connectionID].length; count++) {
               var connectionObj = namespace.websocket.connections[connectionID][count];
               if (connectionObj.socket == event.target) {
                  namespace.websocket.connections[connectionID].splice(count, 1);
                  //notify other peers of new connection -- disconnection session should now be removed
                  var activeSessions = namespace.websocket.allSessions(true);
                  for (var count2 = 0; count2 < activeSessions.length; count2++) {
                     var messageObj = buildJSONRPC();
                     messageObj.result.type = "session";
                     messageObj.result.disconnect = connectionObj.private_id;
                     activeSessions[count2].socket.send(JSON.stringify(messageObj));
                  }
                  if (namespace.websocket.connections[connectionID].length == 0) {
                     namespace.websocket.connections[connectionID] = undefined;
                  }
                  return;
               }
            }
         }
      }
   } catch (err) {
      console.error(err.stack);
   }
}

if (namespace.websocket == undefined) {
   namespace.websocket = new Object();
}
