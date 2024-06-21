/**
 * @file Manages proxy CypherPoker smart contracts and defines a number of related utility functions.
 *
 * @version 0.5.1
 */

/**
 * An object containing player account information of an associated smart contract, usually
 * as part of a player's <code>account</code> property.
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
 * A CypherPoker.JS table object associated with a game.
 * @typedef {Object} TableObject
 * @property {String} ownerPID The private ID of the owner / creator of the table.
 * @property {String} tableID The pseudo-randomly generated, unique table ID of the table.
 * @property {String} tableName The name given to the table by the owner.
 * @property {Array} requiredPID Indexed array of private IDs of peers required to join this room before it's
 * considered full or ready.
 * @property {Array} joinedPID Indexed array of private IDs that have been accepted by the owner. When a contract
 * is first created, this array should only have one element: the owner's PID.
 * @property {Array} restorePID Copy of the original private IDs in the <code>requiredPID</code> array
 * used to restore it if members of the <code>joinePID</code> array leave the table.
 * @property {Object} tableInfo Additional information to be included with the table.
 */
/**
 * A CypherPoker.JS proxy smart contract object.
 * @typedef {Object} ContractObject
 * @property {String} contractID The ID of the contract.
 * @property {TableObject} table The table associated with the contract.
 * @property {Array} players Indexed array of player object instances associated with the contract.
 * @property {String} prime The root prime number value associated with the contract.
 * @property {String} pot="0" A numeric string representing the value currently held by the contract "pot"
 * (the total subtracted from players' initial balances), to be awarded to the hand's winner(s).
 * @property {Object} cardDecks Contains the currently active card decks associated with the contract.
 * @property {Array} cardDecks.faceup Indexed array of card objects representing the faceup or unencrypted deck.
 * @property {Array} cardDecks.facedown Indexed array of strings representing the facedown or encrypted deck. This
 * array will change as cards are drawn during game play.
 * @property {Array} cardDecks.dealt Indexed array of strings representing the dealt face or encrypted cards. This
 * array will change as cards are drawn during game play.
 * @property {Array} cardDecks.public Indexed array of card objects representing the dealt public / community cards. This
 * array will change as cards are drawn during game play.
 * @property {Object} history Contains a history of card generation, encryption, and decryption operations for correctness analysis.
 */
