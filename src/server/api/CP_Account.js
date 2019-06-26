/**
* @file Manages cryptocurrency accounts using remote, local, or in-memory database(s),
* and provides live blockchain interaction functionality.
*
* @version 0.5.1
*/
async function CP_Account (sessionObj) {
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
      sendError(JSONRPC_ERRORS.INVALID_PARAMS_ERROR, "Invalid action parameter.", sessionObj);
      return(false);
   }
   if (typeof(requestParams.password) != "string") {
      sendError(JSONRPC_ERRORS.INVALID_PARAMS_ERROR, "Invalid password parameter.", sessionObj);
      return(false);
   }
   if (typeof(requestParams.type) != "string") {
      sendError(JSONRPC_ERRORS.INVALID_PARAMS_ERROR, "Invalid account type parameter.", sessionObj);
      return(false);
   }
   if (typeof(requestParams.network) != "string") {
      sendError(JSONRPC_ERRORS.INVALID_PARAMS_ERROR, "Invalid network parameter.", sessionObj);
      return(false);
   }
   var responseObj = new Object();
   //var connectionID = namespace.wss.makeConnectionID(sessionObj); //makeConnectionID defined in WSS_Handshake.js
   var privateID = namespace.wss.getPrivateID(sessionObj); //getPrivateID defined in WSS_Handshake.js
   if (privateID == null) {
      //must have active WSS session!
      sendError(JSONRPC_ERRORS.ACTION_DISALLOWED, "Session not established.", sessionObj);
      return(false);
   }
   var resultObj = new Object(); //result to send in response
   resultObj.fees = new Object(); //include fee(s) information
   var fees = config.CP.API[requestParams.type].default[requestParams.network];
   var depositFee = bigInt(fees.depositFee);
   var minerFee = bigInt(fees.minerFee);
   //note that reported deposit fee includes the one defined in the configuration plus the dynamic miner fee:
   resultObj.fees.deposit = depositFee.plus(minerFee).toString(10);
   resultObj.fees.cashout = minerFee.toString(10);
   try {
      switch (requestParams.action) {
         case "new":
            //create new account
            var ccHandler = getHandler("cryptocurrency", requestParams.type);
            if (ccHandler == null) {
               sendError(JSONRPC_ERRORS.INVALID_PARAMS_ERROR, "Cryptocurrency \""+requestParams.type+"\" not supported.", sessionObj);
               return(false);
            }
            var accountObj = new Object(); //returned to user
            var fullAccountObj = new Object(); //stored internally
            var newWalletResult = await ccHandler.makeNewWallet(requestParams.type, requestParams.network);
            let hash = crypto.createHash("sha256");
            hash.update(requestParams.password);
            var pwHash = hash.digest("hex");
            fullAccountObj.type = requestParams.type;
            fullAccountObj.network = requestParams.network;
            var walletType = null;
            switch (requestParams.type) {
               case "bitcoin":
                  if (requestParams.network == "main") {
                     walletType = "bitcoin";
                  } else {
                     walletType = "test3";
                  }
                  break;
               case "bitcoincash":
                  if (requestParams.network == "main") {
                     walletType = "bitcoincash";
                  } else {
                     walletType = "bchtest";
                  }
                  break;
               default:
                  sendError(JSONRPC_ERRORS.INVALID_PARAMS_ERROR, "Cryptocurrency \""+requestParams.type+"\" not supported.", sessionObj);
                  return(false);
                  break;
            }
            fullAccountObj.chain = config.CP.API.wallets[walletType].startChain;
            fullAccountObj.addressIndex = config.CP.API.wallets[walletType].startIndex;
            if ((requestParams.type == "bitcoin") || (requestParams.type == "bitcoincash")) {
               //use BIP44 derivation path for Bitcoin related addresses
               var derivationPath = "m/"+String(fullAccountObj.chain)+"/"+String(fullAccountObj.addressIndex);
            } else {
               sendError(JSONRPC_ERRORS.INVALID_PARAMS_ERROR, "Cryptocurrency \""+requestParams.type+"\" not supported.", sessionObj);
               return(false);
            }
            fullAccountObj.address = ccHandler.getDerivedWallet(derivationPath, requestParams.network, true, true);
            fullAccountObj.pwhash = pwHash;
            fullAccountObj.balance = "0";
            fullAccountObj.updated = MySQLDateTime(new Date()); //make sure to store local date/time (db may differ)
            accountObj.type = requestParams.type;
            accountObj.network = requestParams.network;
            accountObj.chain = config.CP.API.wallets[walletType].startChain;
            accountObj.addressIndex = config.CP.API.wallets[walletType].startIndex;
            accountObj.address = fullAccountObj.address;
            accountObj.pwhash = pwHash;
            accountObj.balance = bigInt("0");
            var feesObj = resultObj.fees; //save reference to previously created fees object
            resultObj = accountObj;
            resultObj.fees = feesObj; //copy previously created fees object
            var saved = await namespace.cp.saveAccount(fullAccountObj);
            if (saved == false) {
               sendError(JSONRPC_ERRORS.INTERNAL_ERROR, "Couldn't save account information.", sessionObj);
               return(false);
            }
            break;
         case "info":
            //retrieve account information
            if (typeof(requestParams.password) != "string") {
               sendError(JSONRPC_ERRORS.AUTH_FAILED, "Authentication failed.", sessionObj);
               return (false);
            }
            var searchObj = new Object();
            searchObj.address = requestParams.address;
            searchObj.type = requestParams.type;
            searchObj.network = requestParams.network;
            try {
               var accountResults = await namespace.cp.getAccount(searchObj);
            } catch (err) {
               console.dir(err);
               sendError(JSONRPC_ERRORS.INTERNAL_ERROR, "Database error.", sessionObj);
               return (false);
            }
            if (accountResults.length < 1) {
               sendError(JSONRPC_ERRORS.ACTION_DISALLOWED, "Account does not exist.", sessionObj);
               return (false);
            }
            if (checkPassword(requestParams.password, accountResults[0].pwhash) == false) {
               sendError(JSONRPC_ERRORS.AUTH_FAILED, "Authentication failed.", sessionObj);
               return (false);
            }
            ccHandler = getHandler("cryptocurrency", requestParams.type);
            var balanceConfirmed = true;
            if ((accountResults.length == 1) &&
               ((accountResults[0].balance=="0") || (accountResults[0].balance=="NULL") ||
                (accountResults[0].balance=="") || (accountResults[0].balance==null))) {
               //latest balance not yet confirmed
               var balanceConfirmed = false;
               var lastUpdateCheck = new Date(accountResults[0].updated); //this date/time must be relative to local date/time
               var currentDateTime = new Date();
               var delta = currentDateTime.valueOf()-lastUpdateCheck.valueOf();
               if (delta < 0) {
                  //this may indicate a local clock discrepency (may have been reset or updated)
                  delta = 0;
               }
               var updateLimitSeconds = config.CP.API[requestParams.type].default.updateLimitSeconds * 1000; //convert to milliseconds
               if (delta >= updateLimitSeconds) {
                  //time limit elapsed for checking live balance (allowed)
                  try {
                     var balanceResult = await ccHandler.getBlockchainBalance(requestParams.address, requestParams.type, requestParams.network);
                     resultObj.address = searchObj.address;
                     resultObj.type = searchObj.type;
                     resultObj.network = searchObj.network;
                     if ((balanceResult.balance == null) || (balanceResult.balance == undefined) || (balanceResult.balance == "")) {
                        balanceResult.balance = 0;
                     }
                     resultObj.balance = String(balanceResult.balance);
                     if (resultObj.balance != accountResults[0].balance) {
                        //new confirmed deposit detected; forward new account balance to cashout wallet
                        var fromAddressPath = "m/" + String(accountResults[0].chain) + "/" + String(accountResults[0].addressIndex);
                        var cashoutPath = config.CP.API[requestParams.type].default[requestParams.network].cashOutAddrPath;
                        var cashoutAddress = ccHandler.getDerivedWallet(cashoutPath, requestParams.network, true);
                        var transferAmount = bigInt(balanceResult.balance);
                        var minerFee = bigInt(config.CP.API[requestParams.type].default[requestParams.network].minerFee);
                        var depositFee = bigInt(config.CP.API[requestParams.type].default[requestParams.network].depositFee);
                        transferAmount = transferAmount.minus(minerFee);
                        try {
                           var txResult = await ccHandler.sendTransaction(fromAddressPath, cashoutAddress, transferAmount, minerFee, requestParams.type, requestParams.network);
                        } catch (err) {
                           sendError(JSONRPC_ERRORS.INTERNAL_ERROR, "Unable to forward transaction to cashout wallet.", sessionObj);
                           return(false);
                        }
                        if (txResult != null) {
                           if ((txResult.tx != undefined) && (txResult.tx != null)) {
                              if ((txResult.tx.hash != undefined) && (txResult.tx.hash != null) && (txResult.tx.hash != "")) {
                                 //Successfully forwarded new confirmed deposit:
                                 //Sender: ccHandler.getDerivedWallet(fromWallet).address or ccHandler.getDerivedWallet(fromWallet).address
                                 //Receiver: cashoutAddress
                                 //Transaction hash: txResult.tx.hash
                                 //Amount: transferAmount
                                 //Miner fee: minerFee
                                 //Deposit fee: depositFee
                              }
                           }
                        } else {
                           console.log ("Couldn't forward new account balance:");
                           console.dir (txResult);
                           //manual transfer may be required
                        }
                        //store updated account information
                        resultObj.confirmed = true;
                        transferAmount = transferAmount.minus(depositFee); //reduce amount by deposit fee
                        resultObj.balance = transferAmount.toString(10); //amount transferred (minus fees) is the new account balance
                        accountResults[0].balance = transferAmount.toString(10); //update database query object
                        accountResults[0].updated = MySQLDateTime(new Date());
                        var saved = await namespace.cp.saveAccount(accountResults[0]); //save to database
                        if (saved == false) {
                           sendError(JSONRPC_ERRORS.INTERNAL_ERROR, "Couldn't save account information.", sessionObj);
                           return(false);
                        }
                     } else {
                        //update updated date/time
                        resultObj.confirmed = false;
                        accountResults[0].updated = MySQLDateTime(new Date());
                        var updated = await namespace.cp.updateAccount(accountResults[0]); //use search result since it contains primary_key (required)
                        if (updated == false) {
                           sendError(JSONRPC_ERRORS.INTERNAL_ERROR, "Couldn't update account information.", sessionObj);
                           return(false);
                        }
                     }
                  } catch (err) {
                     console.error(err);
                     sendError(JSONRPC_ERRORS.INTERNAL_ERROR, "Live balance unavailable. Try again later.", sessionObj);
                  }
               } else {
                  //within time limit for checking live balance (not allowed)
                  resultObj.address = searchObj.address;
                  resultObj.type = searchObj.type;
                  resultObj.network = searchObj.network;
                  resultObj.balance = accountResults[0].balance;
                  resultObj.confirmed = false;
               }
            } else {
               //latest balance already confirmed, just return it
               resultObj.address = searchObj.address;
               resultObj.type = searchObj.type;
               resultObj.network = searchObj.network;
               resultObj.balance = accountResults[0].balance;
               resultObj.confirmed = true;
            }
            break;
         case "cashout":
            //cashout an account to a provided address
            ccHandler = getHandler("cryptocurrency", requestParams.type);
            if (typeof(requestParams.password) != "string") {
               sendError(JSONRPC_ERRORS.AUTH_FAILED, "Authentication failed.", sessionObj);
               return (false);
            }
            if (typeof(requestParams.amount) != "string") {
               if (typeof(requestParams.amount) == "number") {
                  requestParams.amount = String(requestParams.amount);
               } else {
                  sendError(JSONRPC_ERRORS.INVALID_PARAMS_ERROR, "Amount not specified.", sessionObj);
                  return (false);
               }
            }
            if (typeof(requestParams.toAddress) != "string") {
               sendError(JSONRPC_ERRORS.INVALID_PARAMS_ERROR, "Receiving address not specified.", sessionObj);
               return (false);
            }
            if (requestParams.toAddress == requestParams.address) {
               sendError(JSONRPC_ERRORS.INVALID_PARAMS_ERROR, "Sending and receiving addresses can't be the same.", sessionObj);
               return (false);
            }
            if (cashoutIsPending(requestParams.address, requestParams.type, requestParams.network) == true) {
               sendError(JSONRPC_ERRORS.ACTION_DISALLOWED, "A cashout request is currently pending. Only one request may be pending at a time.", sessionObj);
               return (false);
            }
            if (typeof(requestParams.feeAmount) != "string") {
               if (typeof(requestParams.feeAmount) == "number") {
                  requestParams.feeAmount = String(requestParams.feeAmount);
               } else {
                  //use config default
                  requestParams.feeAmount = config.CP.API[requestParams.type].default[requestParams.network].minerFee;
               }
            }
            var searchObj = new Object();
            searchObj.address = requestParams.address;
            searchObj.type = requestParams.type;
            searchObj.network = requestParams.network;
            try {
               accountResults = await namespace.cp.getAccount(searchObj);
            } catch (err) {
               console.dir(err);
               sendError(JSONRPC_ERRORS.INTERNAL_ERROR, "Database error.", sessionObj);
               return (false);
            }
            if (accountResults.length < 1) {
               sendError(JSONRPC_ERRORS.ACTION_DISALLOWED, "Account does not exist.", sessionObj);
               return (false);
            }
            if (checkPassword(requestParams.password, accountResults[0].pwhash) == false) {
               sendError(JSONRPC_ERRORS.AUTH_FAILED, "Authentication failed.", sessionObj);
               return (false);
            }
            var fees = bigInt(requestParams.feeAmount);
            var cashoutAmount = bigInt(requestParams.amount);
            var totalCashoutAmount = cashoutAmount.plus(fees);
            var availableAmount = bigInt(accountResults[0].balance);
            if (totalCashoutAmount.greater(availableAmount)) {
               sendError(JSONRPC_ERRORS.ACTION_DISALLOWED, "Insufficient balance.", sessionObj);
               return (false);
            }
            var newBalance = availableAmount.minus(totalCashoutAmount);
            addPendingCashout(requestParams.address, requestParams.toAddress, requestParams.type, requestParams.network, cashoutAmount.toString(10), fees.toString(10));
            var txResult = await ccHandler.cashoutToAddress(requestParams.toAddress, cashoutAmount.toString(10), fees.toString(10), requestParams.type, requestParams.network);
            removePendingCashout(requestParams.address, requestParams.type, requestParams.network);
            if (txResult != null) {
               if ((txResult.tx != undefined) && (txResult.tx != null)) {
                  if ((txResult.tx.hash != undefined) && (txResult.tx.hash != null) && (txResult.tx.hash != "")) {
                     accountResults[0].balance = newBalance.toString(10);
                     var saved = await namespace.cp.saveAccount(accountResults[0]);
                     if (saved == false) {
                        console.error("Account \""+accountResults[0]+"\" couldn't be updated with new balance: "+accountResults[0].balance);
                        sendError(JSONRPC_ERRORS.INTERNAL_ERROR, "Couldn't save account information.", sessionObj, {"txHash":txResult.tx.hash});
                        return(false);
                     }
                     resultObj.txHash = txResult.tx.hash;
                     resultObj.toAddress = requestParams.toAddress;
                     resultObj.amount = cashoutAmount.toString(10);
                     resultObj.fees = fees.toString(10);
                     resultObj.balance = newBalance.toString(10);
                  }
               }
            } else {
               console.error("Couldn't process cashout transaction:");
               console.dir(txResult);
               sendError(JSONRPC_ERRORS.INTERNAL_ERROR, "Couldn't process transaction.", sessionObj);
               return(false);
            }
            break;
         case "transfer":
            //transfer account balance to another account
            if (typeof(requestParams.password) != "string") {
               sendError(JSONRPC_ERRORS.AUTH_FAILED, "Authentication failed.", sessionObj);
               return (false);
            }
            if (typeof(requestParams.amount) != "string") {
               if (typeof(requestParams.amount) == "number") {
                  requestParams.amount = String(requestParams.amount);
               } else {
                  sendError(JSONRPC_ERRORS.INVALID_PARAMS_ERROR, "Amount not specified.", sessionObj);
                  return (false);
               }
            }
            if (typeof(requestParams.toAccount) != "string") {
               sendError(JSONRPC_ERRORS.INVALID_PARAMS_ERROR, "Receiving account not specified.", sessionObj);
               return (false);
            }
            var sourceSearchObj = new Object();
            sourceSearchObj.address = requestParams.address;
            sourceSearchObj.type = requestParams.type;
            sourceSearchObj.network = requestParams.network;
            var targetSearchObj = new Object();
            targetSearchObj.address = requestParams.toAccount;
            targetSearchObj.type = requestParams.type;
            targetSearchObj.network = requestParams.network;
            try {
               var sourceAccountRes = await namespace.cp.getAccount(sourceSearchObj);
            } catch (err) {
               console.dir(err);
               sendError(JSONRPC_ERRORS.INTERNAL_ERROR, "Database error.", sessionObj);
               return (false);
            }
            if (sourceAccountRes.length < 1) {
               sendError(JSONRPC_ERRORS.INVALID_PARAMS_ERROR, "Source account not found.", sessionObj);
               return (false);
            }
            if (checkPassword(requestParams.password, sourceAccountRes[0].pwhash) == false) {
               sendError(JSONRPC_ERRORS.AUTH_FAILED, "Authentication failed.", sessionObj);
               return (false);
            }
            try {
               var targetAccountRes = await namespace.cp.getAccount(targetSearchObj);
            } catch (err) {
               console.dir(err);
               sendError(JSONRPC_ERRORS.INTERNAL_ERROR, "Database error.", sessionObj);
               return (false);
            }
            if (targetAccountRes.length < 1) {
               sendError(JSONRPC_ERRORS.INVALID_PARAMS_ERROR, "Target account not found.", sessionObj);
               return (false);
            }
            if (sourceAccountRes[0].type != targetAccountRes[0].type) {
               sendError(JSONRPC_ERRORS.ACTION_DISALLOWED, "Incompatible currencies: \""+sourceAccountRes[0].type+"\" and \""+targetAccountRes[0].type+"\"", sessionObj);
               return (false);
            }
            if (sourceAccountRes[0].network != targetAccountRes[0].network) {
               sendError(JSONRPC_ERRORS.ACTION_DISALLOWED, "Incompatible currency networks: \""+sourceAccountRes[0].network+"\" and \""+targetAccountRes[0].network+"\"", sessionObj);
               return (false);
            }
            try {
               var transferAmount = bigInt(requestParams.amount);
            } catch (err) {
               sendError(JSONRPC_ERRORS.INVALID_PARAMS_ERROR, "Invalid transfer amount.", sessionObj);
               return (false);
            }
            var sourceBalance = bigInt(sourceAccountRes[0].balance);
            var targetBalance = bigInt(targetAccountRes[0].balance);
            if (transferAmount.greater(sourceBalance)) {
               sendError(JSONRPC_ERRORS.ACTION_DISALLOWED, "Insufficient account balance.", sessionObj);
               return (false);
            }
            sourceBalance = sourceBalance.minus(transferAmount);
            targetBalance = targetBalance.plus(transferAmount);
            sourceAccountRes[0].balance = sourceBalance.toString(10);
            sourceAccountRes[0].updated = MySQLDateTime(new Date());
            targetAccountRes[0].balance = targetBalance.toString(10);
            targetAccountRes[0].updated = MySQLDateTime(new Date());
            var saved = await namespace.cp.saveAccount(sourceAccountRes[0]);
            if (saved == false) {
               console.error("Account \""+sourceAccountRes[0]+"\" couldn't be updated with new balance: "+sourceAccountRes[0].balance);
               sendError(JSONRPC_ERRORS.INTERNAL_ERROR, "Couldn't save account information.", sessionObj);
               return(false);
            }
            saved = await namespace.cp.saveAccount(targetAccountRes[0]);
            if (saved == false) {
               console.error("Account \""+targetAccountRes[0]+"\" couldn't be updated with new balance: "+targetAccountRes[0].balance);
               sendError(JSONRPC_ERRORS.INTERNAL_ERROR, "Couldn't save account information.", sessionObj);
               return(false);
            }
            resultObj.address = requestParams.address;
            resultObj.type = requestParams.type;
            resultObj.network = requestParams.network;
            resultObj.balance = sourceBalance.toString(10);
            resultObj.confirmed = true;
            break;
         default:
            sendError(JSONRPC_ERRORS.INVALID_PARAMS_ERROR, "Unrecognized action.", sessionObj);
            return(false);
            break;
      }
   } catch (err) {
      console.error(err);
      sendError(JSONRPC_ERRORS.INTERNAL_ERROR, "Error processing request.", sessionObj);
      return (false);
   }
   sendResult(resultObj, sessionObj);
   return(true);
}

