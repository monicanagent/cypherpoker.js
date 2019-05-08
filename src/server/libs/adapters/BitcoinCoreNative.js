/**
* @file Native Bitcoin (bitcoind) Core adapter for blockchain interactions such as balance retrieval and
* transaction posting.
*
* @version 0.5.0
* @author Patrick Bay
* @copyright MIT License
*/

const CryptocurrencyHandler = require("../CryptocurrencyHandler");
const BTCClient = require('bitcoin-core');
const path = require("path");

/**
* @class Bitcoin Core native adapter (bitcoind) for blockchain interactions.
* @extends EventEmitter
*/
module.exports = class BitcoinCoreNative extends CryptocurrencyHandler {

   /**
   * Creates a new instance of the native Bitcoin Core adapter.
   *
   * @param {Object} serverRef A reference to the server-exposed objects made available
   * to this class.
   * @param {Object} handlerConfig The configuration data for the handler instance, usually
   * a child object of the global application config.
   */
   constructor(serverRef, handlerConfig) {
      super(serverRef, handlerConfig);
   }

   /**
   * @property {Object} downloadRootURL="https://bitcoin.org/bin/" The root download path for the bitcoind
   * client binary.
   * @readonly
   */
   get downloadRootURL() {
      return ("https://bitcoin.org/bin/");
   }

   /**
   * @property {String} installDir=null The installation directory for the native client. Typically
   * this is set via the global config but may be set locally.
   */
   get installDir () {
      if (this._installDir == undefined) {
         this._installDir = null;
      }
      return (this._installDir);
   }

   set installDir(idSet) {
      this._installDir = idSet;
   }

   /**
   * @property {Object} RPCOptions RPC options to use with the native client binary / executable
   * such as a username, password, allowed IPs, etc.
   */
   get RPCOptions() {
      return ({
         username: "rpclocaluser",
         password: "Rpcl0c@lu$3rpaSs",
         allowIP: "127.0.0.1"
      })
   }

   /**
   * Returns an initialized reference to the native Bitcoin client RPC library instance used to communicate
   * with the running executable / binary.
   *
   * @param {String} [network="main"] The network for which the client is configured. Valid networks
   * include "main" and "test3".
   *
   * @readonly
   */
   nativeRPC(network="main") {
      if (this._clients == undefined) {
         this._clients = new Object();
      }
      if (this._clients[network] == undefined) {
         switch (network) {
            case "main":
               this._clients[network] = new BTCClient({
                 network: "mainnet",
                 username: this.RPCOptions.username,
                 password: this.RPCOptions.password,
                 port: 8332
               });
               break;
            case "test3":
               this._clients[network] = new BTCClient({
                 network: "testnet",
                 username: this.RPCOptions.username,
                 password: this.RPCOptions.password,
                 port: 18332
               });
               break;
            default:
               throw (new Error("Unsupported network \""+network+"\"."));
               break;
         }
      }
      return (this._clients[network]);
   }

   /**
   * Returns an object containing references to native processes managed by
   * this instance.
   *
   * @return {Object} A generic object storing references to native child
   * processes managed by this instance. Typically these will be stored under
   * "main" and "test3" properties but other names and aliases may also be used.
   */
   nativeProcess() {
      if (this._nativeProcess == undefined) {
         this._nativeProcess = new Object();
      }
      return (this._nativeProcess);
   }

   /**
   * Initializes the instance by checking dependencies, downloading any
   * missing component, and starting the native client. Note that the client
   * process requires a few moments before the RPC connection accessible via
   * [nativeRPC]{@link BitcoinCoreNative#nativeRPC} becomes available.
   *
   * @return {Boolean} True if the initialization could be succesfully completed,
   * false otherwise.
   *
   * @async
   */
   async initialize() {
      var installDirectory = this.handlerConfig.installDir;
      var dataDirectory = path.resolve(this.handlerConfig.dataDir);
      switch (process.platform) {
         case "linux":
            //process.arch == ia32 (for 32-bit Linux)
            installDirectory = installDirectory.split("%os%").join("linux");
            var binFiles = ["bitcoind"];
            break;
         case "win32":
            installDirectory = installDirectory.split("%os%").join("win");
            binFiles = ["bitcoind.exe"];
            break;
         case "darwin":
            installDirectory = installDirectory.split("%os%").join("macOS");
            binFiles = ["bitcoind"];
            break;
         default:
            throw (new Error("Unsupported platform: "+process.platform));
            break;
      }
      var result = await this.checkInstall(binFiles, installDirectory, true);
      if (result == false) {
         return (false);
      }
      var mainParameters = new Array();
      mainParameters.push("-server");
      mainParameters.push("-rpcport=8332"); // default
      mainParameters.push("-rpcallowip="+this.RPCOptions.allowIP);
      mainParameters.push("-rpcbind=127.0.0.1");
      mainParameters.push("-rpcuser="+this.RPCOptions.username);
      mainParameters.push("-rpcpassword="+this.RPCOptions.password);
      mainParameters.push("-datadir="+dataDirectory);
      this.nativeProcess["main"] = this.startNativeClient(binFiles[0], mainParameters, installDirectory);
      this.nativeProcess["main"].stdout.on('data', this.onClientSTDOUT.bind(this, "main"));
      this.nativeProcess["main"].stderr.on('data', this.onClientSTDERR.bind(this, "main"));
      this.nativeProcess["main"].on('close', this.onProcessClose.bind(this, "main"));
      var testParameters = new Array();
      testParameters.push("-server");
      testParameters.push("-testnet");
      testParameters.push("-rpcport=18332"); // default
      testParameters.push("-rpcallowip="+this.RPCOptions.allowIP);
      testParameters.push("-rpcbind=127.0.0.1");
      testParameters.push("-rpcuser="+this.RPCOptions.username);
      testParameters.push("-rpcpassword="+this.RPCOptions.password);
      testParameters.push("-datadir="+dataDirectory);
      this.nativeProcess["test3"] = this.startNativeClient(binFiles[0], testParameters, installDirectory);
      this.nativeProcess["test3"].stdout.on('data', this.onClientSTDOUT.bind(this, "test3"));
      this.nativeProcess["test3"].stderr.on('data', this.onClientSTDERR.bind(this, "test3"));
      this.nativeProcess["test3"].on('close', this.onProcessClose.bind(this, "main"));
   }

   onClientSTDOUT(network, data) {
      if (this.handlerConfig.showOutput) {
         console.log ("BitcoinCoreNative ("+network+") > "+data.toString());
      }
   }

   onClientSTDERR(network, data) {
      if (this.handlerConfig.showOutput) {
         console.log ("BitcoinCoreNative ("+network+") > "+data.toString());
      }
   }

   onProcessClose(network) {
      console.error ("Native process for \""+network+"\" has closed unexpectedly.")
      this.nativeRPC(network) = null;
      delete network;
   }

   /**
   * Creates a new cryptocurrency wallet from the root wallet defined in
   * <code>config.CP.API.wallets.bitcoin</code>
   *
   * @param {String} [APIType="bitcoin"] The cryptocurrency type of API endpoint
   * configuration to use for an API call. This value must match one of the definitions
   * found in the <code>config.CP.API</code> object.
   * @param {String} [network=null] The sub-network, if applicable, for which to
   * create the wallet. Valid values include "main" and "test3".
   * If <code>null</code>, the default network specified in
   * <code>config.CP.API[APIType].default.network</code> is used.
   *
   * @return {Promise} The resolved promise will include a native JavaScript object
   * containing the new derived wallet object. The rejected promise will
   * contain the error object.
   */
   makeNewWallet(APIType="bitcoin", network=null) {
      var promise = new Promise((resolve, reject) => {
         if (network == null) {
            network = this.server.config.CP.API[APIType].default.network;
         }
         if ((network == "main") && (this.server.namespace.cp.wallets.bitcoin.main != null)) {
            if (this.server.config.CP.API.wallets.bitcoin.startChain < 0) {
               this.server.config.CP.API.wallets.bitcoin.startChain = 0;
            }
            //address index 0 is reserved for the cashout address
            if (this.server.config.CP.API.wallets.bitcoin.startIndex < 0) {
               this.server.config.CP.API.wallets.bitcoin.startIndex = 0;
            }
            //currently we simply increment the index:
            this.server.config.CP.API.wallets.bitcoin.startIndex++;
            //the chain value is currently 0 but can be set manually
            var startChain = this.server.config.CP.API.wallets.bitcoin.startChain;
            var startIndex = this.server.config.CP.API.wallets.bitcoin.startIndex;
         } else if ((network == "test3") && (this.server.namespace.cp.wallets.bitcoin.test3 != null)) {
            if (this.server.config.CP.API.wallets.test3.startChain < 0) {
               this.server.config.CP.API.wallets.test3.startChain = 0;
            }
            //address index 0 is reserved for the cashout address
            if (this.server.config.CP.API.wallets.test3.startIndex < 0) {
               this.server.config.CP.API.wallets.test3.startIndex = 0;
            }
            this.server.config.CP.API.wallets.test3.startIndex++;
            startChain = this.server.config.CP.API.wallets.test3.startChain;
            startIndex = this.server.config.CP.API.wallets.test3.startIndex;
         } else {
            reject(new Error("Wallet for \""+APIType+"\", network \""+network+"\" not defined."));
            return;
         }
         if (network == "main") {
            var newWallet = this.server.namespace.cp.wallets.bitcoin.main.derivePath("m/"+startChain+"/"+startIndex);
         } else {
            newWallet = this.server.namespace.cp.wallets.bitcoin.test3.derivePath("m/"+startChain+"/"+startIndex);
         }
         resolve (newWallet);
      });
      return (promise);
   }

   /**
   *
   * Creates a HD (Hierarchical Deterministic) Bitcoin wallet from which addresses can be
   * derived.
   *
   * @param {String} privKey A "xprv" or "tprv" base 58 string containing the private
   * key of the wallet.
   *
   * @return {Object} A wallet object containing both the public and private keys
   * from which Bitcoin addresses can be derived (using <code>derivePath</code>).
   */
   makeHDWallet(privKey) {
      try {
         if (privKey.indexOf("xprv") == 0) {
            //mainnet
            var wallet = this.server.bitcoin.bip32.fromBase58(privKey);
         } else {
            //testnett
            wallet = this.server.bitcoin.bip32.fromBase58(privKey, this.server.bitcoin.networks.testnet);
         }
      } catch (err) {
         console.error(err.stack);
         return (null);
      }
      if (wallet == undefined) {
         return (null);
      }
      return (wallet);
   }

   /**
   * Returns the derived wallet object (or its address), of a root Bitcoin wallet object
   * defined in <code>namespace.cp.wallets.bitcoin</code>.
   *
   * @param {String} path The derivation path of the wallet to return.
   * @param {String} [network="main"] The sub-network for which to get the address.
   * Either "main" (default), or "test3". <code></code>
   * @param {Boolean} [addressOnly=false] If true, only the address is returned otherwise
   * the wallet object is returned (in this case use the <code>address</code> property).
   *
   * @return (Object|String) The derived wallet object or its address property if <code>addressOnly=true</code>.
   */
   getDerivedWallet(path, network="main", addressOnly=false) {
      if (network == "main") {
         var walletObj = this.server.namespace.cp.wallets.bitcoin.main;
      } else {
         walletObj = this.server.namespace.cp.wallets.bitcoin.test3;
      }
      var wallet = walletObj.derivePath(path);
      if (addressOnly == true) {
         var address = this.getAddress(wallet, network);
         return (address);
      } else {
         return (wallet);
      }
   }

   /**
   * Returns the address of a Bitcoin wallet object.
   *
   * @param {Object} walletObj A Bitcoin wallet data object.
   * @param {String} [network="main"] The sub-network for which to get the address.
   * Either "main" (default), or "test3".
   *
   */
   getAddress(walletObj, network="main") {
      if (network == "main") {
         return (this.server.bitcoin.payments.p2pkh({pubkey:walletObj.publicKey}).address);
      } else {
         var subNet = this.server.bitcoin.networks.testnet;
         return (this.server.bitcoin.payments.p2pkh({pubkey:walletObj.publicKey, network:subNet}).address);
      }
   }

   /**
   * Retrieves the blockchain balance of an address or derived wallet.
   *
   * @param {String} addressOrPath A Bitcoin/testnet address or derivation path.
   * If a derivation path is supplied, a master wallet must exist in the
   * [server.]{@link BlockCypherAPI#server}<code>namespace.cp.wallets.bitcoin</code> from which the sub-wallet will be derived.
   * @param {String} APIType The API endpoint to use for retrieving address information which
   * should match a [server.]{@link BlockCypherAPI#server}<code>config.CP.API.urls.blockcypher</code>
   * property (a URL).
   * @param {String} [network=null] The network or API sub-type to which the <code>addressOrPath</code>
   * belongs; for example "main" or "test3". Default is "main".
   *
   * @return (Promise) The promise resolves with a JSON object containing information about
   * the address or derived wallet. Refer to the <a href="https://www.blockcypher.com/dev/bitcoin/#address-full-endpoint">BlockCypher API reference</a>
   * for the properties of this object. The promise ends with a rejection if the API returns an error.
   *
   * @see https://www.blockcypher.com/dev/bitcoin/#address-full-endpoint
   */
   getBlockchainBalance(addressOrPath, APIType="bitcoin", network=null) {
      if (typeof(addressOrPath) != "string") {
         throw (new Error("addressOrPath parameter must be a string."));
      }
      if (addressOrPath.length < 5) {
         throw (new Error("addressOrPath parameter too short (minimum 5 characters)."));
      }
      if (network == "main") {
         var wallet = this.server.namespace.cp.wallets.bitcoin.main;
      } else {
         wallet = this.server.namespace.cp.wallets.bitcoin.test3;
      }
      if ((addressOrPath.length < 26) || (addressOrPath.indexOf("/") > -1)) {
         //this is a derivation path
         var derivedWallet = wallet.derivePath(addressOrPath);
         if (network == "main") {
            var address = this.getAddress(derivedWallet);
         } else {
            address = this.getAddress(derivedWallet, this.server.bitcoin.networks.testnet);
         }
      } else {
         //this is a plain address
         address = addressOrPath;
      }
      var promise = new Promise((resolve, reject) => {
         //implement
      });
   	return (promise);
   }

   /**
   * Cashes out from the configured cashout wallet to a specific address.
   *
   * @param {String} toAddress The address to cash out to.
   * @param {String|Number} amount The amount to cash out. The miner <code>fees</code> will
   * be deducted from this amount.
   * @param {String|Number} [fees=null] The miner fees to deduct from <code>amount</code> and
   * include with the transaction. If <code>null</code>, the default fee defined for the
   * <code>APIType</code> and <code>network</code> will be used.
   * @param {String} [APIType="bitcoin"] The main cryptocurrency API type.
   * @param {String} [network=null] The cryptocurrency sub-network, if applicable, for the
   * transaction. Current <code>network</code> types include: "main" and "test3". If <code>null</code>,
   * the default network specified in <code>config.CP.API[APIType].default.network</code> is used.
   */
   async cashoutToAddress(toAddress, amount, fees=null, APIType="bitcoin", network=null) {
      var API = this.server.config.CP.API[APIType];
      if (network == null) {
         network = API.default.network;
      }
      if (fees == null) {
         fees = API.default[network].minerFee;
      }
      var result = null;
      switch (APIType) {
         case "bitcoin":
            if (network == "main") {
               var fromWallet = this.server.namespace.cp.wallets.bitcoin.main.derivePath(API.default[network].cashOutAddrPath);
            } else {
               fromWallet = this.server.namespace.cp.wallets.bitcoin.test3.derivePath(API.default[network].cashOutAddrPath);
            }
            var sendTxResult = await this.sendTransaction(fromWallet, toAddress, amount, fees, APIType, network);
            return (sendTxResult);
            break;
         default:
            throw (new Error("Unsupported API type \""+APIType+"\"."));
            break;
      }
      throw (new Error("Unknown error when cashing out."));
   }

   /**
   * Sends a transaction from a (derived) wallet to a specific address with customizable fee using
   * the native client.
   *
   * @param {Object|String} from The wallet object or wallet derivation path from which to send the funds.
   * If this parameter is a string, the wallet is derived from a root
   * [server.]{@link BlockCypherAPI#server}<code>namespace.cp.wallets.bitcoin</code> wallet.
   * @param {String} toAddress The target or receipient address.
   * @param {String|Number} amount The amount to send to <code>toAddress</code> in the lowest
   * denomination of the associated cryptocurrency (e.g. satoshis if using Bitcoin).
   * @param {String|Number} [fee=null] The transaction fee to include in the transaction. The fee
   * is <i>in addition</i> to the <code>amount</code> being sent and is likewise denoted in
   * the smallest denomination for the cryptocurrency (e.g. satoshis if using Bitcoin). If omitted
   * or <code>null</code>, the fee currently found in
   * [server.]{@link BlockCypherAPI#server}<code>config.CP.API[APIType].default.minerFee</code>
   * is used.
   * @param {String} [APIType="bitcoin"] The main API endpoint to use when posting the transaction.
   * This value should match a [server.]{@link BlockCypherAPI#server}<code>config.CP.API.urls.blockcypher</code>
   * property (a URL).
   * @param {String} [network=null] The network or API sub-type for the transaction; for example "main" or "test3".
   * If null, the <code>config.CP.API[APIType].default.network</code> network is used.
   *
   * @return {Object} The function resolves with the posted transaction object returned by
   * the BlockCypher API or rejects with an <code>Error</code> object. See the
   * <a href="https://www.blockcypher.com/dev/bitcoin/#TXskeleton">BlockCypher API reference</a> for details on the returned object.
   * @async
   *
   * @see https://www.blockcypher.com/dev/bitcoin/#TXskeleton
   */
   async sendTransaction(from, toAddress, amount, fee=null, APIType="bitcoin", network=null) {
      var API = this.server.config.CP.API[APIType];
      if (network == null) {
         network = API.default.network;
      }
      if (fee == null) {
         fee = API.default[network].minerFee;
      }
      if (typeof(from) == "string") {
         if (network == "main") {
            var wallet = this.server.namespace.cp.wallets.bitcoin.main;
         } else {
            wallet = this.server.namespace.cp.wallets.bitcoin.test3;
         }
         if ((from.length < 26) || (from.indexOf("/") > -1)) {
            //this is a derivation path
            var fromWallet = wallet.derivePath(from);
         } else {
            throw (new Error("Parameter \"from\" must be a wallet object or derivation path."));
         }
      } else {
         fromWallet = from;
      }
      if (network == "main") {
         var fromAddress = this.getAddress(fromWallet);
      } else {
         fromAddress = this.getAddress(fromWallet, this.server.bitcoin.networks.testnet);
      }
      var result = null;
      switch (APIType) {
         case "bitcoin":
            //implement
            break;
         default:
            throw (new Error("Unsupported API type \""+APIType+"\"."));
            break;
      }
      throw (new Error("Unknown error when sending transaction."));
   }

  /**
  * Returns an estimated miner fee for a transaction. The fee estimation may either be based on an
  * external service or an internal calculation.
  *
  * @param {*} [txData=null] The transaction for which to estimate the fee. The format
  * for this parameter differs based on the <code>APIType</code> and possibly <code>network</code>.<br/>
  * If omitted, a typical (average) transaction is assumed.<br/>
  * For a "bitcoin" <code>APIType</code>, this parameter is expected to be a string of hex-encoded data
  * comprising the binary transaction. If omitted, the transaction is assumed to be 250 bytes.
  * @param {Number} [priority=1] The priority with which the transaction is to be posted. A higher-priority
  * transaction (closer to or equal to 0), is expected to be posted faster than a lower priority one (> 0).
  * This paramater is dependent on the <code>APIType</code> and possibly the <code>network</code> type.<br/>
  * When <code>APIType</code> is "bitcoin", a priority of 0 is the highest priority (to be included in the next 1-2 blocks),
  * a priority of 1 is a medium priority (3 to 6 blocks), and 2 is a low priority (> 6 blocks).
  * @param {String} [APIType="bitcoin"] The main cryptocurrency API type.
  * @param {String} [network=null] The cryptocurrency sub-network, if applicable, for the
  * transaction. Current <code>network</code> types include: "main" and "test3". If <code>null</code>,
  * the default network specified in <code>config.CP.API[APIType].default.network</code> is used.
  *
  * @return {String} The estimated transaction fee, as a numeric string in the lowest denomination of the associated
  * cryptocurrency (e.g. satoshis if <code>APIType="bitcoin"</code>), based on the supplied <code>txData</code>,
  * <code>priority</code>, <code>APIType</code>, and <code>network</code>. If any parameter is invalid or unrecognized,
  * <code>null</code> is returned.
  * @async
  */
  async estimateTxFee (txData=null, priority=1, APIType="bitcoin", network=null) {
     try {
        switch (APIType) {
           case "bitcoin":
              var txSize = 250; //bytes
              if (txData != null) {
                 txSize = txData.length / 2; //hex-encoded binary data
              }
              //TODO: complete this!
              break;
           default:
              return (null);
              break;
        }
     } catch (err) {
        return (null);
     }
  }

  /**
  * Updates the internal transaction fee(s) for a specific cryptocurrency and sub-network if
  * not already updated within its configured time limit. The fee(s) currently stored for the cryptocurrency
  * in the main <code>config</code> is/are updated if successfully retrieved or calculated.
  *
  * @param {String} [APIType="bitcoin"] The main cryptocurrency API type.
  * @param {String} [network=null] The cryptocurrency sub-network, if applicable, for the
  * transaction. Current <code>network</code> types include: "main" and "test3". If <code>null</code>,
  * the default network specified in <code>config.CP.API[APIType].default.network</code> is used.
  * @param {Boolean} [forceUpdate=false] If true, an update is forced even if the configured time limit
  * has not yet elapsed.
  *
  * @return {Promise} Resolves with the string "updated" if the fees for the API/network were succesfully updated or
  * "skipped" the configured time limit for updates has not yet elapsed. The promise is rejected with a standard
  * <code>Error</code> object if an update could not be successfully completed (any existing fees data is not changed).
  * @private
  */
  updateTxFees(APIType="bitcoin", network=null, forceUpdate=false) {
     var promise = new Promise((resolve, reject) => {
        var API = this.server.config.CP.API[APIType];
        if ((network == null) || (network == "")) {
           network = API.default.network;
        }
        if (API.default[network].feeUpdateEnabled == false) {
           reject (new Error("Fee updates for \""+APIType+"/"+network+"\" disabled."));
           return;
        }
        var url = API.urls.blockcypher.fees;
        var updateSeconds = API.default[network].feeUpdateSeconds;
        if ((updateSeconds > 0) && (forceUpdate == false)) {
           var lastUpdate = API.default[network]["lastUpdated"];
           if ((lastUpdate != undefined) && (lastUpdate != null) && (lastUpdate != "")) {
              var lastUpdateCheck = new Date(API.default[network].lastUpdated); //this date/time must be relative to local date/time
              var currentDateTime = new Date();
              var deltaMS = currentDateTime.valueOf() - lastUpdateCheck.valueOf();
              var deltaSec = deltaMS / 1000;
              if (deltaSec < updateSeconds) {
                 resolve("skipped");
                 return;
              }
           }
        }
        url = url.split("%network%").join(network);
        this.server.request({
           url: url,
           method: "GET",
           json: true
        }, (error, response, body) => {
           var currentDateTime = new Date();
           API.default[network].lastUpdated = currentDateTime.toISOString();
           if ((body == undefined) || (body == null)) {
              var errorObj = new Error(response);
              reject (errorObj);
              return;
           }
           if (error) {
              errorObj = new Error(error);
              reject(errorObj);
           } else {
              API.default[network].minerFee = String(body.high_fee_per_kb); //should be a string
              resolve("updated");
              //resolve(body);
           }
        });
     });
     return (promise);
  }

  toString() {
     return ("[object BlockCypherAPI]");
 }

}
