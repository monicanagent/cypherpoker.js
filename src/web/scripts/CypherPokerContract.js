/**
* @file A virtual smart contract implementation using a WebSocket Session
* service as a TTP host.
*
* @version 0.1.0
* @author Patrick Bay
* @copyright MIT License
*/

/**
* @class A virtual smart contract interface for an associated {@link CypherPokerGame}
* instance. Communicates with a WebSocket Session TTP service instead of directly
* with a smart contract front-end.
*
* @extends EventDispatcher
*/
class CypherPokerContract extends EventDispatcher {

   /**
   * Creates a new proxy contract instance.
   *
   * @param {CypherPokerGame} gameRef The active game instance with which
   * this contract interface is associated.
   */
   constructor(gameRef) {
      super();
      this._game = gameRef;
      this.addGameEventListeners();
   }

   /**
   * @property {CypherPokerGame} game Reference to the associated game for
   * which to act as contract handler.
   */
   get game() {
      return (this._game);
   }

   /**
   * @property {CypherPoker} cypherpoker A reference to the
   * {@link CypherPokerContract#game}'s <code>cypherpoker</code> instance or
   * <code>null</code> if none exists.
   */
   get cypherpoker() {
      if ((this._game != null) && (this._game != undefined)) {
         return (this._game.cypherpoker);
      }
      return (null);
   }

   /**
   * @property {Boolean} ready=false Indicates whether or not the contract is
   * ready (has been successfully remotely created).
   */
   get ready() {
      if (this.contractID == null) {
         return (false);
      }
      //other validity tests can be done here
      return (true);
   }

   /**
   * @property {String} contractID=null The ID of the contract instance, usually
   * as returned by the remote contract host.
   */
   get contractID() {
      if (this._contractID == undefined) {
         this._contractID = null;
      }
      return (this._contractID);
   }

   /**
   * @property {Array} history=null Indexed array of external contract snapshots
   * with index 0 being the most recent.
   */
   get history() {
      if (this._history == undefined) {
         this._history = new Array();
      }
      return (this._history);
   }

   /**
   * Adds event listeners required by the contract handler to the associated
   * {@link CypherPokerContract#game} instance.
   *
   * @private
   */
   addGameEventListeners() {
      this.game.addEventListener("gamedeck", this.onNewGameDeck, this);
      this.cypherpoker.p2p.addEventListener("update", this.handleUpdateMessage, this);
   }

   /**
   * Removes event listeners required by the contract handler from the associated
   * {@link CypherPokerContract#game} instance.
   *
   */
   removeGameEventListeners() {
      this.game.removeEventListener("gamedeck", this.onNewGameDeck);
      this.cypherpoker.p2p.removeEventListener("update", this.handleUpdateMessage);
   }

   /**
   * Creates a snapshot (copy) of the associated {@link CypherPokerContract#game} instance's
   * current data in the format of a contract data object for use as a condition in subsequent
   * contract actions.
   */
   gameSnapshot() {
      var snapshot = new Object();
      snapshot.players = this.game.getPlayers(false, false);
      snapshot.table = this.game.getTable();
      try {
         snapshot.prime = this.game.getPlayer(this.game.ownPID).keychain[0].prime;
      } catch (err) {
         snapshot.prime = null;
      }
      snapshot.cardDecks = this.game.getCardDecks();
      return (snapshot);
   }

   /**
   * Recursively compares two objects for matching properties.
   *
   * @param {Object} obj1 The first object to compare.
   * @param {Object} obj2 The second object to compare.
   *
   * @return {Boolean} True if all properties found in <code>obj1</code> appear
   * in <code>obj2</code>, false otherwise.
   */
   compareObjects (obj1, obj2) {
      if ((obj1 == null) && (obj2 == null)) {
         return (true);
      }
      var obj1Entries = Object.entries(obj1);
      for (var count=0; count < obj1Entries.length; count++) {
         try {
            var key = obj1Entries[count][0];
            if (typeof(obj1[key]) == "object") {
               //recurse compare sub-objects
               if (this.compareObjects(obj1[key], obj2[key]) == false) {
                  return (false);
               }
            } else {
               //compare primitives
               if (obj1[key] != obj2[key]) {
                  console.log ("Mismatch on "+key);
                  return (false);
               }
            }
         } catch (err) {
            console.log (err);
            return (false);
         }
      }
      return (true);
   }