async function CP_SmartContract(sessionObj) {
   if (namespace.wss == null || namespace.wss == undefined) {
      sendError(
         JSONRPC_ERRORS.INTERNAL_ERROR,
         "No WebSocket Session server defined.",
         sessionObj
      );
      return false;
   }
   var requestData = sessionObj.requestObj;
   var requestParams = requestData.params;
   if (typeof requestParams.server_token != "string") {
      sendError(
         JSONRPC_ERRORS.INVALID_PARAMS_ERROR,
         "Invalid server token.",
         sessionObj
      );
      return false;
   }
   if (typeof requestParams.user_token != "string") {
      sendError(
         JSONRPC_ERRORS.INVALID_PARAMS_ERROR,
         "Invalid user token.",
         sessionObj
      );
      return false;
   }
   if (typeof requestParams.action != "string") {
      sendError(
         JSONRPC_ERRORS.INVALID_PARAMS_ERROR,
         "Invalid action.",
         sessionObj
      );
      return false;
   }
   var responseObj = new Object();
   //var connectionID = namespace.wss.makeConnectionID(sessionObj); //makeConnectionID defined in WSS_Handshake.js
   var privateID = namespace.wss.getPrivateID(sessionObj); //getPrivateID defined in WSS_Handshake.js
   if (privateID == null) {
      //must have active WSS session!
      sendError(
         JSONRPC_ERRORS.ACTION_DISALLOWED,
         "No active session.",
         sessionObj
      );
      return false;
   }
   var resultObj = new Object(); //result to send in response);
   switch (requestParams.action) {
      case "new":
         var gameContracts = namespace.cp.getContractsByPID(privateID);
         if (gameContracts.length > 10) {
            sendError(
               JSONRPC_ERRORS.ACTION_DISALLOWED,
               "Too many open game contracts.",
               sessionObj
            );
            return false;
         }
         if (
            validContractObject(
               requestParams.contract,
               privateID,
               requestParams.account
            ) == false
         ) {
            sendError(
               JSONRPC_ERRORS.ACTION_DISALLOWED,
               "Invalid contract.",
               sessionObj
            );
            return false;
         }
         try {
            var playerAccount = await validAccount(requestParams.account);
         } catch (err) {
            sendError(
               JSONRPC_ERRORS.ACTION_DISALLOWED,
               err.message,
               sessionObj
            );
            return false;
         }
         var newContract = new Object();
         newContract = requestParams.contract;
         newContract.ownerPID = privateID;
         //overwrite currency settings for contract in case user mis-reported them
         newContract.table.tableInfo.currency.type = requestParams.account.type;
         newContract.table.tableInfo.currency.network =
            requestParams.account.network;
         //sanitize private tokens!
         newContract.user_token = "";
         newContract.server_token = "";
         delete newContract.user_token;
         delete newContract.server_token;
         newContract.history = new Object(); //sanitize history
         newContract.history.keychains = new Object(); //sanitize submitted player keychains object
         newContract.pot = "0"; //sanitize hand pot
         newContract.invalid = false;
         var player = getPlayer(newContract, privateID);
         if (player == null) {
            sendError(
               JSONRPC_ERRORS.INVALID_PARAMS_ERROR,
               "Owner's player object not found in players array.",
               sessionObj
            );
            return false;
         }
         if (typeof newContract.table.tableInfo.timeout != "number") {
            //use config-defined timeout
            newContract.table.tableInfo.timeout =
               config.CP.API.contract.timeoutDefault;
         }
         resetPlayerBalances(newContract); //reset all players' balances
         setPlayerBalance(
            newContract,
            privateID,
            newContract.table.tableInfo.buyIn
         ); //set deposit balance for dealer/current user
         //subtract buy-in from account and deposit to contract
         var buyIn = "-" + String(newContract.table.tableInfo.buyIn);
         try {
            var result = await addToAccountBalance(
               playerAccount[0],
               buyIn,
               newContract
            );
            resultObj.contract = newContract;
            gameContracts.push(newContract);
            //create contract history
            newContract.history = new Object();
            newContract.history.deck = new Array();
            newContract.history.keychains = new Object();
            var historyObj = new Object();
            historyObj.fromPID = privateID;
            historyObj.cards = new Array();
            for (
               var count = 0;
               count < newContract.cardDecks.faceup.length;
               count++
            ) {
               if (newContract.cardDecks.faceup[count].mapping != undefined) {
                  historyObj.cards.push(
                     newContract.cardDecks.faceup[count].mapping
                  );
               } else {
                  historyObj.cards.push(
                     newContract.cardDecks.faceup[count]._mapping
                  );
               }
            }
            newContract.history.deck.push(historyObj); //initial history item is new faceup deck
            //save new game contract here
            sendContractMessage("contractnew", newContract, privateID);
         } catch (err) {
            setPlayerBalance(newContract, privateID, "0"); //revert buy-in
            var payloadObj = new Object();
            payloadObj.error = new Object();
            payloadObj.error.message = err.message;
            //notify other contract players of the failure
            sendContractMessage(
               "contractnewfail",
               newContract,
               privateID,
               null,
               payloadObj
            );
            cancelContract(newContract);
            sendError(
               JSONRPC_ERRORS.ACTION_DISALLOWED,
               err.message,
               sessionObj
            );
            return false;
         }
         break;
      case "agree":
         var contractOwnerPID = requestParams.ownerPID;
         var contractID = requestParams.contractID;
         var gameContract = getContractByID(contractOwnerPID, contractID);
         if (gameContract == null) {
            sendError(
               JSONRPC_ERRORS.ACTION_DISALLOWED,
               "No such contract.",
               sessionObj
            );
            return false;
         }
         if (gameContract.invalid) {
            sendError(
               JSONRPC_ERRORS.ACTION_DISALLOWED,
               "Contract is invalid.",
               sessionObj
            );
            return false;
         }
         try {
            var playerAccount = await validAccount(requestParams.account);
         } catch (err) {
            console.error(err);
            sendError(
               JSONRPC_ERRORS.ACTION_DISALLOWED,
               err.message,
               sessionObj
            );
            return false;
         }
         var player = getPlayer(gameContract, privateID);
         if (player == null) {
            sendError(
               JSONRPC_ERRORS.ACTION_DISALLOWED,
               "Not registered with contract.",
               sessionObj
            );
            return false;
         }
         var playerBalance = bigInt(player.balance);
         if (playerBalance.greater(0)) {
            //this is similar to re-depositing into contract
            sendError(
               JSONRPC_ERRORS.ACTION_DISALLOWED,
               "Can't agree to contract more than once.",
               sessionObj
            );
            return false;
         }
         var contractCurrencyType = gameContract.table.tableInfo.currency.type;
         var contractCurrencyNetwork =
            gameContract.table.tableInfo.currency.network;
         if (playerAccount[0].type != contractCurrencyType) {
            var payloadObj = new Object();
            payloadObj.error = new Object();
            payloadObj.error.message =
               'Attempt to agree using an incompatible currency ("' +
               playerAccount[0].type +
               '").';
            //notify other contract players of the failure
            sendContractMessage(
               "contractagreefail",
               gameContract,
               privateID,
               null,
               payloadObj
            );
            sendError(
               JSONRPC_ERRORS.ACTION_DISALLOWED,
               "Can't use currency \"" +
                  playerAccount[0].type +
                  '" to agree to contract using currency "' +
                  contractCurrencyType +
                  '".',
               sessionObj
            );
            return false;
         }
         if (playerAccount[0].network != contractCurrencyNetwork) {
            payloadObj = new Object();
            payloadObj.error = new Object();
            payloadObj.error.message =
               'Attempt to agree using an incompatible currency network ("' +
               playerAccount[0].network +
               '").';
            //notify other contract players of the failure
            sendContractMessage(
               "contractagreefail",
               gameContract,
               privateID,
               null,
               payloadObj
            );
            sendError(
               JSONRPC_ERRORS.ACTION_DISALLOWED,
               "Can't use currency network \"" +
                  playerAccount[0].network +
                  '" to agree to contract using currency network "' +
                  contractCurrencyNetwork +
                  '".',
               sessionObj
            );
            return false;
         }
         player.account = new Object();
         player.account.address = requestParams.account.address;
         player.account.type = requestParams.account.type;
         player.account.network = requestParams.account.network;
         player.account.balance = String(playerAccount[0].balance);
         setPlayerBalance(
            gameContract,
            privateID,
            gameContract.table.tableInfo.buyIn
         );
         //subtract buy-in from account and deposit to contract
         var buyIn = "-" + String(gameContract.table.tableInfo.buyIn);
         try {
            var result = await addToAccountBalance(
               playerAccount[0],
               buyIn,
               gameContract
            );
            //save game contract here
            resultObj.contract = gameContract;
            sendContractMessage("contractagree", gameContract, privateID);
         } catch (err) {
            setPlayerBalance(gameContract, privateID, "0"); //revert buy-in
            var payloadObj = new Object();
            payloadObj.error = new Object();
            payloadObj.error.message = err.message;
            //notify other contract players of the failure
            sendContractMessage(
               "contractagreefail",
               gameContract,
               privateID,
               null,
               payloadObj
            );
            cancelContract(gameContract);
            sendError(
               JSONRPC_ERRORS.ACTION_DISALLOWED,
               err.message,
               sessionObj
            );
            return false;
         }
         break;
      case "store":
         if (typeof requestParams.type != "string") {
            sendError(
               JSONRPC_ERRORS.INVALID_PARAMS_ERROR,
               '"type" parameter must be a string.',
               sessionObj
            );
            return false;
         }
         if (
            typeof requestParams.contract != "object" &&
            requestParams.contract != null
         ) {
            sendError(
               JSONRPC_ERRORS.INVALID_PARAMS_ERROR,
               '"contract" parameter must be an object.',
               sessionObj
            );
            return false;
         }
         contractOwnerPID = requestParams.ownerPID;
         contractID = requestParams.contractID;
         gameContract = getContractByID(contractOwnerPID, contractID);
         if (gameContract == null) {
            sendError(
               JSONRPC_ERRORS.ACTION_DISALLOWED,
               "No such contract.",
               sessionObj
            );
            return false;
         }
         if (gameContract.invalid) {
            sendError(
               JSONRPC_ERRORS.ACTION_DISALLOWED,
               "Contract is invalid.",
               sessionObj
            );
            return false;
         }
         try {
            var playerAccount = await validAccount(requestParams.account);
         } catch (err) {
            console.error(err);
            sendError(
               JSONRPC_ERRORS.ACTION_DISALLOWED,
               err.message,
               sessionObj
            );
            return false;
         }
         var player = getPlayer(gameContract, privateID);
         if (player == null) {
            sendError(
               JSONRPC_ERRORS.ACTION_DISALLOWED,
               "Not registered with contract.",
               sessionObj
            );
            return false;
         }
         updateDate = new Date();
         if (
            gameContract.history == undefined ||
            gameContract.history == null
         ) {
            gameContract.history = new Object();
         }
         if (
            gameContract.history.deck == undefined ||
            gameContract.history.deck == null
         ) {
            gameContract.history.deck = new Array();
         }
         //this should be examined:
         try {
            gameContract.cardDecks = requestParams.contract.cardDecks;
         } catch (err) {}
         switch (requestParams.type) {
            case "encrypt":
               if (
                  typeof requestParams.cards == "object" ||
                  requestParams.cards != null
               ) {
                  if (typeof requestParams.cards.length == "number") {
                     infoObj = new Object();
                     infoObj.fromPID = privateID;
                     infoObj.cards = Array.from(requestParams.cards);
                     gameContract.history.deck.push(infoObj);
                     //save game contract here
                     resultObj.contract = gameContract;
                     updatePlayersTimeout(
                        privateID,
                        getDealer(gameContract).privateID,
                        gameContract,
                        "store",
                        "encrypt",
                        gameContract.history.deck
                     );
                     try {
                        sendContractMessage(
                           "contractencryptstore",
                           gameContract,
                           privateID
                        );
                     } catch (err) {
                        console.error(err.stack);
                        sendError(
                           JSONRPC_ERRORS.ACTION_DISALLOWED,
                           "Could not store encryption round.",
                           sessionObj
                        );
                        return false;
                     }
                  } else {
                     sendError(
                        JSONRPC_ERRORS.INVALID_PARAMS_ERROR,
                        'Invalid "cards" array.',
                        sessionObj
                     );
                     return false;
                  }
               } else {
                  sendError(
                     JSONRPC_ERRORS.INVALID_PARAMS_ERROR,
                     'Invalid "cards" array.',
                     sessionObj
                  );
                  return false;
               }
               break;
            case "select":
               if (
                  typeof requestParams.cards == "object" ||
                  requestParams.cards != null
               ) {
                  if (typeof requestParams.cards.length == "number") {
                     infoObj = new Object();
                     //if infoObj.fromPID != privateID here, they're trying to spoof a PID. But it doesn't matter since:
                     infoObj.fromPID = privateID;
                     infoObj.type = "select";
                     infoObj.private = requestParams.private; //probably doesn't need to be checked
                     infoObj.cards = Array.from(requestParams.cards);
                     if (
                        gameContract.history.deals == undefined ||
                        gameContract.history.deals == null
                     ) {
                        gameContract.history.deals = new Object();
                     }
                     if (
                        gameContract.history.deals[privateID] == undefined ||
                        gameContract.history.deals[privateID] == null
                     ) {
                        gameContract.history.deals[privateID] = new Array();
                     }
                     gameContract.history.deals[privateID].push(infoObj);
                     //save game contract here
                     resultObj.contract = gameContract;
                     updatePlayersTimeout(
                        privateID,
                        privateID,
                        gameContract,
                        "store",
                        "select",
                        gameContract.history.deals[privateID]
                     );
                     try {
                        sendContractMessage(
                           "contractselectstore",
                           gameContract,
                           privateID
                        );
                     } catch (err) {
                        console.error(err.stack);
                        sendError(
                           JSONRPC_ERRORS.ACTION_DISALLOWED,
                           "Could not store decryption round.",
                           sessionObj
                        );
                        return false;
                     }
                  } else {
                     sendError(
                        JSONRPC_ERRORS.INVALID_PARAMS_ERROR,
                        'Invalid "cards" array.',
                        sessionObj
                     );
                     return false;
                  }
               } else {
                  sendError(
                     JSONRPC_ERRORS.INVALID_PARAMS_ERROR,
                     'Invalid "cards" array.',
                     sessionObj
                  );
                  return false;
               }
               break;
            case "decrypt":
               if (
                  typeof requestParams.cards == "object" ||
                  requestParams.cards != null
               ) {
                  if (typeof requestParams.cards.length == "number") {
                     var sourcePID = requestParams.sourcePID; //the deal initiator
                     infoObj = new Object();
                     infoObj.fromPID = privateID; //the last decryptor
                     infoObj.type = "decrypt";
                     infoObj.private = requestParams.private;
                     infoObj.cards = Array.from(requestParams.cards);
                     if (
                        gameContract.history.deals == undefined ||
                        gameContract.history.deals == null
                     ) {
                        gameContract.history.deals = new Object();
                     }
                     if (
                        gameContract.history.deals[sourcePID] == undefined ||
                        gameContract.history.deals[sourcePID] == null
                     ) {
                        gameContract.history.deals[sourcePID] = new Array();
                     }
                     gameContract.history.deals[sourcePID].push(infoObj);
                     updatePlayersTimeout(
                        privateID,
                        sourcePID,
                        gameContract,
                        "store",
                        "decrypt",
                        gameContract.history.deals[sourcePID]
                     );
                     //save game contract here
                     resultObj.contract = gameContract;
                     try {
                        sendContractMessage(
                           "contractdecryptstore",
                           gameContract,
                           privateID
                        );
                     } catch (err) {
                        console.error(err.stack);
                        sendError(
                           JSONRPC_ERRORS.ACTION_DISALLOWED,
                           "Could not store decryption round.",
                           sessionObj
                        );
                        return false;
                     }
                  } else {
                     sendError(
                        JSONRPC_ERRORS.INVALID_PARAMS_ERROR,
                        'Invalid "cards" array.',
                        sessionObj
                     );
                     return false;
                  }
               } else {
                  sendError(
                     JSONRPC_ERRORS.INVALID_PARAMS_ERROR,
                     'Invalid "cards" array.',
                     sessionObj
                  );
                  return false;
               }
               break;
            case "keychain":
               if (
                  typeof requestParams.keychain == "object" ||
                  requestParams.keychain != null
               ) {
                  if (typeof requestParams.keychain.length == "number") {
                     if (
                        gameContract.history.keychains[privateID] !=
                           undefined &&
                        gameContract.history.keychains[privateID] != null
                     ) {
                        console.error(
                           privateID +
                              " has attempted to re-submit keychain for contract: " +
                              contractID
                        );
                        sendError(
                           JSONRPC_ERRORS.ACTION_DISALLOWED,
                           "Keychain can only be stored once.",
                           sessionObj
                        );
                        return false;
                     }
                     gameContract.history.keychains[privateID] =
                        requestParams.keychain;
                     updatePlayersTimeout(
                        privateID,
                        privateID,
                        gameContract,
                        "store",
                        "keychain",
                        gameContract.history.keychains[privateID]
                     );
                     //save game contract here
                     resultObj.contract = gameContract;
                     try {
                        sendContractMessage(
                           "contractkeychainstore",
                           gameContract,
                           privateID
                        );
                     } catch (err) {
                        console.error(err.stack);
                        sendError(
                           JSONRPC_ERRORS.ACTION_DISALLOWED,
                           "Could not store keychain.",
                           sessionObj
                        );
                        return false;
                     }
                     var keychainsFound = 0;
                     for (var items in gameContract.history.keychains) {
                        keychainsFound++;
                     }
                     if (keychainsFound == gameContract.players.length) {
                        try {
                           var nonFoldedPlayers = new Array();
                           for (
                              count = 0;
                              count < gameContract.players.length;
                              count++
                           ) {
                              if (
                                 gameContract.players[count]._hasFolded ==
                                    false ||
                                 gameContract.players[count].hasFolded == false
                              ) {
                                 nonFoldedPlayers.push(
                                    gameContract.players[count]
                                 );
                              }
                           }
                           if (nonFoldedPlayers.length > 1) {
                              try {
                                 var analyzeResult = await analyzeCards(
                                    gameContract
                                 );
                              } catch (err) {
                                 console.error(err);
                                 //currently everyone gets a refund (until contract is more stable)
                                 err.failedPIDs = new Array();
                                 try {
                                    var penaltyResult = await applyPenalty(
                                       gameContract,
                                       err.failedPIDs,
                                       "validate"
                                    );
                                    gameContract.penalty = penaltyResult;
                                    gameContract.invalid = true;
                                 } catch (err) {
                                    console.error(err.stack);
                                    gameContract.penalty = null;
                                    sendError(
                                       JSONRPC_ERRORS.INTERNAL_ERROR,
                                       "Could not apply validation penalty.",
                                       sessionObj
                                    );
                                    return false;
                                 }
                                 sendError(
                                    JSONRPC_ERRORS.PLAYER_ACTION_ERROR,
                                    "Contract validation failed.",
                                    sessionObj
                                 );
                                 return false;
                              }
                              var scoreResult = await scoreHands(gameContract);
                              //Additional information can be gathered from:
                              //   scoreResult.winningPlayers
                              //   scoreResult.winningHands
                              //console.log ("Contract "+contractID+" completed.");
                           } else {
                              //all but player nonFoldedPlayers[0].privateID have folded
                              //console.log ("Contract "+contractID+" played to end.");
                              //console.log ("All but one player have folded: "+nonFoldedPlayers[0].privateID);
                              scoreResult = new Object();
                              scoreResult.winningPlayers = new Array();
                              scoreResult.winningPlayers.push(
                                 nonFoldedPlayers[0]
                              );
                              scoreResult.winningHands = new Array();
                           }
                           var winnings = bigInt(gameContract.pot);
                           winnings = winnings.divide(
                              scoreResult.winningPlayers.length
                           ); //this may produce rounding errors
                           for (
                              count = 0;
                              count < scoreResult.winningPlayers.length;
                              count++
                           ) {
                              var winningPlayer =
                                 scoreResult.winningPlayers[count];
                              try {
                                 var accountResult =
                                    await namespace.cp.getAccount(
                                       winningPlayer.account,
                                       false
                                    );
                                 var result = await addToAccountBalance(
                                    accountResult[0],
                                    winnings.toString(10),
                                    gameContract
                                 );
                              } catch (err) {
                                 console.error(err.stack);
                                 sendError(
                                    JSONRPC_ERRORS.ACTION_DISALLOWED,
                                    "Could not update account balance.",
                                    sessionObj
                                 );
                                 return false;
                              }
                           }
                           for (
                              count = 0;
                              count < gameContract.players.length;
                              count++
                           ) {
                              var currentPlayer = gameContract.players[count];
                              try {
                                 var accountResult =
                                    await namespace.cp.getAccount(
                                       currentPlayer.account,
                                       false
                                    );
                                 var result = await addToAccountBalance(
                                    accountResult[0],
                                    currentPlayer.balance,
                                    gameContract
                                 );
                              } catch (err) {
                                 console.error(err.stack);
                                 sendError(
                                    JSONRPC_ERRORS.ACTION_DISALLOWED,
                                    "Could not update account balance.",
                                    sessionObj
                                 );
                                 return false;
                              }
                           }
                           gameContract.invalid = true;
                           //save game contract here
                           sendContractMessage("contractend", gameContract);
                        } catch (err) {
                           console.error(err);
                        }
                        //analyze here
                     } else {
                        //contract is waiting for additional keychains
                     }
                  } else {
                     sendError(
                        JSONRPC_ERRORS.INVALID_PARAMS_ERROR,
                        'Invalid "keychain" array.',
                        sessionObj
                     );
                     return false;
                  }
               } else {
                  sendError(
                     JSONRPC_ERRORS.INVALID_PARAMS_ERROR,
                     'Invalid "keychain" array.',
                     sessionObj
                  );
                  return false;
               }
               return true;
               break;
            default:
               sendError(
                  JSONRPC_ERRORS.INVALID_PARAMS_ERROR,
                  'Unrecognized store "type"',
                  sessionObj
               );
               return false;
               break;
         }
         break;
      case "bet":
         var contractOwnerPID = requestParams.ownerPID;
         var contractID = requestParams.contractID;
         var gameContract = getContractByID(contractOwnerPID, contractID);
         if (typeof requestParams.amount != "string")
            if (gameContract == null) {
               console.error(
                  "Attempt to access non-existent contract: " + contractID
               );
               sendError(
                  JSONRPC_ERRORS.ACTION_DISALLOWED,
                  "No such contract.",
                  sessionObj
               );
               return false;
            }
         if (gameContract.invalid) {
            sendError(
               JSONRPC_ERRORS.ACTION_DISALLOWED,
               "Contract is invalid.",
               sessionObj
            );
            return false;
         }
         try {
            var playerAccount = await validAccount(requestParams.account);
         } catch (err) {
            sendError(
               JSONRPC_ERRORS.ACTION_DISALLOWED,
               err.message,
               sessionObj
            );
            return false;
         }
         var player = getPlayer(gameContract, privateID);
         if (player == null) {
            sendError(
               JSONRPC_ERRORS.ACTION_DISALLOWED,
               "Not registered with contract.",
               sessionObj
            );
            return false;
         }
         var playerBalance = bigInt(player.balance);
         var totalBet = bigInt(player.totalBet);
         var betAmount = bigInt(requestParams.amount);
         if (betAmount.greater(0)) {
            totalBet = totalBet.plus(betAmount);
         }
         player.totalBet = totalBet.toString(10);
         player.numActions++;
         player.hasBet = true;
         player._hasBet = true;
         try {
            if (betAmount.lesser(0)) {
               //folding
               player.hasFolded = true;
               player._hasFolded = true;
               player.hasBet = true;
               player._hasBet = true;
               player.totalBet = "0";
               updatePlayersTimeout(privateID, privateID, gameContract, "bet");
               if (bettingDone(gameContract) == true) {
                  for (
                     var count = 0;
                     count < gameContract.players.length;
                     count++
                  ) {
                     gameContract.players[count].hasBet = false;
                  }
                  updatePlayersTimeout(
                     privateID,
                     privateID,
                     gameContract,
                     "deal"
                  ); //do this after resetting everyone!
               }
            } else {
               //betting or raising (betAmount.greater(0)) / checking (betAmount.equals(0))
               gameContract.pot = bigInt(gameContract.pot)
                  .plus(betAmount)
                  .toString(10);
               var biggestBet = largestBet(gameContract);
               var totalCurrentBet = bigInt(player.totalBet);
               if (totalCurrentBet.equals(biggestBet)) {
                  //matched bet / checking / calling
                  if (bettingDone(gameContract) == true) {
                     for (
                        var count = 0;
                        count < gameContract.players.length;
                        count++
                     ) {
                        gameContract.players[count].hasBet = false;
                     }
                     updatePlayersTimeout(
                        privateID,
                        privateID,
                        gameContract,
                        "deal"
                     ); //do this after resetting everyone!
                  } else {
                     updatePlayersTimeout(
                        privateID,
                        privateID,
                        gameContract,
                        "bet"
                     );
                  }
               } else if (totalCurrentBet.greater(biggestBet)) {
                  //raising
                  updatePlayersTimeout(
                     privateID,
                     privateID,
                     gameContract,
                     "bet"
                  ); //do this before resetting everyone!
                  for (
                     var count = 0;
                     count < gameContract.players.length;
                     count++
                  ) {
                     if (gameContract.players[count].privateID != privateID) {
                        gameContract.players[count].hasBet = false;
                     }
                  }
               }
               setPlayerBalance(
                  gameContract,
                  privateID,
                  playerBalance.minus(betAmount).toString(10)
               );
            }
            //save game contract here
            resultObj.contract = gameContract;
            sendContractMessage("contractbet", gameContract, privateID);
         } catch (err) {
            //attempt to reverse the bet
            if (betAmount.greater(0)) {
               gameContract.pot = bigInt(gameContract.pot)
                  .minus(betAmount)
                  .toString(10);
            }
            console.error(err.stack);
            sendError(
               JSONRPC_ERRORS.ACTION_DISALLOWED,
               "Could not update account balance.",
               sessionObj
            );
            return false;
         }
         break;
      case "timeout":
         contractOwnerPID = requestParams.ownerPID;
         contractID = requestParams.contractID;
         gameContract = getContractByID(contractOwnerPID, contractID);
         if (gameContract == null) {
            sendError(
               JSONRPC_ERRORS.ACTION_DISALLOWED,
               "No such contract.",
               sessionObj
            );
            return false;
         }
         if (gameContract.invalid) {
            sendError(
               JSONRPC_ERRORS.ACTION_DISALLOWED,
               "Contract is invalid.",
               sessionObj
            );
            return false;
         }
         try {
            var playerAccount = await validAccount(requestParams.account);
         } catch (err) {
            sendError(
               JSONRPC_ERRORS.ACTION_DISALLOWED,
               err.message,
               sessionObj
            );
            return false;
         }
         var player = getPlayer(gameContract, privateID);
         if (player == null) {
            sendError(
               JSONRPC_ERRORS.ACTION_DISALLOWED,
               "Not registered with contract.",
               sessionObj
            );
            return false;
         }
         if (typeof gameContract.table.tableInfo.timeout == "number") {
            //use contract-defined timeout
            var timeout = gameContract.table.tableInfo.timeout;
         } else {
            //use config-defined timeout
            timeout = config.CP.API.contract.timeoutDefault;
         }
         var timedoutPlayers = checkContractTimeout(gameContract, timeout);
         if (timedoutPlayers.length > 0) {
            var timedoutPIDs = new Array();
            for (count = 0; count < timedoutPlayers.length; count++) {
               timedoutPIDs.push(timedoutPlayers[count].privateID);
            }
            try {
               var penaltyResult = await applyPenalty(
                  gameContract,
                  timedoutPIDs,
                  "timeout"
               );
               gameContract.penalty = penaltyResult;
            } catch (err) {
               console.error(err.stack);
               gameContract.penalty = null;
               sendError(
                  JSONRPC_ERRORS.INTERNAL_ERROR,
                  "Could not apply timeout penalty.",
                  sessionObj
               );
               return false;
            }
         }
         gameContract.invalid = true;
         resultObj.contract = gameContract;
         //save game contract here
         sendContractMessage("contracttimeout", gameContract);
         break;
      default:
         sendError(
            JSONRPC_ERRORS.INVALID_PARAMS_ERROR,
            "Unrecognized action.",
            sessionObj
         );
         return false;
         break;
   }
   sendResult(resultObj, sessionObj);
   return true;
}

