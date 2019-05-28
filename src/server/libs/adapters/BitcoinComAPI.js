/**
* @file Bitcoin Cash adapter for blockchain interactions via the bitcoin.com API
*
* @version 0.5.0
* @author Patrick Bay
* @copyright MIT License
*/

const BitcoinCashNative = require("./BitcoinCashNative");
const BTCClient = require('bitcoin-core');
const bitcoreCash = require('bitcore-lib-cash');
const path = require("path");

/**
* @class Bitcoin Cash adapter using bitcoin.com's RPC API.
* @extends EventEmitter
*/
module.exports = class BitcoinComAPI extends BitcoinCashNative {

   /**
   * Creates a new instance of the native remote bitcoin.com adapter.
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
   * Initializes the instance by checking dependencies, downloading any
   * missing component, and starting the native client.
   *
   * @return {Boolean} True if the initialization could be succesfully completed,
   * false otherwise.
   *
   * @async
   */
   async initialize() {
      return (true);
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
   *
   * @see https://www.blockcypher.com/dev/bitcoin/#address-full-endpoint
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
         var API = this.server.config.CP.API.bitcoincash;
         var url = API.urls.bitcoincom.balance;
         if (network == null) {
           network = API.default.network;
         }
         if ((network == "main") || (network == "livenet")) {
            network = "mainnet";
         }
         if ((network == "test") || (network == "test3") || (network == "testnet")) {
            network = "trest";
         } else {
            network = "rest";
         }
         //address must be Bitcoin Cash style (base58/legacy not supported)
         url = url.split("%network%").join(network).split("%address%").join(address);
         this.server.request({
             url: url,
             method: "GET",
             json: true,
             headers: {
                "Content-Type": "application/json"
              }
         }, (error, response, body) => {
           if ((body == undefined) || (body == null)) {
               reject (response);
               return;
           }
           if (error) {
               reject(error);
           } else {
               var resultObj = new Object();
               resultObj.address = body.legacyAddress;
               resultObj.bchaddress = body.cashAddress;
               resultObj.balance = String(body.balanceSat);
               resultObj.unconfirmed_balance = String(body.unconfirmedBalanceSat);
               resultObj.final_balance = this.server.bigInt(body.balanceSat).plus(this.server.bigInt(body.unconfirmedBalanceSat)).toString(10);
               resolve(resultObj);
           }
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
   * [server.]{@link CryptocurrencyHandler#server}<code>namespace.cp.wallets.bitcoincash</code> wallet.
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
   *
   * @see https://developer.bitcoin.com/rest/docs/rawtransactions
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
      if ((network == "main") || (network == "livenet")) {
         network = "mainnet";
      }
      if ((network == "test") || (network == "test3")) {
         network = "testnet";
      }
      var fromAddress = this.getAddress(fromWallet, network);
      switch (APIType) {
         case "bitcoincash":
            var UTXOList = await this.getUTXOList(fromAddress, network);
            var signingKey = new bitcoreCash.PrivateKey(fromWallet.toWIF());
            var txHex = await this.buildRawTransaction(UTXOList, fromAddress, toAddress, signingKey, network, amount, fee);
            var API = this.server.config.CP.API.bitcoincash;
            var url = API.urls.bitcoincom.sendtx;
            if (network == null) {
               network = API.default.network;
            }
            if ((network == "main") | (network == "mainnet") || (network == "livenet")) {
               network = "rest";
            }
            if ((network == "test") || (network == "test3") || (network == "testnet")) {
               network = "trest";
            }
            url = url.split("%network%").join(network);
            var sendTxObject = new Object();
            sendTxObject.hexes = [txHex];
            var promise = new Promise((resolve, reject) => {
               this.server.request({
                  url: url,
                  method: "POST",
                  json: true,
                  body: sendTxObject,
                  headers: {
                     "Content-Type": "application/json"
                    }
               }, (error, response, body) => {
                  if ((body == undefined) || (body == null)) {
                     reject (response);
                     return;
                  }
                  if (error) {
                     reject(error);
                  } else {
                     var txObject = new Object();
                     txObject.tx = new Object();
                     txObject.tx.hash = body[0];
                     resolve(txObject)
                  }
               });
            });
            return (await promise);
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
   * Valid <code>network</code> types include "main", "test", or any common
   * BCH variant of these.
   *
   * @return {Promise} The returned promise resolves with an array of unspent
   * transaction objects or rejects with an <code>Error</code>.
   *
   * @see https://developer.bitcoin.com/rest/docs/address#address-utxos-bulk
   */
   async getUTXOList(address, network="main") {
      var promise = new Promise((resolve, reject) => {
         var API = this.server.config.CP.API.bitcoincash;
         var url = API.urls.bitcoincom.gettxs;
         if (network == null) {
         network = API.default.network;
         }
         if ((network == "main") || (network == "mainnet") || (network == "livenet") || (network == "rest")) {
            network = "mainnet";
         }
         if ((network == "test") || (network == "test3") || (network == "testnet") || (network == "trest")) {
            network = "testnet";
         }
         switch (network) {
            case "mainnet":
               var addressCash = new bitcoreCash.Address(address, bitcoreCash.livenet);
               break;
            case "testnet":
               var addressCash = new bitcoreCash.Address(address, bitcoreCash.testnet);
               break;
            default:
               throw (new Error("Unrecognized network \""+network+"\""));
               break;
         }
         addressCash = addressCash.toString();
         if ((network == "main") || (network == "mainnet") || (network == "livenet")) {
            network = "rest";
         }
         if ((network == "test") || (network == "test3") || (network == "testnet")) {
            network = "trest";
         }
         url = url.split("%network%").join(network).split("%address%").join(addressCash);
         this.server.request({
            url: url,
            method: "GET",
            json: true,
            headers: {
               "Content-Type": "application/json"
              }
         }, (error, response, body) => {
            if ((body == undefined) || (body == null)) {
               reject (response);
            }
            if (error) {
               reject (error);
            } else {
               var utxoList = this.parseTransactionsList(body);
               resolve (utxoList);
            }
         });
      });
      return (promise);
   }

   /**
   * Parses a transaction list received for a specific address from the CruptoAPIs
   * address transactions endpoint to generate a list of unspent transaction output
   * objects.
   *
   * @param {Object} rawUTXOsObj An object containing a list of raw UTXOs and other address
   * information received from the bitcoin.com API
   * @param {Boolean} [genericUTXOFormat=true] If true, the generated list
   * will contain generic UTXO objects, otherwise it will contain BitCore
   * <code>Transaction.UnspentOutput</code> instances.
   *
   * @return {Array} An indexed list of UTXOs for the <code>targetAddress</code>
   * that can be used to generate a transaction. Each element will be either
   * a generic object or a BitCore <code>Transaction.UnspentOutput</code> instance,
   * depending on the value of the <code>genericUTXOFormat</code> parameter.
   *
   * @see https://docs.cryptoapis.io/#bch-address-transactions-endpoint
   */
   parseTransactionsList(rawUTXOsObj, genericUTXOFormat=true) {
      var returnList = new Array();
      var rawTxList = rawUTXOsObj.utxos;
      var targetAddress = rawUTXOsObj.cashAddress;
      var scriptPubKey = rawUTXOsObj.scriptPubKey;
      for (var count=0; count < rawTxList.length; count++) {
         var currentTx = rawTxList[count];
         var txid = currentTx.txid;
         var vout = currentTx.vout;
         var satoshiAmount = String(currentTx.satoshis);
         if (genericUTXOFormat == true) {
            var utxo = new Object();
            utxo.txid = txid,
            utxo.vout = vout,
            utxo.address = targetAddress,
            utxo.scriptPubKey = scriptPubKey,
            utxo.satoshis = parseInt(satoshiAmount, 10),
            utxo.conformations = currentTx.confirmations,
            utxo.spendable = true;
         } else {
            utxo = new bitcoreCash.Transaction.UnspentOutput({
               txid: txid,
               vout: vout,
               address: targetAddress,
               scriptPubKey: scriptPubKey,
               satoshis: parseInt(satoshiAmount, 10),
               conformations: currentTx.confirmations,
               spendable:true
            });
         }
         returnList.push(utxo);
      }
      return (returnList);
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

  toString() {
     return ("[object BitcoinComAPI]");
  }

}
