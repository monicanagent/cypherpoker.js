/**
* @file JSON-RPC 2.0 API request / response routing interface.
*
* @version 0.4.1
*/
/**
* @class Transparently routes messages to/from available API communication interfaces.
* @extends EventDispatcher
*/
class APIRouter extends EventDispatcher {

   /**
   * An API service message has been received on one of the supported transports
   * being handled by this instance. Both "direct" and "message" types emit
   * the same event (examine the <code>data</code> property to differentiate).
   *
   * @event APIRouter#message
   * @type {Event}
   * @property {Object} data A native JSON-RPC 2.0 result or notification object.
   * @property {String} transportType The transport type through which the message
   * was received.
   * @property {Object} transport A reference to the transport interface that initially
   * handled the receipt of the message.
   */
   /**
   * A server-originating "update" message has been received on one of the supported
   * transports handled by this instance.
   *
   * @event APIRouter#update
   * @type {Event}
   * @property {Object} data A native JSON-RPC 2.0 result or notification object.
   * @property {String} transportType The transport type through which the message
   * was received.
   * @property {Object} transport A reference to the transport interface that initially
   * handled the receipt of the message.
   */

   /**
   * Creates an instance of APIRouter.
   *
   * @param {Object} [configData=null] Application configuration data, usually as loaded at
   * startup.
   */
   constructor(configData=null) {
      super();
      this._config = configData;
   }

   /**
   * @property {Object} config Application configuration data, usually loaded
   * at application startup (<code>settings.json</code> file).
   * @readonly
   */
   get config() {
      return (this._config);
   }

   /**
   * @property {*} connection A reference to the API connection, or <code>null</code>
   * if no such connection exists or is invalid. The actual network connection handled
   * by this object is {@link rawConnection}.
   */
   get connection() {
      if (this._connection == undefined) {
         return (null);
      }
      return (this._connection);
   }

   set connection(cSet) {
      this._connection = cSet;
      //remove any existing listeners
      this._connection.removeEventListener("message", this.onMessage);
      this._connection.removeEventListener("update", this.onUpdate);
      this._connection.removeEventListener("peerpid", this.onPeerPIDUpdate);
      //add new listeners
      this._connection.addEventListener("message", this.onMessage, this);
      this._connection.addEventListener("update", this.onUpdate, this);
      this._connection.addEventListener("peerpid", this.onPeerPIDUpdate, this);
   }

   /**
   *  @property {*} rawConnection The raw network connection being used
   * to communicate by the {@link connection} (e.g. a WebSocket, WebRTC, etc.)
   *
   * @readonly
   */
   get rawConnection() {
      if (this.connection == null) {
         return (null);
      }
      return (this.connection.webSocket);
   }

   /**
   * @property {String} privateID The privateID assigned to the session by the
   * API {@link connection}. This value will be <code>null</code> if no session has been
   * established.
   */
   get privateID() {
      if ((this.connection == null) && (this._privateID == undefined)) {
         this._privateID = null;
      } else {
         if (this._privateID == undefined) {
            this._privateID = this.connection.privateID;
         }
      }
      return (this._privateID);
   }

   set privateID(PIDSet) {
      this._privateID = PIDSet;
   }

   /**
   * @property {String} userToken Internally-generated user token required by
   * the API {@link connection}.
   */
   get userToken() {
      if ((this.connection == null) && (this._userToken == undefined)) {
         this._userToken = null;
      } else {
         if (this._userToken == undefined) {
            this._userToken = this.connection.userToken;
         }
      }
      return (this._userToken);
   }

   set userToken (utSet) {
      this._userToken = utSet;
   }

   /**
   * @property {String} serverToken Server-generated token required by
   * the API {@link connection}.
   */
   get serverToken() {
      if ((this.connection == null) && (this._serverToken == undefined)) {
         this._serverToken = null;
      } else {
         if (this._serverToken == undefined) {
            this._serverToken = this.connection.serverToken;
         }
      }
      return (this._serverToken);
   }

   set serverToken (stSet) {
      this._serverToken = stSet;
   }

   /**
   * Sends an API request using the {@link connection}.
   *
   * @param {Object} requestObj The JSON-RPC 2.0 request to send.
   *
   * @return {Promise} An asynchronous promise that will resolve with the JSON-RPC 2.0
   * API response.
   */
   request(requestObj) {
      var promise = this.rawConnection.onEventPromise("message");
      //send API request via WSS
      if (this.connection.readyState != this.connection.OPEN) {
        //socket not yet connected
        this.rawConnection.onEventPromise("open").then((event) => {
          this.rawConnection.send(JSON.stringify(requestObj));
        });
     } else {
        //socket already open
        this.rawConnection.send(JSON.stringify(requestObj));
     }
     return (promise);
   }

