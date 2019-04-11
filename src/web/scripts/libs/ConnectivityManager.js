/**
* @file Manages CypherPoker.JS connectivity by providing a bridge between {@link P2PRouter},
* {@link APIRouter}, {@link CypherPoker}, and {@link CypherPokerUI}.
*
* @version 0.4.1
*/
/**
* @class Manages network connectivity for CypherPoker.JS.
* @extends EventDispatcher
* @see {@link APIRouter}
* @see {@link P2PRouter}
*/
class ConnectivityManager extends EventDispatcher {

   /**
   * Creates an instance of ConnectivityManager.
   *
   * @param {CypherPoker} cypherpokerRef The CypherPoker instance for which
   * this class is controlling connectivity.
   */
   constructor(cypherpokerRef) {
      super();
      this._cypherpoker = cypherpokerRef;
   }

   /**
   * @property {Object} selectors Name/value pairs for UI elements and their
   * associated CSS-style DOM selectors within the connectivity management template <code>connectivityManage.html</code>
   * @property {String} selectors.gatewaysList="#gatewaysList" Pulldown selection list of available server gateways.
   * @property {String} selectors.serverSDBTypeRadioGroup="#serverSDBTypeRadioGroup" Radio group containing options for the SDB variant
   * to generate when starting a gateway.
   * @property {String} selectors.serverSDB="#serverSDB" The generated SDB textfield element for the server when it's started.
   * @property {String} selectors.serverAccessGroup="#serverAccessGroup" Checkbox button group for determining the inclusion
   * of entity types (e.g. "api", "p2p", etc.), in the SDB.
   * @property {String} selectors.connectSDB="#connectSDB" Textarea containing SDB to use for establishing connection(s).
   * @property {String} selectors.apiConnectionList="#apiConnectionList" Pulldown selection list of saved API connections.
   * @property {String} selectors.apiConnectionURL="#apiConnectionURL" The URL input field for the API connection.
   * @property {String} selectors.apiConnectionCreate="#apiConnectionCreate" The API creation JavaScript snippet input field.
   * @property {String} selectors.p2pConnectionList="#p2pConnectionList" Pulldown selection list of saved P2P connections.
   * @property {String} selectors.p2pConnectionURL="#p2pConnectionURL" The URL input field for the P2P connection.
   * @property {String} selectors.p2pConnectionCreate="#p2pConnectionCreate" The P2P creation JavaScript snippet input field.
   * @property {String} selectors.manualConnectionData="#manualConnectionData" A TextArea input for establishing manual
   * peer to peer connections input field.
   */
   get selectors() {
      return({
         "gatewaysList":"#gatewaysList",
         "serverSDBTypeRadioGroup":"#serverSDBTypeRadioGroup",
         "serverSDB":"#serverSDB",
         "serverAccessGroup":"#serverAccessGroup",
         "connectSDB":"#connectSDB",
         "apiConnectionList":"#apiConnectionList",
         "apiConnectionURL":"#apiConnectionURL",
         "apiConnectionCreate":"#apiConnectionCreate",
         "p2pConnectionList":"#p2pConnectionList",
         "p2pConnectionURL":"#p2pConnectionURL",
         "p2pConnectionCreate":"#p2pConnectionCreate",
         "manualConnectionData":"#manualConnectionData"
      });
   }

   /**
   * @property {CypherPoker} cypherpoker The main CypherPoker instance for
   * which this class is managing connectivity, as set at instantiation.
   * @readonly
   */
   get cypherpoker() {
      return (this._cypherpoker);
   }

   /**
   * @property {Object} p2p=null Reference to a peer-to-peer multi-network routing interface
   * supporting a dynamic private ID, direct send (single or multi), and broadcast functionality.
   * For example, {@link P2PRouter}
   */
   get p2p() {
      if (this._p2p == undefined) {
         this._p2p = null;
      }
      return (this._p2p);
   }

   set p2p(p2pSet) {
      this._p2p = p2pSet;
   }

   /**
   * @property {Object} api=null Reference to a multi-network routing interface over which RPC API functions
   * are invoked. For example, {@link APIRouter}.
   */
   get api() {
      if (this._api == undefined) {
         this._api = null;
      }
      return (this._api);
   }

   set api(apiSet) {
      this._api = apiSet;
   }

   /**
   * @property {Boolean} apiConnected=false True if the instance is connected to the
   * API services provider and ready to accept requests.
   * @readonly
   */
   get apiConnected() {
      return (this._apiConnected);
   }

   /**
   * @property {Boolean} p2pConnected=false True if the instance is connected to the peer-to-peer
   * network and ready to accept requests.
   * @readonly
   */
   get p2pConnected() {
      return (this._p2pConnected);
   }

   /**
   * Registers an event listener for an event handled by this class. Any changes to connectivity
   * will also include updates to registered listeners.<br/>
   * Currently supported listeners include:<br/>
   * <ul>
   * <li><code>"message"<code> - dispatched by the [p2p]{@link ConnectivityManager#p2p instance}</li>
   * <ul>
   *
   * @param {String} eventType The type of event to register a listener for.
   * @param {String} router The router type to register the listener with. Valid types
   * include <code>"api"</code> and <code>"p2p"</code>.
   * @param {Function} funcRef The handler function to register for the event.
   * @param {*} context The context in which to execute <code>funcRef</code>.
   */
   registerListener(eventType, router, funcRef, context) {
      if (this._registeredListeners == undefined) {
         this._registeredListeners = new Object();
         this._registeredListeners.api = new Array();
         this._registeredListeners.p2p = new Array();
      }
      var eventObj = new Object();
      eventObj.type = eventType;
      eventObj.func = funcRef;
      eventObj.context = context;
      this._registeredListeners[router].push(eventObj);
   }

