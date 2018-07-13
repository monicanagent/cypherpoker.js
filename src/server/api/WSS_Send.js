/**
* @file WebSocket Session message send API endpoint.<br/>
* The handshake and connection MUST be established prior to attempting a send.
*
* @example
* Client Request -> {"jsonrpc":"2.0","method":"WSS_Send","id":3,"params":{"user_token":"7060939278321507","server_token":"9789091435706088","type":"broadcast","data":"Hello, everyone!"}}
* Server Response -> {"jsonrpc":"2.0","result":{"message":"ok"},"id":3}
*
*/
async function WSS_Send (sessionObj) {
   if (sessionObj.endpoint.startsWith("ws") == false) {
      sendError(JSONRPC_ERRORS.WRONG_TRANSPORT, "WebSocket connect request must be made through a WebSocket connection.", sessionObj);
      return(false);
   }
   if (namespace.websocket.handshakeOK(sessionObj) == false) {
      sendError(JSONRPC_ERRORS.SESSION_CLOSE, "Handshake not established.", sessionObj);
      return(false);
   }
   var requestData = sessionObj.requestObj;
   var requestParams = requestData.params;
   var responseObj = new Object();
   var connectionID = namespace.websocket.makeConnectionID(sessionObj); //makeConnectionID defined in WebSocket_Handshake.js
   var resultObj = new Object(); //result to send in response
   resultObj.message = null;
   if (paramExists(requestData, "type") == false) {
      sendError(JSONRPC_ERRORS.INVALID_PARAMS_ERROR, "Message \"type\" not specified.", sessionObj);
      return(false);
   }
   var responseObj = new Object();
   responseObj.message = null;
   var activeSessions = namespace.websocket.allSessions(true);
   var fromAddr = namespace.websocket.makePrivateID(requestParams.server_token, requestParams.user_token);
   switch (requestParams.type.toLowerCase()) {
      case "direct":
         //to only specific recipients
         if (paramExists(requestData, "to") == false) {
            sendError(JSONRPC_ERRORS.INVALID_PARAMS_ERROR, "Recipient(s) \"to\" not specified.", sessionObj);
            return(false);
         }
         var to_object = requestParams.to;
         if (typeof(to_object) != "object") {
            sendError(JSONRPC_ERRORS.INVALID_PARAMS_ERROR, "Recipient(s) \"to\" must be an object.", sessionObj);
            return(false);
         }
         var to_array = to_object["rcp"];
         if (typeof(to_array) != "object") {
            sendError(JSONRPC_ERRORS.INVALID_PARAMS_ERROR, "Recipient(s) \"to.rcp\" must be an array.", sessionObj);
            return(false);
         }
         if (typeof(to_array["length"]) != "number") {
            sendError(JSONRPC_ERRORS.INVALID_PARAMS_ERROR, "Recipient(s) \"to.rcp\" must be an array.", sessionObj);
            return(false);
         }
         var sent_num = 0;
         for (var count = 0; count < activeSessions.length; count++) {
            for (var count2 = 0; count2 < to_array.length; count2++) {
               var currentRecipientPID = to_array[count2];
               if (currentRecipientPID == activeSessions[count].private_id) {
                  var messageObj = buildJSONRPC();
                  messageObj.result.type = "direct";
                  messageObj.result.from = fromAddr;
                  messageObj.result.data = requestParams.data;
                  activeSessions[count].socket.send(JSON.stringify(messageObj));
                  sent_num++;
               }
               if (sent_num >= to_array.length) {
                  //all recipients (more than) accounted for
                  break;
               }
            }
         }
         break;
      case "broadcast":
         //to everyone
         for (var count = 0; count < activeSessions.length; count++) {
            //don't include sender in broadcast
            if (activeSessions[count].user_token != requestParams.user_token) {
               var messageObj = buildJSONRPC();
               messageObj.result.type = "broadcast";
               messageObj.result.from = fromAddr;
               messageObj.result.data = requestParams.data;
               activeSessions[count].socket.send(JSON.stringify(messageObj));
            }
         }
         break;
      default:
         sendError(JSONRPC_ERRORS.INVALID_PARAMS_ERROR, "Unrecognized message \"type\".", sessionObj);
         return(false);
         break;
   }
   //everything went fine!
   responseObj.message = "ok";
   sendResult(responseObj, sessionObj);
   return(false);
}

if (namespace.websocket == undefined) {
   namespace.websocket = new Object();
}
