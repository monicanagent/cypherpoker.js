/**
* @file Session management functionality for established sessions.
*
* @version 0.4.1
*/
async function WSS_Session (sessionObj) {
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
   if (typeof(requestParams.action) != "string") {
      sendError(JSONRPC_ERRORS.INVALID_PARAMS_ERROR, "Invalid \"action\" parameter.", sessionObj);
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
   var action = requestParams.action;
   switch (action) {
      case "setPID":
         //set a new private identifier for the session
         if (typeof(requestParams.privateID) != "string") {
            sendError(JSONRPC_ERRORS.INVALID_PARAMS_ERROR, "Invalid \"privateID\" parameter.", sessionObj);
            return(false);
         }
         for (var count = 0; count < namespace.wss.connections[connectionID].length; count++) {
            var connectionObj = namespace.wss.connections[connectionID][count];
            if (connectionObj.user_token == requestParams.user_token) {
               if (connectionObj.server_token == requestParams.server_token) {
                  connectionObj.private_id = requestParams.privateID;
                  responseObj.privateID = requestParams.privateID;
               }
            }
         }
         //notify other peers of change
         var activeSessions = namespace.wss.allSessions(true);
         for (var count = 0; count < activeSessions.length; count++) {
            //don't include sender in broadcast
            if (activeSessions[count].user_token != requestParams.user_token) {
               var messageObj = buildJSONRPC();
               messageObj.result.type = "session";
               messageObj.result.change = new Object();
               messageObj.result.change.newPrivateID = responseObj.privateID;
               messageObj.result.change.oldPrivateID = privateID;
               activeSessions[count].socket.send(JSON.stringify(messageObj));
            }
         }
         break;
      case "getPID":
         //get the current private identifier for the session using user_token and private_token
         for (var count = 0; count < namespace.wss.connections[connectionID].length; count++) {
            var connectionObj = namespace.wss.connections[connectionID][count];
            if (connectionObj.user_token == requestParams.user_token) {
               if (connectionObj.server_token == requestParams.server_token) {
                  responseObj.privateID = connectionObj.private_id;
               }
            }
         }
         break;
      default:
         sendError(JSONRPC_ERRORS.INVALID_PARAMS_ERROR, "Unrecognized \"action\".", sessionObj);
         return(false);
         break;
   }
   sendResult(responseObj, sessionObj);
   return(true);
}


if (namespace.cp == undefined) {
   namespace.cp = new Object();
}
