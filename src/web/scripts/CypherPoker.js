/**
 * @file The main interface to CypherPoker.JS<br/>
 * Automates peer-to-peer connectivity and instantiation of the cryptosystem,
 * manages accounts and tables, launches games, and provides accesss to other shared
 * functionality.
 *
 * @version 0.5.1
 * @author Patrick Bay
 * @copyright MIT License
 */

/**
 * @class Main CypherPoker.JS lobby, account manager, table maker, and game launcher.
 *
 * @example
 * var settingsObj = {
 *    "p2p":{
 *      "connectInfo":{
 *          "create":"return (new P2PRouter())",
 *          "type":"wss",
 *          "url":"ws://127.0.0.1:8090"
 *      },
 *      "transports": {
 *         "preferred":["webrtc","wss","ortc"],
 *         "quickConnect":true
 *       }
 *   },
 *   "api":{
 *      "connectInfo":{
 *         "create":"return (new APIRouter())",
 *         "type":"wss",
 *         "url":"ws://127.0.0.1:8090"
 *      }
 *   },
 *   "crypto":{
 *      "create":"return (new SRACrypto(4))",
 *      "bitLength": 1024,
 *      "radix": 16
 *   },
 *   "debug":false
 * }
 * var cypherpoker = new CypherPoker(settingsObj);
 *
 * @extends EventDispatcher
 * @see {@link ConnectivityManager}
 * @see {@link SRACrypto}
 */
class CypherPoker extends EventDispatcher {
   /**
    * An object containing properties and references required by CypherPoker.JS that
    * refer to a table or group of peers.
    * @typedef {Object} CypherPoker#TableObject
    * @property {String} ownerPID The private ID of the owner / creator of the table.
    * @property {String} tableID The pseudo-randomly generated, unique table ID of the table.
    * @property {String} tableName The name given to the table by the owner.
    * @property {Array} requiredPID Indexed array of private IDs of peers required to join this room before it's
    * considered full or ready. The wildcard asterisk (<code>"*"</code>) can be used to signify any PID.
    * @property {Array} joinedPID Indexed array of private IDs that have been accepted by the owner, usually in a
    * <code>tablejoin</code> CypherPoker peer-to-peer message. This array should ONLY contain valid
    * private IDs (no wildcards).
    * @property {Array} restorePID Copy of the original private IDs in the <code>requiredPID</code> array
    * used to restore it if members of the <code>joinePID</code> array leave the table.
    * @property {Object} tableInfo Additional information to be included with the table. Use this object rather than
    * a [TableObject]{@link CypherPoker#TableObject} at the root level since it is dynamic (may cause unexpected behaviour).
    */

   //Event definitions:

   /**
    * The instance has successfully started.
    *
    * @event CypherPoker#start
    * @type {Event}
    */
   /**
    * An external peer is announcing a unique new table (within allowable limits).
    *
    * @event CypherPoker#tablenew
    * @type {Event}
    * @property {Object} data The JSON-RPC 2.0 object containing the announcement.
    * @property {Object} data.result The standard JSON-RPC 2.0 notification result object.
    * @property {String} data.result.from The private ID of the notification sender.
    * @property {CypherPoker#TableObject} data.result.data The table associated with the notification.
    */
   /**
    * An external peer has made a successful request to join one of our tables.
    *
    * @event CypherPoker#tablejoinrequest
    * @type {Event}
    * @property {Object} data The JSON-RPC 2.0 object containing the request.
    * @property {String} joined The private ID of the peer that has just joined.
    * @property {Object} data.result The standard JSON-RPC 2.0 notification result object.
    * @property {String} data.result.from The private ID of the request sender.
    * @property {CypherPoker#TableObject} data.result.data The table associated with the notification.
    * @property {CypherPoker#TableObject} table The table object being tracked by us, updated after
    * the request has been processed.
    */
   /**
    * A notification that a new peer (possibly us), is joining another
    * owner's table.
    *
    * @event CypherPoker#tablejoin
    * @type {Event}
    * @property {Object} data The JSON-RPC 2.0 object containing the table update.
    * @property {Object} data.result The standard JSON-RPC 2.0 notification result object.
    * @property {String} data.result.from The private ID of the notification sender.
    * @property {CypherPoker#TableObject} data.result.data The table associated with the notification.
    * @property {CypherPoker#TableObject} table The table object being tracked by us, updated after
    * the request has been processed.
    */
   /**
    * The associated table's required private IDs have all joined and the table
    * is ready (e.g. to start a game)
    *
    * @event CypherPoker#tableready
    * @type {Event}
    * @property {CypherPoker#TableObject} table The table associated with the notification.
    */
   /**
    * A table member is sending a message to other table members.
    *
    * @event CypherPoker#tablemsg
    * @type {Event}
    * @property {Object} data The JSON-RPC 2.0 object containing the message information.
    * @property {Object} data.result The standard JSON-RPC 2.0 notification result object.
    * @property {String} data.result.from The private ID of the message sender.
    * @property {CypherPoker#TableObject} data.result.data The table associated with the message.
    * @property {*} data.result.data.message The message being sent.
    */
   /**
    * An external peer is leaving a table.
    *
    * @event CypherPoker#tableleave
    * @type {Event}
    * @property {Object} data The JSON-RPC 2.0 object containing the table being left.
    * @property {Object} data.result The standard JSON-RPC 2.0 notification result object.
    * @property {String} data.result.from The private ID of the notification sender.
    * @property {CypherPoker#TableObject} data.result.data The table associated with the notification.
    * @property {CypherPoker#TableObject} table The table object being tracked by us, updated after
    * the request has been processed. If the leaving peer was the owner, the table is destroyed
    * and this reference is <code>null</code>.
    */
   /**
    * A join request to another owner's table has timed out without a response.
    *
    * @event CypherPoker#tablejointimeout
    * @type {Object}
    * @property {CypherPoker#TableObject} table The table that has timed out.
    */
   /**
    * A new {@link CypherPokerGame} instance has been created.
    *
    * @event CypherPoker#newgame
    * @type {Object}
    * @property {CypherPokerGame} game The newly created game instance.
    */

   /**
    * Creates a new CypherPoker.JS instance.
    *
    * @param {Object} settingsObject An external settings object specifying startup
    * and initialization options for the instance. This reference is set to the
    * [settingas]{@link CypherPoker#settings} property.
    *
    */
   constructor(settingsObject) {
      super();
      this._apiConnected = false;
      this._p2pConnected = false;
      this._settings = settingsObject;
      this.initialize();
   }

   /**
    * Called to intialize the instance after all settings are created / loaded.
    * Sets the [p2p]{@link CypherPoker#p2p} and [crypto]{@link CypherPoker#crypto} references using settings functions.
    * Also adds an internal listener for <code>message</code> events on [p2p]{@link CypherPoker#p2p},
    * in order to process some of them internally.
    * @private
    */
   initialize() {
      this.debug("CypherPoker.initialize()");
      //create cryptosystem
      this._crypto = Function(this.settings.crypto.create)();
   }

   /**
    * Creates a <code>console</code>-based output based on the type if the
    * <code>debug</code> property of [settings]{@link CypherPoker#settings} is <code>true</code>.
    *
    * @param {*} msg The message to send to the console output.
    * @param {String} [type="log"] The type of output that the <code>msg</code> should
    * be sent to. Valid values are "log"-send to the standard <code>log</code> output,
    * "err" or "error"-send to the <code>error</code> output, and "dir"-send to the
    * <code>dir</code> (object inspection) output.
    * @private
    */
   debug(msg, type = "log") {
      if (this.settings.debug == true) {
         if (type == "err" || type == "error") {
            console.error(msg);
         } else if (type == "dir") {
            console.dir(msg);
         } else {
            console.log(msg);
         }
      }
   }

