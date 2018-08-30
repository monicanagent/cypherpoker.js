/**
* @file Monitors and analyzes a CypherPoker game (hand) for cryptographic correctness
* and ranks the completed hands of the game to determine the winner.
*
* @version 0.0.1
* @author Patrick Bay
* @copyright MIT License
*/

/**
* @class Monitors and analyzes a CypherPoker game (hand) for cryptographic correctness
* and ranks the completed hands of the game to determine the winner.
*/
class CypherPokerAnalyzer {

   /**
   * Creates a new instance.
   *
   * @param {CypherPokerGame} game The game instance with which this instance
   * is to be associated. Event listeners are added to the {@link CypherPokerGame}
   * instance at this time so the analyzer should usually be instantiated at the
   * very beginning of a new game (hand).
   *
   */
   constructor(game) {
      this._game = game;
      this.game.addEventListener("gamecardsencrypt", this.onEncryptCards, this);
      this.game.addEventListener("gamedealmsg", this.onGameDealMessage, this);
      this.game.addEventListener("gamedealprivate", this.onSelectCards, this);
      this.game.addEventListener("gamedealpublic", this.onSelectCards, this);
      this.game.addEventListener("gamedeal", this.onCardDeal, this);
      this.game.addEventListener("gamedecrypt", this.onGameDecrypt, this);
      this.game.addEventListener("gameanalyze", this.onGameAnalyze, this);
      this.game.addEventListener("gameplayerkeychain", this.onPlayerKeychain, this);
   }

   /**
   * @property {Number} keychainCommitTimeout=10000 The amount of time, in milliseconds,
   * to wait at the end of a game for all players' keychains to be comitted before timing out.
   */
   get keychainCommitTimeout() {
      if (this._keychainCommitTimeout == undefined) {
         this._keychainCommitTimeout = 10000;
      }
      return (this._keychainCommitTimeout);
   }

   set keychainCommitTimeout (KRSTSet) {
      this._keychainCommitTimeout = KRSTSet;
   }

   /**
   * Called when the keychain submission timer elapses and not all players have
   * committed their keychains.
   *
   * @param {CypherPokerAnalayzer} context The execution context of the instance.
   * @param {CypherPokerGame} game The game instance for which the timeout
   * occurred.
   * @private
   */
   onKCSTimeout(context, game) {
      throw (new Error("Not all players have committed their keychains in time (table ID: "+game.table.tableID+")"));
   }

   /**
   * @property {Boolean} allKeychainsCommitted True when all players associated
   * with the {@link CypherPokerAnalyzer#game} instance have committed an
   * end-game keychain.
   *
   */
   get allKeychainsCommitted() {
      if (this._keychains == undefined) {
         this._keychains = new Object();
      }
      var allPlayersCommitted = true;
      for (var count=0; count < this.game.players.length; count++) {
         var player = this.game.players[count];
         if (this._keychains[player.privateID] == undefined) {
            this._keychains[player.privateID] = Array.from(player.keychain);
         }
         var keychain = this._keychains[player.privateID];
         if (keychain.length == 0) {
            allPlayersCommitted = false;
            break;
         }
      }
      if (allPlayersCommitted) {
         return (true);
      }
      return (false);
   }

   /**
   * @property {Array} communityCards=[] An array of {@link CypherPokerCard}
   * instances of the community cards reported by the final decryptors.
   *
   * @readonly
   */
   get communityCards() {
      if (this._communityCards == undefined) {
         this._communityCards = new Array();
      }
      return (this._communityCards);
   }

   /**
   * @property {Object} privateCards={} An object of named arrays, with each
   * array named using the private ID of the associated player and containing
   * the {@link CypherPokerCard} instances of the decrypted private cards for
   * that player.
   *
   * @readonly
   */
   get privateCards() {
      if (this._privateCards == undefined) {
         this._privateCards = new Object();
      }
      return (this._privateCards);
   }

   /**
   * @property {Array} deck An array of named objects, with each
   * array element storing an object representing a snapshot of the
   * deck generation and encryption processes.
   *
   * @readonly
   */
   get deck() {
      if (this._deck == undefined) {
         this._deck = new Array();
      }
      return (this._deck);
   }