   /**
   * Adds any listeners registered with [registerListener]{@link ConnectivityManager#registerListener}
   * to the specified router.
   *
   * @param {String} router The router type, either <code>"api"</code> and <code>"p2p"</code>, to which
   * to add the registered listener(s) to.
   *
   * @private
   */
   addRegisteredListeners(router) {
      if (this[router] == null) {
         return;
      }
      var listenersArr = this._registeredListeners[router];
      for (var count=0; count < listenersArr.length; count++) {
         var listenerObj = listenersArr[count];
         this[router].removeEventListener(listenerObj.type, listenerObj.func);
         this[router].addEventListener(listenerObj.type, listenerObj.func, listenerObj.context);
      }
   }

   /**
   * Populates the list of enabled gateways in the server portion of the
   * connectivity management interface,
   */
   populateGatewaysList() {
      if (isDesktop() == false) {
         return;
      }
      var manageElement = ui.getTemplateByName("connectivityManage").elements[0];
      var listElement = manageElement.querySelector(this.selectors.gatewaysList);
      //clear the list
      listElement.innerHTML = "";
      var result = IPCSend("get-gateways"); //get gateways data array
      for (var count=0; count < result.data.length; count++) {
         var gatewayObj = result.data[count];
         var gatewayName = gatewayObj.name; //name from gateway class
         var gatewayConfgName = gatewayObj.configName; //name in app config
         var gatewayConfg = gatewayObj.config; //config data for gateway
         var newOptionElement = document.createElement("option");
         newOptionElement.setAttribute("value", gatewayName);
         newOptionElement.innerHTML = gatewayName;
         newOptionElement.gateway = gatewayObj;
         listElement.appendChild(newOptionElement);
      }
   }

   /**
   * Creates and starts the [api]{@link CypherPoker#api} and [p2p]{@link CypherPoker#p2p}
   * connections by calling [connectAPI]{@link ConnectivityManager#connectAPI} and
   * [connectP2P]{@link ConnectivityManager#connectP2P}.
   *
   * @param {Boolean} [apiFatalFail=false] If true, a connection failure to the API
   * services server is considered fatal and will throw an exception, otherwise only
   * a connection failure warning is displayed in the console.
   * @param {Boolean} [p2pFatalFail=false] If true, a connection failure to the
   * peer-to-peer network is considered fatal and will throw an exception, otherwise
   * only a connection failure warning is displayed in the console.
   *
   * @async
   */
   async startConnections(apiFatalFail=false, p2pFatalFail=false) {
      if (this.api != null) {
         this.api.destroy();
         this.api = null;
      }
      if (this.p2p != null) {
         this.p2p.destroy();
         this.p2p = null;
      }
      var result = await this.connectAPI();
      if (result == false) {
         this._apiConnected = false;
         if (apiFatalFail == true) {
            throw (new Error("Could not establish API services connection."));
         } else {
            console.warn("Could not establish API services connection.");
         }
      } else {
         this._apiConnected = true;
      }
      if (this.canShareConnections(cypherpoker.settings.api.connectInfo, cypherpoker.settings.p2p.connectInfo) == true) {
         if (this._apiConnected == true) {
            result = await this.connectP2P(this.api.connection);
         } else {
            //already failed during API attempt
            result = false;
         }
      } else {
         result = await this.connectP2P();
      }
      if (result == false) {
         this._p2pConnected = false;
         if (p2pFatalFail == true) {
            throw (new Error("Could not establish peer-to-peer networking connection."));
         } else {
            console.warn ("Could not establish peer-to-peer networking connection.");
         }
      } else {
         this._p2pConnected = true;
      }
      return (true);
   }

   /**
   * Determines if two connection and transport settings objects are the same
   * and can therefore be shared.
   *
   * @param {Object} connectObj1 The first connection info object to compare.
   * @param {Object} connectObj2 The second connection info object to compare.
   *
   * @return {Boolean} True if both the URLs and transports specified
   * by the settings are the same, false otherwise.
   */
   canShareConnections(connectObj1, connectObj2) {
      var conn1URL = connectObj1.url;
      var conn1Type = connectObj1.transport;
      conn1URL = conn1URL.trim();
      conn1Type = conn1Type.trim();
      var conn2URL = connectObj2.url;
      var conn2Type = connectObj2.transport;
      conn2URL = conn2URL.trim();
      conn2Type = conn2Type.trim();
      if ((conn1URL == conn2URL) && (conn1Type == conn2Type)) {
         return (true);
      } else {
         return (false);
      }
   }

