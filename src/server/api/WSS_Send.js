/**
* @file WebSocket Session message send API endpoint.<br/>
* The handshake and connection MUST be established prior to attempting a send.
*
* @example
* Client Request -> {"jsonrpc":"2.0","method":"WSS_Send","id":3,"params":{"user_token":"7060939278321507","server_token":"9789091435706088","type":"broadcast","data":"Hello, everyone!"}}
* Server Response -> {"jsonrpc":"2.0","result":{"message":"ok"},"id":3}
*
* @version 0.4.1
*/
async function WSS_Send (sessionObj) {
   if (sessionObj.endpoint.startsWith("ws") == false) {
      sendError(JSONRPC_ERRORS.WRONG_TRANSPORT, "WebSocket connect request must be made through a WebSocket connection.", sessionObj);
      return(false);
   }
   if (namespace.wss.handshakeOK(sessionObj) == false) {
      sendError(JSONRPC_ERRORS.SESSION_CLOSE, "Handshake not established.", sessionObj);
      return(false);
   }
   var requestData = sessionObj.requestObj;
   var requestParams = requestData.params;
   if (paramExists(requestData, "type") == false) {
      sendError(JSONRPC_ERRORS.INVALID_PARAMS_ERROR, "Message \"type\" not specified.", sessionObj);
      return(false);
   }
   var responseObj = new Object();
   //var connectionID = namespace.wss.makeConnectionID(sessionObj); //makeConnectionID defined in WSS_Handshake.js
   var fromAddr = namespace.wss.getPrivateID(sessionObj); //getPrivateID defined in WSS_Handshake.js
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
         if (requestParams["exclude"] == undefined) {
            requestParams.exclude = null;
         }
         //to everyone
         sendBroadcast(fromAddr, requestParams.data, requestParams.exclude);
         break;
      default:
         sendError(JSONRPC_ERRORS.INVALID_PARAMS_ERROR, "Unrecognized message \"type\".", sessionObj);
         return(false);
         break;
   }
   //everything went fine!
   responseObj.message = "ok";
   sendResult(responseObj, sessionObj);
   return(true);
}

/**
* Sends a direct message to a list of connected WSS clients.
*
* @param {String} fromPID The private ID of the sender.
* @param {Array} toArray Indexed list of recipient private IDs.
* @param {*} sendData The data to send to the recipients.
*/
function sendDirect(fromPID, toArray, sendData) {
   var activeSessions = namespace.wss.allSessions(true);
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
* @param {Object} [exclude=null] If not omitted or null, this object should
* contain an indexed <code>rcp</code> array of recpients to exclude from
* the broadcast.
*/
function sendBroadcast(fromPID, sendData, exclude=null)  {
   var activeSessions = namespace.wss.allSessions(true);
   for (var count = 0; count < activeSessions.length; count++) {
      //don't include sender or excluded recipients in broadcast
      if ((activeSessions[count].private_id != fromPID) && (isExcluded(activeSessions[count].private_id, exclude) == false)) {
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
   var activeSessions = namespace.wss.allSessions(true);
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

/**
* Checks if a private ID is included in a list of exclusions (such as in
* a {@link sendBroadcast} call).
*
* @param {String} privateID The privateID to check.
* @param {Object} [exclude=null] The object containing the exclusion list.
* This object must contain a <code>rcp</code> property which is an indexed \
* array of recipients being excluded.
*
* @return {Boolean} True if the specific <code>privateID</code> was included in the
* exclusion list, false otherwise.
*/
function isExcluded(privateID, exclude=null) {
   if (exclude == null) {
      return (false);
   }
   if ((exclude["rcp"] == null) || (exclude["rcp"] == undefined)) {
      return (false);
   }
   if (typeof(exclude.rcp.length) != "number") {
      return (false);
   }
   for (var count = 0; count < exclude.rcp.length; count++) {
      if (privateID == exclude.rcp[count]) {
         return (true);
      }
   }
   return (false);
}

if (namespace.wss == undefined) {
   namespace.wss = new Object();
}

namespace.wss.sendDirect = sendDirect;
namespace.wss.sendBroadcast = sendBroadcast;
namespace.wss.sendUpdate = sendUpdate;