   /**
   * @property {Array} Returns a copy of the mapped deck of the associated
   * {@link CypherPokerAnalyzer#game} instance
   * (the {@link CypherPokerGame#cardDecks}<code>faceup</code> property),
   * or an empty array if none exists.
   */
   get mappedDeck() {
      if (this._mappedDeck == undefined) {
         this._mappedDeck = new Array();
      }
      return (this._mappedDeck);
   }

   /**
   * @property {Object} deals Contains name/value pairs with each name representing
   * the source (dealing) private ID of the player and the associated value being an
   * array of objects, each containing a <code>fromPID</code> private ID of the sender
   * of the data, a <code>type</code> denoting the type of dealing operation ("select" or "decrypt"),
   * the card values in a <code>cards</code> array, and a <code>private</code> property
   * indicating whether the deal was for private / hole cards or for public / community ones.
   * Each entry is stored in order of operation.
   *
   * @readonly
   */
   get deals() {
      if (this._deals == undefined) {
         this._deals = new Object();
      }
      return (this._deals);
   }

   /**
   * @property {Object} keychains Name/value pairs of player keychains with
   * each name representing a player private ID and associated value being their
   * keychain. The keychain is copied from the associated {@link CypherPokerAnalayzer#game}
   * instance once a game completes.
   *
   * @readonly
   */
   get keychains() {
      if (this._keychains == undefined) {
         this._keychains = new Object();
      }
      return (this._keychains);
   }

   /**
   * @property {CypherPokerGame} game=null The game instance associated with this
   * analyzer, as set at instantiation time.
   *
   * @readonly
   */
   get game() {
      if (this._game == undefined) {
         this._game = null;
      }
      return (this._game);
   }

   /**
   * @property {CypherPoker} cypherpoker=null The {@link CypherPoker} instance
   * associated with {@link CypherPokerAnalyzer#game}.
   *
   * @readonly
   */
   get cypherpoker() {
      if (this.game == null) {
         return (null);
      }
      return (this.game.cypherpoker);
   }

   /**
   * @property {Object} analysis The partial or full analysis of the
   * completed game.
   * @property {Object} analysis.private Name/value pairs with each name matching
   * a player private ID and value containing an array of their verified private
   * {@link CypherPokerCard} instances.
   * @property {Array} analysis.public Array of verified public {@link CypherPokerCard}
   * instances.
   */
   get analysis() {
      if (this._analysis == undefined) {
         this._analysis = new Object();
         this._analysis.private = new Object();
         this._analysis.public = new Array();
      }
      return (this._analysis);
   }

   /**
   * Removes all of the event listeners added to the {@link CypherPokerAnalyzer.game}
   * reference at instantiation.
   */
   removeGameListeners() {
      this.game.removeEventListener("gamecardsencrypt", this.onEncryptCards);
      this.game.removeEventListener("gamedealmsg", this.onGameDealMessage);
      this.game.removeEventListener("gamedealprivate", this.onSelectCards);
      this.game.removeEventListener("gamedealpublic", this.onSelectCards);
      this.game.removeEventListener("gamedeal", this.onCardDeal);
      this.game.removeEventListener("gamedecrypt", this.onGameDecrypt);
      this.game.removeEventListener("gameanalyze", this.onGameAnalyze);
      this.game.removeEventListener("gameplayerkeychain", this.onPlayerKeychain);
   }

   /**
   * Event handler invoked when the associated {@link CypherPokerAnalyzer#cypherpoker}
   * instance dispatches a {@link CypherPoker#event:gamecardsencrypt} event.
   *
   * @param {Event} event A {@link CypherPoker#event:gameplayerkeychain} event object.
   *
   * @async
   * @private
   */
   async onEncryptCards(event) {
      var infoObj = new Object();
      if (this.deck.length == 0) {
         //store current face-up deck as generated by dealer
         var generatedDeck = event.game.cardDecks.faceup;
         var cardsArr = new Array();
         for (var count=0; count < generatedDeck.length; count++) {
            cardsArr.push(generatedDeck[count].mapping);
            this.mappedDeck.push(this.game.getMappedCard(generatedDeck[count].mapping));
         }
         infoObj.fromPID = event.game.getDealer().privateID;
         infoObj.cards = cardsArr;
         this.deck.push (infoObj);
      }
      infoObj = new Object();
      infoObj.fromPID = event.player.privateID;
      infoObj.cards = Array.from(event.selected);
      this.deck.push (infoObj);
   }