   /**
    * Starts the instance once all internal and external initialization has been
    * completed. Usually this function can be invoked directly after a new
    * instance is created unless otherwise required.
    *
    * @param {Object} [options=null] Optional startup options that can be used
    * to override default settings, behaviours, and functionality.
    * @param {URLSearchParams} [options.urlParams] Any options that may have
    * been supplied to the application via the URL as parameters (name-value pairs).
    *
    * @fires CypherPoker#start
    * @async
    * @see {@link https://developer.mozilla.org/en-US/docs/Web/API/URLSearchParams}
    */
   async start(options = null) {
      this.debug("CypherPoker.start()");
      //parse startup options, if provided
      if (options != null) {
         try {
            if (options.urlParams != undefined) {
               try {
                  await this.processURLParams(options.urlParams);
               } catch (err) {
                  var errStr = String(err);
                  errStr = errStr.split("\n").join("<br/>");
                  ui.showDialog(
                     "There was an error processing URL parameters:<br/>" +
                        errStr
                  );
               }
            }
         } catch (err) {
            //this should not be fatal
            console.warn(err);
         }
      }
      //restore saved accounts
      this.restoreAccounts(this.settings.api.connectInfo.url);
      //start connections
      this._connectivityManager = new ConnectivityManager(this);
      this.connectivityManager.registerListener(
         "message",
         "p2p",
         this.handleP2PMessage,
         this
      );
      this.connectivityManager.registerListener(
         "close",
         "api",
         this.onAPIDisconnect,
         this
      );
      var result = await this.connectivityManager.startConnections();
      var event = new Event("start");
      this.dispatchEvent(event);
      return result;
   }

   /**
    * @param {URLSearchParams} urlParams Options supplied as parsed URL parameters
    * to apply to the [settings]{@link CypherPoker#settings} object.
    *
    * @async
    */
   async processURLParams(urlParams) {
      try {
         if (urlParams.has("p2p.url") == true) {
            this.settings.p2p.connectInfo.url = urlParams.get("p2p.url");
         }
         if (urlParams.has("p2p.type") == true) {
            this.settings.p2p.connectInfo.type = urlParams.get("p2p.type");
         }
         if (urlParams.has("api.url") == true) {
            this.settings.api.connectInfo.url = urlParams.get("api.url");
         }
         if (urlParams.has("api.type") == true) {
            this.settings.api.connectInfo.type = urlParams.get("api.type");
         }
         //SDB will overwrite any other settings specified
         if (urlParams.has("sdb") == true) {
            var sdb = new SDB();
            await sdb.decode(urlParams.get("sdb"));
            for (var count = 0; count < sdb.data.length; count++) {
               var entityObj = sdb.data[count];
               if (entityObj.url == undefined) {
                  entityObj.url = entityObj.protocol + "://" + entityObj.host;
               }
               if (entityObj.port != undefined) {
                  entityObj.url += ":" + String(entityObj.port);
               }
               if (entityObj.entity == "api") {
                  this.settings.api.connectInfo = entityObj;
                  this.settings.api.connectInfo.create =
                     "return (new APIRouter())";
               } else if (entityObj.entity == "p2p") {
                  this.settings.p2p.connectInfo = entityObj;
                  this.settings.p2p.connectInfo.create =
                     "return (new P2PRouter())";
               } else {
                  //not currenly supported
               }
            }
         }
      } catch (err) {
         console.error(err);
      }
   }

   /**
    * @property {Object} settings The main settings object for the instance as provided
    * during instatiation time.
    * @readonly
    */
   get settings() {
      return this._settings;
   }

   /**
    * @property {Object} p2p=null Reference to a peer-to-peer networking interface.
    * This is a direct reference to [ConnectivityManager.p2p]{@link ConnectivityManager#p2p} unless
    * {@link ConnectivityManager} hasn't been instantiated.
    */
   get p2p() {
      if (this.connectivityManager == null) {
         return null;
      }
      return this.connectivityManager.p2p;
   }

   set p2p(p2pSet) {
      this.connectivityManager.p2p = p2pSet;
   }

   /**
    * @property {Object} api=null Reference to a networking interface over which RPC API functions
    * are invoked. This is a direct reference to [ConnectivityManager.api]{@link ConnectivityManager#api} unless
    * {@link ConnectivityManager} hasn't been instantiated.
    */
   get api() {
      if (this.connectivityManager == null) {
         return null;
      }
      return this.connectivityManager.api;
   }

   set api(apiSet) {
      this.connectivityManager.api = apiSet;
   }

   /**
    * @property {Boolean} apiConnected=false Returns the
    * [ConnectivityManager.apiConnected]{@link ConnectivityManager#apiConnected} value
    * unless {@link ConnectivityManager} hasn't been instantiated yet.
    * @readonly
    */
   get apiConnected() {
      if (this.connectivityManager == null) {
         return false;
      }
      return this.connectivityManager.apiConnected;
   }

   /**
    * @property {Boolean} p2pConnected=false Returns the
    * [ConnectivityManager.p2pConnected]{@link ConnectivityManager#p2pConnected} value
    * unless {@link ConnectivityManager} hasn't been instantiated yet.
    * @readonly
    */
   get p2pConnected() {
      if (this.connectivityManager == null) {
         return false;
      }
      return this.connectivityManager.p2pConnected;
   }

   /**
    * @property {ConnectivityManager} connectivityManager A reference to the connectivity manager
    * instance used to control the [p2p]{@link CypherPoker#p2p} and [api]{@link CypherPoker#api}
    * instances as well as to provide utility functions for {@link CypherPokerUI}.
    */
   get connectivityManager() {
      if (this._connectivityManager == undefined) {
         this._connectivityManager = null;
      }
      return this._connectivityManager;
   }

   /**
    * @property {SRACrypto} crypto An interface for asynchronous cryptographic operations.
    * @readonly
    */
   get crypto() {
      return this._crypto;
   }

   /**
    * @property {Array} accounts Indexed array of {@link CypherPokerAccount} instances
    * managed by this instance.
    */
   get accounts() {
      if (this._accounts == undefined) {
         this._accounts = new Array();
      }
      return this._accounts;
   }

   /**
    * @property {Boolean} openTables Indicates whether the instance has any owned
    * and open tables (true), or if all owned and open tables are filled (false).
    * @readonly
    */
   get openTables() {
      if (this["_openTables"] == undefined) {
         this._openTables = false;
      }
      return this._openTables;
   }

   /**
    * @property {Array} joinedTables A current copy of the list of the tables we've joined (owned
    * and others').
    * @readonly
    */
   get joinedTables() {
      if (this._joinedTables == undefined) {
         this._joinedTables = new Array();
      }
      return Array.from(this._joinedTables);
   }

   /**
    * @property {Array} announcedTables A current copy of the list of tables announced by other owners.
    * @readonly
    */
   get announcedTables() {
      if (this._announcedTables == undefined) {
         this._announcedTables = new Array();
      }
      return Array.from(this._announcedTables);
   }

   /**
    * @property {Array} games A list of references to {@link CypherPokerGame} instances
    * managed by this instance.
    * @readonly
    */
   get games() {
      if (this._games == undefined) {
         this._games = new Array();
      }
      return this._games;
   }

