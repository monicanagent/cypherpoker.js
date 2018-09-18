/**
* @file Manages proxy CypherPoker smart contracts and defines a number of related utility functions.
*
*/
async function CP_SmartContract (sessionObj) {
   if ((namespace.websocket == null) || (namespace.websocket == undefined)) {
      sendError(JSONRPC_ERRORS.INTERNAL_ERROR, "No WebSocket Session server defined.", sessionObj);
      return (false);
   }
   var requestData = sessionObj.requestObj;
   var requestParams = requestData.params;
   if (typeof(requestParams.server_token) != undefined) {
      sendError(JSONRPC_ERRORS.INVALID_PARAMS_ERROR, "Invalid server token.", sessionObj);
      return(false);
   }
   if (typeof(requestParams.user_token) != "string") {
      sendError(JSONRPC_ERRORS.INVALID_PARAMS_ERROR, "Invalid user token.", sessionObj);
      return(false);
   }
   if (typeof(requestParams.action) != "string") {
      sendError(JSONRPC_ERRORS.INVALID_PARAMS_ERROR, "Invalid action.", sessionObj);
      return(false);
   }
   var responseObj = new Object();
   var connectionID = namespace.websocket.makeConnectionID(sessionObj); //makeConnectionID defined in WebSocket_Handshake.js
   var privateID = namespace.websocket.makePrivateID(requestParams.server_token, requestParams.user_token);
   if (privateID == null) {
      //must have active WSS session!
      sendError(JSONRPC_ERRORS.ACTION_DISALLOWED, "No active session.", sessionObj);
      return(false);
   }
   var resultObj = new Object(); //result to send in response
   switch (requestParams.action) {
      case "new":
         var gameContracts = getGameContracts(privateID);
         if (gameContracts.length > 10) {
            sendError(JSONRPC_ERRORS.ACTION_DISALLOWED, "Too many open game contracts.", sessionObj);
            return(false);
         }
         if (this.validContractObject(requestParams.contract) == false) {
            sendError(JSONRPC_ERRORS.ACTION_DISALLOWED, "Invalid contract object.", sessionObj);
            return(false);
         }
         var newContract = new Object();
         newContract = requestParams.contract;
         //sanitize private tokens!
         newContract.user_token = "";
         newContract.server_token = "";
         delete newContract.user_token;
         delete newContract.server_token;
         resultObj.contract = newContract;
         //looks okay; if it doesn't fill up it'll be returned
         gameContracts.push(newContract);
         break;
      default:
         sendError(JSONRPC_ERRORS.INVALID_PARAMS_ERROR, "Unrecognized action.", sessionObj);
         return(false);
         break;
   }
   sendResult(resultObj, sessionObj);
   return(true);
}

/**
* Examines an object for required contract properties.
*
* @param {Object} obj The object to examine.
*
* @return {Boolean} True if the object appears to be a valid contract object,
* false otherwise.
*/
function validContractObject(obj) {
   //check to make sure all required contract parameters are there:
   if (typeof(obj) != "object") {
      return(false);
   }
   if ((obj.contractID == undefined) || (obj.contractID == null) || (obj.contractID == "")) {
      return(false);
   }
   if ((obj.contractID == undefined) || (obj.contractID == null) || (obj.contractID == "")) {
      return(false);
   }
   if ((obj.players == undefined) || (obj.players == null) || (obj.players == "")) {
      return(false);
   }
   if (typeof(obj.players) != "object") {
      return(false);
   }
   if (typeof(obj.players.length) != "number") {
      return(false);
   }
   if (obj.players.length < 2) {
      return(false);
   }
   var numAgreed = 0;
   for (var count = 0; count < obj.players.length; count++) {
      var player = obj.players[count];
      if ((player.privateID == null) || (player.privateID == undefined) || (player.privateID == "")) {
         player.privateID = player._privateID;
      }
      if ((player.privateID == null) || (player.privateID == undefined) || (player.privateID == "")) {
         return(false);
      }
      //sanitize keys if accidentally included
      try {
         player.keychain = "";
         delete player.keychain;
      } catch (err) {}
      try {
         player._keychain = "";
         delete player._keychain;
      } catch (err) {}
      if (privateID == player.privateID) {
         //(only) player who created this automatically agrees
         player.agreed = true;
         numAgreed++;
      } else {
         player.agreed = false;
      }
   }
   if (numAgreed > 1) {
      return (false);
   }
   if (typeof(obj.prime) != "string") {
      return (false);
   }
   if (obj.prime.length == 0) {
      return (false);
   }
   if (typeof(obj.cardDecks) != "object") {
      return (false);
   }
   if (typeof(obj.cardDecks.faceup) != "object") {
      return (false);
   }
   //contract creation includes submission of face-up (generated) cards:
   if (obj.cardDecks.faceup.length < 52) {
      return (false);
   }
   //... but not other values:
   if (typeof(obj.cardDecks.facedown) != "object") {
     return (false);
   }
   if (typeof(obj.cardDecks.facedown.length) != "number") {
     return (false);
   }
   if (typeof(obj.cardDecks.dealt) != "object") {
     return (false);
   }
   if (typeof(obj.cardDecks.dealt.length) != "number") {
     return (false);
   }
   return (true);
}

/**
* Retrieves an indexed array of game contract objects
*
* @param {Event} event A standard WebSocket close event.
*/
function getGameContracts(connectionID) {
   if ((namespace.cp[connectionID] == null) || (namespace.cp[connectionID] == undefined) || (namespace.cp[connectionID] == "")) {
      //create a new container
      namespace.cp[connectionID] = new Array();
   }
   return (namespace.cp[connectionID]);
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
               // connectionObj.private_id disconnected
            }
         }
      }
   } catch (err) {
      console.error(err.stack);
   }
}

if (namespace.cp == undefined) {
   namespace.cp = new Object();
}

namespace.cp.getGameContracts = getGameContracts;
