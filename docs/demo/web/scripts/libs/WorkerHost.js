/**
* @file A host for a (mostly) generic Web Worker.
*
* @version 0.2.0
*/
let _instances = 0;

/**
* @class Manages a WebWorker instance and responds via events and/or
* promises.
* @extends EventDispatcher
*/
class WorkerHost extends EventDispatcher {

   /**
   * Creates a new WorkerHost instance and automatically instantiates an
   * associated Web Worker.
   *
   * @param {String} scriptURL The external Web Worker script URL / path
   * to create this instance with.
   * @param {Boolean} onEventReady If true, the WorkerHost will dispatch an
   * event (using the parent {@link EventDispatcher}), whenever the host
   * ready state changes. It is advisable to enable this setting as the
   * worker script may require some time to initialize and may be unable
   * to respond to requests.
   */
   constructor (scriptURL, eventOnReady) {
      super();
      this._scriptURL = scriptURL;
      this._ready = false;
      this._worker = new Worker(scriptURL);
      this._worker._host = this; //ensure that this reference is set for events!
      this._worker.addEventListener("message", this.onWorkerReady);
      _instances++;
      this._instanceNum = WorkerHost.instances;
      this._eventOnReady = eventOnReady;
   }

   /**
   * Event handler that responds to the associated Web Worker's "ready" event.
   *
   * @param {Object} event A standard Worker "message" event object.
   *
   * @listens Worker#message
   * @see {@link dispatchReadyEvent}
   */
   onWorkerReady (event) {
      //this function is invoked in the Worker context, not WorkerHost
      this._host._worker.removeEventListener("message", this._host.onWorkerReady);
      if (event.data.ready) {
         this._host._ready = true;
         if (this._host._eventOnReady) {
            this._host.dispatchReadyEvent(true);
         }
      } else {
         throw (new Error("Worker responded with false ready state."));
      }
   }

   /**
   * @property {Array} instances Returns all WorkerHost instances in the current
   * execution context.
   * @static
   */
   static get instances () {
      return (_instances);
   }

   /**
   * @property {Array} instanceNum The instance number of the current WorkerHost
   * instance. This value matches the index of the instance within the
   * {@link WorkerHost.instances} property.
   */
   get instanceNum() {
      return (this._instanceNum);
   }

   /**
   * @property {String} scriptURL The Web Worker script URL associated with this
   * host instance.
   * @readonly
   */
   get scriptURL () {
      return (this._scriptURL);
   }

   /**
   * @property {Boolean} ready True if the host instance is ready to accept
   * a new request for the associated Web Worker.
   * @readonly
   */
   get ready() {
      return (this._ready);
   }

   /**
   * Invokes an asynchronous worker method using a free {@link workerHost}
   * instance.
   *
   * @param {String} method The method to invoke in the hosted Worker instance.
   * @param {Object} params The parameters to invoke the method with.
   * @param {*} [requestID=undefined] A request ID that can be used to track the
   * request over its lifetime (useful when re-assembling multiple discrete
   * invokations that could otherwise result in a race condition).
   *
   * @example
   * //simple example invoking an "add" function with parameters "num1" and "num2"
   * let host = new WorkerHost("./workers/MyWorker.js");
   * host.invoke("add", {num1:1, num2:3}, 1).then(event => {
   *  //event.data.requestID will match the invoking request ID (1 in this case)
   *  console.log ("1 + 3 = " + event.data.result);
   * });
   *
   * @example
   * //using an async function
   * let host = new WorkerHost("./workers/MyWorker.js");
   * async function doAdd(num1, num2) {
   *  //request ID is not included in this case
   *  return (host.invoke("add", {"num1":num1, "num2":num2}));
   * }
   * doAdd(1,3).then(event => {
   *  console.log ("1 + 3 = "+event.data.result);
   * })
   *
   */
   async invoke (method, params, requestID) {
      if (!this._ready) {
         throw (new Error("Worker is not ready."));
      }
      this.dispatchReadyEvent(false);
      if (this.useEvents) {
         this._worker._host = this; //important for event handler!
         this._worker.addEventListener("message", this.handleWorkerMessage);
      }
      this._worker.postMessage({"method":method, "params":params, "requestID":requestID});
      if (!this.useEvents) {
         while (true) {
            let event = await this._worker.onEventPromise("message");
            this.dispatchReadyEvent(true);
            return (event);
         }
      } else {
         return (true);
      }
   }

   /**
   * Dispatches a ready / not ready event for the host.
   *
   * @param {Boolean} isReady Defines the ready state of the host to dispatch.
   *
   * @fires ready
   * @fires busy
   */
   dispatchReadyEvent(isReady) {
      if (isReady) {
         this._ready = true;
         var event = new Event("ready");
         event.source = this;
         this.dispatchEvent(event);
      } else {
         this._ready = false;
         event = new Event("busy");
         event.source = this;
         this.dispatchEvent(event);
      }
   }

   /**
   * Handles a response message event for the associated Web Worker.
   *
   * @param {Object} event A standard Worker "message" event.
   *
   * @listens Worker#message
   */
   handleWorkerMessage(event) {
      //this function is invoked in the Worker context, not WorkerHost
      this._host.removeEventListener("message", this.handleWorkerMessage);
      var newEvent = new Event("message");
      //perform a naive clone of the original event
      for (var item in event) {
         try {
            newEvent[item] = event[item];
         } catch (err) {}
      }
      this._host.dispatchEvent(newEvent);
      this._host.dispatchReadyEvent(true);
   }

}