   /**
    * @property {Boolean} captureNewTables=false If set to true, the instance begins to immediately
    * capture new table announcements made over the peer-to-peer network. The network
    * does not need to be connected for this setting to be changed.
    */
   set captureNewTables(captureSet) {
      this._newTableCapture = captureSet;
      this.debug("CypherPoker.captureNewTables=" + captureSet);
   }

   get captureNewTables() {
      if (typeof this["_newTableCapture"] != "boolean") {
         this._newTableCapture = false;
      }
      return this._newTableCapture;
   }

   /**
    * @property {Number} maxCapturedTables=99 The maximum number of tables that should be
    * captured to the [announcedTables]{@link CypherPoker#announcedTables} array. Once this limit is reached,
    * items are shuffled so that new items always have the smallest index.
    */
   set maxCapturedTables(maxSet) {
      this._maxCapturedTables = maxSet;
      this.debug("CypherPoker.maxCapturedTables=" + maxSet);
   }

   get maxCapturedTables() {
      if (isNaN(this["_maxCapturedTables"])) {
         this._maxCapturedTables = 99;
      }
      return this._maxCapturedTables;
   }

   /**
    * @property {Number} maxCapturesPerPeer=5 The maximum number of tables that should be
    * captured to the [announcedTables]{@link CypherPoker#announcedTables} array per peer. If this many tables
    * currently exist in [announcedTables]{@link CypherPoker#announcedTables} array, new and/or unique announcements
    * by the same peer will be ignored.
    */
   set maxCapturesPerPeer(maxSet) {
      this._maxCapturesPerPeer = maxSet;
   }

   get maxCapturesPerPeer() {
      if (isNaN(this["_maxCapturesPerPeer"])) {
         this._maxCapturesPerPeer = 5;
      }
      return this._maxCapturesPerPeer;
   }

   /**
    * @property {Number} beaconInterval=5000 The interval, in milliseconds, to activate the
    * internal table announcement beacon per table (owned tables only!)
    */
   set beaconInterval(intervalMS) {
      this._beaconInterval = intervalMS;
      this.debug("CypherPoker.beaconInterval=" + intervalMS);
   }

   get beaconInterval() {
      if (typeof this["_beaconInterval"] != "number") {
         this._beaconInterval = 5000;
      }
      return this._beaconInterval;
   }

   /**
    * Invoked by the [ConnectivityManager.api]{@link ConnectivityManager#api} instance when
    * it dispatches a [close]{@link APIRouter#event:close} event when the API connection
    * closes unexpectedly (the server closes the connection).
    *
    * @param {Object} eventObj A "close" event object
    *
    */
   async onAPIDisconnect(eventObj) {
      ui.showDialog(
         "The API server at " +
            this.settings.api.connectInfo.url +
            " disconnected unexpectedly."
      );
      ui.hideDialog(5000);
      this.clearAccounts();
      if (ui.lobbyActive == true) {
         //return to lobby interface
         ui.onLobbyButtonClick("cancel_game", "lobby");
      } else {
         //just stop any active game advertisements / join requests
         ui.onLobbyButtonClick("cancel_game");
      }
   }

   /**
    * Restores saved accounts from the browser's <code>localStorage</code> for
    * a specific domain or API service and stores them to the
    * [accounts]{@link CypherPoker#accounts} array. Any accounts present
    * in the array are removed.
    *
    * @param {String|Array} domain The domain(s), URL(s), or unique server identifier(s)
    * associated with the accounts to be restored. If a string is supplied only accounts
    * matching the single identitier will be restored. If this parameter is an array,
    * accounts matching any element will be restored. If null is supplied, all
    * accounts will be restored.
    */
   restoreAccounts(domains) {
      var storage = window.localStorage;
      var accountsArr = storage.getItem("accounts");
      this._accounts = new Array();
      this._NDAccounts = new Array(); //non-domain accounts (stored for saving)
      if (accountsArr != null) {
         accountsArr = JSON.parse(accountsArr);
         for (var count = 0; count < accountsArr.length; count++) {
            var currentAccountData = accountsArr[count];
            if (currentAccountData.domains == undefined) {
               //upgrade account data to v0.4.1 (some accounts may be miscategorized)
               currentAccountData.domains = new Array();
               if (typeof domains == "string") {
                  currentAccountData.domains.push(domains);
               } else {
                  currentAccountData.domains =
                     currentAccountData.domains.concat(domains);
               }
            }
            if (domains != null) {
               var inDomain = currentAccountData.domains.some((element) => {
                  if (typeof domains == "string") {
                     return element == domains;
                  } else {
                     return domains.some((el) => {
                        return el == element;
                     }, this);
                  }
               }, this);
            } else {
               inDomain = true;
            }
            if (inDomain) {
               var newAccount = new CypherPokerAccount(
                  this,
                  currentAccountData
               );
               this.accounts.push(newAccount);
            } else {
               //track for saveAccounts
               this._NDAccounts.push(currentAccountData);
            }
         }
      }
   }

   /**
    * Clears the [accounts]{@link CypherPoker#accounts} array and any non-domain
    * (inactive) accounts currently in memory. This function does <i>not</i>
    * clear any user interface elements that contain account information.
    */
   clearAccounts() {
      this._accounts = new Array();
      this._NDAccounts = new Array();
   }

   /**
    * Saves the internal [accounts]{@link CypherPoker#accounts} array and
    * any non-domain accounts to the browser's <code>localStorage</code>.
    */
   saveAccounts() {
      var storage = window.localStorage;
      var saveArray = new Array();
      //include domain accounts
      for (var count = 0; count < this.accounts.length; count++) {
         saveArray.push(this.accounts[count].toObject(true));
      }
      //include non-domain accounts
      for (count = 0; count < this._NDAccounts.length; count++) {
         saveArray.push(this._NDAccounts[count]); //not CypherPokerAccount objects
      }
      storage.setItem("accounts", JSON.stringify(saveArray));
   }

   /**
    * Creates a new cryptocurrency account for use with games.
    *
    * @param {String} type The cryptocurrency type of the new account. Valid
    * values include: "bitcoin"
    * @param {String} password The password to associate with the account.
    * @param {String} [network=null] The network sub-type, if applicable, of
    * the cryptocurrency <code>type</code>. For example, if <code>type</code>
    * is "bitcoin" then <code>network</code> may be "main" or "test3".
    *
    * @return {Promise} The promise resolves with a new {@link CypherPokerAccount}
    * instance or rejects with an <code>Error</code> if a problem occurs.
    */
   async createAccount(type, password, network = null) {
      var account = new CypherPokerAccount(this);
      account.type = type;
      account.network = network;
      account.password = password;
      account.domains.push(this.settings.api.connectInfo.url);
      var created = await account.create();
      if (created) {
         this.accounts.push(account);
         this.debug("New account created:");
         this.debug(account, "dir");
         this.saveAccounts();
         return account;
      } else {
         throw new Error("Could not create account.");
      }
   }

