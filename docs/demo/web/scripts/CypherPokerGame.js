/**
* @file A CypherPoker.JS implementation of Texas Hold'em poker for 2+ players.
*
* @version 0.0.1
* @author Patrick Bay
* @copyright MIT License
*/

/**
* @class Manages game logic, {@link CypherPokerPlayer} instances,
* and other game-specific properties for CypherPoker.JS Texas Hold'em.
*
* @extends EventDispatcher
*/
class CypherPokerGame extends EventDispatcher {

   /**
   * This game instance is signalling that it is ready to start (all startup data has been
   * loaded, references set, etc.)
   *
   * @event CypherPokerGame#gameready
   * @type {Event}
   * @property {CypherPokerGame} game The game instance reporting as ready.
   * @property {CypherPoker#TableObject} table The table associated with the game instance.
   */
   /**
   * A player is notifying us that their game is ready (i.e. they received a
   * "gameready" event).
   *
   * @event CypherPokerGame#gameplayerready
   * @type {Event}
   * @property {Object} data The JSON-RPC 2.0 object containing the message.
   * @property {CypherPokerPlayer} player The player sending the notification.
   * @property {CypherPokerGame} game The game to which the player belongs.
   * @property {CypherPoker#TableObject} table The table to which the player and game belong.
   */
   /**
   * A "hello" or introduction message was received from a player at this table.
   *
   * @event CypherPokerGame#gamehello
   * @type {Event}
   * @property {Object} data The JSON-RPC 2.0 object containing the message.
   * @property {CypherPokerPlayer} player The player that sent message. This instance's
   * <code>info</code> object was updated.
   * @property {CypherPokerGame} game The game instance reporting as ready.
   * @property {CypherPoker#TableObject} table The table associated with the game instance.
   */
   /**
   * New parameters for the game have been set or received by/from the dealer.
   *
   * @event CypherPokerGame#gameparams
   * @type {Event}
   * @property {Object} data The JSON-RPC 2.0 object containing the message.
   * If we've set the parameters (as dealer), this object is null.
   * @property {CypherPokerPlayer} player The player that sent message.
   * @property {CypherPokerGame} game The game instance reporting as ready.
   * @property {CypherPoker#TableObject} table The table associated with the game instance.
   */
   /**
   * A new {@link keypair} has been generated for us by the {@link generateKeypair} function.
   *
   * @event CypherPokerGame#gamekeypair
   * @type {Event}
   * @property {Object} keypair A new {@link keypair} derived from the
   * {@link CypherPokerGame#gameParams}<code>.prime</code> value.
   * @property {CypherPokerPlayer} player The player for whom the keypair was created.
   * If the {@link generateKeypair} function was invoked with the <code>storeKeypair</code>
   * parameter set to false, this property will be null.
   * @property {CypherPokerGame} game The game instance that generated the keypair.
   * @property {CypherPoker#TableObject} table The table associated with the game instance.
   */
   /**
   * A new card deck (sequential quadratic residues), has been generated for the game.
   * The deck is available as an array of {@link CypherPokerCard} instances in
   * {@link CypherPokerGame#cardDecks}<code>.faceup</code>.
   *
   * @event CypherPokerGame#gamedeck
   * @type {Event}
   * @property {Object} data The JSON-RPC 2.0 object containing the message.
   * If we've created the deck (as dealer), this object is null.
   * @property {CypherPokerPlayer} player The player that sent message.
   * @property {CypherPokerGame} game The game instance reporting as ready.
   * @property {CypherPoker#TableObject} table The table associated with the game instance.
   */
   /**
   * We have selected private cards which are about to be sent to other players
   * for decryption.
   * The selected cards have been removed from the
   * {@link CypherPokerGame#cardDecks}<code>.facedown</code> array and added to
   * the {@link CypherPokerGame#cardDecks}<code>.dealt</code> array.
   *
   * @event CypherPokerGame#gamedealprivate
   * @type {Event}
   * @property {Array} selected Indexed array of strings representing the
   * encrypted private cards we've selected.
   * @property {CypherPokerPlayer} player The player that selected the cards (us).
   * @property {CypherPokerGame} game The game instance associated with the deal.
   * @property {CypherPoker#TableObject} table The table associated with the deal.
   */
   /**
   * We have selected public cards which are about to be sent to other players
   * for decryption.
   * The selected cards have been removed from the
   * {@link CypherPokerGame#cardDecks}<code>.facedown</code> array and added to
   * the {@link CypherPokerGame#cardDecks}<code>.dealt</code> array.
   *
   * @event CypherPokerGame#gamedealpublic
   * @type {Event}
   * @property {Array} selected Indexed array of strings representing the
   * encrypted public cards we've selected.
   * @property {CypherPokerPlayer} player The player that selected the cards (us).
   * @property {CypherPokerGame} game The game instance associated with the deal.
   * @property {CypherPoker#TableObject} table The table associated with the deal.
   */
   /**
   * New public or private cards have been fully decrypted and dealt into
   * play.
   *
   * @event CypherPokerGame#gamedeal
   * @type {Event}
   * @property {Array} cards Indexed array of {@link CypherPokerCard} instances
   * representing the newly dealt, face-up cards.
   * @property {Boolean} private If true, the <code>cards</code> array contains private / hole
   * cards otherwise it contains public / community cards.
   * @property {CypherPokerGame} game The game instance associated with the deal.
   * @property {CypherPoker#TableObject} table The table associated with the deal.
   */
   /**
   * A bet has been placed by another player.
   *
   * @event CypherPokerGame#gamebet
   * @type {Event}
   * @property {String} amount The amount of the bet.
   * @property {CypherPokerPlayer} player The player that placed the bet.
   * @property {CypherPokerGame} game The game instance associated with the received bet.
   * @property {CypherPoker#TableObject} table The table associated with the received bet.
   */
   /**
   * The game (hand) has ended because either all but one player have folded or
   * all cards have been dealt and all rounds of betting have completed.
   *
   * @event CypherPokerGame#gameend
   * @type {Event}
   * @property {CypherPokerGame} game The game instance reporting as ready.
   * @property {CypherPoker#TableObject} table The table associated with the game instance.
   */

   /**
   * Creates a new game instance.
   *
   * @param {CypherPoker} cypherpokerRef A reference to the parent or
   * containing {@link CypherPoker} instance that created the game instance.
   * @param {CypherPoker#TableObject} tableObj The table associated with the game instance.
   * A copy of this object is available through the {@link table} reference.
   * @param {Object} [playerInfo=null] Contains additional information
   * about us to share with the table.
   */
   constructor(cypherpokerRef, tableObj, playerInfo=null) {
      super();
      try {
         //attempt to create dummy instance to ensure that class is available
         var temp = new CypherPokerPlayer("");
      } catch (err) {
         throw (new Error("CypherPokerPlayer class not available in current context."));
      }
      this._cypherpoker = cypherpokerRef;
      if (this.cypherpoker.isTableValid(tableObj) == false) {
         this._cypherpoker = null;
         throw (new Error("Not a valid CypherPoker#TableObject."));
      }
      if (this.gameExists(tableObj)) {
         this._cypherpoker = null;
         throw (new Error("Game for table already exists."));
      }
      this._table = new Object();
      this.cypherpoker.copyTable(tableObj, this.table);
      this.cypherpoker.games.push(this);
      this._players = new Array();
      for (var count=0; count < tableObj.joinedPID.length; count++) {
         var newPlayer = new CypherPokerPlayer(tableObj.joinedPID[count]);
         if (newPlayer.privateID == this.ownPID) {
            newPlayer.info = playerInfo;
         }
         this._players.push(newPlayer);
      }
      this.assignPlayerRoles(null); //table owner becomes initial dealer
      this.cypherpoker.p2p.addEventListener("message", this.handleP2PMessage, this);
   }

