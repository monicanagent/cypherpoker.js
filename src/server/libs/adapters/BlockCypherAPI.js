/**
* @file BlockCypher API adapter for blockchain interactions such as balance retrieval and
* transaction posting.
*
* @version 0.5.0
* @author Patrick Bay
* @copyright MIT License
*/

const CryptocurrencyHandler = require("../CryptocurrencyHandler");

/**
* @class BlockCypher API adapter for blockchain interactions.
* @extends EventEmitter
*/
module.exports = class BlockCypherAPI extends CryptocurrencyHandler {

   /**
   * Creates a new instance of the BlockCypherAPI adapter.
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
   * @param {Boolean} [nativeAddress=false] Used when a derivative cryptocurrency can return
   * an address (when <code>addressOnly=true</code>) in a native/derivative format from
   * the original cryptoccurrency. Currently ignored.
   *
   * @return (Object|String) The derived wallet object or its address property if <code>addressOnly=true</code>.
   */
   getDerivedWallet(path, network="main", addressOnly=false, nativeAddress=false) {
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
   * Invokes the BlockCypher balance ("address-full") API endpoint to retrieve information about
   * an address, including its balances.
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
         var API = this.server.config.CP.API[APIType];
         var url = API.urls.blockcypher.balance;
         if (network == null) {
            network = API.default.network;
         }
         url = url.split("%address%").join(address).split("%network%").join(network);
         this.server.request({
      		url: url,
      		method: "GET",
      		json: true
      	}, (error, response, body) => {
            if (error) {
               reject(error);
            } else {
               resolve(body);
            }
      	});
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
   * the BlockCypher API.
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
            var fromWIF = fromWallet.toWIF();
            var txSkeleton = await this.newBTCTx(fromAddress, toAddress, amount, fee, network);
            var signedTx = this.signBTCTx(txSkeleton, fromWIF, network); //not async
            if (signedTx == null) {
               throw (new Error("Couldn't sign transaction."));
            }
            try {
               var sendTxResult = await this.sendBTCTx(signedTx, network);
            } catch (err) {
               throw (err);
            }
            return (sendTxResult);
            break;
         default:
            throw (new Error("Unsupported API type \""+APIType+"\"."));
            break;
      }
      throw (new Error("Unknown error when sending transaction."));
   }

   /**
   * Creates a new BlockCypher Bitcoin transaction skeleton for use with the {@link signBTCTx} function.
   *
   * @param {String} fromAddress The address sending the transaction.
   * @param {String} toAddress The address receiving the transaction.
   * @param {String|Number} satAmount The amount, in satoshis, to send to <code>toAddress</code>.
   * @param {String|Number} satFees The miner fees, in satoshis, to include with the transaction.
   * @param {String} [network=null] The sub-network, if applicable, for which to create the
   * new transaction skeleton. Valid values include "main" and "test3".
   * If <code>null</code>, the default network specified in
   * <code>config.CP.API.bitcoin.default.network</code> is used.
   *
   * @return {Promise} The resolved promise will include a native JavaScript object
   * containing the unsigned transaction skeleton. The rejected promise will contain the
   * error response.
   */
   newBTCTx (fromAddress, toAddress, satAmount, satFees, network=null) {
     var promise = new Promise((resolve, reject) => {
        var API = this.server.config.CP.API.bitcoin;
        var url = API.urls.blockcypher.createtx;
        if (network == null) {
           network = API.default.network;
        }
        var token = this.server.config.CP.API.tokens.blockcypher;
        url = url.split("%network%").join(network).split("%token%").join(token);
        var requestBody = {
           "inputs":[{"addresses":[fromAddress]}],
           "outputs":[{"addresses":[toAddress],
           "value": Number(satAmount)}],
           "fees":Number(satFees)
        };
        this.server.request({
           url: url,
           method: "POST",
           body:requestBody,
           json: true
        }, function (error, response, body){
           if (error) {
              reject (error);
           } else {
              if ((body == undefined) || (body == null)) {
                 reject (response);
                 return;
              }
              if ((body.errors != undefined) && (body.errors != null)) {
                 if (body.errors.length > 0) {
                    reject (body.errors);
                 } else {
                    resolve (body);
                 }
              } else {
                 resolve (body);
              }
           }
        });
     });
     return (promise);
  }

  /**
  * Signs a BlockCypher-generated Bitcoin transaction skeleton with a keypair in WIF format.
  *
  * @param {Object} txObject The transaction skeleton object to sign.
  * @param {Object} WIF The Wallet Import Format data to use for signing.
  * @param {String} [network=null] The sub-network, if applicable, for which the
  * transaction skeleton has been created. Valid values include "main" and "test3".
  * If <code>null</code>, the default network specified in
  * <code>config.CP.API.bitcoin.default.network</code> is used.
  *
  * @return {Object} The signed Bitcoin transaction object (which can be sent to the network).
  */
  signBTCTx (txObject, WIF, network=null) {
     if (network == null) {
        network = this.server.config.CP.API.bitcoin.default.network;
     }
  	if (network == "main") {
  		var keys = keys = new this.server.bitcoin.ECPair.fromWIF(WIF);
  	} else {
  		keys = new this.server.bitcoin.ECPair.fromWIF(WIF, this.server.bitcoin.networks.testnet);
  	}
  	try {
        var pubkeys = new Array();
        var signatures = txObject.tosign.map(function(tosign) {
          pubkeys.push(keys.publicKey.toString("hex"));
          return (this.signToDER(tosign, keys.privateKey).toString("hex"));
       }, this);
  		txObject.signatures = signatures;
  		txObject.pubkeys = pubkeys;
  	} catch (err) {
        console.error(err.stack);
  		txObject = null;
  	}
  	return (txObject);
  }

  /**
  * Signs an input hexadecimal string and returns a DER-encoded signature.
  *
  * @param {String} toSignHex Hexadecimal-encoded data string to sign.
  * @param {Buffer} privateKeyBuffer The private key with which to sign <code>toSignHex</code>.
  *
  * @return {Buffer} The DER-encoded, signed message. Use <code>toString("hex")</code> to get the
  * hexadecimal string representation of the output.
  */
  signToDER (toSignHex, privateKeyBuffer) {
     var sigObj = this.server.secp256k1.sign(Buffer.from(toSignHex, "hex"), privateKeyBuffer);
     return (this.server.secp256k1.signatureExport(sigObj.signature));
  }

  /**
  * Sends a signed Bitcoin transaction skeleton via the BlockCypher API.
  *
  * @param {Object} txObject The BlockCypher transaction skeleton transaction to send.
  * @param {String} [network=null] The Bitcoin sub-network for which the
  * transaction is intended. Valid values include "main" and "test3".
  * If <code>null</code>, the default network specified in
  * <code>config.CP.API.bitcoin.default.network</code> is used.
  *
  * @return {Promise} The resolved promise will include a native JavaScript object
  * containing the parsed response from the API endpoint. The rejected promise will
  * contain an error object.
  */
  sendBTCTx(txObject, network=null) {
     /*
     TODO: Future update example to build transaction from scratch:

     var key = bitcoin.ECKey.fromWIF("L1Kzcyy88LyckShYdvoLFg1FYpB5ce1JmTYtieHrhkN65GhVoq73");
     var tx = new bitcoin.TransactionBuilder();
     tx.addInput("d18e7106e5492baf8f3929d2d573d27d89277f3825d3836aa86ea1d843b5158b", 1);
     tx.addOutput("12idKQBikRgRuZEbtxXQ4WFYB7Wa3hZzhT", 149000);
     tx.sign(0, key);
     console.log(tx.build().toHex());
     */
     var promise = new Promise((resolve, reject) => {
        var API = this.server.config.CP.API.bitcoin;
        var url = API.urls.blockcypher.sendtx;
        if (network == null) {
           network = API.default.network;
        }
        var token = this.server.config.CP.API.tokens.blockcypher;
        url = url.split("%network%").join(network).split("%token%").join(token);
        this.server.request({
            url: url,
            method: "POST",
            body: txObject,
            json: true
     	   }, (error, response, body) => {
           if ((body == undefined) || (body == null)) {
              reject (response);
              return;
           }
           if (error) {
              reject(error);
           } else {
              //do we want to catch and reject JSON-RPC errors here?
              resolve(body);
           }
       });
     });
  	return (promise);
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