   /**
   * Returns a reference to a {@link CypherPokerCard} based on its mapping.
   *
   * @param {String} mapping The plaintext or face-up card mapping value to
   * find.
   *
   * @return {CypherPokerCard} The matching card instance or <code>null</code>
   * if none exists.
   */
   getMappedCard(mapping) {
      for (var count=0; count < this.mappedDeck.length; count++) {
         if (this.mappedDeck[count].mapping == mapping) {
            return (this.mappedDeck[count]);
         }
      }
      return (null);
   }

   /**
   * Event handler invoked when the associated {@link CypherPokerAnalyzer#cypherpoker}
   * instance dispatches a {@link CypherPoker#event:gamedecrypt} event.
   *
   * @param {Event} event A {@link CypherPoker#event:gamedecrypt} event object.
   *
   * @async
   * @private
   */
   async onGameDecrypt(event) {
      //we have partially decrypted some cards
      if (event.private) {
         this.storeDeal(event.payload.sourcePID, this.game.ownPID, event.selected, true, true);
      } else {
         this.storeDeal(event.payload.sourcePID, this.game.ownPID, event.selected, false, true);
      }
   }

   /**
   * Event handler invoked when the associated {@link CypherPokerAnalyzer#cypherpoker}
   * instance dispatches a {@link CypherPoker#event:gamedeal} event.
   *
   * @param {Event} event A {@link CypherPoker#event:gameplayerkeychain} event object.
   *
   * @async
   * @private
   */
   async onCardDeal(event) {
      var cards = event.cards;
      if (event.private == false) {
         //new community cards have been dealt
         for (var count=0; count < cards.length; count++) {
            this.communityCards.push(cards[count]);
         }
      } else {
         //new private cards have been dealt
         this.privateCards[event.game.ownPID]=new Array();
         for (var count=0; count < cards.length; count++) {
            this.privateCards[event.game.ownPID].push(cards[count]);
         }
      }
   }

   /**
   * Event handler invoked when the associated {@link CypherPokerAnalyzer#cypherpoker}
   * instance dispatches either a {@link CypherPoker#event:gamedealprivate} or
   * {@link CypherPoker#event:gamedealpublic} event.
   *
   * @param {Event} event A {@link CypherPoker#event:gameplayerkeychain} event object.
   *
   * @async
   * @private
   */
   async onSelectCards(event) {
      var selected = event.selected;
      if (event.type == "gamedealprivate") {
         //private card selection
         this.storeDeal(this.game.ownPID, this.game.ownPID, selected, true, false);
      } else {
         //we have selected a private card
         this.storeDeal(this.game.ownPID, this.game.ownPID, selected, false, false);
      }
   }

   /**
   * Event handler invoked when the associated {@link CypherPokerAnalyzer#cypherpoker}
   * instance dispatches a {@link CypherPoker#event:gamedealmsg} event.
   *
   * @param {Event} event A {@link CypherPoker#event:gameplayerkeychain} event object.
   *
   * @async
   * @private
   */
   async onGameDealMessage(event) {
      var resultObj = event.data.result;
      if ((resultObj.data.payload.cards != undefined) && (resultObj.data.payload.cards != null)) {
         var cardsArr = resultObj.data.payload.cards;
         if (typeof(cardsArr.length) == "number") {
            //this message contains fully decrypted community cards
            //and is handled in "onCardDeal"
            return(true);
         }
      }
      //partially decrypted public or private cards:
      var selected = resultObj.data.payload.selected;
      //the player that dealt (selected) the cards:
      var dealingPlayer = this.game.getPlayer(resultObj.data.payload.sourcePID);
      //the player that sent the "gamedeal" message:
      var fromPlayer = this.game.getPlayer(resultObj.from);
      //the selected card values:
      if (dealingPlayer.privateID == fromPlayer.privateID) {
         //player is selecting a card
         if (resultObj.data.payload.private) {
            //private card selection
            this.storeDeal(dealingPlayer.privateID, fromPlayer.privateID, selected, true, false);
         } else {
            //public card selection
            this.storeDeal(dealingPlayer.privateID, fromPlayer.privateID, selected, false, false);
         }
      } else {
         //player has decrypted card(s)
         console.log ("Storing external partial decryptions: "+selected);
         if (resultObj.data.payload.private) {
            //private cards
            this.storeDeal(dealingPlayer.privateID, fromPlayer.privateID, selected, true, true);
         } else {
            //public card(s)
            this.storeDeal(dealingPlayer.privateID, fromPlayer.privateID, selected, false, true);
         }
      }
      return(true);
   }