   /**
   * @property {BigInteger} pot The amount currently in the pot for the game.
   */
   set pot (potVal) {
      this._pot = bigInt(String(potVal));
   }

   get pot() {
      if (this._pot == undefined) {
         this._pot = bigInt(0);
      }
      return (this._pot);
   }

   /**
   * @property {Boolean} autoBlinds=true If true, the required blind amount for
   * the table are posted automatically if we're playing as a blind, otherwise
   * the blind amount will need to be posted via the {@link CypherPokerGame#placeBet} function.
   */
   set autoBlinds (abSet) {
      this._autoBlinds = abSet;
   }

   get autoBlinds() {
      if (this._autoBlinds == undefined) {
         this._autoBlinds = true;
      }
      return (this._autoBlinds);
   }

   /**
   * Assigns player roles to the {@link CypherPokerPlayer} instances in the
   * {@link CypherPokerGame#players} array, such as dealer, big blind, and
   * small blind. The {@link CypherPokerGame#players} array must be complete
   * for the game prior to invoking this function.
   *
   * @param {String} [dealerPID=null] The private ID of the dealer. The next
   * player is assigned as the small blind and the next player after that
   * is assigned as the big blind unless this is a 2-player or "heads-up" game
   * in which case the dealer also becomes the small blind and the opponent
   * becomes the big blind. If this value is null, the associated table owner
   * becomes the dealer.
   * @private
   *
   */
   assignPlayerRoles(dealerPID=null) {
      if (typeof(dealerPID) == "string") {
         this.debug("assignPlayerRoles(\""+dealerPID+"\")");
      } else {
         this.debug("assignPlayerRoles("+dealerPID+")");
      }
      if (dealerPID == null) {
         dealerPID = this.table.ownerPID;
      }
      var dealer = this.getPlayer(dealerPID);
      dealer.isDealer = true;
      if (this.players.length == 2) {
         var smallBlind = dealer;
         var bigBlind = this.getNextPlayer(dealerPID);
      } else {
         smallBlind = this.getNextPlayer(dealerPID);
         bigBlind = this.getNextPlayer(smallBlind.privateID);
      }
      smallBlind.isSmallBlind = true;
      bigBlind.isBigBlind = true;
   }

   /**
   * Resets the betting states of all players associated with this game instance.
   *
   * @param {Boolean} [resetBet=false] If true, the {@link CypherPokerPlayer#totalBet} amount
   * is set to 0.
   * @param {Boolean} [resetHasBet=false] If true, the {@link CypherPokerPlayer#hasBet} flag is
   * set to false.
   * @param {Boolean} [resetHasFolded=false] If true, the {@link CypherPokerPlayer#hasFolded} flag
   * is set to false.
   */
   resetPlayerStates(resetBet=false, resetHasBet=false, resetHasFolded=false) {
      if ((resetBet==false) && (resetHasBet==false) && (resetHasFolded==false)) {
         return;
      }
      for (var count=0; count < this.players.length; count++) {
         if (resetBet) {
            this.players[count].totalBet = 0;
         }
         if (resetHasBet) {
            this.players[count].hasBet = false;
         }
         if (resetHasFolded) {
            this.players[count].hasFolded = false;
         }
      }
   }

   /**
   * Creates a <code>console</code>-based output based on the type if the
   * <code>debug</code> property of {@link settings} is <code>true</code>.
   *
   * @param {*} msg The message to send to the console output.
   * @param {String} [type="log"] The type of output that the <code>msg</code> should
   * be sent to. Valid values are "log" - send to the standard <code>log</code> output,
   * "err" or "error" - send to the <code>error</code> output, and "dir"-send to the
   * <code>dir</code> (object inspection) output.
   * @private
   */
   debug (msg, type="log") {
      if (this.cypherpoker.settings.debug == true) {
         if ((type == "err") || (type == "error")) {
            console.error(msg);
         } else if (type == "dir") {
            console.dir(msg);
         } else {
            console.log(msg);
         }
      }
   }

   /**
   * Starts the game instance and notifies other players that it's ready. This
   * function should only be called when all game settings have been loaded,
   * references set, etc.
   *
   * @return {CypherPokerGame} A reference to the current instance.
   */
   start() {
      this.sendGameReady();
      return (this);
   }

   /**
   * @property {HTMLElement} DOMElement=null A reference to the DOM element associated
   * with this game instance. Typically this reference is set by an external user
   * interface manager.
   */
   set DOMElement(elementRef) {
      this._DOMElement = elementRef;
   }

   get DOMElement() {
      if (this._DOMElement == undefined) {
         this._DOMElement = null;
      }
      return (this._DOMElement);
   }

   /**
   * @property {CypherPoker} cypherpoker Reference to the parent or containing
   * {@link CypherPoker} instance used to create this game, as provided at
   * instantiation.
   * @readonly
   */
   get cypherpoker(){
      if (this._cypherpoker == undefined) {
         this._cypherpoker = null;
      }
      return (this._cypherpoker);
   }

   /**
   * @property {CypherPoker#TableObject} table A copy of the table associated with this game
   * provided at instantiation. Note that this is <b>not</b> a reference to
   * the original table object provided to the constructor.
   * @readonly
   */
   get table() {
      return (this._table);
   }

   /**
   * @property {Array} players An array of {@link CypherPokerPlayer} instances
   * associated with the game.
   * @readonly
   */
   get players() {
      return (this._players);
   }

   /**
   * @property {String} ownPID Our own private ID as generated through
   * the parent {@link CypherPoker} instance's <code>p2p</code> interface.
   * @readonly
   */
   get ownPID() {
      return (this.cypherpoker.p2p.privateID);
   }

   /**
   * @property {Object} gameParams Game-related parameters.
   * @property {String} gameParams.prime The current prime modulus value for
   * the game. Previous prime values are stored in {@link keypair}
   * instances in the {@link CypherPokerPlayer#keychain} array.
   * @readonly
   */
   get gameParams() {
      if (this._gameParams == undefined) {
         this._gameParams = new Object();
      }
      return (this._gameParams);
   }

   /**
   * @property {Object} cardDecks Stores card decks for the game.
   * @property {Array} cardDecks.faceup Indexed array of {@link CypherPokerCard}
   * instances containing the face-up or unencrypted deck. The contents of this
   * array should not change during a game (hand).
   * @property {Array} cardDecks.facedown Indexed array of strings representing
   * the face-down or encrypted deck. As cards are drawn they're moved to the
   * <code>dealt</code> array.
   * @property {Array} cardDecks.dealt Indexed array of strings representing
   * the face-down or encrypted deck that have been dealt from the <code>facedown</code>
   * array.
   * @property {Array} cardDecks.public Indexed array of unencrypted or face-up
   * {@link CypherPokerCard} instances that have been dealt as public or community cards.
   * @readonly
   */
   get cardDecks() {
      if (this._cardDecks == undefined) {
         this._cardDecks = new Object();
         this._cardDecks.faceup = new Array();
         this._cardDecks.facedown = new Array();
         this._cardDecks.dealt = new Array();
         this._cardDecks.public = new Array();
      }
      return (this._cardDecks);
   }

