/**
* @file WebSocket Session interface.
*
* @version 0.2.0
*/

/**
* @class A WebSocket Session client interface used to connect to peers. Requires
* {@link RPC} and {@link EventPromise} to exist in the current execution
* context.
*/
class WSS extends EventDispatcher {

   /**
   * Creates an instance of WSS.
   *
   * @param {String} [handshakeServerAddress] The address of the WSS handshake
   * server (available as {@link handshakeServerAddr}). If not provided and
   * {@link connect} is called then the socket server address will be assigned
   * to the handshake server address and used for both.
   */
   constructor(handshakeServerAddress) {
      super();
      this._hsa = handshakeServerAddress;
   }

   /**
   * Produces a SHA-256 hash of an input string. The output of this
   * implementation <i>should</i> match the output of Node.js' built-in
   * SHA-256 hash (<code>crypto</code> module).<br/>
   * Uses the <a href="https://www.w3.org/TR/WebCryptoAPI/#subtlecrypto-interface">
   * SubtleCrypto</a> interface of the <a href="https://www.w3.org/TR/WebCryptoAPI/">
   * Web Cryptography API</a>.
   *
   * @param {String} input The string to hash.
   *
   * @return {Promise} A promise containing a hex-encoded result of the SHA-256
   * hash of the input.
   *
   * @see https://rawgit.com/w3c/webcrypto/master/PR-test-report.html
   * @see https://caniuse.com/#search=SubtleCrypto
   */
   async SHA256 (input) {
      var buffer = new TextEncoder("utf-8").encode(input);
      var hash_buffer = await crypto.subtle.digest("SHA-256", buffer);
      let hash_array = Array.from(new Uint8Array(hash_buffer));
      let hash_hex_str = hash_array.map(byte =>
         ("00" + byte.toString(16)).slice(-2)).join("");
      return (hash_hex_str);
   }

   /**
   * @property {String} handshakeServerAddr The assigned handshake server address of the WSS instance.
   */
   get handshakeServerAddr() {
      if (this["_hsa"] == undefined) {
         this._hsa = null;
      }
      return (this._hsa);
   }

   /**
   * @property {String} socketServerAddr The assigned WebSocket server address of the WSS instance.
   */
   get socketServerAddr() {
      if (this["_ssa"] == undefined) {
         return (null);
      }
      return (this._ssa);
   }

   /**
   * @property {WebSocket} webSocket The WebSocket object being used for this session.
   */
   get webSocket() {
      if (this["_websocket"] == undefined) {
         this._websocket = null;
      }
      return (this._websocket);
   }

   /**
   * @property {String} privateID The privateID assigned to the session by the
   * server. This value may also be derived by hashing ({@link SHA256}) a
   * concatenation of the {@link serverToken} and {@link userToken}.
   */
   get privateID() {
      if (this["_privateID"] == undefined) {
         this._privateID = null;
      }
      return (this._privateID);
   }

   /**
   * @property {String} userToken internally-generated user token that is
   * combined with the returned {@link serverToken} to produce the
   * {@link privateID}.
   */
   get userToken() {
      if (this["_userToken"] == undefined) {
         this._userToken = null;
      }
      return (this._userToken);
   }

   /**
   * @property {String} serverToken The server-generated user token that is
   * combined with the generated {@link userToken} to produce the
   * {@link privateID}.
   */
   get serverToken() {
      if (this["_serverToken"] == undefined) {
         this._serverToken = null;
      }
      return (this._serverToken);
   }

   /**
   * @property {Array} peers A list of currently connected peers, as managed by
   * this instance.
   */
   get peers() {
      if (this["_peers"] == undefined) {
         this._peers = new Array();
      }
      return (this._peers);
   }