   /**
   * Event handler invoked when the associated {@link CypherPokerAnalyzer#cypherpoker}
   * instance dispatches a {@link CypherPoker#event:gameanalyze} event.
   *
   * @param {Event} event A {@link CypherPoker#event:gameplayerkeychain} event object.
   *
   * @async
   * @private
   */
   async onGameAnalyze(event) {
      this._keychainCommitTimeout = setTimeout(this.onKCSTimeout, this.keychainCommitTimeout, this, event.game);
      return (true);
   }

   /**
   * Event handler invoked when the associated {@link CypherPokerAnalyzer#cypherpoker}
   * instance dispatches a {@link CypherPoker#event:gameplayerkeychain} event.
   *
   * @param {Event} event A {@link CypherPoker#event:gameplayerkeychain} event object.
   *
   * @async
   * @private
   */
   async onPlayerKeychain(event) {
      if (this._keychains == undefined) {
         this._keychains = new Object();
      }
      var player = event.player;
      var game = event.game;
      if (game.gameStarted) {
         return (false);
      }
      this._keychains[player.privateID] = Array.from(event.keychain);
      if (this.allKeychainsCommitted) {
         //all keychains committed, we can clear the timeout and start the analysis
         clearTimeout(this._keychainCommitTimeout);
         this._analysis = await this.analyzeCards();
         this._analysis = await this.scoreHands(this._analysis);
         console.log ("Final analysis:");
         console.dir (this.analysis);

      }
      return (true);
   }