   /**
   * @property {Boolean} gameStarted True if the game has been started (all
   * players have introduced themselves and game parameters have been set).
   * @readonly
   */
   get gameStarted() {
      if (this._gameStarted == undefined) {
         this._gameStarted = false;
      }
      return (this._gameStarted);
   }

   /**
   * @property {Boolean} canBet If true, we can place a bet, check/call, or fold
   * via the {@link CypherPokerGame#placeBet} function.
   */
   get canBet() {
      if (this.gameStarted == false) {
         return (false);
      }
      var player = this.getPlayer(this.ownPID);
      var previousPlayer = this.getPreviousPlayer(this.ownPID);
      if (((player.isSmallBlind) || (player.isBigBlind)) && (player.totalBet.equals(0)) && (this.bettingDone == false)) {
         //blinds can bet at any time at start of hand, with or without cards
         return (true);
      }
      if (player.dealtCards.length < 2) {
         //no private cards dealt
         return (false);
      }
      if (player.hasBet || player.hasFolded) {
         //we've already bet or folded
         return (false);
      }
      //heads-up rules
      if (this.players.length == 2) {
         if ((this.cardDecks.public.length == 0) && player.isDealer) {
            //pre-flop, dealer goes first
            return (true);
         }
         if ((this.cardDecks.public.length == 0) && (player.isDealer == false) && (previousPlayer.hasBet)) {
            //pre-flop, non=dealer goes last
            return (true);
         }
         if ((this.cardDecks.public.length > 0) && player.isDealer && previousPlayer.hasBet) {
            //post-flop, dealer goes last
            return (true);
         }
         if ((this.cardDecks.public.length > 0) && (player.isDealer == false)) {
            //post-flop, non-dealer goes first
            return (true);
         }
         return (false);
      }
      //standard rules
      var playerHasBet = false;
      for (var count=0; count < this.players.length; count++) {
         if (this.players[count].hasBet || this.players[count].hasFolded) {
            playerHasBet = true;
            break;
         }
      }
      if (playerHasBet == false) {
         if (player.isSmallBlind) {
            //first bet as small blind
            return (true);
         }
      } else if ((previousPlayer.hasBet || previousPlayer.hasFolded) && (this.bettingDone == false)) {
         //subsequent bets
         return (true);
      }
      return (false);
   }

   /**
   * @property {Boolean} bettingDone True if all non-folded players have committed the same
   * bet amount, or if all players but one have folded (new cards may be dealt or the game has completed).
   */
   get bettingDone() {
      var foldedPlayers = 0;
      var nonFoldedPlayers = 0;
      var currentBet = "";
      var betGroups = new Object(); //players grouped by bet amount
      for (var count=0; count < this.players.length; count++) {
         if (this.players[count].hasFolded) {
            foldedPlayers++;
         } else {
            nonFoldedPlayers++;
            if (this.players[count].hasBet) {
               currentBet = this.players[count].totalBet.toString();
               if (betGroups[currentBet] == undefined) {
                  betGroups[currentBet] = new Array();
               }
               betGroups[currentBet].push(this.players[count]);
            }
         }
      }
      if (betGroups[currentBet] != undefined) {
         if (betGroups[currentBet].length == nonFoldedPlayers) {
            return (true);
         }
      }
      return (false);
   }

   /**
   * @property {Boolean} gameDone True if the current game (hand), and all
   * associated betting rounds have completed. Verification and other
   * post-game actions can take place once a game is done.
   */
   get gameDone() {
      var nonFoldedPlayers = this.players.length;
      for (var count=0; count < this.players.length; count++) {
         if (this.players[count].hasFolded) {
            nonFoldedPlayers--;
         }
      }
      if (nonFoldedPlayers <= 1) {
         //all but one (or fewer) players have folded
         return (true);
      }
      if ((this.cardDecks.public.length == 5) && this.bettingDone) {
         return (true);
      }
      return (false);
   }

   /**
   * @property {BigInteger} minimumBet The minimum bet that must be placed by
   * us during this round of betting in order to continue playing.
   */
   get minimumBet() {
      var ourTotalBet = this.getPlayer(this.ownPID).totalBet;
      return (this.largestBet.subtract(ourTotalBet));
   }

   /**
   * @property {BigInteger} largestBet The largest bet currently placed by
   * a non-folded player at the table.
   */
   get largestBet() {
      var largestBet = bigInt(0);
      for (var count=0; count < this.players.length; count++) {
         if ((largestBet.compare(this.players[count].totalBet) == -1) && (this.players[count].hasFolded == false)) {
            largestBet = this.players[count].totalBet;
         }
      }
      return (largestBet);
   }

   /**
   * @property {Boolean} canDeal If true, we can initiate the next round of card
   * dealing (private or public), via the {@link CypherPokerGame#dealCards} function.
   */
   get canDeal() {
      if (this.gameStarted == false) {
         return (false);
      }
      var initialDealer = this.getDealer();
      var player = this.getPlayer(this.ownPID);
      if (player.dealtCards.length < 2) {
         if (initialDealer.privateID == this.ownPID) {
            //private cards not yet dealt and we're the dealer
            return (true);
         }
         if (this.getPreviousPlayer(this.ownPID).selectedCards.length > player.selectedCards.length) {
            //previous player has selected their private cards and we haven't
            return (true);
         }
      } else {
         if (this.cardDecks.public.length == 5) {
            //all cards dealt
            return (false);
         }
         //find next public card dealer in round-robin fashion
         var nextDealer = this.getNextPlayer(initialDealer.privateID);
         for (var count = 2; count < this.cardDecks.public.length; count++) {
            nextDealer = this.getNextPlayer(nextDealer.privateID);
         }
         if (nextDealer.privateID == this.ownPID) {
            return (true);
         }
      }
      return (false);
   }