   /**
   * Establishes connection(s) using information from a Services Descriptor Bundle.
   * This may result in new [api]{@link ConnectivityManager#api} and/or [p2p]{@link ConnectivityManager#p2p}
   * instances being created and connected. Related <code>connectInfo</code> objects in the
   * [settings]{@link CypherPoker#settings} object are updated accordingly.
   *
   * @param {String|Array} sdb Either Base85 / Ascii85 (including <code>-s</code> variant), or Base64 encoded string, or
   * a native JavaScript array containing SDB entities.
   * @param {String} [entityType="*"] The type of SDB entity to connect to, if
   * contained in the <code>sdb</code>. Valid types are "api" or "p2p". If "*"
   * is supplied, all included entities are connected.
   * @param {Function} [statusCB=null] Optional callback function that tracks
   * the status of the connection(s) progress. This function will receive
   * a single object parameter with properties <code>entity</code> (the entity
   * for which the status is being reported), <code>status</code> (either "connecting",
   * "connected", or "failed"), and <code>url</code> (the assembled connection URL).
   *
   *
   * @return {Promise} The returned promise will resolve with the true if
   * all the specified connections connected successfuly, or false if one
   * or more failed.
   * @async
   */
   async connectFromSDB(sdb, entityType="*", statusCB=null) {
      var allSuccess = true;
      if (typeof(sdb) == "string") {
         var sdbInst = new SDB();
         var failedFirst = false;
         try {
            var result = await sdbInst.decode(sdb);
            if (sdbInst.data == null) {
               failedFirst = true;
            }
         } catch (err) {
            failedFirst = true;
         }
         try {
            if (failedFirst == true) {
               //may bew SDB-s data
               sdb = "<~"+sdb+"~>";
               sdbInst = new SDB();
               result = await sdbInst.decode(sdb);
            }
            if (sdbInst.data == null) {
               return (false);
            }
         } catch (err) {
            return (false)
         }
         var sdbArr = sdbInst.data;
      } else if (typeof(sdb) == "object") {
         if (typeof(sdb.length) == "number") {
            sdbArr = sdb;
         } else {
            return (false);
         }
      } else {
         return (false);
      }
      for (var count=0; count < sdbArr.length; count++) {
         var sdbEntity = sdbArr[count];
         var sdbEntType = sdbEntity.entity;
         if (typeof(sdbEntity.url) != "string") {
            //construct URL, assume port is present (we should probably check for this)
            var url = sdbEntity.protocol +"://"+ sdbEntity.host + ":" + sdbEntity.port;
            sdbEntity.url = url;
         }
      }
      //first disconnect if connected and specified
      var connectArr = new Array();
      for (count=0; count < sdbArr.length; count++) {
         var sdbEntity = sdbArr[count];
         switch (sdbEntity.entity) {
            case "api":
               if (this.api != null) {
                  result = await this.api.destroy();
               }
               this._api = null;
               this._apiConnected = false;
               sdbEntity.create = cypherpoker.settings.api.connectInfo.create; //copy create property
               cypherpoker.settings.api.connectInfo = sdbEntity;
               connectArr.unshift (sdbEntity); //ensure this is first
               break;
            case "p2p":
               if (this.p2p != null) {
                  result = await this.p2p.destroy();
               }
               this._p2p = null;
               this._p2pConnected = false;
               sdbEntity.create = cypherpoker.settings.p2p.connectInfo.create; //copy create property
               cypherpoker.settings.p2p.connectInfo = sdbEntity;
               connectArr.push (sdbEntity); //ensure this is second
               break;
         }
      }
      for (count=0; count < connectArr.length; count++) {
         var sdbEntity = connectArr[count];
         switch (sdbEntity.entity) {
            case "api":
               var url = cypherpoker.settings.api.connectInfo.url;
               if (statusCB != null) {
                  statusCB({entity:"api", status:"connecting", url:url});
               }
               var result = await this.connectAPI();
               if (result == false) {
                  this._apiConnected = false;
                  if (apiFatalFail == true) {
                     throw (new Error("Could not establish API services connection."));
                  } else {
                     console.warn("Could not establish API services connection.");
                  }
                  if (statusCB != null) {
                     statusCB({entity:"api", status:"failed", url:url});
                  }
               } else {
                  this._apiConnected = true;
                  if (statusCB != null) {
                     statusCB({entity:"api", status:"connected", url:url});
                  }
               }
               break;
            case "p2p":
               url = cypherpoker.settings.p2p.connectInfo.url;
               if (statusCB != null) {
                  statusCB({entity:"p2p", status:"connecting", url:url});
               }
               if (this.canShareConnections(cypherpoker.settings.api.connectInfo, cypherpoker.settings.p2p.connectInfo) == true) {
                  if (this._apiConnected == true) {
                     result = await this.connectP2P(this.api.connection);
                  } else {
                     allSuccess = false;
                     result = false;
                  }
               } else {
                  result = await this.connectP2P();
               }
               if (result == false) {
                  this._p2pConnected = false;
                  allSuccess = false;
                  if (statusCB != null) {
                     statusCB({entity:"p2p", status:"failed", url:url});
                  }
               } else {
                  this._p2pConnected = true;
                  if (statusCB != null) {
                     statusCB({entity:"p2p", status:"connected", url:url});
                  }
               }
               break;
         }
      }
      return (allSuccess);
   }

   /**
   * Creates a new API connection specified in the <code>api</code> definition
   * of the [settings]{@link CypherPoker#settings} object, and assigns it to the
   * [api]{@link CypherPoker#p2p} reference.
   * If a connection aready exists, it's destroyed and removed first.
   *
   * @param {Object} [sharedConnection=null] An optional shared / multiplexed
   * connection already established (for example, the connection used for the
   * [p2p]{@link CypherPoker#api});
   *
   * @return {Promise} The returned promise will resolve with the true if
   * the connection was successfully established and false if the connection
   * attempt failed.
   * @async
   */
   async connectAPI(sharedConnection=null) {
      try {
         if (this.api != null) {
            var result = await this.api.destroy();
            this.api = null;
         }
         //create API networking interface
         this.api = Function(cypherpoker.settings.api.connectInfo.create)();
         this.addRegisteredListeners("api");
         if (sharedConnection) {
            //shared P2P / API connection
            this.api.connection = sharedConnection;
         } else {
            //independent API connection
            result = await this.api.connectAPI(cypherpoker.settings.api.connectInfo);
         }
         this._connected = true;
      } catch (err) {
         result = null;
         this._connected = false;
         console.error (err);
         return (false);
      }
      return (true);
   }