   /**
    * Creates a new CypherPoker.JS table and optionally begins to advertise it on the
    * available peer-to-peer network. The table is automatically joined and added
    * to the [joinedTables]{@link CypherPoker#joinedTables} array.
    *
    * @param {String} tableName The name of the table to create.
    * @param {Number|Array} players If this is a number it specifies that ANY other players
    * up to this numeric limit may join the table. When this parameter is an array it's assumed
    * to be an indexed list of private IDs to allow to the table
    * (may also be a mix of wildcards / any PIDs: <code>["*", "*", "a4ec890...]</code>).
    * This value does <b>not</b> include self (i.e. only other players).
    * @param {String} [tableID=null] The unique (per peer), table ID to generate the table with.
    * Omitting this parameter or setting it to <code>null</code> causes an ID to be
    * automatically generated.
    * @param {Boolean} [activateBeacon=true] If true, an internal beacon is automatically
    * started at a [beaconInterval]{@link CypherPoker#beaconInterval} interval to advertise the table on the peer-to-peer
    * network. If false, use the [announceTable]{@link CypherPoker#announceTable} function to manually announce the
    * returned table.
    *
    * @return {CypherPoker#TableObject} A newly created CypherPoker.JS table as specified by
    * the parameters.
    */
   createTable(
      tableName,
      players,
      tableInfo = null,
      tableID = null,
      activateBeacon = true
   ) {
      if (typeof tableID == "string") {
         this.debug(
            'CypherPoker.createTable("' +
               tableName +
               '", ' +
               players +
               ", " +
               tableInfo +
               ', "' +
               tableID +
               '", ' +
               activateBeacon +
               ")"
         );
      } else {
         this.debug(
            'CypherPoker.createTable("' +
               tableName +
               '", ' +
               players +
               ", " +
               tableInfo +
               ", " +
               tableID +
               ", " +
               activateBeacon +
               ")"
         );
      }
      if (!this.p2pConnected) {
         throw new Error("Peer-to-peer network connection not established.");
      }
      var newTableObj = new Object();
      if (tableID != null) {
         newTableObj.tableID = tableID;
      } else {
         newTableObj.tableID = String(Math.random()).split(".")[1];
      }
      if (this["_joinedTables"] == undefined) {
         this._joinedTables = new Array();
      }
      newTableObj.tableName = tableName;
      newTableObj.ownerPID = this.p2p.privateID;
      newTableObj.requiredPID = new Array();
      newTableObj.joinedPID = new Array();
      newTableObj.joinedPID.push(this.p2p.privateID);
      newTableObj.restorePID = new Array();
      newTableObj.restorePID.push(this.p2p.privateID);
      if (typeof players == "number") {
         for (var count = 0; count < players; count++) {
            newTableObj.requiredPID.push("*");
            newTableObj.restorePID.push("*");
         }
      } else {
         newTableObj.requiredPID = Array.from(players);
         newTableObj.restorePID = Array.from(players);
      }
      if (tableInfo == null) {
         tableInfo = new Object();
      }
      tableInfo.currency = new Object();
      //dev
      //tableInfo.currency.type = ui.selectedAccount.type;
      tableInfo.currency.type = "bitcoin";
      // tableInfo.currency.network = ui.selectedAccount.network;

      tableInfo.currency.network = "test3";
      newTableObj.tableInfo = tableInfo;

      newTableObj.toString = function () {
         return "[object TableObject]";
      };
      this._joinedTables.push(newTableObj);
      this._openTables = true;
      if (activateBeacon) {
         newTableObj.beaconID = setInterval(
            this.announceTable,
            this.beaconInterval,
            newTableObj,
            this
         );
         this.announceTable(newTableObj); //send first announcement right away
      }
      return newTableObj;
   }

   /**
    * Removes a table from the [joinedTables]{@link CypherPoker#joinedTables} or
    * [announcedTables]{@link CypherPoker#announcedTables} array and stops any
    * announcement beacon associated with it if applicable.
    *
    * @param {CypherPoker#TableObject} tableObj The table to remove and, if applicable, stop
    * announcing.
    * @param {Boolean} [announced=false] If true, the referenced table is removed from the
    * {@link CypherPoker#announcedTables} array otherwise it's removed from the
    * [joinedTables]{@link CypherPoker#joinedTables} array.
    *
    * @return {Boolean} True if the table was successfully removed, false if no such table
    * could be found.
    */
   removeTable(tableObj, announced = false) {
      try {
         clearInterval(tableObj.beaconID);
      } catch (err) {}
      if (announced == false) {
         var removeArr = this._joinedTables;
      } else {
         removeArr = this._announcedTables;
      }
      for (var count = 0; count < removeArr.length; count++) {
         var currentTable = removeArr[count];
         if (
            currentTable.ownerPID == tableObj.ownerPID &&
            currentTable.tableID == tableObj.tableID &&
            currentTable.tableName == tableObj.tableName
         ) {
            removeArr.splice(count, 1);
            return true;
         }
      }
      return false;
   }

   /**
    * Removes all tables from the [joinedTables]{@link CypherPoker#joinedTables} and
    * [announcedTables]{@link CypherPoker#announcedTables} arrays. Any table announcements or join
    * requests currently in progress are cancelled.
    *
    * @param {Boolean} [joined=true] If true, all tables in the [joinedTables]{@link CypherPoker#joinedTables}
    * array should be removed.
    * @param {Boolean} [announced=true] If true, all tables in the [announcedTables]{@link CypherPoker#announcedTables}
    * array should be removed.
    */
   removeAllTables(joined = true, announced = true) {
      if (joined) {
         if (this._joinedTables == undefined) {
            this._joinedTables = new Array();
         }
         while (this._joinedTables.length > 0) {
            this.removeTable(this._joinedTables[0], false);
         }
         this._joinedTables = new Array();
      }
      if (announced) {
         if (this._announcedTables == undefined) {
            this._announcedTables = new Array();
         }
         while (this._announcedTables.length > 0) {
            this.removeTable(this._announcedTables[0], true);
         }
         this._announcedTables = new Array();
      }
   }

   /**
    * Announces a table on the currently connected peer-to-peer network. If an
    * associated beacon timer is found, it is automatically stopped when
    * the <code>requiredPID</code> list of the table is empty.
    *
    * @param {CypherPoker#TableObject} tableObj The table to announce. If the table's
    * <code>requiredPID</code> array is empty, the request is rejected.
    * @param {CypherPoker} [context=null] The CypherPoker instance to execute the function
    * in (typically specified as part of a timer). If <code>null</code>, the current
    * <code>this</code> context is assumed.
    */
   announceTable(tableObj, context = null) {
      if (context == null) {
         context = this;
      }
      if (tableObj.requiredPID.length == 0) {
         try {
            clearInterval(tableObj.beaconID);
         } catch (err) {
         } finally {
            return;
         }
      }
      context.debug("CypherPoker.announceTable(" + tableObj + ")");
      var announceObj = context.buildCPMessage("tablenew");
      context.copyTable(tableObj, announceObj);
      context.p2p.broadcast(announceObj);
   }

   /**
    * Checks whether the supplied argument is a valid CypherPoker.JS table object.
    *
    * @param {TableObject} [tableObj=null] The object to examine.
    *
    * @return {Boolean} True if the supplied object appears to be a valid [TableObject]{@link CypherPoker#TableObject}
    * suitable for use with CypherPoker.JS
    */
   isTableValid(tableObj = null) {
      if (tableObj == null) {
         return false;
      }
      if (
         tableObj["ownerPID"] == undefined ||
         tableObj["ownerPID"] == null ||
         tableObj["ownerPID"] == ""
      ) {
         return false;
      }
      if (
         tableObj["tableID"] == undefined ||
         tableObj["tableID"] == null ||
         tableObj["tableID"] == ""
      ) {
         return false;
      }
      //table name can be an empty string:
      if (tableObj["tableName"] == undefined || tableObj["tableName"] == null) {
         return false;
      }
      //don't compare an array to an empty string since this will return true (array's toString is used)
      if (
         tableObj["requiredPID"] == undefined ||
         tableObj["requiredPID"] == null
      ) {
         return false;
      }
      if (typeof tableObj.requiredPID.length != "number") {
         return false;
      }
      if (tableObj["joinedPID"] == undefined || tableObj["joinedPID"] == null) {
         return false;
      }
      if (typeof tableObj.joinedPID.length != "number") {
         return false;
      }
      if (
         tableObj["restorePID"] == undefined ||
         tableObj["restorePID"] == null
      ) {
         return false;
      }
      if (typeof tableObj.restorePID.length != "number") {
         return false;
      }
      if (
         tableObj["tableInfo"] == undefined ||
         tableObj["tableInfo"] == null ||
         tableObj["tableInfo"] == ""
      ) {
         return false;
      }
      return true;
   }

