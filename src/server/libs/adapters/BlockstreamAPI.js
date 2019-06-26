/**
* @file Bitcoin adapter for blockchain interactions via the Blockstream API
*
* @version 0.5.1
* @author Patrick Bay
* @copyright MIT License
*/

const BitcoinCoreNative = require("./BitcoinCoreNative");
const BTCClient = require('bitcoin-core');
//const bitcoreCash = require('bitcore-lib-cash');
const path = require("path");

/**
* @class Bitcoin adapter using Blockstream's RPC API.
* @extends EventEmitter
*/
module.exports = class BlockstreamAPI extends BitcoinCoreNative {

   /**
   * Creates a new instance of the native remote BlockstreamAPI adapter.
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
   * <code>server.namespace.cp.wallets.bitcoin</code> from which the sub-wallet will be derived.
   * @param {String} [APIType="bitcoin"] The API endpoint to use for retrieving address information.
   * @param {String} [network=null] The network or API sub-type to which the <code>addressOrPath</code>
   * belongs; for example "main" or "test". Default is "main".
   *
   * @return (Promise) The promise resolves with a JSON object containing information about
   * the address or derived wallet. Refer to the <a href="https://github.com/Blockstream/esplora/blob/master/API.md">Blockstream API reference</a>
   * for the properties of this object. The promise ends with a rejection if the API returns an error.
   *
   * @see https://github.com/Blockstream/esplora/blob/master/API.md
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
         wallet = this.server.namespace.cp.wallets.bitcoin.test;
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
         var API = this.server.config.CP.API.bitcoin;
         var url = API.urls.blockstream.balance;
         if (network == null) {
           network = API.default.network;
         }
         if ((network == "main") || (network == "mainnet") || (network == "livenet")) {
            network = "";
         }
         if ((network == "test") || (network == "test3") || (network == "testnet")) {
            network = "testnet";
         }
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
               try {
                  var resultObj = new Object();
                  var confBalance = this.server.bigInt(body.chain_stats.funded_txo_sum).minus(this.server.bigInt(body.chain_stats.spent_txo_sum));
                  var uncBalance = this.server.bigInt(body.mempool_stats.funded_txo_sum).minus(this.server.bigInt(body.mempool_stats.spent_txo_sum));
                  resultObj.address = body.address;
                  resultObj.balance = confBalance.toString(10);
                  resultObj.unconfirmed_balance = uncBalance.toString(10);
                  resultObj.final_balance = confBalance.plus(uncBalance).toString(10);
                  resolve(resultObj);
               } catch (err) {
                  reject (err);
               }
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
   * @param {String} [APIType="bitcoin"] The main cryptocurrency API type.
   * @param {String} [network=null] The cryptocurrency sub-network, if applicable, for the
   * transaction. Current <code>network</code> types include: "main" and "test". If <code>null</code>,
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
            if ((network == "main") || (network == "mainnet") || (network == "livenet")) {
               var fromWallet = this.server.namespace.cp.wallets.bitcoin.main.derivePath(API.default[network].cashOutAddrPath);
            } else {
               fromWallet = this.server.namespace.cp.wallets.bitcoin.test.derivePath(API.default[network].cashOutAddrPath);
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
   * <code>server.namespace.cp.wallets.bitcoin</code> wallet.
   * @param {String} toAddress The target or receipient address.
   * @param {String|Number} amount The amount to send to <code>toAddress</code> in the lowest
   * denomination of the associated cryptocurrency (e.g. satoshis if using Bitcoin).
   * @param {String|Number} [fee=null] The transaction fee to include in the transaction. The fee
   * is <i>in addition</i> to the <code>amount</code> being sent and is likewise denoted in
   * the smallest denomination for the cryptocurrency (e.g. satoshis if using Bitcoin Cash). If omitted
   * or <code>null</code>, the fee currently found in
   * [server.]{@link BlockCypherAPI#server}<code>config.CP.API[APIType].default.minerFee</code>
   * is used.
   * @param {String} [APIType="bitcoin"] The main API endpoint to use when posting the transaction.
   * @param {String} [network=null] The network or API sub-type for the transaction; for example "main" or "test3".
   *
   * @return {Object} The function resolves with the posted transaction object returned by
   * the RPC API or rejects with an <code>Error</code> object.
   *
   * @async
   *
   * @see https://developer.bitcoin.com/rest/docs/rawtransactions
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
      if ((network == "main") || (network == "mainnet") || (network == "livenet")) {
         network = "";
      }
      if ((network == "test") || (network == "test3")) {
         network = "testnet";
      }
      var fromAddress = this.getAddress(fromWallet, network);
      switch (APIType) {
         case "bitcoin":
            var UTXOList = await this.getUTXOList(fromAddress, network);
            if ((network == "test3") || (network == "testnet") || (network == "test")) {
               var signingKey = this.server.bitcoin.ECPair.fromWIF(fromWallet.toWIF(), this.server.bitcoin.networks.testnet);
            } else {
               signingKey = this.server.bitcoin.ECPair.fromWIF(fromWallet.toWIF());
            }
            var tx = await this.buildRawTransaction(UTXOList, fromAddress, toAddress, signingKey, network, amount, fee);
            var txHex = tx.build().toHex();
            var url = API.urls.blockstream.sendtx;
            url = url.split("%network%").join(network);
            var promise = new Promise((resolve, reject) => {
               this.server.request({
                  url: url,
                  method: "POST",
                  json: false,
                  body: txHex,
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
                     txObject.tx.hash = body;
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
   * BTC variant of these.
   *
   * @return {Promise} The returned promise resolves with an array of unspent
   * transaction objects or rejects with an <code>Error</code>.
   *
   * @see https://developer.bitcoin.com/rest/docs/address#address-utxos-bulk
   */
   async getUTXOList(address, network="main") {
      var promise = new Promise((resolve, reject) => {
         var API = this.server.config.CP.API.bitcoin;
         var url = API.urls.blockstream.getutxos;
         if (network == null) {
         network = API.default.network;
         }
         if ((network == "main") || (network == "mainnet") || (network == "livenet")) {
            network = "";
         }
         if ((network == "test") || (network == "test3")) {
            network = "testnet";
         }
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
            }
            if (error) {
               reject (error);
            } else {
               var utxoDetailsList = new Array();
               if (body.length > 0) {
                  for (var count=0; count < body.length; count++) {
                     this.getTransaction(body[count].txid, network).then (txObj => {
                        utxoDetailsList.push (txObj);
                        if (utxoDetailsList.length == body.length) {
                           var utxoList = this.parseTransactionsList(utxoDetailsList, address);
                           resolve (utxoList);
                        }
                     })
                  }
               } else {
                  //no transactions for address found
                  resolve ([]);
               }
            }
         });
      });
      return (promise);
   }

   /**
   * Retrieves a single transaction associated with an address.
   *
   * @param {String} txid The transaction id / hash to retrieve.
   * @param {String} [network="main"] The sub-network to which the <code>txid</code> belongs.
   * Valid <code>network</code> types include "main", "test", or any common
   * BTC variant of these.
   *
   * @return {Promise} The returned promise resolves with an object containing details
   * of the transaction or rejects with an <code>Error</code>.
   *
   * @see https://github.com/Blockstream/esplora/blob/master/API.md#get-txtxid
   */
   async getTransaction(txid, network="main") {
      var promise = new Promise((resolve, reject) => {
         var API = this.server.config.CP.API.bitcoin;
         var url = API.urls.blockstream.gettxs;
         if (network == null) {
         network = API.default.network;
         }
         if ((network == "main") || (network == "mainnet") || (network == "livenet")) {
            network = "";
         }
         if ((network == "test") || (network == "test3")) {
            network = "testnet";
         }
         url = url.split("%network%").join(network).split("%txid%").join(txid);
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
               resolve (body);
            }
         });
      });
      return (promise);
   }

   /**
   * Parses a transaction list received for a specific address from the Blockstream API
   * address transactions endpoint to generate a list of unspent transaction output
   * objects.
   *
   * @param {Array} rawUTXOsArr An Array containing a list of raw UTXOs and other address
   * information received from the Blockstream API.
   * @param {String} address The address with which the UTXO list is associated.
   *
   * @return {Array} An indexed list of UTXOs for the <code>targetAddress</code>
   * that can be used to generate a transaction.
   *
   * @see https://github.com/Blockstream/esplora/blob/master/API.md#get-addressaddresstxschainlast_seen_txid
   */
   parseTransactionsList(rawUTXOsArr, address) {
      var txList = new Array();
      for (var count=0; count < rawUTXOsArr.length; count++) {
         var currentTx = rawUTXOsArr[count];
         for (var vout = 0; vout < currentTx.vout.length; vout++) {
            var currentVOut = currentTx.vout[vout];
            if (currentVOut.scriptpubkey_address == address) {
               var newTXObj = new Object();
               newTXObj.txid = currentTx.txid;
               newTXObj.vout = vout;
               newTXObj.address = address;
               newTXObj.scriptPubKey = currentVOut.scriptpubkey;
               newTXObj.satoshis = String(currentVOut.value);
               newTXObj.amount = this.convertDenom(String(currentVOut.value), "satoshi", "bitcoin"); //this value is in Bitcoin
               if (currentTx.status.confirmed == true) {
                  //obviously now accurate but enough for this version...
                  newTXObj.confirmations = 1;
               } else {
                  newTXObj.confirmations = 0;
               }
               txList.push(newTXObj);
            }
         }
      }
      var returnList = new Array();
      for (count=0; count < txList.length; count++) {
         currentTx = txList[count];
         var utxo = new Object();
         utxo.txid = currentTx.txid,
         utxo.vout = currentTx.vout,
         utxo.address = currentTx.address,
         utxo.scriptPubKey = currentTx.scriptPubKey,
         utxo.satoshis = parseInt(currentTx.satoshis, 10),
         utxo.amount = currentTx.amount; //this value is in Bitcoin
         utxo.confirmations = currentTx.confirmations,
         utxo.spendable = true;
         returnList.push(utxo);
      }
      return (returnList);
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
   * networks include "main", "test3", and "regtest".
   * @param {String} amountSat The amount to send to the receiving address, in satoshis.
   * @param {String} feeSat The transaction fee to include with the transaction, in satoshis (this value
   *  is <i>in addition to</code> the <code>amountSat</code>)
   *
   * @return {Object} The raw, signed transaction in hexadecimal.
   * @async
   */
   async buildRawTransaction(UTXOList, fromAddress, toAddress, signingKey, network, amountSat, feeSat) {
      if ((network == "testnet") || (network == "test") || (network == "test3") || (network == "regtest")) {
         var tx = new this.server.bitcoin.TransactionBuilder(this.server.bitcoin.networks.testnet);
      } else {
         tx = new this.server.bitcoin.TransactionBuilder();
      }
      //all values are in satoshis
      var spentAmount = this.server.bigInt(0);
      var feeAmount = this.server.bigInt(feeSat);
      var amountNF = this.server.bigInt(amountSat); //amount (no fee)
      var totalAmount = this.server.bigInt(amountSat).plus(feeAmount); //amount including fee
      var numTxs = 0; //number of transactions to sign after adding inputs + outpus
      for (var count = 0; count < UTXOList.length; count++) {
         var utxo = UTXOList[count];
         var itxAmount = this.server.bigInt(this.convertDenom(String(utxo.amount), "bitcoin", "satoshis"));
         var txid = utxo.txid;
         var txindex = utxo.vout;
         if (spentAmount.plus(itxAmount).greaterOrEquals(totalAmount)) {
            //no additional inputs required (final transaction)
            var outputAmount = amountNF.minus(spentAmount);
            var changeAmount = itxAmount.minus(outputAmount).minus(feeAmount);
            tx.addInput(txid, txindex);
            tx.addOutput(toAddress, parseInt(outputAmount, 10)); //send remaining amount in input
            tx.addOutput(fromAddress, parseInt(changeAmount, 10)); //send change-fee
            numTxs++;
            break;
         } else {
            //additional inputs required or only 1 available
            tx.addInput(txid, txindex);
            tx.addOutput(toAddress, parseInt(itxAmount, 10)); //send full amount in input
            numTxs++;
         }
         spentAmount = spentAmount.plus(itxAmount);
      }
      for (var count = 0; count < numTxs; count++) {
         tx.sign(count, signingKey);
      }
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
  * @param {String} [APIType="bitcoin"] The main cryptocurrency API type.
  * @param {String} [network=null] The cryptocurrency sub-network, if applicable, for the
  * transaction. Current <code>network</code> types include "main", "test", and other common network
  * names for the cryptocurrency network. If <code>null</code>, the default network specified in
  * <code>config.CP.API[APIType].default.network</code> is used.
  *
  * @return {String} The estimated transaction fee, as a numeric string in the lowest denomination of the associated
  * cryptocurrency (e.g. satoshis if <code>APIType="bitcoin"</code>), based on the supplied <code>txData</code>,
  * <code>priority</code>, <code>APIType</code>, and <code>network</code>. If any parameter is invalid or unrecognized,
  * <code>null</code> is returned.
  * @async
  */
  async estimateTxFee (txData=null, priority=1, APIType="bitcoin", network=null) {
     if (this._fees == undefined) {
        this._fees = new Object();
     }
     try {
        switch (APIType) {
           case "bitcoin":
              var txSize = 270; //bytes
              if (txData != null) {
                 txSize = txData.length / 2; //hex-encoded binary data
              }
              if (this._fees[network] == undefined) {
                 //no base fee defined; use default
                 var API = this.server.config.CP.API[APIType];
                 return (API.default[network].minerFee);
              }
              var estimate = String(Math.ceil(this._fees[network].satPerByte * txSize));
              return (estimate);
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
  * transaction. Current <code>network</code> types include "main", "test", and similar network types.
  * If <code>null</code>, the default network specified in <code>config.CP.API[APIType].default.network</code>
  * is used.
  * @param {Boolean} [forceUpdate=false] If true, an update is forced even if the configured time limit
  * has not yet elapsed.
  *
  * @return {Promise} Resolves with the string "updated" if the fees for the API/network were succesfully updated or
  * "skipped" the configured time limit for updates has not yet elapsed. The promise is rejected with a standard
  * <code>Error</code> object if an update could not be successfully completed (any existing fees data is not changed).
  *
  * @see https://github.com/Blockstream/esplora/blob/master/API.md#get-fee-estimates
  * @private
  */
  updateTxFees(APIType="bitcoin", network=null, forceUpdate=false) {
     if (this._fees == undefined) {
        this._fees = new Object();
     }
     var promise = new Promise((resolve, reject) => {
        var API = this.server.config.CP.API[APIType];
        if ((network == null) || (network == "")) {
           network = API.default.network;
        }
        if (API.default[network].feeUpdateEnabled == false) {
          reject (new Error("Fee updates for \""+APIType+"/"+network+"\" disabled."));
          return;
        }
        if ((network == "main") || (network == "mainnet") || (network == "livenet")) {
           var networkName = "";
        }
        if ((network == "test") || (network == "test3")) {
           networkName = "testnet";
        }
        var url = API.urls.blockstream.fees;
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
        url = url.split("%network%").join(networkName);
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
              var blockCount = 4; //estimated number of blocks to include a transaction / calculate fee
              var satPerByte = body[String(blockCount)];
              this._fees[network] = new Object();
              this._fees[network].confs = blockCount;
              this._fees[network].satPerByte = satPerByte;
              var txSize = 270; //bytes (average)
              API.default[network].minerFee = String(Math.ceil(satPerByte * txSize)); //should be a string              
              resolve("updated");
           }
        });
     });
     return (promise);
  }

  /**
  * @private
  */
  toString() {
     return ("[object BlockstreamAPI]");
  }

}
