'use strict';

/**
*
* @file Binds asynchronous events to Promise objects.
*
* @version 0.4.1
*/
/**
* @class Creates promises from standard JavaScript events for
* inline asynchronous execution. This class binds itself to the global object
* prototype and is therefore available to all derived objects in the current
* execution context.
*
* <p><b><i>This global class requires ECMAScript 2017 support.</i></b></p>
* @mixin
* @mixes Object.prototype
*/
class EventPromise {

   /**
   * Registers an event listener on a target object and returns a Promise.
   *
   * @param {String} eventType The type of event to register. This can match
   * any event type dispatched by the target object.
   * @param {Boolean} useCapture=false As in standard events, this parameter
   * specifies if the event is dispatched in the capture phase (true), or in the
   * bubble phase (false).
   *
   * @return A standard Promise object that will receive either a resolution
   * when the event fires or a rejection if the event could not be registered.
   *
   * @example
   * //all objects in the current execution context will inherit the
   * //onEventPromise handler automatically
   * window.onEventPromise("click").then(
   *   function(resolve, reject) {
   *      alert ("Clicked on window");
   *   }
   * )
   *
   * @example
   * //the returned Promise also works with async functions as expected
   * async function doOnClick() {
   *  event = await window.onEventPromise("click");
   *  alert ("Clicked on window");
   * }
   * doOnClick();
   *
   */
   static onEventPromise(eventType, useCapture) {
    if (typeof(useCapture) != "boolean") {
      useCapture = false; //W3C default
    }
    var promise = new Promise((resolve, reject) => {
      try {
        let listener = (event) => {
          this.removeEventListener(eventType, listener);
          setTimeout (resolve, 1, event); //prevents multiple sequential promises (if set) for the same event type (e.g. MouseEvent)
        }
        this.addEventListener(eventType, listener, useCapture);
      } catch (err) {
        setTimeout (resolve, 1, err);
      }
    });
    return (promise);
   }
}
//register function with global object inheritance tree
Object.prototype.onEventPromise = EventPromise.onEventPromise;
//make the property non-enumerable to prevent including it during enumeration (for..in loops, etc.)
Object.defineProperty(Object.prototype, 'onEventPromise', {enumerable: false});