   /**
   * Creates a new peer-to-peer rendezvous / signalling connection specified
   * in the <code>p2p</code> definition of the [settings]{@link CypherPoker#settings}
   * object, and assigns it to the [p2p]{@link CypherPoker#p2p} reference.
   * If a connection aready exists, it's destroyed and removed first.
   *
   * @param {Object} [sharedConnection=null] An optional shared / multiplexed
   * connection already established (for example, the connection used for the
   * [api]{@link CypherPoker#api});
   *
   * @return {Promise} The returned promise will resolve with the true if
   * the connection was successfully established and false if the connection
   * attempt failed.
   * @async
   */
   async connectP2P(sharedConnection=null) {
      try {
         if (this.p2p != null) {
            var result = await this.p2p.destroy();
            this.p2p = null;
         }
         //create peer-to-peer routing interface
         this.p2p = Function(cypherpoker.settings.p2p.connectInfo.create)();
         this.addRegisteredListeners("p2p");
         //this.p2p.addEventListener("message", cypherpoker.handleP2PMessage, cypherpoker);
         if (sharedConnection != null) {
            //shared API / P2P connection
            this.p2p.rendezvous = sharedConnection;
         } else {
            //independent P2P connection
            result = await this.p2p.connectRendezvous(cypherpoker.settings.p2p.connectInfo);
         }
      } catch (err) {
         result = null;
         this._connected = false;
         console.error (err);
         return (false);
      }
      return (true);
   }

   /**
   * Invoked by the toggle switch used to enable external access to API / P2P functionality.
   *
   * @param {HTMLElement} cbRef The styled checkbox (sliding toggle), that trigerred this function.
   *
   * @async
   */
   async onEnableServerAccessClick(cbRef) {
      if (isDesktop() == false) {
         throw (new Error("Can't enable server access in non-desktop mode."));
      }
      ui.disable(cbRef);
      var manageElement = ui.getTemplateByName("connectivityManage").elements[0];
      var serverSDBElement = manageElement.querySelector(this.selectors.serverSDB);
      var restoreSDB = serverSDBElement.value;
      var listElement = manageElement.querySelector(this.selectors.gatewaysList);
      ui.disable(listElement);
      var selectedOption = listElement.options[listElement.selectedIndex];
      var gatewayObj = selectedOption.gateway;
      var gatewayStarted = gatewayObj.started;
      var requestObj = new Object();
      requestObj.gateway = gatewayObj;
      if (cbRef.checked == true) {
         if (gatewayStarted == true) {
            //gateway is already started, UI is probably mismatched
             console.error ("Can't start \""+gatewayObj.configName+"\". Gateway is already started.");
             serverSDBElement.innerHTML = restoreSDB;
             ui.enable(listElement);
         } else {
            serverSDBElement.innerHTML = "[ Starting ]";
            var result = await IPCSend("start-gateway", requestObj, true);
            if (result.data == "ok") {
               gatewayObj.started = true;
            }
            serverSDBElement.innerHTML = "[ Started ]";
            this.populateServerSDB(gatewayObj);
         }
      } else {
         if (gatewayStarted == false) {
            //gateway isn't started, UI is probably mismatched
            console.error ("Can't stop \""+gatewayObj.configName+"\". Gateway isn't started.");
            serverSDBElement.innerHTML = restoreSDB;
            ui.enable(listElement);
         } else {
            serverSDBElement.innerHTML = "[ Stopping ]";
            result = await IPCSend("stop-gateway", gatewayObj, true);
            if (result.data == "ok") {
               gatewayObj.started = false;
               serverSDBElement.innerHTML = "[ Stopped ]";
               ui.enable(listElement);
               ui.enable(cbRef);
            }
         }
      }
      ui.enable(cbRef);
   }

   /**
   * Populates the server-generated SDB <code>textarea</code> element in the user interface when server
   * connectivity is enabled, or when the SDB format or options change.
   *
   * @param {Object} gatewayObj Object containing information about the gateway such
   * as would be added in during {@link populateGatewaysList}.
   */
   populateServerSDB(gatewayObj) {
      var manageElement = ui.getTemplateByName("connectivityManage").elements[0];
      var serverSDBElement = manageElement.querySelector(this.selectors.serverSDB);
      serverSDBElement.innerHTML = "[ Generating SDB ]";
      var radioGroupElement = manageElement.querySelector(this.selectors.serverSDBTypeRadioGroup);
      var checkboxGroupElement = manageElement.querySelector(this.selectors.serverAccessGroup);
      var selectedOptions = ui.getGroupSelections(radioGroupElement);
      var selectedValue = selectedOptions[0].value; //this is a group so it should only allow one selection
      var valueSplit = selectedValue.split("-");
      var requestObj = new Object();
      requestObj.gateway = gatewayObj;
      var format = valueSplit[0];
      var subFormat = valueSplit[1];
      requestObj.format = format;
      requestObj.entityTypes = new Array();
      selectedOptions = ui.getGroupSelections(checkboxGroupElement);
      for (var count = 0; count < selectedOptions.length; count++) {
         var entityType = selectedOptions[count].value;
         requestObj.entityTypes.push(entityType)
      }
      var result = IPCSend("get-gateway-sdb", requestObj);
      var sdbString = result.data.sdb;
      if (subFormat == "s") {
         //create *-s variant
         if (format == "base85") {
            sdbString = sdbString.substring(2, sdbString.length-2);
         }
      }
      var serverSDBElement = manageElement.querySelector(this.selectors.serverSDB);
      serverSDBElement.innerHTML = sdbString;
      return (true);
   }

   /**
   * Invoked when any of the SDb generation options (radio buttons or checkboxes), are
   * clicked in the server portion of the connectivity management interface.
   */
   onServerSDBOptionClick() {
      var manageElement = ui.getTemplateByName("connectivityManage").elements[0];
      var listElement = manageElement.querySelector(this.selectors.gatewaysList);
      var selectedOption = listElement.options[listElement.selectedIndex];
      var gatewayObj = selectedOption.gateway;
      var gatewayStarted = gatewayObj.started;
      if (gatewayStarted == false) {
         return(false);
      }
      this.populateServerSDB(gatewayObj);
   }

   /**
   * Copies the current contents of the server-generated SDB <code>textarea</code> element
   * to the system clipboard.
   */
   serverSDBToClipboard() {
      var manageElement = ui.getTemplateByName("connectivityManage").elements[0];
      var serverSDBElement = manageElement.querySelector(this.selectors.serverSDB);
      var sdbStr = serverSDBElement.value; //doesn't convert characters to HTML entities unlike innerHTML
      ui.copyToClipboard(sdbStr);
   }

