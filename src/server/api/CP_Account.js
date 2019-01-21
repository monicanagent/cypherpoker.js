/**
* @file Manages cryptocurrency accounts using remote, local, or in-memory database(s),
* and provides live blockchain interaction functionality.
*
* @version 0.3.2
*/
async function CP_Account (sessionObj) {
   if ((namespace.websocket == null) || (namespace.websocket == undefined)) {
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
   var connectionID = namespace.websocket.makeConnectionID(sessionObj); //makeConnectionID defined in WebSocket_Handshake.js
   var privateID = namespace.websocket.makePrivateID(requestParams.server_token, requestParams.user_token);
   if (privateID == null) {
      //must have active WSS session!
      sendError(JSONRPC_ERRORS.ACTION_DISALLOWED, "Not allowed to create game contracts.", sessionObj);
      return(false);
   }
   var resultObj = new Object(); //result to send in response
   resultObj.fees = new Object(); //include fee(s) information
   resultObj.fees.deposit = config.CP.API[requestParams.type].default[requestParams.network].minerFee;
   resultObj.fees.cashout = config.CP.API[requestParams.type].default[requestParams.network].minerFee;
   try {
      switch (requestParams.action) {
         case "new":
            //create new account
            var accountObj = new Object(); //returned to user
            var fullAccountObj = new Object(); //stored internally
            var newAddressResult = await namespace.cp.getNewAddress(requestParams.type, requestParams.network);
            let hash = crypto.createHash("sha256");
            hash.update(requestParams.password);
            var pwHash = hash.digest("hex");
            fullAccountObj.type = requestParams.type;
            fullAccountObj.network = requestParams.network;
            if (requestParams.network == "main") {
               fullAccountObj.chain = config.CP.API.wallets.bitcoin.startChain;
               fullAccountObj.addressIndex = config.CP.API.wallets.bitcoin.startIndex;
               fullAccountObj.address = getAddress(newAddressResult);
            } else {
               fullAccountObj.chain = config.CP.API.wallets.test3.startChain;
               fullAccountObj.addressIndex = config.CP.API.wallets.test3.startIndex;
               fullAccountObj.address = getAddress(newAddressResult, bitcoin.networks.testnet);
            }
            fullAccountObj.pwhash = pwHash;
            fullAccountObj.balance = "0";
            fullAccountObj.updated = MySQLDateTime(new Date()); //make sure to store local date/time (db may differ)
            accountObj.type = requestParams.type;
            accountObj.network = requestParams.network;
            accountObj.chain = config.CP.API.wallets.bitcoin.startChain;
            accountObj.addressIndex = config.CP.API.wallets.bitcoin.startIndex;
            if (requestParams.network == "main") {
               accountObj.address = getAddress(newAddressResult);
            } else {
               accountObj.address = getAddress(newAddressResult, bitcoin.networks.testnet);
            }
            accountObj.pwhash = pwHash;
            accountObj.balance = bigInt("0");
            resultObj = accountObj;
            resultObj.fees = new Object();
            resultObj.fees.deposit = config.CP.API[requestParams.type].default[requestParams.network].minerFee;
            resultObj.fees.cashout = config.CP.API[requestParams.type].default[requestParams.network].minerFee;
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
                     var balanceResult = await this.getBlockchainBalance(requestParams.address, requestParams.type, requestParams.network);
                     resultObj.address = searchObj.address;
                     resultObj.type = searchObj.type;
                     resultObj.network = searchObj.network;
                     if ((balanceResult.balance == null) || (balanceResult.balance == undefined) || (balanceResult.balance == "")) {
                        balanceResult.balance = 0;
                     }
                     resultObj.balance = String(balanceResult.balance);
                     if (resultObj.balance != accountResults[0].balance) {
                        //new confirmed deposit detected; forward new account balance to cashout wallet
                        if (requestParams.network == "main") {
                           var wallet = namespace.cp.bitcoinWallet;
                        } else {
                           wallet = namespace.cp.bitcoinTest3Wallet;
                        }
                        var cashoutWallet = wallet.derivePath(config.CP.API[requestParams.type].default[requestParams.network].cashOutAddrPath);
                        if (requestParams.network == "main") {
                           var cashoutAddress = namespace.cp.getAddress(cashoutWallet);
                        } else {
                           cashoutAddress = namespace.cp.getAddress(cashoutWallet, bitcoin.networks.testnet);
                        }
                        var fromAddressPath = "m/" + String(accountResults[0].chain) + "/" + String(accountResults[0].addressIndex);
                        var fromWallet = wallet.derivePath(fromAddressPath);
                        var transferAmount = bigInt(balanceResult.balance);
                        //this is the current minimum fee for testnet3:
                        //var fees = bigInt(20000); //todo: move transfer fee to config
                        var fees = bigInt(config.CP.API[requestParams.type].default[requestParams.network].minerFee);
                        transferAmount = transferAmount.minus(fees);
                        try {
                           var txResult = await sendTransaction(fromWallet, cashoutAddress, transferAmount, fees, requestParams.type, requestParams.network);
                        } catch (err) {
                           sendError(JSONRPC_ERRORS.INTERNAL_ERROR, "Unable to forward transaction to cashout wallet.", sessionObj);
                           return(false);
                        }
                        if (txResult != null) {
                           if ((txResult.tx != undefined) && (txResult.tx != null)) {
                              if ((txResult.tx.hash != undefined) && (txResult.tx.hash != null) && (txResult.tx.hash != "")) {
                                 //Successfully forwarded new confirmed deposit:
                                 //Sender: getAddress(fromWallet) or getAddress(fromWallet, bitcoin.networks.testnet)
                                 //Receiver: cashoutAddress
                                 //Transaction hash: txResult.tx.hash
                                 //Amount: transferAmount
                                 //Fees: fees
                              }
                           }
                        } else {
                           console.log ("Couldn't forward new account balance:");
                           console.dir (txResult);
                           //manual transfer may be required
                        }
                        //store updated account information
                        resultObj.confirmed = true;
                        accountResults[0].balance = transferAmount.toString(10);
                        accountResults[0].updated = MySQLDateTime(new Date());
                        var saved = await namespace.cp.saveAccount(accountResults[0]);
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
            var totalCashoutAmount = bigInt(requestParams.amount); //includes fees
            var availableAmount = bigInt(accountResults[0].balance);
            var fees = bigInt (requestParams.feeAmount);
            if (totalCashoutAmount.greater(availableAmount)) {
               sendError(JSONRPC_ERRORS.ACTION_DISALLOWED, "Insufficient balance.", sessionObj);
               return (false);
            }
            var newBalance = availableAmount.minus(totalCashoutAmount);
            var cashoutAmount = totalCashoutAmount.minus(fees);
            var txResult = await cashoutToAddress(requestParams.toAddress, cashoutAmount.toString(10), fees.toString(10), requestParams.type, requestParams.network);
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
*
* Creates a HD (Hierarchical Deterministic) Bitcoin wallet which addresses can be
* derived.
*
* @param {String} privKey A "xprv" or "tprv" base 58 string containing the private
* key of the wallet.
*
* @return {Object} A wallet object containing both the public and private keys
* from which Bitcoin addresses can be derived (using <code>derivePath</code>).
*/
function makeHDWallet(privKey) {
   try {
      if (privKey.indexOf("xprv") == 0) {
         //mainnet
         var wallet = bitcoin.bip32.fromBase58(privKey);
      } else {
         //testnett
         wallet = bitcoin.bip32.fromBase58(privKey, bitcoin.networks.testnet);
      }
   } catch (err) {
      console.error(err.stack);
      return (null);
   }
   if (wallet == undefined) {
      return (null);
   }
   return (wallet);
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
* Returns the address of a Bitcoin wallet object.
*
* @param {Object} walletObj A Bitcoin wallet data object.
* @param {Object} [network=null] The sub-network for which to get the address.
* Either <null>code</code> (mainnet), or <code>bitcoin.networks.testnet</code>
*
* @private
*/
function getAddress(walletObj, network=null) {
   if (network == null) {
      return (bitcoin.payments.p2pkh({pubkey:walletObj.publicKey}).address);
   } else {
      return (bitcoin.payments.p2pkh({pubkey:walletObj.publicKey, network}).address);
   }
}

/**
* Creates a new blockchain address.
*
* @param {String} [APIType="bitcoin"] The API endpoint configuration to use for
* the API call. This value must match one of the definitions found in the
* <code>config.CP.API</code> object.
* @param {String} [network=null] The sub-network, if applicable, for which to
* create the address. Valid values include "main" and "test3".
* If <code>null</code>, the default network specified in
* <code>config.CP.API[APIType].default.network</code> is used.
*
* @return {Promise} The resolved promise will include a native JavaScript object
* containing the new derived wallet object. The rejected promise will
* contain the error object.
*/
function getNewAddress(APIType="bitcoin", network=null) {
   var promise = new Promise(function(resolve, reject) {
      if (network == null) {
         network = config.CP.API[APIType].default.network;
      }
      if ((network == "main") && (namespace.cp.bitcoinWallet != null)) {
         if (config.CP.API.wallets.bitcoin.startChain < 0) {
            config.CP.API.wallets.bitcoin.startChain = 0;
         }
         //address index 0 is reserved for the cashout address
         if (config.CP.API.wallets.bitcoin.startIndex < 0) {
            config.CP.API.wallets.bitcoin.startIndex = 0;
         }
         //currently we simply increment the index:
         config.CP.API.wallets.bitcoin.startIndex++;
         //the chain value is currently 0 but can be set manually
         var startChain = config.CP.API.wallets.bitcoin.startChain;
         var startIndex = config.CP.API.wallets.bitcoin.startIndex;
      } else if ((network == "test3") && (namespace.cp.bitcoinTest3Wallet != null)) {
         if (config.CP.API.wallets.test3.startChain < 0) {
            config.CP.API.wallets.test3.startChain = 0;
         }
         //address index 0 is reserved for the cashout address
         if (config.CP.API.wallets.test3.startIndex < 0) {
            config.CP.API.wallets.test3.startIndex = 0;
         }
         config.CP.API.wallets.test3.startIndex++;
         startChain = config.CP.API.wallets.test3.startChain;
         startIndex = config.CP.API.wallets.test3.startIndex;
      } else {
         reject(new Error("Wallet for \""+APIType+"\", network \""+network+"\" not defined."));
         return;
      }
      if (network == "main") {
         var newWallet = namespace.cp.bitcoinWallet.derivePath("m/"+startChain+"/"+startIndex);
      } else {
         newWallet = namespace.cp.bitcoinTest3Wallet.derivePath("m/"+startChain+"/"+startIndex);
      }
      resolve (newWallet);
   });
   return (promise);
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
   var loaded = false;
   var result = await callAccountDatabase("getrecord", searchObj);
   if (result.error == undefined) {
      return (result.result);
   } else {
      if (result.error.code == -32602) {
         //no matching account, return empty result set
         return (new Array());
      } else {
         console.error("Remote database error:");
         console.dir(result);
         throw (new Error(result.error));
      }
   }
   //try in-memory data instead
   if (namespace.cp.accounts == undefined) {
      namespace.cp.accounts = new Array();
      return (null);
   }
   var resultArr = new Array();
   for (var count=(namespace.cp.accounts.length-1); count >=0 ; count--) {
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
     if (resultArr.length == 2) {
       break;
     }
   }
   if (resultArr.length == 0) {
      resultArr = null;
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
   //save to remote database if available
   var saved = false;
   var result = await callAccountDatabase("putrecord", accountObj);
   if (result.error == undefined) {
      saved = true;
   } else {
      throw (new Error(result.error));
   }
   if (saved == false) {
      //not saved to remote database so use in-memory array instead
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
* Updates an existing account. Currently, only the "updated" property is updated
* in the database (any other changes should use {@link saveAccount}).
*
* @param {AccountObject} accountObj Contains the account information to update. This object
* must contain the <code>primary_key</code> value of the row to update.
*
* @return {Promise} The resolved promise returns <code>true</code> if the account
* was successfully updated, <code>false</code> false otherwise.
* @async
*/
async function updateAccount(accountObj) {
   //save to remote database if available
   var updated = false;
   var result = await callAccountDatabase("updaterecord", accountObj);
   if (result.error == undefined) {
      updated = true;
   } else {
      throw (new Error(result.error));
   }
   if (updated == false) {
      //not updated in remote database so use in-memory array instead
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
* Calls the JSON-RPC 2.0 account database interface with a method, message, and HMAC
* signature.
*
* @param {String} method The remote RPC method to invoke.
* @param {Object} message The accompanying data to stringify, sign with
* <code>config.CP.API.database.accessKey</code>, and include with the RPC call.
*
* @return {Promise} Resolves with the response object returned from the server
* or rejects with an error.
*/
function callAccountDatabase(method, message) {
   var promise = new Promise(function(resolve, reject) {
      if (config.CP.API.database.enabled) {
         var url = config.CP.API.database.url;
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
         }
         request({
            url: url,
            method: "POST",
            body: txObject,
            headers: headersObj,
            json: true
         }, (error, response, body) => {
            if (error) {
               reject(error);
            } else {
               resolve(body);
            }
         });
      } else {
         reject(new Error("Database interactions are disabled."));
      }
   });
   return (promise);
}

/**
* Retrieves a live blockchain balance for an address.
*
* @param {String} address The address for which to retrieve the live balance.
* @param {String} [APIType="bitcoin"] The API endpoint configuration to use for
* the API call. This value must match one of the definitions found in the
* <code>config.CP.API</code> object.
* @param {String} [network=null] The sub-network, if applicable, from which
* to retrieve the live balance. Valid values include "main" and "test3".
* If <code>null</code>, the default network specified in
* <code>config.CP.API[APIType].default.network</code> is used.
*
* @return {Promise} The resolved promise will include a native JavaScript object
* containing the parsed response from the API endpoint. The rejected promise will
* contain the error object.
*/
function getBlockchainBalance(address, APIType="bitcoin", network=null) {
   var promise = new Promise(function(resolve, reject) {
      var API = config.CP.API[APIType];
      var url = API.url.balance;
      if (network == null) {
         network = API.default.network;
      }
      url = url.split("%address%").join(address).split("%network%").join(network);
      request({
   		url: url,
   		method: "GET",
   		json: true
   	}, (error, response, body) => {
         if (error) {
            reject(error);
         } else {
            resolve(body);
         }
   	});
   });
	return (promise);
}

/**
* Cashes out from the configured cashout wallet to a specific address.
*
* @param {String} toAddress The address to cash out to.
* @param {String|Number} amount The amount to cash out. The miner <code>fees</code> will
* be deducted from this amount.
* @param {String|Number} [fees=null] The miner fees to deduct from <code>amount</code> and
* include with the transaction. If <code>null</code>, the default fee defined for the
* <code>APIType</code> and <code>network</code> will be used.
* @param {String} [APIType="bitcoin"] The main cryptocurrency API type.
* @param {String} [network=null] The cryptocurrency sub-network, if applicable, for the
* transaction. Current <code>network</code> types include: "main" and "test3". If <code>null</code>,
* the default network specified in <code>config.CP.API[APIType].default.network</code> is used.
*/
async function cashoutToAddress(toAddress, amount, fees=null, APIType="bitcoin", network=null) {
   var API = config.CP.API[APIType];
   if (network == null) {
      network = API.default.network;
   }
   if (fees = null) {
      fees = API.default[network].minerFee;
   }
   var result = null;
   switch (APIType) {
      case "bitcoin":
         if (network == "main") {
            var fromWallet = namespace.cp.bitcoinWallet.derivePath(API.default[network].cashOutAddrPath);
         } else {
            fromWallet = namespace.cp.bitcoinTest3Wallet.derivePath(API.default[network].cashOutAddrPath);
         }
         var sendTxResult = await sendTransaction(fromWallet, toAddress, amount, fees, APIType, network);
         return (sendTxResult);
         break;
      default:
         throw (new Error("Unsupported API type \""+APIType+"\"."));
         break;
   }
   throw (new Error("Unknown error when cashing out."));
}

/**
* Sends a transaction from a wallet to an address.
*
* @param {Object} fromWallet The sending wallet object containing the public and private keys.
* @param {String} toAddress The receiving address that the funds will be sent to.
* @param {String|Number} amount The amount to send in the transaction in the lowest denomination for
* the associated cryptocurrency/API type (e.g. satoshis if <code>APIType="bitcoin"</code>). The
* fees specified in the <code>fees</code> parameter will be automatically deducted from this value.
* @param {String|Number} [fees=null] The miner fees to deduct from the <code>amount</code> and include
* with the transaction. If <code>null</code>, the default fee defined for the <code>APIType</code>
* and <code>network</code> will be used.
* @param {String} [APIType="bitcoin"] The main cryptocurrency API type.
* @param {String} [network=null] The cryptocurrency sub-network, if applicable, for the
* transaction. Current <code>network</code> types include: "main" and "test3". If <code>null</code>,
* the default network specified in <code>config.CP.API[APIType].default.network</code> is used.
*/
async function sendTransaction(fromWallet, toAddress, amount, fees=null, APIType="bitcoin", network=null) {
   var API = config.CP.API[APIType];
   if (network == null) {
      network = API.default.network;
   }
   if (fees == null) {
      fees = API.default[network].minerFee;
   }
   var result = null;
   switch (APIType) {
      case "bitcoin":
         if (network == "main") {
            var fromAddress = getAddress(fromWallet);
         } else {
            fromAddress = getAddress(fromWallet, bitcoin.networks.testnet);
         }
         var fromWIF = fromWallet.toWIF();
         var txSkeleton = await newBTCTx(fromAddress, toAddress, amount, fees, network);
         var signedTx = signBTCTx(txSkeleton, fromWIF, network); //not async
         if (signedTx == null) {
            throw (new Error("Couldn't sign transaction."));
         }
         try {
            var sendTxResult = await sendBTCTx(signedTx, network);
         } catch (err) {
            throw (err);
         }
         return (sendTxResult);
         break;
      default:
         throw (new Error("Unsupported API type \""+APIType+"\"."));
         break;
   }
   throw (new Error("Unknown error when sending transaction."));
}

/**
* Creates a new BlockCypher Bitcoin transaction skeleton for use with the {@link signBTCTx} function.
*
* @param {String} fromAddress The address sending the transaction.
* @param {String} toAddress The address receiving the transaction.
* @param {String|Number} satAmount The amount, in satoshis, to send to <code>toAddress</code>.
* @param {String|Number} satFees The miner fees, in satoshis, to include with the transaction.
* @param {String} [network=null] The sub-network, if applicable, for which to create the
* new transaction skeleton. Valid values include "main" and "test3".
* If <code>null</code>, the default network specified in
* <code>config.CP.API.bitcoin.default.network</code> is used.
*
* @return {Promise} The resolved promise will include a native JavaScript object
* containing the unsigned transaction skeleton. The rejected promise will contain the
* error response.
*/
function newBTCTx (fromAddress, toAddress, satAmount, satFees, network=null) {
   var promise = new Promise(function(resolve, reject) {
      var API = config.CP.API.bitcoin;
      var url = API.url.createtx;
      if (network == null) {
         network = API.default.network;
      }
      var token = config.CP.API.tokens.blockcypher;
      url = url.split("%network%").join(network).split("%token%").join(token);
      var requestBody = {
         "inputs":[{"addresses":[fromAddress]}],
         "outputs":[{"addresses":[toAddress],
         "value": Number(satAmount)}],
         "fees":Number(satFees)
      };
   	request({
   		url: url,
   		method: "POST",
   		body:requestBody,
   		json: true
   	}, function (error, response, body){
   		if (error) {
            reject (error);
         } else {
            if ((body == undefined) || (body == null)) {
               reject (response);
               return;
            }
            if ((body.errors != undefined) && (body.errors != null)) {
               if (body.errors.length > 0) {
                  reject (body.errors);
               } else {
                  resolve (body);
               }
            } else {
               resolve (body);
            }
         }
   	});
   });
   return (promise);
}

/**
* Signs a BlockCypher-generated Bitcoin transaction skeleton with a keypair in WIF format.
*
* @param {Object} txObject The transaction skeleton object to sign.
* @param {Object} WIF The Wallet Import Format data to use for signing.
* @param {String} [network=null] The sub-network, if applicable, for which the
* transaction skeleton has been created. Valid values include "main" and "test3".
* If <code>null</code>, the default network specified in
* <code>config.CP.API.bitcoin.default.network</code> is used.
*
* @return {Object} The signed Bitcoin transaction object (which can be sent to the network).
*/
function signBTCTx (txObject, WIF, network=null) {
   if (network == null) {
      network = config.CP.API.bitcoin.default.network;
   }
	if (network == "main") {
		var keys = keys = new bitcoin.ECPair.fromWIF(WIF);
	} else {
		keys = new bitcoin.ECPair.fromWIF(WIF, bitcoin.networks.testnet);
	}
	try {
      var pubkeys = new Array();
      var signatures = txObject.tosign.map(function(tosign) {
        pubkeys.push(keys.publicKey.toString("hex"));
        return (signToDER(tosign, keys.privateKey).toString("hex"));
      });
		txObject.signatures = signatures;
		txObject.pubkeys = pubkeys;
	} catch (err) {
      console.error(err.stack);
		txObject = null;
	}
	return (txObject);
}

/**
* Signs an input hexadecimal string and returns a DER-encoded signature.
*
* @param {String} toSignHex Hexadecimal-encoded data string to sign.
* @param {Buffer} privateKeyBuffer The private key with which to sign <code>toSignHex</code>.
*
* @return {Buffer} The DER-encoded, signed message. Use <code>toString("hex")</code> to get the
* hexadecimal string representation of the output.
*/
function signToDER (toSignHex, privateKeyBuffer) {
   var sigObj = secp256k1.sign(Buffer.from(toSignHex, "hex"), privateKeyBuffer);
   return (secp256k1.signatureExport(sigObj.signature));
}

/**
* Sends a signed Bitcoin transaction skeleton via the BlockCypher API.
*
* @param {Object} txObject The transaction to send.
* @param {String} [network=null] The Bitcoin sub-network for which the
* transaction is intended. Valid values include "main" and "test3".
* If <code>null</code>, the default network specified in
* <code>config.CP.API.bitcoin.default.network</code> is used.
*
* @return {Promise} The resolved promise will include a native JavaScript object
* containing the parsed response from the API endpoint. The rejected promise will
* contain the error object.
*/
function sendBTCTx(txObject, network=null) {
   /*
   TODO: Future update example to build transaction from scratch:

   var key = bitcoin.ECKey.fromWIF("L1Kzcyy88LyckShYdvoLFg1FYpB5ce1JmTYtieHrhkN65GhVoq73");
   var tx = new bitcoin.TransactionBuilder();
   tx.addInput("d18e7106e5492baf8f3929d2d573d27d89277f3825d3836aa86ea1d843b5158b", 1);
   tx.addOutput("12idKQBikRgRuZEbtxXQ4WFYB7Wa3hZzhT", 149000);
   tx.sign(0, key);
   console.log(tx.build().toHex());
   */
   var promise = new Promise(function(resolve, reject) {
      var API = config.CP.API.bitcoin;
      var url = API.url.sendtx;
      if (network == null) {
         network = API.default.network;
      }
      var token = config.CP.API.tokens.blockcypher;
      url = url.split("%network%").join(network).split("%token%").join(token);
      request({
         url: url,
   		method: "POST",
   		body: txObject,
   		json: true
   	}, (error, response, body) => {
         if ((body == undefined) || (body == null)) {
            reject (response);
            return;
         }
         if (error) {
            reject(error);
         } else {
            //do we want to catch and reject JSON-RPC errors here?
            resolve(body);
         }
   	});
   });
	return (promise);
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
* Updates the internal transaction fee(s) for a specific cryptocurrency and sub-network if
* not already updated within its configured time limit. The fee(s) currently stored for the cryptocurrency
* in the main <code>config</code> is/are updated if successfully retrieved or calculated.
*
* @param {String} [APIType="bitcoin"] The main cryptocurrency API type.
* @param {String} [network=null] The cryptocurrency sub-network, if applicable, for the
* transaction. Current <code>network</code> types include: "main" and "test3". If <code>null</code>,
* the default network specified in <code>config.CP.API[APIType].default.network</code> is used.
* @param {Boolean} [forceUpdate=false] If true, an update is forced even if the configured time limit
* has not yet elapsed.
*
* @return {Promise} Resolves with the string "updated" if the fees for the API/network were succesfully updated or
* "skipped" the configured time limit for updates has not yet elapsed. The promise is rejected with a standard
* <code>Error</code> object if an update could not be successfully completed (any existing fees data is not changed).
* @private
*/
function updateTxFees(APIType="bitcoin", network=null, forceUpdate=false) {
   var promise = new Promise(function(resolve, reject) {
      var API = config.CP.API[APIType];
      if ((network == null) || (network == "")) {
         network = API.default.network;
      }
      var url = API.url.fees;
      var updateSeconds = API.default[network].feeUpdateSeconds;
      if ((updateSeconds > 0) && (forceUpdate == false)) {
         var lastUpdate = API.default[network]["lastUpdated"];
         if ((lastUpdate != undefined) && (lastUpdate != null) && (lastUpdate != "")) {
            var lastUpdateCheck = new Date(API.default[network].lastUpdated); //this date/time must be relative to local date/time
            var currentDateTime = new Date();
            var deltaMS = currentDateTime.valueOf() - lastUpdateCheck.valueOf();
            var deltaSec = deltaMS / 1000;
            if (deltaSec < updateSeconds) {
               resolve("skipped");
               return;
            }
         }
      }
      url = url.split("%network%").join(network);
      request({
         url: url,
         method: "GET",
         json: true
      }, (error, response, body) => {
         var currentDateTime = new Date();
         API.default[network].lastUpdated = currentDateTime.toISOString();
         if ((body == undefined) || (body == null)) {
            var errorObj = new Error(response);
            reject (errorObj);
            return;
         }
         if (error) {
            errorObj = new Error(error);
            reject(errorObj);
         } else {
            API.default[network].minerFee = String(body.high_fee_per_kb); //should be a string
            resolve("updated");
            //resolve(body);
         }
      });
   });
   return (promise);
}

/**
* Updates the internal transaction fees for all cryptocurrencies and sub-networks defined
* in the global <code>config</code> object using the {@link updateTxFees} function (i.e. some updates
* may be omitted if the update time limits have not elapsed).
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
      console.log("Updating "+APIType+"/"+network+" transaction fees...");
      if (sequential) {
         try {
            var result = await updateTxFees(APIType, network);
            if (result == "updated") {
               console.log ("Transaction fees for "+APIType+"/"+network+" successfully updated.");
            } else {
               console.log ("Transaction fees for "+APIType+"/"+network+" not updated; update interval not elapsed.");
            }
         } catch (err) {
            console.error("Error updating "+APIType+"/"+network+" transaction fees:");
            console.dir(err);
         }
         if (startAutoUpdate) {
            var updateInterval = (btcAPI.default[network].feeUpdateSeconds) * 1000;
            btcAPI.default[btcNetworks[network]].timeout = setInterval(updateTxFees, updateInterval, APIType, network);
         }
      } else {
         updateTxFees(APIType, network).then(result => {
            if (result == "updated") {
               console.log ("Transaction fees for "+APIType+"/"+network+" successfully updated.");
            } else {
               console.log ("Transaction fees for "+APIType+"/"+network+" not updated; update interval not elapsed.");
            }
         }).catch(err => {
            console.error("Error updating "+APIType+"/"+network+" transaction fees:");
            console.dir(err);
         });
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
namespace.cp.getAddress = getAddress;
namespace.cp.getNewAddress = getNewAddress;
namespace.cp.getBlockchainBalance = getBlockchainBalance;
namespace.cp.cashoutToAddress = cashoutToAddress;
namespace.cp.newBTCTx = newBTCTx;
namespace.cp.signBTCTx = signBTCTx;
namespace.cp.sendBTCTx = sendBTCTx;
namespace.cp.makeHDWallet = makeHDWallet;
namespace.cp.MySQLDateTime = MySQLDateTime;
namespace.cp.buildCPMessage = buildCPMessage;
if (namespace.cp.bitcoinWallet == undefined) {
   namespace.cp.bitcoinWallet = null;
}
if (namespace.cp.bitcoinTest3Wallet == undefined) {
   namespace.cp.bitcoinTest3Wallet = null;
}

//automatically update transaction fee estimates at startup
updateAllTxFees();