/**
* An object containing individual account properties. A player may have multiple
* accounts.
*
* @typedef {Object} AccountObject
* @property {String} type The address type. Supported values include: "bitcoin
* @property {Number} chain The HD wallet chain value used in the derivation path.
* @property {Number} addressIndex The HD wallet address index used in the derivation path.
* @property {String} address The generated cryptocurrency address for the account.
* @property {String} network The sub-network, if applicable, to which the address belongs.
* For example "main", "test3", etc.
* @property {String} pwhash The SHA256 hash of the password associated with the account.
* @property {BigInteger} balance The current account balance in the lowest denomination of
* the associated cryptocurrency (e.g. satoshis if <code>type="bitcoin"</code>).
* @property {String} updated The [ISO8601 date/time]{@link https://en.wikipedia.org/wiki/ISO_8601} that this account object was last updated.
* @property {Object} wallet The HD wallet containig the private and public keys as well as the WIF.
*
* @see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date/toISOString
*/

/**
* Generates a MySQL-compatible date/timestamp.
*
* @param {Date} dateObj The native JavaScript Date object from which to
* generate the timestamp.
*
* @return {String} A MySQL "TIMESTAMP" field type compatible date/time string.
*/
function MySQLDateTime(dateObj) {
	if ((dateObj == undefined) || (dateObj == null) || (dateObj == "")) {
		var now = new Date();
	} else {
		now = dateObj;
	}
	var returnStr = new String();
	returnStr += String(now.getFullYear())+"-";
	returnStr += String(now.getMonth()+1)+"-";
	returnStr += String(now.getDate())+" ";
	if (now.getHours() < 10) {
		returnStr += "0";
	}
	returnStr += String(now.getHours())+":";
	if (now.getMinutes() < 10) {
		returnStr += "0";
	}
	returnStr += String(now.getMinutes())+":";
	if (now.getSeconds() < 10) {
		returnStr += "0";
	}
	returnStr += String(now.getSeconds());
	return (returnStr);
}

