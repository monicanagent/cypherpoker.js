/**
* @file WebSocket Sessions client interface.
*
* @version 0.4.1
*/

/**
* @class A WebSocket Session client interface used to connect to peers. Requires
* {@link RPC} and {@link EventPromise} to exist in the current execution
* context.
* @extends EventDispatcher
*/
class WSSClient extends EventDispatcher {

   /**
   * A new peer has connected to the WSS server.
   *
   * @event WSSClient#peerconnect
   * @type {Event}
   *
   * @property {Object} data The parsed JSON-RPC 2.0 object received
   * in the notification.
   */
   /**
   * A peer has disconnected from the WSS server.
   *
   * @event WSSClient#peerdisconnect
   * @type {Event}
   *
   * @property {Object} data The parsed JSON-RPC 2.0 object received
   * in the notification.
   */
   /**
   * A message has been received from a peer via the WSS server. This may either
   * be a direct message or a broadcast.
   *
   * @event WSSClient#message
   * @type {Event}
   *
   * @property {Object} data The parsed JSON-RPC 2.0 object containing
   * the received message.
   */
   /**
   * An update notification has been received from the WSS server.
   *
   * @event WSSClient#update
   * @type {Event}
   *
   * @property {Object} data The parsed JSON-RPC 2.0 object containing
   * the received message.
   */
   /**
   * The private ID of this connection has changed and a notification
   * has been sent to the connected peer.
   *
   * @event WSSClient#privateid
   * @type {Event}
   *
   * @property {String} privateID The new private ID for this connection.
   */
   /**
   * The private ID of a connected peer has changed and the internal
   * [peers]{@link WSSClient#peers} list has been updated.
   *
   * @event WSSClient#peerpid
   * @type {Event}
   *
   * @property {Object} data The parsed JSON-RPC 2.0 object containing
   * the change notification.
   * @property {String} oldPrivateID The old / previous private ID of the peer.
   * @property {String} newPrivateID The new / changed private ID of the peer.
   */

   /**
   * Creates an instance of WSSClient.
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
   * @readonly
   */
   get peers() {
      if (this["_peers"] == undefined) {
         this._peers = new Array();
      }
      return (this._peers);
   }

   /**
   * @property {Object} peerOptions Options objects associated with peer
   * private IDs in the {@link peers} list. That is:<br/>
   * <code>peerOptions[privateID]=optionsObject</code>
   * @readonly
   */
   get peerOptions() {
      if (this["_peerOptions"] == undefined) {
         this._peerOptions = new Object();
      }
      return (this._peerOptions);
   }

   /**
   * Initiates a WebSocket Session by performing a handshake and subsequent
   * connection to the WSS server.
   *
   * @param {String} [socketServerAddr=null] The WebSocket server address to connect
   * to. If omitted, the assigned handshake server address will be used for
   * both the handshake and the connection.
   * @param {Boolean} [useHTTPHandshake=false] If true, a HTTP /  HTTPS
   * request is used for the handshake otherwise the handshake and
   * connection both happen on the same WebSocket connection.
   * @param {Object} [connectData=null] Optional data to include with the connect API
   * call. If omitted or <code>null</code>, an empty object is created and a minimal <code>options</code>
   * object is appended. If included, any <code>user_token</code> and <code>server_token</code>
   * properties will be overriden with handshake {@link WSSClient#userToken} and
   * {@link WSSClient#serverToken} values.
   * @param {Object} [connectData.options] The peer connection options for this connection.
   * If omitted or <code>null</code> a minimal connection options object is created with
   * default values.
   * @param {Boolean} [connectData.options.wss=true] Denotes whether (<code>true</code>) or not
   * (<code>false</code>) WebSocket Sessions is supported by the client.
   * @param {Boolean} [connectData.options.webrtc=false] Denotes whether (<code>true</code>) or not
   * (<code>false</code>) <a href="https://webrtc.org/">WebRTC</a> is supported by the client.
   * @param {Boolean} [connectData.options.ortc=false] Denotes whether (<code>true</code>) or not
   * (<code>false</code>) <a href="https://ortc.org/">ORTC</a> is support by the client.
   *
   * @throws {Error} Thrown when a valid handshake / socket server address was
   * not supplied, or the connection could not be established.
   */
   async connect(socketServerAddress=null, useHTTPHandshake=false, connectData=null) {
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
      if (connectData == null) {
         connectData = new Object();
      }
      if ((connectData["options"] == undefined) || (connectData["options"] == null)) {
         //default connection options (as of v0.4.1)
         connectData.options = new Object();
         connectData.options.wss = true;
         connectData.options.webrtc = false;
         connectData.options.ortc = false;
      }
      connectData.user_token = this.userToken;
      connectData.server_token = this.serverToken;
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
      var message_event = await RPC("WSS_Connect", connectData, this.webSocket); //connect the WebSocket
      var rpc_result_obj = JSON.parse(message_event.data);
      if (rpc_result_obj.error != undefined) {
         throw (new Error("Couldn't establish WebSocket Session: ("+rpc_result_obj.error.code+") "+rpc_result_obj.error.message));
      }
      if ((rpc_result_obj.result["private_id"] != undefined) && (rpc_result_obj.result["private_id"] != null)) {
         this._privateID = rpc_result_obj.result.private_id;
         //the following concatenation pattern matches the server
         //implementation:
         //var hash_source_str = this.serverToken+ ":" +this.userToken;
         //var generated_pid = await this.SHA256(hash_source_str);
         //console.log ("Are they the same? "+(this._privateID == generated_pid));
      } else {
         throw (new Error("No private ID returned in WSS_Connect response."));
      }
      if ((rpc_result_obj.result["connect"] != undefined) && (rpc_result_obj.result["connect"] != null)) {
         var connectedPeersList = rpc_result_obj.result["connect"];
         var optionsList = rpc_result_obj.result["options"]; //as of v0.4.1
         if (typeof(connectedPeersList) == "object") {
            connectedPeersList.forEach (function (peerPID, index, sourcArr) {
               this.peers.push(peerPID);
               this.peerOptions[peerPID] = optionsList[index];
            }, this);
         }
      }
      this.webSocket.addEventListener("message", this.handleSocketMessage);
      this.webSocket.addEventListener("close", this.handleSocketClose);
      return (message_event);
   }

