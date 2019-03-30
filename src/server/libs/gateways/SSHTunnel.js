/**
* @file A SSH tunneling gateway.
*
* @version 0.4.1
* @author Patrick Bay
* @copyright MIT License
*
*/
const Gateway = require("../Gateway.js"); //Gateway interface (required by all extending Gateways)
const {spawn} = require('child_process'); //the SSH process
const SDB = require('sdb-node'); //Services Descriptor Bundle

/**
* @class Provides SSH tunnel gateway functionality.
*
* @extends Gateway
*/
module.exports = class SSHTunnel extends Gateway {

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
      this._tunnels = new Array();
      if (this._sdbEntity == undefined) {
         this._sdbEntity = SSHTunnel.defaultSDBEntity;
      }
      SDB.validateEntityObject(this._sdbEntity);
   }

   /**
   * @property {String} name="SSHTunnel" The human-readable name
   * of the gateway (used when sharing connectivity information, for example).
   *
   * @readonly
   * @static
   */
   static get name() {
      return ("SSHTunnel");
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
   * custom SDB entity object using [addToSDBEntity]{@link SSHTunnel@addToSDBEntity}
   * and ultimately bundled using [toSDB]{@link SSHTunnel@toSDB}.
   *
   * @readonly
   * @static
   * @see https://github.com/monicanagent/sdb/blob/master/TECHNICAL.md
   */
   static get defaultSDBEntity() {
      // Valid properties: entity (required), name, description, transport, protocol, host, port, parameters
      var sdbEntity = new Object();
      sdbEntity.entity = "api";
      sdbEntity.name = "SSH Tunnel";
      sdbEntity.description = "SSH tunneling connection.";
      sdbEntity.transport = "wss";
      sdbEntity.protocol = "ws";
      sdbEntity.host = SSHTunnel.SSHHost;
      return (sdbEntity);
   }

   /**
   * @property {Number} keepAliveInterval=10 The interval, in seconds, to ping
   * the tunnel in order to keep it alive.
   *
   * @readonly
   */
   get keepAliveInterval() {
      if (this._keepAliveInterval == undefined) {
         this._keepAliveInterval = 10;
      }
      return (this._keepAliveInterval);
   }

   set keepAliveInterval(kaSet) {
      this._keepAliveInterval = kaSet;
   }

   /**
   * @property {Number} keepAliveTimeout=3 The number of times that
   * a keep-alive ping can miss a response before the connection
   * is considered lost and the tunnel is closed.
   *
   * @readonly
   */
   get keepAliveTimeout() {
      if (this._keepAliveTimeout == undefined) {
         this._keepAliveTimeout = 3;
      }
      return (this._keepAliveTimeout);
   }

   set keepAliveTimeout(katSet) {
      this._keepAliveTimeout = katSet;
   }

   /**
   * @property {String} SSHHost The URL or IP of the SSH tunneling host / proxy.
   *
   * @readonly
   * @private
   */
   get SSHHost() {
      return ("159.89.214.31"); //serveo
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
         this._sdbEntity = SSHTunnel.defaultSDBEntity;
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
   * Updates information in a  genericSDB entity template used to generate a SDB
   * via [getSDB]{@link SSHTunnel#getSDB}.
   *
   * @param {String} property The SDB entity data property to udpate.
   *
   * @see https://github.com/monicanagent/sdb/blob/master/TECHNICAL.md
   */
   updateSDBEntity(property, value) {
      if (this._sdbEntity == undefined) {
         this._sdbEntity = SSHTunnel.defaultSDBEntity;
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
   * Activates the gateway components specified to be started in [gatewayConfig]{@link localtunnel#gatewayConfig} and
   * updates the  updates the [started]{@link localtunnel#started}.
   *
   * @return {Promise} The returned promise resolves when the gateway is open and ready
   * to receive requests and rejects if an error occurs.
   */
   start() {
      var promise = new Promise((resolve, reject) => {
         var openPorts = this.gatewayConfig.openPorts;
         for (var count = 0; count < openPorts.length; count++) {
            var port = openPorts[count];
            if (typeof(port) == "string") {
               var configPath = port; //a reference to a port in the global config
               port = this.server.getConfigByPath(configPath);
            } else if (typeof(port) == "number") {
               //a port number, use as-is
            } else {
               throw (new Error("Can't tunnel port \""+port+"\" of type "+typeof(port)));
            }
         }
         var spawnParams = ":0:localhost:"+String(port);
         var keepAliveParams = "ServerAliveInterval="+String(this.keepAliveInterval);
         var keepAliveTimeoutParams = "ServerAliveCountMax="+String(this.keepAliveTimeout);
         var acceptKeyParams = "StrictHostKeyChecking=no";
         this._tunnelProc = spawn("ssh", [
            "-o", acceptKeyParams,
            "-o", keepAliveParams,
            "-o", keepAliveTimeoutParams,
            "-R", spawnParams,
            this.SSHHost]);
         this._tunnelProc.stdout._openResolve = resolve;
         this._tunnelProc.stdout._openReject = reject;
         this._tunnelProc.stdout.gateway = this;
         this._tunnelProc.stdout.on ('data', this.onTunnelSTDOUT);
         this._tunnelProc.stderr.on ('data', this.onTunnelSTDERR);
      })
      return (promise);
   }

   /**
   * Processes status messages from the tunnel.
   *
   * @param {String} message The status message to process.
   *
   * @return {Object} An object describing the parsed tunnel status. This object
   * contains a status <code>type</code> such as a tunnel "open" or a peer/client "connect",
   * a <code>port</code> (listening if <code>type</code> is "open" and connection
   * if <code>type</code> is "connect"), and a <code>host</code> or <code>client</code>
   * if <code>type</code> is "open" or "connect" respectively.
   *
   * @private
   */
   processTunnelStatus(message) {
      message = message.toLowerCase();
      var infoObj = new Object();
      if (message.indexOf("forwarding tcp") > -1) {
         infoObj.type = "open";
         var port = parseInt(message.split(":")[1].trim());
         infoObj.host = this.SSHHost;
         infoObj.port = port;
      } else if (message.indexOf("tcp connection from") > -1) {
         var connectionStr = message.split ("tcp connection from")[1];
         var connectionInfo = connectionStr.split(" on port ");
         var connectionIP = connectionInfo[0].trim();
         var connectionPort = parseInt(connectionInfo[1].trim());
         infoObj.type = "connect";
         infoObj.client = connectionIP;
         infoObj.port = connectionPort;
      }
      return (infoObj);
   }

   /**
   * Dispatches an "open" event when the tunnel has opened and is ready to accept
   * incoming connections. The event will include a public <code>host</code> IP
   * and <code>port</code> as well as a <code>sdb</code> that clients/peers
   * can connect to.
   *
   * @param {Object} eventInfo Information to include with the event dispatch.
   * @param {String} host The public host IP of the open connection.
   * @param {Number} port The public host port of the open connection.
   *
   * @private
   * @param
   */
   async dispatchOpenEvent(eventInfo) {
      this.updateSDBEntity("host", eventInfo.host);
      this.updateSDBEntity("port", eventInfo.port);
      var event = new Object();
      event.type = "open";
      event.host = eventInfo.host;
      event.port = eventInfo.port;
      event.sdb = new Object();
      event.sdb.base85 = await this.getSDB("base85");
      event.sdb.base64 = await this.getSDB("base64");
      this.emit("open", event);
   }

   /**
   * Dispatches a "connect" event when a new client / peer connects establishes
   * a new connection through the tunnel.
   *
   * @param {Object} eventInfo Information to include with the event dispatch.
   * @param {String} client The public IP of the connecting client/peer.
   * @param {Number} port The public port on which the client/peer has connected.
   *
   * @private
   * @param
   */
   dispatchConnectEvent(eventInfo) {
      var event = new Object();
      event.type = "connect";
      event.client = eventInfo.client;
      event.port = eventInfo.port;
      this.emit("connect", event);
   }

   /**
   * Handles STDOUT output from the tunnel process.
   *
   * @param {Object} data The data received on STDOUT.
   *
   * @private
   */
   onTunnelSTDOUT(data) {
      var statusObj = this.gateway.processTunnelStatus(data.toString());
      if (statusObj.type == "open") {
         this.gateway._started = true;
         this._openResolve(true);
         this.gateway.dispatchOpenEvent(statusObj);
         delete this._openResolve;
         delete this._openReject;
      }
      if (statusObj.type == "connect") {
         this.gateway.dispatchConnectEvent(statusObj);
      }
   }

   /**
   * Handles STDERR output from the tunnel process.
   *
   * @param {Object} data The data received on STDERR.
   *
   * @private
   */
   onTunnelSTDERR(data) {
      //console.error(data.toString());
   }

   /**
   * Deactivates the gateway components specified to be disabled in [gatewayConfig]{@link localtunnel#gatewayConfig} and
   * updates the  updates the [started]{@link localtunnel#started}.
   *
   * @return {Promise} The returned promise resolves when the gateway is stopped and no longer sending
   * or receiving data.
   */
   stop() {
      var promise = new Promise((resolve, reject) => {
         this._tunnelProc.stdout._openResolve = null;
         this._tunnelProc.stdout._openReject = null;
         this._tunnelProc.stdout.gateway = null;
         this._tunnelProc.stdout.removeListener('data', this.onTunnelSTDOUT);
         this._tunnelProc.stderr.removeListener('data', this.onTunnelSTDERR);
         this._tunnelProc.kill('SIGTERM');
         delete this._tunnelProc;
         this._started = false;
         resolve(true);
      });
      return (promise);
   }

   /**
   * Destroys the instance by closing any open connections and clearing and
   * held references / data.
   *
   * @async
   */
   async destroy() {
   }

}