   /**
   * Initiates a WebSocket Session by performing a handshake and subsequent
   * connection to the WSS server.
   *
   * @param {String} [socketServerAddr] The WebSocket server address to connect
   * to. If omitted, the assigned handshake server address will be used for
   * both the handshake and the connection.
   * @param {Boolean} [useHTTPHandshake=false] If true, a HTTP /  HTTPS
   * request is used for the handshake otherwise the handshake and
   * connection both happen on the same WebSocket connection.
   *
   * @throws {Error} Thrown when a valid handshake / socket server address was
   * not supplied, or the connection could not be established.
   * @todo Add better connection error handling.
   */
   async connect(socketServerAddress, useHTTPHandshake=false) {
      if (typeof(socketServerAddress) == "string") {
         this._ssa = socketServerAddress;
      }
      if (this.handshakeServerAddr == null) {
         this._ssa = socketServerAddress;
         this._hsa = socketServerAddress;
      }
      if ((this._hsa == null) || (this._hsa == undefined) || (this._hsa.trim() == "")) {
         throw (new Error("No handshake or socket server address provided."));
      }
      //the user token can be almost any string; maybe we can improve on this...
      this._userToken = String(Math.random()).split("0.").join("");
      if (useHTTPHandshake) {
         this._xhr = new XMLHttpRequest();
         this._xhr.open("POST", this.handshakeServerAddr);
         var event = await RPC("WSS_Handshake", {"user_token":this.userToken}, this._xhr);
         if (typeof(event.target.response["error"]) == "object") {
            throw (new Error("Server responded with an error ("+event.target.response.error.code+"): "+event.target.response.error.message));
         } else {
            this._serverToken = event.target.response.result.server_token;
         }
      } else {
         this._websocket = new WebSocket(this.handshakeServerAddr);
         this.webSocket.session = this;
         this.webSocket.addEventListener("error", event => {
            //trigger following "await" statement (error will be thrown after that)
            this.webSocket.dispatchEvent(new Event("open"));
         });
         event = await this.webSocket.onEventPromise("open");
         if (this._websocket.readyState != this._websocket.OPEN) {
            throw (new Error("Couldn't connect WebSocket at: " + this.handshakeServerAddr));
         }
         event = await RPC("WSS_Handshake", {"user_token":this.userToken}, this.webSocket);
         var resultData = JSON.parse(event.data);
         if (typeof(resultData["error"]) == "object") {
            throw (new Error("Server responded with an error ("+resultData.error.code+"): "+resultData.error.message));
         } else {
            this._serverToken = resultData.result.server_token;
         }
      }
      if (this.webSocket == null) {
         this._websocket = new WebSocket(this.socketServerAddr);
         this.webSocket.addEventListener("error", event => {
            //trigger following "await" statement (error will be thrown after that)
            this.webSocket.dispatchEvent(new Event("open"));
         });
         event = await this.webSocket.onEventPromise("open");
         if (this._websocket.readyState != this._websocket.OPEN) {
            throw (new Error("Couldn't connect WebSocket at: " + this.socketServerAddr));
         }
         this.webSocket.session = this;
      }
      var message_event = await RPC("WSS_Connect", {
         "user_token":this.userToken,
         "server_token":this.serverToken
      }, this.webSocket); //connect the websocket using the tokens
      var rpc_result_obj = JSON.parse(message_event.data);
      if (rpc_result_obj.error != undefined) {
         throw (new Error("Couldn't establish WebSocket Session: ("+rpc_result_obj.error.code+") "+rpc_result_obj.error.message));
      }
      if ((rpc_result_obj.result["private_id"] != undefined) && (rpc_result_obj.result["private_id"] != null)) {
         this._privateID = rpc_result_obj.result.private_id;
         //the following concatention pattern matches the server
         //implementation:
         //var hash_source_str = this.serverToken+ ":" +this.userToken;
         //var generated_pid = await this.SHA256(hash_source_str);
         //console.log ("Are they the same? "+(this._privateID == generated_pid));
      } else {
         throw (new Error("No private ID returned in WSS_Connect response."));
      }
      if ((rpc_result_obj.result["connect"] != undefined) && (rpc_result_obj.result["connect"] != null)) {
         var connectedPeersList = rpc_result_obj.result["connect"];
         if (typeof(connectedPeersList) == "object") {
            connectedPeersList.forEach (function (currentValue, index, sourcArr) {
               this.peers.push(currentValue);
            }, this);
         }
      }
      this.webSocket.addEventListener("message", this.handleSocketMessage);
      this.webSocket.addEventListener("close", this.handleSocketClose);
      return (message_event);
   }