   /**
    * Evaluates whether a table is ready or not. A table is considered
    * ready if it is a valid [TableObject]{@link CypherPoker#TableObject}, has one or more joined private
    * IDs and no required private IDs.
    *
    * @param {TableObject} tableObj The table to evaluate.
    *
    * @return {Boolean} True if the table is ready.
    */
   isTableReady(tableObj) {
      if (this.isTableValid(tableObj) == false) {
         return false;
      }
      if (tableObj.requiredPID.length == 0 && tableObj.joinedPID.length > 0) {
         return true;
      }
      return false;
   }

   /**
    * Requests to join another owner's table.
    *
    * @property {CypherPoker#TableObject} A CypherPoker.JS table (object) to request to join.
    * @property {Number} [replyTimeout=20000] A time, in milliseconds, to wait for the reply
    * before considering the request as having timed out.
    *
    * @return {Promise} The promise will be resolved if the table was successfully
    * joined otherwise it will be rejected.
    * @throws {Error} A standard Error is thrown if peer to peer networking hasn't been
    * successfully negotiated.
    *
    */
   joinTable(tableObj = null, replyTimeout = 20000) {
      this.debug(
         "CypherPoker.joinTable(" + tableObj + ", " + replyTimeout + ")"
      );
      var promise = new Promise((resolve, reject) => {
         if (!this.p2pConnected) {
            throw new Error("Peer-to-peer network connection not established.");
         }
         if (!this.isTableValid(tableObj)) {
            this.debug("Not a valid table object.", "err");
            reject(null);
            return;
         }
         var slotAvailable = false;
         for (var count = 0; count < tableObj.requiredPID.length; count++) {
            var requiredPID = tableObj.requiredPID[count];
            if (requiredPID == "*" || requiredPID == this.p2p.privateID) {
               //we're not allowed to join this table
               slotAvailable = true;
            }
         }
         if (!slotAvailable) {
            this.debug("Not allowed to join group.", "err");
            reject(null);
            return;
         }
         if (this._joinTableRequests == undefined) {
            this._joinTableRequests = new Array();
         }
         for (count = 0; count < this._joinTableRequests.length; count++) {
            var currentRequestTable = this._joinTableRequests[count];
            if (
               currentRequestTable[count].ownerPID == tableObj.ownerPID &&
               currentRequestTable[count].tableID == tableObj.tableID
            ) {
               //already a join request active
               reject(null);
               return;
            }
         }
         tableObj.toString = function () {
            return "[object CypherPoker#TableObject]";
         };
         tableObj._resolve = resolve;
         tableObj._reject = reject;
         this._joinTableRequests.push(tableObj);
         this.sendJoinTableRequest(tableObj);
      });
      return promise;
   }

   /**
    * Sends a message to the joined peers of a table.
    *
    * @param {CypherPoker#TableObject} tableObj The table to send the message to.
    * @param {*} message The message to send. Cannot be null or undefined.
    *
    * @return {Boolean} True if the message was delivered to the peer-to-peer networking
    * interface, false if there was a problem processing the parameters.
    */
   sendToTable(tableObj, message) {
      if (typeof message == "string") {
         this.debug(
            "CypherPoker.sendToTable(" + tableObj + ', "' + message + '")'
         );
      } else {
         this.debug(
            "CypherPoker.sendToTable(" + tableObj + ", " + message + ")"
         );
      }
      if (!this.p2pConnected) {
         throw new Error("Peer-to-peer network connection not established.");
      }
      if (!this.isTableValid(tableObj)) {
         this.debug("Not a valid table object.", "err");
         return false;
      }
      if (message == null || message == undefined) {
         this.debug("No message to send to table.", "err");
         return false;
      }
      var tablePIDs = this.createTablePIDList(tableObj.joinedPID, false);
      var tableMessageObj = this.buildCPMessage("tablemsg");
      tableMessageObj.message = message;
      tableMessageObj.tableName = tableObj.tableName;
      tableMessageObj.tableID = tableObj.tableID;
      tableMessageObj.ownerPID = tableObj.ownerPID;
      this.p2p.send(tableMessageObj, tablePIDs);
      return true;
   }

   /**
    * Sends a "tablejoinrequest" message to a table's owner.
    *
    * @param {CypherPoker#TableObject} tableObj The table of the owner to send a join request to.
    * @property {Number} [replyTimeout=25000] A time, in milliseconds, to wait for the reply
    * before considering the request as having timed out.
    * @async
    * @private
    */
   async sendJoinTableRequest(tableObj, replyTimeout = 20000) {
      this.debug("CypherPoker.sendJoinTableRequest(" + tableObj + ")");
      var joinRequestObj = this.buildCPMessage("tablejoinrequest");
      this.copyTable(tableObj, joinRequestObj);
      try {
         //should these be checked individually?
         var quickConnect = this.settings.p2p.transports.quickConnect;
         var preferredTransport = this.settings.p2p.transports.preferred[0];
      } catch (err) {
         quickConnect = true;
         preferredTransport = "wss";
      }
      try {
         if (quickConnect == true) {
            //non-blocking connection attempt
            this.p2p
               .connectPeer(tableObj.ownerPID, preferredTransport)
               .catch((err) => {
                  console.warn(err);
               });
         } else {
            //blocking connection attempt
            var result = await this.p2p.connectPeer(
               tableObj.ownerPID,
               preferredTransport
            );
         }
      } catch (err) {
         console.error(err);
      }
      //connected successfully on required or "any" transport
      this.p2p.send(joinRequestObj, [tableObj.ownerPID]);
      tableObj.joinTimeoutID = setTimeout(
         this.onJoinTableRequestTimeout,
         replyTimeout,
         tableObj,
         this
      );
      return true;
   }

   /**
    * Responds to a timeout on a "tablejoinrequest" message, removing the
    * table from the <code>_joinTableRequests</code> array.
    *
    * @param {CypherPoker#TableObject} tableObj The table reference for which a
    * @param {CypherPoker} context The CypherPoker instance to execute the function
    * in as specified in the calling timer.
    * @fires CypherPoker#tablejointimeout
    * @private
    */
   onJoinTableRequestTimeout(tableObj, context) {
      context.debug("CypherPoker.onJoinTableRequestTimeout(" + tableObj + ")");
      var requestsArray = context._joinTableRequests;
      for (var count = 0; count < requestsArray.length; count++) {
         var requestObj = requestsArray[count];
         if (
            tableObj.tableID == requestObj.tableID &&
            tableObj.tableName == requestObj.tableName &&
            tableObj.ownerPID == requestObj.ownerPID
         ) {
            requestsArray.splice(count, 1);
            var event = new Event("tablejointimeout");
            event.table = requestObj;
            context.dispatchEvent(event);
            requestObj._reject(null);
            return;
         }
      }
   }

