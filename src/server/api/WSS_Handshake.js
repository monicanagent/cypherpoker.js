/**
* @file WebSocket Session initiation API endpoint.
*
* @example
* Client Request -> {"jsonrpc":"2.0","method":"WSS_Handshake","id":1,"params":{"user_token":"7060939278321507"}}
* Server Response -> {"jsonrpc":"2.0","result":{"message":"accept","numconnections":1,"maxconnections":3,"peerconnections":1,"server_token":"9789091435706088"},"id":1}
*
*/
async function WSS_Handshake (sessionObj) {
   if ((sessionObj.endpoint.startsWith("http") == false)  && (rpc_options.http_only_handshake)) {
      sendError(JSONRPC_ERRORS.WRONG_TRANSPORT, "Session handshake must be made through HTTP / HTTPS service.", sessionObj);
      return;
   }
   if ((namespace.websocket["connections"] == undefined) || (namespace.websocket["connections"] == null)) {
      namespace.websocket.connections = new Array();
   }
   var requestData = sessionObj.requestObj;
   var requestParams = requestData.params;
   var responseObj = new Object();
   var connectionID = namespace.websocket.makeConnectionID(sessionObj);
   var num_activeconnections = 0; //number of currently active WebSocket connections namespace.websocketly
   for (var item in namespace.websocket.connections) {
      //we also need to ook at multiple connections from the same IP (if allowed)...
      for (var count = 0; count < namespace.websocket.connections[item].length; count++) {
         var websocketObj = namespace.websocket.connections[item][count];
         if (websocketObj.user_token == requestParams.user_token) {
            //when the IP is the same then the user token can't be!
            sendError(JSONRPC_ERRORS.SESSION_CLOSE, "User token already exists for your IP.", sessionObj);
            return;
         }
         num_activeconnections++;
      }
   }
   var server_token = String(Math.random()).split("0.").join(""); //unique, per-connection (per-socket) server token
   if ((namespace.websocket.connections[connectionID] == undefined) || (namespace.websocket.connections[connectionID] == null)) {
      var connectionObj = new Object();
      connectionObj.user_token = requestParams.user_token;
      connectionObj.socket = null; //not yet connected
      connectionObj.last_update = new Date();
      connectionObj.server_token = server_token;
      namespace.websocket.connections[connectionID] = new Array();
      namespace.websocket.connections[connectionID].push(connectionObj);
      num_activeconnections++; //new connection just added
      responseObj.message = "accept";
      responseObj.numconnections = 1;
      responseObj.maxconnections = rpc_options.max_ws_per_ip;
      responseObj.peerconnections = num_activeconnections;
      responseObj.server_token = server_token;
      sendResult(responseObj, sessionObj);
   } else {
      let num_activeconnections = namespace.websocket.connections[connectionID].length;
      if (num_activeconnections >= rpc_options.max_ws_per_ip) {
         var infoObj = new Object();
         infoObj.numconnections = num_activeconnections;
         infoObj.maxconnections = rpc_options.max_ws_per_ip;
         responseObj.peerconnections = num_activeconnections;
         sendError(JSONRPC_ERRORS.SESSION_CLOSE, "Too many connections from your IP.", sessionObj, infoObj);
      } else {
         connectionObj = new Object();
         connectionObj.user_token = requestParams.user_token;
         connectionObj.socket = null; //not yet connected
         connectionObj.last_update = Date.now();
         connectionObj.server_token = server_token;
         namespace.websocket.connections[connectionID].push(connectionObj);
         responseObj.message = "accept";
         num_activeconnections++; //new connection just added
         responseObj.numconnections = num_activeconnections;
         responseObj.maxconnections = rpc_options.max_ws_per_ip;
         responseObj.peerconnections = num_activeconnections;
         responseObj.server_token = server_token;
         sendResult(responseObj, sessionObj);
      }
   }
}

// A few extra functions to define in the shared WSS namespace:

function makeConnectionID (sessionObj) {
   if ((sessionObj.serverRequest["socket"] != null) && (sessionObj.serverRequest["socket"] != undefined)) {
      var socket = sessionObj.serverRequest.socket; //http core socket reference
   } else {
      socket = sessionObj.serverRequest._socket; //WebSocket core socket reference
   }
   var requestIP = socket.remoteAddress;
   var IPFamily = socket.remoteFamily;
   var requestPort = socket.remotePort;
   var connectionID = IPFamily + ":" + requestIP;
   return (connectionID);
}

function makePrivateID (server_token, user_token) {
   let hash = crypto.createHash('sha256');
   hash.update(server_token + ":" +user_token);
   var hexOutput = hash.digest('hex');
   return (hexOutput);
}

function handshakeOK(sessionObj) {
   var connectionID = namespace.websocket.makeConnectionID(sessionObj);
   if ((namespace.websocket.connections[connectionID] == null) || (namespace.websocket.connections[connectionID] == undefined)) {
      return (false)
   }
   if (namespace.websocket.connections[connectionID].length == 0) {
      return (false);
   }
   for (var count = 0; count < namespace.websocket.connections[connectionID].length; count++) {
      var connectionObj = namespace.websocket.connections[connectionID][count];
      if (connectionObj.user_token == sessionObj.requestObj.params.user_token) {
         if (connectionObj.server_token == sessionObj.requestObj.params.server_token) {
            return (true);
         } else {
            return (false);
         }
      }
   }
   return (false);
}

function allSessions(activeOnly = true) {
   var returnArr = new Array();
   for (var cid in namespace.websocket.connections) {
      for (var count = 0; count < namespace.websocket.connections[cid].length; count++) {
         var connectionObj = namespace.websocket.connections[cid][count];
         if (activeOnly) {
            if (connectionObj.socket != null) {
               returnArr.push(connectionObj);
            }
         } else {
            returnArr.push(connectionObj);
         }
      }
   }
   return (returnArr);
}

if (namespace.websocket == undefined) {
   namespace.websocket = new Object();
}
namespace.websocket.makeConnectionID = makeConnectionID;
namespace.websocket.makePrivateID = makePrivateID;
namespace.websocket.handshakeOK = handshakeOK;
namespace.websocket.allSessions = allSessions;