   /**
   * Broadcasts a message to all connected peers.
   *
   * @param {*} data The data / message to broadcast.
   *
   * @return {Promise} An asynchronous Promise that will contain the result of
   * the broadcast or will throw an error on failure.
   */
   async broadcast (data) {
      var broadcastObj = new Object();
      broadcastObj.user_token=this.userToken;
      broadcastObj.server_token=this.serverToken;
      broadcastObj.type = "broadcast";
      broadcastObj.data = data;
      var rpc_result = await RPC("WSS_Send", broadcastObj, this.webSocket);
      return (rpc_result);
   }

   /**
   * Sends a direct message to one or more connected peers.
   *
   * @param {*} data The data / message to send.
   * @param {Object|Array} recipients An object or an array of recipient private
   * IDs. If this parameter is an object, one or more additional properties are
   * expected:
   * @param {Array} [recipients.rcp] An indexed array of recipient private IDs.
   * If this list is provided as the <code>recipients</code> parameter this
   * structure is dynamicaly generated before sending.
   *
   * @return {Promise} An asynchronous Promise that will contain the result of
   * the send or will throw an error on failure.
   */
   async send (data, recipients) {
      if (typeof(recipients) != "object") {
         throw (new Error(`"recipients" parameter must be an array!`));
      }
      if (typeof(recipients["length"]) == "number") {
         //recipients is an array so add it to the "rcp" property
         var WSSRecpObj = new Object();
         WSSRecpObj.rcp = recipients;
      } else {
         //recipients is al_wssReady an object so assume everything is in place
         WSSRecpObj = recipients;
      }
      var broadcastObj = new Object();
      broadcastObj.user_token=this.userToken;
      broadcastObj.server_token=this.serverToken;
      broadcastObj.type = "direct";
      broadcastObj.to = WSSRecpObj;
      broadcastObj.data = data;
      var rpc_result = await RPC("WSS_Send", broadcastObj, this.webSocket);
      return (rpc_result);
   }

   /**
   * Handles WebSocket message events for the WSS instance. Most events are
   * simply re-broadcast but some such as <code>session</code> messages are
   * handled internally. Listen to "message" events on the WSS's
   * {@link webSocket} to receive all messages.
   *
   * @param {Event} eventObj A "message" event dispatched by the associated
   * WebSocket instance.
   */
   handleSocketMessage(eventObj) {
      try {
         var dataObj = JSON.parse(eventObj.data);
         switch (dataObj.result.type) {
            case "broadcast":
               var event = new Event("message");
               event.data = dataObj;
               event._event = event;
               this.session.dispatchEvent(event);
               break;
            case "direct":
               event = new Event("message");
               event.data = dataObj;
               event._event = event;
               this.session.dispatchEvent(event);
               break;
            case "update":
               event = new Event("update");
               event.data = dataObj;
               event._event = event;
               this.session.dispatchEvent(event);
               break;
            case "session":
               if (typeof(dataObj.result.connect) == "string") {
                  //dataObj.result.connect is the private ID of the new connection
                  event = new Event("peerconnect");
                  event.data = dataObj;
                  event._message_event = event;
                  this.session.peers.push(dataObj.result.connect);
                  this.session.dispatchEvent(event);
               } else if (typeof(dataObj.result.disconnect) == "string") {
                  //dataObj.result.disconnect is the private ID of the disconnect
                  event = new Event("peerdisconnect");
                  event.data = dataObj;
                  event._message_event = event;
                  for (var count = 0; count < this.session.peers.length; count++) {
                     if (this.session.peers[count] == dataObj.result.disconnect) {
                        this.session.peers.splice(count, 1);
                        break;
                     }
                  }
                  this.session.dispatchEvent(event);
               } else {
                  //unhandled session message
               }
               break;
            default:
               //unhandled message type
               break;
         }
      } catch (err) {
      }
   }

   /**
   * Handles WebSocket close events for the WSS instance.
   *
   * @param {Event} eventObj A "close" event dispatched by the associated
   * WebSocket instance.
   */
   handleSocketClose(eventObj) {
      var event = new Event("close");
      event._event = event;
      this.session.dispatchEvent(event);
   }

}
