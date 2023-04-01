/**
 * @file Information management for an individual CypherPoker.JS player.
 *
 * @version 0.4.1
 * @author Patrick Bay
 * @copyright MIT License
 */

/**
 * @class Stores and manages information for a player associated with a
 * {@link CypherPokerGame} instance.
 *
 * @extends EventDispatcher
 */
class CypherPokerPlayer extends EventDispatcher {
   /**
    * Creates a new instance to track an individual player's
    * information.
    *
    * @param {String} PID The private ID of the player to associate
    * with this instance.
    * @param {Object} [playerInfo=null] Extended information for the player
    * to associate with this instance.
    */
   constructor(PID, playerInfo = null) {
      super();
      this._privateID = PID;
      this._info = playerInfo;
      this._ready = false;
      this._isDealer = false;
      this._totalStreetBet = 0;
   }

   /**
    * @property {String} privateID The private ID of the player associated
    * with this instance, as set at instantiation.
    */
   get privateID() {
      return this._privateID;
   }

   /**
    * @property {Boolean} ready=false Set to true when the associated player has
    * signalled that they're ready (their game instance has fully loaded and initialized).
    */
   get ready() {
      return this._ready;
   }

   set ready(readySet) {
      this._ready = readySet;
   }

   /**
    * @property {CypherPokerAccount} account=null The {@link CypherPokerAccount} instance
    * associated with this player instance.
    */
   get account() {
      if (this._account == undefined) {
         this._account = null;
      }
      return this._account;
   }

   set account(accountSet) {
      this._account = accountSet;
   }

   /**
    * @property {Boolean} isDealer=false Set to true when the associated player
    * becomes the dealer for the associated game.
    */
   get isDealer() {
      return this._isDealer;
   }

   set isDealer(dealerSet) {
      this._isDealer = dealerSet;
   }

   /**
    * @property {Boolean} isBigBlind=false Set to true when the associated player
    * becomes the big blind for the associated game.
    */
   get isBigBlind() {
      if (this._isBigBlind == undefined) {
         this._isBigBlind = false;
      }
      return this._isBigBlind;
   }

   set isBigBlind(bbSet) {
      this._isBigBlind = bbSet;
   }

   /**
    * @property {Boolean} isSmallBlind=false Set to true when the associated player
    * becomes the small blind for the associated game.
    */
   get isSmallBlind() {
      if (this._isSmallBlind == undefined) {
         this._isSmallBlind = false;
      }
      return this._isSmallBlind;
   }

   set isSmallBlind(sbSet) {
      this._isSmallBlind = sbSet;
   }

   /**
    * @property {Object} info=null Additional information for the player as
    * supplied during instantiation.
    */
   get info() {
      if (this._info == undefined) {
         this._info = null;
      }
      return this._info;
   }

   set info(infoObj) {
      this._info = infoObj;
   }

   /**
    * @property {Array} selectedCards Indexed array of strings representing
    * encrypted private cards dealt to (selected by), the player.
    */
   get selectedCards() {
      if (this._selectedCards == undefined) {
         this._selectedCards = new Array();
      }
      return this._selectedCards;
   }

   set selectedCards(cardsArr) {
      this._selectedCards = cardsArr;
   }

   /**
    * @property {Array} dealtCards Indexed array of unencrypted or plaintext
    * private {@link CypherPokerCard} instances that have been dealt to (selected by),
    * the player.
    */
   get dealtCards() {
      if (this._dealtCards == undefined) {
         this._dealtCards = new Array();
      }
      return this._dealtCards;
   }

   set dealtCards(cardsArr) {
      this._dealtCards = cardsArr;
   }

   /**
    * @property {BigInteger} totalBet The total bet amount placed by the player in the current game (hand)
    * in the smallest denomination of the target currency (e.g. Satoshis if using Bitcoin, pennies
    * is using dollars, etc.) When setting this value, a <code>Number</code> or <code>String</code>
    * may be used which will be cast to a <code>BigInteger</code> object.
    */
   get totalBet() {
      if (this._totalBet == undefined) {
         this._totalBet = bigInt(0);
      }
      return this._totalBet;
   }

   set totalBet(betAmount) {
      this._totalBet = new bigInt(betAmount);
   }

   /**
    * @property {BigInteger} balance="0" The current in-game balance. Note that
    * this is different than the [CypherPokerAccount.balance]{@link CypherPokerAccount#balance} property
    * which reflects the total balance for the account.
    */
   set balance(balanceSet) {
      this._balance = bigInt(balanceSet);
   }

