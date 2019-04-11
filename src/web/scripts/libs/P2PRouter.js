/**
* @file Peer-to-peer message routing interface.
*
* @version 0.4.1
*/
/**
* @class Transparently routes messages to/from available peer-to-peer interfaces.
* @extends EventDispatcher
* @see {@link WSSClient}
* @see {@link WSSTunnel}
* @see {@link WebRTCClient}
*/
class P2PRouter extends EventDispatcher {

   /**
   * A peer-to-peer message has been received on one of the routed transports
   * being handled by this instance. Both "direct" and "message" types emit
   * the same event (examine the <code>data</code> property to differentiate).
   *
   * @event P2PRouter#message
   * @type {Event}
   * @property {Object} data A native JSON-RPC 2.0 result or notification object.
   * @property {String} transportType The transport type through which the message
   * was received. This should match one of the <code>PeerConnectionObject.options</code>.
   * @property {Object} transport A reference to the transport interface that initially
   * handled the receipt of the message.
   */
   /**
   * A server-originating "update" message has been received on one of the routed transports
   * being handled by this instance.
   *
   * @event P2PRouter#update
   * @type {Event}
   * @property {Object} data A native JSON-RPC 2.0 result or notification object.
   * @property {String} transportType The transport type through which the message
   * was received. This should match one of the <code>PeerConnectionObject.options</code>.
   * @property {Object} transport A reference to the transport interface that initially
   * handled the receipt of the message.
   */
   /**
   * A new peer-to-peer connection has been established.
   *
   * @event P2PRouter#peerconnect
   * @type {Event}
   * @property {Object} data A native JSON-RPC 2.0 result or notification object.
   * @property {String} transportType The transport type on which the new connection was
   * established. This should match one of the <code>PeerConnectionObject.options</code>.
   * @property {Object} transport A reference to the transport interface on which the
   * new connection was established.
   */
   /**
   * A connected peer has changed private IDs.
   *
   * @event P2PRouter#peerpid
   * @type {Event}
   * @property {String} oldPrivateID The old / previous private ID for the peer.
   * @property {String} newPrivateID The new / changed private ID for the peer.
   */
   /**
   * A  peer-to-peer connection has closed.
   *
   * @event P2PRouter#peerdisconnect
   * @type {Event}
   * @property {Object} data A native JSON-RPC 2.0 result or notification object.
   * @property {String} transportType The transport type on which the connection was
   * previously active established. This should match one of the <code>PeerConnectionObject.options</code>.
   * @property {Object} transport A reference to the transport interface on which the
   * connection was previously active
   */

   /**
   * An object containing information and references to connectivity
   * options for an individual peer.
   *
   * @typedef {Object} PeerConnectionObject
   * @property {Object} options Contains the transport options (supported connectivity)
   * for the peer.
   * @property {Boolean} options.wss=false Does the peer support WebSocket Sessions connecivity?
   * @property {Boolean} options.webrtc=false Does the peer support WebRTC connecivity?
   * @property {Boolean} options.ortc=false Does the peer support ORTC connecivity?
   * @property {Object} status Contains the connection status of each transport <code>option</code>
   * @property {String} status.wss="closed" The WebSocket Sessions transport may either be <code>"closed"</code>,
   * the connection may be <code>"pending"</code>, it may be <code>"open"</code> for bi-directional
   * communication, or a connection attempt may have <code>"failed"</code>.
   * @property {String} status.webrtc="closed" The WebRTC transport may either be <code>"closed"</code>,
   * the connection may be <code>"pending"</code>, it may be <code>"open"</code> for bi-directional
   * communication, or a connection attempt may have <code>"failed"</code>.
   * @property {String} status.ortc="closed" The ORTC transport may either be <code>"closed"</code>,
   * the connection may be <code>"pending"</code>, it may be <code>"open"</code> for bi-directional
   * communication, or a connection attempt may have <code>"failed"</code>.
   * @property {Object} transport Contains references to any transports defined in
   * the conectivity <code>options</code>.
   * @property {Object} transport.wss=null A reference to the WebSocket Sessions / Tunnel transport
   * with which to communicate with the peer.
   * @property {Object} transport.webrtc=null] A reference to the WebRTC transport
   * with which to communicate with the peer.
   * @property {Object} transport.ortc=null A reference to the ORTC transport
   * with which to communicate with the peer.
   * @property {Object} connectTimeout References to <code>Timeout</code> objects
   * used when attempting to establish a connection to the peer.
   * @property {Object} connectTimeout.wss=null The <code>Timeout</code> object
   * used when attempting to establish a WebSocket Sessions connection.
   * @property {Object} connectTimeout.webrtc=null The <code>Timeout</code> object
   * used when attempting to establish a WebRTC connection.
   * @property {Object} connectTimeout.ortc=null The <code>Timeout</code> object
   * used when attempting to establish a ORTC connection.
   * @property {Object} connectPromise References to <code>Promise</code> function
   * references that are resolved or rejected when the associated transport is attempting
   * a connection.
   * @property {Object} connectPromise.wss The <code>Promise</code> functions that resolve
   * or reject when the WebSocket Sessions / Tunnel transport connects or fails to connect.
   * @property {Function} connectPromise.wss.resolve=null The <code>Promise.resolve</code>
   * function invoked on a successfull WebSocket Sessions connection.
   * @property {Function} connectPromise.wss.reject=null The <code>Promise.reject</code>
   * function invoked on a failed WebSocket Sessions connection.
   * @property {Object} connectPromise.webrtc The <code>Promise</code> functions that resolve
   * or reject when the WebRTC transport connects or fails to connect.
   * @property {Function} connectPromise.webrtc.resolve=null The <code>Promise.resolve</code>
   * function invoked on a successfull WebRTC connection.
   * @property {Function} connectPromise.webrtc.reject=null The <code>Promise.reject</code>
   * function invoked on a failed WebRTC connection.
   * @property {Object} connectPromise.ortc The <code>Promise</code> functions that resolve
   * or reject when the ObjectRTC transport connects or fails to connect.
   * @property {Function} connectPromise.ortc.resolve=null The <code>Promise.resolve</code>
   * function invoked on a successfull ObjectRTC connection.
   * @property {Function} connectPromise.ortc.reject=null The <code>Promise.reject</code>
   * function invoked on a failed ObjectRTC connection.
   */