/**
 * Analyzes a contract's history for cryptographic correctness and returns
 * the verified, decrypted cards (as {@link CypherPokerCard} instances),
 * for each player along with the public / community cards. This function should
 * only be called when the game has completed and all keychains received.
 *
 * @param {ContractObject} contract The contract containing the <code>history</code>
 * to analyze.
 *
 * @return {Promise} The promise resolves with an object containing a <code>players</code>
 * object containing name/value pairs with each name matching a player private ID and containing
 * an array of {@link CypherPokerCard} instances, and a <code>public</code>
 * property containing an array of the public / community {@link CypherPokerCard} instances.
 * If the analysis fails it is rejected with an <code>Error</code> which includes a
 * <code>message</code> and numeric <code>code</code> identifying the analysis failure.
 *
 * @async
 * @private
 */
async function analyzeCards(contract) {
   var history = contract.history;
   if (history.analysis == undefined || history.analysis == null) {
      history.analysis = new Object();
   }
   //step 1: analyze the full deck (creation & encryption)
   if (history.deck.length == 0) {
      return null;
   }
   //todo: check to ensure that all values are quadratic residues
   var cardsObj = history.analysis;
   cardsObj.private = new Object();
   cardsObj.public = new Array();
   var faceUpMappings = Array.from(history.deck[0].cards); //generated plaintext (quadratic residues) values
   var previousDeck = Array.from(faceUpMappings);
   for (var count = 1; count < history.deck.length; count++) {
      var currentDeck = Array.from(history.deck[count].cards);
      var keychain = history.keychains[history.deck[count].fromPID];
      var resultDeck = new Array();
      try {
         for (var count2 = 0; count2 < previousDeck.length; count2++) {
            resultDeck.push(SRAEncrypt(keychain[0], previousDeck[count2]));
         }
      } catch (err) {
         var error = new Error(
            "Likely problem with keychain for PID: " +
               history.deck[count].fromPID
         );
         error.code = 1;
         error.failedPIDs = new Array();
         error.failedPIDs.push(history.deck[count].fromPID);
         history.analysis.error = err;
         history.analysis.complete = true;
         throw error;
      }
      if (compareDecks(currentDeck, resultDeck) == false) {
         var error = new Error(
            "Deck encryption at stage " +
               count +
               ' by "' +
               history.deck[count].fromPID +
               '" failed.'
         );
         error.code = 1;
         error.failedPIDs = new Array();
         error.failedPIDs.push(history.deck[count].fromPID);
         history.analysis.error = error;
         history.analysis.complete = true;
         throw error;
      }
      previousDeck = currentDeck;
   }
   //previousDeck should now contain the fully encrypted deck
   var encryptedDeck = previousDeck;
   //step 1: passed
   //step 2: analyze private / public card selections and decryptions
   history.deals = fixDealsOrder(contract);
   for (var privateID in history.deals) {
      var dealArray = history.deals[privateID];
      var decrypting = false; //currently decrypting cards?
      var previousType = "select"; //should match dealArray[0].type
      for (count = 0; count < dealArray.length; count++) {
         var currentDeal = dealArray[count];
         if (currentDeal == undefined || currentDeal == null) {
            //not a deal history object (probably inherited onEventPromise)
            break;
         }
         if (count > 0) {
            var previousDeal = dealArray[count - 1];
            var previousCards = previousDeal.cards;
            var previousPID = previousDeal.fromPID;
            var previousPrivate = previousDeal.private;
            previousType = previousDeal.type;
         }
         var sourcePID = privateID; //card dealer / selector
         var fromPID = currentDeal.fromPID; //private ID of "cards" (result) sender
         var type = currentDeal.type; //"select" or "decrypt"
         var privateDeal = currentDeal.private; //private / hole cards?
         var cards = currentDeal.cards; //numeric card value strings, encrypted or plaintext;
         if (cardsObj.private[sourcePID] == undefined) {
            cardsObj.private[sourcePID] = new Array();
         }
         if (previousType == "select" && type == "select") {
            //probably the first entry but...
            if (count > 0) {
               var error = new Error(
                  'Multiple sequential "select" sequences in deal.'
               );
               error.code = 2;
               error.failedPIDs = new Array();
               error.failedPIDs.push(fromPID);
               history.analysis.error = error;
               history.analysis.complete = true;
               throw error;
            }
            if (removeFromDeck(cards, encryptedDeck) == false) {
               var error = new Error(
                  'Duplicates found in "select" deal index ' +
                     count +
                     ' for "' +
                     fromPID +
                     '".'
               );
               error.code = 2;
               error.failedPIDs = new Array();
               error.failedPIDs.push(fromPID);
               history.analysis.error = error;
               history.analysis.complete = true;
               throw error;
            }
         } else if (
            previousType == "select" &&
            type == "decrypt" &&
            count < dealArray.length - 1
         ) {
            //starting a new decryption operation (deal or select cards)
            decrypting = true;
         } else if (previousType == "decrypt" && type == "select") {
            //ending decryption operation (final decryption outstanding)
            keychain = history.keychains[sourcePID];
            promises = new Array();
            promiseResults = new Array();
            try {
               for (count2 = 0; count2 < previousCards.length; count2++) {
                  promiseResults.push(
                     SRADecrypt(keychain[0], previousCards[count2])
                  );
               }
            } catch (err) {
               var error = new Error(
                  "Likely problem with keychain for PID: " + sourcePID
               );
               error.code = 1;
               error.failedPIDs = new Array();
               error.failedPIDs.push(sourcePID);
               history.analysis.error = err;
               history.analysis.complete = true;
               throw error;
            }
            var dealtCards = new Array();
            for (count2 = 0; count2 < promiseResults.length; count2++) {
               var card = getMappedCard(contract, promiseResults[count2]);
               if (card == null) {
                  var error = new Error(
                     "Final decryption (deal " +
                        count +
                        ') by "' +
                        fromPID +
                        '" does not map: ' +
                        promiseResults[count2]
                  );
                  error.code = 2;
                  error.failedPIDs = new Array();
                  error.failedPIDs.push(fromPID);
                  history.analysis.error = error;
                  history.analysis.complete = true;
                  throw error;
               }
               if (previousPrivate) {
                  cardsObj.private[sourcePID].push(card);
               } else {
                  cardsObj.public.push(card);
               }
            }
            if (removeFromDeck(cards, encryptedDeck) == false) {
               var error = new Error(
                  'Duplicates found in "select" deal index ' +
                     count +
                     ' for "' +
                     fromPID +
                     '".'
               );
               error.code = 2;
               error.failedPIDs = new Array();
               error.failedPIDs.push(fromPID);
               history.analysis.error = error;
               history.analysis.complete = true;
               throw error;
            }
         } else {
            //decryption in progress
            if (count == dealArray.length - 1) {
               //final decryption for source
               keychain = history.keychains[sourcePID];
               promises = new Array();
               promiseResults = new Array();
               try {
                  for (count2 = 0; count2 < cards.length; count2++) {
                     promiseResults.push(
                        SRADecrypt(keychain[0], cards[count2])
                     );
                  }
               } catch (err) {
                  var error = new Error(
                     "Likely problem with keychain for PID: " + sourcePID
                  );
                  error.code = 1;
                  error.failedPIDs = new Array();
                  error.failedPIDs.push(sourcePID);
                  history.analysis.error = err;
                  history.analysis.complete = true;
                  throw error;
               }
               for (count2 = 0; count2 < promiseResults.length; count2++) {
                  var card = getMappedCard(contract, promiseResults[count2]);
                  if (card == null) {
                     var error = new Error(
                        "Final decryption (deal " +
                           count +
                           ') by "' +
                           fromPID +
                           '" does not map: ' +
                           promiseResults[count2]
                     );
                     error.code = 2;
                     error.failedPIDs = new Array();
                     error.failedPIDs.push(fromPID);
                     history.analysis.error = error;
                     history.analysis.complete = true;
                     throw error;
                  }
                  if (privateDeal) {
                     cardsObj.private[sourcePID].push(card);
                  } else {
                     cardsObj.public.push(card);
                  }
               }
            } else {
               //continuing decryption from another player
               keychain = history.keychains[fromPID];
               compareDeck = new Array();
               promises = new Array();
               promiseResults = new Array();
               try {
                  //decrypt current cards to compare to what was sent by current player...
                  for (count2 = 0; count2 < previousCards.length; count2++) {
                     promises.push(
                        SRADecrypt(keychain[0], previousCards[count2])
                     );
                  }
               } catch (err) {
                  var error = new Error(
                     "Likely problem with keychain for PID: " + fromPID
                  );
                  error.code = 1;
                  error.failedPIDs = new Array();
                  error.failedPIDs.push(fromPID);
                  history.analysis.error = err;
                  history.analysis.complete = true;
                  throw error;
               }
               promiseResults = await Promise.all(promises);
               for (count2 = 0; count2 < promiseResults.length; count2++) {
                  compareDeck.push(promiseResults[count2]);
               }
               if (compareDecks(compareDeck, cards) == false) {
                  var error = new Error(
                     "Previous round (" +
                        count +
                        ') of decryption by "' +
                        fromPID +
                        '" for "' +
                        sourcePID +
                        '" does not match computed results.'
                  );
                  error.code = 2;
                  error.failedPIDs = new Array();
                  error.failedPIDs.push(fromPID);
                  history.analysis.error = error;
                  history.analysis.complete = true;
                  throw error;
               }
            }
         }
      }
   }
   return cardsObj;
}