   /**
   * Invoked by the SDB connect button in the connectivity options of the user
   * interface (the alternative to manual address entry).
   */
   async onConnectUsingSDBClick() {
      for (var count=0; count < this.cypherpoker.games.length; count++) {
         var currentGame = this.cypherpoker.games[count];
         if ((currentGame.gameStarted == true) || (currentGame.gameEnding == true)) {
            var confirmElement = ui.getTemplateByName("logOutConfirm").elements[0];
            ui.show(confirmElement.querySelector("#gameSDBChange"));
            ui.show(confirmElement);
            ui.showDialog();
            return;
         }
      }
      if (this.cypherpoker.joinedTables.length > 0) {
         confirmElement = ui.getTemplateByName("logOutConfirm").elements[0];
         ui.show(confirmElement.querySelector("#lobbySDBChange"));
         ui.show(confirmElement);
         ui.showDialog();
         return;
      }
      this.confirmConnectSDB(false, false);
   }

   /**
   * Displays connection status using the main dialog when a connection attempt
   * has been started using a SDB.
   */
   showSDBConnectStatus(statusObj) {
      switch (statusObj.entity) {
         case "api":
            var entity = "API";
            break;
         case "p2p":
            entity = "Peer-to-Peer";
            break;
         default:
            entity = "unknown";
            break;
      }
      var statusString = new String();
      switch (statusObj.status) {
         case "connecting":
            statusString = "Establishing "+entity+" connection to: "+statusObj.url;
            break;
         case "connected":
            statusString = "Successfully established "+entity+" connection to: "+statusObj.url;
            break;
         case "failed":
            statusString = "Failed "+entity+" connection to: "+statusObj.url;
            break;
         default:
            statusString = "Unrecognized connection status.";
            break;
      }
      ui.showDialog(statusString);
      ui.hideDialog(5000);
   }

   /**
   * Loads any saved connections stored by the user.
   *
   * @param {String} [connectionType=null] The type of connection information
   * to retrieve, either <code>api</code> or <code>p2p</code>
   *
   * @return {Array|Object} Indexed array of objects containing saved connection
   * information, or an object containing all saved connections contained in
   * named indexed arrays.
   */
   getSavedConnections(connectionType=null) {
      var storage = window.localStorage;
      var connectionsObjStr = storage.getItem("connectivity");
      if (connectionsObjStr == null) {
         return (new Array());
      }
      var connectionsObj = JSON.parse(connectionsObjStr);
      if (connectionType == null) {
         return (connectionsObj);
      }
      if ((connectionsObj[connectionType] == undefined) || (connectionsObj[connectionType] == null)) {
         return (new Array());
      }
      return (connectionsObj[connectionType]);
   }

   /**
   * Saves a connection info object for later retieval.
   *
   * @param {Object} connectionInfo An object containing information on how to establish
   * the connection.
   * @param {String} connectionType The type of connection that <code>connectionInfo</code>
   * represents, either "api" or "p2p".
   *
   * @return {Boolean} True if the information was successfully saved, false otherwise.
   *
   * @async
   */
   async saveConnection(connectionInfo, connectionType) {
      var storage = window.localStorage;
      var connectionsObjStr = storage.getItem("connectivity");
      if (connectionsObjStr == null) {
         var connectionsObj = new Object();
      } else {
         connectionsObj = JSON.parse(connectionsObjStr);
      }
      if ((connectionsObj[connectionType] == undefined) || (connectionsObj[connectionType] == null)) {
         connectionsObj[connectionType] = new Array();
      }
      connectionsObj[connectionType].push (connectionInfo);
      storage.setItem("connectivity", JSON.stringify(connectionsObj));
   }

   /**
   * Returns a descriptive, human-readable name for a connection type.
   *
   * @param {String|Object} connectionInfo Either a connection type to evaluate directly
   * or an object containing a <code>type</code> property to evaluate.
   *
   * @return {String} A descriptive name for the connection type. A blank string is returned
   * for any unrecignized type.
   */
   getConnectionName(connectionInfo) {
      if (typeof(connectionInfo) == "object") {
         var connectionType = connectionInfo.transport;
      } else {
         connectionType = connectionInfo;
      }
      connectionType = connectionType.trim().toLowerCase();
      switch (connectionType) {
         case "wss":
            return ("WebSocket Sessions");
            break;
         case "webrtc":
            return ("WebRTC");
            break;
         default:
            return ("");
            break;
      }
   }

   /**
   * Returns a human-readable security descriptor (e.g. "Secure") for a connection type.
   *
   * @param {String|Object} connectionInfo Either a connection url to evaluate directly
   * or an object containing a <code>url</code> property to evaluate.
   * @param {Boolean} [addSpace=true] If true, an extra space is added to the end of the
   * descriptor unless it's an empty string.
   *
   * @return {String} The security descriptor, either "Secure" or an empty string for
   * insecure.
   */
   getConnectionSecurity(connectionInfo, addSpace=true) {
      if (typeof(connectionInfo) == "object") {
         var connectionURL = connectionInfo.url;
      } else {
         connectionURL = connectionInfo;
      }
      connectionURL = connectionURL.trim().toLowerCase();
      connectionURL = connectionURL.split("://")[0];
      var descriptor = "";
      switch (connectionURL) {
         case "wss":
            descriptor = "Secure";
            break;
         case "https":
            descriptor = "Secure";
            break;
         default:
            return ("");
            break;
      }
      if ((addSpace == true) && (descriptor  != "")) {
         descriptor += " ";
      }
      return (descriptor);
   }

