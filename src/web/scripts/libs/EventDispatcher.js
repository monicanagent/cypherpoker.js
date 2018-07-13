/**
* @file Extensible class intended to mimic standard DOM event dispatchers.
*/
/**
* @class Extend this class to enable standard event dispatcher functionality
* in non-native (DOM) objects.
*
* <p><b><i>This class requires ECMAScript 2017 support.</i></b></p>
*
* @example
*
* class myEventDispatcher extends EventDispatcher {
*  constructor() {
*   this.dispatchEvent(new Event("created"));
*  }
* }
*
* @mixin
* @mixes Object
* @see https://www.w3.org/TR/uievents/
*/
class EventDispatcher {

   constructor () {
       this._registrations= {};
   }

   getListeners (type, useCapture) {
       var captype= (useCapture? '1' : '0')+type;
       if (!(captype in this._registrations))
           this._registrations[captype]= [];
       return this._registrations[captype];
   }

   addEventListener (type, listener, useCapture) {
       var listeners= this.getListeners(type, useCapture);
       var ix= listeners.indexOf(listener);
       if (ix===-1)
           listeners.push(listener);
   }

   removeEventListener (type, listener, useCapture) {
       var listeners= this.getListeners(type, useCapture);
       var ix= listeners.indexOf(listener);
       if (ix!==-1)
           listeners.splice(ix, 1);
   }

   dispatchEvent (evt) {
       var listeners = this.getListeners(evt.type, false).slice();
       for (var i= 0; i<listeners.length; i++) {
         listeners[i].call(this, evt);
       }
       return !evt.defaultPrevented;
   }

   toString() {
      return ("[object EventDispatcher]");
   }
}