   /**
    * Leaves a table that was joined. This table must be tracked internally
    * by this instance as having been joined.
    *
    * @param {CypherPoker#TableObject} tableObj The table to leave.
    *
    * @return {Boolean} True if the leave notification was delievered to the
    * peer-to-peer networking interface, false if there was a problem
    * verifying the parameter.
    */
   leaveJoinedTable(tableObj) {
      this.debug("CypherPoker.leaveJoinedTable(" + tableObj + ")");
      if (!this.p2pConnected) {
         throw new Error("Peer-to-peer network connection not established.");
      }
      if (!this.isTableValid(tableObj)) {
         this.debug("Not a valid table object.", "err");
         return false;
      }
      if (this["_joinedTables"] == undefined) {
         this._joinedTables = new Array();
         return false;
      }
      var joined = false;
      for (var count = 0; count < this._joinedTables.length; count++) {
         var currentTable = this._joinedTables[count];
         if (
            currentTable.tableID == tableObj.tableID &&
            currentTable.tableName == tableObj.tableName &&
            currentTable.ownerPID == tableObj.ownerPID
         ) {
            this.removeTable(tableObj, false);
            joined = true;
            break;
         }
      }
      if (joined == false) {
         return false;
      }
      var leaveNotificationObj = this.buildCPMessage("tableleave");
      this.copyTable(tableObj, leaveNotificationObj);
      var tablePIDs = this.createTablePIDList(tableObj.joinedPID);
      this.p2p.send(leaveNotificationObj, tablePIDs);
      return true;
   }

   /**
    * Retrieves a list of tables we've joined using at least one of three search criteria.
    *
    * @param {String} [tableName=null] The name of the table(s) to search for. If null,
    * this parameter is ignored.
    * @param {String} [tableID=null] The ID of the table(s) to search for. If null,
    * this parameter is ignored.
    * @param {String} [ownerPID=null] The private ID of the table(s)' owner to search for. If null,
    * this parameter is ignored.
    *
    * @return {Array} A list of tables currently joined that matches one or more of the
    * search criteria specified in the parameters. If all parameters are null, the whole
    * list of joined tables is returned (same as [joinedTables]{@link CypherPoker#joinedTables}).
    */
   getJoinedTables(tableName = null, tableID = null, ownerPID = null) {
      var returedTables = new Array();
      if (this["_joinedTables"] == undefined) {
         this._joinedTables = new Array();
         return returedTables;
      }
      if (tableName == null && tableID == null && ownerPID == null) {
         return Array.from(this._joinedTables);
      }
      var hits = 0;
      for (var count = 0; count < this._joinedTables.length; count++) {
         if (tableName != null) {
            if (this._joinedTables[count].tableName == tableName) {
               hits++;
            } else {
               hits -= 10;
            }
         }
         if (tableID != null) {
            if (this._joinedTables[count].tableID == tableID) {
               hits++;
            } else {
               hits -= 10;
            }
         }
         if (ownerPID != null) {
            if (this._joinedTables[count].ownerPID) {
               hits++;
            } else {
               hits -= 10;
            }
         }
         if (hits > 0) {
            returedTables.push(this._joinedTables[count]);
         }
         hits = 0;
      }
      return returedTables;
   }

   /**
    * Copies the core properties of a source table object to another object. The
    * target object will be identifiable as a [TableObject]{@link CypherPoker#TableObject} after
    * the copy.
    *
    * @param {TableObject} sourceTable The table from which to copy from.
    * @param {Object} targetObject The target object to copy the core properties
    * of <code>sourceTable</code> to.
    */
   copyTable(sourceTable, targetObject) {
      targetObject.tableName = sourceTable.tableName;
      targetObject.tableID = sourceTable.tableID;
      targetObject.ownerPID = sourceTable.ownerPID;
      targetObject.requiredPID = sourceTable.requiredPID;
      targetObject.joinedPID = sourceTable.joinedPID;
      targetObject.restorePID = sourceTable.restorePID;
      targetObject.tableInfo = sourceTable.tableInfo;
      targetObject.toString = function () {
         return "[object CypherPoker#TableObject]";
      };
   }

   /**
    * Creates a copy of a list of private IDs, omitting the self (<code>this.p2p.privateID</code>).
    *
    * @param {Array} PIDList An array of private IDs to create the return list from.
    *
    * @return {Array} A copy of <code>PIDList</code> excluding the self.
    * @private
    */
   createTablePIDList(PIDList) {
      var returnList = new Array();
      for (var count = 0; count < PIDList.length; count++) {
         if (PIDList[count] != this.p2p.privateID) {
            returnList.push(PIDList[count]);
         }
      }
      return returnList;
   }

   /**
    * Restores a private ID to a table's {@link TableObject#requiredPID} array for
    * a player that has left. This function does <b>not</b> update either the
    * {@link TableObject#joinedPID} or {@link TableObject#restorePID} arrays of the
    * table object.
    *
    * @param {String} privateID The private ID of the player that has left the table.
    * @param {TableObject} tableObj The table from which the player has left.
    *
    * @private
    */
   restoredRequiredPID(privateID, tableObj) {
      var restoredPID = null;
      var restoreIndex = -1;
      var wildcardExists = false;
      for (var count = 0; count < tableObj.restorePID.length; count++) {
         if (tableObj.restorePID[count] == "*") {
            wildcardExists = true; //at least one wildcard is present
         }
         if (tableObj.restorePID[count] == privateID) {
            restoredPID = privateID;
            restoreIndex = count;
            break;
         }
      }
      if (restoredPID == null && wildcardExists == true) {
         //specified PID doesn't exist so it must be a wildcard
         restoredPID = "*";
      }
      if (restoredPID == null && wildcardExists != true) {
         //trying to restore a PID that doesn't belong to this table!
         return;
      }
      if (restoreIndex < 0) {
         //no target index so just add at the end
         tableObj.requiredPID.push(restoredPID);
         return;
      }
      var requiredPID = new Array();
      var rPIDs = Array.from(tableObj.requiredPID);
      for (var count = 0; count < rPIDs.length; count++) {
         if (restoreIndex == count) {
            requiredPID.push(privateID); //add restored PID at original index
            requiredPID.push(rPIDs[count]); //current PID at this index follows
         } else {
            requiredPID.push(rPIDs[count]);
         }
      }
      tableObj.requiredPID = Array.from(rPIDs);
   }

   /**
    * Dispatches a "tableready" event when the associated table is considered
    * ready (see: [isTableReady]{@link CypherPoker#isTableReady}).
    *
    * @param {TableObject} tableObj The table to evaluate and include with the
    * the event if ready.
    *
    * @return {Boolean} True if the table is ready and the event was dispatched.
    * @fires CypherPoker#tableready
    * @private
    */
   dispatchTableReadyEvent(tableObj) {
      if (this.isTableReady(tableObj)) {
         var event = new Event("tableready");
         event.table = tableObj;
         this.dispatchEvent(event);
         return true;
      }
      return false;
   }