   /**
   * Analyzes the stored information for cryptographic correctness and returns
   * the verified, decrypted cards (as {@link CypherPokerCard} instances),
   * for each player along with the public / community cards. This function should
   * only be called when the game has completed and all keychains received.
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
   async analyzeCards() {
      //step 1: analyze the full deck (creation & encryption)
      if (this.deck.length == 0) {
         return (null);
      }
      //todo: check to ensure that all values are quadratic residues
      var cardsObj = new Object();
      cardsObj.private = new Object();
      cardsObj.public = new Array();
      var faceUpMappings = Array.from(this.deck[0].cards); //generated plaintext (quadratic residues) values
      var previousDeck = Array.from(faceUpMappings);
      for (var count = 1; count < this.deck.length; count++) {
         var currentDeck = Array.from(this.deck[count].cards);
         var keychain = this.keychains[this.deck[count].fromPID];
         var promises = new Array();
         for (var count2=0; count2 < previousDeck.length; count2++) {
            promises.push(this.cypherpoker.crypto.invoke("encrypt", {value:previousDeck[count2], keypair:keychain[0]}));
         }
         var promiseResults = await Promise.all(promises);
         var compareDeck = new Array();
         for (count2 = 0; count2 < promiseResults.length; count2++) {
            compareDeck.push(promiseResults[count2].data.result);
         }
         if (this.compareDecks(currentDeck, compareDeck) == false) {
            var error = new Error("Deck encryption at stage "+count+" by \""+this.deck[count].fromPID+"\" failed.");
            error.code = 1;
            throw (error);
         }
         previousDeck = currentDeck;
      }
      //previousDeck should now contain the fully encrypted deck
      var encryptedDeck = previousDeck;
      //step 1: passed
      //step 2: analyze private / public card selections and decryptions
      for (var privateID in this.deals) {
         var dealArray = this.deals[privateID];
         var decrypting = false; //currently decrypting cards?
         var previousType = "select"; //should match dealArray[0].type
         for (count = 0; count < dealArray.length; count++) {
            var currentDeal = dealArray[count];
            if ((currentDeal == undefined) || (currentDeal == null)) {
               //not a deal history object (probably inherited onEventPromise)
               break;
            }
            if (count > 0) {
               var previousDeal = dealArray[count-1];
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
            };
            if ((previousType == "select") && (type == "select")) {
               //probably the first entry but...
               if (count > 0) {
                  var error = new Error("Multiple sequential \"select\" sequences in deal.");
                  error.code = 2;
                  throw (error);
               }
               if (this.removeFromDeck(cards, encryptedDeck) == false) {
                  var error = new Error("Duplicates found in \"select\" deal index "+count+" for \""+fromPID+"\".");
                  error.code = 2;
                  throw (error);
               }
            } else if ((previousType == "select") && (type == "decrypt") && (count < (dealArray.length - 1))) {
               //starting a new decryption operation (deal or select cards)
               decrypting = true;
            } else if ((previousType == "decrypt") && (type == "select")) {
               //ending decryption operation (final decryption outstanding)
               keychain = this.keychains[sourcePID];
               promises = new Array();
               promiseResults = new Array();
               for (count2=0; count2 < previousCards.length; count2++) {
                  promises.push(this.cypherpoker.crypto.invoke("decrypt", {value:previousCards[count2], keypair:keychain[0]}));
               }
               promiseResults = await Promise.all(promises);
               var dealtCards = new Array();
               for (count2 = 0; count2 < promiseResults.length; count2++) {
                  var card = this.getMappedCard(promiseResults[count2].data.result);
                  if (card == null) {
                     var error = new Error("Final decryption (deal "+count+") by \""+fromPID+"\" does not map: "+promiseResults[count2].data.result);
                     error.code = 2;
                     throw (error);
                  }
                  if (previousPrivate) {
                     cardsObj.private[sourcePID].push(card);
                  } else {
                     cardsObj.public.push(card);
                  }
               }
               if (this.removeFromDeck(cards, encryptedDeck) == false) {
                  var error = new Error("Duplicates found in \"select\" deal index "+count+" for \""+fromPID+"\".");
                  error.code = 2;
                  throw (error);
               }
            } else {
               //decryption in progress
               if (count == (dealArray.length - 1)) {
                  //final decryption for source
                  keychain = this.keychains[sourcePID];
                  promises = new Array();
                  promiseResults = new Array();
                  for (count2=0; count2 < cards.length; count2++) {
                     promises.push(this.cypherpoker.crypto.invoke("decrypt", {value:cards[count2], keypair:keychain[0]}));
                  }
                  promiseResults = await Promise.all(promises);
                  for (count2 = 0; count2 < promiseResults.length; count2++) {
                     var card = this.getMappedCard(promiseResults[count2].data.result);
                     if (card == null) {
                        var error = new Error("Final decryption (deal "+count+") by \""+fromPID+"\" does not map: "+promiseResults[count2].data.result);
                        error.code = 2;
                        throw (error);
                     }
                     if (privateDeal) {
                        cardsObj.private[sourcePID].push(card);
                     } else {
                        cardsObj.public.push(card);
                     }
                  }
               } else {
                  //continuing decryption from another player
                  keychain = this.keychains[previousPID];
                  compareDeck = new Array();
                  promises = new Array();
                  promiseResults = new Array();
                  //decrypt previous deck to obtain current cards...
                  for (count2=0; count2 < previousCards.length; count2++) {
                     promises.push(this.cypherpoker.crypto.invoke("decrypt", {value:previousCards[count2], keypair:keychain[0]}));
                  }
                  promiseResults = await Promise.all(promises);
                  for (count2 = 0; count2 < promiseResults.length; count2++) {
                     compareDeck.push(promiseResults[count2].data.result);
                  }
                  keychain = this.keychains[fromPID];
                  compareDeck = new Array();
                  promises = new Array();
                  promiseResults = new Array();
                  //decrypt current cards to compare to what was sent by current player...
                  for (count2=0; count2 < previousCards.length; count2++) {
                     promises.push(this.cypherpoker.crypto.invoke("decrypt", {value:previousCards[count2], keypair:keychain[0]}));
                  }
                  promiseResults = await Promise.all(promises);
                  for (count2 = 0; count2 < promiseResults.length; count2++) {
                     compareDeck.push(promiseResults[count2].data.result);
                  }
                  if (this.compareDecks(compareDeck, cards) == false) {
                     var error = new Error("Previous round ("+count+") of decryption by \""+fromPID+"\" does not match computed results.");
                     error.code = 2;
                     throw (error);
                  }
               }
            }
         }
      }
      return (cardsObj);
   }

   /**
   * @private
   */
   async scoreHands(cardsObj) {
      var playersObj = cardsObj.private;
      var playerHands = new Object();
      for (var privateID in playersObj) {
         var player = this.game.getPlayer(privateID);
         //private ID may actually be some other object property (e.g. onEventPromise)
         if (player != null) {
            var fullCards = playersObj[privateID].concat(cardsObj.public);
            playerHands[privateID] = this.createCardPermutations(fullCards);
         }
      }
      return (cardsObj);
   }