   /**
   * Establishes a connection to an API server.
   *
   * @param {Object} connectInfo An object containing information about the API
   * server to connect to. The object must contain at least a <code>type</code>
   * property.
   * @param {String} connectInfo.type Specifies the type of connection defined
   * by the <code>connectInfo</code> object. This parameter is case-sensitive.
   * Valid types include "ws" or "wss" for WebSocket Sessions, and "webrtc" for
   * WebRTC connections.
   *
   * @throws {Error} Thrown when the specified server could not be
   * contacted or if there is a problem with the <code>connectioInfo</code>
   * parameter.
   */
   async connectAPI(connectionInfo) {
      if (connectionInfo == null) {
         throw (new Error("No connection info object provided."));
      }
      if (typeof(connectionInfo.type) != "string") {
         throw (new Error("The connection info \"type\" property must be a string."));
      }
      switch (connectionInfo.type) {
         case "wss":
            this.connection = new WSSClient(connectionInfo.url);
            try {
               var connectData = new Object();
               connectData.options = P2PRouter.supportedTransports.options; //P2PRouter advertised as connection options
               var result = await this.connection.connect(connectionInfo.url, false, connectData);
            } catch (err) {
               this.connection.destroy();
               this.connection = null;
            }
            return (result);
            break;
         case "webrtc":
            break;
         default:
            throw (new Error("Unrecognized connection type \""+connectInfo.type+"\""));
            break;
      }
   }

   /**
   * Changes the private ID associated with the [connection]{@link APIRouter#connection}. The private ID
   * is updated on the server and reflected in the [privateID]{@link WSSClient#privateID}
   * property.
   *
   * @param {String} newPrivateID The new private ID to set for this connection.
   *
   * @return {Promise} The promise resolves with <code>true</code> if the private
   * ID was successfully changed, otherwise it rejects with <code>false</code>.
   *
   * @async
   */
   async changePrivateID(newPrivateID) {
      var changed = await this.connection.changePrivateID(newPrivateID);
      if (changed == true) {
         this._privateID = newPrivateID;
      }
   }

   /**
   * Handles any "peerpid" message events received from the API connection.
   *
   * @param {Event} event An update message event received from the API connection.
   *
   * @fires APIRouter#peerpid
   * @private
   */
   async onPeerPIDUpdate(event) {
      var newEvent = new Event("peerpid");
      newEvent.oldPrivateID = event.data.result.change.oldPrivateID;
      newEvent.newPrivateID = event.data.result.change.newPrivateID
      this.dispatchEvent(newEvent);
   }

   /**
   * Handles any "message" events received on the API transport.
   *
   * @param {Event} event A message event received from the API transport.
   *
   * @fires APIRouter#message
   * @private
   */
   onMessage(event) {
      var source = event.target.toString();
      var newEvent = new Event("message");
      if (source == "WSSClient") {
         newEvent.data = event.data;
         newEvent.data.result.transport = "wss";
         newEvent.transport = event.target;
      } else if (source == "WebRTCClient") {
         //TODO: add support for WebRTC API call messages
         var jsonObj = buildJSONRPC("notification");
         jsonObj.data = event.data;
         jsonObj.data.result.from = this.getPIDByTransport(event.target);
         jsonObj.data.result.transport = "webrtc";
         newEvent.data = jsonObj.data;
         newEvent.transport = event.target;
      }
      this.dispatchEvent(newEvent);
   }

   /**
   * Handles any "update" message events received on a supported transport.
   *
   * @param {Event} event An update message event received from the API.
   *
   * @fires APIRouter#update
   * @private
   */
   async onUpdate(event) {
      var source = event.target.toString();
      var newEvent = new Event("update");
      newEvent.data = event.data;
      newEvent.transport = event.target;
      if (source == "WSSClient") {
         newEvent.transportType = "wss";
      } else if (source == "WebRTCClient") {
         newEvent.transportType = "webrtc";
      }
      this.dispatchEvent(newEvent);
   }

   /**
   * Prepares the instance for destruction by closing any open transports,
   * removing references and event listeners, and otherwise cleaning up.
   *
   * @async
   */
   async destroy() {
      if (this.connection != null) {
         this.connection.removeEventListener("message", this.onMessage);
         this._connection = null;
      }
   }

   toString() {
      return ("APIRouter");
   }

}