/**
* Compares a password (or any string) against its SHA256 hash.
*
* @param {String} password The plaintext password (or any string) to compare.
* @param {String} pwhash The hex-encoded, SHA256 hash to compare <code>password</code>
* against.
*
* @return {Boolean} True if the password matched the supplied hash, false otherwise.
*/
function checkPassword(password, pwhash) {
   let hash = crypto.createHash("sha256");
   hash.update(password);
   var hashDigest = hash.digest("hex");
   if (hashDigest == pwhash)  {
      return (true);
   } else {
      return (false);
   }
}

/**
* Searches for and returns the latest details about a specific account.
*
* @param {Object} searchObj An object specifiying the search parameters. All
* included criteria must be met in order for a match.
* @param {String} [searchObj.address] The cryptocurrency address of the account. This
* is also the main account identifier.
* @param {String} [searchObj.type] The cryptocurrency account type.
* @param {String} [searchObj.network] The cryptocurrency sub-network type.
*
* @return {Promise} The resolved promise contains an array of up to two {@link AccountObject}
* instances containing the latest activity for the account, index 0 being the most recent, or <code>null</code>
* if no matching account exists. A rejected promise contains an <code>Error</code> object.
* @async
*/
async function getAccount(searchObj) {
   if ((searchObj == null) || (searchObj == undefined)) {
      return (null);
   }
   if (config.CP.API.database.enabled == true) {
      var result = await callAccountDatabase("getrecord", searchObj);
      if (result.error == undefined) {
         return (result.result);
      } else {
         if (result.error.code == -32602) {
            //no matching account, return empty result set
            return (new Array());
         } else {
            throw (new Error(result.error));
         }
      }
   } else {
      //use in-memory data instead
      var resultArr = new Array();
      if (namespace.cp.accounts == undefined) {
         namespace.cp.accounts = new Array();
         return (resultArr);
      }
      for (var count=(namespace.cp.accounts.length-1); count >= 0 ; count--) {
        var currentAccount = namespace.cp.accounts[count];
        var criteriaCount = 0;
        var matchedCount = 0;
        for (var item in searchObj) {
           var searchItem = searchObj[item];
           if (typeof(searchItem) != "function") {
             criteriaCount++;
             if (searchItem == currentAccount[item]) {
                //note that data types must match exactly
                matchedCount++;
             }
          }
        }
        if (criteriaCount == matchedCount) {
          currentAccount.primary_key = count;
          resultArr.push (currentAccount);
        }
        //increase here if we want more than 2 recent records for account
        if (resultArr.length == 2) {
          break;
        }
      }
   }
   return (resultArr);
}

