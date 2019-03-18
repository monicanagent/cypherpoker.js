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
   * Creates an instance of APIRouter.
   */
   constructor() {
      super();
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
      if (this.connection == null) {
         return (null);
      }
      return (this.connection.privateID);
   }

   /**
   * @property {String} userToken Internally-generated user token required by
   * the API {@link connection}.
   */
   get userToken() {
      if (this.connection == null) {
         return (null);
      }
      return (this.connection.userToken);
   }

   /**
   * @property {String} serverToken Server-generated token required by
   * the API {@link connection}.
   */
   get serverToken() {
      if (this.connection == null) {
         return (null);
      }
      return (this.connection.serverToken);
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
         case "ws":
            this._connection = new WSSClient();
            this.connection.addEventListener("message", this.onMessage, this);
            this.connection.addEventListener("update", this.onUpdate, this);
            this.connection.addEventListener("peerconnect", this.onPeerConnect, this);
            this.connection.addEventListener("peerdisconnect", this.onPeerDisconnect, this);
            var result = this.connection.connect(connectionInfo.url);
            return (result);
            break;
         case "wss":
            this._connection = new WSSClient(connectionInfo.url);
            this.connection.addEventListener("message", this.onMessage, this);
            this.connection.addEventListener("update", this.onUpdate, this);
            this.connection.addEventListener("peerconnect", this.onPeerConnect, this);
            this.connection.addEventListener("peerdisconnect", this.onPeerDisconnect, this);
            result = this.connection.connect(connectionInfo.url);
            return (result);
            break;
         case "webrtc":
            break;
         default:
            throw (new Error("Unrecognized connection type \""+connectInfo.type+"\""));
            break;
      }
   }

   toString() {
      return ("APIRouter");
   }

}
