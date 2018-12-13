/**
* @file Contains information and functionality associated with a single managed account.
*
* @version 0.2.3
* @author Patrick Bay
* @copyright MIT License
*/

/**
* @class Information and functionality associated with a single managed account.
* The account is independently managed by either a TTP service or a smart contract
* and represents a deposit by the player that can be used to provide a balance
* in games.
*/
class CypherPokerAccount extends EventDispatcher {

   /**
   * Creates a new player account instance.
   *
   * @param {CypherPoker} cypherpokerRef A reference to a {@link CypherPoker}
   * instance through which managed account requests can be made.
   * @param {Object} [initData=null] Data with which to initialize the new instance.
   */
   constructor(cypherpokerRef, initData=null) {
      super();
      this._cypherpoker = cypherpokerRef;
      if (initData != null) {
         for (var item in initData) {
            try {
               this[item] = initData[item];
            } catch (err) {
            }
         }
      }
   }

   /**
   * @property {CypherPoker} cypherpoker A reference to the active {@link CypherPoker}
   * instance through which API functions can be invoked.
   *
   * @readonly
   */
   get cypherpoker() {
      return (this._cypherpoker);
   }

   /**
   * @property {String} address The managed cryptocurrency deposit address
   * associated with the account. Typically the address is also the unique account
   * identifier ({@link CypherPokerAccount#id}), but may differ.
   */
   set address(addrSet) {
      this._address = addrSet;
   }

   get address() {
      if (this._address == undefined) {
         this._address = null;
      }
      return (this._address);
   }

   /**
   * @property {String} type The type of cryptocurrency associated with the
   * {@link CypherPokerAccount#address}. Valid types include: "bitcoin"
   */
   set type(typeSet) {
      this._type = typeSet;
   }

   get type() {
      if (this._type == undefined) {
         this._type = null;
      }
      return (this._type);
   }

   /**
   * @property {String} network The network sub-type, if applicable.
   * For example, if {@link CypherPokerAccount#type} is "bitcoin",
   * the <code>network</code> may be "main" or "test3".
   */
   set network(networkSet) {
      this._network = networkSet;
   }

   get network() {
      if (this._network == undefined) {
         this._network = null;
      }
      return (this._network);
   }

   /**
   * @property {BigInteger} balance="0" The current total account balance. Note that
   * this is different than the {@link CypherPokerPlayer#balance} property
   * which reflects the player balance for a single game (e.g. buy-in).
   */
   set balance(balanceSet) {
      this._balance = bigInt(balanceSet);
   }

   get balance() {
      if (this._balance == undefined) {
         this._balance = bigInt(0);
      }
      return (this._balance);
   }

   /**
   * @property {String} balance=null The password associated with the account.
   */
   set password(pwSet) {
      this._password = pwSet;
   }

   get password() {
      if (this._password == undefined) {
         this._password = null;
      }
      return (this._password);
   }

   /**
   * Returns a condensed data object with copies of most of the properties of this
   * instance. Use the returned data from this function rathen than using
   * <code>JSON.stringify</code> on the instance as this may cause
   * a circular reference error.
   *
   * @param {Boolean} [includePassword=false] If true, the account password
   * is included in the returned data.
   *
   * @return {Object} A condensed data object containing copies of the
   * most properties of this instance.
   */
   toObject(includePassword=false) {
      var returnObj = new Object();
      returnObj.address = this.address;
      returnObj.type = this.type;
      returnObj.network = this.network;
      returnObj.balance = this.balance.toString(10);
      if (includePassword) {
         returnObj.password = this.password;
      }
      delete returnObj.onEventPromise;
      return (returnObj);
   }

   /**
   * Creates a new account by calling the "CP_Account"/"new" RPC service using
   * the properties of this instance.
   *
   * @return {Promise} The promise resolves with a <code>true</code> value
   * if the account was succcessfully created, <code>false</code> otherwise.
   * @async
   */
   async create() {
      if ((this.password == null) || (this.password == null)) {
         return (false);
      }
      var params = new Object();
      params.password = this.password;
      params.type = this.type;
      params.network = this.network;
      var JSONObj = await this.callAccountAPI("new", params);
      if (JSONObj.error != undefined) {
         console.error (JSONObj.error);
         return (false);
      }
      this._address = JSONObj.result.address;
      return (true);
   }

   /**
   * Updates this account's properties by calling the "CP_Account"/"info" RPC service.
   *
   * @return {Promise} The promise resolves with a <code>true</code> value
   * if the account was succcessfully updated. An <code>Error</code> object
   * is included with a rejection.
   * @async
   */
   async update() {
      if ((this.password == null) || (this.password == null)) {
         return (false);
      }
      var params = new Object();
      params.address = this.address;
      params.password = this.password;
      params.type = this.type;
      params.network = this.network;
      var JSONObj = await this.callAccountAPI("info", params);
      if (JSONObj.error != undefined) {
         this.balance = 0;
         throw(new Error(JSONObj.error.message));
      }
      //balance confirmed = JSONObj.result.confirmed
      this.balance = JSONObj.result.balance;
      return (true);
   }

