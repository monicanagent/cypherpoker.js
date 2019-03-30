/**
* @file Manages connection gateways that can be used by clients, peers, and other servers to connect to this one.
*
* @version 0.4.1
* @author Patrick Bay
* @copyright MIT License
*/

/**
* @class Handles implementations of the {@link Gateway} class for CypherPoker.JS
*/
module.exports = class Gateways {

   /**
   * Creates a new instance.
   *
   * @param {Object} serverRef A reference to the exposed server objects available to gateways.
   * @param {Object} [configData=null] The configuration data (usually part of a global config),
   * specifying the gateways to be managed by this instance. If omitted or <code>null</code>,
   * a valid configuration object must be provided to either the [initialize]{@link Gateways#initialize}
   * or [loadGateways]{@link Gateways#loadGateways} functions.*
   */
   constructor(serverRef, configData=null) {
      this._server = serverRef;
      this._gatewaysConfig = configData;
   }

   /**
   * Initializes the instance by loading gateways, setting any initial references
   * and properties, etc.
   *
   * @param {Object} [configData=null] The configuration data (usually part of a global config),
   * specifying the gateways to be managed by this instance.If omitted or <code>null</code>,
   * a valid configuration object must be provided to the [loadGateways]{@link Gateways#loadGateways}
   * function.
   *
   * @async
   */
   async initialize(configData=null) {
      if (configData == null) {
         configData = this.gatewaysConfig;
      } else {
         this._gatewaysConfig = configData;
      }
      if (configData == null) {
         throw (new Error("Gateways configuration data invalid."));
      }
      var result = await this.loadGateways(this.gatewaysConfig);
   }

   /**
   * @property {Object} server A reference to the exposed server objects available to
   * gateways.
   */
   get server() {
      if (this._server == undefined) {
         this._server = null;
      }
      return (this._server);
   }

   /**
   * @property {Object} gatewaysConfig The gateways configuration data supplied
   * to the instance in the constructor.
   */
   get gatewaysConfig() {
      if (this._gatewaysConfig == undefined) {
         this._gatewaysConfig = null;
      }
      return (this._gatewaysConfig);
   }

   /**
   * @property {Array} gateways Indexed array of objects containing gateway
   * instances. Each element contains a <code>config</code> object reference from the
   * [gatewaysConfig{@link Gateways#gatewaysConfig}] data, the gateway
   * <code>configName</code> as specified by the in the [gatewaysConfig{@link Gateways#gatewaysConfig}]
   * data, and a <code>gateway</code> reference to the instance. Instances in this
   * array may not necessarily be enabled / active.
   *
   * @readonly
   */
   get gateways() {
      if (this._gateways == undefined) {
         this._gateways = new Array();
      }
      return (this._gateways);
   }

   /**
   * @property {Object} availableGateways Contains child objects containing references
   * to available gateways that can be instantiated. Each child object contains a
   * <code>config</code> object reference from the [gatewaysConfig{@link Gateways#gatewaysConfig}]
   * data, the gateway <code>name</code> as specified by the in the [gatewaysConfig{@link Gateways#gatewaysConfig}]
   * data, and a <code>gateway</code> reference to the class that can be
   * used to create an instance.
   *
   * @readonly
   */
   get availableGateways() {
      if (this._availableGateways == undefined) {
         this._availableGateways = new Object();
      }
      return (this._availableGateways);
   }

   /**
   * Returns a gateway reference by it's global configuration name (as opposed
   *  to the [name]{@link Gateway#name) property of the class).
   *
   * @param {String} configName The name of the gateway as specified in the
   * global configuration.
   * @param {Boolean} [enabled=false] If true, the gateway must exist in the
   * [gateways]{@link Gateways#gateways} array, otherwise it must exist in the
   * [availableGateways]{@link Gateways#availableGateways} object.
   *
   * @return {Gateway} A {@link Gateway}-type object, either a class (if <code>enabled=false</code>),
   * or class instance (if <code>enabled=true</code>). If no matching gateway can be found
   * <code>null</code> is returned.
   */
   getGatewayByConfigName (configName, enabled=false) {
   }

   /**
   * Loads and registers gateways specified by a configuration.
   *
   * @param {Object} [configData=null] The configuration data to use to load
   * gateways. If <code>null</code> or not supplied, the instance's
   * [gatewaysConfig]{@link Gateways#gatewaysConfig} is used. If both or
   * not valild, an error is thrown.
   *
   * @async
   */
   async loadGateways(configData=null) {
      if ((configData == null) && (this.gatewaysConfig == null)) {
         throw (new Error("Gateways configuration data invalid."));
      }
      if (configData == null) {
         configData = this.gatewaysConfig;
      }
      for (var configName in configData) {
         var gatewayConfig = configData[configName];
         var scriptPath = gatewayConfig.path;
         console.log ("Loading "+configName+" gateway: "+scriptPath)
         var gatewayClassObj = new Object();
         gatewayClassObj.gateway = require(scriptPath);
         gatewayClassObj.config = gatewayConfig;
         gatewayClassObj.configName = configName;
         this.availableGateways[gatewayClassObj.gateway.name] = gatewayClassObj;
         console.log (gatewayClassObj.gateway.name+" gateway loaded.");
         if (gatewayConfig.enable == true) {
            //enable / create the instance
            var gatewayInstObj = new Object();
            gatewayInstObj.gateway = new gatewayClassObj.gateway(this.server, gatewayConfig);
            gatewayInstObj.config = gatewayConfig;
            gatewayInstObj.configName = configName;
            this.gateways.push(gatewayInstObj);
            console.log ("\""+gatewayClassObj.gateway.name+"\" gateway enabled.");
         }
         if ((gatewayConfig.start == true) && (gatewayConfig.enable == true)) {
            //start the instance
            var result =await  gatewayInstObj.gateway.start();
            if (gatewayInstObj.gateway.started == true) {
               console.log ("\""+gatewayInstObj.gateway.name+"\" gateway started.");
            }
         }
      }
      return (true);
   }
}