/**
 * Generates player card permutations for analysis and scores the hands.
 *
 * @param {ContractObject} contract The analyzed and validated (using {@link analyzeCards}),
 * contract object to use for scoring.
 *
 * @return {Object} Contains the arrays <code>winningPlayers</code> containing the
 * winning player object(s) for the <code>contract</code>, and <code>winningHands</code>
 * which contains the associated winning hand(s) for the player(s).
 * @private
 */
async function scoreHands(contract) {
   var cardsObj = contract.history.analysis;
   var analysis = contract.history.analysis;
   var playersObj = cardsObj.private;
   cardsObj.hands = new Object();
   var playerHands = new Object();
   var highestScore = -1;
   var highestHand = new Array();
   var winningPlayers = new Array();
   var winningHands = new Array();
   for (var privateID in playersObj) {
      var player = getPlayer(contract, privateID);
      //private ID may actually be some other object property (e.g. onEventPromise)
      if (player != null) {
         if (player.hasFolded == false) {
            var fullCards = playersObj[privateID].concat(cardsObj.public);
            cardsObj.hands[privateID] = new Array();
            var perms = createCardPermutations(fullCards);
            for (var count = 0; count < perms.length; count++) {
               var handObj = new Object();
               handObj.hand = perms[count];
               handObj.score = -1; //default (not scored)
               scoreHand(handObj);
               cardsObj.hands[privateID].push(handObj);
               if (handObj.score == highestScore) {
                  //this may be a split pot; see below
                  winningPlayers.push(player);
                  winningHands.push(handObj);
               } else if (handObj.score > highestScore) {
                  //new best hand
                  winningPlayers = new Array();
                  winningHands = new Array();
                  winningPlayers.push(player);
                  winningHands.push(handObj);
                  highestScore = handObj.score;
               }
            }
         }
      }
   }
   if (winningPlayers.length > 1) {
      //need to look at both private cards since we currently have a potential split pot
      var newWinningPlayers = new Array();
      var newWinningHands = new Array();
      var highestScore = 0;
      for (count = 0; count < winningPlayers.length; count++) {
         var winningHand = winningHands[count]; //indexes match with winningPlayers
         var hand = winningHand.hand;
         var player = winningPlayers[count];
         var playerPID = player.privateID;
         var privateCard1 = analysis.private[playerPID][0];
         var privateCard2 = analysis.private[playerPID][1];
         //adjust score for highest card value
         if (privateCard1.highvalue > privateCard2.highvalue) {
            var currentScore =
               privateCard1.highvalue * 10 + privateCard2.highvalue;
         } else {
            currentScore = privateCard2.highvalue * 10 + privateCard1.highvalue;
         }
         winningHand.score = currentScore;
         if (currentScore > highestScore) {
            highestScore = currentScore;
            newWinningPlayers = new Array();
            newWinningHands = new Array();
            newWinningPlayers.push(player);
            newWinningHands.push(winningHand);
         } else if (currentScore == highestScore) {
            //both private card values are the same -- possible split pot
            var playerExists = false;
            for (count2 = 0; count2 < newWinningPlayers.length; count2++) {
               if (newWinningPlayers[count2].privateID == player.privateID) {
                  playerExists = true;
                  break;
               }
            }
            //only add player once (since some hands generate multiple similar results)
            if (playerExists == false) {
               newWinningPlayers.push(player);
               newWinningHands.push(winningHand);
            }
         }
      }
      winningPlayers = newWinningPlayers;
      winningHands = newWinningHands;
   }
   cardsObj.winningPlayers = winningPlayers;
   cardsObj.winningHands = winningHands;
   //console.log ("Winning players:");
   //console.dir (winningPlayers);
   //console.log ("Winning Hands:");
   //console.dir (winningHands);
   return cardsObj;
}

/**
 * Scores a 5 cards (or fewer) poker hand. The higher the score the
 * better the hand.
 *
 * @param {Object} handObj A hand permutation and score object. This object is
 * direccly updated with the resulting score.
 * @param {Array} handObj.hand Array of {@link CypherPokerCard} instances
 * comprising the hand to score.
 * @param {Number} handObj.score=-1 Calculated score of final hand. -1 means
 * that the hand is not scored.
 *
 * @private
 */
function scoreHand(handObj) {
   if (handObj.hand == undefined || handObj.hand == null) {
      return;
   }
   handObj.score = -1;
   //create groups sorted by suits and values
   var suitGroups = new Object();
   var valueGroups = new Object();
   for (count = 0; count < handObj.hand.length; count++) {
      var currentCard = handObj.hand[count];
      var suit = currentCard.suit;
      var value = currentCard.value;
      if (suitGroups[suit] == undefined) {
         suitGroups[suit] = new Array();
      }
      if (valueGroups[value] == undefined) {
         valueGroups[value] = new Array();
      }
      suitGroups[suit].push(currentCard);
      valueGroups[value].push(currentCard);
   }
   //convert group objects to arrays of arrays
   suitGroups = Object.entries(suitGroups);
   valueGroups = Object.entries(valueGroups);
   var flush = false;
   //evaluate for flush (only 1 suit and 5 cards):
   if (suitGroups.length == 1 && handObj.hand.length == 5) {
      flush = true;
   }
   //evaluate straight:
   var straight = false;
   var royalflush = false;
   var acesHigh = true;
   var valuesArr = new Array();
   var handValue = 0; //the base numeric value of the hand
   var valueMultiplier = 1; //the multiplier applied to handValue to determine the score
   var valueAdjust = 0; //the amount to adjust the hand value in the final calculation
   for (var count = 0; count < handObj.hand.length; count++) {
      valuesArr.push(handObj.hand[count].value);
   }
   var straightVal = straightType(valuesArr);
   if (straightVal == 10 && flush) {
      straight = true;
      royalflush = true;
   } else if (straightVal > 0) {
      straight = true;
   }
   if (royalflush) {
      valueMultiplier = 1000000000;
      handObj.name = "Royal Flush";
   } else if (straight && flush) {
      if (straightVal == 1) {
         //this is a straight starting with an ace
         acesHigh = false;
      }
      valueMultiplier = 100000000;
      handObj.name = "Straight Flush";
   } else if (valueGroups.length == 2 && handObj.hand.length >= 5) {
      if (valueGroups[0][1].length == 4 || valueGroups[1][1].length == 4) {
         valueMultiplier = 10000000;
         for (count = 0; count < valueGroups.length; count++) {
            if (valueGroups[count][1].length != 4) {
               var cardSum = getCardSum(valueGroups[count][1]);
               //remove multiplied values for cards that are not in the hand
               //otherwise they can cause significant scoring problems
               valueAdjust = cardSum * valueMultiplier * -1 + cardSum;
            }
         }
         handObj.name = "Four of a Kind";
      }
      if (valueGroups[0][1].length == 3 || valueGroups[1][1].length == 3) {
         valueMultiplier = 1000000;
         handObj.name = "Full House";
      }
   } else if (flush && straight == false) {
      valueMultiplier = 100000;
      handObj.name = "Flush";
   } else if (straight && flush == false) {
      if (straightVal == 1) {
         //this is a straight starting with an ace
         acesHigh = false;
      }
      valueMultiplier = 10000;
      handObj.name = "Straight";
   } else if (valueGroups.length == 3) {
      if (
         valueGroups[0][1].length == 3 ||
         valueGroups[1][1].length == 3 ||
         valueGroups[2][1].length == 3
      ) {
         valueMultiplier = 1000;
         for (count = 0; count < valueGroups.length; count++) {
            if (valueGroups[count][1].length != 3) {
               var cardSum = getCardSum(valueGroups[count][1]);
               valueAdjust = cardSum * valueMultiplier * -1 + cardSum;
            }
         }
         handObj.name = "Three of a Kind";
      } else {
         valueMultiplier = 100;
         handObj.name = "Two Pairs";
         for (count = 0; count < valueGroups.length; count++) {
            if (valueGroups[count][1].length != 2) {
               var cardSum = getCardSum(valueGroups[count][1]);
               valueAdjust = cardSum * valueMultiplier * -1 + cardSum;
            }
         }
      }
   } else if (valueGroups.length == 4 || valueGroups.length == 1) {
      //valueGroups.length == 1 on flop
      valueMultiplier = 15;
      for (count = 0; count < valueGroups.length; count++) {
         if (valueGroups[count][1].length != 2) {
            var cardSum = getCardSum(valueGroups[count][1]);
            valueAdjust = cardSum * valueMultiplier * -1 + cardSum;
         }
      }
      handObj.name = "One Pair";
   } else {
      handObj.name = "High Card";
   }
   if (valueMultiplier > 1) {
      for (count = 0; count < handObj.hand.length; count++) {
         if (acesHigh) {
            handValue += handObj.hand[count].highvalue;
         } else {
            handValue += handObj.hand[count].value;
         }
      }
   } else {
      //high card (secondary scan is required for additional card)
      handValue = 0;
      for (count = 0; count < handObj.hand.length; count++) {
         if (handValue < handObj.hand[count].highvalue) {
            handValue = handObj.hand[count].highvalue;
         }
      }
   }
   handObj.score = handValue * valueMultiplier + valueAdjust;
}

/**
 * Evaluates an unordered series of card values to determine what type of
 * straight they comprise.
 *
 * @param {Array} cardValues Unordered sequence of card values to analyze.
 *
 * @return {Number} A 0 is returned if the input is not a straight, otherwise
 * the lowest value in the straight is returned (e.g. if <code>cardValues=[4,3,5,6,7]</code>
 * then 3 is returned).
 * @private
 */
function straightType(cardValues) {
   if (cardValues.length < 5) {
      //need 5 cards for a straight
      return 0;
   }
   //check for ace through 9
   for (var count = 1; count < 10; count++) {
      if (
         compareDecks(cardValues, [
            count,
            count + 1,
            count + 2,
            count + 3,
            count + 4,
         ])
      ) {
         return count;
      }
   }
   //check for high ace with a 10 (is there a more elegant way to do this in the "for" loop?)
   if (compareDecks(cardValues, [10, 11, 12, 13, 1])) {
      return 10;
   }
   //not a straight
   return 0;
}

/**
 *  Sum the {@link CypherPokerCard} instances provided.
 *
 * @param {Array} cards Indexed array of {@link CypherPokerCard} instances to sum.
 * @param {Boolean} [high=true] If true, the card's <code>highvalue</code> is used to
 * calculate the sum otherwise its <code>value</code> is used.
 * @return {Number} The numeric sum of the card values.
 * @private
 */
function getCardSum(cards, high = true) {
   var sum = new Number(0);
   for (var count = 0; count < cards.length; count++) {
      if (high) {
         sum += cards[count].highvalue;
      } else {
         sum += cards[count].value;
      }
   }
   return sum;
}

/**
 * Fixes potential deal order problems within a {@link ContractObject}.
 *
 * @param {ContractObject} contract The contract conntaining a <code>history.deals</code>
 * object to fix.
 *
 * @return {Object} A structure similar to the <code>contract.history.deals</code> but with
 * deal orders fixed according to the betting order in the <code>contract.players</code> array.
 * @private
 */