   get balance() {
      if (this._balance == undefined) {
         this._balance = bigInt(0);
      }
      return this._balance;
   }

   /**
    * @property {numActions} numActions=0 The number of betting actions (bet or fold),
    * comitted by the player.
    */
   get numActions() {
      if (this._numActions == undefined) {
         this._numActions = 0;
      }
      return this._numActions;
   }

   set numActions(actionSet) {
      this._numActions = actionSet;
   }

   /**
    * @property {Boolean} hasBet=false True if the player has placed a bet or
    * checked/called during the current round of betting, false if the player has
    * not yet bet or if another player has raised.
    */
   get hasBet() {
      if (this._hasBet == undefined) {
         this._hasBet = false;
      }
      return this._hasBet;
   }

   set hasBet(betSet) {
      this._hasBet = betSet;
   }

   /**
    * @property {Boolean} hasFolded=false True if the player has folded in this
    * game (hand).
    */
   get hasFolded() {
      if (this._hasFolded == undefined) {
         this._hasFolded = false;
      }
      return this._hasFolded;
   }

   set hasFolded(foldSet) {
      this._hasFolded = foldSet;
   }

   /**
    * @property {Array} keychain Indexed array of {@link keypair}
    * objects used by the player. These are stored in ascending order with index 0
    * being the newest keypair. For other players in a game, this array will
    * typically remain empty until the end of the game (verification). After a game
    * ends this array should be archived if needed as it is usually reset at the
    * start of a new game (hand).
    * @readonly
    */
   get keychain() {
      if (this._keychain == undefined) {
         this._keychain = new Array();
      }
      return this._keychain;
   }

   /**
    * Returns a condensed data object containing the properties of this instance.
    * Use the returned object to <code>JSON.stringify</code> instead of the instance
    * directly as it contains circular references.
    *
    * @param {Boolean} [includeKeychain=false] If true, the keychain will be included
    * with the returned data, otherwise if will be omitted.
    * @param {Boolean} [includeAccountPassword=false] If true, the password stored in
    * the [account]{@link CypherPokerPlayer#account} reference will be included in the
    * returned data, if available.
    *
    * @return {Object} The condensed data object containing copies of this instance's
    * properties.
    */
   toObject(includeKeychain = false, includeAccountPassword = false) {
      var returnObj = new Object();
      returnObj.privateID = this.privateID;
      returnObj.info = this.info;
      if (this.account != null) {
         returnObj.account = this.account.toObject(includeAccountPassword);
      } else {
         returnObj.account = null;
      }
      returnObj.dealtCards = Array.from(this.dealtCards);
      returnObj.selectedCards = Array.from(this.selectedCards);
      returnObj.hasBet = this.hasBet;
      returnObj.hasFolded = this.hasFolded;
      returnObj.isDealer = this.isDealer;
      returnObj.isSmallBlind = this.isSmallBlind;
      returnObj.isBigBlind = this.isBigBlind;
      returnObj.totalBet = this.totalBet.toString(10);
      returnObj.balance = this.balance.toString(10);
      returnObj.ready = this.ready;
      if (includeKeychain) {
         returnObj.keychain = Array.from(this.keychain);
      }
      return returnObj;
   }

   /**
    * Creates a copy of this instance and returns that copy.
    *
    * @return {CypherPokerPlayer} A new player instance with the properties
    */
   copy() {
      var returnPlayer = new CypherPokerPlayer(this.privateID, this.info);
      returnPlayer._account = this.account;
      returnPlayer._dealtCards = Array.from(this.dealtCards);
      returnPlayer._selectedCards = Array.from(this.selectedCards);
      returnPlayer._hasBet = this.hasBet;
      returnPlayer._hasFolded = this.hasFolded;
      returnPlayer._isDealer = this.isDealer;
      returnPlayer._isSmallBlind = this.isSmallBlind;
      returnPlayer._isBigBlind = this.isBigBlind;
      returnPlayer._totalBet = this.totalBet.toString(10);
      returnPlayer._balance = this.balance.toString(10);
      returnPlayer._ready = this.ready;
      returnPlayer._keychain = Array.from(this.keychain);
      return returnPlayer;
   }

   /**
    * Irrevocably resets the [keychain]{@link CypherPokerPlayer#keychain} array (to an
    * empty array).
    */
   resetKeychain() {
      this._keychain = new Array();
   }

   /**
    * @private
    */
   toString() {
      return '[object CypherPokerPlayer "' + this.privateID + '"]';
   }
}