   /**
   * Returns the transport type based on a supplied URL.
   *
   * @param {String} connectionURL The URL from which to determine the transport type.
   *
   * @return {String} The transport type represented by the URL. <code>null</code>
   * is returned if the transport type can't be determined.
   */
   getTransportType(connectionURL) {
      var protocol = connectionURL.split(":")[0];
      protocol = protocol.toLowerCase().trim();
      switch (protocol) {
         case "ws":
            return ("wss");
            break;
         case "wss":
            return ("wss");
            break;
         case "tunnel@ws":
            return ("wsst");
            break;
         case "tunnel@wss":
            return ("wsst");
            break;
         default:
            return (null);
            break;
      }
   }

   /**
   * Adjusts a URL that contains additional information that would be considered invalid
   * (such as a "tunnel@" protocol prefix, for example).
   *
   * @param {String} connectionURL The URL to adjust.
   *
   * @return {String} The adjusted URL.
   */
   adjustURL(connectionURL) {
      var urlSplit = connectionURL.split(":");
      var protocol = urlSplit[0];
      var protocolSplit = protocol.split("@");
      if (protocolSplit.length > 1) {
         urlSplit.splice(0, 1);
         var urlRemainder = urlSplit.join(":");
         connectionURL = protocolSplit[1] + ":" + urlRemainder;
      }
      return (connectionURL);
   }

   /**
   * Returns the parameters included with a supplied URL.
   *
   * @param {String} connectionURL The URL from which to determine the parameters.
   *
   * @return {URLSearchParams} The parameters included with the URL
   */
   getConnectionParameters(connectionURL) {
      var decodedURL = decodeURI(connectionURL);
      var urlObj = new URL(decodedURL);
      return (urlObj.searchParams);
   }

   /**
   * Populates a pulldown selection list (HTML <code>select</code> element), with
   * connection options. The existing / default connection information specified
   * in the [CypherPoker.settings]{@link CypherPoker#settings} is added to the
   * list first so that there will always be at least one option.
   *
   * @param {String} connectionType The type of connection list to populate, either
   * "api" or "p2p".
   * @param {String} [defaultSelection=null] The default selection to set the list to.
   * If <code>null</code> the first (current / default) option is selected.
   */
   populateConnectionsList(connectionType, defaultSelection=null) {
      var manageElement = ui.getTemplateByName("connectivityManage").elements[0];
      if (connectionType == "api") {
         var listElement = manageElement.querySelector(this.selectors.apiConnectionList);
      } else if (connectionType == "p2p") {
         listElement = manageElement.querySelector(this.selectors.p2pConnectionList);
      } else {
         return;
      }
      var connList = this.getSavedConnections(connectionType);
      var defaultConnection = cypherpoker.settings[connectionType].connectInfo;
      //clear the list
      listElement.innerHTML = "";
      var found = connList.some(arrElement => {
         return ((arrElement.url == defaultConnection.url) && (arrElement.transport == defaultConnection.transport));
      })
      if (found == false) {
         //current / default connection does not exist in saved list so add it to the top
         connList.splice(0, 0, defaultConnection);
      }
      for (var count = 0; count < connList.length; count++) {
         var connObj = connList[count];
         var newOptionElement = document.createElement("option");
         newOptionElement.setAttribute("value", connObj.url);
         newOptionElement.innerHTML = this.getConnectionSecurity(connObj)+this.getConnectionName(connObj)+" &rarr; "+connObj.url;
         newOptionElement.connection = connObj;
         listElement.appendChild(newOptionElement);
      }
      if (this.defaultSelection == null) {
         listElement.value = defaultConnection.url; //set default item as current selection
      } else {
         listElement.value = defaultSelection;
      }
   }

   /**
   * Populates the API connection input fields (url and create script) in the user interface,
   * using the currently selected option in the API connections list (HTML <code>select</code> element).
   */
   populateAPIConnectionInputs() {
      var manageElement = ui.getTemplateByName("connectivityManage").elements[0];
      var listElement = manageElement.querySelector(this.selectors.apiConnectionList);
      var urlInputElement = manageElement.querySelector(this.selectors.apiConnectionURL);
      var connectionCreateElement = manageElement.querySelector(this.selectors.apiConnectionCreate);
      var selectedOption = listElement.options[listElement.selectedIndex];
      urlInputElement.value = selectedOption.connection.url;
      connectionCreateElement.value = selectedOption.connection.create;
   }

   /**
   * Invoked by a button on the API connectivity form to trigger a connection
   * to the currently selected (or manually entered), connection. Prior to triggering
   * this action, this function displays warning dialogs if a game or a table advertisement /
   * join request is currently active.
   *
   * @async
   */
   async onConnectAPIClick() {
      ui.hide(ui.getTemplateByName("accountCreate").elements[0]);
      ui.hide(ui.getTemplateByName("accountLogin").elements[0]);
      ui.hide(ui.getTemplateByName("accountManage").elements[0]);
      for (var count=0; count < this.cypherpoker.games.length; count++) {
         var currentGame = this.cypherpoker.games[count];
         if ((currentGame.gameStarted == true) || (currentGame.gameEnding == true)) {
            var confirmElement = ui.getTemplateByName("logOutConfirm").elements[0];
            ui.show(confirmElement.querySelector("#gameAPIChange"));
            ui.show(confirmElement);
            ui.showDialog();
            return;
         }
      }
      if (this.cypherpoker.joinedTables.length > 0) {
         confirmElement = ui.getTemplateByName("logOutConfirm").elements[0];
         ui.show(confirmElement.querySelector("#lobbyAPIChange"));
         ui.show(confirmElement);
         ui.showDialog();
         return;
      }
      this.confirmConnectAPI(false);
   }