   /**
   * Partially or fully cashes out the account, sending the funds to a
   * specified address.
   *
   * @param {String|Number|BigInteger} amount The full amount to send to
   * <code>toAddress</code>, including miner <code>fees</code>. This value is in the
   * smallest denominition of the associated cryptocurrency (e.g. satoshis if
   * <code>type="bitcoin</code>").
   * @param {String} toAddress The target or receiving address. This address
   * must be of the same cryptocurrency <code>type</code> and on the same
   * <code>network</code> as this account.
   * @param {String|Number|BigInteger} [fees=null] The miner fee to include
   * in this transaction in the smallest denomination of the associated cryptocurrency.
   * If <code>null</code>, the default miner fee is used. The amount that
   * will be received by <code>toAddress</code> will be the sending <code>amount</code>
   * minus this value.
   *
   * @return {Promise} The promise resolves with a <code>true</code> value
   * if the cashout was successfully completed. An <code>Error</code> object is
   * included with a rejection.
   * @async
   */
   async cashout(amount, toAddress, fees=null) {
      if ((this.password == "") || (this.password == null)) {
         throw(new Error("Account password not set"));
      }
      var params = new Object();
      params.address = this.address;
      params.password = this.password;
      params.type = this.type;
      params.network = this.network;
      params.toAddress = toAddress;
      if (bigInt.isInstance(amount)) {
         params.amount = amount.toString(10);
      } else {
         params.amount = String(amount);
      }
      if (fees != null) {
         if (bigInt.isInstance(fees)) {
            params.feeAmount = fees.toString(10);
         } else {
            params.feeAmount = String(fees);
         }
      }
      var JSONObj = await this.callAccountAPI("cashout", params);
      if (JSONObj.error != undefined) {
         throw (new Error(JSONObj.error.message));
      }
      this.balance = JSONObj.result.balance;
      return (true);
   }

   /**
   * Partially or fully transfers the account balance to another account.
   *
   * @param {String|Number|BigInteger} amount The full amount to transfer to
   * <code>toAddress</code>. This value is in the smallest denominition of the
   * associated cryptocurrency (e.g. satoshis if <code>type="bitcoin</code>").
   * @param {String} toAccount The target or receiving account. This account
   * must be of the same cryptocurrency <code>type</code> and on the same
   * <code>network</code> as this account.
   *
   * @return {Promise} The promise resolves with a <code>true</code> value
   * if the transfer was successfully completed. An <code>Error</code>
   * object is included with a rejection.
   * @async
   */
   async transfer(amount, toAccount) {
      if ((this.password == "") || (this.password == null)) {
         throw(new Error("Account password not set"));
      }
      var params = new Object();
      params.address = this.address;
      params.password = this.password;
      params.type = this.type;
      params.network = this.network;
      params.toAccount = toAccount;
      if (bigInt.isInstance(amount)) {
         params.amount = amount.toString(10);
      } else {
         params.amount = String(amount);
      }
      var JSONObj = await this.callAccountAPI("transfer", params);
      if (JSONObj.error != undefined) {
         throw (new Error(JSONObj.error.message));
      }
      this.balance = JSONObj.result.balance;
      return (true);
   }

   /**
   * Asynchronously calls the account API and returns the JSON-RPC 2.0 result / error
   * of the call.
   *
   * @param {String} action The account action to apply to the <code>APIFunc</code> call.
   * This value is automatically appended to the <code>params</code> object as an
   * <code>action</code> property and will override any existing <code>action</code> property.
   * @param {Object} [params=null] The parameters to include with the remote function call.
   * If <code>null</code>, an empty params object is created.
   * @param {String} [APIFunc="CP_Account"] The remote API function to invoke.
   *
   * @return {Promise} The promise resolves with the parsed JSON-RPC 2.0 result or
   * error (native object) of the call. Currently there is no rejection state.
   */
   async callAccountAPI(action, params=null, APIFunc="CP_Account") {
      if (params == null) {
         params = new Object();
      }
      var sendObj = new Object();
      for (var item in params) {
         sendObj[item] = params[item];
      }
      delete sendObj.onEventPromise;
      sendObj.action = action;
      sendObj.user_token = this.cypherpoker.p2p.userToken;
      sendObj.server_token = this.cypherpoker.p2p.serverToken;
      var requestID = "CP" + String(Math.random()).split(".")[1];
      var rpc_result = await RPC(APIFunc, sendObj, this.cypherpoker.p2p.webSocket, false, requestID);
      var result = JSON.parse(rpc_result.data);
      //since messages over web sockets are asynchronous the next immediate message may not be ours so:
      while (requestID != result.id) {
         rpc_result = await this.cypherpoker.p2p.webSocket.onEventPromise("message");
         result = JSON.parse(rpc_result.data);
         //we could include a max wait limit here
      }
      return (result);
   }

}