   /**
   * Compares a contract data object to a game snapshot object.
   *
   * @param {Object} contract The (usually) external contract data object to compare.
   * @param {Object} snapshot The game snapshot object to compare to the <code>contract</code>.
   * This object must have the same structure as the contract data object.
   *
   * @return (Number) If the <code>contract</code> appears to be ahead of the snapshot 1
   * is returned. If the <code>snapshot</code> appears to be ahead of the contract 2 is
   * returned. If the contract appears the same as the snapshot but not in the same order
   * (e.g. facedown cards), then 3 is returned. If both contract and snapshot are identical,
   * 0 is returned.
   * @throws {Error} If the expected structure or data of the parameters does not match.
   */
   compare(contract, snapshot) {
      console.log("****************************");
      if (this.compareObjects(contract.table, snapshot.table) == false) {
         throw (new Error("Table properties don't match."));
      }
      console.log("****************************");
      console.log ("contract.prime="+contract.prime);
      console.log ("snapshot.prime="+snapshot.prime);
      if ((contract.prime != null) && (snapshot.prime == null)) {
         console.log("prime mismatch");
         return (1);
      } else if ((contract.prime == null) && (snapshot.prime != null)) {
         console.log("prime mismatch");
         return (2);
      } else if (contract.prime != snapshot.prime) {
         throw (new Error("Prime value mismatch."));
      }
      //compare decks
      console.dir(contract.cardDecks.faceup);
      result = this.compareDecks(contract.cardDecks.faceup, snapshot.cardDecks.faceup, "_mapping");
      if (result != 0) {
         console.log("faceup mismatch");
         return (result);
      }
      result = this.compareDecks(contract.cardDecks.facedown, snapshot.cardDecks.facedown);
      if (result != 0) {
         console.log("facedown mismatch");
         return (result);
      }
      result = this.compareDecks(contract.cardDecks.dealt, snapshot.cardDecks.dealt);
      if (result != 0) {
         console.log("dealt mismatch");
         return (result);
      }
      result = this.compareDecks(contract.cardDecks.public, snapshot.cardDecks.public, "_mapping");
      if (result != 0) {
         console.log("public mismatch");
         return (result);
      }
      //compare players
      for (var count = 0; count < contract.players.length; count++) {
         var contractPlayer = contract.players[count];
         var snapshotPlayer = snapshot.players[count];
         if (contractPlayer.privateID != snapshotPlayer.privateID) {
            //player order must be the same
            throw (new (Error("Incorrect player private ID at position "+count)));
         }
         for (var prop in contractPlayer.info) {
            if (snapshotPlayer.info[prop] != contractPlayer.info[prop]) {
               throw (new (Error("Incorrect player private info property \""+prop+"\"")));
            }
         }
         //compare player dealt cards
         var result = this.compareDecks(contractPlayer.dealtCards, snapshotPlayer.dealtCards, "_mapping");
         if (result != 0) {
            console.log("player dealt mismatch");
            return (result);
         }
         //compare player selected cards
         result = this.compareDecks(contractPlayer.selectedCards, snapshotPlayer.selectedCards);
         if (result != 0) {
            console.log("player selected mismatch");
            return (result);
         }
         if (contractPlayer.hasBet && (snapshotPlayer.hasBet == false)) {
            console.log("player hasBet mismatch");
            return (1);
         } else if ((contractPlayer.hasBet == false) && snapshotPlayer.hasBet) {
            console.log("player hasBet mismatch");
            return (2);
         }
         if (contractPlayer.hasFolded && (snapshotPlayer.hasFolded == false)) {
            console.log("player hasFolded mismatch");
            return (1);
         } else if ((contractPlayer.hasFolded == false) && snapshotPlayer.hasFolded) {
            console.log("player hasFolded mismatch");
            return (2);
         }
         if (contractPlayer.isDealer != snapshotPlayer.isDealer) {
            throw (new Error("Player role mismatch on dealer."));
         }
         if (contractPlayer.isSmallBlind != snapshotPlayer.isSmallBlind) {
            throw (new Error("Player role mismatch on small blind."));
         }
         if (contractPlayer.isBigBlind != snapshotPlayer.isBigBlind) {
            throw (new Error("Player role mismatch on big blind."));
         }
         if (contractPlayer.ready != snapshotPlayer.ready) {
            throw (new Error("Player ready mismatch."));
         }
         contractPlayer.totalBet = bigInt(contractPlayer.totalBet);
         snapshotPlayer.totalBet = bigInt(snapshotPlayer.totalBet);
         if (contractPlayer.totalBet.greater(snapshotPlayer.totalBet)) {
            console.log("player totalBet mismatch");
            return (1);
         } else if (snapshotPlayer.totalBet.greater(contractPlayer.totalBet)) {
            console.log("player totalBet mismatch");
            return (2);
         }
         //balance comparison is the inverse of totalBet comparison
         contractPlayer.balance = bigInt(contractPlayer.balance);
         snapshotPlayer.balance = bigInt(snapshotPlayer.balance);
         if (contractPlayer.balance.greater(snapshotPlayer.balance)) {
            console.log("player balance mismatch");
            return (2);
         } else if (snapshotPlayer.balance.greater(contractPlayer.balance)) {
            console.log("player balance mismatch");
            return (1);
         }
      }
      //relevant contract properties match snapshot properties
      return (0);
   }

