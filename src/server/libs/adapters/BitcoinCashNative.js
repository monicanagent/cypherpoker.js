/**
* @file Native Bitcoin Cash adapter for blockchain interactions such as balance retrieval and
* transaction posting.
*
* @version 0.5.0
* @author Patrick Bay
* @copyright MIT License
*/

const CryptocurrencyHandler = require("../CryptocurrencyHandler");
const BTCClient = require('bitcoin-core');
const bitcoreCash = require('bitcore-lib-cash');
const path = require("path");

/**
* @class Bitcoin Cash native adapter (bitcoind) for blockchain interactions.
* @extends EventEmitter
*/
module.exports = class BitcoinCashNative extends CryptocurrencyHandler {

   /**
   * Creates a new instance of the native Bitcoin Cash adapter.
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
   * with the running executable / binary. The RPC uses non-standard ports to prevent collisions with
   * other Bitcoin-based API providers.
   *
   * @param {String} [network="main"] The network for which the client is configured. Valid networks
   * include "main" and "test".
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
                 port: 9332
               });
               break;
            case "test":
               this._clients[network] = new BTCClient({
                 network: "testnet",
                 username: this.RPCOptions.username,
                 password: this.RPCOptions.password,
                 port: 19332
               });
               break;
            case "regtest":
               this._clients[network] = new BTCClient({
                 network: "regtest",
                 username: this.RPCOptions.username,
                 password: this.RPCOptions.password,
                 port: 19333
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
   * "main" and "test" properties but other names and aliases may also be used.
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
      if (this.server.hostEnv.embedded == true) {
         var dataDirectory = path.resolve(this.server.hostEnv.dir.server + this.handlerConfig.dataDir);
      } else {
         dataDirectory = path.resolve(this.handlerConfig.dataDir);
      }
      process.stdin.resume();
      process.on("SIGINT", this.onServerExit.bind(this));
      switch (process.platform) {
         case "linux":
            //process.arch == ia32 (for 32-bit Linux)
            installDirectory = installDirectory.split("%os%").join("linux");
            var binFiles = ["./bitcoind"];
            break;
         case "win32":
            installDirectory = installDirectory.split("%os%").join("win");
            binFiles = ["bitcoind.exe"];
            break;
         case "darwin":
            installDirectory = installDirectory.split("%os%").join("macOS");
            binFiles = ["./bitcoind"];
            break;
         default:
            throw (new Error("Unsupported platform: "+process.platform));
            break;
      }
      var result = await this.checkInstall(binFiles, installDirectory, true);
      if (result == false) {
         return (false);
      }
      //mainnet
      var mainParameters = new Array();
      mainParameters.push("-server");
      mainParameters.push("-printtoconsole");
      mainParameters.push("-rpcport=9332"); // default
      mainParameters.push("-rpcallowip="+this.RPCOptions.allowIP);
      mainParameters.push("-rpcbind=127.0.0.1");
      mainParameters.push("-rpcuser="+this.RPCOptions.username);
      mainParameters.push("-rpcpassword="+this.RPCOptions.password);
      mainParameters.push("-datadir="+dataDirectory);
      this.nativeProcess["main"] = this.startNativeClient(binFiles[0], mainParameters, installDirectory);
      this.nativeProcess["main"].stdout.on('data', this.onClientSTDOUT.bind(this, "main"));
      this.nativeProcess["main"].stderr.on('data', this.onClientSTDERR.bind(this, "main"));
      this.nativeProcess["main"].on('close', this.onProcessClose.bind(this, "main"));
      var result = await this.waitForOutput("main");
      //testnet
      var testParameters = new Array();
      testParameters.push("-server");
      testParameters.push("-testnet");
      testParameters.push("-printtoconsole");
      testParameters.push("-rpcport=19332"); // default
      testParameters.push("-rpcallowip="+this.RPCOptions.allowIP);
      testParameters.push("-rpcbind=127.0.0.1");
      testParameters.push("-rpcuser="+this.RPCOptions.username);
      testParameters.push("-rpcpassword="+this.RPCOptions.password);
      testParameters.push("-datadir="+dataDirectory);
      this.nativeProcess["test"] = this.startNativeClient(binFiles[0], testParameters, installDirectory);
      this.nativeProcess["test"].stdout.on('data', this.onClientSTDOUT.bind(this, "test"));
      this.nativeProcess["test"].stderr.on('data', this.onClientSTDERR.bind(this, "test"));
      this.nativeProcess["test"].on('close', this.onProcessClose.bind(this, "test"));
      var result = await this.waitForOutput("test");
      /*
      //regtest (local developer testnet)
      var regParameters = new Array();
      regParameters.push("-server");
      regParameters.push("-regtest");
      regParameters.push("-printtoconsole");
      regParameters.push("-rpcport=19333"); // default
      regParameters.push("-rpcallowip="+this.RPCOptions.allowIP);
      regParameters.push("-rpcbind=127.0.0.1");
      regParameters.push("-rpcuser="+this.RPCOptions.username);
      regParameters.push("-rpcpassword="+this.RPCOptions.password);
      regParameters.push("-datadir="+dataDirectory);
      this.nativeProcess["regtest"] = this.startNativeClient(binFiles[0], regParameters, installDirectory);
      this.nativeProcess["regtest"].stdout.on('data', this.onClientSTDOUT.bind(this, "regtest"));
      this.nativeProcess["regtest"].stderr.on('data', this.onClientSTDERR.bind(this, "regtest"));
      this.nativeProcess["regtest"].on('close', this.onProcessClose.bind(this, "regtest"));
      var result = await this.waitForOutput("regtest");
      */
      return (true);
   }

   /**
   * Creates a promise that resolves when the console output of a process
   * designated for a specific network is detected.
   *
   * @param {String} [network="main"] The sub-network process for
   * which to detect console output. Valid network types include "main",
   * "test", or "regtest".
   * @param {String} [type="STDOUT"] The console on which the output
   * is to be detected, either "STDOUT" or "STDERR".
   *
   * @return {Promise} The returned promise resolves when output on the
   * specified console <code>type</code> is detected.
   */
   waitForOutput(network="main", type="STDOUT") {
      var promise=new Promise((resolve, reject) => {
         if (type == "STDOUT") {
            this._onNextSTDOUT = new Object();
            this._onNextSTDOUT.network = network;
            this._onNextSTDOUT.resolve = resolve;
            this._onNextSTDOUT.reject = reject;
         } else {
            this._onNextSTDERR = new Object();
            this._onNextSTDERR.network = network;
            this._onNextSTDERR.resolve = resolve;
            this._onNextSTDERR.reject = reject;
         }
      });
      return (promise);
   }

   /**
   * Handles STDOUT output for a native client process.
   *
   * @param {String} network The sub-network that the native client is associated
   * with ("main", "test", or "regtest").
   * @param {Object} data The output received from the native client on the STDOUT
   * pipe.
   *
   * @private
   */
   onClientSTDOUT(network, data) {
      if (this.handlerConfig.showOutput) {
         console.log ("BitcoinCashNative ("+network+") > "+data.toString());
      }
      if ((this._onNextSTDOUT != undefined) && (this._onNextSTDOUT != null)) {
         if (this._onNextSTDOUT.network == network) {
            this._onNextSTDOUT.resolve(data.toString());
            this._onNextSTDOUT = null;
            delete this._onNextSTDOUT;
         }
      }
   }

   /**
   * Handles STDERR (error) output for a native client process.
   *
   * @param {String} network The sub-network that the native client is associated
   * with ("main", "test", or "regtest").
   * @param {Object} data The output received from the native client on the STDERR
   * pipe.
   *
   * @private
   */
   onClientSTDERR(network, data) {
      if (this.handlerConfig.showOutput) {
         console.log ("BitcoinCashNative ("+network+") > "+data.toString());
      }
      if ((this._onNextSTDERR != undefined) && (this._onNextSTDERR != null)) {
         if (this._onNextSTDERR.network == network) {
            this._onNextSTDERR.resolve(data.toString());
            this._onNextSTDERR = null;
            delete this._onNextSTDERR;
         }
      }
   }

   /**
   * Invoked when a native client process closes (usually unexpectedly).
   *
   * @param {String} network The sub-network that the native client is associated
   * with ("main", "test", or "regtest").
   *
   * @private
   */
   onProcessClose(network) {
      console.error ("Native process for \""+network+"\" has closed.");
      if (typeof(this._exitOnProcessClose) == "object") {
         process.exit(130); // https://www.tldp.org/LDP/abs/html/exitcodes.html
      }
   }

   /**
   * Generates a new block and credits a target address if the native client
   * is running in "regtest" (regression testing or local development) mode.
   *
   * @param {String} toAddress The address to credit with the creation of a new
   * block and any transaction fees.
   * @param {Number} [numBlocks=1] The number of blocks to mine.
   *
   * @return {Array} A list of mined block header hashes or <code>null</code> if they
   * couldn't be mined / generated.
   *
   * @async
   */
   async generateRegBlocks(toAddress, numBlocks=1) {
      var rpc = this.nativeRPC("regtest");
      if ((rpc == undefined) || (rpc == null)) {
         return (null);
      }
      var result = await rpc.importAddress(toAddress, "", true); //import and rescan all transactions
      var result = await rpc.generateToAddress(numBlocks, toAddress);
      return (result);
   }

   /**
   * Creates a new cryptocurrency wallet from the root wallet defined in
   * <code>config.CP.API.wallets.bitcoincash</code>
   *
   * @param {String} [APIType="bitcoincash"] The cryptocurrency type of API endpoint
   * configuration to use for an API call. This value must match one of the definitions
   * found in the <code>config.CP.API</code> object.
   * @param {String} [network=null] The sub-network, if applicable, for which to
   * create the wallet. Valid values include "main" and "test".
   * If <code>null</code>, the default network specified in
   * <code>config.CP.API[APIType].default.network</code> is used.
   *
   * @return {Promise} The resolved promise will include a native JavaScript object
   * containing the new derived wallet object. The rejected promise will
   * contain the error object.
   */
   makeNewWallet(APIType="bitcoincash", network=null) {
      var promise = new Promise((resolve, reject) => {
         if (network == null) {
            network = this.server.config.CP.API[APIType].default.network;
         }
         if ((network == "main") && (this.server.namespace.cp.wallets.bitcoincash.main != null)) {
            if (this.server.config.CP.API.wallets.bitcoincash.startChain < 0) {
               this.server.config.CP.API.wallets.bitcoincash.startChain = 0;
            }
            //address index 0 is reserved for the cashout address
            if (this.server.config.CP.API.wallets.bitcoincash.startIndex < 0) {
               this.server.config.CP.API.wallets.bitcoincash.startIndex = 0;
            }
            //currently we simply increment the index:
            this.server.config.CP.API.wallets.bitcoincash.startIndex++;
            //the chain value is currently 0 but can be set manually
            var startChain = this.server.config.CP.API.wallets.bitcoincash.startChain;
            var startIndex = this.server.config.CP.API.wallets.bitcoincash.startIndex;
         } else if ((network == "test") && (this.server.namespace.cp.wallets.bitcoincash.test != null)) {
            if (this.server.config.CP.API.wallets.bchtest.startChain < 0) {
               this.server.config.CP.API.wallets.bchtest.startChain = 0;
            }
            //address index 0 is reserved for the cashout address
            if (this.server.config.CP.API.wallets.bchtest.startIndex < 0) {
               this.server.config.CP.API.wallets.bchtest.startIndex = 0;
            }
            this.server.config.CP.API.wallets.bchtest.startIndex++;
            startChain = this.server.config.CP.API.wallets.bchtest.startChain;
            startIndex = this.server.config.CP.API.wallets.bchtest.startIndex;
         } else {
            reject(new Error("Wallet for \""+APIType+"\", network \""+network+"\" not defined."));
            return;
         }
         if (network == "main") {
            var newWallet = this.server.namespace.cp.wallets.bitcoincash.main.derivePath("m/"+startChain+"/"+startIndex);
         } else {
            newWallet = this.server.namespace.cp.wallets.bitcoincash.test.derivePath("m/"+startChain+"/"+startIndex);
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
            var wallet = this.server.bitcoincash.bip32.fromBase58(privKey);
         } else {
            //testnett
            wallet = this.server.bitcoincash.bip32.fromBase58(privKey, this.server.bitcoincash.networks.testnet);
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
   * defined in <code>namespace.cp.wallets.bitcoincash</code>.
   *
   * @param {String} path The derivation path of the wallet to return.
   * @param {String} [network="main"] The sub-network for which to get the address.
   * Either "main" (default), or "test". <code></code>
   * @param {Boolean} [addressOnly=false] If true, only the address is returned otherwise
   * the wallet object is returned (in this case use the <code>address</code> property).
   * @param {Boolean} [cashAddress=false] If true and <code>addressOnly=true</code>, the returned
   * address is a Bitcoin Cash style one, otherwise a standard Base58 encoded address is returned.
   *
   * @return (Object|String) The derived wallet object or its address property if <code>addressOnly=true</code>.
   */
   getDerivedWallet(path, network="main", addressOnly=false, cashAddress=false) {
      if (network == "main") {
         var walletObj = this.server.namespace.cp.wallets.bitcoincash.main;
      } else {
         walletObj = this.server.namespace.cp.wallets.bitcoincash.test;
      }
      var wallet = walletObj.derivePath(path);
      if (addressOnly == true) {
         var address = this.getAddress(wallet, network, cashAddress);
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
   * Either "main" (default), "test", "regtest", or any common BCH variant of these.
   * @param {Boolean} [cashAddress=false] If true, a Bitcoin Cash address is returned instead
   * of a standard (legacy) Bitcoin Base58 address.
   *
   */
   getAddress(walletObj, network="main", cashAddress=false) {
      network = network.toLowerCase();
      if (cashAddress == true) {
         var publicKey = bitcoreCash.PublicKey(walletObj.publicKey);
         switch (network) {
            case "main":
               var address = new bitcoreCash.Address(publicKey, bitcoreCash.Networks.livenet);
               break;
            case "mainnet":
               address = new bitcoreCash.Address(publicKey, bitcoreCash.Networks.livenet);
               break;
            case "livenet":
               address = new bitcoreCash.Address(publicKey, bitcoreCash.Networks.livenet);
               break;
            case "test":
               address = new bitcoreCash.Address(publicKey, bitcoreCash.Networks.testnet);
               break;
            case "test3":
               address = new bitcoreCash.Address(publicKey, bitcoreCash.Networks.testnet);
               break;
            case "testnet":
               address = new bitcoreCash.Address(publicKey, bitcoreCash.Networks.testnet);
               break;
            case "regtest":
               address = new bitcoreCash.Address(publicKey, bitcoreCash.Networks.regtest);
               break;
            default:
               throw (new Error("Unrecognized network \""+network+"\"."));
               break;
         }
         return (address.toString());
      } else {
         if ((network == "main") || (network == "mainnet") || (network == "livenet")) {
            return (this.server.bitcoincash.payments.p2pkh({pubkey:walletObj.publicKey}).address);
         } else {
            var subNet = this.server.bitcoincash.networks.testnet;
            return (this.server.bitcoincash.payments.p2pkh({pubkey:walletObj.publicKey, network:subNet}).address);
         }
      }
   }

   /**
   * Converts an amount from a specific denomination to a specific denomination
   * for display.
   *
   * @param {String} amount The amount to convert.
   * @param {String} fromDenom The source denomination. Valid values include:
   * "satoshi", "bitcoin"
   * @param {String} toDenom The target denomination. Valid values include:
   * "satoshi", "bitcoin"
   *
   * @return {String} The <code>amount</code> converted to from the source
   * denomination to the target denomination.
   */
   convertDenom(amount, fromDenom, toDenom) {
      if (fromDenom == toDenom) {
         return (amount);
      }
      switch (fromDenom) {
         case "satoshi":
            if (toDenom == "bitcoin") {
               amount = amount.padStart(8, "0");
               var decimal = amount.substring(amount.length-8);
               var whole = amount.substring(0,amount.length-8);
               if (whole == "") {
                  whole = "0";
               }
               amount = whole + "." + decimal;
            } else {
               throw (new Error("Unrecognized target denomination \""+toDenom+"\""));
            }
            break;
         case "bitcoin":
            if (toDenom == "satoshis") {
               var amountSplit = amount.split(".");
               if (amountSplit.length > 1) {
                  whole = amountSplit[0];
                  decimal = amountSplit[1].padEnd(8, "0");
               } else {
                  whole = amountSplit[0].padEnd((amountSplit[0].length + 8), "0");
                  decimal = "";
               }
               if (decimal.length > 8) {
                  decimal = decimal.substring(0, 7);
               }
               if (whole == "0") {
                  whole = "";
                  while (decimal.startsWith("0")) {
                     decimal = decimal.substring(1);
                  }
               }
               amount = whole + decimal;
               if (amount == "") {
                  amount = "0";
               }
            } else {
               throw (new Error("Unrecognized target denomination \""+toDenom+"\""));
            }
            break;
         default:
            throw (new Error("Unrecognized source denomination \""+fromDenom+"\""));
            break;
      }
      return (amount);
   }

   /**
   * Retrieves the blockchain balance of an address or derived wallet.
   *
   * @param {String} addressOrPath A Bitcoin/testnet address or derivation path.
   * If a derivation path is supplied, a master wallet must exist in the
   * [server.]{@link BlockCypherAPI#server}<code>namespace.cp.wallets.bitcoin</code> from which the sub-wallet will be derived.
   * @param {String} APIType The API endpoint to use for retrieving address information.
   * @param {String} [network=null] The network or API sub-type to which the <code>addressOrPath</code>
   * belongs; for example "main" or "test". Default is "main".
   *
   * @return (Promise) The promise resolves with a JSON object containing information about
   * the address or derived wallet. Refer to the <a href="https://www.blockcypher.com/dev/bitcoin/#address-full-endpoint">BlockCypher API reference</a>
   * for the properties of this object. The promise ends with a rejection if the API returns an error.
   */
   getBlockchainBalance(addressOrPath, APIType="bitcoincash", network=null) {
      if (typeof(addressOrPath) != "string") {
         throw (new Error("addressOrPath parameter must be a string."));
      }
      if (addressOrPath.length < 5) {
         throw (new Error("addressOrPath parameter too short (minimum 5 characters)."));
      }
      if (network == "main") {
         var wallet = this.server.namespace.cp.wallets.bitcoincash.main;
      } else {
         wallet = this.server.namespace.cp.wallets.bitcoincash.test;
      }
      if ((addressOrPath.length < 26) || (addressOrPath.indexOf("/") > -1)) {
         //this is a derivation path
         var derivedWallet = wallet.derivePath(addressOrPath);
         var address = this.getAddress(derivedWallet, network);
      } else {
         //this is a plain address
         address = addressOrPath;
      }
      var promise = new Promise((resolve, reject) => {
         var resultObj = new Object();
         resultObj.address = address;
         resultObj.balance = 0;
         resultObj.unconfirmed_balance = 0;
         resultObj.final_balance = 0;
         var rpc = this.nativeRPC(network);
         var totalConfirmed = this.server.bigInt(0);
         var totalUnconfirmed = this.server.bigInt(0);
         rpc.importAddress(address, "", false).then (result => {
            rpc.listUnspent(0, 999999999, [address]).then (utxoList => {
               for (var count=0; count < utxoList.length; count++) {
                  var currentUTXO = utxoList[count];
                  var confirmations = currentUTXO.confirmations;
                  var amount = this.convertDenom(String(currentUTXO.amount), "bitcoin", "satoshis");
                  amount = this.server.bigInt(amount);
                  if (confirmations > 0) {
                     totalConfirmed = totalConfirmed.plus(amount);
                  } else {
                     totalUnconfirmed = totalUnconfirmed.plus(amount);
                  }
               }
               resultObj.balance = parseInt(totalConfirmed.toString(10), 10);
               resultObj.unconfirmed_balance = parseInt(totalUnconfirmed.toString(10), 10);
               resultObj.final_balance = parseInt(totalConfirmed.plus(totalUnconfirmed).toString(10), 10);
               resolve (resultObj);
            });
         });
      });
   	return (promise);
   }

   /**
   * Cashes out from the configured cashout wallet to a specific address.
   *
   * @param {String} toAddress The address to cash out to.
   * @param {String|Number} amount The amount to cash out in the smallest denominiation
   * for the cryptocurrency. The miner <code>fees</code> will
   * be deducted from this amount.
   * @param {String|Number} [fees=null] The miner fees to deduct from <code>amount</code> and
   * include with the transaction. If <code>null</code>, the default fee defined for the
   * <code>APIType</code> and <code>network</code> will be used.
   * @param {String} [APIType="bitcoincash"] The main cryptocurrency API type.
   * @param {String} [network=null] The cryptocurrency sub-network, if applicable, for the
   * transaction. Current <code>network</code> types include: "main" and "test". If <code>null</code>,
   * the default network specified in <code>config.CP.API[APIType].default.network</code> is used.
   */
   async cashoutToAddress(toAddress, amount, fees=null, APIType="bitcoincash", network=null) {
      var API = this.server.config.CP.API[APIType];
      if (network == null) {
         network = API.default.network;
      }
      if (fees == null) {
         fees = API.default[network].minerFee;
      }
      var result = null;
      switch (APIType) {
         case "bitcoincash":
            if (network == "main") {
               var fromWallet = this.server.namespace.cp.wallets.bitcoincash.main.derivePath(API.default[network].cashOutAddrPath);
            } else {
               fromWallet = this.server.namespace.cp.wallets.bitcoincash.test.derivePath(API.default[network].cashOutAddrPath);
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
   * [server.]{@link BlockCypherAPI#server}<code>namespace.cp.wallets.bitcoincash</code> wallet.
   * @param {String} toAddress The target or receipient address.
   * @param {String|Number} amount The amount to send to <code>toAddress</code> in the lowest
   * denomination of the associated cryptocurrency (e.g. satoshis if using Bitcoin).
   * @param {String|Number} [fee=null] The transaction fee to include in the transaction. The fee
   * is <i>in addition</i> to the <code>amount</code> being sent and is likewise denoted in
   * the smallest denomination for the cryptocurrency (e.g. satoshis if using Bitcoin Cash). If omitted
   * or <code>null</code>, the fee currently found in
   * [server.]{@link BlockCypherAPI#server}<code>config.CP.API[APIType].default.minerFee</code>
   * is used.
   * @param {String} [APIType="bitcoincash"] The main API endpoint to use when posting the transaction.
   * @param {String} [network=null] The network or API sub-type for the transaction; for example "main" or "test".
   *
   * @return {Object} The function resolves with the posted transaction object returned by
   * the RPC API or rejects with an <code>Error</code> object.
   *
   * @async
   */
   async sendTransaction(from, toAddress, amount, fee=null, APIType="bitcoincash", network=null) {
      var API = this.server.config.CP.API[APIType];
      if (network == null) {
         network = API.default.network;
      }
      if (fee == null) {
         fee = API.default[network].minerFee;
      }
      if (typeof(from) == "string") {
         if (network == "main") {
            var wallet = this.server.namespace.cp.wallets.bitcoincash.main;
         } else {
            wallet = this.server.namespace.cp.wallets.bitcoincash.test;
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
         fromAddress = this.getAddress(fromWallet, "test");
      }
      switch (APIType) {
         case "bitcoincash":
            var UTXOList = await this.getUTXOList(fromAddress, network);
            var signingKey = new bitcoreCash.PrivateKey(fromWallet.toWIF());
            var txHex = await this.buildRawTransaction(UTXOList, fromAddress, toAddress, signingKey, network, amount, fee);
            try {
               var txHash = await this.nativeRPC(network).sendRawTransaction(txHex, true); //alow high transaction fees (if included)
            } catch (err) {
               console.error(err);
            }
            //create expected response object
            var txObject = new Object();
            txObject.tx = new Object();
            txObject.tx.hash = txHash;
            if (network == "regtest") {
               //"mine" a block immediately to push the transaction onto the chain
               var mineAddress = this.getDerivedWallet(this.server.config.CP.API.bitcoincash.default.test.cashOutAddrPath, "regtest", true);
               var result = await this.generateRegBlocks(mineAddress, 10); //mine a block
            }
            return (txObject);
            break;
         default:
            throw (new Error("Unsupported API type \""+APIType+"\"."));
            break;
      }
      throw (new Error("Unknown error when sending transaction."));
   }

   /**
   * Retrieves a list of spendable transactions for a specific address.
   *
   * @param {String} address The address for which to retrieve the list of
   * transactions.
   * @param {String} [network="main"] The sub-network to which this address belongs.
   * Valid <code>network</code> types include "main", "test", and "regtest".
   *
   * @async
   * @private
   */
   async getUTXOList(address, network="main") {
      var rpc = this.nativeRPC(network);
      var importResult = await rpc.importAddress(address, "", true);
      var UTXOList = await rpc.listUnspent(1, 9999999, [address]);
      return (UTXOList);
   }

   /**
   * Builds a raw Bitcoin transaction.
   *
   * @param {Array} UTXOList Indexed list of unspent transaction outputs (objects containing
   * at least <code>amount</code>, <code>txid</code>, and <code>vout</code> properties).
   * @param {String} fromAddress The sending address.
   * @param {String} toAddress The receiving address.
   * @param {Object} signingKey The keypair belonging to <code>fromAddress</code> used to sign the transaction(s).
   * @param {String} network The network to which <code>fromAddress</code> and <code>toAddress</code> belong. Valid
   * networks include "main", "test", and "regtest".
   * @param {String} amountSat The amount to send to the receiving address, in satoshis.
   * @param {String} feeSat The transaction fee to include with the transaction, in satoshis (this value
   *  is <i>in addition to</code> the <code>amountSat</code>)
   *
   * @return {Object} The raw, signed transaction in hexadecimal.
   * @async
   */
   async buildRawTransaction(UTXOList, fromAddress, toAddress, signingKey, network, amountSat, feeSat) {
      var tx = new bitcoreCash.Transaction().from(UTXOList).to(toAddress, parseInt(amountSat)).change(fromAddress).fee(parseInt(feeSat)).sign(signingKey).serialize();
      return (tx);
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
  * @param {String} [APIType="bitcoincash"] The main cryptocurrency API type.
  * @param {String} [network=null] The cryptocurrency sub-network, if applicable, for the
  * transaction. Current <code>network</code> types include: "main" and "test". If <code>null</code>,
  * the default network specified in <code>config.CP.API[APIType].default.network</code> is used.
  *
  * @return {String} The estimated transaction fee, as a numeric string in the lowest denomination of the associated
  * cryptocurrency (e.g. satoshis if <code>APIType="bitcoin"</code>), based on the supplied <code>txData</code>,
  * <code>priority</code>, <code>APIType</code>, and <code>network</code>. If any parameter is invalid or unrecognized,
  * <code>null</code> is returned.
  * @async
  */
  async estimateTxFee (txData=null, priority=1, APIType="bitcoincash", network=null) {
     try {
        switch (APIType) {
           case "bitcoincash":
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
  * @param {String} [APIType="bitcoincash"] The main cryptocurrency API type.
  * @param {String} [network=null] The cryptocurrency sub-network, if applicable, for the
  * transaction. Current <code>network</code> types include: "main" and "test". If <code>null</code>,
  * the default network specified in <code>config.CP.API[APIType].default.network</code> is used.
  * @param {Boolean} [forceUpdate=false] If true, an update is forced even if the configured time limit
  * has not yet elapsed.
  *
  * @return {Promise} Resolves with the string "updated" if the fees for the API/network were succesfully updated or
  * "skipped" the configured time limit for updates has not yet elapsed. The promise is rejected with a standard
  * <code>Error</code> object if an update could not be successfully completed (any existing fees data is not changed).
  * @private
  */
  updateTxFees(APIType="bitcoincash", network=null, forceUpdate=false) {
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

  /**
  * Event responder invoked when the main server process (Node.js) is about to exit.
  * This causes any launched child processes to stop and exit gracefully (failure to do
  * so may cause data loss).
  *
  * @param {String} code The exit code with which the server is exiting.
  *
  * @async
  */
  async onServerExit(code) {
     this._exitOnProcessClose = new Object();
     try {
        var result = this.nativeRPC("main").stop();
        this._exitOnProcessClose.main = true;
     } catch (err) {
        console.error (err);
     }
     try {
        var result = this.nativeRPC("test").stop();
        this._exitOnProcessClose.test = true;
     } catch (err) {
        console.error (err);
     }
     try {
        var result = this.nativeRPC("regtest").stop();
        this._exitOnProcessClose.regtest = true;
     } catch (err) {
        console.error (err);
     }
  }

  toString() {
     return ("[object BitcoinCashNative]");
  }

}