   /**
    * Returns or clears an arbitrary <i>local-only</i> data storage object associated with a
    * specific table. The returned storage object can be used to store data
    * related to the table that shouldn't, or can't, be included in the actual
    * table object, within peer-to-peer communications, or in API calls (unless
    * explicitly copied).
    *
    * @param {TableObject} tableObj The table object for which to retrieve the
    * data object.
    * @param {Boolean} [useLS=false] If true, the <code>localStorage</code> object
    * will be used to provide more permanent storage that is maintained between sessions.
    * @param {Boolean} [clear=false] If true, the data associated with the table
    * object is cleared.
    *
    * @returns {Object} A local data storage object associated with the specified table.
    * If one doesn't exist, an empty one is created. If <code>clear=true</code>,
    * <code>null</code> is returned.
    */
   localTableStorage(tableObj, clear = false) {
      if (this._LTS == undefined) {
         this._LTS = new Array();
      }
      for (var count = 0; count < this._LTS.length; count++) {
         var storageObj = this._LTS[count];
         if (
            storageObj.tableID == tableObj.tableID &&
            storageObj.tableName == tableObj.tableName &&
            storageObj.ownerPID == tableObj.ownerPID
         ) {
            if (clear) {
               this._LTS.splice(count, 1);
               return null;
            } else {
               return storageObj.data;
            }
         }
      }
      storageObj = new Object();
      storageObj.tableID = tableObj.tableID;
      storageObj.tableName = tableObj.tableName;
      storageObj.ownerPID = tableObj.ownerPID;
      storageObj.data = new Object();
      this._LTS.push(storageObj);
      return storageObj.data;
   }

   /**
    * Attempts to create a new {@link CypherPokerGame} instance from a table object.
    * All required private IDs must already have joined the table prior to calling
    * this function.
    *
    * @param {CypherPoker#TableObject} tableObj The table from which to create a new game.
    * @param {CypherPokerAccount} account The player account to use with this game.
    * @param {Object} [playerInfo=null] Additional information about us to send
    * to other players at the table when they signal that their game is ready.
    *
    * @return {CypherPokerGame} A new game instance associated with the table
    * or <code>null</code> if one couldn't be created.
    * @fires CypherPoker#newgame
    */
   createGame(tableObj, account, playerInfo = null) {
      console.dir(account);
      this.debug("CypherPoker.createGame(" + tableObj + ")");
      if (this.isTableValid(tableObj) == false) {
         throw new Error("Not a valid table object.");
      }
      if (tableObj.requiredPID.length > 0) {
         throw new Error("All required PIDs not yet joined.");
      }
      console.log(
         "Creating new game from table&&&&&&&&&&&&&&&&&&&&&&&&&: " +
            JSON.stringify(playerInfo)
      );
      var newGame = new CypherPokerGame(this, tableObj, playerInfo);
      console.log("New game account&&&&&&&&&&&&&&&&&&&&&&&&&:: " + account);
      console.dir(account);
      newGame.getPlayer(newGame.ownPID).account = account;
      var event = new Event("newgame");
      event.game = newGame;
      this.dispatchEvent(event);
      return newGame;
   }

   /**
    * Removes and optionally destroys a game instance from the internal
    * [games]{@link CypherPoker#games} array.
    *
    * @param {CypherPokerGame} gameRef A reference the tracked game instance to remove.
    * @param {Boolean} [destroy=true] If true, the instance's [destroy]{@link CypherPokerGame#destroy}
    * function is invoked prior to removal.
    */
   removeGame(gameRef, destroy = true) {
      for (var count = 0; count < this._games.length; count++) {
         if (this._games[count] == gameRef) {
            if (destroy) {
               this._games[count].destroy();
            }
            this._games[count].splice(count, 1);
            return;
         }
      }
   }

   /**
    * Removes and optionally destroys all game instances in the internal
    * [games]{@link CypherPoker#games} array.
    *
    * @param {Boolean} [destroy=true] If true, each instance's [destroy]{@link CypherPokerGame#destroy}
    * function is invoked prior to removal.
    */
   removeAllGames(destroy = true) {
      if (destroy) {
         for (var count = 0; count < this._games.length; count++) {
            this._games[count].destroy();
         }
      }
      this._games = new Array();
   }

   /**
    * Handles a peer-to-peer message event dispatched by the communication
    * interface.
    *
    * @param {Event} event A "message" event dispatched by the communication interface.
    * A <code>data</code> property is expected to contain the parsed JSON-RPC 2.0
    * message received.
    * @fires CypherPoker#tablenew
    * @fires CypherPoker#tablejoinrequest
    * @fires CypherPoker#tablejoin
    * @fires CypherPoker#tableready
    * @fires CypherPoker#tablemsg
    * @fires CypherPoker#tableleave
    * @private
    */
   handleP2PMessage(event) {
      if (this.isCPMsgEvent(event) == false) {
         //don't process any further
         return;
      }
      var message = event.data.result.data;
      var messageType = message.cpMsg;
      var ownEvent = new Event(messageType);
      ownEvent.data = event.data;
      this.debug(
         "CypherPoker.handleP2PMessage(" + event + ') => "' + messageType + '"'
      );
      switch (messageType) {
         case "tablenew":
            if (this.captureNewTables) {
               if (this.captureTable(event.data.result)) {
                  this.dispatchEvent(ownEvent);
               }
            }
            break;
         case "tablejoinrequest":
            if (!this.openTables) {
               return;
            }
            this._openTables = false;
            var joined = false; //use flag to prevent multiple adds while evaluating all tables
            for (var count = 0; count < this._joinedTables.length; count++) {
               var currentTable = this._joinedTables[count];
               if (
                  currentTable.ownerPID == this.p2p.privateID &&
                  joined == false
               ) {
                  if (
                     currentTable.tableID == message.tableID &&
                     currentTable.tableName == message.tableName
                  ) {
                     for (
                        var count2 = 0;
                        count2 < currentTable.requiredPID.length;
                        count2++
                     ) {
                        var requiredPID = currentTable.requiredPID[count2];
                        if (
                           (requiredPID == event.data.result.from ||
                              requiredPID == "*") &&
                           joined == false
                        ) {
                           currentTable.requiredPID.splice(count2, 1);
                           currentTable.joinedPID.push(event.data.result.from);
                           var joinResponse = this.buildCPMessage("tablejoin");
                           //changed format in v0.4.1
                           joinResponse.table = new Object();
                           joinResponse.joined = event.data.result.from;
                           this.copyTable(currentTable, joinResponse.table);
                           this.p2p.send(
                              joinResponse,
                              this.createTablePIDList(
                                 currentTable.joinedPID,
                                 false
                              )
                           );
                           ownEvent.joined = event.data.result.from;
                           ownEvent.table = currentTable;
                           this.dispatchEvent(ownEvent);
                           this.dispatchTableReadyEvent(currentTable);
                           joined = true;
                        }
                     }
                  }
               }
               if (currentTable.requiredPID.length > 0) {
                  this._openTables = true;
               }
            }
            break;
         case "tablejoin":
            //message structure changed in v0.4.1
            var joinedPID = message.joined;
            var newTable = new Object();
            if (this._joinedTables == undefined || this._joinedTables == null) {
               this._joinedTables = new Array();
            }
            this.copyTable(message.table, newTable);
            for (count = 0; count < this._joinedTables.length; count++) {
               currentTable = this._joinedTables[count];
               if (
                  currentTable.tableID == message.table.tableID &&
                  currentTable.tableName == message.table.tableName
               ) {
                  //someone else has joined the owner's table
                  this._joinedTables[count] = newTable;
                  newTable.toString = function () {
                     return "[object CypherPoker#TableObject]";
                  };
                  ownEvent.table = newTable;
                  try {
                     //should these be checked individually?
                     var quickConnect =
                        this.settings.p2p.transports.quickConnect;
                     var preferredTransport =
                        this.settings.p2p.transports.preferred[0];
                  } catch (err) {
                     quickConnect = true;
                     preferredTransport = "wss";
                  }
                  this.p2p
                     .connectPeer(joinedPID, preferredTransport)
                     .then((result) => {
                        if (quickConnect == false) {
                           this.dispatchEvent(ownEvent);
                           this.dispatchTableReadyEvent(newTable);
                        }
                     })
                     .catch((err) => {
                        //probably doesn't support requested transport -- automatically using fallback (probably WebSocket Sessions)
                        console.warn(err);
                        this.dispatchEvent(ownEvent);
                        this.dispatchTableReadyEvent(newTable);
                     });
                  if (quickConnect == true) {
                     this.dispatchEvent(ownEvent);
                     this.dispatchTableReadyEvent(newTable);
                  }
                  return;
               }
            }
            for (
               var count = 0;
               count < this._joinTableRequests.length;
               count++
            ) {
               var requestObj = this._joinTableRequests[count];
               if (
                  requestObj.ownerPID == event.data.result.from &&
                  requestObj.tableID == message.table.tableID &&
                  requestObj.tableName == message.table.tableName
               ) {
                  //we've just joined the owner's table
                  this._joinTableRequests.splice(count, 1);
                  clearTimeout(requestObj.joinTimeoutID);
                  delete requestObj.joinTimeoutID;
                  newTable.toString = function () {
                     return "[object CypherPoker#TableObject]";
                  };
                  this._joinedTables.push(newTable);
                  ownEvent.table = newTable;
                  this.dispatchEvent(ownEvent);
                  requestObj._resolve(event);
                  this.dispatchTableReadyEvent(newTable);
                  return;
               }
            }
            break;
         case "tablemsg":
            this.debug("\nFrom: " + event.data.result.from);
            this.debug(
               "Table name / ID: " +
                  event.data.result.data.tableName +
                  " / " +
                  event.data.result.data.tableID
            );
            this.debug("Message: " + event.data.result.data.message);
            this.dispatchEvent(ownEvent);
            break;
         case "tableleave":
            var newTable = new Object();
            if (this._joinedTables == undefined || this._joinedTables == null) {
               this._joinedTables = new Array();
            }
            this.copyTable(message, newTable);
            for (count = 0; count < this._joinedTables.length; count++) {
               currentTable = this._joinedTables[count];
               if (
                  currentTable.tableID == message.tableID &&
                  currentTable.tableName == message.tableName
               ) {
                  if (currentTable.ownerPID == event.data.result.from) {
                     //table owner/creator is leaving; table is no longer valid
                     ownEvent.table = null;
                     this._joinedTables.splice(count, 1);
                     this.dispatchEvent(ownEvent);
                  }
                  for (
                     var count2 = 0;
                     count2 < currentTable.joinedPID.length;
                     count2++
                  ) {
                     if (
                        currentTable.joinedPID[count2] == event.data.result.from
                     ) {
                        var leavingPID = currentTable.joinedPID.splice(
                           count2,
                           1
                        );
                        this.restoredRequiredPID(leavingPID, currentTable);
                        ownEvent.table = currentTable;
                        this.dispatchEvent(ownEvent);
                        return;
                     }
                  }
               }
            }
            break;
         default:
            //not a recognized CypherPoker.JS message type
            break;
      }
   }

