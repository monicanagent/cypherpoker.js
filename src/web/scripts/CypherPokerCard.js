/**
* @file Storage and functionality for a single CypherPoker.JS card.
*
* @version 0.0.1
* @author Patrick Bay
* @copyright MIT License
*/


/**
* @class Stores and manages information for a card in a {@link CypherPokerGame}
* instance.
*/
class CypherPokerCard {

   /**
   * Creates a new card instance.
   *
   * @param {String} mapping The plaintext mapping or unencrypted value for
   * the card (e.g. a quadratic residue)
   * @param {Object} cardInfo Additional information for the card such as
   * its suit, numerical value, colour, etc. Enumerable properties of this object
   * become accessible directly as frozen properties of this class instance.
   */
   constructor (mapping, cardInfo) {
      this._mapping = mapping;
      var keyMap = Object.keys(cardInfo);
      for (var count=0; count < keyMap.length; count++) {
         var key = keyMap[count];
         this[key] = cardInfo[key];
      }
      Object.freeze(this);
   }

   /**
   * @property {String} mapping The plaintext or face-up value (e.g. quadratic
   * residue), associated with this card.
   * @readonly
   */
   get mapping() {
      return (this._mapping);
   }

   /**
   * @private
   */
   toString() {
      if (this.name == undefined) {
         return ("[object CypherPokerCard]");
      } else {
         return ("[object CypherPokerCard \""+this.name+"\"]");
      }
   }
}