   /**
   * Trigerred after [onConnectUsingSDBClick]{@link ConnectivityManager#onConnectUsingSDBClick} either
   * directly or as a result of a confirmation by the plyer. New connection(s) is/are
   * determined from the SDB, closing any current connections, and establishing new ones.
   *
   * @param {Boolean} [gameActive=false] If true, any existing games are destroyed
   * prior to establishing the new connection.
   * @param {Boolean} [joinActive=false] If true, any existing table advertisement
   * or join requests are cancelled prior to establishing the new connection.
   *
   * @async
   */
   async confirmConnectSDB(gameActive=false, joinActive=false) {
      if (joinActive) {
         //lobby is active
         this.cypherpoker.removeAllTables(true, true);
      } else if (gameActive) {
         //game(s) active
         this.cypherpoker.removeAllGames(true);
      }
      var confirmElement = ui.getTemplateByName("logOutConfirm").elements[0];
      ui.hide(confirmElement.querySelector("#gameSDBChange"));
      ui.hide(confirmElement.querySelector("#lobbySDBChange"));
      ui.hide(confirmElement);
      ui.hideDialog();
      var manageElement = ui.getTemplateByName("connectivityManage").elements[0];
      var connectSDBElement = manageElement.querySelector(this.selectors.connectSDB);
      var sdbStr = connectSDBElement.value; //doesn't convert characters to HTML entities unlike innerHTML
      if (sdbStr.trim() == "") {
         return (false);
      }
      ui.hide(manageElement);
      ui.hide(ui.getTemplateByName("accountCreate").elements[0]);
      ui.hide(ui.getTemplateByName("accountLogin").elements[0]);
      ui.hide(ui.getTemplateByName("accountManage").elements[0]);
      ui.hide(ui.getTemplateByName("lobby").elements[0]);
      //this._apiConnected = false; //this must be set after account list is emptied
      this.cypherpoker.clearAccounts();
      ui.clearAccountsUI();
      var result = await this.connectFromSDB(sdbStr, "*", this.showSDBConnectStatus);
      if (result == false) {
         ui.showDialog ("Failed to establish any connection using SDB.");
         ui.hideDialog(4000);
      } else {
         ui.show(ui.getTemplateByName("accountLogin").elements[0]);
         this.cypherpoker.restoreAccounts(this.cypherpoker.settings.api.connectInfo.url);
         result = await this.p2p.changePrivateID(this.api.privateID);
         ui.updateAccountsUI();
      }
   }

   /**
   * Trigerred after [onConnectAPIClick]{@link ConnectivityManager#onConnectAPIClick} either
   * directly or as a result of a confirmation by the plyer. A new API connection is
   * established by gathering the url, create script, and generating a connection type
   * via [getTransportType]{@link ConnectivityManager#getTransportType}, creating
   * a new <code>connectInfo</code> object, and using it to replace the current
   * <code>cypherpoker.settings.api.connectInfo</code> setting.
   *
   * @param {Boolean} [gameActive=false] If true, any existing games are destroyed
   * prior to establishing the new connection.
   * @param {Boolean} [joinActive=false] If true, any existing table advertisement
   * or join requests are cancelled prior to establishing the new connection.
   *
   * @async
   */
   async confirmConnectAPI(gameActive=false, joinActive=false) {
      if (joinActive) {
         //lobby is active
         this.cypherpoker.removeAllTables(true, true);
      } else if (gameActive) {
         //game(s) active
         this.cypherpoker.removeAllGames(true);
      }
      var confirmElement = ui.getTemplateByName("logOutConfirm").elements[0];
      ui.hide(confirmElement.querySelector("#gameAPIChange"));
      ui.hide(confirmElement);
      ui.hideDialog();
      var manageElement = ui.getTemplateByName("connectivityManage").elements[0];
      var urlInputElement = manageElement.querySelector(this.selectors.apiConnectionURL);
      var connectionCreateElement = manageElement.querySelector(this.selectors.apiConnectionCreate);
      var url = urlInputElement.value;
      var create = connectionCreateElement.value;
      var connectInfo = new Object();
      connectInfo.url = this.adjustURL(url);
      connectInfo.transport = this.getTransportType(url);
      connectInfo.parameters = this.getConnectionParameters(this.adjustURL(url));
      connectInfo.create = create;
      this.cypherpoker.settings.api.connectInfo = connectInfo;
      this._apiConnected = false; //this must be set after account list is emptied
      this.cypherpoker.clearAccounts();
      ui.clearAccountsUI();
      ui.hide(ui.getTemplateByName("lobby").elements[0]);
      var manageElement = ui.getTemplateByName("connectivityManage").elements[0];
      ui.hide(manageElement);
      ui.showDialog("Establishing new API connection to: "+url);
      var result = await this.connectAPI();
      if (result == true) {
         this._apiConnected = true;
         this.cypherpoker.restoreAccounts(this.cypherpoker.settings.api.connectInfo.url);
         ui.showDialog("Connected to new Services API: "+url);
         ui.hideDialog(5000);
         result = await this.p2p.changePrivateID(this.api.privateID);
         if (result == true) {
            ui.showDialog("Peer-to-peer identity updated.");
            ui.hideDialog(5000);
         }
         ui.updateAccountsUI();
      }
   }

   /**
   * Invoked by a button on the API connectivity form to trigger the saving of
   * information currently enetered into the form as a new entry which will
   * subsequently be included in the population of the API connections.
   * list.
   *
   * @async
   */
   async onSaveAPIClick() {
      var manageElement = ui.getTemplateByName("connectivityManage").elements[0];
      var urlInputElement = manageElement.querySelector(this.selectors.apiConnectionURL);
      var connectionCreateElement = manageElement.querySelector(this.selectors.apiConnectionCreate);
      var url = urlInputElement.value;
      var create = connectionCreateElement.value;
      var connectInfo = new Object();
      connectInfo.url = this.adjustURL(url);
      connectInfo.transport = this.getTransportType(url);
      connectInfo.parameters = this.getConnectionParameters(this.adjustURL(url));
      connectInfo.create = create;
      this.saveConnection(connectInfo, "api");
      this.populateConnectionsList("api", url);
   }