   /**
   * Changes the private ID associated with this connection. The private ID
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
      var sendObj = new Object();
      sendObj.user_token = this.userToken;
      sendObj.server_token = this.serverToken;
      sendObj.action = "setPID";
      sendObj.privateID = newPrivateID;
      var requestID = "WSS_Session"+String(Math.random()).split("0.")[1];
      var rpc_result = await RPC("WSS_Session", sendObj, this.webSocket, false, requestID);
      var result = JSON.parse(rpc_result.data);
      //since raw API messages are asynchronous the next immediate message may not be ours so:
      while (requestID != result.id) {
         rpc_result = await this.webSocket.onEventPromise("message");
         result = JSON.parse(rpc_result.data);
         //we could include a max wait limit here
      }
      this._privateID = newPrivateID;
      var event = new Event("privateid");
      event.privateID = newPrivateID;
      this.dispatchEvent(event);
      return (true);
   }

   /**
   * Broadcasts a message to all connected peers.
   *
   * @param {*} data The data / message to broadcast.
   * @param {Object|Array} [excludeRecipients=null] If not omitted, null, or an empty
   * array this should be an indexed array of recipient private IDs to exclude
   * from the broadcast (if, for example, they will receive the data via
   * another communication channel).
   *
   * @return {Promise} An asynchronous Promise that will contain the result of
   * the broadcast or will throw an error on failure.
   */
   async broadcast(data, excludeRecipients=null) {
      var broadcastObj = new Object();
      broadcastObj.user_token = this.userToken;
      broadcastObj.server_token = this.serverToken;
      broadcastObj.type = "broadcast";
      if (excludeRecipients != null) {
         if (typeof(excludeRecipients["length"]) == "number") {
            //excludeRecipients is an array so add it to the "rcp" property
            var WSSExcObj = new Object();
            WSSExcObj.rcp = excludeRecipients;
         } else {
            //excludeRecipients is al_wssReady an object so assume everything is in place
            WSSExcObj = excludeRecipients;
         }
         broadcastObj.exclude = WSSExcObj;
      }
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
   * the send or reject with an <code>Error</code> object on failure.
   */
   async send(data, recipients) {
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
      var sendObj = new Object();
      sendObj.user_token = this.userToken;
      sendObj.server_token = this.serverToken;
      sendObj.type = "direct";
      sendObj.to = WSSRecpObj;
      sendObj.data = data;
      var rpc_result = await RPC("WSS_Send", sendObj, this.webSocket);
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
               this.session.dispatchEvent(event);
               break;
            case "direct":
               event = new Event("message");
               event.data = dataObj;
               this.session.dispatchEvent(event);
               break;
            case "update":
               event = new Event("update");
               event.data = dataObj;
               this.session.dispatchEvent(event);
               break;
            case "session":
               if (typeof(dataObj.result.connect) == "string") {
                  //dataObj.result.connect is the private ID of the new connection
                  event = new Event("peerconnect");
                  event.data = dataObj;
                  this.session.peers.push(dataObj.result.connect);
                  this.session.peerOptions[dataObj.result.connect] = dataObj.result.options;
                  this.session.dispatchEvent(event);
               } else if (typeof(dataObj.result.disconnect) == "string") {
                  //dataObj.result.disconnect is the private ID of the disconnect
                  event = new Event("peerdisconnect");
                  event.data = dataObj;
                  for (var count = 0; count < this.session.peers.length; count++) {
                     if (this.session.peers[count] == dataObj.result.disconnect) {
                        this.session.peers.splice(count, 1);
                        this.session.peerOptions[dataObj.result.disconnect] = null;
                        delete this.session.peerOptions[dataObj.result.disconnect];
                        break;
                     }
                  }
                  this.session.dispatchEvent(event);
               } else if (typeof(dataObj.result.change) == "object") {
                  //in the future we may support different types of session updates
                  event = new Event("peerpid");
                  event.data = dataObj;
                  for (var count = 0; count < this.session.peers.length; count++) {
                     if (this.session.peers[count] == dataObj.result.oldPrivateID) {
                        this.session.peers.splice(count, 1);
                        //insert at the same index
                        this.session.peers.splice(count, 0, dataObj.result.newPrivateID);
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

   toString() {
      return ("WSSClient");
   }

}