/**
* Saves a new or existing (updated) account.
*
* @param {AccountObject} accountObj Contains the account information to save.
*
* @return {Promise} The resolved promise returns <code>true</code> if the account
* was successfully saved, <code>false</code> false otherwise.
* @async
*/
async function saveAccount(accountObj) {
   if (config.CP.API.database.enabled == true) {
      //save to remote database if available
      var saved = false;
      var result = await callAccountDatabase("putrecord", accountObj);
      if (result.error == undefined) {
         saved = true;
      } else {
         throw (new Error(result.error));
      }
   } else {
      //use in-memory array database
      if (namespace.cp.accounts == undefined) {
         namespace.cp.accounts = new Array();
      }
      var currentDate = new Date();
      accountObj.updated = MySQLDateTime(currentDate);
      namespace.cp.accounts.push(accountObj);
   }
   return (true);
}

/**
* Updates the "updated" (date/time) property of an  existing account. Any other changes to
* account information should use {@link saveAccount} in order to maintain the account's history.
*
* @param {AccountObject} accountObj Contains the account information to update. This object
* must contain the <code>primary_key</code> value of the row to update.
*
* @return {Promise} The resolved promise returns <code>true</code> if the account
* was successfully updated, <code>false</code> false otherwise.
* @async
*/
async function updateAccount(accountObj) {
   if (config.CP.API.database.enabled == true) {
      //save to remote database if available
      var result = await callAccountDatabase("updaterecord", accountObj);
      if (result.error == undefined) {
         updated = true;
      } else {
         throw (new Error(result.error));
      }
   } else {
      //use in-memory array database
      if (namespace.cp.accounts == undefined) {
         namespace.cp.accounts = new Array();
         return (false);
      }
      var currentDate = new Date();
      namespace.cp.accounts[accountObj.primary_key].updated = MySQLDateTime(currentDate);
   }
   return (true);
}