   /**
   * Populates the P2P connection input fields (url and create script) in the user interface,
   * using the currently selected option in the P2P connections list (HTML <code>select</code> element).
   */
   populateP2PConnectionInputs() {
      var manageElement = ui.getTemplateByName("connectivityManage").elements[0];
      var listElement = manageElement.querySelector(this.selectors.p2pConnectionList);
      var urlInputElement = manageElement.querySelector(this.selectors.p2pConnectionURL);
      var connectionCreateElement = manageElement.querySelector(this.selectors.p2pConnectionCreate);
      var selectedOption = listElement.options[listElement.selectedIndex];
      urlInputElement.value = selectedOption.connection.url;
      connectionCreateElement.value = selectedOption.connection.create;
   }

   /**
   * Invoked by a button on the P2P connectivity form to trigger a connection
   * to the currently selected (or manually entered), connection. Prior to triggering
   * this action, this function displays warning dialogs if a game or a table advertisement /
   * join request is currently active.
   *
   * @async
   */
   async onConnectP2PClick() {
      ui.hide(ui.getTemplateByName("accountCreate").elements[0]);
      ui.hide(ui.getTemplateByName("accountLogin").elements[0]);
      ui.hide(ui.getTemplateByName("accountManage").elements[0]);
      for (var count=0; count < this.cypherpoker.games.length; count++) {
         var currentGame = this.cypherpoker.games[count];
         if ((currentGame.gameStarted == true) || (currentGame.gameEnding == true)) {
            var confirmElement = ui.getTemplateByName("logOutConfirm").elements[0];
            ui.show(confirmElement.querySelector("#gameP2PChange"));
            ui.show(confirmElement);
            ui.showDialog();
            return;
         }
      }
      if (this.cypherpoker.joinedTables.length > 0) {
         confirmElement = ui.getTemplateByName("logOutConfirm").elements[0];
         ui.show(confirmElement.querySelector("#lobbyP2PChange"));
         ui.show(confirmElement);
         ui.showDialog();
         return;
      }
      this.confirmConnectP2P(false);
   }

   /**
   * Trigerred after [onConnectP2PClick]{@link ConnectivityManager#onConnectP2PClick} either
   * directly or as a result of a confirmation by the plyer. A new P2P connection is
   * established by gathering the url, create script, and generating a connection type
   * via [getTransportType]{@link ConnectivityManager#getTransportType}, creating
   * a new <code>connectInfo</code> object, and using it to replace the current
   * <code>cypherpoker.settings.p2p.connectInfo</code> setting.
   *
   * @param {Boolean} [gameActive=false] If true, any existing games are destroyed
   * prior to establishing the new connection.
   * @param {Boolean} [joinActive=false] If true, any existing table advertisement
   * or join requests are cancelled prior to establishing the new connection.
   *
   * @async
   */
   async confirmConnectP2P(gameActive=false, joinActive=false) {
      if (joinActive) {
         //lobby is active
         this.cypherpoker.removeAllTables(true, true);
      } else if (gameActive) {
         //game(s) active
         this.cypherpoker.removeAllGames(true);
      }
      var confirmElement = ui.getTemplateByName("logOutConfirm").elements[0];
      ui.hide(confirmElement.querySelector("#gameP2PChange"));
      ui.hide(confirmElement);
      ui.hideDialog();
      var manageElement = ui.getTemplateByName("connectivityManage").elements[0];
      var urlInputElement = manageElement.querySelector(this.selectors.p2pConnectionURL);
      var connectionCreateElement = manageElement.querySelector(this.selectors.p2pConnectionCreate);
      var url = urlInputElement.value;
      var create = connectionCreateElement.value;
      var connectInfo = new Object();
      connectInfo.url = this.adjustURL(url);
      connectInfo.transport = this.getTransportType(url);
      connectInfo.parameters = this.getConnectionParameters(this.adjustURL(url));
      connectInfo.create = create;
      this.cypherpoker.settings.p2p.connectInfo = connectInfo;
      this._p2pConnected = false;
      //Accounts are not cleared since they're associate with the API connection
      //(i.e. switching P2P connections only requites that the P2P private ID be
      // set to match the API private ID).
      ui.hide(ui.getTemplateByName("lobby").elements[0]);
      var manageElement = ui.getTemplateByName("connectivityManage").elements[0];
      ui.hide(manageElement);
      ui.showDialog("Establishing new peer-to-peer rendezvous connection to: "+url);
      var result = await this.connectP2P();
      if (result == true) {
         this._p2pConnected = true;
          ui.show(ui.getTemplateByName("accountLogin").elements[0]);
         ui.showDialog("Connected to new peer-to-peer rendezvous: "+url);
         ui.hideDialog(5000);
         result = await this.p2p.changePrivateID(this.api.privateID);
         if (result == true) {
            ui.showDialog("Peer-to-peer identity updated.");
            ui.hideDialog(5000);
         }
      }
   }

   /**
   * Invoked by a button on the P2P connectivity form to trigger the saving of
   * information currently enetered into the form as a new entry which will
   * subsequently be included in the population of the P2P connections.
   * list.
   *
   * @async
   */
   async onSaveP2PClick() {
      var manageElement = ui.getTemplateByName("connectivityManage").elements[0];
      var urlInputElement = manageElement.querySelector(this.selectors.p2pConnectionURL);
      var connectionCreateElement = manageElement.querySelector(this.selectors.p2pConnectionCreate);
      var url = urlInputElement.value;
      var create = connectionCreateElement.value;
      var connectInfo = new Object();
      connectInfo.url = this.adjustURL(url);
      connectInfo.transport = this.getTransportType(url);
      connectInfo.parameters = this.getConnectionParameters(this.adjustURL(url));
      connectInfo.create = create;
      this.saveConnection(connectInfo, "p2p");
      this.populateConnectionsList("p2p", url);
   }

}