function fixDealsOrder(contract) {
   var deals = contract.history.deals;
   var returnDeals = new Object();
   for (var privateID in deals) {
      var playerDeals = deals[privateID];
      returnDeals[privateID] = new Array();
      var dealIndex = 0;
      var startingPlayerIndex = 0;
      for (var count = 0; count < contract.players.length; count++) {
         if (contract.players[count].privateID == privateID) {
            startingPlayerIndex = (count + 1) % contract.players.length;
            break;
         }
      }
      var playerIndex = startingPlayerIndex;
      for (count = 0; count < playerDeals.length; count++) {
         if (playerDeals[count].type == "select") {
            returnDeals[privateID].push(playerDeals[count]); //store select
            if (count > 0) {
               //if not first "select"
               dealIndex++;
               playerIndex = startingPlayerIndex;
            }
         } else {
            var nextFromPID = contract.players[playerIndex].privateID;
            var nextDeal = getNextDealAction(
               playerDeals,
               nextFromPID,
               dealIndex
            );
            returnDeals[privateID].push(nextDeal);
            playerIndex = (playerIndex + 1) % contract.players.length;
         }
      }
   }
   return returnDeals;
}

/**
 * Checks to see if any of a contract's players have timed out and returns the list
 * of those that have.
 *
 * @param {ContractObject} contract The contract to analyze.
 * @param {Number} [timeoutThreshold=20] The number of seconds to elapse before a
 * player is considered timed out.
 *
 * @return {Array} A list of all players that have timed out. This will usually only
 * be a single player who's <code>updated</code> property is the oldest but may be more
 * than one if they're exactly the same.
 * @private
 */
function checkContractTimeout(contract, timeoutThreshold = 20) {
   var currentTimestamp = new Date();
   var timedoutPlayers = new Array();
   for (var count = 0; count < contract.players.length; count++) {
      if (typeof contract.players[count].updated == "string") {
         var playerTimestamp = new Date(contract.players[count].updated);
         //we assume that player timestamp is always in the past or at the most present
         //with respect to the system time:
         if (
            currentTimestamp.valueOf() - playerTimestamp.valueOf() >=
            timeoutThreshold * 1000
         ) {
            timedoutPlayers.push(contract.players[count]);
         }
      }
   }
   var returnPlayers = new Array();
   if (timedoutPlayers.length > 0) {
      var oldestPlayer = timedoutPlayers[0];
      var oldestTimestamp = new Date(oldestPlayer.updated);
      for (count = 0; count < timedoutPlayers.length; count++) {
         var playerTimestamp = new Date(timedoutPlayers[count].updated);
         if (playerTimestamp.valueOf() < oldestTimestamp.valueOf()) {
            //we have a new oldest timestamp
            returnPlayers = new Array();
            returnPlayers.push(timedoutPlayers[count]);
            oldestPlayer = timedoutPlayers[count];
            oldestTimestamp = new Date(oldestPlayer.updated);
         } else if (oldestTimestamp.valueOf() == playerTimestamp.valueOf()) {
            //it's the same
            returnPlayers.push(timedoutPlayers[count]);
         } else {
            //it's newer
         }
      }
   }
   return returnPlayers;
}

/**
 * Immediately applies a specific penalty to the supplied player(s)
 * associated with a contract.
 *
 * @param {ContractObject} contract The contract to use as the authority on how to apply
 * the penalty.
 * @param {Array} playerPIDs The player(s) to be penalized.
 * @param {String} penaltyType The type of infraction that the player committed, to
 * be correlated to the penalty.
 *
 * @return {Promise} Resolves with an object containing details about the penalty applied.
 * Rejects with an {@link Error} object.
 * @private
 * @async
 */
async function applyPenalty(contract, playerPIDs, penaltyType) {
   var penaltyReport = new Object();
   switch (penaltyType) {
      case "timeout":
         //distributes all penalized players' funds (bets and balance) to other players
         penaltyReport.penalized = new Array();
         penaltyReport.awarded = new Array();
         var distributionAmount = bigInt(contract.pot);
         var penalizedPIDs = new Array();
         for (var count = 0; count < playerPIDs.length; count++) {
            var player = getPlayer(contract, playerPIDs[count]);
            if (player != null) {
               var playerBalance = bigInt(player.balance);
               distributionAmount = distributionAmount.plus(playerBalance);
               player.balance = "0"; //entire balance is lost
               var penalizationObj = new Object();
               penalizationObj.privateID = playerPIDs[count];
               penalizationObj.amount = player.balance;
               penaltyReport.penalized.push(penalizationObj);
               penalizedPIDs.push(player.privateID);
            }
         }
         //console.log ("Player(s) \""+penalizedPIDs+"\" has/have timed out contract: "+contract.contractID);
         var distributionPIDs = new Array();
         for (count = 0; count < contract.players.length; count++) {
            var currentPlayer = contract.players[count];
            var penaltyPlayer = playerPIDs.find((penaltyPrivateID) => {
               return currentPlayer.privateID == penaltyPrivateID;
            });
            if (penaltyPlayer == undefined) {
               distributionPIDs.push(currentPlayer.privateID);
            }
         }
         if (distributionPIDs.length == 0) {
            //everyone timed out equally at some critical step / contract is simply refunded
            distributionPIDs = penalizedPIDs;
         }
         var perPlayerAmount = distributionAmount.divide(
            distributionPIDs.length
         );
         for (count = 0; count < distributionPIDs.length; count++) {
            var currentPlayer = getPlayer(contract, distributionPIDs[count]);
            if (currentPlayer != null) {
               var currentPlayerBalance = bigInt(currentPlayer.balance);
               currentPlayerBalance =
                  currentPlayerBalance.plus(perPlayerAmount);
               currentPlayer.balance = currentPlayerBalance.toString(10);
               var searchObj = new Object();
               searchObj.address = currentPlayer.account.address;
               searchObj.type = currentPlayer.account.type;
               searchObj.network = currentPlayer.account.network;
               var accountResult = await namespace.cp.getAccount(searchObj);
               //subtract buy-in from account and deposit to contract
               try {
                  var result = await addToAccountBalance(
                     accountResult[0],
                     currentPlayer.balance,
                     contract
                  );
                  //save game contract here
                  var awardObj = new Object();
                  awardObj.privateID = currentPlayer.privateID;
                  awardObj.amount = perPlayerAmount.toString(10);
                  penaltyReport.awarded.push(awardObj);
               } catch (err) {
                  console.error(err.stack);
                  sendError(
                     JSONRPC_ERRORS.ACTION_DISALLOWED,
                     "Could not update account balance.",
                     sessionObj
                  );
                  return false;
               }
            }
         }
         break;
      case "validate":
         //distributes all penalized players' funds (bets and balance) to other players
         penaltyReport.penalized = new Array();
         penaltyReport.awarded = new Array();
         var distributionAmount = bigInt(contract.pot);
         for (var count = 0; count < playerPIDs.length; count++) {
            var player = getPlayer(contract, playerPIDs[count]);
            var playerBalance = bigInt(player.balance);
            distributionAmount = distributionAmount.plus(playerBalance);
            player.balance = "0"; //entire balance is lost
            var penalizationObj = new Object();
            penalizationObj.privateID = playerPIDs[count];
            penalizationObj.amount = player.balance;
            penaltyReport.penalized.push(penalizationObj);
         }
         var distributionPIDs = new Array();
         for (count = 0; count < contract.players.length; count++) {
            var currentPlayer = contract.players[count];
            var penaltyPlayer = playerPIDs.find((penaltyPrivateID) => {
               return currentPlayer.privateID == penaltyPrivateID;
            });
            if (penaltyPlayer == undefined) {
               distributionPIDs.push(currentPlayer);
            }
         }
         if (distributionPIDs.length == 0) {
            //no one is being penalized (everyone is refunded)
            distributionPIDs = new Array();
            for (count = 0; count < contract.players.length; count++) {
               distributionPIDs.push(contract.players[count].privateID);
            }
         }
         var perPlayerAmount = distributionAmount.divide(
            distributionPIDs.length
         ); //per non-penalilzed player
         for (count = 0; count < distributionPIDs.length; count++) {
            var currentPlayer = distributionPIDs[count];
            var currentPlayerBalance = bigInt(currentPlayer.balance);
            currentPlayerBalance = currentPlayerBalance.plus(perPlayerAmount);
            currentPlayer.balance = currentPlayerBalance.toString(10);
            var searchObj = new Object();
            searchObj.address = currentPlayer.account.address;
            searchObj.type = currentPlayer.account.type;
            searchObj.network = currentPlayer.account.network;
            var accountResult = await namespace.cp.getAccount(searchObj);
            //subtract buy-in from account and deposit to contract
            try {
               var result = await addToAccountBalance(
                  accountResult[0],
                  currentPlayer.balance,
                  contract
               );
               //save game contract here
               var awardObj = new Object();
               awardObj.privateID = currentPlayer.privateID;
               awardObj.amount = perPlayerAmount.toString(10);
               penaltyReport.awarded.push(awardObj);
            } catch (err) {
               console.error(err.stack);
               sendError(
                  JSONRPC_ERRORS.ACTION_DISALLOWED,
                  "Could not update account balance.",
                  sessionObj
               );
               return false;
            }
         }
         break;
      default:
         throw new Error('Unrecognized penalty type "' + penaltyType + '".');
         break;
   }
   return penaltyReport;
}

/**
 * Returns the next deal object / action for a specified player from a list of
 * deals.
 *
 * @param {Array} dealsArray An indexed array of deal objects for a specific player
 * (usually the "select" initiator).
 * @param {String} fromPID The private ID of the player for which to get the next action
 * within the <code>dealsArray</code>.
 * @param {Number} actionIndex The numeric index (0-based), of the action to retrieve
 * for <code>fromPID</code> from within the <code>dealsArray</code>.
 *
 * @return {Object} The deal by <code>fromPID</code> matching the parameters
 * or <code>null</code> if none can be found.
 * @private
 */
function getNextDealAction(dealsArray, fromPID, actionIndex) {
   var actionCounter = 0;
   for (var count = 0; count < dealsArray.length; count++) {
      var currentDeal = dealsArray[count];
      if (currentDeal.fromPID == fromPID) {
         if (actionIndex == actionCounter) {
            return currentDeal;
         } else {
            actionCounter++;
         }
      }
   }
   return null;
}

/**
 * Compares two card decks of either plaintext mappings or encrypted
 * card values, regardless of their order.
 *
 * @param {Array} deckArr1 First array of numeric strings to compare.
 * @param {Array} deckArr2 Second array of numeric strings to compare.
 *
 * @return {Boolean} True if both decks have exactly the same elements (regardless of order),
 * false if there's a difference.
 * @private
 */
function compareDecks(deck1Arr, deck2Arr) {
   if (deck1Arr.length != deck2Arr.length) {
      return false;
   }
   var deck1 = Array.from(deck1Arr);
   var deck2 = Array.from(deck2Arr);
   while (deck1.length > 0) {
      var currentCard = deck1.splice(0, 1);
      var index = 0;
      while (index < deck2.length) {
         var compareCard = deck2[index];
         if (compareCard == currentCard) {
            deck2.splice(index, 1);
            break;
         }
         index++;
      }
   }
   if (deck2.length == 0) {
      //all unique matching elements removed from secondary array (all match)
      return true;
   }
   return false;
}

/**
 * Checks a card deck array for duplicate values.
 *
 * @param {Array} cardDeck Indexed array of values to examine.
 * @param {String} [valueProp=null] The value property of each array
 * element to examine (e.g. <code>mapping</code>). If omitted or <code>null</code>,
 * each element is examined directly.
 *
 * @return {Boolean} True if the <code>cardDeck</code> contains duplicate values,
 * otherwise false.
 * @private
 */
function containsDuplicates(cardDeck, valueProp = null) {
   var compareDeck = Array.from(cardDeck);
   var dupFound = false;
   cardDeck.forEach((value, index, arr) => {
      if (valueProp != null) {
         var cardValue = value[valueProp];
      } else {
         cardValue = value;
      }
      var matchCount = 0;
      compareDeck.forEach((cValue, cIndex, cArr) => {
         if (valueProp != null) {
            var compareValue = cValue[valueProp];
         } else {
            compareValue = cValue;
         }
         if (compareValue == cardValue) {
            matchCount++;
         }
         if (matchCount > 1) {
            dupFound = true;
         }
      });
   });
   return dupFound;
}

/**
 * Remove a set of items from a deck.
 *
 * @param {Array} removeItems Array of strings matching card values to remove
 * from <code>deckArr</code>
 * @param {Array} deckArr Array of strings matching card values and representing
 * a deck. Items found in <code>removeItems</code> will be removed directly
 * from this array.
 *
 * @return {Boolean} True if the correct number of items were removed from
 * <code>deckArr</code> (i.e. only one unique match for each value existed).
 * False is returned if the removed items don't match the expected set but
 * <code>deckArr</code> may still be modified.
 * @private
 */
function removeFromDeck(removeItems, deckArr) {
   var itemsToRemove = removeItems.length;
   var removedItems = new Array();
   for (var count = 0; count < removeItems.length; count++) {
      var count2 = 0;
      while (count2 < deckArr.length) {
         if (removeItems[count] == deckArr[count2]) {
            removedItems.push(deckArr.splice(count2, 1)[0]);
            //keep going in case there are duplicates
         } else {
            count2++;
         }
      }
   }
   if (removedItems.length == itemsToRemove) {
      return true;
   }
   return false;
}