/**
* Calls the an account database interface with a method, message, and optional HMAC
* signature.
*
* @param {String} method The adapter or remote (RPC) method to invoke.
* @param {Object} message The accompanying data to stringify, (if applicable) sign with
* <code>config.CP.API.database.accessKey</code>, and include with
* the remote (RPC) or local request.
*
* @return {Promise} Resolves with the response object returned from the server or
* database adapter, or rejects with an error.
*/
function callAccountDatabase(method, message) {
   var promise = new Promise(function(resolve, reject) {
      if (config.CP.API.database.enabled) {
         var url = config.CP.API.database.url;
         var transport = url.split("://")[0];
         if (transport == "https") {
            transport = "http";
         }
         switch (transport) {
            case "http":
               //standard remote database call:
               var host = config.CP.API.database.host;
               var accessKey = config.CP.API.database.accessKey;
               var txObject = new Object();
               txObject.jsonrpc = "2.0";
               txObject.id = String(Math.random()).split(".")[1];
               txObject.method = method;
               txObject.params = new Object();
               //create HMAC using access key:
               var hmac = crypto.createHmac('SHA256', accessKey);
               //update with stringified message:
               hmac.update(JSON.stringify(message));
               //create signature:
               var signature = hmac.digest('hex');
               txObject.params.signature = signature;
               txObject.params.message = message;
               var headersObj = new Object();
               headersObj = {
                  "Content-Type":"application/json-rpc",
                  "accept":"application/json-rpc",
                  "Host":host
               };
               request({
                  url: url,
                  method: "POST",
                  body: txObject,
                  headers: headersObj,
                  json: true
               }, (error, response, body) => {
                  if (error) {
                     console.error ("Account database error:");
                     console.error (error);
                     reject(error);
                  } else {
                     resolve(body);
                  }
               });
               break;
            default:
               //process call using adapter
               var adapterConfigPath = "CP.API.database.adapters."+transport;
               var adapterConfig = getConfigByPath(adapterConfigPath);
               var adapter = adapterConfig.instance;
               var requestObj = new Object();
               requestObj.jsonrpc = "2.0";
               requestObj.id = String(Math.random()).split(".")[1];
               requestObj.method = method;
               requestObj.params = new Object();
               requestObj.params.message = message;
               adapter.invoke(requestObj).then(result => {
                  resolve(result); //any JSON-RPC response is valid
               }).catch (err => {
                  reject(err);
               });
               break;
         }
      } else {
         reject(new Error("Database interactions are disabled."));
      }
   });
   return (promise);
}