   /**
   * @private
   */
   createCardPermutations(cardsArr) {
      var permArray = new Array();
      if (cardsArr.length < 5) {
         //only one hand permutation available
         permArray.push (cardsArr);
      } else {
         //todo: create permutations of 5 cards
      }
      return (cardsArr);
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
   */
   removeFromDeck(removeItems, deckArr) {
      var itemsToRemove = removeItems.length;
      var removedItems = new Array();
      for (var count=0; count < removeItems.length; count++) {
         var count2=0;
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
         return (true);
      }
      return (false);
   }

   /**
   * Compares two card decks of either plaintext mappings or encrypted
   * card values, regardless of their order.
   *
   * @return {Boolean} True if both decks have exactly the same elements (regardless of order),
   * false if there's a difference.
   */
   compareDecks(deck1Arr, deck2Arr) {
      if (deck1Arr.length != deck2Arr.length)  {
         return (false);
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
         return (true);
      }
      return (false);
   }

   /**
   * Stores a card deal -- new cards have either been selected or partially
   * decrypted -- to the {@link CypherPokerAnalyzer#deals} array.
   *
   * @param {String} dealingPID The private ID of the dealer of the cards (i.e.
   * the player that selected them).
   * @param {String} fromPID The private ID of the player that last operated
   * on the cards (selected or decrypted them).
   * @param {Array} cards An array of numeric string values representing the
   * selected or partially decrypted cards.
   * @param {Booolean} isPrivate If true, the <code>cards</code> array contains
   * private / hole card values, otherwise they are community / public cards.
   * @param {Boolean} isDecryption If true, the <code>cards</code> array
   * contains partially decrypted values otherwise it contains the initial,
   * fully encrypted selections.
   */
   storeDeal(dealingPID, fromPID, cards, isPrivate, isDecryption) {
      this.game.debug("CypherPokerAnalyzer.storeDeal(\""+dealingPID+"\",\""+fromPID+"\","+cards+", "+isPrivate+", "+isDecryption+")");
      if (this.deals[dealingPID] == undefined) {
         this.deals[dealingPID] = new Array();
      }
      var dealObj = this.deals[dealingPID];
      var cardsCopy = Array.from(cards);
      var infoObj = new Object();
      infoObj.fromPID = fromPID;
      if (isDecryption) {
         infoObj.type = "decrypt";
      } else {
         infoObj.type = "select";
      }
      if (isPrivate) {
         infoObj.private = true;
      } else {
         infoObj.private = false;
      }
      infoObj.cards = cardsCopy;
      this.deals[dealingPID].push(infoObj);
   }

   /**
   * @private
   */
   toString() {
      //output as much analysis information as possible
      var output = new Object();
      output.deals = this.deals;
      output.communityCards = this.communityCards;
      output.privateCards = this.privateCards;
      output.deck = this.deck;
      output.analysis = this.analysis;
      return (JSON.stringify(output));
   }

}