/**
 * Returns all of the available, unordered 5-hand permutations for a set of supplied cards.
 *
 * @param {Array} cardsArr Values or {@link CypherPokerCard} instance for
 * which to produce permutatuions, up to a maximum of 7 elements.
 *
 * @return {Array} Each array element contains a unique 5-card permutation
 * from the input set. If there are less than 6 cards provided, only one
 * permutation is returned.
 * @private
 */
function createCardPermutations(cardsArr) {
   var permArray = new Array();
   if (cardsArr.length <= 5) {
      //only one hand permutation available
      permArray.push(cardsArr);
   } else if (cardsArr.length == 6) {
      //only private card 2 (index 1)
      permArray.push([
         cardsArr[1],
         cardsArr[2],
         cardsArr[3],
         cardsArr[4],
         cardsArr[5],
      ]);
      //only private card 1 (index 0)
      permArray.push([
         cardsArr[0],
         cardsArr[2],
         cardsArr[3],
         cardsArr[4],
         cardsArr[5],
      ]);
      //both private cards
      permArray.push([
         cardsArr[1],
         cardsArr[0],
         cardsArr[3],
         cardsArr[4],
         cardsArr[5],
      ]);
      permArray.push([
         cardsArr[1],
         cardsArr[2],
         cardsArr[0],
         cardsArr[4],
         cardsArr[5],
      ]);
      permArray.push([
         cardsArr[1],
         cardsArr[2],
         cardsArr[3],
         cardsArr[0],
         cardsArr[5],
      ]);
      permArray.push([
         cardsArr[1],
         cardsArr[2],
         cardsArr[3],
         cardsArr[4],
         cardsArr[0],
      ]);
   } else {
      //no private cards
      permArray.push([
         cardsArr[2],
         cardsArr[3],
         cardsArr[4],
         cardsArr[5],
         cardsArr[6],
      ]);
      //private card 1 (index 0)
      permArray.push([
         cardsArr[0],
         cardsArr[3],
         cardsArr[4],
         cardsArr[5],
         cardsArr[6],
      ]);
      permArray.push([
         cardsArr[2],
         cardsArr[0],
         cardsArr[4],
         cardsArr[5],
         cardsArr[6],
      ]);
      permArray.push([
         cardsArr[2],
         cardsArr[3],
         cardsArr[0],
         cardsArr[5],
         cardsArr[6],
      ]);
      permArray.push([
         cardsArr[2],
         cardsArr[3],
         cardsArr[4],
         cardsArr[0],
         cardsArr[6],
      ]);
      permArray.push([
         cardsArr[2],
         cardsArr[3],
         cardsArr[4],
         cardsArr[5],
         cardsArr[0],
      ]);
      //private card 2 (index 1)
      permArray.push([
         cardsArr[1],
         cardsArr[3],
         cardsArr[4],
         cardsArr[5],
         cardsArr[6],
      ]);
      permArray.push([
         cardsArr[2],
         cardsArr[1],
         cardsArr[4],
         cardsArr[5],
         cardsArr[6],
      ]);
      permArray.push([
         cardsArr[2],
         cardsArr[3],
         cardsArr[1],
         cardsArr[5],
         cardsArr[6],
      ]);
      permArray.push([
         cardsArr[2],
         cardsArr[3],
         cardsArr[4],
         cardsArr[1],
         cardsArr[6],
      ]);
      permArray.push([
         cardsArr[2],
         cardsArr[3],
         cardsArr[4],
         cardsArr[5],
         cardsArr[1],
      ]);
      //both private cards
      permArray.push([
         cardsArr[0],
         cardsArr[1],
         cardsArr[4],
         cardsArr[5],
         cardsArr[6],
      ]);
      permArray.push([
         cardsArr[0],
         cardsArr[3],
         cardsArr[1],
         cardsArr[5],
         cardsArr[6],
      ]);
      permArray.push([
         cardsArr[0],
         cardsArr[3],
         cardsArr[4],
         cardsArr[1],
         cardsArr[6],
      ]);
      permArray.push([
         cardsArr[0],
         cardsArr[3],
         cardsArr[4],
         cardsArr[5],
         cardsArr[1],
      ]);
      permArray.push([
         cardsArr[2],
         cardsArr[0],
         cardsArr[1],
         cardsArr[5],
         cardsArr[6],
      ]);
      permArray.push([
         cardsArr[2],
         cardsArr[0],
         cardsArr[4],
         cardsArr[1],
         cardsArr[6],
      ]);
      permArray.push([
         cardsArr[2],
         cardsArr[0],
         cardsArr[4],
         cardsArr[5],
         cardsArr[1],
      ]);
      permArray.push([
         cardsArr[2],
         cardsArr[3],
         cardsArr[0],
         cardsArr[1],
         cardsArr[6],
      ]);
      permArray.push([
         cardsArr[2],
         cardsArr[3],
         cardsArr[0],
         cardsArr[5],
         cardsArr[1],
      ]);
      permArray.push([
         cardsArr[2],
         cardsArr[3],
         cardsArr[4],
         cardsArr[0],
         cardsArr[1],
      ]);
   }
   return permArray;
}

/**
 * Returns a matching player object from a contract.
 *
 * @param {ContractObject} contract The contract within which to find the
 * player matching the <code>privateID</code>.
 * @param {String} privateID The private ID of the player to find within the
 * <code>contract</code>.
 *
 * @return {Object} The player object matching the parameters or <code>null</code>
 * if none can be found.
 * @private
 */
function getPlayer(contract, privateID) {
   for (var count = 0; count < contract.players.length; count++) {
      if (contract.players[count].privateID == privateID) {
         return contract.players[count];
      }
   }
   return null;
}

/**
 * Retrieves the next player after a specified one in a contract.
 *
 * @param {ContractObject} contract The contract to use to determine the next
 * player.
 * @param {String} privateID The private ID of the player preceding
 * the player to retrieve.
 * @param {Boolean} [allowFolded=true] If false, return only the next non-folded
 * player, otherwise return any next player.
 *
 * @return {Object} A player object or <code>null</code> if no matching
 * player private ID can be found in the contract.
 * @private
 */
function getNextPlayer(contract, privateID, allowFolded = true) {
   for (var count = 0; count < contract.players.length; count++) {
      if (contract.players[count].privateID == privateID) {
         var nextPlayer =
            contract.players[(count + 1) % contract.players.length];
         if (contract.players[count].folded && allowFolded == false) {
            nextPlayer = getNextPlayer(
               contract,
               nextPlayer.privateID,
               allowFolded
            );
         }
         return nextPlayer;
      }
   }
   return null;
}

/**
 * Retrieves the previous player after a specified one in a contract.
 *
 * @param {ContractObject} contract The contract to use to determine the previous
 * player.
 * @param {String} privateID The private ID of the player following
 * the player to retrieve.
 *
 * @return {Object} A player object or <code>null</code> if no matching
 * player private ID can be found in the contract.
 * @private
 */
function getPreviousPlayer(contract, privateID) {
   for (var count = 0; count < contract.players.length; count++) {
      if (contract.players[count].privateID == privateID) {
         if (count == 0) {
            return contract.players[contract.players.length - 1];
         } else {
            return contract.players[count - 1];
         }
      }
   }
   return null;
}

/**
 * Returns the player that is currently flagged as the dealer
 * in the associated contract's <code>players</code> array.
 *
 * @return {Object} The player instance that is flagged as a dealer.
 * <code>null</code> is returned if no dealer is flagged.
 * @private
 */
function getDealer(contract) {
   for (var count = 0; count < contract.players.length; count++) {
      if (contract.players[count].isDealer) {
         return contract.players[count];
      }
   }
   return null;
}

/**
 * Returns the player object that is currently flagged as the big blind
 * in a {@link ContractObject}.
 *
 * @param {ContractObject} contract The contract from which to extract the
 * big blind.
 *
 * @return {Object} The player object in the contract that
 * is flagged as a big blind. <code>null</code> is returned if no big blind
 * is flagged.
 * @private
 */
function getBigBlind(contract) {
   for (var count = 0; count < contract.players.length; count++) {
      if (contract.players[count].isBigBlind) {
         return contract.players[count];
      }
   }
   return null;
}

/**
 * Returns the player object that is currently flagged as the small blind
 * in a {@link ContractObject}.
 *
 * @param {ContractObject} contract The contract from which to extract the
 * big blind.
 *
 * @return {Object} The player object in the contract that
 * is flagged as a small blind. <code>null</code> is returned if no small blind
 * is flagged.
 * @private
 */
function getSmallBlind(contract) {
   for (var count = 0; count < contract.players.length; count++) {
      if (contract.players[count].isSmallBlind) {
         return contract.players[count];
      }
   }
   return null;
}

/**
 * Examines a {@link ContractObject} to determine the next player that should deal
 * according to it's deals <code>history</code>.
 *
 * @param {ContractObject} contract The contract to examine.
 *
 * @return {Object} A player object representing the player to deal next.
 * <code>null</code> is returned if the player can't be determined.
 * @private
 */
function getNextDealingPlayer(contract) {
   try {
      var longestDeal = 0;
      var currentDealerPID = "";
      for (var privateID in contract.history.deals) {
         if (contract.history.deals[privateID].length > longestDeal) {
            currentDealerPID = privateID;
            longestDeal = contract.history.deals[privateID].length;
         }
      }
      var nextDealer = getNextPlayer(contract, currentDealerPID);
      return nextDealer;
   } catch (err) {
      return null;
   }
}

/**
 * Finds players who have not completed a deal action within a specific contract.
 *
 * @param {ContractObject} contract The contract to look within.
 *
 * @return {Array} Array of player objects of players who have not completed
 * a deal action within the <code>contract</code>.
 * @private
 */
function getIncompletePlayers(contract) {
   var incompletePlayers = new Array();
   for (var privateID in contract.history.deals) {
      var deals = contract.history.deals[privateID];
      var numPlayers = contract.players.length;
      var numDeals = deals.length;
      if (numDeals / numPlayers != Math.floor(numDeals / numPlayers)) {
         var lastDeal = deals[deals.length - 1];
         incompletePlayers.push(getPlayer(contract, lastDeal.fromPID));
      } else {
         //current deal is complete
      }
   }
   return incompletePlayers;
}

/**
 * Returns the next player to bet based on information stored within
 * a contract and the private ID of the player who has just bet or folded.
 *
 * @param {ContractObject} contract The contract within which to look for the
 * next betting player.
 * @param {String} privateID The private ID of the player that has just bet
 * or folded.
 *
 * @return {Object} A reference to the next betting player object within
 * the <code>contract</code>, or <code>null</code> if one can't be determined.
 * @private
 */
function getNextBettingPlayer(contract, privateID) {
   var anyBetsPlaced = false; //during this round of betting?
   var largestPlayerBet = largestBet(contract);
   for (var count = 0; count < contract.players.length; count++) {
      var player = contract.players[count];
      if (player.hasBet == true && player.hasFolded == false) {
         anyBetsPlaced = true;
         break;
      }
   }
   var nextPlayer = getNextPlayer(contract, privateID);
   while (nextPlayer.privateID != privateID) {
      var nextTotalBet = bigInt(nextPlayer.totalBet);
      if (
         nextTotalBet.lesser(largestPlayerBet) &&
         nextPlayer.hasFolded == false
      ) {
         if (getBigBlind(contract).numActions > 0) {
            return nextPlayer;
         }
      }
      nextPlayer = getNextPlayer(contract, nextPlayer.privateID);
   }
   if (
      getBigBlind(contract).numActions < 2 &&
      getPreviousPlayer(contract, getBigBlind(contract).privateID).hasBet &&
      getBigBlind(contract).hasFolded == false
   ) {
      if (
         contract.players.length == 2 &&
         bigInt(getSmallBlind(contract).totalBet).lesser(
            bigInt(getBigBlind(contract).totalBet)
         )
      ) {
         return getSmallBlind(contract);
      } else {
         return getBigBlind(contract);
      }
   }
   //starting bets
   if (contract.players.length == 2) {
      //heads-up betting order
      if (
         publicCardsDeals(contract).length == 0 &&
         bettingDone(contract) == false
      ) {
         //pre-flop
         if (getDealer(contract).hasBet == false) {
            //dealer goes first
            return getDealer(contract);
         } else {
            return getNextPlayer(contract, getDealer(contract).privateID);
         }
      } else {
         //post-flop
         if (
            getNextPlayer(contract, getDealer(contract).privateID).hasBet ==
            false
         ) {
            //player goes first
            return getNextPlayer(contract, getDealer(contract).privateID);
         } else {
            return getDealer(contract);
         }
      }
   } else {
      //standard betting order
      var startingPlayer = getSmallBlind(contract);
      var firstNonFoldedPlayer = null;
      if (startingPlayer.hasFolded == false) {
         firstNonFoldedPlayer = startingPlayer;
         if (
            startingPlayer.hasBet == false ||
            bigInt(startingPlayer.totalBet).lesser(largestPlayerBet)
         ) {
            return startingPlayer;
         }
      }
      var startingID = startingPlayer.privateID;
      startingPlayer = getNextPlayer(contract, startingPlayer.privateID);
      while (startingPlayer.privateID != startingID) {
         if (startingPlayer.hasFolded == false) {
            if (firstNonFoldedPlayer == null) {
               firstNonFoldedPlayer = startingPlayer;
            }
            if (
               startingPlayer.hasBet == false ||
               bigInt(startingPlayer.totalBet).lesser(largestPlayerBet)
            ) {
               return startingPlayer;
            }
         }
         startingPlayer = getNextPlayer(contract, startingPlayer.privateID);
      }
      return firstNonFoldedPlayer;
   }
   return null;
}

