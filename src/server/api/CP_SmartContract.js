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
   if (typeof(requestParams.server_token) != "string") {
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
         if (this.validContractObject(requestParams.contract, privateID, requestParams.account) == false) {
            sendError(JSONRPC_ERRORS.ACTION_DISALLOWED, "Invalid contract.", sessionObj);
            return(false);
         }
         try {
            var playerAccount = await this.validAccount(requestParams.account);
         } catch (err) {
            sendError(JSONRPC_ERRORS.ACTION_DISALLOWED, err.message, sessionObj);
            return(false);
         }
         var newContract = new Object();
         newContract = requestParams.contract;
         //sanitize private tokens!
         newContract.user_token = "";
         newContract.server_token = "";
         delete newContract.user_token;
         delete newContract.server_token;
         resetPlayerBalances(newContract); //reset all players' balances
         setPlayerBalance(newContract, privateID, newContract.table.tableInfo.buyIn); //set deposit balance for dealer/current user
         //subtract buy-in from account and deposit to contract
         var buyIn = "-"+String(newContract.table.tableInfo.buyIn);
         try {
            var result = await addToAccountBalance(playerAccount[0], buyIn, newContract);
            resultObj.contract = newContract;
            gameContracts.push(newContract);
            sendContractMessage("contractnew", newContract, privateID);
         } catch (err) {
            console.error(err.stack);
            sendError(JSONRPC_ERRORS.ACTION_DISALLOWED, "Could not update account balance.", sessionObj);
            return(false);
         }
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
* Notifies the players associated with a contract of a change to the contract.
*
* @param {String} messageType The message type of the notification (e.g. "contractnew")
* @param {Object} contractObj The contract to notify players about.
* @param {Object} fromPID The sender's private ID.
* @param {Array} [excludePIDs=null] The private IDs to exclude from the notification.
* The <code>fromPID</code> parameter is automatically included.
*/
function sendContractMessage(messageType, contractObj, fromPID, excludePIDs=null) {
   var recipients = new Array();
   if (excludePIDs == null) {
      excludePIDs = new Array();
   }
   excludePIDs.push(fromPID);
   contractObj.players.forEach((currentPlayer, index, arr) => {
      if (excludePIDs != null) {
         for (count=0; count < excludePIDs.length; count++) {
            if (excludePIDs[count] == currentPlayer.privateID) {
               return;
            }
         }
      }
      recipients.push(currentPlayer.privateID);
   });
   var messageObj = namespace.cp.buildCPMessage(messageType);
   messageObj.contract = contractObj;
   namespace.websocket.sendUpdate(recipients, messageObj, fromPID);
}

/**
* Adds to and stores a balance amount for an account row such as one retrieved via
* {@link validAccount}. The account should already have been checked for validity
* and proper credentials prior to calling this function.
*
* @param {Object} accountRow The latest account row (e.g. from the database), to
* use for the update.
* @param {String|Number} balanceInc The amount to increment the account's balance by, in
* the smallest denomination for the associated cryptocurrency type and
* network (e.g. satoshis if <code>type="bitcoin"</code>). A negative <code>balanceInc</code>
* will be subtracted from the account's balance.
* @param {Object} [contract=null] A contract object to also update. This object's
* <code>players</code> array will be searched and the player matchign the <code>accountRow</code>
* will have their balance updated with a negative <code>balanceInc</code>. In other words,
* if <code>balanceInc</code> is negative (a withdrawal from the account), then
* the update to the <code>contract.players</code> array will be positive
* (a deposit to the contract).
*
* @return {Promise} The promise will resolve with the new account balance (String) if the account
* was successfully updated. An <code>Error</code> object will be included with a rejection.
* @async
*/
async function addToAccountBalance(accountRow, balanceInc, contract=null) {
   var currentBalance = bigInt(accountRow.balance);
   var balanceUpdate = bigInt(balanceInc);
   currentBalance = currentBalance.plus(balanceUpdate);
   if (currentBalance.lesser(0)) {
      throw (new Error("Update amount exceeds available balance."));
   }
   //update database
   accountRow.balance = currentBalance.toString(10);
   accountRow.updated = namespace.cp.MySQLDateTime(new Date());
   var result = await namespace.cp.saveAccount(accountRow);
   if (result != true) {
      throw (new Error("Couldn't save account."));
   }
   //update contract
   if (contract != null) {
      for (var count = 0; count < contract.players.length; count++) {
         var currentPlayer = contract.players[count];
         if ((typeof(currentPlayer.account) == "object") && (currentPlayer.account != null)) {
            var account = currentPlayer.account;
            if (account != null) {
               if ((account.address == accountRow.address) &&
                   (account.type == accountRow.type) &&
                   (account.network == accountRow.network)) {
                  account.balance = currentBalance.toString(10);
                  return (accountRow.balance);
               }
            }
         }
      }
   }
   throw (new Error("Couldn't find account."));
}

/**
* Examines an object for required contract properties.
*
* @param {Object} obj The object to examine.
* @param {String} privateID The private ID of the contract creator / owner.
* @param {AccountObject} accountObj A valid account object to include
* in the <code>obj.players</code> array as an <code>account</code> property
* for the contract owner / creator. The existence of this object can be used to
* determine if a player has agree to the contract (otherwise it will be
* <code>null</code> or <code>undefined</code>).
*
* @return {Boolean} True if the object appears to be a valid contract object,
* false otherwise.
*/
function validContractObject(obj, privateID, accountObj) {
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
   if (validTableObject(obj.table) == false) {
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
         player.keychain = new Array();
         delete player.keychain;
      } catch (err) {}
      try {
         player._keychain = new Array();
         delete player._keychain;
      } catch (err) {}
      if (privateID == player.privateID) {
         //player who created this automatically agrees
         numAgreed++;
      } else {
         //account information for other players should not be included
         player.account = null;
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
* A CypherPoker.JS table object associated with a game.
* @typedef {Object} TableObject
* @property {String} ownerPID The private ID of the owner / creator of the table.
* @property {String} tableID The pseudo-randomly generated, unique table ID of the table.
* @property {String} tableName The name given to the table by the owner.
* @property {Array} requiredPID Indexed array of private IDs of peers required to join this room before it's
* considered full or ready.
* @property {Array} joinedPID Indexed array of private IDs that have been accepted by the owner. When a contract
* is first created, this array should only have one element: the owner's PID.
* @property {Object} tableInfo Additional information to be included with the table.
*/
/**
* Evaluates a provided object to determine if it's a valid table object.
*
* @param {TableObject} tableObj The object to examine.
*
* @return {Boolean} True if the supplied parameter has a valid {@link TableObject}
* structure, false otherwise.
*/
function validTableObject(tableObj) {
   if ((tableObj == undefined) || (tableObj == undefined)) {
      return (false);
   }
   if (typeof(tableObj.ownerPID) != "string") {
      return (false);
   }
   if (tableObj.ownerPID == "") {
      return (false);
   }
   if (typeof(tableObj.tableID) != "string") {
      return (false);
   }
   if (tableObj.tableID == "") {
      return (false);
   }
   if (typeof(tableObj.tableName) != "string") {
      return (false);
   }
   if (tableObj.tableName == "") {
      return (false);
   }
   if (typeof(tableObj.requiredPID) != "object") {
      return (false);
   }
   if (typeof(tableObj.requiredPID.length) != "number") {
      return (false);
   }
   //all players should now have joined the table
   if (tableObj.requiredPID.length > 0) {
      return (false);
   }
   if (typeof(tableObj.joinedPID) != "object") {
      return (false);
   }
   if (typeof(tableObj.joinedPID.length) != "number") {
      return (false);
   }
   if (tableObj.joinedPID.length < 2) {
      return (false);
   }
   for (var count=0; count < tableObj.requiredPID.length; count++) {
      if ((typeof(tableObj.requiredPID[count]) != "string") || (tableObj.requiredPID[count] == "")) {
         return (false);
      }
   }
   if (typeof(tableObj.joinedPID[0]) != "string") {
      return (false);
   }
   if (tableObj.joinedPID[0] != tableObj.ownerPID) {
      return (false);
   }
   if (typeof(tableObj.tableInfo) != "object") {
      return (false);
   }
   try {
      //buyIn, bigBlind, and smallBlind musst be valid positive integer values
      if ((typeof(tableObj.tableInfo.buyIn) != "string") || (tableObj.tableInfo.buyIn == "") || (tableObj.tableInfo.buyIn == "0")) {
         return (false);
      }
      var checkAmount = bigInt(tableObj.tableInfo.buyIn);
      if (checkAmount.lesser(0)) {
         return (false);
      }
      if ((typeof(tableObj.tableInfo.bigBlind) != "string") || (tableObj.tableInfo.bigBlind == "") || (tableObj.tableInfo.bigBlind == "0")) {
         return (false);
      }
      checkAmount = bigInt(tableObj.tableInfo.bigBlind);
      if (checkAmount.lesser(0)) {
         return (false);
      }
      if ((typeof(tableObj.tableInfo.smallBlind) != "string") || (tableObj.tableInfo.smallBlind == "") || (tableObj.tableInfo.smallBlind == "0")) {
         return (false);
      }
      checkAmount = bigInt(tableObj.tableInfo.smallBlind);
      if (checkAmount.lesser(0)) {
         return (false);
      }
   } catch (err) {
      return (false);
   }
   return (true);
}

/**
* An object containing player account information.
* @typedef {Object} AccountObject
* @property {String} address The cryptocurrency address associated with the account (and used as the
* primary identifier).
* @property {String} type The cryptocurrency type of the <code>address</code>. Valid values include: "bitcoin"
* @property {String} network The sub-network of the <code>address</code>, if applicable. Valid values include:
* "main", "test3"
* @property {String} password The password associated with the account.
* @property {String} [balance] Optional balance for the account (typically this value is ignored in favour
* of the database <code>balance</code> for the account).
*/
/**
* Evaluates a provided object to determine if it's a valid table object and
* optionally if the provided password correctly matches the one stored for the account.
*
* @param {AccountObject} accountObj The object to examine.
* @param {Boolean} [checkCredentials=true] If true, the login credentials
* provided are also validated, otherwise only the <code>accountObj</code>
* structure is checked.
*
* @return {Promise} The promise will resolve with an array containing the latest
* database (or otherwise stored) rows for the associated {@link AccountObject}
* parameter if it has a valid structure and optionally if the
* account exists and the password matches. Otherwise the promise will reject with
* an <code>Error</code> object.
* @async
*/
async function validAccount(accountObj, checkCredentials=true) {
   if ((accountObj == undefined) || (accountObj == null)) {
      return (false);
   }
   if (typeof(accountObj.address) != "string") {
      return (false);
   }
   if (accountObj.address == "") {
      return (false);
   }
   if (typeof(accountObj.type) != "string") {
      return (false);
   }
   if (accountObj.type == "") {
      return (false);
   }
   if (typeof(accountObj.network) != "string") {
      return (false);
   }
   if (accountObj.network == "") {
      return (false);
   }
   if (typeof(accountObj.password) != "string") {
      return (false);
   }
   if (accountObj.password == "") {
      return (false);
   }
   var accountResult = null;
   if (checkCredentials) {
      var searchObj = new Object();
      //don't include (potentially incorrect) balance and (unhashed) password!
      searchObj.address = accountObj.address;
      searchObj.type = accountObj.type;
      searchObj.network = accountObj.network;
      accountResult = await namespace.cp.getAccount(searchObj);
      if (accountResult.length < 1) {
         throw (new Error("No matching account."));
      }
      var pwhash = accountResult[0].pwhash;
      if (namespace.cp.checkPassword(accountObj.password, pwhash) == false) {
         throw (new Error("Wrong password."));
      }
   }
   return (accountResult);
}

/**
* Resets all player (not account) balances to 0 within a specific contract object.
*
* @param {Object} contractObj The contract within which to reset all players'
* balances.
*/
function resetPlayerBalances(contractObj) {
   for (var count = 0; count < contractObj.players.length; count++) {
      var player = contractObj.players[count];
      player.balance = "0";
   }
}

/**
* Sets the balance of a player (not account) within a specific contract object.
*
* @param {Object} contractObj The contract within which to set the player's
* balance.
* @param {String} privateID The private ID of the player to update.
* @param {String|Number} balance The balance amount to set.
*/
function setPlayerBalance(contractObj, privateID, balance) {
   for (var count = 0; count < contractObj.players.length; count++) {
      var player = contractObj.players[count];
      if (player.privateID == privateID) {
         player.balance = String(balance);
         break;
      }
   }
}

/**
* Retrieves an indexed array of game contract objects
*
* @param {String} privateID The private ID of the user for which to retrieve currently active
* smart contracts.
*
* @return {Array} An indexed list of smart contract objects registered the <code>privateID</code>. If none
* are registered, an empty array is returned.
*/
function getGameContracts(privateID) {
   if ((namespace.cp[privateID] == null) || (namespace.cp[privateID] == undefined) || (namespace.cp[privateID] == "")) {
      //create a new container
      namespace.cp[privateID] = new Array();
   }
   return (namespace.cp[privateID]);
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