   /**
    * Captures a new table announcement to the [announcedTables]{@link CypherPoker#announcedTables} array if
    * the table is unique and falls within the peer limit [maxCapturesPerPeer]{@link CypherPoker#maxCapturesPerPeer}.
    * When the [announcedTables]{@link CypherPoker#announcedTables} array reaches the
    * [maxCapturedTables]{@link CypherPoker#maxCapturedTables} limit, the last table is
    * <code>pop</code>ped off of the end of the array and the new table is <code>unshift</code>ed into it.
    * In this way the table announcements are always in chronological order of receipt with the smallest index being
    * the newest.
    *
    * @param {Object} tableResult A JSON-RPC 2.0 <code>result</code> object containing
    * a valid [TableObject]{@link CypherPoker#TableObject} in its <code>data</code> property.
    * @return {Boolean} True if the table was succesfully captured, false if it was
    * out of limit(s) or otherwise unqualified.
    * @private
    */
   captureTable(tableResult) {
      if (this._announcedTables == undefined) {
         this._announcedTables = new Array();
      }
      if (this.isTableValid(tableResult.data) == false) {
         return false;
      }
      var numTables = 0;
      for (var count = 0; count < this._announcedTables.length; count++) {
         if (this._announcedTables[count].ownerPID == tableResult.from) {
            numTables++;
            if (
               this._announcedTables[count].tableID == tableResult.data.tableID
            ) {
               //table previously announced by this peer
               var now = new Date();
               this._announcedTables[count].tableInfo.announcedAt =
                  now.toISOString(); //update announcement timestamp
               return false;
            }
            if (numTables > this.maxCapturesPerPeer) {
               //too many table announcements from this peer
               return false;
            }
         }
      }
      var newTable = new Object();
      this.copyTable(tableResult.data, newTable);
      newTable.toString = function () {
         return "[object CypherPoker#TableObject]";
      };
      now = new Date();
      this.debug(
         "CypherPoker.captureTable(" + newTable + ") @ " + now.toTimeString()
      );
      newTable.ownerPID = tableResult.from; //make sure only owner can announce their own table
      newTable.tableInfo.announcedAt = now.toISOString(); //set announcement timestamp
      this._announcedTables.unshift(tableResult.data); //add table to the beginning of array
      if (this._announcedTables.length > this.maxCapturedTables) {
         this._announcedTables.pop(); //remove the last table from end of array
      }
      return true;
   }

   /**
    * Creates a CypherPoker.JS table message. Since the format of this message
    * may change, this is the preferred way to create a message rather than
    * creating your own object.
    *
    * @param {String} messageType The CypherPoker.JS table message type to create.
    *
    * @return {Object} A formatted CypherPoker.JS table message. Additional data
    * can be appended to this object before sending it over a peer-to-peer network.
    * @private
    */
   buildCPMessage(messageType) {
      var messageObj = new Object();
      messageObj.cpMsg = messageType;
      return messageObj;
   }

   /**
    * Verifies if a supplied object is a valid CypherPoker.JS message.
    *
    * @param {Object} message The object to examine.
    *
    * @return {Boolean} True if the object seems to be a valid CypherPoker.JS message
    * (though it may not be supported).
    * @private
    */
   isCPMessage(message) {
      if (
         message["cpMsg"] == undefined ||
         message["cpMsg"] == null ||
         message["cpMsg"] == ""
      ) {
         //not a CypherPoker.JS message or it's blank (mo message type)
         return false;
      }
      return true;
   }

   /**
    * Verifies if a supplied message event object contains a valid CypherPoker.JS message.
    *
    * @param {Event} event The "message" event, as usually dispatched by the
    * peer-to-peer interface, to examine.
    *
    * @return {Boolean} True if the event contains a valid CypherPoker.JS message
    * (though its type may not be supported).
    * @private
    */
   isCPMsgEvent(event) {
      try {
         if (typeof event["data"] != "object") {
            //not sure what this is
            return false;
         }
         if (typeof event.data["result"] != "object") {
            //may not be a JSON-RPC message
            return false;
         }
         if (typeof event.data.result["data"] != "object") {
            //not a CypherPoker-formatted message
            return false;
         }
         return this.isCPMessage(event.data.result.data);
      } catch (err) {
         return false;
      }
   }

   /**
    * @private
    */
   toString() {
      return "[object CypherPoker]";
   }
}