/**
* Adds a pending cashout transaction to the <code>namespace.cp.pendingCashouts</code>
* array.
*
* @param {String} fromAccount The account address that is cashing out.
* @param {String} toAddress The address to which the funds are being sent.
* @param {String} type The cryptocurrency type associated with the transaction (e.g. "bitcoin").
* @param {String} network The cryptocurrency sub-network associated with the transaction (e.g. "main" or "test3").
* @param {String} amount The amount of the transaction in the smallest denomination for the associated
* cryptocurrency.
* @param {String} fees Any miner fee(s) for the transaction in the smallest denomination for the associated
* cryptocurrency.
*/
function addPendingCashout(fromAccount, toAddress, type, network, amount, fees) {
   if (namespace.cp.pendingCashouts == undefined) {
      namespace.cp.pendingCashouts = new Array();
   }
   var cashoutObject = new Object();
   cashoutObject.from = fromAccount;
   cashoutObject.to = toAddress;
   cashoutObject.type = type;
   cashoutObject.network = network;
   cashoutObject.amount = amount;
   cashoutObject.fees = fees;
   var now = new Date();
   cashoutObject.timestamp = now.toISOString();
   namespace.cp.pendingCashouts.push(cashoutObject);
   //should array be saved in case server quits?
}

/**
* Checks if a cashout transaction for a specific account is pending (appears in the
* <code>namespace.cp.pendingCashouts</code> array). Only one pending cashout transaction
* per account, cryptocurrency type, and network, is assumed to exist.
*
* @param {String} fromAccount The account address to check.
* @param {String} type The cryptocurrency type associated with the pending transaction (e.g. "bitcoin").
* @param {String} network The cryptocurrency sub-network associated with the pending transaction (e.g. "main" or "test3").
*
* @return {Boolean} True if the specified account has a transaction pending, false otherwise.
*/
function cashoutIsPending(fromAccount, type, network) {
   if (namespace.cp.pendingCashouts == undefined) {
      namespace.cp.pendingCashouts = new Array();
      return (false);
   }
   if (namespace.cp.pendingCashouts.length == 0) {
      return (false);
   }
   for (var count=0; count < namespace.cp.pendingCashouts.length; count++) {
      var currentPendingCashout = namespace.cp.pendingCashouts[count];
      if ((currentPendingCashout.from == fromAccount) &&
         (currentPendingCashout.type == type) &&
         (currentPendingCashout.network == network)) {
            return (true);
         }
   }
   return (false);
}