   /**
   * Returns a player information object for a specific private ID associated
   * with this game.
   *
   * @param {String} privateID The private ID of the player associated with
   * this game for which to return the information object.
   *
   * @return {Object} An information object for the specified private ID or
   * null if no such private ID has an information object associated with this
   * game.
   */
   getPlayerInfo(privateID) {
      var playerInstance = this.getPlayer(privateID);
      if (playerInstance != null) {
         return (playerInstance.info);
      }
      return (null);
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
   * Returns the {@link CypherPokerPlayer} that appears <i>after</i> a specified
   * player in the {@link CypherPokerGame#players} array.
   *
   * @param {String} privateID The private ID of the player preceding the
   * player to return.
   *
   * @return {CypherPokerPlayer} The {@link CypherPokerPlayer} instance that
   * follows the player specified by the parameter. <code>null</code> is
   * returned if no matching player private ID can be found.
   */
   getNextPlayer(privateID) {
      for (var count=0; count < this.players.length; count++) {
         if (this.players[count].privateID == privateID) {
            return (this.players[(count+1) % this.players.length]);
         }
      }
      return (null);
   }

   /**
   * Returns the {@link CypherPokerPlayer} that appears <i>before</i> a specified
   * player in the {@link CypherPokerGame#players} array.
   *
   * @param {String} privateID The private ID of the player following the
   * player to return.
   *
   * @return {CypherPokerPlayer} The {@link CypherPokerPlayer} instance that
   * precedes the player specified by the parameter. <code>null</code> is
   * returned if no matching player private ID can be found.
   */
   getPreviousPlayer(privateID) {
      for (var count=0; count < this.players.length; count++) {
         if (this.players[count].privateID == privateID) {
            if (count == 0) {
               return (this.players[this.players.length-1]);
            } else {
               return (this.players[count-1]);
            }
         }
      }
      return (null);
   }

   /**
   * Returns the {@link CypherPokerPlayer} that is currently flagged as the dealer
   * in the {@link CypherPokerGame#players} array.
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
   * Returns the {@link CypherPokerPlayer} that is currently flagged as the big blind
   * in the {@link CypherPokerGame#players} array.
   *
   * @return {CypherPokerPlayer} The {@link CypherPokerPlayer} instance that
   * is flagged as a big blind. <code>null</code> is returned if no big blind
   * is flagged.
   */
   getBigBlind() {
      for (var count=0; count < this.players.length; count++) {
         if (this.players[count].isBigBlind) {
            return (this.players[count]);
         }
      }
      return (null);
   }

   /**
   * Returns the {@link CypherPokerPlayer} that is currently flagged as the small blind
   * in the {@link CypherPokerGame#players} array.
   *
   * @return {CypherPokerPlayer} The {@link CypherPokerPlayer} instance that
   * is flagged as a small blind. <code>null</code> is returned if no small
   * blind is flagged.
   */
   getSmallBlind() {
      for (var count=0; count < this.players.length; count++) {
         if (this.players[count].isSmallBlind) {
            return (this.players[count]);
         }
      }
      return (null);
   }

   /**
   * Sends a message to player(s) associated with this game. Table
   * information is automatically appended to the message.
   *
   * @param {String} messageType The CypherPoker.JS message type to send
   * to recipients. This should begin with "game" in order to
   * prevent conflicts with other peer-to-peer message types.
   * @param {Object} [payload=null] Additional data to include with
   * the message's <code>payload</code> property.
   * @param {Array} [privateIDs=null] The private ID(s) of the target(s) / recipient(s).
   * If <code>null</code>, the list of recipients comes from the associated
   * {@link CypherPokerGame#table}.<code>joinedPID</code> array.
   */
   sendToPlayers(messageType, payload=null, privateIDs=null) {
      this.debug("sendToPlayers(\""+messageType+"\", "+payload+", "+privateIDs+")");
      if (privateIDs == null) {
         var tablePIDs = this.cypherpoker.createTablePIDList(this.table.joinedPID, false);
      } else {
         tablePIDs = privateIDs;
      }
      var tableMessageObj = this.cypherpoker.buildCPMessage(messageType);
      this.cypherpoker.copyTable(this.table, tableMessageObj);
      tableMessageObj.payload = payload;
      this.cypherpoker.p2p.send(tableMessageObj, tablePIDs);
   }

   /**
   * Fires a "gameready" event and sends the same CypherPoker message to the
   * associated {@link table}. This function should only be called when the
   * instance is fully ready (all data loaded and parsed, references set, etc.)
   *
   * @fires CypherPokerGame#gameready
   * @private
   */
   sendGameReady() {
      var event = new Event("gameready");
      event.game = this;
      event.table = this.table;
      //dispatch the event on a brief delay to allow caller to add event listener(s)
      setTimeout((context, event)=>context.dispatchEvent(event), 50, this, event);
      var playerObj = this.getPlayer(this.ownPID);
      playerObj.ready = true;
      this.sendToPlayers("gameready", playerObj.info);
   }

   /**
   * Sends our player info to other table member(s) in a "gamehello" peer-to-peer
   * message.
   *
   * @param {Array} [privateIDs=null] The private ID(s) of the target(s) / recipient(s).
   * If <code>null</code>, the list of recipients comes from the associated
   * {@link CypherPokerGame#table}.<code>joinedPID</code> array.
   *
   * @private
   */
   sendPlayerInfo(privateIDs=null) {
      this.debug("sendPlayerInfo("+privateIDs+")");
      var playerInfo = this.getPlayerInfo(this.ownPID);
      this.sendToPlayers("gamehello", playerInfo, privateIDs);
   }

   /**
   * Sends game parameters, stored in the {@link CypherPokerGame#gameParams} object,
   * to all players associated with this game, and sets the {@link CypherPokerGame#gameStarted}
   * flag to <code>true</code>. Only the dealer (table owner) can send game paramaters
   * at the start of a new game ({@link CypherPokerGame#gameStarted} == false).
   *
   * @param {Boolean} [newGame=true] If true, new game parameters are
   * created or set (e.g. from {@link CypherPoker#settings}, prior to
   * sending them to other players.
   * @return {Promise} When resolved, a {@link CypherPokerGame#event:gameparams} event is returned. A rejection
   * may occur if required data is missing from the {@link CypherPoker#settings} object when
   * creating new game parameters
   * @fires CypherPokerGame#gameparams
   * @async
   * @private
   */
   async sendGameParams(newGame=true) {
      this.debug("sendGameParams("+newGame+")");
      if (this.gameStarted) {
         throw (new Error("Cannot send game params because game has already started."));
      }
      this._gameStarted = true; //set this first!
      if (this.getPlayer(this.ownPID).isDealer == false) {
         throw (new Error("Cannot send game params because we are not the dealer."));
      }
      if (typeof(this.cypherpoker.settings.crypto.radix) != "number") {
         //use default radix of 16 (hexadecimal), if not specified
         this.cypherpoker.settings.crypto.radix = 16;
      }
      if (newGame) {
         this._gameParams = new Object();
         var event = await this.cypherpoker.crypto.invoke("randomPrime", {bitLength:this.cypherpoker.settings.crypto.bitLength, radix:this.cypherpoker.settings.crypto.radix});
         this._gameParams.prime = event.data.result;
      }
      this.sendToPlayers("gameparams", this.gameParams);
      var event = new Event("gameparams");
      event.data = null;
      event.player = this.getPlayer(this.ownPID);
      event.game = this.game;
      event.table = this.table;
      this.dispatchEvent(event);
      return (event);
   }

   /**
   * Generates a {@link keypair} for us and optionally stores it in the first index (0) of the
   * {@link CypherPokerPlayer#keychain} array, shifting all existing keypairs to
   * the next index.
   *
   * @param {Boolean} [storeKeypair=true] If true, the newly generated {@link keypair}
   * is automatically stored to the {@link CypherPokerPlayer#keychain} array, otherwise
   * it's only returned.
   *
   * @return {Promise} The resolved promise will return the generated <code>keypair</code> property
   * or reject with an error if the {@link CypherPokerGame#gameParams} object doesn't
   * contain a valid <code>prime</code> number value.
   * @fires CypherPokerGame#gamekeypair
   * @async
   * @private
   */
   async generateKeypair(storeKeypair=true) {
      this.debug("generateKeypair()");
      if ((this.gameParams.prime == undefined) || (this.gameParams.prime == null) || (this.gameParams.prime == "")) {
         throw (new Error("Valid prime number value not found in gameParams."));
      }
      if (storeKeypair) {
         var playerRef = this.getPlayer(this.ownPID);
         playerRef.keychain.unshift(null); //add null to indicate key is being generated
      }
      var event = await this.cypherpoker.crypto.invoke("randomKeypair", {prime:this.gameParams.prime});
      var keypair = event.data.result;
      if (storeKeypair) {
         playerRef.keychain.shift(); //remove null
         playerRef.keychain.unshift(keypair);
      } else {
         playerRef = null;
      }
      var event = new Event("gamekeypair");
      event.keypair = keypair;
      event.player = this.getPlayer(this.ownPID);
      event.game = this.game;
      event.table = this.table;
      this.dispatchEvent(event);
      return (keypair);
   }

   /**
   * Generates a new card deck and sends it to the other players. This function
   * throws an error if we're not the dealer, the game hasn't started, the
   * prime number for the game hasn't been generated, or a deck already exists.
   * The generated deck is stored in the {@link CypherPokerGame#cardDecks}<code>.faceup</code>
   * array.
   *
   * @returns {Promise} A resolved promise returns an array of {@link CypherPokerCard}
   * instances. A rejected promise returns an {@link Error} object.
   * @fires CypherPokerGame#gamedeck
   * @async
   * @private
   */
   async generateCardDeck() {
      this.debug("generateCardDeck()");
      if ((this.getPlayer(this.ownPID).isDealer == false) || (this.gameStarted == false)) {
         throw (new Error("Cannot generate card deck because we are not the dealer or the game hasn't started."));
      }
      if ((this.gameParams.prime == undefined) || (this.gameParams.prime == null) || (this.gameParams.prime == "")) {
         throw (new Error("Valid prime number value not found in gameParams."));
      }
      if (this.cardDecks.faceup.length >= this.cypherpoker.settings.cards.length) {
         throw (new Error("Card deck for this game already exists."));
      }
      var event = await this.cypherpoker.crypto.invoke("randomQuadResidues", {prime:this.gameParams.prime, numValues:this.cypherpoker.settings.cards.length});
      var qrArray = event.data.result;
      this.gameParams.faceupDeck = new Array();
      for (var count = 0; count < qrArray.length; count++) {
         var newCard = new CypherPokerCard(qrArray[count], this.cypherpoker.settings.cards[count]);
         this.cardDecks.faceup.push(newCard);
      }
      this.sendToPlayers("gamedeck", qrArray);
      var event = new Event("gamedeck");
      event.data = null;
      event.player = this.getPlayer(this.ownPID);
      event.game = this.game;
      event.table = this.table;
      this.dispatchEvent(event);
      return (this.cardDecks.faceup);
   }

   /**
   * Encrypts and shuffles the a card deck stored in the {@link CypherPokerGame#cardDecks}<code>.faceup</code>
   * array, and sends the result to the table's players to continue.
   * The game must be started and a valid {@link keypair} must be present in our
   * {@link CypherPokerPlayer#keychain} array.
   *
   * @param {Array} [cardDeck=null] Indexed array of strings representing plaintext/face-up or
   * partially encrypted cards. If <code>null</code>, the values from the {@link CypherPokerGame#cardDecks}<code>.faceup</code>
   * array are used.
   *
   * @returns {Promise} A resolved promise returns an array of strings representing the
   * encrypted and shuffled cards. A rejected promise returns an {@link Error} object.
   * @async
   * @private
   */
   async encryptCards(cardDeck=null) {
      this.debug("encryptCards("+cardDeck+")");
      if (cardDeck == null) {
         if (this.cardDecks.faceup.length == 0) {
            throw (new Error("Card deck for this game not yet generated."));
         }
         cardDeck = new Array();
         for (var count=0; count < this.cardDecks.faceup.length; count++) {
            cardDeck.push(this.cardDecks.faceup[count].mapping);
         }
      }
      var promises = new Array();
      var keypair = this.getPlayer(this.ownPID).keychain[0];
      if (keypair == null) {
         //keypair is still being generated
         var event = await this.onEventPromise("gamekeypair");
         keypair = this.getPlayer(this.ownPID).keychain[0];
      }
      for (var count=0; count < cardDeck.length; count++) {
         promises.push(this.cypherpoker.crypto.invoke("encrypt", {value:cardDeck[count], keypair:keypair}));
      }
      var promiseResults = await Promise.all(promises);
      var encryptedDeck = new Array();
      for (count=0; count < promiseResults.length; count++) {
         encryptedDeck.push(promiseResults[count].data.result);
      }
      var shuffledDeck = await this.shuffle(encryptedDeck);
      this.sendToPlayers("gamecardsencrypt", shuffledDeck);
      return (shuffledDeck);
   }

   /**
   * Decrypts card selections and sends the results back to the table if this is not
   * the terminating decryption.
   *
   * @param {Object} payload An CypherPoker.JS game message payload object containing information
   * about the cards to decrypt and / or store.
   * @param {Array} payload.selected Strings representing the encrypted cards to decrypt.
   * @param {Array} payload.facedown Face-down cards remaining in the active deck.
   * This array will be copied to the {@link CypherPokerGame#cardDecks}<code>.facedown</code> array.
   * @param {Array} payload.dealt An array of face-down cards that have been dealt so far.
   * This array will be copied to the {@link CypherPokerGame#cardDecks}<code>.dealt</code>
   * array.
   * @param {String} payload.sourcePID The private ID of the player that made the initial card
   * selection.
   * @param {String} payload.fromPID The private ID of the player that sent the data contained
   * in the <code>payload</code> parameter.
   * @param {Boolean} payload.private If true, the <code>payload.selected</code> array contains
   * private cards, otherwise they're public.
   *
   * @returns {Promise} A resolved promise returns an array of the partially decrypted
   * strings of the input card selections, an array of face-up {@link CypherPokerCard}
   * instances if we've performed the final decryption on the input, or <code>null</code>
   * if the <code>payload</code> is not intended for us. A rejected promise
   * returns an {@link Error} object.
   * @async
   * @private
   * @todo Add additional verifications to ensure selection is valid for player and game state.
   */
   async decryptCards(payload) {
      this.debug("decryptCards("+payload+")");
      var fromPID = payload.fromPID; //sender of object
      var sourcePID = payload.sourcePID; //player that selected the card decryption
      var selectedCards = payload.selected; //currently encrypted card values
      var sourcePlayer = this.getPlayer(sourcePID); //CypherPokerPlayer instance of sourcePID
      var previousUsPlayer = this.getPreviousPlayer(this.ownPID); //CypherPokerPlayer instance of us
      var previousFromPlayer = this.getPreviousPlayer(fromPID); //CypherPokerPlayer instance of fromPID
      var privateDeal = payload.private; //are these private cards?
      var promises = new Array();
      var keypair = this.getPlayer(this.ownPID).keychain[0];
      var decryptedCards = new Array();
      if (privateDeal) {
         //private cards
         if (payload.fromPID != this.getPreviousPlayer(this.ownPID).privateID) {
            return (null);
         }
         for (var count=0; count < selectedCards.length; count++) {
            promises.push(this.cypherpoker.crypto.invoke("decrypt", {value:selectedCards[count], keypair:keypair}));
         }
         var promiseResults = await Promise.all(promises);
         for (count=0; count < promiseResults.length; count++) {
            decryptedCards.push(promiseResults[count].data.result);
         }
         if (sourcePID == this.ownPID) {
            //decrypted our own private cards
            for (count=0; count < decryptedCards.length; count++) {
               var mapping = decryptedCards[count];
               var cardRef = this.getMappedCard(mapping);
               this.getPlayer(this.ownPID).dealtCards.push(cardRef);
            }
            this.postAutoBlinds();
            var event = new Event("gamedeal");
            event.cards = Array.from(this.getPlayer(this.ownPID).dealtCards);
            event.private = true;
            event.game = this;
            event.table = this.table;
            this.dispatchEvent(event);
         } else if (sourcePID != this.ownPID) {
            //partially decrypted another player's private cards, send to next player
            payload.selected = decryptedCards;
            this.sendToPlayers("gamedeal", payload);
         }
      } else {
         //public cards
         if ((payload.cards != undefined) && (payload.cards != null)) {
            //fully decrypted public cards included in payload, just store them
            var newCards = new Array(); //stores only the new cards, not all public cards
            for (count=0; count < payload.cards.length; count++) {
               var mapping = payload.cards[count];
               var cardRef = this.getMappedCard(mapping);
               this.cardDecks.public.push(cardRef);
               newCards.push(cardRef);
            }
            var event = new Event("gamedeal");
            event.cards = newCards;
            event.private = false;
            event.game = this;
            event.table = this.table;
            this.dispatchEvent(event);
            return(newCards);
         }
         if (payload.fromPID != this.getPreviousPlayer(this.ownPID).privateID) {
            return (null);
         }
         for (count=0; count < selectedCards.length; count++) {
            promises.push(this.cypherpoker.crypto.invoke("decrypt", {value:selectedCards[count], keypair:keypair}));
         }
         promiseResults = await Promise.all(promises);
         for (count=0; count < promiseResults.length; count++) {
            decryptedCards.push(promiseResults[count].data.result);
         }
         if (sourcePID == this.ownPID) {
            //decrypted public cards we selected (final decryption)
            newCards = new Array();
            for (count=0; count < decryptedCards.length; count++) {
               var mapping = decryptedCards[count];
               var cardRef = this.getMappedCard(mapping);
               this.cardDecks.public.push(cardRef);
               newCards.push(cardRef);
            }
            var event = new Event("gamedeal");
            event.cards = newCards;
            event.private = false;
            event.game = this;
            event.table = this.table;
            this.dispatchEvent(event);
            //send new, face-up public cards to fellow players
            payload.cards = decryptedCards;
            this.sendToPlayers("gamedeal", payload);
         } else if (sourcePID != this.ownPID) {
            //partially-decrypted public cards, send to next player
            payload.selected = decryptedCards;
            this.sendToPlayers("gamedeal", payload);
         }
      }
      return (decryptedCards);
   }

   /**
   * Returns a {@link CypherPokerCard} instance from the {@link CypherPokerGame#cardDecks}<code>.faceup</code>
   * array based on its mapping.
   *
   * @param {String} mapping The card mapping (quadratic residue value), of the card to retrieve.
   *
   * @return {CypherPokerCard} The matching card instance or <code>null</code> if no such card
   * exists.
   */
   getMappedCard (mapping) {
      if ((mapping == null) || (mapping == undefined) || (mapping == "")) {
         return (null);
      }
      for (var count=0; count < this.cardDecks.faceup.length; count++) {
         if (this.cardDecks.faceup[count].mapping == mapping) {
            return (this.cardDecks.faceup[count]);
         }
      }
      return (null);
   }

   /**
   * Shuffles an array of elements a specified number of times using the
   * most cryptographically secure pseudo-random number generator available.
   *
   * @param {Array} inputArr The array to copy and shuffle.
   * @param {Number} [numTimes=10] The number of full-length shuffle rounds
   * to apply. Using 0 returns an unshuffled copy of the input array.
   * @return {Array} A copy of the input array shuffled the specified number
   * of times.
   *
   * @async
   * @private
   */
   async shuffle(inputArr, numTimes=10) {
      //maybe this could be done in SRACryptoWorker.js?
      var spliceArr;
      var outputArr = Array.from(inputArr);
      for (var count=0; count < numTimes; count++) {
         spliceArr = Array.from(outputArr);
         outputArr = new Array();
         try {
            //use crypto interface if available
            var spliceIndexes = new Uint32Array(spliceArr.length);
            crypto.getRandomValues(spliceIndexes);
         } catch (err) {
            //use less secure method
            spliceIndexes = new Array();
            for (var count2=0; count2 < spliceArr.length; count2++) {
               spliceIndexes.push(Math.round(Math.random() * Number.MAX_SAFE_INTEGER));
            }
         }
         var indexCount = 0;
         while (spliceArr.length > 0) {
            var spliceIndex = spliceIndexes[indexCount] % spliceArr.length;
            var splicedValue = spliceArr.splice(spliceIndex, 1)[0];
            outputArr.push(splicedValue);
            indexCount++;
         }
      }
      return (outputArr);
   }

   /**
   * Checks if a game associated with a specific {@link CypherPoker#TableObject} instance
   * is registered with the parent {@link CypherPoker} instance.
   *
   * @param {CypherPoker#TableObject} tableObj The associated table to check for.
   *
   * @return {Boolean} True if the table has been associated with an existing
   * {@link CypherPokerGame} instance in the parent {@link CypherPoker}.
   */
   gameExists(tableObj) {
      for (var count=0; count < this.cypherpoker.games.length; count++) {
         var currentTable = this.cypherpoker.games[count].table;
         if ((currentTable.tableID == tableObj.tableID) &&
            (currentTable.tableName == tableObj.tableName) &&
            (currentTable.ownerPID == tableObj.ownerPID)) {
               return (true);
         }
      }
      return (false);
   }

   /**
   * Returns true if the supplied JSON-RPC result structure contains the same
   * {@link CypherPoker#TableObject} identifiers as the table associated with this game instance.
   *
   * @param {Object} msgResultObj The JSON-RPC result object to check.
   *
   * @return {Boolean} True if the supplied table has the same identifiers
   * (table ID, table name, table owner, member private ID), as the one associated
   * with this game.
   * @private
   */
   matchesThisTable(msgResultObj) {
      if (typeof(msgResultObj) != "object") {
         return (false);
      }
      if ((msgResultObj.data == null) || (msgResultObj.data == undefined)) {
         return (false);
      }
      if ((this.table.tableID == msgResultObj.data.tableID) &&
         (this.table.tableName == msgResultObj.data.tableName) &&
         (this.table.ownerPID == msgResultObj.data.ownerPID)) {
            var fromPID = msgResultObj.from;
            for (var count=0; count < this.players.length; count++) {
               if (this.players[count].privateID == fromPID) {
                  return (true);
               }
            }
      }
      return (false);
   }

   /**
   * Places a bet during the current round of betting, if allowed, and sends the
   * action to other players at the table.
   *
   * @param {Number|String} betAmount The bet amount to place. A 0 bet is
   * a check or call and a bet of less than 0 is a fold.
   *
   * @return {Promise} The promise is resolved with a <code>true</code> result
   * if the bet was successfully placed and rejected with an <code>Error</code> if the bet
   * could not be placed.
   * @async
   */
   placeBet(betAmount) {
      if (this.canBet == false) {
         throw (new Error("Can't place a bet in current game state."));
      }
      betAmount = bigInt(betAmount);
      var betObj = new Object();
      betObj.fold = false;
      betObj.amount = "0";
      if (betAmount.lesser(0)) {
         //we are folding
         this.getPlayer(this.ownPID).hasFolded = true;
         betObj.fold = true;
         betObj.amount = null;
      }
      var minBet = this.minimumBet;
      if ((this.cardDecks.public.length == 0) &&
         (this.getPlayer(this.ownPID).dealtCards.length == 2) &&
         (this.getPlayer(this.ownPID).totalBet.equals(0)) &&
         (this.getPlayer(this.ownPID).isSmallBlind)) {
            //placing intial bet as small blind
      } else {
         if (betAmount.lesser(minBet) && (betObj.fold == false)) {
            throw (new Error("Bet amount must be at least \"" + minBet.toString(10) + "\"."));
         }
      }
      var biggestBet = this.largestBet;
      if (betAmount.greaterOrEquals(0)) {
         var totalCurrentBet = this.getPlayer(this.ownPID).totalBet.add(betAmount);
         if (totalCurrentBet.equals(biggestBet)) {
            //we are checking / calling
            this.getPlayer(this.ownPID).totalBet = totalCurrentBet;
            this.getPlayer(this.ownPID).hasBet = true;
            betObj.amount = betAmount.toString(10);
         } else if (totalCurrentBet.greater(biggestBet)) {
            //we are raising
            this.getPlayer(this.ownPID).totalBet = totalCurrentBet;
            this.getPlayer(this.ownPID).hasBet = true;
            for (var count = 0; count < this.players.length; count++) {
               if (this.players[count].privateID != this.ownPID) {
                  this.players[count].hasBet = false;
               }
            }
            betObj.amount = betAmount.toString(10);
         } else {
            throw (new Error("Bet amount insufficient for current round."));
         }
         this.pot = this.pot.add(betAmount);
      }
      this.sendToPlayers("gamebet", betObj);
      var numFolded = 0;
      for (count = 0; count < this.players.length; count++) {
         if (this.players[count].hasFolded) {
            numFolded++;
         }
      }
      if ((numFolded == (this.players.length - 1)) || this.gameDone) {
         //all players (except one) have folded or game is done
         this.endGame();
      }
      return (true);
   }

   /**
   * Ends the current game (hand), and optionally resets the instance for the next
   * game (hand).
   *
   * @param {Boolean} [restart=false] If true, the instance is ended and reset to prepare for
   * a new game (hand), otherwise the game is only ended.
   *
   * @return {Promise} Resolves with a result of <code>true</code> when the game is
   * completely ended and optionally restarted.
   * @fires CypherPokerGame#gameend
   * @async
   */
   async endGame (restart=false) {
      this.debug ("endGame("+restart+")");
      this._gameStarted = false;
      var event = new Event("gameend");
      event.table = this.table;
      event.game = this;
      this.dispatchEvent(event);
      if (restart) {
         this.restartGame();
      }
      return (true);
   }

   /**
   * Attempts to restart the game by resetting all cards and player selections,
   * shifting player roles, and finally starting the game (if we're the current dealer).
   */
   async restartGame() {
      this.resetPlayerStates(true, true, true);
      this.cardDecks.public = new Array();
      this.cardDecks.dealt = new Array();
      this.cardDecks.faceup = new Array();
      this.cardDecks.facedown = new Array();
      var nextDealerPID = this.getNextPlayer(this.getDealer().privateID).privateID;
      for (var count=0; count < this.players.length; count++) {
         this.players[count].selectedCards = new Array();
         this.players[count].dealtCards = new Array();
         this.players[count].isBigBlind = false;
         this.players[count].isSmallBlind = false;
         this.players[count].isDealer = false;
      }
      this.assignPlayerRoles(nextDealerPID);
      this._gameParams = new Object();
      try {
         var event = await this.sendGameParams(true);
         event = await this.generateKeypair();
         event = await this.generateCardDeck();
         event = await this.encryptCards();
      } catch (err) {
         //anyone but the current dealer will throw an error in sendGameParams
      }
   }

   /**
   * Deals cards by removing random selections from the
   * {@link CypherPokerGame#cardDecks}<code>.facedown</code> array, adding them
   * them the {@link CypherPokerGame#cardDecks}<code>.dealt</code> array,
   * sending the resulting arrays to the table, and requesting a decryption for
   * the selections.
   *
   * @param {Number} [numCards=0] The number of cards to select. If this
   * value is less than 1, the required cards are automatically determined using our
   * {@link CypherPokerPlayer}<code>.dealtCards</code> array or the
   * {@link CypherPokerGame#cardDecks}<code>.public</code> array, depending on
   * the current game state.
   *
   * @return {Promise} The promise resolves with an array of selected face-down or
   * encrypted card values, or rejects with an error if something went wrong.
   * @fires CypherPokerGame#gamedealprivate
   * @fires CypherPokerGame#gamedealpublic
   * @async
   */
   async dealCards(numCards=0) {
      this.debug("dealCards("+numCards+")");
      if (this.canDeal == false) {
         throw (new Error("Can't initiate a card deal in current game state."));
      }
      var player = this.getPlayer(this.ownPID);
      var privateDeal = true;
      if (numCards < 1) {
         if (player.dealtCards.length < 2) {
            //hole cards
            numCards = 2;
         } else {
            privateDeal = false;
            if (this.cardDecks.public.length < 3) {
               //flop cards
               numCards = 3;
            } else {
               //post-flop cards
               numCards = 1;
            }
         }
      }
      try {
         //use crypto interface if available
         var spliceIndexes = new Uint32Array(numCards);
         crypto.getRandomValues(numCards);
      } catch (err) {
         //use less secure method
         spliceIndexes = new Array();
         for (var count2=0; count2 < numCards; count2++) {
            spliceIndexes.push(Math.round(Math.random() * Number.MAX_SAFE_INTEGER));
         }
      }
      var selectedCards = new Array();
      while (numCards > 0) {
         var spliceIndex = spliceIndexes.splice(0,1)[0] % this.cardDecks.facedown.length;
         var selectedCard = this.cardDecks.facedown.splice(spliceIndex, 1)[0];
         selectedCards.push(selectedCard);
         if (privateDeal) {
            player.selectedCards.push(selectedCard);
         }
         this.cardDecks.dealt.push(selectedCard);
         numCards--;
      }
      var deal = new Object();
      deal.selected = selectedCards;
      deal.facedown = this.cardDecks.facedown;
      deal.dealt = this.cardDecks.dealt;
      deal.sourcePID = this.ownPID;
      if (privateDeal) {
         deal.private = true;
         var event = new Event("gamedealprivate");
      } else {
         deal.private = false;
         event = new Event("gamedealpublic");
      }
      event.selected = selectedCards;
      event.player = this.getPlayer(this.ownPID);
      event.table = this.table;
      event.game = this;
      this.dispatchEvent(event);
      this.sendToPlayers("gamedeal", deal);
      return (selectedCards);
   }

   /**
   * Automatically posts a blind bet it we're a blind, it's the start of
   * a hand, and we haven't bet yet.
   *
   * @private
   */
   postAutoBlinds() {
      //only if enabled
      if (this.autoBlinds && this.canBet) {
         if (this.getBigBlind().privateID == this.ownPID) {
            //acting as big blind
            if (this.getPlayer(this.ownPID).totalBet.equals(0)) {
               if (this.table.tableInfo.bigBlind != undefined) {
                  this.placeBet(this.table.tableInfo.bigBlind);
               }
            }
         }
         if (this.getSmallBlind().privateID == this.ownPID) {
            //acting as small blind
            if (this.getPlayer(this.ownPID).totalBet.equals(0)) {
               if (this.table.tableInfo.smallBlind != undefined) {
                  this.placeBet(this.table.tableInfo.smallBlind);
               }
            }
         }
      }
   }

   /**
   * Handles a peer-to-peer message event dispatched by the communication
   * interface of the parent {@link CypherPoker} instance.
   *
   * @param {Event} event A "message" event dispatched by the communication interface.
   * A <code>data</code> property is expected to contain the parsed JSON-RPC 2.0
   * message received.
   * @fires CypherPokerGame#gamehello
   * @fires CypherPokerGame#gameplayerready
   * @fires CypherPokerGame#gameparams
   * @fires CypherPokerGame#gamedeck
   * @fires CypherPokerGame#gamebet
   * @private
   * @async
   */
   async handleP2PMessage(event) {
      if (this.cypherpoker.isCPMsgEvent(event) == false) {
         //don't process any further
         return;
      }
      var resultObj = event.data.result;
      if (this.matchesThisTable(resultObj) == false) {
         //included table information doesn't match this game's table
         return;
      }
      var message = resultObj.data;
      var payload = message.payload; //similar to a generic "tableInfo" object
      var fromPID = event.data.result.from;
      var tableID = message.tableID;
      var tableName = message.tableName;
      var ownerPID = message.ownerPID;
      var tableInfo = message.tableInfo;
      var messageType = message.cpMsg;
      var player = this.getPlayer(fromPID);
      this.debug("CypherPokerGame.handleP2PMessage("+event+") => \""+messageType+"\"");
      switch (messageType) {
         case "gameready":
            player.ready = true;
            this.sendPlayerInfo([fromPID]);
            var event = new Event("gameplayerready");
            event.data = event.data;
            event.player = player;
            event.game = this.game;
            event.table = this.table;
            this.dispatchEvent(event);
            break;
         case "gamehello":
            if (player.ready == false) {
               //we weren't ready for this player's "gameready"
               player.ready = true;
               this.sendPlayerInfo([fromPID]);
               event = new Event("gameplayerready");
               event.data = event.data;
               event.player = player;
               event.game = this.game;
               event.table = this.table;
               this.dispatchEvent(event);
            }
            player.info = payload;
            event = new Event("gamehello");
            event.data = event.data;
            event.player = player;
            event.game = this.game;
            event.table = this.table;
            this.dispatchEvent(event);
            for (var count=0; count < this.players.length; count++) {
               if (this.players[count].ready == false) {
                  return;
               }
            }
            //all players are now ready - send game parameters
            try {
               event = await this.sendGameParams(true);
               event = await this.generateKeypair();
               event = await this.generateCardDeck();
               event = await this.encryptCards();
            } catch (err) {
               //anyone but the dealer will throw an error in sendGameParams
            }
            break;
         case "gameparams":
            this._gameParams = payload;
            event = new Event("gameparams");
            event.data = event.data;
            event.player = player;
            event.game = this.game;
            event.table = this.table;
            this.dispatchEvent(event);
            try {
               var event = await this.generateKeypair();
            } catch (err) {
               this.debug(err, "err");
            }
            break;
         case "gamedeck":
            if (this.cardDecks.faceup.length >= this.cypherpoker.settings.cards.length) {
               throw (new Error("A deck for this game has already been generated."));
            }
            for (count=0; count < payload.length; count++) {
               var newCard = new CypherPokerCard(payload[count], this.cypherpoker.settings.cards[count]);
               this.cardDecks.faceup.push(newCard);
            }
            event = new Event("gamedeck");
            event.data = event.data;
            event.player = player;
            event.game = this.game;
            event.table = this.table;
            this.dispatchEvent(event);
            break;
         case "gamecardsencrypt":
            if (this.getNextPlayer(fromPID).isDealer) {
               //next player after sender is dealer
               if (this.getPlayer(this.ownPID).isDealer) {
                  //I'm the dealer
                  this.cardDecks.facedown = Array.from(payload);
               } else {
                  //I'm a player between the dealer and the last player
                  this.cardDecks.facedown = Array.from(payload);
               }
            } else {
               if (this.getPreviousPlayer(this.ownPID).privateID == fromPID) {
                  //continuing encryption from previous player
                  var encDeck = await this.encryptCards(payload);
                  if (this.getNextPlayer(this.ownPID).isDealer == true) {
                     //I'm a player between the dealer and the last player
                     this.cardDecks.facedown = Array.from(encDeck);
                  }
               }
            }
            if (this.cardDecks.facedown.length > 0) {
               //for naming consistency, dealer chooses their cards first
               if (this.getPlayer(this.ownPID).isDealer) {
                  this.resetPlayerStates(false, true, false);
                  this.dealCards();
               }
            }
            break;
         case "gamedeal":
            payload.fromPID = fromPID;
            //store encrypted private card selections for a player
            if ((payload.private == true) && (payload.sourcePID == fromPID)) {
               for (var count = 0; count < payload.selected.length; count++) {
                   for (var count2 = (this.cardDecks.facedown.length-1); count2 >= 0; count2--) {
                      if (this.cardDecks.facedown[count2] == payload.selected[count]) {
                         this.cardDecks.dealt.push(this.cardDecks.facedown[count2]);
                         //todo: ensure that this only gets done once!
                         this.getPlayer(fromPID).selectedCards.push(this.cardDecks.facedown[count2]);
                         this.cardDecks.facedown.splice(count2, 1);
                      }
                   }
               }
            }
            if (this.bettingDone) {
               this.resetPlayerStates(false, true, false);
            }
            //attempt to decrypt the deck
            try {
               var decryptedCards = await this.decryptCards(payload);
               if (this.getPlayer(this.ownPID).selectedCards.length < this.getPreviousPlayer(this.ownPID).selectedCards.length) {
                  //our turn to select (deal our own) cards
                  this.dealCards();
               }
            } catch (err) {
               this.debug(err, "err");
            }
            break;
         case "gamebet":
            if (payload.fold == true) {
               this.getPlayer(fromPID).hasFolded = true;
               this.getPlayer(fromPID).hasBet = true;
            } else {
               //todo: check to make sure bet amount is valid
               var betAmount = bigInt(payload.amount);
               this.pot = this.pot.add(betAmount);
               this.getPlayer(fromPID).totalBet = this.getPlayer(fromPID).totalBet.add(betAmount);
               this.getPlayer(fromPID).hasBet = true;
               var raise = false;
               for (var count = 0; count < this.players.length; count++) {
                  if (this.getPlayer(fromPID).totalBet.greater(this.players[count].totalBet) && this.players[count].hasBet) {
                     raise = true;
                     break;
                  }
               }
               if (raise) {
                  for (var count = 0; count < this.players.length; count++) {
                     if (this.players[count].privateID != fromPID) {
                        this.players[count].hasBet = false;
                     }
                  }
               }
            }
            var numFolded = 0;
            for (count = 0; count < this.players.length; count++) {
               if (this.players[count].hasFolded) {
                  numFolded++;
               }
            }
            this.postAutoBlinds();
            event = new Event("gamebet");
            event.amount = String(payload.amount);
            event.player = this.getPlayer(fromPID);
            event.game = this;
            event.table = this;
            this.dispatchEvent(event);
            if ((numFolded == (this.players.length - 1)) || this.gameDone) {
               //all remaining players have folded or game is done
               this.endGame();
            }
            break;
         default:
            //not a recognized CypherPoker.JS game message type
            break;
      }
   }

   /**
   * @private
   */
   toString() {
      return ("[object CypherPokerGame]");
   }

}
