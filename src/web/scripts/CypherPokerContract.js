/**
* @file A virtual smart contract implementation using a WebSocket Session
* service as a TTP host.
*
* @version 0.4.1
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
   * The contract timeout timer has been started or restarted.
   *
   * @event CypherPokerContract#timeoutstart
   * @type {Event}
   * @property {CypherPokerContract} contract The instance dispatching the event.
   * @property {Number} seconds The number of seconds that must elapse without
   * player activity before the contract times out.
   * @property {Number} cSeconds The number of courtesy seconds that will
   * be allowed to elapse before the contract's "timeout" function is
   * invoked. Note that the timeout may occur at any time after the contract
   * has timed out (hence "courtesy" seconds).
   */
   /**
   * The contract appears to have timed out due to player inactivity. This is a local event
   * and does not necessarily reflect the state of the actual contract.
   *
   * @event CypherPokerContract#timeout
   * @type {Event}
   * @property {CypherPokerContract} contract The instance dispatching the event.
   * @property {Array} penalized Array of objects containing private ID(s) and
   * the amount tahat the associated player(s) were penalized. Typically
   * only one player will time out (penalized[0]), but under certain
   * conditions more than one player may time out.
   */
   /**
   * The contract timeout is no longer valid (e.g. the game has ended).
   *
   * @event CypherPokerContract#timeoutinvalid
   * @type {Event}
   * @property {CypherPokerContract} contract The instance dispatching the event.
   */

   /**
   * Creates a new proxy contract instance.
   *
   * @param {CypherPokerGame} gameRef The active game instance with which
   * this contract interface is associated.
   */
   constructor(gameRef) {
      super();
      this._game = gameRef;
      this._active = true;
      this.addGameEventListeners();
      this.cypherpoker.p2p.addEventListener("update", this.handleUpdateMessage, this);
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
   * @property {TableObject} table A copy of the table associated with the {@link CypherPokerContract#game}
   * instance.
   */
   get table() {
      if (this._table == undefined) {
         this._table = this.game.getTable();
      }
      return (this._table);
   }

   /**
   * @property {Array} players Indexed list of {CypherPokerPlayer} instances copied
   * from the associated {@link CypherPokerContract#game} instance.
   */
   get players() {
      if (this._players == undefined) {
         this.refreshPlayers();
      }
      return (this._players);
   }

   /**
   * Refreshes the {@link CypherPokerContract#players} array with data from
   * the associated {@link CypherPokerContract#game}.
   *
   * @private
   */
   refreshPlayers() {
      this._players = new Array();
      for (var count=0; count < this.game.players.length; count++) {
         this._players.push(this.game.players[count].copy());
      }
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
   * @property {Boolean} active=false Indicates whether or not the contract is currently
   * active (recording or resolving a game).
   */
   get active() {
      if (this._active == undefined) {
         this._active = false;
      }
      return (this._active);
   }

   /**
   * @property {String} contractID=null The ID of the contract instance, usually
   * as returned by the remote contract host. If this is <code>null</code>, this
   * instance should not be considered valid.
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
   * @property {Array} deferredActions Indexed list of objects containing
   * game state <code>snapshot</code>, <code>invoke</code>, <code>promise</code>,
   * parent <code>contract</code>, and boolean <code>complete</code> properties.
   */
   get deferredActions() {
      if (this._deferredActions == undefined) {
         this._deferredActions = new Array();
      }
      return (this._deferredActions);
   }

   /**
   * @property {Array} deferredPromises Complete indexed list of Promise instances currently
   * in the {@link CypherPokerContract#deferredActions} array.
   */
   get deferredPromises() {
      var returnArr = new Array();
      for (var count=0; count < this.deferredActions.length; count++) {
         returnArr.push(this.deferredActions[count].promise);
      }
      return (returnArr);
   }

   /**
   * @property {Array} deferredActivePromises Indexed list of Promise instances currently
   * in the {@link CypherPokerContract#deferredActions} array which have the property:
   * <code>complete == false</code>
   */
   get deferredActivePromises() {
      var returnArr = new Array();
      for (var count=0; count < this.deferredActions.length; count++) {
         if (this.deferredActions[count].complete == false) {
            returnArr.push(this.deferredActions[count].promise);
         }
      }
      return (returnArr);
   }

   /**
   * Adds event listeners required by the contract handler to the associated
   * {@link CypherPokerContract#game} instance.
   *
   * @private
   */
   addGameEventListeners() {
      this.game.addEventListener("gamekeypair", this.onGameKeypair, this);
      this.game.addEventListener("gamedeck", this.onNewGameDeck, this);
      this.game.addEventListener("gamecardsencrypt", this.onEncryptCards, this);
      this.game.addEventListener("gamedealprivate", this.onSelectCards, this);
      this.game.addEventListener("gamedealpublic", this.onSelectCards, this);
      this.game.addEventListener("gamedealmsg", this.onGameDeal, this);
      this.game.addEventListener("gamebetplaced", this.onGameBetPlaced, this);
      this.game.addEventListener("gamedecrypt", this.onGameDecrypt, this);
      this.game.addEventListener("gameend", this.onGameEnd, this);
   }

   /**
   * Removes event listeners required by the contract handler from the associated
   * {@link CypherPokerContract#game} instance.
   *
   * @private
   */
   removeGameEventListeners() {
      this.game.removeEventListener("gamekeypair", this.onGameKeypair, this);
      this.game.removeEventListener("gamedeck", this.onNewGameDeck, this);
      this.game.removeEventListener("gamecardsencrypt", this.onEncryptCards, this);
      this.game.removeEventListener("gamedealprivate", this.onSelectCards, this);
      this.game.removeEventListener("gamedealpublic", this.onSelectCards, this);
      this.game.removeEventListener("gamedealmsg", this.onGameDeal, this);
      this.game.removeEventListener("gamebetplaced", this.onGameBetPlaced, this);
      this.game.removeEventListener("gamedecrypt", this.onGameDecrypt, this);
      this.game.removeEventListener("gameend", this.onGameEnd, this);
   }

   /**
   * Removes peer-to-peer network event listener(s).
   *
   * @private
   */
   removeNetworkEventListeners() {
      this.cypherpoker.p2p.removeEventListener("update", this.handleUpdateMessage, this);
   }

   /**
   * Returns a {@link CypherPokerPlayer} instance associated with this game
   * instance.
   *
   * @param {String} privateID The private ID of the player.
   *
   * @return {CypherPokerPlayer} The {@link CypherPokerPlayer} for the private ID
   * associated with this game. <code>null</code> is returned if no matching
   * player private ID can be found.
   */
   getPlayer(privateID) {
      for (var count=0; count < this.players.length; count++) {
         if (this.players[count].privateID == privateID) {
            return (this.players[count]);
         }
      }
      return (null);
   }

   /**
   * Returns a condensed array containing the copied properties of the
   * {@link CypherPokerContract#players} array. Use the object returned by
   * this function with <code>JSON.stringify</code> instead of using
   * {@link CypherPokerContract#players} directly in order to prevent circular
   * reference errors.
   *
   * @param {Boolean} [includeKeychains=false] If true, the {@link CypherPokerPlayer#keychain}
   * array of each player will be included in the returned object.
   * @param {Boolean} [includePasswords=false] If true, the {@link CypherPokerAccount#password}
   * property of each {@link CypherPokerPlayer#account} reference will be included
   * with the returned object.
   *
   * @return {Object} The condensed players array associated with this game instance.
   */
   getPlayers(includeKeychains=false, includePasswords=false) {
      var returnArr = new Array();
      for (var count=0; count < this.players.length; count++) {
         var playerObj = this.players[count].toObject(includeKeychains, includePasswords);
         returnArr.push(playerObj);
      }
      return (returnArr);
   }

   /**
   * Returns the {@link CypherPokerPlayer} that is currently flagged as the dealer
   * in the {@link CypherPokerContract#players} array.
   *
   * @return {CypherPokerPlayer} The {@link CypherPokerPlayer} instance that
   * is flagged as a dealer. <code>null</code> is returned if no dealer is flagged.
   */
   getDealer() {
      for (var count=0; count < this.players.length; count++) {
         if (this.players[count].isDealer) {
            return (this.players[count]);
         }
      }
      return (null);
   }

   /**
   * Stops any current game timeout timer.
   * @private
   */
   stopContractTimeout() {
      try {
         clearTimeout(this._contractTimeoutID);
      } catch (err) {}
   }

   /**
   * Cancels and resets the current contract timeout, signalling any listeners
   * to ignore future timeout events from this instance.
   *
   * @fires CypherPokerContract#event:timeoutinvalid
   * @private
   */
   resetContractTimeout() {
      this.stopContractTimeout();
      var event = new Event("timeoutinvalid");
      event.contract = this;
      this.dispatchEvent(event);
   }

   /**
   * Stops any current game timeout timer and starts a new one based on the
   * most recent contract (<code>history[0]</code>).
   *
   * @fires CypherPokerContract#timeoutstart
   * @throws {Error} If the contract timeout could not be started.
   * @private
   */
   startContractTimeout() {
      this.stopContractTimeout();
      if ((this.history[0] == undefined) || (this.history[0] == null)) {
         return;
      }
      if (typeof(this.history[0].table.tableInfo.timeout) == "number") {
         //add 5 seconds to timeout to make sure we don't accidentally clock in early
         var timeout = (this.history[0].table.tableInfo.timeout + 5) * 1000;
         var event = new Event("timeoutstart");
         event.contract = this;
         event.seconds = this.history[0].table.tableInfo.timeout;
         event.cSeconds = 5;
         this.dispatchEvent(event);
         this._contractTimeoutID = setTimeout(this.onContractTimeout, timeout, this);
      } else {
         console.error ("Contract \""+this._contractID+"\" does not define a timeout. It may never complete!")
      }
   }

   /**
   * Called on a timer when a contract times out (one or more players
   * have failed to take an action in time).
   *
   * @private
   * @fires CypherPokerContract#timeout
   */
   onContractTimeout(contractInstance) {
      try {
         clearTimeout(contractInstance._contractTimeoutID);
         contractInstance._contractTimeoutID = null;
         delete contractInstance._contractTimeoutID;
      } catch (err) {
      } finally {
         var paramsObj = new Object();
         paramsObj.contract = contractInstance.history[0];
         paramsObj.contractID = paramsObj.contract.contractID;
         paramsObj.ownerPID = contractInstance.getDealer().privateID;
         var snapshot = contractInstance.gameSnapshot();
         console.error ("Contract \""+contractInstance.contractID+"\" has timed out");
         //call "timeout" penalty
         contractInstance.callContractAPI("timeout", paramsObj).then(JSONResult => {
            if (JSONResult.error != undefined) {
               //probably already timed out
               //console.error(JSONResult.error);
               return;
            }
            if (contractInstance.contractID != JSONResult.result.contract.contractID) {
               contractInstance.removeGameEventListeners();
               contractInstance.stopContractTimeout();
               return (false);
            }
            contractInstance.history.unshift(JSONResult.result.contract);
            try {
               contractInstance.updateBalances(JSONResult.result.contract);
            } catch (err) {
               console.error(err);
            }
            //the game can either end here or start a re-key operation
         }).catch (err => {
            contractInstance.removeGameEventListeners();
            contractInstance.stopContractTimeout();
         });
      }
   }

   /**
   * Creates a snapshot (copy) of the associated {@link CypherPokerContract#game} instance's
   * current data in the format of a contract data object for use as a condition in subsequent
   * contract actions.
   */
   gameSnapshot() {
      var snapshot = new Object();
      snapshot.players = this.getPlayers(false, false);
      snapshot.table = this.table;
      try {
         snapshot.prime = this.getPlayer(this.game.ownPID).keychain[0].prime;
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
   * @private
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
               if ((typeof(obj1[key]) != "function") && (typeof(obj2[key]) != "function")) {
                  if (obj1[key] != obj2[key]) {
                     if (key != "timeout") {
                        return (false);
                     }
                  }
               }
            }
         } catch (err) {
            console.error (err);
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
   * @private
   */
   compare(contract, snapshot) {
      if (this.compareObjects(contract.table, snapshot.table) == false) {
         throw (new Error("Table properties don't match for contract "+this.contractID));
      }
      if ((contract.prime != null) && (snapshot.prime == null)) {
         return (1);
      } else if ((contract.prime == null) && (snapshot.prime != null)) {
         return (2);
      } else if (contract.prime != snapshot.prime) {
         throw (new Error("Prime value mismatch."));
      }
      //compare decks
      result = this.compareDecks(contract.cardDecks.faceup, snapshot.cardDecks.faceup, "_mapping");
      if (result != 3) {
         return (result);
      }
      result = this.compareDecks(contract.cardDecks.facedown, snapshot.cardDecks.facedown);
      if (result != 0) {
         return (result);
      }
      result = this.compareDecks(contract.cardDecks.dealt, snapshot.cardDecks.dealt);
      if (result != 0) {
         return (result);
      }
      result = this.compareDecks(contract.cardDecks.public, snapshot.cardDecks.public, "_mapping");
      if (result != 0) {
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
            return (result);
         }
         //compare player selected cards
         result = this.compareDecks(contractPlayer.selectedCards, snapshotPlayer.selectedCards);
         if (result != 0) {
            return (result);
         }
         if (contractPlayer.hasBet && (snapshotPlayer.hasBet == false)) {
            return (1);
         } else if ((contractPlayer.hasBet == false) && snapshotPlayer.hasBet) {
            return (2);
         }
         if (contractPlayer.hasFolded && (snapshotPlayer.hasFolded == false)) {
            return (1);
         } else if ((contractPlayer.hasFolded == false) && snapshotPlayer.hasFolded) {
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
            return (1);
         } else if (snapshotPlayer.totalBet.greater(contractPlayer.totalBet)) {
            return (2);
         }
         //balance comparison is the inverse of totalBet comparison
         contractPlayer.balance = bigInt(contractPlayer.balance);
         snapshotPlayer.balance = bigInt(snapshotPlayer.balance);
         if (contractPlayer.balance.greater(snapshotPlayer.balance)) {
            return (2);
         } else if (snapshotPlayer.balance.greater(contractPlayer.balance)) {
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
      }, this);
      if (contractDeck.length > snapshotDeck.length) {
         return (1);
      } else if (contractDeck.length < snapshotDeck.length) {
         return (2);
      } else {
         if (numMatches != contractDeck.length) {
            //decks are same length but not all elements match
            throw (new Error("Mismatched deck elements."));
         }
         //decks are identical (no duplications, same length)
         return (0);
      }
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
               dupFound = true;
            }
         });
      });
      return (dupFound);
   }

   /**
   * Event handler invoked a new keypair is generated. This triggers the processing
   * of any incomplete contract actions requiring a valid keypair or prime.
   *
   * @param {CypherPokerGame#event:gamekeypair} event A "gamekeypair" event.
   * @private
   * @async
   */
   async onGameKeypair(event) {
      this.refreshPlayers();
      var actions = this.deferredActions;
      for (var count=0; count < actions.length; count++) {
         var currentAction = actions[count];
         currentAction.snapshot.prime = this.getPlayer(this.game.ownPID).keychain[0].prime;
         currentAction.snapshot.players = this.getPlayers(false, false);
      }
      var result = await this.processDeferredActions(this.history[0]);
      return (true);
   }

   /**
   * Event handler invoked a new game deck is fully generated. This triggers
   * the asynchronous creation and / or initialization of a new contract for
   * the game.
   *
   * @param {CypherPokerGame#event:gamedeck} event A "gamedeck" event.
   * @private
   */
   onNewGameDeck(event) {
      if (this.getDealer().privateID == this.game.ownPID) {
         //dealer creates the new contract; other players only agree to it
         var paramsObj = new Object();
         paramsObj.contract = new Object();
         //is there a better way to create the contract ID?
         this._contractID = String(Math.random()).split(".")[1];
         paramsObj.contract.contractID = this._contractID;
         paramsObj.contract.players = this.getPlayers(false, false);
         paramsObj.contract.table = this.table;
         paramsObj.contract.prime = this.getPlayer(this.game.ownPID).keychain[0].prime; //prime generated by us
         paramsObj.contract.cardDecks = this.game.cardDecks;
         this.callContractAPI("new", paramsObj).then(JSONResult => {
            if ((JSONResult["error"] != undefined) && (JSONResult["error"] != null)) {
               this.game.killGame(JSONResult.error.message);
                 return;
            }
            if (this.contractID != JSONResult.result.contract.contractID) {
               this.removeGameEventListeners();
               this.stopContractTimeout();
               return (false);
            }
            this.history.unshift(JSONResult.result.contract);
            try {
               this.updateBalances(JSONResult.result.contract);
            } catch (err) {
               console.error(err);
            }
         }).catch (err => {
            this.removeGameEventListeners();
            this.stopContractTimeout();
            throw(err);
         });
      } else {
         //not the dealer; do nothing
      }
   }

   /**
   * Event handler invoked a card encryption cycle happens. If this is ours,
   * it automatically triggers a contract "store" operation.
   *
   *
   * @param {CypherPokerGame#event:gamecardsencrypt} event A "gamecardsencrypt" event.
   *
   * @return {Promise} Resolves to <code>true</code> if the store operation successfully completed. Rejections
   * receive an <code>Error</code> object.
   * @private
   */
   async onEncryptCards(event) {
      if ((this.history.length == 0) && (this.getDealer().privateID != this.game.ownPID)) {
         return (false);
      }
      if (event.player.privateID != this.game.ownPID) {
         return(false);
      }
      this.startContractTimeout();
      var paramsObj = new Object();
      paramsObj.type = "encrypt";
      paramsObj.contract = this.history[0];
      paramsObj.contractID = this._contractID;
      paramsObj.ownerPID = this.getDealer().privateID;
      paramsObj.cards = Array.from(event.selected);
      var snapshot = this.gameSnapshot();
      try {
         var JSONResult = await this.onGameState(snapshot, this.callContractAPI, "store", paramsObj).promise;
         if (JSONResult.error != undefined) {
            console.error(JSONResult.error.message);
            throw (new Error(JSONResult.error.message));
         }
         if (this.contractID != JSONResult.result.contract.contractID) {
            this.removeGameEventListeners();
            this.stopContractTimeout();
            return (false);
         }
         try {
            this.updateBalances(JSONResult.result.contract);
         } catch (err) {
            this.game.debug(err, "err");
         }
      } catch (err) {
         this.removeGameEventListeners();
         this.stopContractTimeout();
         return (false);
      }
      return (true);
   }

   /**
   * Event handler invoked when the associated {@link CypherPokerContract#game}
   * instance{@link CypherPokerGame#event:gamedealprivate} or
   * {@link CypherPokerGame#event:gamedealpublic} event. This
   * it automatically triggers a contract "store" operation.
   *
   * @param {CypherPokerGame#event} event A{@link CypherPokerGame#event:gamedealprivate} or
   * {@link CypherPokerGame#event:gamedealpublic} event object.
   *
   * @async
   * @private
   */
   async onSelectCards(event) {
      if (this.history.length == 0) {
         return (false);
      }
      this.startContractTimeout();
      var paramsObj = new Object();
      paramsObj.type = "select";
      paramsObj.contract = this.history[0];
      paramsObj.contractID = paramsObj.contract.contractID;
      paramsObj.ownerPID = this.getDealer().privateID;
      paramsObj.cards = Array.from(event.selected);
      paramsObj.fromPID = this.game.ownPID;
      if (event.type == "gamedealprivate") {
         paramsObj.private = true;
      } else {
         paramsObj.private = false;
      }
      var snapshot = this.gameSnapshot();
      try {
         var JSONResult = await this.onGameState(snapshot, this.callContractAPI, "store", paramsObj).promise;
         if (JSONResult.error != undefined) {
            console.error(JSON.error.message);
            throw(new Error(JSON.error.message));
         }
         if (this.contractID != JSONResult.result.contract.contractID) {
            this.removeGameEventListeners();
            this.stopContractTimeout();
            return (false);
         }
         try {
            this.updateBalances(JSONResult.result.contract);
         } catch (err) {
            this.game.debug(err, "err");
         }
      } catch (err) {
         this.removeGameEventListeners();
         this.stopContractTimeout();
         return (false);
      }
      return (true);
   }

   /**
   * Event handler invoked when the associated {@link CypherPokerContract#game}
   * instance{@link CypherPokerGame#event:gamedealmsg} event.
   *
   * @param {CypherPokerGame#event:gamedealmsg} event An external deal operation
   * notification event.
   *
   * @private
   */
   onGameDeal(event) {
      if (this.history.length == 0) {
         return (false);
      }
      this.startContractTimeout();
   }

   /**
   * Event handler invoked when the associated {@link CypherPokerContract#game}
   * instance{@link CypherPokerGame#event:gamebetplaced} event. This
   * it automatically triggers a contract "store" operation.
   *
   * @param {CypherPokerGame#event} event A {@link CypherPokerGame#event:gamebetplaced} event object.
   *
   * @async
   * @private
   */
   async onGameBetPlaced(event) {
      if (this.history.length == 0) {
         return (false);
      }
      this.startContractTimeout();
      var paramsObj = new Object();
      paramsObj.contract = this.history[0];
      paramsObj.contractID = paramsObj.contract.contractID;
      paramsObj.ownerPID = this.getDealer().privateID;
      paramsObj.amount = event.amount;
      paramsObj.fromPID = this.game.ownPID;
      var snapshot = this.gameSnapshot();
      try {
         var JSONResult = await this.onGameState(snapshot, this.callContractAPI, "bet", paramsObj).promise;
         if (JSONResult.error != undefined) {
            console.error(JSONResult.error.message);
            throw(new Error(JSONResult.error.message));
         }
         if (this.contractID != JSONResult.result.contract.contractID) {
            this.removeGameEventListeners();
            this.stopContractTimeout();
            return (false);
         }
         try {
            this.updateBalances(JSONResult.result.contract);
         } catch (err) {
            this.game.debug(err, "err");
         }
      } catch (err) {
         this.removeGameEventListeners();
         this.stopContractTimeout();
         return (false);
      }
      return (true);
   }

   /**
   * Event handler invoked when the associated {@link CypherPokerContract#game}
   * instance dispatches a {@link CypherPoker#event:gamedecrypt} event.
   *
   * @param {Event} event A {@link CypherPoker#event:gamedecrypt} event object.
   *
   * @async
   * @private
   */
   async onGameDecrypt(event) {
      if (this.history.length == 0) {
         return (false);
      }
      this.startContractTimeout();
      var paramsObj = new Object();
      paramsObj.type = "decrypt";
      paramsObj.contract = this.history[0];
      paramsObj.contractID = paramsObj.contract.contractID;
      paramsObj.ownerPID = this.getDealer().privateID;
      paramsObj.cards = Array.from(event.selected);
      paramsObj.sourcePID = event.payload.sourcePID;
      paramsObj.fromPID = this.game.ownPID;
      paramsObj.private = event.private;
      var snapshot = this.gameSnapshot();
      try {
         var JSONResult = await this.onGameState(snapshot, this.callContractAPI, "store", paramsObj).promise;
         if (this.contractID != JSONResult.result.contract.contractID) {
            this.removeGameEventListeners();
            this.stopContractTimeout();
            return (false);
         }
         try {
            this.updateBalances(JSONResult.result.contract);
         } catch (err) {
            this.game.debug(err, "err");
         }
      } catch (err) {
         this.removeGameEventListeners();
         this.stopContractTimeout();
         return (false);
      }
   }

   /**
   * Event handler invoked when the associated {@link CypherPokerContract#game}
   * instance dispatches a {@link CypherPoker#event:gameend} event. This
   * currently causes an immediate submission of the keychain to the
   * contract via a "store" message.
   *
   * @param {Event} event A {@link CypherPoker#event:gameend} event object.
   *
   * @async
   * @private
   */
   async onGameEnd(event) {
      if (this.history.length == 0) {
         return (false);
      }
      this.removeGameEventListeners();
      this.startContractTimeout();
      var paramsObj = new Object();
      paramsObj.type = "keychain";
      paramsObj.contract = this.history[0];
      paramsObj.contractID = paramsObj.contract.contractID;
      paramsObj.ownerPID = this.getDealer().privateID;
      paramsObj.keychain = Array.from(this.getPlayer(this.game.ownPID).keychain);
      paramsObj.fromPID = this.game.ownPID;
      //var snapshot = this.gameSnapshot();
      try {
         var JSONResult = await this.callContractAPI("store", paramsObj);
         if (JSONResult.error != undefined) {
            console.error (JSONResult.error);
            return;
         }
         if (this.contractID != JSONResult.result.contract.contractID) {
            this.removeGameEventListeners();
            this.stopContractTimeout();
            return (false);
         }
         try {
            this.updateBalances(JSONResult.result.contract);
         } catch (err) {
            this.game.debug(err, "err");
         }
      } catch (err) {
         this.removeGameEventListeners();
         this.stopContractTimeout();
         return (false);
      }
   }

   /**
   * Creates a deferred invocation action object based on a game snapshot (state).
   *
   * @param {Object} snapshot A game snapshot (state) to match to a contract
   * state in order to invoke <code>functionRef</code>; for example, a snapshot
   * created using {@link CypherPokerContract#gameSnapshot}.
   * @param {Function} functionRef The <b>asynchronous</b> function to invoke when the game
   * <code>snapshot</code> (state) matches the contract state.
   * @param {*} params Any parameters to include with the function invocation.
   *
   * @return {Object} A deferred game state action object containing a game
   * <code>snapshot</code>, <code>invoke</code> object containing a deferred
   * <code>func</code> function to invoke with <code>params</code> parameters,
   * a <code>promise</code> that will resolve when the <code>snapshot</code>
   * matches the reported contract, and a <code>complete</code> property
   * indicating if the action has completed (true) or not (false).
   * @private
   */
   onGameState(snapshot, functionRef, ...params) {
      var action = new Object();
      action.snapshot = snapshot;
      action.invoke = new Object();
      action.contract = this;
      action.invoke.func = functionRef;
      action.invoke.params = params;
      action.promise = new Promise((resolve, reject) => {
         //resolves or rejects in processDeferredActions
         action._resolve = resolve;
         action._reject = reject;
      })
      action.complete = false;
      this.deferredActions.push(action);
      if (this.history.length > 0) {
         this.processDeferredActions(this.history[0]);
      }
      return (action);
   }

   /**
   * Examines {@link CypherPokerContract#deferredActions} and executes the next un-executed action
   * if its game <code>snapshot</code> matches the <code>contract</code> state.
   *
   * @param {ContractObject} contract The (ideally) updated contract object to check against
   * {@link CypherPokerContract#deferredActions} for possible execution.
   *
   * @return {Promise} Resolves with the deferred action objects that were just executed. Will be an empty
   * array if no actions were executed.
   * @private
   */
   async processDeferredActions(contract){
      var actions = this.deferredActions;
      var previousAction = null;
      var completedActions = new Array();
      var incompletedActions = new Array();
      for (var count=0; count < actions.length; count++) {
         var currentAction = actions[count];
         var exec = false;
         if (previousAction == null) {
            exec = true;
         }
         if (previousAction != null) {
            if (previousAction.complete == true) {
               exec = true;
            }
         }
         if ((currentAction.complete == false) && (exec == true)) {
            var snapshot = currentAction.snapshot;
            var result = this.compare (contract, snapshot);
            if ((result == 0) || (result == 2)) {
               var func = currentAction.invoke.func;
               var params = currentAction.invoke.params;
               var context = currentAction.contract;
               try {
                  currentAction.complete = true;
                  var fResult = await func.apply(context, params);
                  completedActions.push(currentAction);
                  currentAction._resolve(fResult);
               } catch (err) {
                  incompletedActions.push(currentAction);
                  this.game.debug(err, "err");
                  currentAction._reject(err);
               }
            }
         } else {
            if (currentAction.complete == false) {
               incompletedActions.push(currentAction);
            }
         }
         previousAction = currentAction;
      }
      return (completedActions);
   }

   /**
   * Deteremines whether a function is asynchronous (async) or synchronous.
   *
   * @param {function} func The function to evaluate.
   *
   * @return {Boolean} True if the function is asynchronous, false if it's a
   * synchronous function or not a function.
   * @private
   */
   isAsync(func) {
      if (typeof(func) != "function") {
         return (false);
      }
      return (String(func).startsWith("async"));
   }

   /**
   * Sends an "agree" message to the contract API signalling our acceptance of
   * the contract rules. At this point the <code>contract</code> parameter
   * should have been carefully examined for accuracy.
   *
   * @param {ContractObject} contract The contract associated with this instance
   * to agree to. The contract's owner is assumed to be the current dealer in the
   * {@link CypherPokerContract#game} instance.
   *
   * @return {ContractObject} The contract object that was agreed to, according to
   * the remote service.
   * @todo Compare input and output of function as a final verification
   * @private
   */
   async agreeToContract(contract) {
      this.game.debug ("CypherPokerContract: Agreeing to contract "+contract.contractID);
      this.game.debug (contract, "dir");
      var paramsObj = new Object();
      paramsObj.ownerPID = this.getDealer().privateID;
      paramsObj.contractID = contract.contractID;
      var JSONResult = await this.callContractAPI("agree", paramsObj);
      if ((JSONResult["error"] != undefined) && (JSONResult["error"] != null)) {
         this.game.killGame(JSONResult.error.message);
         return (null);
      } else {
         this.updateBalances(JSONResult.result.contract);
      }
      this.history.unshift(JSONResult.result.contract);
      return (JSONResult.result.contract);
   }

   /**
   * Updates the balances of the associated {@link CypherPokerContract#game} instance's
   * players from a provided contract data object.
   *
   * @param {Object} contractData The contract data object to use to update
   * player balances.
   * @param {Boolean} fatalFail=false If true, the function will throw an error on an update failure
   * (usually a value can't be converted). If false, errors are ignored.
   * @throws {Error} If a game balance is not of a convertible type or subsequently if an account
   * balance can't be converted. Note that an invalid game balance does not mean that the account
   * balance is valid because it's checked second. Only thrown if <code>fataiFail=true</code>.
   * @private
   */
   updateBalances(contractData, fatalFail=false) {
      var contractPlayers = contractData.players;
      for (var count = 0; count < contractPlayers.length; count++) {
         var contractPlayer = contractPlayers[count]; //player in contract
         var privateID = contractPlayer.privateID;
         var localPlayer = this.getPlayer(privateID); //player in game
         if ((typeof(contractPlayer.balance) == "string") || (typeof(contractPlayer.balance) == "number")) {
            localPlayer.balance = contractPlayer.balance;
         } else {
            try {
                  //balance may be a String-able instance
                  localPlayer.balance = contractPlayer.balance.toString();
            } catch (err) {
               if (fatalFail == true) {
                  throw (new Error("Player game balance for \""+privateID+"\" invalid (type: "+typeof(contractPlayer.balance)+"): "+contractPlayer.balance));
               }
            }
         }
         if ((typeof(contractPlayer.account) == "object") && (contractPlayer.account != null)) {
            if ((typeof(contractPlayer.account.balance) == "string") || (typeof(contractPlayer.account.balance) == "number")) {
               if ((localPlayer.account == null) || (localPlayer.account == undefined)) {
                  localPlayer.account = new CypherPokerAccount(this.cypherpoker, contractPlayer.account);
               } else {
                  localPlayer.account.balance = contractPlayer.account.balance;
               }
            } else {
               try {
                  localPlayer.account.balance = contractPlayer.account.balance.toString();
               } catch (err) {
                  if (fatalFail == true) {
                     throw (new Error("Player account balance for \""+privateID+"\" invalid (type: "+typeof(contractPlayer.account.balance)+"): "+contractPlayer.account.balance));
                  }
               }
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
   * @private
   */
   async callContractAPI(action, params=null, APIFunc="CP_SmartContract") {
      var sendObj = new Object();
      if (params == null) {
         params = new Object();
      }
      for (var item in params) {
         sendObj[item] = params[item];
      }
      if (this.history.length > 0) {
         if (this.history[0].invalid == true) {
            throw (new Error("Contract is not valid!"));
         }
      }
      sendObj.action = action;
      sendObj.user_token = this.cypherpoker.p2p.userToken;
      sendObj.server_token = this.cypherpoker.p2p.serverToken;
      sendObj.account = this.getPlayer(this.game.ownPID).account.toObject(true);
      var requestID = "CP" + String(Math.random()).split(".")[1];
      var rpc_result = await RPC(APIFunc, sendObj, this.cypherpoker.api, false, requestID);
      var result = JSON.parse(rpc_result.data);
      //since raw API messages are asynchronous the next immediate message may not be ours so:
      while (requestID != result.id) {
         rpc_result = await this.cypherpoker.api.rawConnection.onEventPromise("message");
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
   * @private
   */
   verifyContractMessage(resultObj) {
      if ((typeof(resultObj.data) != "object") || (resultObj.data == null)) {
         console.error("not an object or null");
         return (false);
      }
      var data = resultObj.data;
      var contract = data.contract;
      var table = contract.table;
      if ((this.game == undefined) || (this.game == null)) {
         console.error("no game ref");
         return (false);
      }
      if ((typeof(this.table) != "object") || (this.table == null)) {
         return (false);
      }
      if ((this.table.tableID != table.tableID) ||
         (this.table.tableName != table.tableName) ||
         (this.table.ownerPID != table.ownerPID)) {
            return (false);
      }
      var tableInfo = table.tableInfo;
      var gameTableInfo = this.table.tableInfo;
      if ((gameTableInfo.buyIn != tableInfo.buyIn) ||
         (gameTableInfo.bigBlind != tableInfo.bigBlind) ||
         (gameTableInfo.smallBlind != tableInfo.smallBlind)) {
            return (false);
      }
      var players = contract.players;
      var matchingPlayers = 0;
      for (var count = 0; count < players.length; count++) {
         for (var count2 = 0; count2 < this.players.length; count2++) {
            if (players[count].privateID == this.players[count2].privateID) {
               matchingPlayers++;
            }
         }
      }
      if (matchingPlayers != this.players.length) {
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
   * @private
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
      if (resultObj.from != undefined) {
         var fromPID = resultObj.from; //peer-initiated
      } else {
         fromPID = null; //server-initiated
      }
      var contractObj = resultObj.data.contract;
      var messageType = resultObj.data.cpMsg;
      var contract = resultObj.data.contract;
      var table = contract.table;
      var players = contract.players;
      this.history.unshift(contractObj); //make sure to store contract in history!
      this.game.debug("CypherPokerContract.handleUpdateMessage("+event+") => \""+messageType+"\"");
      this.processDeferredActions(contractObj); //respond immediately on game state match
      switch (messageType) {
         case "contractnew":
            if (this.contractID == null) {
               this._contractID = contract.contractID;
               this.updateBalances(contract);
               var snapshot = this.gameSnapshot();
               this.onGameState(snapshot, this.agreeToContract, contract).promise.catch (err => {
                  this._contractID = null; //could not agree / contract is invalid
                  this.removeGameEventListeners();
                  this.game.debug(err, "err");
               });
               if (this.history[0].invalid != true) {
                  this.startContractTimeout();
               } else {
                  this.stopContractTimeout();
               }
            }
            break;
         case "contractnewfail":
            var errorMessage = "Player \""+fromPID+"\" failed to create contract:<br/>";
            errorMessage += resultObj.data.error.message;
            this.game.killGame(errorMessage);
            this.stopContractTimeout();
            break;
         case "contractagree":
            if (this.verifyContractID(resultObj) == false) {
               //wrong contract ID
               return;
            }
            //note that contract owner (dealer) auto-agrees in addition to...
            this.game.debug ("Player "+fromPID+" has agreed to contract: "+contract.contractID);
            this.updateBalances(contract);
            this.processDeferredActions(contract);
            if (this.history[0].invalid != true) {
               this.startContractTimeout();
            } else {
               this.stopContractTimeout();
            }
            break;
         case "contractagreefail":
            var errorMessage = "Player \""+fromPID+"\" failed to agree to contract:<br/>";
            errorMessage += resultObj.data.error.message;
            this.game.killGame(errorMessage);
            this.stopContractTimeout();
            break;
         case "contractencryptstore":
            if (this.verifyContractID(resultObj) == false) {
               //wrong contract ID
               return;
            }
            this.game.debug ("Player "+fromPID+" has stored an encryption round to the contract:");
            this.game.debug (contract, "dir");
            this.updateBalances(contract);
            this.processDeferredActions(contract);
            if (this.history[0].invalid != true) {
               this.startContractTimeout();
            } else {
               this.stopContractTimeout();
            }
            break;
         case "contractselectstore":
            if (this.verifyContractID(resultObj) == false) {
               //wrong contract ID
               return;
            }
            this.game.debug ("Player "+fromPID+" has stored a card(s) selection to the contract:");
            this.game.debug (contract, "dir");
            this.updateBalances(contract);
            this.processDeferredActions(contract);
            if (this.history[0].invalid != true) {
               this.startContractTimeout();
            } else {
               this.stopContractTimeout();
            }
            break;
         case "contractdecryptstore":
            if (this.verifyContractID(resultObj) == false) {
               //wrong contract ID
               return;
            }
            this.game.debug ("Player "+fromPID+" has stored a decryption round to the contract:");
            this.game.debug (contract, "dir");
            this.updateBalances(contract);
            this.processDeferredActions(contract);
            if (this.history[0].invalid != true) {
               this.startContractTimeout();
            } else {
               this.stopContractTimeout();
            }
            break;
         case "contractbet":
            if (this.verifyContractID(resultObj) == false) {
               //wrong contract ID
               return;
            }
            this.game.debug ("Player "+fromPID+" has stored a bet or fold action to the contract:");
            this.game.debug (contract, "dir");
            this.updateBalances(contract);
            this.processDeferredActions(contract);
            if (this.history[0].invalid != true) {
               this.startContractTimeout();
            } else {
               this.stopContractTimeout();
            }
            break;
         case "contractkeychainstore":
            if (this.verifyContractID(resultObj) == false) {
               //wrong contract ID
               return;
            }
            this.game.debug ("Player "+fromPID+" has stored their keychain to the contract:");
            this.game.debug (contract, "dir");
            this.updateBalances(contract);
            this.processDeferredActions(contract);
            this.startContractTimeout();
            break;
         case "contracttimeout":
            if (this.verifyContractID(resultObj) == false) {
               //wrong contract ID
               return;
            }
            this.updateBalances(contract);
            this.processDeferredActions(contract);
            var event = new Event("timeout");
            event.contract = this;
            event.penalized = contract.penalty.penalized;
            this.dispatchEvent(event);
            this.stopContractTimeout();
            this.resetContractTimeout();
            break;
         case "contractend":
            if (this.verifyContractID(resultObj) == false) {
               //wrong contract ID
               console.error ("Contracts don't match!");
               return;
            }
            this.removeNetworkEventListeners();
            this.removeGameEventListeners();
            this.stopContractTimeout();
            this.resetContractTimeout();
            this._active = false;
            break;
         default:
            //not a recognized CypherPokerContract message type
            break;
      }
   }

}