/**
* Removes a pending cashout transaction from the <code>namespace.cp.pendingCashouts</code>
* array.
*
* @param {String} fromAccount The account address that is cashing out.
* @param {String} type The cryptocurrency type associated with the transaction (e.g. "bitcoin").
* @param {String} network The cryptocurrency sub-network associated with the transaction (e.g. "main" or "test3").
*
* @return {Object} The pending cashout transaction removed from the internal <code>namespace.cp.pendingCashouts</code>
* array, of <code>null</code> if no matching transaction exists.
*/
function removePendingCashout(fromAccount, type, network) {
   if (namespace.cp.pendingCashouts == undefined) {
      namespace.cp.pendingCashouts = new Array();
      return (null);
   }
   for (var count=0; count < namespace.cp.pendingCashouts.length; count++) {
      var currentPendingCashout = namespace.cp.pendingCashouts[count];
      if ((currentPendingCashout.from == fromAccount) &&
         (currentPendingCashout.type == type) &&
         (currentPendingCashout.network == network)) {
            var txObj = namespace.cp.pendingCashouts.splice(count, 1);
            return (txObj);
         }
   }
   return (null);
}


/**
* Returns an estimated miner fee for a transaction. The fee estimation may either be based on an
* external service or an internal calculation.
*
* @param {*} [txData=null] The transaction for which to estimate the fee. The format
* for this parameter differs based on the <code>APIType</code> and possibly <code>network</code>.<br/>
* If omitted, a typical (average) transaction is assumed.<br/>
* For a "bitcoin" <code>APIType</code>, this parameter is expected to be a string of hex-encoded data
* comprising the binary transaction. If omitted, the transaction is assumed to be 250 bytes.
* @param {Number} [priority=1] The priority with which the transaction is to be posted. A higher-priority
* transaction (closer to or equal to 0), is expected to be posted faster than a lower priority one (> 0).
* This paramater is dependent on the <code>APIType</code> and possibly the <code>network</code> type.<br/>
* When <code>APIType</code> is "bitcoin", a priority of 0 is the highest priority (to be included in the next 1-2 blocks),
* a priority of 1 is a medium priority (3 to 6 blocks), and 2 is a low priority (> 6 blocks).
* @param {String} [APIType="bitcoin"] The main cryptocurrency API type.
* @param {String} [network=null] The cryptocurrency sub-network, if applicable, for the
* transaction. Current <code>network</code> types include: "main" and "test3". If <code>null</code>,
* the default network specified in <code>config.CP.API[APIType].default.network</code> is used.
*
* @return {String} The estimated transaction fee, as a numeric string in the lowest denomination of the associated
* cryptocurrency (e.g. satoshis if <code>APIType="bitcoin"</code>), based on the supplied <code>txData</code>,
* <code>priority</code>, <code>APIType</code>, and <code>network</code>. If any parameter is invalid or unrecognized,
* <code>null</code> is returned.
* @async
*/
async function estimateTxFee (txData=null, priority=1, APIType="bitcoin", network=null) {
   try {
      switch (APIType) {
         case "bitcoin":
            var txSize = 250; //bytes
            if (txData != null) {
               txSize = txData.length / 2; //hex-encoded binary data
            }
            //TODO: complete this!
            break;
         default:
            return (null);
            break;
      }
   } catch (err) {
      return (null);
   }
}