   /**
   * Creates an instance of P2PRouter.
   *
   * @param {Object} [configData=null] Application configuration data, usually as loaded at
   * startup.
   */
   constructor(configData=null) {
      super();
      this._config = configData;
      try {
         P2PRouter.supportedTransportspreferred = this.config.p2p.transports.preferred;
      } catch (err) {
         //this is not a fatal error and doesn't requite a warning
         console.log ("Preferred peer-to-peer transport(s) not specified in application configuration. Using default.");
      }
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
   * Contains information on all the transports currently supported or recognized by P2PRouter.
   * @property {Array} [preferred=["webrtc","wss","ortc"]] Indexed list of transports in the order of default preference
   * (i.e. index 0 is most preferred). The first <i>available</i> preferred transport will be used
   * when communicating with peers unless another order is specified when sending. If defined in the
   * application [config]{@link P2Prouter#config}, the <code>p2p.transports.preferred</code> array
   * will be used instead of the internal default.
   * @property {Object} options Name-value pairs of transports
   * and their availabilities.
   * @property {Boolean} options.webrtc WebRTC
   * connectivity is available.
   * @property {Boolean} options.wss WebSocket Sessions
   * connectivity is available.
   * @property {Boolean} options.ortc ObjectRTC
   * connectivity is available.
   * @property {Object} sendModel Describes how messages
   * sent to multiple recipients should be treated, either "single"
   * (single transport per recipient), or "multi" (shared transport for
   * multiple recipients). Unavailable transports will have a model of "none".
   * @property {String} sendModel.webrtc WebRTC
   * message sending model. Usually "single".
   * @property {String} sendModel.wss WebSocket Sessions
   * message sending model. Usually "multi".
   * @property {String} sendModel.ortc ObjectRTC
   * message sending model. Usually "single".
   *
   * @type {Object}
   * @static
   */
   static get supportedTransports() {
      if (P2PRouter._supportedTransports == undefined) {
         P2PRouter._supportedTransports =  new Object();
         P2PRouter._supportedTransports.preferred = ["webrtc", "wss", "ortc"];
         P2PRouter._supportedTransports.options = new Object();
         P2PRouter._supportedTransports.sendModel = new Object();
         if (DetectRTC.isWebRTCSupported == true) {
            P2PRouter._supportedTransports.options.webrtc = true;
            P2PRouter._supportedTransports.sendModel.webrtc = "single";
         } else {
            P2PRouter._supportedTransports.options.webrtc = false;
            P2PRouter._supportedTransports.sendModel.webrtc = "none";
         }
         if ((WSSClient != undefined) && (WSSClient != null)) {
            P2PRouter._supportedTransports.options.wss = true;
            P2PRouter._supportedTransports.sendModel.wss = "multi";
         } else {
            P2PRouter._supportedTransports.options.wss = false;
            P2PRouter._supportedTransports.sendModel.wss = "none";
         }
         if (DetectRTC.isORTCSupported == true) {
            P2PRouter._supportedTransports.options.ortc = true;
            P2PRouter._supportedTransports.sendModel.ortc = "single";
         } else {
            P2PRouter._supportedTransports.options.ortc = false;
            P2PRouter._supportedTransports.sendModel.ortc = "none";
         }
      }
      return (P2PRouter._supportedTransports);
   }

   /**
   * The privateID assigned to the session by the [rendezvous]{@link P2PRouter#rendezvous}.
   * This value will be <code>null</code> if no session has been established.
   * @type {String}
   */
   get privateID() {
      if ((this.rendezvous == null) && (this._privateID == undefined)) {
         this._privateID = null;
      } else {
         if (this._privateID == undefined) {
            this._privateID = this.rendezvous.privateID;
         }
      }
      return (this._privateID);
   }

   set privateID(pidSet) {
      this._privateID = pidSet;
   }

   /**
   * Internally-generated user token required by the [rendezvous]{@link P2PRouter#rendezvous}.
   * @type {String}
   */
   get userToken() {
      if ((this.rendezvous == null) && (this._userToken == undefined)) {
         this._userToken = null;
      } else {
         if (this._userToken == undefined) {
            this._userToken = this.rendezvous.userToken;
         }
      }
      return (this._userToken);
   }

   set userToken(utSet) {
      this._userToken = utSet;
   }

   /**
   * Server-generated token required by the [rendezvous]{@link P2PRouter#rendezvous}.
   * @type {String}
   */
   get serverToken() {
      if ((this.rendezvous == null) && (this._serverToken == undefined)) {
         this._serverToken = null;
      } else {
         if (this._serverToken == undefined) {
            this._serverToken = this.rendezvous.serverToken;
         }
      }
      return (this._serverToken);
   }

   set serverToken(stSet) {
      this._userToken = stSet;
   }

   /**
   * A list of currently connected peer IDs gathered from [peerConnections]{@link P2PRouter#peerConnections}.
   * @type {Array}
   * @readonly
   */
   get peers() {
      if (this.rendezvous == null) {
         return (null);
      }
      var returnPeers = new Array();
      for (var privateID in this.peerConnections) {
         returnPeers.push(privateID);
      }
      return (returnPeers);
   }

   /**
   * A reference to the P2P rendezvous, signalling, and fallback connection handler, or <code>null</code>
   * if no such connection exists or is invalid.
   * @type {*}
   */
   get rendezvous() {
      if (this._rendezvous == undefined) {
         return (null);
      }
      return (this._rendezvous);
   }

   set rendezvous(rendSet) {
      this._rendezvous = rendSet;
      //remove any existing listeners
      this._rendezvous.removeEventListener("message", this.onMessage);
      this._rendezvous.removeEventListener("update", this.onUpdate);
      this._rendezvous.removeEventListener("peerconnect", this.onPeerConnect);
      this._rendezvous.removeEventListener("peerpid", this.onPeerPIDUpdate);
      this._rendezvous.removeEventListener("peerdisconnect", this.onPeerDisconnect);
      //add new listeners
      this._rendezvous.addEventListener("message", this.onMessage, this);
      this._rendezvous.addEventListener("update", this.onUpdate, this);
      this._rendezvous.addEventListener("peerconnect", this.onPeerConnect, this);
      this._rendezvous.addEventListener("peerpid", this.onPeerPIDUpdate, this);
      this._rendezvous.addEventListener("peerdisconnect", this.onPeerDisconnect, this);
      switch (this._rendezvous.toString()) {
         case "WSSClient":
            this.updatePeerConnections(["wss"],[this._rendezvous]);
            break;
         case "WSSTunnel":
            this.updatePeerConnections(["wss"],[this._rendezvous]);
            break;
         default:
            break;
      }
   }

   /**
   * Contains {@link PeerConnectionObject} for any connected or desired peers, stored by private ID.
   * That is:<br/>
   * <code>peerConnections[<i>privateID</i>]=</code>{@link PeerConnectionObject}
   * @type {Object}
   * @readonly
   */
   get peerConnections() {
      if (this._peerConnections == undefined) {
         this._peerConnections = new Object();
      }
      return (this._peerConnections);
   }

   /**
   * Returns a {@link PeerConnectionObject} contained in [peerConnections]{@link P2PRouter#peerConnections}
   * by one of its transport references.
   *
   * @param {Object} transport A reference to a specific transport instance for which
   * to return a [peerConnections]{@link P2PRouter#peerConnections}. If this is a shared transport such
   * as WebSocket Sessions instance, the first matching [peerConnections]{@link P2PRouter#peerConnections}
   * object will be returned.
   *
   * @return {PeerConnectionObject} The first object in [peerConnections]{@link P2PRouter#peerConnections} containing a matching
   * <code>transport</code> reference. <code>null</code> is returned if no match can be found.
   */
   getPCOByTransport(transport) {
      for (var privateID in this.peerConnections) {
         var peerTransports = this.peerConnections[privateID].transport;
         for (var peerTransport in peerTransports) {
            if (peerTransports[peerTransport] === transport) {
               return (this.peerConnections[privateID]);
            }
         }
      }
      return (null);
   }

   /**
   * Returns a private ID associated with a {@link PeerConnectionObject} in
   * [peerConnections]{@link P2PRouter#peerConnections}.
   *
   * @param {Object} transport A reference to a specific transport instance for which
   * to return a private ID. If this is a shared transport such as WebSocket Sessions instance,
   * the first matching [peerConnections]{@link P2PRouter#peerConnections}'s private ID will be returned.
   *
   * @return {Object} The private ID of the first [peerConnections]{@link P2PRouter#peerConnections} containing
   * a matching <code>transport</code> reference. <code>null</code> is returned if no match can be found.
   */
   getPIDByTransport(transport) {
      for (var privateID in this.peerConnections) {
         var peerTransports = this.peerConnections[privateID].transport;
         for (var peerTransport in peerTransports) {
            if (peerTransports[peerTransport] === transport) {
               return (privateID);
            }
         }
      }
      return (null);
   }

   /**
   * Establishes a connection to a main / default rendezvous and fallback server.
   * If no such connection is established, the local [privateID]{@link P2PRouter#privateID} must be
   * set manually prior to establishing any peer-to-peer connections.
   *
   * @param {Object} connectInfo An object containing information about the
   * rendezvous/fallback server to connect to. The object must contain at least a
   * <code>type</code> property.
   * @param {String} connectInfo.transport Specifies the type of transport defined
   * by the <code>connectInfo</code> object. This parameter is case-sensitive.
   * Valid types include:<br/>
   * <ul>
   * <li><code>wss</code>: WebSocket Sessions</li>
   * <li><code>wsst</code>: WebSocket Sessions Tunnel</li>
   * </ul>
   * @param {Object} [connectInfo.tunnelParams] Tunneling parameters such as a list of
   * possible endpoints for use with the tunneling connection (if <code>connectInfo.transport="wsst"</code>,
   * for example).
   * @throws {Error} Thrown when the specified server could not be contacted or
   * if there is a problem with the <code>connectioInfo</code> parameter.
   */
   async connectRendezvous(connectionInfo) {
      if (connectionInfo == null) {
         throw (new Error("No connection info object provided."));
      }
      if (typeof(connectionInfo.transport) != "string") {
         throw (new Error("The connection info \"transport\" property must be a string."));
      }
      var connectData = new Object();
      connectData.options = P2PRouter.supportedTransports.options;
      switch (connectionInfo.transport) {
         case "wss":
            try {
               this.rendezvous = new WSSClient(connectionInfo.url);
               var result = await this.rendezvous.connect(connectionInfo.url, false, connectData);
               this.updatePeerConnections(["wss"],[this.rendezvous]);
            } catch (err) {
               this._rendezvous.destroy();
               this._rendezvous = null;
               throw(err);
            }
            return (result);
            break;
         case "wsst":
            try {
               this.rendezvous = new WSSTunnel(connectionInfo.url);
               connectData.tunnelParams = JSON.parse(connectionInfo.parameters);
               result = await this.rendezvous.connect(connectionInfo.url, false, connectData);
               this.updatePeerConnections(["wss"],[this.rendezvous]);
            } catch (err) {
               this._rendezvous.destroy();
               this._rendezvous = null;
            }
            return (result);
            break;
         default:
            throw (new Error("Unrecognized transport type \""+connectInfo.transport+"\""));
            break;
      }
   }

   /**
   * Updates the [peerConnections]{@link P2PRouter#peerConnections} object with the connectivity options
   * stored in [peerOptions]{@link P2PRouter#connection.peerOptions}.
   *
   * @param {Array} [openTypes=null] Indexed array of any connectivity types
   * to set as "open" (connected). The status of any types not appearing in this array
   * will be set as "closed" (disconnected).
   * @param {Array} [transports=null] Indexed array of any open transport references
   * matching the <code>openTypes</code> array.
   * @private
   */
   updatePeerConnections(openTypes=null, transports=null) {
      for (var privateID in this.rendezvous.peerOptions) {
         var options = this.rendezvous.peerOptions[privateID];
         this.insertPeerConnectionObject(privateID, options);
         //overwrite any defines open types
         if (openTypes != null) {
            if (openTypes.length != transports.length) {
               throw(new Error("Number of open connection types must match number of connections."));
            }
            for (var count=0; count < openTypes.length; count++) {
               this.peerConnections[privateID].status[openTypes[count]] = "open";
               this.peerConnections[privateID].transport[openTypes[count]] = transports[count];
            }
         }
         this.peerConnections[privateID].options = options;
      }
   }

   /**
   * Inserts a {@link PeerConnectionObject} for a peer into the [peerConnections]{@link P2PRouter#peerConnections} array
   * if one does not already exist.
   *
   * @param {String} privateID The private ID of the peer for which to inert a {@link PeerConnectionObject}.
   * @param {Object} options Name-value pairs defining the transports that the peer has advertised
   * as being available for them to use.
   * @param {String} defaultStatus The default <code>status</code> to set within the {@link PeerConnectionObject}
   * for each <code>option</code>.
   */
   insertPeerConnectionObject(privateID, options, defaultStatus="closed") {
      if ((this.peerConnections[privateID] == undefined) || (this.peerConnections[privateID] == null)) {
         this.peerConnections[privateID] = new Object();
         this.peerConnections[privateID].status = new Object();
         this.peerConnections[privateID].options = options;
         this.peerConnections[privateID].transport = new Object();
         this.peerConnections[privateID].connectTimeout = new Object();
         this.peerConnections[privateID].connectPromise = new Object();
         for (var option in options) {
            this.peerConnections[privateID].status[option] = defaultStatus;
            if (this.peerConnections[privateID].transport[option] == undefined) {
               this.peerConnections[privateID].transport[option] = null;
            }
            if (this.peerConnections[privateID].connectTimeout[option] == undefined) {
               this.peerConnections[privateID].connectTimeout[option] = new Object();
               if (this.peerConnections[privateID].connectTimeout[option] == undefined) {
                  this.peerConnections[privateID].connectTimeout[option] = null;
               }
               if (this.peerConnections[privateID].connectTimeout[option] == undefined) {
                  this.peerConnections[privateID].connectTimeout[option] = null;
               }
            }
            if (this.peerConnections[privateID].connectPromise[option] == undefined) {
               this.peerConnections[privateID].connectPromise[option] = new Object();
               if (this.peerConnections[privateID].connectPromise[option].resolve == undefined) {
                  this.peerConnections[privateID].connectPromise[option].resolve = null;
               }
               if (this.peerConnections[privateID].connectPromise[option].reject == undefined) {
                  this.peerConnections[privateID].connectPromise[option].reject = null;
               }
            }
         }
      }
   }

   /**
   * Changes the private ID associated with this instance. Any connected peers
   * are notified of this change.
   *
   * @param {String} newPrivateID The new private ID to set for this instance.
   * @param {Boolean} [allSuccess=false] If true, all attached peers must
   * be successfully notified of the change in order for the returned promise
   * to resolve with <code>true</code>. If false, only the <code>rendezvous</code>
   * server must be successfully updated.
   *
   * @return {Promise} The promise resolves with <code>true</code> if the private
   * ID was successfully changed, otherwise it rejects with
   * <code>false</code>. If <code>allSuccess</code> is true, all connected peers
   * must be successfully notified of the change for the promise to resolve
   * with <code>true</code>, otherwise only the [rendezvous]{@link P2PRouter#rendezvous}
   * server needs to be successfully updated.
   *
   * @async
   */
   async changePrivateID(newPrivateID, allSuccess=false) {
      var sentTransports = new Array();
      var updated = await this.rendezvous.changePrivateID(newPrivateID);
      if (updated == true) {
         this._privateID = newPrivateID;
      }
      sentTransports.push(this.rendezvous);
      for (var PID in this.peerConnections) {
         var connectionObj = this.peerConnections[PID];
         for (var transportType in connectionObj.status) {
            var status = connectionObj.status[transportType];
            var transport = connectionObj.transport[transportType];
            if (status == "open") {
               var sent = false;
               for (var count=0; count < sentTransports.length; count++) {
                  if (sentTransports[count] === transport) {
                     sent = true;
                     break;
                  }
               }
               if (sent == false) {
                  var changed = await transport.changePrivateID(newPrivateID);
                  sentTransports.push(transport);
                  if (changed == false) {
                     if (allSuccess == true) {
                        updated = false;
                     }
                     if (P2PRouter.supportedTransports[transportType].sendModel == "single") {
                        console.warn ("Could not send private ID change notification to: "+transport.peerID);
                     } else if (P2PRouter.supportedTransports[transportType].sendModel == "multi") {
                        console.warn ("Could not broadcast private ID change notification via: "+transport.toString());
                     } else {
                        console.warn ("Could not broadcast private ID change notification via unsupported transport.");
                     }
                  }
               }
            }
         }
      }
      return (updated);
   }

   /**
   * Requests a direct connection to a peer with a specific transport.
   *
   * @param {String} privateID The private ID of the peer to request the connection to.
   * @param {String} transportType The transport type to request the direct connection on. This
   * should be one of the supported transports listed in {@link P2PRouter.supportedTransports}.
   * @param {Number} requestTimeout=20 The number of seconds to wait before considering the request
   * timed out and invalid. The connection status will be set to "failed" after this timer
   * elapses without a successfull connection.
   */
   connectPeer(privateID, transportType, requestTimeout=20) {
      var promise = new Promise((resolve, reject) => {
         if (P2PRouter.supportedTransports.options[transportType] == false) {
            reject(new Error("Requested peer transport not locally supported."));
            return (false);
         }
         this.insertPeerConnectionObject(privateID, P2PRouter.supportedTransports.options); //if not exist
         if (this.peerConnections[privateID].status[transportType] == "open") {
            //already connected
            resolve(true);
            return(true);
         }
         switch (transportType) {
            case "webrtc":
               if (this.peerConnections[privateID].options[transportType] == false) {
                  reject (new Error("Peer does not support \""+transportType+"\" transport type."));
                  return (false);
               }
               var wrtcInst = new WebRTCClient(this);
               wrtcInst.addEventListener("peerconnect", this.onPeerConnect, this);
               wrtcInst.addEventListener("message", this.onMessage, this);
               wrtcInst.addEventListener("update", this.onUpdate, this);
               wrtcInst.addEventListener("peerpid", this.onPeerPIDUpdate, this);
               wrtcInst.addEventListener("peerdisconnect", this.onPeerDisconnect, this);
               this.peerConnections[privateID].transport[transportType] = wrtcInst;
               this.peerConnections[privateID].connectPromise[transportType].resolve = resolve;
               this.peerConnections[privateID].connectPromise[transportType].reject = reject;
               this.setPeerConnectTimeout(privateID, transportType, reject, requestTimeout);
               this.setConnectionStatus(privateID, "pending", transportType, wrtcInst);
               wrtcInst.connect(privateID);
               break;
            case "wss":
               //assume connection already exists so do nothing
               break;
            default:
               break;
         }
      });
      return (promise);
   }

   /**
   * Sets / starts a peer connection timeout.
   *
   * @param {String} privateID The private ID of the peer to whom the connection attempt is being made.
   * @param {String} transportType The transport connection type associated with the attempt. This should match
   * one of the {@link P2PRouter.supportedTransports}<code>.options</code>.
   * @param {Function} reject A <code>Promise</code> reject function or callback to invoke if the timeout completes.
   * @param {Number} [timeout=20] The number of seconds to delay before the timeout completes and <code>reject</code>
   * is called.
   *
   * @private
   */
   setPeerConnectTimeout(privateID, transportType, reject, timeout=20) {
      var timeoutID = setTimeout(this.onPeerConnectTimeout, (timeout*1000), privateID, transportType, reject, this);
      this.peerConnections[privateID].connectTimeout[transportType] = timeoutID;
   }

   /**
   * Sets the connection status and transport for a peer within the [peerConnections]{@link P2PRouter#peerConnections}
   * object, stopping any timeout time associated with a pending connection and optionally removing
   * the {@link PeerConnectionObject} entirely if no connection on any transport is open.
   *
   * @param {String} privateID The private ID of the peer for which to set the connection status and transport
   * reference.
   * @param {String} status The status to set for the <code>transportType</code>. Valid types include:
   * <ul>
   * <li><b>"closed"</b>: The transport is closed and and unavailable.</li>
   * <li><b>"pending"</b>: The transport is connection is pending / being established.</li>
   * <li><b>"open"</b>: The transport is open and available for bi-directional communication.</li>
   * <li><b>"failed"</b>: An attempt to open the transport for communication has failed.</li>
   * </ul>
   * @param {String} transportType The transport type to set the <code>status</code> for. Valid types
   * include:
   * <ul>
   * <li><b>"wss"</b></li>
   * <li><b>"webrtc"</b></li>
   * <li><b>"ortc"</b></li>
   * <li><b>"failed"</b></li>
   * </ul>
   * @param {Object} [transport=null] A reference to the transport associated with the <code>transportType</code>.
   * This reference is assigned to the <code>transport[transportType]</code> property of the {@link PeerConnectionObject}.
   * @param {Boolean} [removeOnDisconnect=true] If true, the {@link PeerConnectionObject} is automatically removed
   * from the [peerConnections]{@link P2PRouter#peerConnections} object and any event listeners removed if no transport
   * is "open" or "pending".
   */
   setConnectionStatus(privateID, status, transportType, transport=null, removeOnDisconnect=true) {
      var currentTransport = this.peerConnections[privateID].transport[transportType]; //save for possible event listener removal
      this.peerConnections[privateID].status[transportType] = status;
      this.peerConnections[privateID].transport[transportType] = transport;
      if ((status == "open") || (status == "failed")) {
         //stop timeout timer
         try {
            var timerID = this.peerConnections[privateID].connectTimeout[transportType];
            clearTimeout(timerID);
            this.peerConnections[privateID].connectTimeout[transportType] = null;
            delete this.peerConnections[privateID].connectTimeout[transportType];
         } catch (err) {
         }
         try {
            if (status == "open") {
               var resolveFunc = this.peerConnections[privateID].connectPromise[transportType].resolve;
               if (typeof(resolveFunc) == "function") {
                  var resolveObj = new Object();
                  resolveObj.transportType = transportType;
                  resolveObj.peerConnectionObject = this.peerConnections[privateID];
                  resolveFunc(resolveObj);
               }
               this.peerConnections[privateID].connectPromise[transportType].resolve = null;
               this.peerConnections[privateID].connectPromise[transportType].reject = null;
            } else if (status == "failed") {
               var rejectFunc = this.peerConnections[privateID].connectPromise[transportType].resolve;
               if (typeof(rejectFunc) == "function") {
                  var rejectObj = new Error("Connection failed.");
                  rejectObj.transportType = transportType;
                  rejectObj.peerConnectionObject = this.peerConnections[privateID];
                  rejectFunc(rejectObj);
               }
               this.peerConnections[privateID].connectPromise[transportType].resolve = null;
               this.peerConnections[privateID].connectPromise[transportType].reject = null;
            }
         } catch (err) {
            console.error (err);
         }
      }
      if (removeOnDisconnect == true) {
         var connected = false; //is peer connected on any transport?
         for (var transportTypeStr in this.peerConnections[privateID].status) {
            var transportStatus = this.peerConnections[privateID].status[transportTypeStr];
            if ((transportStatus != "closed") && (transportStatus != "failed")) {
               connected = true;
            }
         }
         //don't remove listeners if connected ot transport is a shared connection
         if (connected == false) {
            if (currentTransport != this.rendezvous) {
               //remove event listeners
               currentTransport.removeEventListener("message", this.onMessage, this);
               currentTransport.removeEventListener("update", this.onUpdate, this);
               currentTransport.removeEventListener("peerconnect", this.onPeerConnect, this);
               currentTransport.removeEventListener("peerpid", this.onPeerPIDUpdate, this);
               currentTransport.removeEventListener("peerdisconnect", this.onPeerDisconnect, this);
            }
            //remove entry
            this.peerConnections[privateID] = null;
            delete this.peerConnections[privateID];
         }
      }
   }

   /**
   * Creates an internal P2PRouter message. Since the format of this message
   * may change, this is the preferred way to create a message rather than
   * creating your own object.
   *
   * @param {String} messageType The P2PRouter message type to create.
   *
   * @return {Object} A formatted P2PRouter table message. Additional data
   * can be appended to this object before sending it to other peers.
   * @private
   */
   buildRouterMessage(messageType) {
      var messageObj=new Object();
      messageObj.routerMsg = messageType;
      return (messageObj);
   }

   /**
   * Sends a routed broadcast message to all connected peers using the
   * first preferred and available peer-to-peer communication transport foe each
   * peer as efficiently as possible.
   *
   * @param {*} data The data / message to send.
   * @param {Array} [prefTransports=P2PRouter.supportedTransports.preferred] Indexed
   * array of preferred transports to use to send the data / message. Each recipient
   * is evaluated and the first available (lowest index), transport matching this
   * list is used. Shared transports such as WebSocket Sessions are used as
   * efficiently as possible (e.g. sending to multiple recipients with one request).

   *
   * @return {Promise} An asynchronous Promise that will contain the results of
   * all send operations or will throw an error on failure.
   */
   async broadcast(data, prefTransports=P2PRouter.supportedTransports.preferred) {
      var transportGroups = this.createTransportGroups(this.peers, prefTransports);
      var results = new Array();
      for (var transportType in transportGroups) {
         try {
            var transportObj = transportGroups[transportType];
            var recipientsArr = transportObj.recipients;
            var transportsArr = transportObj.transports;
            var excludeArr = transportObj.exclude;
            var sendModel = P2PRouter.supportedTransports.sendModel[transportType];
            if (sendModel == "single") {
               for (var count = 0; count < recipientsArr.length; count++) {
                  var recipient = recipientsArr[count];
                  var transport = transportsArr[count];
                  var exclude = excludeArr.some(element => {
                     return (element == recipient);
                  });
                  if (exclude == false) {
                     var result = await transport.broadcast(data);
                  }
                  results.push(result);
               }
            } else if (sendModel == "multi") {
               //further break down shared transports
               var sharedGroups = this.createSharedTransportGroups(recipientsArr, transportsArr, excludeArr);
               for (count = 0; count < sharedGroups.length; count++) {
                  var sharedRecipients = sharedGroups[count].recipients;
                  var sharedTransport = sharedGroups[count].transport;
                  var sharedExclude = excludeArr.concat(sharedGroups[count].exclude);
                  result = await sharedTransport.broadcast(data, sharedExclude);
                  results.push(result);
               }
            } else if (sendModel == "none") {
               //try fallback connection as a last resort
               result = await this.rendezvous.broadcast(data, excludeArr);
               results.push(result);
            }
         } catch (err) {
            console.error (err);
         }
      }
      return (results);
   }

   /**
   * Sends a routed direct message to one or more connected peers using the
   * first preferred and available peer-to-peer communication transport for
   * each peer as efficiently as possible.
   *
   * @param {*} data The data / message to send.
   * @param {(Object|Array)} recipients An object or an array of recipient private
   * IDs. If this parameter is an object, one or more additional properties are
   * expected:
   * @param {Array} [recipients.rcp] An indexed array of recipient private IDs.
   * If this list is provided as the <code>recipients</code> parameter this
   * structure is dynamicaly generated before sending.
   * @param {Array} [prefTransports=P2PRouter.supportedTransports.preferred] Indexed
   * array of preferred transports to use to send the data / message. Each recipient
   * is evaluated and the first available (lowest index), transport matching this
   * list is used. Shared transports such as WebSocket Sessions are used as
   * efficiently as possible (e.g. sending to multiple recipients with one request).
   *
   * @return {Promise} An asynchronous Promise that will contain the results of
   * all send operations or will throw an error on failure.
   */
   async send(data, recipients, prefTransports=P2PRouter.supportedTransports.preferred) {
      if (typeof(recipients) != "object") {
         throw (new Error(`"recipients" parameter must be an array!`));
      }
      if (typeof(recipients["length"]) == "number") {
         var transportGroups = this.createTransportGroups(recipients, prefTransports);
      } else {
         transportGroups = this.createTransportGroups(recipients.rcp, prefTransports);
      }
      var results = new Array();
      for (var transportType in transportGroups) {
         try {
            var transportObj = transportGroups[transportType];
            var recipientsArr = transportObj.recipients;
            var transportsArr = transportObj.transports;
            var sendModel = P2PRouter.supportedTransports.sendModel[transportType];
            if (sendModel == "single") {
               for (var count = 0; count < recipientsArr.length; count++) {
                  var recipient = recipientsArr[count];
                  var transport = transportsArr[count];
                  var result = await transport.send(data, [recipient]);
                  results.push(result);
               }
            } else if (sendModel == "multi") {
               //further break down shared transports
               var sharedGroups = this.createSharedTransportGroups(recipientsArr, transportsArr);
               for (count = 0; count < sharedGroups.length; count++) {
                  var sharedRecipients = sharedGroups[count].recipients;
                  var sharedTransport = sharedGroups[count].transport;
                  result = await sharedTransport.send(data, sharedRecipients);
                  results.push(result);
               }
            } else if (sendModel == "none") {
               //try fallback connection as a last resort
               result = await this.rendezvous.send(data, recipients);
               results.push(result);
            }
         } catch (err) {
            console.error (err);
         }
      }
   }

   /**
   * Groups private IDs by their preferred or first available transports.
   *
   * @param {Array} recipients Indexed array of recipient private IDs to group
   * by preferred / available transport.
   * @param {Array} [preferred=P2PRouter.supportedTransports.preferred] Indexed array
   * of preferred transport ordering to use for creating groups.
   * @param {Boolean} [onlyAvail=true] If true, only private IDs with available
   * transports are returned. If false, a special <code>none</code> transport type
   * array is included with all private IDs that have no available transport.
   *
   * @return {Object} Contains child objects accessible via their transport types (names),
   * with each object containing an indexed <code>recipients</code> array and accompanying
   * <code>transports</code> array. A special object named <code>none</code> contains any
   * <code>recipients</code> without available <code>transports</code> (all null),
   * if <code>onlyAvail=false</code>.
   */
   createTransportGroups(recipients, preferred=P2PRouter.supportedTransports.preferred, onlyAvail=true) {
      var groups = new Object();
      if (onlyAvail == false) {
         groups.none = new Array();
         groups.none.recipients = new Array();
         groups.none.transports = new Array();
      }
      for (var count=0; count < recipients.length; count++) {
         var privateID = recipients[count];
         var transportObj = this.getPreferredTransport(privateID, preferred);
         if (transportObj != null) {
            var transport = transportObj.transport;
            var type = transportObj.transportType;
            if (groups[type] == undefined) {
               groups[type] = new Object();
               groups[type].recipients = new Array();
               groups[type].transports = new Array();
            }
            groups[type].recipients.push(privateID);
            groups[type].transports.push(transport);
            this.addGroupsExclusion(privateID, type, groups);
         } else {
            if (onlyAvail == false) {
               groups.none.recipients.push(privateID);
               groups.none.transports.push(null);
               this.addGroupsExclusion(privateID, "none", groups);
            }
         }
      }
      return (groups);
   }

   /**
   * Creates exclusion groups for various transport types for a
   * specific private ID.
   *
   * @param {String} privateID The private ID to exclude from all
   * transport <code>groups</code>, except those specified by the
   * <code>includedTransportType</code>.
   * @param {String} includedTransportType The transport group type
   * within the <code>groups</code> array to <b>not</b> exclude
   * <code>privateID</code> from.
   * @param {Object} groups Named transport groups containing the
   * indexed arrays <code>recipients</code> and <code>transports</code>.
   * Each group will have a new <code>exclude</code> array created, if
   * one doesn't exist, and the <code>privateID</code> appended to it
   * unless the group is in an <code>includedTransportType</code>.
   *
   * @private
   */
   addGroupsExclusion(privateID, includedTransportType, groups) {
      for (var type in groups) {
         if (groups[type].exclude == undefined) {
            groups[type].exclude = new Array();
         }
         if (type != includedTransportType) {
            groups[type].exclude.push(privateID);
         }
      }
   }

   /**
   * Creates arrays of privateIDs based on their shared transports.
   *
   * @param {Array} recipients An indexed array of recipient private IDs. The length
   * of this array <b<must</b> match the length of the <code>transports</code> one.
   * @param {Array} transports References to the transports used by the private IDs
   * of the <code>recipients</code> array.
   *
   * @return {Array} The returned indexed array contains objects, each
   * containing a unique <code>transport</code> reference shared by the private IDs
   * in a <code>recipients</code> array. A null object is returned if the
   * <code>recipients</code> and <code>transports</code> parameter lengths don't match.
   */
   createSharedTransportGroups(recipients, transports, exclusions) {
      if (recipients.length != transports.length) {
         return (null);
      }
      var sharedGroups = new Array();
      var groupExists;
      for (var count=0; count < recipients.length; count++) {
         var privateID = recipients[count];
         var transport = transports[count];
         groupExists = false;
         for (var groupNum=0; groupNum < sharedGroups.length; groupNum++) {
            var groupObj = sharedGroups[groupNum];
            if (groupObj.transport === transport) {
               groupObj.recipients.push(privateID);
               groupExists = true;
            }
         }
         if (groupExists == false) {
            groupObj = new Object();
            groupObj.transport = transport;
            groupObj.recipients = new Array();
            groupObj.recipients.push(privateID);
            sharedGroups.push(groupObj);
         }
      }
      for (count=0; count < recipients.length; count++) {
         privateID = recipients[count];
         for (groupNum=0; groupNum < sharedGroups.length; groupNum++) {
            groupObj = sharedGroups[groupNum];
            this.addSharedGroupsExclusion(privateID, groupObj, sharedGroups);
         }
      }
      return (sharedGroups);
   }

   /**
   * Add exclusions in shared transport groups for a private ID.
   *
   * @param {String} privateID The private ID to add exclusions for.
   * @param {Object} includeGroup The group in which <code>privateID</code>
   * is included. The <code>privateID</code> will be excluded out of all
   * the other <code>sharedGroups</code>.
   * @param {Array} sharedGroups An indexed array of shared transport groups
   * to exclude the <code>privateID</code> from, except the <code>includeGroup</code>.
   * Each object in this array will have an <code>exclude</code> array added, if
   * it doesn't already exist, and the <code>privateID</code> appended if unless
   * included.
   *
   * @private
   */
   addSharedGroupsExclusion(privateID, includeGroup, sharedGroups) {
      for (var count = 0; count < sharedGroups.length; count++) {
         if (sharedGroups[count].exclude == undefined) {
            sharedGroups[count].exclude = new Array();
         }
         if (sharedGroups[count] !== includeGroup) {
            sharedGroups[count].exclude.push(privateID);
         }
      }
   }

   /**
   * Returns the preferred or next available transport for a peer.
   *
   * @param {String} privateID The private ID of the peer for which to
   * retrieve the transport.
   * @param {Array} [preferred=["webrtc","wss","ortc"]] The preferred transport
   * order with the first transport being the most preferred. Any transports
   * not included in this list will not be considered.
   *
   * @return {Object} An object containing a reference to the first preferred
   * <code>transport</code> with an "open" status and its <code>type</code>. If no
   * transport is open then <code>null</code> is returned.
   */
   getPreferredTransport(privateID, preferred=P2PRouter.supportedTransports.preferred) {
      var status = this.peerConnections[privateID].status;
      for (var count=0; count < preferred.length; count++) {
         var transportType = preferred[count];
         if (status[transportType] == "open") {
            var returnObj = new Object();
            returnObj.transport = this.peerConnections[privateID].transport[transportType];
            returnObj.transportType = transportType;
            return (returnObj);
         }
      }
      return (null);
   }

   /**
   * Verifies if a supplied message event object contains a valid P2PRouter message.
   *
   * @param {Event} event The "message" event, as usually dispatched by the
   * peer-to-peer interface, to examine.
   *
   * @return {Boolean} True if the event contains a valid P2PRouter message
   * (though its type may not be supported).
   * @private
   */
   isRouterMsgEvent(event) {
      try {
         if (typeof(event["data"]) != "object") {
            //not sure what this is
            return (false);
         }
         if (typeof(event.data["result"]) != "object") {
            //may not be a JSON-RPC message
            return (false);
         }
         if (typeof(event.data.result["data"]) != "object") {
            //not a router-formatted message
            return (false);
         }
         return (this.isRouterMessage(event.data.result.data));
      } catch (err) {
         return (false);
      }
   }

   /**
   * Verifies if a supplied object is a valid P2PRouter message.
   *
   * @param {Object} message The object to examine.
   *
   * @return {Boolean} True if the object seems to be a valid P2PRouter message
   * (though it may not be supported).
   * @private
   */
   isRouterMessage(message) {
      if ((message["routerMsg"] == undefined) || (message["routerMsg"] == null) || (message["routerMsg"] == "")) {
         //not a P2PRouter message or it's blank (mo message type)
         return (false);
      }
      return (true);
   }

   /**
   * Handles any "message" events received on routed transports. Any P2PRouter messages are intercepted,
   * otherwise "message" events are propagated to onward listeners.
   *
   * @param {Event} event A message event received from a supported transport.
   *
   * @fires P2PRouter#message
   * @private
   */
   async onMessage(event) {
      if (this.isRouterMsgEvent(event)) {
         //TODO: add check for "from" property and add (if being sent via WebRTC, for example)
         var fromPID = event.data.result.from;
         var msgData = event.data.result.data;
         var messageType = msgData.routerMsg;
         var transportType = msgData.transportType;
         switch (messageType) {
            case "peerconnectreq":
               this.onConnectPeerRequest(fromPID, msgData).catch(err => {
                  console.warn(err);
               })
               break;
            default:
               //not a recognized P2PRouter message
               break;
         }
      } else {
         var source = event.target.toString();
         var newEvent = new Event("message");
         if ((source == "WSSClient") || (source == "WSSTunnel")) {
            newEvent.data = event.data;
            newEvent.data.result.transport = "wss";
            newEvent.transport = event.target;
         } else if (source == "WebRTCClient") {
            var jsonObj = buildJSONRPC("notification");
            jsonObj.data = event.data;
            jsonObj.data.result.from = this.getPIDByTransport(event.target);
            jsonObj.data.result.transport = "webrtc";
            newEvent.data = jsonObj.data;
            newEvent.transport = event.target;
         }
         this.dispatchEvent(newEvent);
      }
   }

   /**
   * Handles any "update" message events received on routed transports.
   *
   * @param {Event} event An update message event received from a supported transport.
   *
   * @fires P2PRouter#update
   * @private
   */
   async onUpdate(event) {
      if (this.isRouterMsgEvent(event)) {
         var fromPID = event.data.result.from;
         var msgData = event.data.result.data;
         var messageType = msgData.routerMsg;
         switch (messageType) {
            default:
               //not a recognized P2PRouter update
               break;
         }
      } else {
         var source = event.target.toString();
         var newEvent = new Event("update");
         newEvent.data = event.data;
         newEvent.transport = event.target;
         if ((source == "WSSClient") || (source == "WSSTunnel")) {
            newEvent.transportType = "wss";
         } else if (source == "WebRTCClient") {
            newEvent.transportType = "webrtc";
         }
         this.dispatchEvent(newEvent);
      }
   }

   /**
   * Handles any "peerpid" message events received on routed transports. The
   * [peerConnections]{@link P2PRouter#peerConnections} is automatically
   * updated to reflect the changed private ID.
   *
   * @param {Event} event An update message event received from a supported transport.
   *
   * @fires P2PRouter#peerpid
   * @private
   */
   async onPeerPIDUpdate(event) {
      var oldPID = event.data.result.change.oldPrivateID;
      var newPID = event.data.result.change.newPrivateID;
      if (oldPID == newPID) {
         return;
      }
      if ((this.peerConnections[oldPID] == undefined) || (this.peerConnections[oldPID] == null)) {
         //may ne a duplicated notification
         return;
      }
      //update peerConnections object
      this.peerConnections[newPID] = this.peerConnections[oldPID];
      delete this.peerConnections[oldPID];
      var newEvent = new Event("peerpid");
      newEvent.oldPrivateID = oldPID;
      newEvent.newPrivateID = newPID;
      this.dispatchEvent(newEvent);
   }

   /**
   * Invoked when peer requests a direct peer-to-peer connection.
   *
   * @param {String} privateID The private ID of the peer requesting the connection.
   * @param {Object} requestObj An object containing the details of the connection request.
   * @param {String} requestObj.transportType The transport type on which the direct connection is
   * being requested. The request will be rejected or ignored if the transport doesn't match
   * an available one specified in {@link P2PRouter.supportedTransports}.
   * @param {Number} [requestTimeout=20] The number of seconds to wait for this connection to
   * be established before considering it failed (timed out).
   *
   * @private
   */
   onConnectPeerRequest(privateID, requestObj, requestTimeout=20) {
      var promise = new Promise((resolve, reject) => {
         var transportType = requestObj.transportType;
         switch (transportType) {
            case "webrtc":
               if (this.peerConnections[privateID].options[transportType] == false) {
                  reject (new Error("Peer does not support \""+transportType+"\" transport type."));
                  return (false);
               }
               var wrtcInst = new WebRTCClient(this);
               wrtcInst.addEventListener("peerconnect", this.onPeerConnect, this);
               wrtcInst.addEventListener("message", this.onMessage, this);
               wrtcInst.addEventListener("update", this.onUpdate, this);
               wrtcInst.addEventListener("peerpid", this.onPeerPIDUpdate, this);
               wrtcInst.addEventListener("peerdisconnect", this.onPeerDisconnect, this);
               this.insertPeerConnectionObject(privateID, P2PRouter.supportedTransports.options); //if not exist
               this.peerConnections[privateID].transport[transportType] = wrtcInst;
               this.peerConnections[privateID].connectPromise[transportType].resolve = resolve;
               this.peerConnections[privateID].connectPromise[transportType].reject = reject;
               this.setPeerConnectTimeout(privateID, transportType, reject, requestTimeout);
               this.setConnectionStatus(privateID, "pending", transportType, wrtcInst);
               wrtcInst.setRemoteOffer(privateID, requestObj.offer);
               break;
            case "wss":
               //assume connection already exists so do nothing
               break;
            default:
               this.setConnectionStatus(privateID, "failed", transportType);
               reject (new Error("Unrecognized connection type \""+transportType+"\""));
               break;
         }
      });
      return (promise);
   }

   /**
   * Handles any new peer connection events on routed transports.
   *
   * @param {Event} event A peer connect event received from a supported transport.
   *
   * @fires P2PRouter#peerconnect
   * @private
   */
   async onPeerConnect(event) {
      var source = event.target.toString();
      var newEvent = new Event("peerconnect");
      newEvent.transport = event.target;
      if ((source == "WSSClient") || (source == "WSSTunnel")) {
         console.dir (event.data);
         var privateID = event.data.result.connect;
         console.log ("A new peer has connected on ("+source+"): "+privateID);
         if ((event.data.result.options == undefined) || (event.data.result.options == null)) {
            //added for pre-v0.4.1 compatibility
            event.data.result.options = {"wss":true,"webrtc":false,"ortc":false};
         }
         this.insertPeerConnectionObject(privateID, event.data.result.options);
         this.setConnectionStatus(privateID, "open", "wss", event.target);
         newEvent.data = event.data;
         newEvent.transportType = "wss";
      } else if (source == "WebRTCClient") {
         var privateID = this.getPIDByTransport(event.target);
         this.setConnectionStatus(privateID, "open", "webrtc", event.target);
         newEvent.data = buildJSONRPC("notification");
         newEvent.data.result.connect = privateID;
         newEvent.data.result.options = this.peerConnections[privateID].options;
         newEvent.data.result.type = "session";
         newEvent.transportType = "webrtc";

      }
      this.dispatchEvent(newEvent);
   }

   /**
   * Handles any peer disconnection events on routed transports.
   *
   * @param {Event} event A peer disconnect event received from a supported transport.
   *
   * @fires P2PRouter#peerdisconnect
   * @private
   */
   async onPeerDisconnect(event) {
      var source = event.target.toString();
      var newEvent = new Event("peerdisconnect");
      newEvent.transport = event.target;
      if ((source == "WSSClient") || (source == "WSSTunnel")) {
         var privateID = event.data.result.disconnect;
         this.setConnectionStatus(privateID, "closed", "wss");
         newEvent.data = event.data;
         newEvent.transportType = "wss";
         newEvent._event = event._event;
         this.dispatchEvent(newEvent);
      } else if (source == "WebRTCClient") {
         var privateID = this.getPIDByTransport(event.target);
         this.setConnectionStatus(privateID, "closed", "webrtc");
         newEvent.data = buildJSONRPC("notification");
         newEvent.data.result.disconnect = privateID;
         newEvent.data.result.type = "session";
         newEvent.transportType = "webrtc";
      }
      this.dispatchEvent(newEvent);
   }

   /**
   * Handles a peer connection timeout started by [setPeerConnectTimeout]{@link P2PRouter#setPeerConnectTimeout}.
   *
   * @param {String} privateID The private ID of the peer to whom the connection attempt failed.
   * @param {String} transportType The transport connection type associated with the attempt. This should match
   * one of the {@link P2PRouter.supportedTransports}<code>.options</code>.
   * @param {Function} reject A <code>Promise</code> reject function or callback to invoke.
   * @param {P2PRouter} conext The execution context to use in place of the <code>this</code> reference.
   *
   * @private
   */
   onPeerConnectTimeout(privateID, transportType, reject, context) {
      console.error ("Attempt to establish peer connection using \""+transportType+"\" transport to \""+privateID+"\" has timed out.");
      console.error ("Using fallback transport \""+context.getPreferredTransport(privateID).transportType+"\".");
      context.peerConnections[privateID].connectTimeout[transportType] = null;
      context.setConnectionStatus(privateID, "failed", transportType);
   }

   /**
   * Prepares the instance for destruction by closing any open transports, = null;
   * removing references and event listeners, and otherwise cleaning up.
   *
   * @async
   */
   async destroy() {
         console.log ("P2PRouter.destroy()");
      if (this.rendezvous != null) {
         this.rendezvous.removeEventListener("message", this.onMessage);
         this.rendezvous.removeEventListener("update", this.onUpdate);
         this.rendezvous.removeEventListener("peerconnect", this.onPeerConnect);
         this.rendezvous.removeEventListener("peerpid", this.onPeerPIDUpdate);
         this.rendezvous.removeEventListener("peerdisconnect", this.onPeerDisconnect);
         try {
            var result = await this.rendezvous.disconnect();
         } catch (err) {
         }
         this._rendezvous = null;
      }
      for (var privateID in this.peerConnections) {
         try {
            this.peerConnections[privateID].transport.removeEventListener("peerconnect", this.onPeerConnect);
            this.peerConnections[privateID].transport.removeEventListener("message", this.onMessage);
            this.peerConnections[privateID].transport.removeEventListener("update", this.onUpdate);
            this.peerConnections[privateID].transport.removeEventListener("peerpid", this.onPeerPIDUpdate);
            this.peerConnections[privateID].transport.removeEventListener("peerdisconnect", this.onPeerDisconnect);
            if (this.peerConnections[privateID].connectTimeout[transportType] != null) {
               this.clearTimeout(this.peerConnections[privateID].connectTimeout[transportType]);
               this.peerConnections[privateID].connectTimeout[transportType] = null;
            }
            var result = await this.peerConnections[privateID].transport.disconnect();
         } catch (err) {
         } finally {
            this.peerConnections[privateID].transport = null;
            this.peerConnections[privateID].status = "closed";
         }
      }
   }

   toString() {
      return ("P2PRouter");
   }

}
