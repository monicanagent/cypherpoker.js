/**
* @file A Gateway interface for implementations to extend.
*
* @version 0.4.1
* @author Patrick Bay
* @copyright MIT License
*/

const EventEmitter = require('events');

/**
* An interface and genereic functionality for a gateway implementation. This class
* is not intended to be used directly but rather extended by a specific gateway
* implementation class.
*
* @interface
*/
module.exports = class Gateway extends EventEmitter {

   /**
   * Creates a new instance.
   *
   * @param {Object} serverRef A reference to exposed server objects and properties
   * available to the gateway.
   * @param {Object} gatewayData The configuration data for the gateway to use.
   *
   */
   constructor(serverRef, gatewayData) {
      super();
      this._server = serverRef;
      this._gatewayConfig = gatewayData;
   }

   /**
   * @property {String} name="Default Gateway Interface" The human-readable name
   * of the gateway (used when sharing connectivity information, for example).
   *
   * @static
   * @readonly
   */
   static get name() {
      return ("Default Gateway Interface");
   }

   /**
   * @property {String} version="0.1.0" The gateway implementation version (may
   * be used to provide backwards compatibility, etc.)
   *
   * @static
   * @readonly
   */
   static get version() {
      return ("0.1.0");
   }

   /**
   * @param {Object} serverRef A reference to exposed server objects and properties
   * available to the gateway.
   *
   * @readonly
   */
   get server() {
      if (this._server == undefined) {
         this._server = null;
      }
      return (this._server);
   }

   /**
   * @property {Object} gatewayConfig The configuration data for the instance,
   * as set in the contrsuctor. If no config was defined, <code>null</code> is
   * returned.
   */
   get gatewayConfig() {
      if (this._gatewayConfig == undefined) {
         this._gatewayConfig = null;
      }
      return (this._gatewayConfig);
   }

   set gatewayConfig(configSet) {
      this._gatewayConfig = configSet;
   }

   /**
   * @property {Boolean} started=false True if the implementation is started and
   * ready to send/receive data.
   */
   get started() {
      return (false);
   }

   set started(startedSet) {
   }

   /**
   * Activates the gateway implementation. The extending function should also
   * update the [started]{@link Gateway#started} property.
   *
   * @async
   */
   async start() {
   }

   /**
   * Deactivates the gateway implementation. The extending function should also
   * update the [started]{@link Gateway#started} property.
   *
   * @async
   */
   async stop() {
   }

   /**
   * Services Descriptor Bundle entity information for the extending instance.
   *
   * @property {Array} [entityTypes=["api","p2p"]] The services (entity types),
   * that are available via this gateway. A new SDB entity is created for each
   * entity type specified.
   * @property {String} [format="base85"] The format in which the generated SDB
   * is returned. Valid formats are "base85" (binary), "base64" (binary), "object"
   * (native JavaScript object), and "json" (JSON string).
   *
   * @return {String} The Services Descriptor Bundle containing information on the
   * gateway connectivity options, in the <code>format</code> specified,
   * or <code>null</code> if a valid SDB can't be generated.
   *
   * @async
   * @see https://github.com/monicanagent/sdb/blob/master/TECHNICAL.md
   */
   async getSDB(entityTypes=["api","p2p"], format="base85") {
      //overloading function must implement this
      throw (new Error("\"getSDB\" function not implemented in extending class."));
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
      //overloading function must implement this
      throw (new Error("\"updateSDBEntity\" function not implemented in extending class."));
   }

   /**
   * Destroys the gateway implementation. The implementation should close
   * any open connections and clear and held references.
   *
   * @async
   */
   async destroy() {
   }
}
