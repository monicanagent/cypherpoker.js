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
         sendDirect(fromAddr, to_array, requestParams.data);
         break;
      case "broadcast":
         //to everyone
         sendBroadcast(fromAddr, requestParams.data);
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

/**
* Sends a direct message to a list of connected WSS clients.
*
* @param {String} fromPID The private ID of the sender.
* @param {Array} toArray Indexed list of recipient private IDs.
* @param {*} sendData The data to send to the recipients.
*/
function sendDirect(fromPID, toArray, sendData) {
   var activeSessions = namespace.websocket.allSessions(true);
   var sent_num = 0;
   for (var count = 0; count < activeSessions.length; count++) {
      for (var count2 = 0; count2 < toArray.length; count2++) {
         var currentRecipientPID = toArray[count2];
         if (currentRecipientPID == activeSessions[count].private_id) {
            var messageObj = buildJSONRPC();
            messageObj.result.type = "direct";
            messageObj.result.from = fromPID;
            messageObj.result.data = sendData;
            activeSessions[count].socket.send(JSON.stringify(messageObj));
            sent_num++;
         }
         if (sent_num >= toArray.length) {
            //all recipients (more than) accounted for
            break;
         }
      }
   }
}

/**
* Sends a broadcast message to all connected WSS clients.
*
* @param {String} fromPID The private ID of the sender.
* @param {*} sendData The data to send to the recipients.
*/
function sendBroadcast(fromPID, sendData)  {
   var activeSessions = namespace.websocket.allSessions(true);
   for (var count = 0; count < activeSessions.length; count++) {
      //don't include sender in broadcast
      if (activeSessions[count].private_id != fromPID) {
         var messageObj = buildJSONRPC();
         messageObj.result.type = "broadcast";
         messageObj.result.from = fromPID;
         messageObj.result.data = sendData;
         activeSessions[count].socket.send(JSON.stringify(messageObj));
      }
   }
}

/**
* Sends a server update message to a list of connected WSS clients.
*
* @param {Array} toArray Indexed list of recipient private IDs.
* @param {*} sendData The data to send to the recipients.
* @param {String} [fromPID=null] The private ID of the sender. If omitted,
* the message is a non-peer-initiated update.
*/
function sendUpdate(toArray, sendData, fromPID=null) {
   var activeSessions = namespace.websocket.allSessions(true);
   var sent_num = 0;
   for (var count = 0; count < activeSessions.length; count++) {
      for (var count2 = 0; count2 < toArray.length; count2++) {
         var currentRecipientPID = toArray[count2];
         if (currentRecipientPID == activeSessions[count].private_id) {
            var messageObj = buildJSONRPC();
            messageObj.result.type = "update";
            if (fromPID != null) {
               messageObj.result.from = fromPID;
            }
            messageObj.result.data = sendData;
            activeSessions[count].socket.send(JSON.stringify(messageObj));
            sent_num++;
         }
         if (sent_num >= toArray.length) {
            break;
         }
      }
   }
}

if (namespace.websocket == undefined) {
   namespace.websocket = new Object();
}

namespace.websocket.sendDirect = sendDirect;
namespace.websocket.sendBroadcast = sendBroadcast;
namespace.websocket.sendUpdate = sendUpdate;
