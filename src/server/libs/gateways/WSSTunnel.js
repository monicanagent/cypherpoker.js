/**
* @file A WebSocket tunneling gateway using the <code>WSS_Tunnel</code> API in a WebSocket Sessions server.
*
* @version 0.4.1
* @author Patrick Bay
* @copyright MIT License
*
*/
const Gateway = require("../Gateway.js"); //Gateway interface (required by all extending Gateways)
const WebSocket = require("ws");
const crypto = require("crypto");
const url = require("url");
const SDB = require('sdb-node'); //Services Descriptor Bundle

/**
* @class A WebSocket tunnel gateway based on the <code>WSS_TUnnel</code> API of WebSocket Sessions.
*
* @extends Gateway
*/
module.exports = class WSSTunnel extends Gateway {

   /**
   * An object containing information about an established or available tunnel managed by
   * a {@link @WSSTunnel} instance.
   * @typedef {Object} WSSTunnel#TunnelObject
   * @property {String} alias The tunnel alias. This property may be used when wishing to join this
   * tunnel specifically.
   * @property {String} allowPID The private ID allowed to join the tunnel. If "*" then any
   * private ID may join.
   * @property {Object} socketOptions Instantiation options used when creating an instance of
   * the WebSocket (<code>socket</code>).
   * @property {Object} socket A reference to the bi-directional WebSocket used by the tunnel.
   * @property {WSSTunnel} gateway Reference to the associated {@link WSSTunnel} instance. Used to
   * establish an execution context when the object is used outside of the {@link WSSTunnel} instance.
   * @property {String} userToken The WebSocket Sessions user token generated for the tunnel connection.
   * @property {String} serverToken The WebSocket Sessions server token generated for the tunnel connection.
   * @property {String} privateID The WebSocket Sessions private ID generated for the tunnel connection.
   * @property {Object} options WebSocket Sessions connectivity options. Only the WebSocket option is enabled for
   */

   /**
   * Creates a new instance.
   *
   * @param {*} serverRef A reference to the main server object / scope for which this
   * instance is being used as a gateway.
   * @param {Object} gatewayData The configuration data for the gateway.
   *
   */
   constructor(serverRef, gatewayData) {
      super(serverRef, gatewayData);
      if (this._sdbEntity == undefined) {
         this._sdbEntity = WSSTunnel.defaultSDBEntity;
      }
      if (this.gatewayConfig.host != undefined) {
         this._WSSHost = this.gatewayConfig.host;
         console.log ("WSSTunnel host: "+this._WSSHost)
      }
      SDB.validateEntityObject(this._sdbEntity);
   }

   /**
   * @property {String} name="WSSTunnel" The human-readable name
   * of the gateway (used when sharing connectivity information, for example).
   *
   * @readonly
   * @static
   */
   static get name() {
      return ("WSSTunnel");
   }

   /**
   * @property {String} version="0.1.0" The gateway version.
   *
   * @readonly
   * @static
   */
   static get version() {
      return ("0.1.0");
   }

   /**
   * @property {Object} defaultSDBEntity A generic SDB entity object with
   * default properties for the gateway that can be used to generate a
   * custom SDB entity object using [addToSDBEntity]{@link WSSTunnel@addToSDBEntity}
   * and ultimately bundled using [toSDB]{@link WSSTunnel@toSDB}.
   *
   * @readonly
   * @static
   * @see https://github.com/monicanagent/sdb/blob/master/TECHNICAL.md
   */
   static get defaultSDBEntity() {
      // Valid properties: entity (required), name, description, transport, protocol, host, port, parameters
      var sdbEntity = new Object();
      sdbEntity.entity = "api";
      sdbEntity.name = "WSSTunnel";
      sdbEntity.description = "WebSocket Sessions Tunnel.";
      sdbEntity.transport = "wsst";
      sdbEntity.protocol = "wss";
      sdbEntity.parameters = new Object();
      sdbEntity.parameters.endpoint = new Object();
      sdbEntity.parameters.endpoint.aliases = new Array();
      return (sdbEntity);
   }

   /**
   * @property {Array} defaultTunnels Default tunnel definitions used
   * when creating tunnels and no other definitions are available.
   *
   * @readonly
   * @static
   */
   static get defaultTunnels() {
      var tunnelDefinitions = new Array();
      for (var count=0; count < 5; count++) {
         tunnelDefinitions.push({alias:null, allow:"*", socketOptions:null});
      }
      return (tunnelDefinitions);
   }

   /**
   * @property {Object} defaultSocketOptions Default options provided to
   * a WebSocket constructor (as the second parameter), when creating a new instance
   * for a tunnel.
   *
   * @readonly
   * @static
   */
   static get defaultSocketOptions() {
      return ({perMessageDeflate: false});
   }

   /**
   * @property {String} WSSHost The URL or IP of the WSS tunneling host / proxy.
   *
   * @@readonly
   */
   get WSSHost() {
      if (this._WSSHost == undefined) {
         this._WSSHost = "ws://127.0.0.1:8090";
      }
      return (this._WSSHost); //testing
   }


   /**
   * @property {Array} tunnels Indexed array of objects containing
   * information about available tunnels containing
   * @readonly
   */
   get tunnels() {
      if (this._tunnels == undefined) {
         this._tunnels = new Array();
      }
      return (this._tunnels);
   }

   /**
   * Updates information in a  genericSDB entity template used to generate a SDB
   * via [getSDB]{@link WSSTunnel#getSDB}.
   *
   * @param {String} property The SDB entity data property to udpate.
   *
   * @see https://github.com/monicanagent/sdb/blob/master/TECHNICAL.md
   */
   updateSDBEntity(property, value) {
      if (this._sdbEntity == undefined) {
         this._sdbEntity = WSSTunnel.defaultSDBEntity;
      }
      this._sdbEntity[property] = value;
   }

   /**
   * @property {Boolean} started=false True if the gateway is started and
   * ready to send/receive data.
   */
   get started() {
      if (this._started == undefined) {
         this._started = false;
      }
      return (this._started);
   }

   set started(startedSet) {
      this._started = startedSet;
   }

   /**
   * Services Descriptor Bundle entity information for the extending instance.
   *
   * @property {String} [format="base85"] The format in which the generated SDB
   * is returned. Valid formats are "base85" (binary), "base64" (binary), "object"
   * (native JavaScript object), and "json" (JSON string).
   * @property {Array} [entityTypes=["api","p2p"]] The services (entity types),
   * that are available via this gateway. A new SDB entity is created for each
   * entity type specified.
   *
   * @return {String} The Services Descriptor Bundle containing information on the
   * gateway connectivity options, in the <code>format</code> specified,
   * or <code>null</code> if a valid SDB can't be generated.
   *
   * @async
   * @see https://github.com/monicanagent/sdb/blob/master/TECHNICAL.md
   */
   async getSDB(format="base85", entityTypes=["api","p2p"]) {
      if (this._sdbEntity == undefined) {
         this._sdbEntity = WSSTunnel.defaultSDBEntity;
      }
      var validationResult = SDB.validateEntityObject(this._sdbEntity);
      if (validationResult == null) {
         var sdbArray = new Array();
         for (var count=0; count < entityTypes.length; count++) {
            var entityType = entityTypes[count];
            var newEntity = Object.create(this._sdbEntity);
            newEntity.entity = entityType;
            //other properties remain unaffected
            sdbArray.push (newEntity);
         }
         var sdb = new SDB();
         await sdb.decode(sdbArray);
         return (await sdb.encode(format));
      } else {
         throw (new Error(validationResult));
      }
   }

   /**
   * Retrieves a [TunnelObject]{@link WSSTunnel#TunnelObject} by its associated
   * WebSocket instance.
   *
   * @param {Object} socket The WebSocket instance of the associated tunnel.
   *
   * @return {WSSTunnel#TunnelObject} The tunnel object associated with the WebSocket
   * instance or null if none can be found.
   */
   getTunnelBySocket(socket) {
      for (var count=0; count < this.tunnels.length; count++) {
         var currentTunnel = this.tunnels[count];
         if (currentTunnel.socket === socket) {
            return (currentTunnel);
         }
      }
      return (null);
   }

   /**
   * Activates the gateway components specified to be started in [gatewayConfig]{@link localtunnel#gatewayConfig} and
   * updates the  updates the [started]{@link localtunnel#started}.
   *
   * @param {Array} [tunnelConfigs=null] An array matching the format of the array parameter
   * for {@link WSSTunnel#tunnelDefinitions}. If this parameter is not supplied or null, the
   * <code>tunnels</code> property of [gatewayConfig]{@link Gatway#gatewayConfig} will be used.
   * If this property is not available, [defaultTunnels]{@link WSSTunnel.defaultTunnels} is used.
   *
   * @async
   */
   async start(tunnelConfigs=null) {
      if (tunnelConfigs == null) {
         tunnelConfigs = this.gatewayConfig.tunnels;
      }
      if ((tunnelConfigs == undefined) || (tunnelConfigs == null)) {
         tunnelConfigs = WSSTunnel.defaultTunnels;
      }
      await this.openTunnels(tunnelConfigs);
      try {
         var urlObj = new URL(this.WSSHost);
      } catch (err) {
         urlObj = url.parse(this.WSSHost); //legacy Node.js API
      }
      var eventInfo = new Object();
      eventInfo.protocol = urlObj.protocol.split(":")[0];
      eventInfo.host = urlObj.hostname;
      eventInfo.port = Number(urlObj.port);
      eventInfo.parameters = new Object();
      eventInfo.parameters.endpoint = new Object();
      eventInfo.parameters.endpoint.aliases = new Array();
      for (var count=0; count < this.tunnels.length; count++) {
         eventInfo.parameters.endpoint.aliases.push(this.tunnels[count].alias);
      }
      this.updateSDBEntity("protocol", eventInfo.protocol);
      this.updateSDBEntity("host", eventInfo.host);
      this.updateSDBEntity("port", eventInfo.port);
      this.updateSDBEntity("parameters", JSON.stringify(eventInfo.parameters));
      this._started = true;
      this.dispatchOpenEvent(eventInfo);
   }

   /**
   * Opens a series of one-to-one WebSocket tunnels via [WSSHost]{@link WSSTunnel#WSSHost}, and
   * stores the opened tunnels and their associated information in the
   * [tunnels]{@link WSSTunnel#tunnels} array.
   *
   * @param {Array} tunnelDefinitions Contains information about the tunnels to create. Each array
   * element must contain an <code>alias</code> for the tunnel which, if null will cause a default and
   * unique alias to be created, and an <code>allow</code> property which specifies the private ID
   * <b>on the tunneling server</code> (not this endpoint), that may connect via this tunnel,
   * or "*" which denotes that any peer may connect. An optional <code>socketOptions</code> object
   * may be specified which will be passed to the WebSocket constructor to instantiate the
   * tunnel socket with.
   *
   * @async
   */
   async openTunnels(tunnelDefinitions) {
      var aliasRoot = null;
      for (var count=0; count < tunnelDefinitions.length; count++) {
         var currentDefinition = tunnelDefinitions[count];
         if (currentDefinition.socketOptions == undefined) {
            var socketOptions = null;
         } else {
            socketOptions = currentDefinition.socketOptions;
         }
         if (typeof(currentDefinition.allow) != "string") {
            var allowPID = "*";
         } else {
            allowPID = currentDefinition.allow;
         }
         if (currentDefinition.alias == null) {
            if (aliasRoot == null) {
               var tunnelObj = await this.openTunnel(null, allowPID, socketOptions);
               aliasRoot = tunnelObj.alias;
               this.tunnels.push(tunnelObj);
            } else {
               this.tunnels.push(await this.openTunnel(aliasRoot + String(count), allowPID, socketOptions));
            }
         } else {
            this.tunnels.push(await this.openTunnel(currentDefinition.alias, allowPID, socketOptions));
         }
      }
   }

   /**
   * Opens a single WebSocket tunnel via the [WSSHost]{@link WSSTunnel#WSSHost}.
   *
   * @param {String} [alias=null] An alias to register for the tunnel that a client
   * can use to connect directly. If null or not supplied, a default alias based on
   * the private ID of the tunneled connection will be used.
   * @param {String} [allowPID="*"] An exclusive  private ID to allow to join this
   * tunnel. If "*" or ommitted, any private ID is allowed to connect.
   * @param {Object} [socketOptions=null] The socket options to instaniate the
   * new WebSocket instance with (second parameter of the constructor). If null
   * or omitted, the {@link WSSTunnel.defaultSocketOptions} is used.
   *
   * @return {WSSTunnel#TunnelObject} An object containing information and
   * references associated with the new tunnel.
   */
   async openTunnel(alias=null, allowPID="*", socketOptions=null) {
      if (socketOptions == null) {
         socketOptions = WSSTunnel.defaultSocketOptions;
      }
      var newTunnelObj = new Object();
      if (alias != null) {
         newTunnelObj.alias = alias;
      }
      newTunnelObj.gateway = this;
      newTunnelObj.alias = alias;
      newTunnelObj.allowPID = allowPID;
      newTunnelObj.socketOptions = socketOptions;
      newTunnelObj.userToken = await this.makeConnectionToken();
      newTunnelObj.socket = new WebSocket(this.WSSHost, socketOptions);
      newTunnelObj.socket._tunnel = newTunnelObj; //cyclical reference; DO NOT USE: JSON.stringify(newTunnelObj)
      let promise = new Promise((resolve, reject) => {
         if (newTunnelObj.socket.readyState == WebSocket.OPEN) {
            //socket may have opened before promise was created
            resolve(true);
         } else {
            //wait for socket open
            newTunnelObj.socket.once("open", () => {
               resolve(true);
            });
         }
      });
      try {
         var connected = await promise;
         if (connected != true) {
            throw (new Error("Could not connect to tunneling server."));
         }
      } catch (err) {
         throw (err);
      }
      //handshake; get server token
      var response = await this.sendRPCRequest("WSS_Handshake", {"user_token":newTunnelObj.userToken}, newTunnelObj.socket);
      if (response.error == undefined) {
         newTunnelObj.serverToken = response.result.server_token;
         var connectData = new Object();
         connectData.user_token = newTunnelObj.userToken;
         connectData.server_token = newTunnelObj.serverToken;
         connectData.options = new Object(); //peer connection options
         connectData.options.wss = true;
         connectData.options.webrtc = false;
         connectData.options.ortc = false;
         //connect session
         response = await this.sendRPCRequest ("WSS_Connect", connectData, newTunnelObj.socket); //establish connection
         newTunnelObj.privateID = response.result.private_id;
         if (alias == null) {
            newTunnelObj.alias = response.result.private_id;
         }
         var tunnelData = new Object();
         tunnelData.user_token = newTunnelObj.userToken;
         tunnelData.server_token = newTunnelObj.serverToken;
         tunnelData.action = "open";
         tunnelData.tunnelServerMessages = false;  //send non-status messages from the tunneling server?
         tunnelData.alias = alias;
         tunnelData.allowPID = allowPID;
         //open new tunnel
         var response = await this.sendRPCRequest ("WSS_Tunnel", tunnelData, newTunnelObj.socket);
         if (response.error != undefined) {
            throw (new Error(response.error.mesage));
         }
         if (response.result.status != "open") {
            throw (new Error("Unexpected tunnel status: "+response.result.status));
         }
         newTunnelObj.socket.addListener("message", this.onSocketMessage);
         newTunnelObj.socket._send = newTunnelObj.socket.send; //create alias to prevent infinite recursion
         newTunnelObj.socket.send = (message) => {
            this.sendToTunnel(message, newTunnelObj.socket);
         }
      } else {
         throw (new Error ("Tunneling server error: "+response.error.message));
      }
      return (newTunnelObj);
   }

   /**
   * Builds a valid JSON-RPC request, result, or notification object.
   *
   * @param {String} [type="request"] The JSON-RPC message type. Valid types include:<br/>
   * <ul>
   * <li><code>"request"</code>: A request / method invocation object. </li>
   * <li><code>"result"</code>: An invocation result object.</li>
   * <li><code>"notification"</code>: A notification object.</li>
   * </ul>
   * @param {Object} [options=null] An object containing additional options
   * for the returned object depending on its type.
   * @param {Object} [options.id=null] An id value for the object. If <code>type</code>
   * is a "result" or "request" and this value is <code>null</code> or omiited,
   * a random value is used. If <code>type</code> is "notification" the <code>id</code>
   * is ommitted according to specification.
   * @param {String} [options.method=null] A remote RPC method to invoke. If <code>type</code>
   * is "request" and this value is <code>null</code> or omiited, an exception is thrown.
   * If <code>type</code> is not "request" this option is ignored.
   * @param {Object|Array} [options.params=null] Parameters to invoke the remote <code>method</code>
   * with. If <code>type</code> is not "request" this option is ignored.
   * @param {String} [version="2.0"] The JSON-RPC version identifier.
   *
   * @return {Object} A JSON-RPC-formatted object of the defined type.
   *
   * @see https://www.jsonrpc.org/specification
   */
   buildJSONRPC (type="request", options=null, version="2.0") {
      var JSONRPC = new Object();
      JSONRPC.jsonrpc = version;
      if (options == null) {
         options = new Object();
      }
      if ((type == "result") || (type == "request")) {
         if (options["id"] == undefined) {
            JSONRPC.id = String(Math.random()).split(".")[1];
         } else {
            JSONRPC.id = options.id;
         }
      }
      if ((type == "result") || (type == "notification")) {
         JSONRPC.result = new Object();
      } else if (type == "request") {
         if (typeof(options["method"]) != "string") {
            throw (new Error("options.method must be a string."));
         }
         JSONRPC.method = options.method;
         if (options["params"] != undefined) {
            if (typeof(options.params) != "object") {
               throw (new Error("options.params must be an array or object."));
            }
            JSONRPC.params = options.params;
         }
      }
      return (JSONRPC);
   }


   /**
   * Generates a random server connection token to be used for authentication (for example,
   * to be used as a <code>user_token</code>).
   *
   * @return {String} A randomly generated server connection token.
   *
   */
   makeConnectionToken() {
      var promise = new Promise((resolve, reject) => {
         crypto.randomBytes(32, (err, buf) => {
            if (err) {
               reject (err);
            }
            resolve (buf.toString("hex"));
         });
      })
      return (promise);
   }

   /**
   * Builds and sends a JSON-RPC 2.0 request to the tunneling server at
   * [WSSHost]{@link WSSTunnel#WSSHost}.
   *
   * @param {String} method The JSON-RPC method to invoke.
   * @param {*} params The JSON-RPC parameters to invoke the <code>method</code> with.
   * @param {Object} socketInstance TThe WebSocket instance over which to send the
   * request.
   *
   * @return {Promise} The promise resolves with the returned response matching the
   * request id, or rejects with an error.
   */
   sendRPCRequest(method, params, socketInstance) {
      var promise = new Promise((resolve, reject) => {
         var JSONRPCMsg = this.buildJSONRPC("request", {method:method, params:params});
         var responder = (data) => {
            var resultObj = JSON.parse(data);
            if (resultObj.id == JSONRPCMsg.id) {
               socketInstance.removeListener("message", responder);
               resolve(resultObj);
            }
         };
         socketInstance.addListener("message", responder);
         socketInstance.send(JSON.stringify(JSONRPCMsg));
      });
      return (promise);
   }

   /**
   * Processes messages from a tunneled socket. Any non-status messages
   * are sent to the {@link processAPIRequest} function.
   *
   * @param {String} message The message to process.
   *
   * @private
   * @async
   */
   async onSocketMessage(message) {
      try {
         //NOTE: this = WebSocket instance
         var tunnel = this._tunnel;
         var gateway = tunnel.gateway;
         var msgObject = JSON.parse(message);
         if (typeof(msgObject.result) == "object") {
            var resultObj = msgObject.result;
            //probably a tunnel notification
            if (resultObj.type == "tunnel") {
               //tunnel notification message
               switch (resultObj.status) {
                  case "joined":
                     //resultObj.endpointPID  is our tunnel private ID
                     var joinedPID = resultObj.joinedPID;
                     var eventObj = new Object();
                     eventObj.privateID = joinedPID;
                     gateway.dispatchConnectEvent(eventObj);
                     break;
                  case "close":
                     //resultObj.endpointPID  is our tunnel private ID
                     var privateID = resultObj.joinedPID;
                     var eventObj = new Object();
                     eventObj.privateID = privateID;
                     gateway.dispatchDisconnectEvent(eventObj);
                     tunnel.socket.emit("close");
                     break;
                  default:
                     break;
               }
            }
         } else {
            gateway.processAPIRequest(message, this);
         }
      } catch (err) {
         console.error(err);
      }
   }

   /**
   * Processes an API request by invoking the main [server]{@link Gateway#server}'s
   * {@link processRPCRequest} function.
   *
   * @param {*} message The (hopefully) JSON-RPC 2.0 API request to process.
   * @param {Object} responseSocket A reference to the originating WebSocket to
   * which the APi response should be sent.
   */
   processAPIRequest(message, responseSocket) {
      var sessionObj = new Object();
      sessionObj.endpoint = "wstunnel";
      sessionObj.serverRequest = responseSocket;
      sessionObj.serverResponse = responseSocket;
      this.server.processRPCRequest(message, sessionObj);
   }

   /**
   * Sends a message to a tunneled WebSocket, usually as part of an API
   * response callback registered in [openTunnel]{@link WSSTunnel#openTunnel}.
   *
   * @param {*} message The JSON-RPC 2.0 respone to send.
   * @param {Object} responseSocket A reference to the originating WebSocket to
   * used to originally invoke the APi request.
   */
   sendToTunnel(message, responseSocket) {
      responseSocket._send(message);
   }

   /**
   * Dispatches an "open" event when the tunnel has opened and is ready to accept
   * incoming connections. The event will include a public <code>host</code> IP
   * and <code>port</code> as well as a <code>sdb</code> that clients/peers
   * can connect to.
   *
   * @param {Object} eventInfo Information to include with the event dispatch.
   * @param {String} eventInfo.protocol The protocol to use with the open connection.
   * @param {String} eventInfo.host The public host IP of the open connection.
   * @param {Number} eventInfo.port The public host port of the open connection.
   *
   * @private
   * @param
   */
   async dispatchOpenEvent(eventInfo) {
      var event = new Object();
      event.protocol = eventInfo.protocol;
      event.host = eventInfo.host;
      event.port = eventInfo.port;
      event.tunnels = this.tunnels;
      event.sdb = new Object();
      event.sdb.base85 = await this.getSDB("base85", ["api", "p2p"]);
      event.sdb.base64 = await this.getSDB("base64", ["api", "p2p"]);
      this.emit("open", event);
   }

   /**
   * Dispatches a "connect" event when a new client / peer establishes
   * a new connection through the tunnel.
   *
   * @param {Object} eventInfo Information to include with the event dispatch.
   * @param {String} privateID The private ID of the connecting client/peer.
   *
   * @private
   * @param
   */
   dispatchConnectEvent(eventInfo) {
      var event = new Object();
      event.type = "connect";
      event.privateID = eventInfo.privateID;
      this.emit("connect", event);
   }

   /**
   * Dispatches a "disconnect" event when a client / peer disconnects from the tunnel.
   *
   * @param {Object} eventInfo Information to include with the event dispatch.
   * @param {String} privateID The private ID of the disconnecting client/peer.
   *
   * @private
   * @param
   */
   dispatchDisconnectEvent(eventInfo) {
      var event = new Object();
      event.type = "disconnect";
      event.privateID = eventInfo.privateID;
      this.emit("disconnect", event);
   }

   /**
   * Deactivates the gateway components specified to be disabled in [gatewayConfig]{@link localtunnel#gatewayConfig} and
   * updates the  updates the [started]{@link localtunnel#started}.
   *
   * @return {Promise} The returned promise resolves when the gateway is stopped and no longer sending
   * or receiving data.
   */
   stop() {
      for (var count = 0; count < this.tunnels.length; count++) {
         try {
            this.tunnels[count].socket.removeListener("message", this.onSocketMessage);
            this.tunnels[count].socket.close(1000, "Endpoint closed.");
         } catch (err) {
         }
      }
      this._tunnels = new Array();
      this._started = false;
      this.emit("stop");
   }

   /**
   * Destroys the instance by closing any open connections and clearing and
   * held references / data.
   *
   * @async
   */
   async destroy() {
      this.stop();
   }

   toString() {
      return ("WSSTunnel");
   }

}