   /**
   * Compares a contract card deck against a snapshot card deck.
   *
   * @param {Array} contractDeck Indexed list of contract cards to examine.
   * @param {Array} snapshotDeck Indexed list of snapshot cards to examine.
   * @param {String} [valueProp=null] If supplied, each deck's element is assumed
   * to be a complex object and this is its value property (e.g. <code>mapping</code>).
   * If omitted or <code>null</code>, elements are compared directly with each other.
   *
   * @return {Number} A 0 is returned if both decks are identical: same values and array
   * lengths (though their order may be different). A 1 is returned if the contract deck
   * has more elements than than the snapshot deck, and 2 is returned if the snapshot deck
   * has more elements than the contract deck.
   *
   * @throws {Error} Thrown when a deck contains one or more elements that should appear
   * in the other deck but don't, or if a deck contains duplicate elements.
   * @private
   */
   compareDecks(contractDeck, snapshotDeck, valueProp=null) {
      if (this.containsDuplicates(contractDeck, valueProp) == true) {
         throw (new Error("Contract deck contains duplicates."));
      }
      if (this.containsDuplicates(snapshotDeck, valueProp) == true) {
         throw (new Error("Snapshot deck contains duplicates."));
      }
      var numMatches = 0;
      contractDeck.forEach((value, index, arr) => {
         if (valueProp != null) {
            var contractValue = value[valueProp];
         } else {
            contractValue = value;
         }
         for (var count=0; count < snapshotDeck.length; count++) {
            if (valueProp != null) {
               var snapshotValue = snapshotDeck[count][valueProp];
            } else {
               snapshotValue = snapshotDeck[count];
            }
            if (snapshotValue == contractValue) {
               numMatches++;
            }
         }
      });
      if (contractDeck.length > snapshotDeck.length) {
         if (numMatches == snapshotDeck.length) {
            return (1);
         } else {
            throw (new Error("Mismatched deck elements."));
         }
      } else if (contractDeck.length < snapshotDeck.length) {
         if (numMatches == snapshotDeck.length) {
            return (2);
         } else {
            throw (new Error("Mismatched deck elements."));
         }
      } else if (contractDeck.length == snapshotDeck.length) {
         if (numMatches != contractDeck.length) {
            //decks are same length but not all elements match
            throw (new Error("Mismatched deck elements."));
         }
      }
      //decks are identical (no duplications, same length)
      return (0);
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
   containsDuplicates(cardDeck, valueProp=null) {
      var compareDeck = Array.from(cardDeck);
      var dupFound = false;
      cardDeck.forEach((value,index,arr) => {
         if (valueProp != null) {
            var cardValue = value[valueProp];
         } else {
            cardValue = value;
         }
         var matchCount = 0;
         compareDeck.forEach((cValue,cIndex,cArr) => {
            if (valueProp != null) {
               var compareValue = cValue[valueProp];
            } else {
               compareValue = cValue;
            }
            if (compareValue == cardValue) {
               matchCount++;
            }
            if (matchCount > 1) {
               console.log ("Duplicate value: "+compareValue);
               dupFound = true;
            }
         });
      });
      return (dupFound);
   }

   /**
   * Event handler invoked a new game deck is fully generated. This triggers
   * the asynchronous creation and / or initialization of a new contract for
   * the game.
   *
   * @param {CypherPokerGame#event:gamedeck} event A "gamedeck" event.
   */
   onNewGameDeck(event) {
      if (this.game.getDealer().privateID == this.game.ownPID) {
         //dealer creates the new contract; other players only agree to it
         var paramsObj = new Object();
         paramsObj.contract = new Object();
         //is there a better way to create the contract ID?
         this._contractID = String(Math.random()).split(".")[1];
         paramsObj.contract.contractID = this._contractID;
         paramsObj.contract.players = this.game.getPlayers(false, false);
         paramsObj.contract.table = this.game.table;
         paramsObj.contract.prime = this.game.getDealer().keychain[0].prime; //prime generated by us
         paramsObj.contract.cardDecks = this.game.cardDecks;
         this.callContractAPI("new", paramsObj).then(JSONResult => {
            if (this.contractID != JSONResult.result.contract.contractID) {
               console.error("Expecting contract ID \""+this.contractID+"\", got \""+JSONResult.result.contract.contractID+"\"");
               console.dir(JSONResult);
               throw(new Error("Unexpected contract ID returned."));
            }
            try {
               this.updateBalances(JSONResult.result.contract);
            } catch (err) {
               console.error(err);
            }
         }).catch (err => {
            this.game.debug(err, "err");
         });
      } else {

      }
   }

   /**
   * Updates the balances of the associated {@link CypherPokerContract#game} instance's
   * players from a provided contract data object.
   *
   * @param {Object} contractData The contract data object to use to update
   * player balances.
   */
   updateBalances(contractData) {
      var players = contractData.players;
      for (var count = 0; count < players.length; count++) {
         var player = players[count];
         var privateID = player.privateID;
         if ((typeof(player.balance) == "string") || (typeof(player.balance) == "number")) {
            this.game.getPlayer(privateID).balance = player.balance;
         } else {
            throw (new Error("Player game balance for \""+privateID+"\" is the wrong type."));
         }
         if ((typeof(player.account) == "object") && (player.account != null)) {
            if ((typeof(player.account.balance) == "string") || (typeof(player.account.balance) == "number")) {
               this.game.getPlayer(privateID).account.balance = player.account.balance;
            } else {
               throw (new Error("Player account balance for \""+player.account.address+"\" is the wrong type."));
            }
         }
      }
   }

   /**
   * Asynchronously calls the contract API and returns the JSON-RPC 2.0 result / error
   * of the call.
   *
   * @param {String} action The contract API action to take. This parameter is appended
   * the <code>params</code> object and will overwrite any <code>action</code> property
   * included.
   * @param {Object} [params=null] The parameters to include with the remote function call.
   * If null, an empty object is created.
   * @param {String} [APIFunc="CP_SmartContract"] The remote API function to invoke.
   *
   * @return {Promise} The promise resolves with the parsed JSON-RPC 2.0 result or
   * error (native object) of the call. Currently there is no rejection state.
   */
   async callContractAPI(action, params=null, APIFunc="CP_SmartContract") {
      var sendObj = new Object();
      if (params == null) {
         params = new Object();
      }
      for (var item in params) {
         sendObj[item] = params[item];
      }
      sendObj.action = action;
      sendObj.user_token = this.cypherpoker.p2p.userToken;
      sendObj.server_token = this.cypherpoker.p2p.serverToken;
      sendObj.account = this.game.getPlayer(this.game.ownPID).account.toObject(true);
      var requestID = "CP" + String(Math.random()).split(".")[1];
      var rpc_result = await RPC(APIFunc, sendObj, this.cypherpoker.p2p.webSocket, false, requestID);
      var result = JSON.parse(rpc_result.data);
      //since messages over web sockets are asynchronous the next immediate message may not be ours so:
      while (requestID != result.id) {
         rpc_result = await this.cypherpoker.p2p.webSocket.onEventPromise("message");
         result = JSON.parse(rpc_result.data);
         //we could include a max wait limit here
      }
      return (result);
   }

   /**
   * Verifies that a result object contains valid contract update data
   * intended for this instance and the associated {@link CypherPokerContract#game}
   * instance.
   *
   * @param {Object} resultObj The object to analyze, usually the <code>result</code>
   * of a JSON-RPC 2.0 message.
   *
   * @return {Boolean} True if the result object has a valid contract update object
   * structure and is intended for this contract instance.
   */
   verifyContractMessage(resultObj) {
      if ((typeof(resultObj.data) != "object") || (resultObj.data == null)) {
         return (false);
      }
      var data = resultObj.data;
      var contract = data.contract;
      var table = contract.table;
      if ((this.game.table.tableID != table.tableID) ||
         (this.game.table.tableName != table.tableName) ||
         (this.game.table.ownerPID != table.ownerPID)) {
            return (false);
      }
      var tableInfo = table.tableInfo;
      var gameTableInfo = this.game.table.tableInfo;
      if ((gameTableInfo.buyIn != tableInfo.buyIn) ||
         (gameTableInfo.bigBlind != tableInfo.bigBlind) ||
         (gameTableInfo.smallBlind != tableInfo.smallBlind)) {
            return (false);
      }
      var players = contract.players;
      var matchingPlayers = 0;
      for (var count = 0; count < players.length; count++) {
         for (var count2 = 0; count2 < this.game.players.length; count2++) {
            if (players[count].privateID == this.game.players[count2].privateID) {
               matchingPlayers++;
            }
         }
      }
      if (matchingPlayers != this.game.players.length) {
         return (false);
      }
      //other checks can be performed here
      return (true);
   }

   /**
   * Verifies that a result object contains the same contract ID as this
   * instance. This function should only be called after the result object
   * has been verified {@link CypherPokerContract#verifyContractMessage} and
   * the {@link CypherPokerContract#contractID} property has been set.
   *
   * @param {Object} resultObj The object to analyze, usually the <code>result</code>
   * of a JSON-RPC 2.0 message.
   *
   * @return {Boolean} True if the result object's contract ID matches this
   * instances'.
   */
   verifyContractID(resultObj) {
      var data = resultObj.data;
      if ((typeof(data.contract) != "object") || (data.contract == null)) {
         return (false);
      }
      var contract = data.contract;
      if (contract.contractID != this.contractID) {
         return (false);
      }
      return (true);
   }

   /**
   * Handles a server update message event dispatched by the communication
   * interface of the associated {@link CypherPokerContract#game} instance.
   *
   * @param {Event} event An "update" event dispatched by the communication interface.
   *
   * @private
   * @async
   */
   async handleUpdateMessage(event) {
      if (this.cypherpoker.isCPMsgEvent(event) == false) {
         //don't process any further
         return;
      }
      var resultObj = event.data.result;
      if (this.verifyContractMessage(resultObj) == false) {
         //either not a contract update message or not for this instance
         return;
      }
      if (this.contractID != null) {
         if (this.verifyContractID(resultObj) == false) {
            //wrong contract ID
            return;
         }
      }
      if (resultObj.from != undefined) {
         var fromPID = resultObj.from; //peer-initiated
      } else {
         fromPID = null; //server-initiated
      }
      var contractObj = resultObj.data.contract;
      var messageType = resultObj.data.cpMsg;
      var player = this.game.getPlayer(fromPID);
      this.history.unshift(contractObj);
      this.game.debug("CypherPokerContract.handleP2PMessage("+event+") => \""+messageType+"\"");
      switch (messageType) {
         case "contractnew":
            var contract = resultObj.data.contract;
            var players = contract.players;
            //var table = contract.table;
            this._contractID = contract.contractID;
            for (var count = 0; count < players.length; count++) {
               var player = this.game.getPlayer(players[count].privateID);
               if (player != null) {
                  player.balance = players[count].balance; //player balance
                  if ((typeof(players[count].account) == "object") && (players[count].account != null)) {
                     if (player.privateID != this.game.ownPID) {
                        player.account = new CypherPokerAccount(this.cypherpoker, players[count].account);
                     }
                  }
               }
            }
            var snapshot = this.gameSnapshot();
            var result = this.compare (contract, snapshot);
            console.log ("***************************************");
            console.log ("Snapshot to contract comparison: "+result);
            console.log ("***************************************");
            break;
         case "contractagree":
            var contract = resultObj.data.contract;
            var players = contract.players;
            //var table = contract.table;
            this._contractID = contract.contractID;
            for (var count = 0; count < players.length; count++) {
               var player = this.game.getPlayer(players[count].privateID);
               if (player != null) {
                  player.balance = players[count].balance; //player balance
                  if ((typeof(players[count].account) == "object") && (players[count].account != null)) {
                     if (player.privateID != this.game.ownPID) {
                        player.account = new CypherPokerAccount(this.cypherpoker, players[count].account);
                     }
                  }
               }
            }
         break;
      default:
         //not a recognized CypherPokerContract message type
         break;
      }
   }

}