/**
 * Updates the timeout for player(s) of a contract based on the action currently being
 * performed.
 *
 * @param {String} privateID The private ID of the player currently having just performed the <code>action</code>.
 * @param {String} sourcePID The private ID of the <code>action</code> source or origin (player that initiated the action chain).
 * @param {ContractObject} contract The contract instance associated with the <code>action</code>.
 * Each player's <code>updated</code> time may be updated.
 * @param {String} action The type of action being performed by the player. Valid actions are
 * "deal", "store" and "bet".
 * @param {String} [storeAction=null] The type of store action being performed if <code>action=="store"</code>.
 * Valid <code>storeType</code>s are "encrypt", "select", "decrypt", and "keychain".
 * If the action is not a "store", this parameter is ignored.
 * @param {Array} [storeArray=null] The array of values being stored if <code>action=="store"</code>.
 * If the action is not a "store", this parameter is ignored.
 *
 * @throws {Error} Thrown on an incorrect <code>action</code> or other errors.
 * @private
 */
function updatePlayersTimeout(
   privateID,
   sourcePID,
   contract,
   action,
   storeAction = null,
   storeArray = null
) {
   var date = new Date();
   var now = new Date();
   var timeout = contract.table.tableInfo.timeout;
   now = now.toISOString();
   var later = new Date();
   later.setSeconds(later.getSeconds() + timeout);
   later = later.toISOString();
   var morelater = new Date();
   morelater.setSeconds(morelater.getSeconds() + timeout);
   morelater = morelater.toISOString();
   if (action == "bet") {
      //reset all players to expire later
      for (var count = 0; count < contract.players.length; count++) {
         contract.players[count].updated = morelater;
      }
      var nextBettingPlayer = getNextBettingPlayer(contract, privateID);
      if (nextBettingPlayer != null) {
         nextBettingPlayer.updated = now;
      }
   } else if (action == "deal") {
      //reset all players to expire later
      for (var count = 0; count < contract.players.length; count++) {
         contract.players[count].updated = morelater;
      }
      var nextDealingPlayer = getNextDealingPlayer(contract);
      //nextDealingPlayer is dealing next
      nextDealingPlayer.updated = now;
   } else if (action == "store") {
      var incompletePlayers = getIncompletePlayers(contract);
      if (incompletePlayers.length > 0) {
         for (count = 0; count < incompletePlayers.length; count++) {
            incompletePlayers[count].updated = now;
         }
      } else {
         if (
            contract.players.length == 2 &&
            publicCardsDeals(contract).length == 0
         ) {
            nextBettingPlayer = getNextBettingPlayer(
               contract,
               getDealer(contract).privateID
            );
         } else {
            nextBettingPlayer = getNextBettingPlayer(
               contract,
               getBigBlind(contract).privateID
            );
         }
         if (nextBettingPlayer != null) {
            nextBettingPlayer.updated = now;
            //nextBettingPlayer is betting next
         }
      }
   } else if (action == "keychain") {
      getPlayer(contract, privateID).updated = now;
   } else {
      throw new Error('Unrecognized action "' + action + '"');
   }
}

/**
 * Returns a reference to a {@link CypherPokerCard} based on its mapping, as specified
 * in a specific contract.
 *
 * @param {ContractObject} contract The contract within which to look up the mapping.
 * This object's <code>cardDecks.faceup</code> property is used as the lookup reference.
 * @param {String} mapping The plaintext or face-up card mapping value to
 * find.
 *
 * @return {CypherPokerCard} The matching card instance or <code>null</code>
 * if none exists.
 * @private
 */
function getMappedCard(contract, mapping) {
   var referenceDeck = contract.cardDecks.faceup;
   for (var count = 0; count < referenceDeck.length; count++) {
      if (referenceDeck[count].mapping != undefined) {
         if (referenceDeck[count].mapping == mapping) {
            return referenceDeck[count];
         }
      } else {
         if (referenceDeck[count]._mapping == mapping) {
            return referenceDeck[count];
         }
      }
   }
   return null;
}

/**
 * Returns an array of completed public card deals for a specific contract.
 *
 * @param {ContractObject} contract The contract to analyze for completed public deals.
 *
 * @return {Array} An array of public / community card deals. Each element contains
 * a number representing the number of cards dealt in that deal. Elements should
 * be assumed to be out of order (e.g. a turn may appear after the river).
 * @private
 */
function publicCardsDeals(contract) {
   var cardsDealt = 0;
   var returnArr = new Array();
   for (var privateID in contract.history.deals) {
      var numActions = 0;
      for (
         var count = 0;
         count < contract.history.deals[privateID].length;
         count++
      ) {
         var currentDeal = contract.history.deals[privateID][count];
         if (
            currentDeal.private == false &&
            (currentDeal.type == "select" || currentDeal.type == "decrypt")
         ) {
            numActions++;
            if (numActions >= contract.players.length) {
               returnArr.push(currentDeal.cards.length);
               cardsDealt++;
               numActions = 0;
            }
         }
      }
   }
   return returnArr;
}

/**
 * Checks whether or not the private cards have been completely dealt (selected and decrypted),
 * for a specific player.
 *
 * @param {ContractObject} contract The contract to examine.
 * @param {String} privateID The privateID of the player to check for within the <code>contract</code>.
 *
 * @return {Boolean} True if all of the private cards for the specific player in the contract
 * <i>appear</i> to have been correctly dealt (selected and partially decrypted). False
 * in all other cases.
 * dealt.
 * @private
 */
function privateCardsDealt(contract, privateID) {
   if (
      contract.history.deals[privateID] == undefined ||
      contract.history.deals[privateID] == null
   ) {
      return false;
   }
   var returnArr = new Array();
   var numActions = 0;
   //should we check for the length and valid-looking contents of the cards array?
   for (
      var count = 0;
      count < contract.history.deals[privateID].length;
      count++
   ) {
      var currentDeal = contract.history.deals[privateID][count];
      if (
         currentDeal.private &&
         (currentDeal.type == "select" || currentDeal.type == "decrypt")
      ) {
         numActions++;
         if (numActions >= contract.players.length) {
            returnArr.push(currentDeal.cards.length);
            return returnArr;
         }
      }
   }
   return returnArr;
}

/**
 * Finds the largest bet within a contract by any non-folded player.
 *
 * @param {ContractObject} contract The contract within which to look for
 * the largest bet/
 *
 * @return {BigInteger} The largest bet currently placed by
 * a non-folded player at the table.
 * @private
 */
function largestBet(contract) {
   var largestBet = bigInt(0);
   for (var count = 0; count < contract.players.length; count++) {
      if (
         largestBet.compare(bigInt(contract.players[count].totalBet)) == -1 &&
         contract.players[count].hasFolded == false
      ) {
         largestBet = bigInt(contract.players[count].totalBet);
      }
   }
   return largestBet;
}

/**
 * Examines a contract to see if betting has completed.
 *
 * @param {ContractObject} contract The contract to examine.
 *
 * @return {Boolean} True if all non-folded players have committed the same
 * bet amount, or if all players but one have folded (new cards may be dealt or the game has completed).
 * @private
 */
function bettingDone(contract) {
   var foldedPlayers = 0;
   var nonFoldedPlayers = 0;
   var currentBet = "";
   var betGroups = new Object(); //players grouped by bet amount
   if (
      getBigBlind(contract).numActions < 2 &&
      getBigBlind(contract).hasFolded == false
   ) {
      return false;
   }
   for (var count = 0; count < contract.players.length; count++) {
      if (contract.players[count].hasFolded) {
         foldedPlayers++;
      } else {
         nonFoldedPlayers++;
         if (contract.players[count].hasBet) {
            currentBet = contract.players[count].totalBet;

            if (betGroups[currentBet] == undefined) {
               betGroups[currentBet] = new Array();
            }
            betGroups[currentBet].push(contract.players[count]);
         }
      }
   }
   if (betGroups[currentBet] != undefined) {
      if (betGroups[currentBet].length == nonFoldedPlayers) {
         return true;
      }
   }
   return false;
}

/**
 * Retrieves an indexed array of game contract objects for a contract owner.
 *
 * @param {String} ownerPID The private ID of the owner for which to retrieve currently active
 * smart contracts.
 *
 * @return {Array} An indexed list of {@link ContractObject} instances registered the <code>privateID</code>. If none
 * are registered, an empty array is returned.
 * @private
 */
function getContractsByPID(ownerPID) {
   if (namespace.cp.contracts == undefined || namespace.cp.contracts == null) {
      //create contracts container
      namespace.cp.contracts = new Object();
   }
   if (
      namespace.cp.contracts[ownerPID] == null ||
      namespace.cp.contracts[ownerPID] == undefined ||
      namespace.cp.contracts[ownerPID] == ""
   ) {
      //create a new container
      namespace.cp.contracts[ownerPID] = new Array();
   }
   return namespace.cp.contracts[ownerPID];
}

/**
 * Retrieves a contract by its ID and its owner's private ID.
 *
 * @param {String} ownerPID The private ID of the contract owner.
 * @param {String} contractID The contract ID of the contract to retrieve.
 *
 * @return {ContractObject} The contract object matching the parameters or <code>null</code>
 * if none can be found.
 * @private
 */
function getContractByID(ownerPID, contractID) {
   var contractsArr = namespace.cp.getContractsByPID(ownerPID);
   if (contractsArr.length == 0) {
      return null;
   }
   for (var count = 0; count < contractsArr.length; count++) {
      var currentContract = contractsArr[count];
      if (currentContract.contractID == contractID) {
         return currentContract;
      }
   }
   return null;
}

/**
 * Examines an object for required contract properties.
 *
 * @param {ContractObject} obj The expected contract object to examine.
 * @param {String} privateID The private ID of the contract creator / owner.
 * @param {AccountObject} accountObj A valid account object to include
 * in the <code>obj.players</code> array as an <code>account</code> property
 * for the contract owner / creator. The existence of this object can be used to
 * determine if a player has agree to the contract (otherwise it will be
 * <code>null</code> or <code>undefined</code>).
 *
 * @return {Boolean} True if the object appears to be a valid contract object,
 * false otherwise.
 * @private
 */
function validContractObject(obj, privateID, accountObj) {
   //check to make sure all required contract parameters are there:
   if (typeof obj != "object") {
      return false;
   }
   if (
      obj.contractID == undefined ||
      obj.contractID == null ||
      obj.contractID == ""
   ) {
      return false;
   }
   if (
      obj.contractID == undefined ||
      obj.contractID == null ||
      obj.contractID == ""
   ) {
      return false;
   }
   if (validTableObject(obj.table) == false) {
      return false;
   }
   if (obj.players == undefined || obj.players == null || obj.players == "") {
      return false;
   }
   if (typeof obj.players != "object") {
      return false;
   }
   if (typeof obj.players.length != "number") {
      return false;
   }
   if (obj.players.length < 2) {
      return false;
   }
   var numAgreed = 0;
   for (var count = 0; count < obj.players.length; count++) {
      var player = obj.players[count];
      if (
         player.privateID == null ||
         player.privateID == undefined ||
         player.privateID == ""
      ) {
         player.privateID = player._privateID;
      }
      if (
         player.privateID == null ||
         player.privateID == undefined ||
         player.privateID == ""
      ) {
         return false;
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
      }
      if (
         player.totalBet == undefined ||
         player.totalBet == null ||
         player.totalBet == ""
      ) {
         player.totalBet = "0";
      }
      if (typeof player.hasBet != "boolean") {
         player.hasBet = false;
      }
      if (typeof player.hasFolded != "boolean") {
         player.hasFolded = false;
      }
      if (typeof player.numActions != "number") {
         player.numActions = 0;
      }
   }
   if (numAgreed > 1) {
      return false;
   }
   if (typeof obj.prime != "string") {
      return false;
   }
   if (obj.prime.length == 0) {
      return false;
   }
   if (typeof obj.cardDecks != "object") {
      return false;
   }
   if (typeof obj.cardDecks.faceup != "object") {
      return false;
   }
   //contract creation includes submission of face-up (generated) cards:
   if (obj.cardDecks.faceup.length < 52) {
      return false;
   }
   //... but not other values:
   if (typeof obj.cardDecks.facedown != "object") {
      return false;
   }
   if (typeof obj.cardDecks.public != "object") {
      return false;
   }
   if (typeof obj.cardDecks.facedown.length != "number") {
      return false;
   }
   if (typeof obj.cardDecks.dealt != "object") {
      return false;
   }
   if (typeof obj.cardDecks.dealt.length != "number") {
      return false;
   }
   if (typeof obj.cardDecks.public.length != "number") {
      return false;
   }
   return true;
}