/**
* Updates the internal transaction fees for all cryptocurrencies and sub-networks defined
* in the global <code>config</code> object using the cryptocurrency handlers' <code>updateTxFees</code>
* functions (i.e. some updates may be omitted if the update time limits have not elapsed).
*
* @param {Boolean} [startAutoUpdate=true] If true, the automatic update interval defined in the
* global <code>config</code> object for each cryptocurrency/network is (independently) started.
* If false, transaction fees must be updated manually ir required.
* @param {Boolean} [sequential=true] If true, each new update is started when the previous one is
* completed, otherwise they're all executed simultaneously.
*
* @async
*/
async function updateAllTxFees(startAutoUpdate=true, sequential=true) {
   var APIType = "bitcoin"; //currently only bitcoin is updated
   var btcAPI = config.CP.API[APIType];
   var btcNetworks = btcAPI.networks;
   for (var networkName in btcNetworks) {
      var network = btcNetworks[networkName];
      if (sequential) {
         try {
            var ccHandler = getHandler("cryptocurrency", APIType);
            if (ccHandler == null) {
               console.error(`Currency ${APIType} network ${networkName} has no registered handler.`);
            } else {
               var result = await ccHandler.updateTxFees(APIType, network);
            }
         } catch (err) {
            //failed or disabled
            console.error (err);
         }
         if (startAutoUpdate) {
            if (btcAPI.default[network].feeUpdateEnabled == false) {
               console.log ("Transaction fee updates for \""+APIType+"/"+network+"\" disabled.");
            } else {
               if (btcAPI.default[network].feeUpdateSeconds < 30) {
                  console.warn ("*WARNING* A transaction fee updates interval of at least 30 seconds is advised in order to deal with possible network latency.");
               }
               var updateSeconds = btcAPI.default[network].feeUpdateSeconds;
               console.log("Updating "+APIType+"/"+network+" transaction fees every "+updateSeconds+" seconds / "+(updateSeconds / 60)+" minutes.");
               var updateInterval = updateSeconds * 1000;
               btcAPI.default[network].timeout = setInterval((APIType, network) => {
                  ccHandler.updateTxFees(APIType, network, true).then(result => {
                  }).catch(err => {
                     //failed or disabled
                  })
               }, updateInterval, APIType, network);
            }
         }
      } else {
         if (btcAPI.default[network].feeUpdateEnabled == false) {
            console.log ("Transaction fee updates for \""+APIType+"/"+network+"\" disabled.");
         } else {
            var ccHandler = getHandler("cryptocurrency", APIType);
            if (ccHandler == null) {
               console.error(`Currency ${APIType} network ${networkName} has no registered handler.`);
            } else {
               ccHandler.updateTxFees(APIType, network).then(result => {
                  //updated
               }).catch(err => {
                  //failed or disabled
                  console.error (err);
               });
               if (btcAPI.default[network].feeUpdateSeconds < 30) {
                  console.warn ("*WARNING* A transaction fee updates interval of at least 30 seconds is advised in order to deal with possible network latency.");
               }
               updateSeconds = btcAPI.default[network].feeUpdateSeconds;
               console.log("Updating "+APIType+"/"+network+" transaction fees every "+updateSeconds+" seconds / "+(updateSeconds / 60)+" minutes.");
               var updateInterval = updateSeconds * 1000;
               btcAPI.default[network].timeout = setInterval((APIType, network) => {
                  ccHandler.updateTxFees(APIType, network, true).then(result => {
                     //updated
                  }).catch(err => {
                     //failed or disabled
                  })
               }, updateInterval, APIType, network);
            }
         }
      }
   }
}

/**
* Builds a valid CypherPoker.JS message object (usually included as the
* <code>data</code> property of a JSON-RPC 2.0 result object).
*
* @param {String} messageType The notification message type to build.
*
* @return {Object} A valid CypherPoker.JS message object. Additional properties
* to include with the message may be appended directly to this object.
*/
function buildCPMessage(messageType) {
   var JSONObj = new Object();
   JSONObj.cpMsg = messageType;
   return (JSONObj);
}

if (namespace.cp == undefined) {
   namespace.cp = new Object();
}

namespace.cp.getAccount = getAccount;
namespace.cp.saveAccount = saveAccount;
namespace.cp.updateAccount = updateAccount;
namespace.cp.checkPassword = checkPassword;
namespace.cp.callAccountDatabase = callAccountDatabase;
namespace.cp.cashoutIsPending = cashoutIsPending;
namespace.cp.MySQLDateTime = MySQLDateTime;
namespace.cp.buildCPMessage = buildCPMessage;
namespace.cp.updateAllTxFees = updateAllTxFees;
if (namespace.cp.wallets == undefined) {
   namespace.cp.wallets = new Object();
}
if (namespace.cp.wallets.bitcoin == undefined) {
   namespace.cp.wallets.bitcoin = new Object();
}
if (namespace.cp.wallets.bitcoin.main == undefined) {
   namespace.cp.wallets.bitcoin.main = null;
}
if (namespace.cp.wallets.bitcoin.test3 == undefined) {
   namespace.cp.wallets.bitcoin.test3 = null;
}
if (namespace.cp.wallets.bitcoincash == undefined) {
   namespace.cp.wallets.bitcoincash = new Object();
}
if (namespace.cp.wallets.bitcoincash.main == undefined) {
   namespace.cp.wallets.bitcoincash.main = null;
}
if (namespace.cp.wallets.bitcoincash.test == undefined) {
   namespace.cp.wallets.bitcoincash.test = null;
}