/**
 * Evaluates a provided object to determine if it's a valid table object.
 *
 * @param {TableObject} tableObj The object to examine.
 *
 * @return {Boolean} True if the supplied parameter has a valid {@link TableObject}
 * structure, false otherwise.
 * @private
 */
function validTableObject(tableObj) {
   if (tableObj == undefined || tableObj == undefined) {
      return false;
   }
   if (typeof tableObj.ownerPID != "string") {
      return false;
   }
   if (tableObj.ownerPID == "") {
      return false;
   }
   if (typeof tableObj.tableID != "string") {
      return false;
   }
   if (tableObj.tableID == "") {
      return false;
   }
   if (typeof tableObj.tableName != "string") {
      return false;
   }
   if (tableObj.tableName == "") {
      return false;
   }
   if (typeof tableObj.requiredPID != "object") {
      return false;
   }
   if (typeof tableObj.requiredPID.length != "number") {
      return false;
   }
   //all players should now have joined the table
   if (tableObj.requiredPID.length > 0) {
      return false;
   }
   if (typeof tableObj.joinedPID != "object") {
      return false;
   }
   if (typeof tableObj.joinedPID.length != "number") {
      return false;
   }
   if (tableObj.joinedPID.length < 2) {
      return false;
   }
   if (typeof tableObj.restorePID != "object") {
      return false;
   }
   if (typeof tableObj.restorePID.length != "number") {
      return false;
   }
   if (tableObj.restorePID.length != tableObj.joinedPID.length) {
      return false;
   }
   for (var count = 0; count < tableObj.requiredPID.length; count++) {
      if (
         typeof tableObj.requiredPID[count] != "string" ||
         tableObj.requiredPID[count] == ""
      ) {
         return false;
      }
   }
   if (typeof tableObj.joinedPID[0] != "string") {
      return false;
   }
   if (tableObj.joinedPID[0] != tableObj.ownerPID) {
      return false;
   }
   if (typeof tableObj.tableInfo != "object") {
      return false;
   }
   try {
      //buyIn, bigBlind, and smallBlind musst be valid positive integer values
      if (
         typeof tableObj.tableInfo.buyIn != "string" ||
         tableObj.tableInfo.buyIn == "" ||
         tableObj.tableInfo.buyIn == "0"
      ) {
         return false;
      }
      var checkAmount = bigInt(tableObj.tableInfo.buyIn);
      if (checkAmount.lesser(0)) {
         return false;
      }
      if (
         typeof tableObj.tableInfo.bigBlind != "string" ||
         tableObj.tableInfo.bigBlind == "" ||
         tableObj.tableInfo.bigBlind == "0"
      ) {
         return false;
      }
      checkAmount = bigInt(tableObj.tableInfo.bigBlind);
      if (checkAmount.lesser(0)) {
         return false;
      }
      if (
         typeof tableObj.tableInfo.smallBlind != "string" ||
         tableObj.tableInfo.smallBlind == "" ||
         tableObj.tableInfo.smallBlind == "0"
      ) {
         return false;
      }
      checkAmount = bigInt(tableObj.tableInfo.smallBlind);
      if (checkAmount.lesser(0)) {
         return false;
      }
   } catch (err) {
      return false;
   }
   return true;
}

/**
 * Evaluates a provided object to determine if it's a valid account object and
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
 * @private
 * @async
 */
async function validAccount(accountObj, checkCredentials = true) {
   if (accountObj == undefined || accountObj == null) {
      return false;
   }
   if (typeof accountObj.address != "string") {
      return false;
   }
   if (accountObj.address == "") {
      return false;
   }
   if (typeof accountObj.type != "string") {
      return false;
   }
   if (accountObj.type == "") {
      return false;
   }
   if (typeof accountObj.network != "string") {
      return false;
   }
   if (accountObj.network == "") {
      return false;
   }
   if (typeof accountObj.password != "string") {
      return false;
   }
   if (accountObj.password == "") {
      return false;
   }
   var accountResult = null;
   var searchObj = new Object();
   //don't include (potentially incorrect) balance and (unhashed) password!
   searchObj.address = accountObj.address;
   searchObj.type = accountObj.type;
   searchObj.network = accountObj.network;
   accountResult = await namespace.cp.getAccount(searchObj);
   if (accountResult.length < 1) {
      throw new Error("No matching account.");
   }
   if (checkCredentials) {
      var pwhash = accountResult[0].pwhash;
      if (namespace.cp.checkPassword(accountObj.password, pwhash) == false) {
         throw new Error("Wrong password.");
      }
   }
   return accountResult;
}

/**
 * Resets all player (not account) balances to 0 within a specific contract object.
 *
 * @param {ContractObject} contractObj The contract within which to reset all players'
 * balances.
 *
 * @private
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
 * @param {ContractObject} contractObj The contract within which to set the player's
 * balance.
 * @param {String} privateID The private ID of the player to update.
 * @param {String|Number} balance The balance amount to set.
 *
 * @private
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
 * Cancels a contract by immediately refunding the balances of all registered players
 * and then removing the contract. And pot balance of the contract is destroyed with
 * the contract.
 *
 * @param {ContractObject} contractObj The contract to cancel.
 *
 * @private
 * @async
 */
async function cancelContract(contractObj) {
   for (var count = 0; count < contractObj.players.length; count++) {
      var player = contractObj.players[count];
      if (player.account != null) {
         var balance = player.balance;
         var searchObj = new Object();
         searchObj.address = player.account.address;
         searchObj.type = player.account.type;
         searchObj.network = player.account.network;
         if (bigInt(balance).greater(0)) {
            try {
               var accountResults = await namespace.cp.getAccount(searchObj);
               var updateResult = await addToAccountBalance(
                  accountResults[0],
                  balance
               );
            } catch (err) {
               console.error("Couldn't refund cancelled contract.");
               console.error("   Contract ID: " + contractObj.contractID);
               console.error(
                  "   Number of players: " + contractObj.players.length
               );
               console.error("   Account: " + player.account.address);
               console.error("   Balance: " + balance);
            }
         }
      }
   }
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
 * <code>players</code> array will be searched and the player matching the <code>accountRow</code>
 * will have their balance updated with a negative <code>balanceInc</code>. In other words,
 * if <code>balanceInc</code> is negative (a withdrawal from the account), then
 * the update to the <code>contract.players</code> array will be positive
 * (a deposit to the contract).
 *
 * @return {Promise} The promise will resolve with the new account balance (String) if the account
 * was successfully updated. An <code>Error</code> object will be included with a rejection.
 * @private
 * @async
 */
async function addToAccountBalance(accountRow, balanceInc, contract = null) {
   var currentBalance = bigInt(accountRow.balance);
   var balanceUpdate = bigInt(balanceInc);
   currentBalance = currentBalance.plus(balanceUpdate);
   if (currentBalance.lesser(0)) {
      throw new Error("Insufficient account balance to continue.");
   }
   //update database
   accountRow.balance = currentBalance.toString(10);
   accountRow.updated = namespace.cp.MySQLDateTime(new Date());
   var result = await namespace.cp.saveAccount(accountRow);
   if (result != true) {
      throw new Error("Couldn't update account.");
   }
   //update contract
   if (contract != null) {
      for (var count = 0; count < contract.players.length; count++) {
         var currentPlayer = contract.players[count];
         if (
            typeof currentPlayer.account == "object" &&
            currentPlayer.account != null
         ) {
            var account = currentPlayer.account;
            if (account != null) {
               if (
                  account.address == accountRow.address &&
                  account.type == accountRow.type &&
                  account.network == accountRow.network
               ) {
                  account.balance = bigInt(account.balance)
                     .minus(balanceUpdate)
                     .toString(10);
                  return accountRow.balance;
               }
            }
         }
      }
      throw new Error("Couldn't find account in contract.");
   }
   return currentBalance.toString(10);
}

/**
 * SRA encrypts a value using a keypair object.
 *
 * @param {Object} keypair The keypair object to use for the encryption.
 * This object must contain a valid <code>encKey</code> and <code>prime</code>.
 * @param {String} encValue A hexadecimal numeric string (staring with "0x"), or
 * decimal numeric string representing the value to encrypt.
 *
 * @return {String} The encrypted value as either a hexadecimal string or
 * decimal string, depending on the representation of <code>encValue</code>.
 * @private
 */
function SRAEncrypt(keypair, encValue) {
   if (keypair.encKey.startsWith("0x")) {
      var encKey = keypair.encKey.substring(2);
      var prime = keypair.prime.substring(2);
      var keyRadix = 16;
   } else {
      encKey = keypair.encKey;
      prime = keypair.prime;
      keyRadix = 10;
   }
   if (encValue.startsWith("0x")) {
      var value = encValue.substring(2);
      var valueRadix = 16;
   } else {
      value = encValue;
      valueRadix = 10;
   }
   var message = bigInt(value, valueRadix);
   var key = bigInt(encKey, keyRadix);
   var prime = bigInt(prime, keyRadix);
   var result = message.modPow(key, prime); //this is where the encryption happens
   if (valueRadix == 16) {
      return "0x" + result.toString(valueRadix);
   } else {
      return result.toString(valueRadix);
   }
}

/**
 * SRA decrypts a value using a keypair object.
 *
 * @param {Object} keypair The keypair object to use for the encryption.
 * This object must contain a valid <code>decKey</code> and <code>prime</code>.
 * @param {String} decValue A hexadecimal numeric string (staring with "0x"), or
 * decimal numeric string representing the value to decrypt.
 *
 * @return {String} The decrypted value as either a hexadecimal string or
 * decimal string, depending on the representation of <code>decValue</code>.
 * @private
 */
function SRADecrypt(keypair, decValue) {
   if (keypair.decKey.startsWith("0x")) {
      var decKey = keypair.decKey.substring(2);
      var prime = keypair.prime.substring(2);
      var keyRadix = 16;
   } else {
      decKey = keypair.decKey;
      prime = keypair.prime;
      keyRadix = 10;
   }
   if (decValue.startsWith("0x")) {
      var value = decValue.substring(2);
      var valueRadix = 16;
   } else {
      value = decValue;
      valueRadix = 10;
   }
   var message = bigInt(value, valueRadix);
   var key = bigInt(decKey, keyRadix);
   var prime = bigInt(prime, keyRadix);
   var result = message.modPow(key, prime); //this is where the decryption happens
   if (valueRadix == 16) {
      return "0x" + result.toString(valueRadix);
   } else {
      return result.toString(valueRadix);
   }
}

/**
 * Notifies the players associated with a contract of a change to the contract.
 *
 * @param {String} messageType The message type of the notification (e.g. "contractnew")
 * @param {Object} contractObj The contract to notify players about.
 * @param {Object} fromPID The sender's private ID.
 * @param {Array} [excludePIDs=null] The private IDs to exclude from the notification.
 * The <code>fromPID</code> parameter is automatically included.
 * @param {Object} [payload=null] An object containing properties to include in
 * the notification. Standard properties <code>data</code>, <code>from</code>, and
 * <code>type</code> will be ignored.
 *
 * @private
 */
function sendContractMessage(
   messageType,
   contractObj,
   fromPID,
   excludePIDs = null,
   payload = null
) {
   var recipients = new Array();
   if (excludePIDs == null) {
      excludePIDs = new Array();
   }
   excludePIDs.push(fromPID);
   contractObj.players.forEach((currentPlayer, index, arr) => {
      if (excludePIDs != null) {
         for (count = 0; count < excludePIDs.length; count++) {
            if (excludePIDs[count] == currentPlayer.privateID) {
               return;
            }
         }
      }
      recipients.push(currentPlayer.privateID);
   });
   var messageObj = namespace.cp.buildCPMessage(messageType);
   if (payload != null) {
      for (var item in payload) {
         //exclude standard properties
         if (item != "data" && item != "from" && item != "type") {
            messageObj[item] = payload[item];
         }
      }
   }
   messageObj.contract = contractObj;
   namespace.wss.sendUpdate(recipients, messageObj, fromPID);
}

/**
 * Handles a WebSocket close / disconnect event and notifies all active / live
 * sessions of the disconnection.
 *
 * @param {Event} event A standard WebSocket close event.
 * @private
 */
function handleWebSocketClose(event) {
   try {
      for (var connectionID in namespace.wss.connections) {
         if (
            namespace.wss.connections[connectionID] != undefined &&
            namespace.wss.connections[connectionID] != null
         ) {
            for (
               var count = 0;
               count < namespace.wss.connections[connectionID].length;
               count++
            ) {
               var connectionObj =
                  namespace.wss.connections[connectionID][count];
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

namespace.cp.getContractsByPID = getContractsByPID;
