const bitcoin = require('bitcoinjs-lib');

/**
* @file Creates a proxy CypherPoker Smart Contract and defines a few blockchain utility functions.
*
* @example
* Client Request -> {
  "jsonrpc": "2.0",
  "method": "CPSC_Create",
  "id": "CPSC9052131974613838",
  "params": {
    "contractID": "14837468275268462",
    "players": [
      {
        "_registrations": {},
        "_privateID": "9128d45d296e59642d6d149dab39b40e912bba0d3e46e30150dc59041bf954b1",
        "_info": {
          "alias": "me"
        },
        "_ready": true,
        "_isDealer": true,
        "_isSmallBlind": true
        ],
        "_hasBet": false,
        "_dealtCards": [],
        "_selectedCards": [
          "0x94a32e3e65e9d4ea",
          "0x3bd8fcbf2979960b"
        ]
      },
      {
        "_registrations": {},
        "_privateID": "92360d014d471cc10f1c147c18170c89e90cc0f29a38fa5a95e8ab50c2f45c75",
        "_info": {
          "alias": "A player"
        },
        "_ready": true,
        "_isDealer": false,
        "_isBigBlind": true,
        "_hasBet": false
      }
    ],
    "prime": "0xdb71c83d5d7322a3",
    "cardDecks": {
      "faceup": [
        {
          "_mapping": "0x6db8e41eaeb99150",
          "name": "Ace of Spades",
          "shortname": "A♠",
          "suit": "spades",
          "colour": "black",
          "value": 1,
          "highvalue": 14,
          "imageURI": "./assets/cards/AS.svg"
        },
        {
          "_mapping": "0x6db8e41eaeb99151",
          "name": "Two of Spades",
          "shortname": "2♠",
          "suit": "spades",
          "colour": "black",
          "value": 2,
          "highvalue": 2,
          "imageURI": "./assets/cards/2S.svg"
        },
        ...
      ],
      "facedown": [],
      "dealt": [],
      "public": []
    },
    "user_token": "5601058615055693",
    "server_token": "9373082449982535"
  }
}

* Server Response -> -{
  "jsonrpc": "2.0",
  "result": {
    "contract": {
      "contractID": "14837468275268462",
      "players": [
        {
          "_registrations": {},
          "_privateID": "9128d45d296e59642d6d149dab39b40e912bba0d3e46e30150dc59041bf954b1",
          "_info": {
            "alias": "me"
          },
          "_ready": true,
          "_isDealer": true,
          "_isSmallBlind": true,
          "privateID": "9128d45d296e59642d6d149dab39b40e912bba0d3e46e30150dc59041bf954b1",
          "agreed": true
        },
        {
          "_registrations": {},
          "_privateID": "92360d014d471cc10f1c147c18170c89e90cc0f29a38fa5a95e8ab50c2f45c75",
          "_info": {
            "alias": "A player"
          },
          "_ready": true,
          "_isDealer": false,
          "_isBigBlind": true,
          "privateID": "92360d014d471cc10f1c147c18170c89e90cc0f29a38fa5a95e8ab50c2f45c75",
          "agreed": false
        }
      ],
      "prime": "0xdb71c83d5d7322a3",
      "cardDecks": {
        "faceup": [
          {
            "_mapping": "0x6db8e41eaeb99150",
            "name": "Ace of Spades",
            "shortname": "A♠",
            "suit": "spades",
            "colour": "black",
            "value": 1,
            "highvalue": 14,
            "imageURI": "./assets/cards/AS.svg"
          },
          {
            "_mapping": "0x6db8e41eaeb99151",
            "name": "Two of Spades",
            "shortname": "2♠",
            "suit": "spades",
            "colour": "black",
            "value": 2,
            "highvalue": 2,
            "imageURI": "./assets/cards/2S.svg"
          },
          ...
        ],
        "facedown": [],
        "dealt": [],
        "public": []
      }
    }
  },
  "id": "CPSC9052131974613838"
}
*/
async function CPSC_Create (sessionObj) {
   if ((namespace.websocket == null) || (namespace.websocket == undefined)) {
      sendError(JSONRPC_ERRORS.INTERNAL_ERROR, "No WebSocket Session server defined.", sessionObj);
      return (false);
   }
   var requestData = sessionObj.requestObj;
   var requestParams = requestData.params;
   if ((requestParams.server_token == undefined) || (requestParams.server_token == null) || (requestParams.server_token == "")) {
      sendError(JSONRPC_ERRORS.INVALID_PARAMS_ERROR, "Invalid server token.", sessionObj);
      return(false);
   }
   if ((requestParams.user_token == undefined) || (requestParams.user_token == null) || (requestParams.user_token == "")) {
      sendError(JSONRPC_ERRORS.INVALID_PARAMS_ERROR, "Invalid user token.", sessionObj);
      return(false);
   }
   var responseObj = new Object();
   var connectionID = namespace.websocket.makeConnectionID(sessionObj); //makeConnectionID defined in WebSocket_Handshake.js
   var privateID = namespace.websocket.makePrivateID(requestParams.server_token, requestParams.user_token);
   if (privateID == null) {
      //must have active WSS session!
      sendError(JSONRPC_ERRORS.ACTION_DISALLOWED, "Not allowed to create game contracts.", sessionObj);
      return(false);
   }
   var resultObj = new Object(); //result to send in response
   var gameContracts = getGameContracts(privateID);
   if (gameContracts.length > 10) {
      sendError(JSONRPC_ERRORS.ACTION_DISALLOWED, "Too many open game contracts.", sessionObj);
      return(false);
   }
   var newContract = new Object();
   //check to make sure all required contract parameters are there:
   if (typeof(requestParams) != "object") {
      sendError(JSONRPC_ERRORS.INVALID_PARAMS_ERROR, "Bad parameters object.", sessionObj);
      return(false);
   }
   if ((requestParams.contractID == undefined) || (requestParams.contractID == null) || (requestParams.contractID == "")) {
      sendError(JSONRPC_ERRORS.INVALID_PARAMS_ERROR, "Invalid contractID.", sessionObj);
      return(false);
   }
   if ((requestParams.contractID == undefined) || (requestParams.contractID == null) || (requestParams.contractID == "")) {
      sendError(JSONRPC_ERRORS.INVALID_PARAMS_ERROR, "Invalid contractID.", sessionObj);
      return(false);
   }
   if ((requestParams.players == undefined) || (requestParams.players == null) || (requestParams.players == "")) {
      sendError(JSONRPC_ERRORS.INVALID_PARAMS_ERROR, "Invalid players array.", sessionObj);
      return(false);
   }
   if (typeof(requestParams.players) != "object") {
      sendError(JSONRPC_ERRORS.INVALID_PARAMS_ERROR, "Invalid players array.", sessionObj);
      return(false);
   }
   if (typeof(requestParams.players.length) != "number") {
      sendError(JSONRPC_ERRORS.INVALID_PARAMS_ERROR, "Invalid players array.", sessionObj);
      return(false);
   }
   if (requestParams.players.length < 2) {
      sendError(JSONRPC_ERRORS.INVALID_PARAMS_ERROR, "Invalid players array.", sessionObj);
      return(false);
   }
   var numAgreed = 0;
   for (var count = 0; count < requestParams.players.length; count++) {
      var player = requestParams.players[count];
      if ((player.privateID == null) || (player.privateID == undefined) || (player.privateID == "")) {
         player.privateID = player._privateID;
      }
      if ((player.privateID == null) || (player.privateID == undefined) || (player.privateID == "")) {
         sendError(JSONRPC_ERRORS.INVALID_PARAMS_ERROR, "Invalid player private ID.", sessionObj);
         return(false);
      }
      //sanitize keys if accidentally included
      try {
         player.keychain = "";
         delete player.keychain;
      } catch (err) {}
      try {
         player._keychain = "";
         delete player._keychain;
      } catch (err) {}
      if (privateID == player.privateID) {
         //(only) player who created this automatically agrees
         player.agreed = true;
         numAgreed++;
      } else {
         player.agreed = false;
      }
   }
   if (numAgreed > 1) {
      sendError(JSONRPC_ERRORS.INVALID_PARAMS_ERROR, "Can't join more than once.", sessionObj);
      return (false);
   }
   if (typeof(requestParams.prime) != "string") {
      sendError(JSONRPC_ERRORS.INVALID_PARAMS_ERROR, "Invalid prime value.", sessionObj);
      return (false);
   }
   if (requestParams.prime.length == 0) {
      sendError(JSONRPC_ERRORS.INVALID_PARAMS_ERROR, "Invalid prime value.", sessionObj);
      return (false);
   }
   if (typeof(requestParams.cardDecks) != "object") {
      sendError(JSONRPC_ERRORS.INVALID_PARAMS_ERROR, "Invalid cardDecks object.", sessionObj);
      return (false);
   }
   if (typeof(requestParams.cardDecks.faceup) != "object") {
      sendError(JSONRPC_ERRORS.INVALID_PARAMS_ERROR, "Invalid cardDecks.faceup array.", sessionObj);
      return (false);
   }
   //contract creation includes submission of face-up (generated) cards:
   if (requestParams.cardDecks.faceup.length < 52) {
      sendError(JSONRPC_ERRORS.INVALID_PARAMS_ERROR, "Invalid cardDecks.faceup array.", sessionObj);
      return (false);
   }
   //... but not other values:
   if (typeof(requestParams.cardDecks.facedown) != "object") {
     sendError(JSONRPC_ERRORS.INVALID_PARAMS_ERROR, "Invalid cardDecks.facedown array.", sessionObj);
     return (false);
   }
   if (typeof(requestParams.cardDecks.facedown.length) != "number") {
     sendError(JSONRPC_ERRORS.INVALID_PARAMS_ERROR, "Invalid cardDecks.facedown array.", sessionObj);
     return (false);
   }
   if (typeof(requestParams.cardDecks.dealt) != "object") {
     sendError(JSONRPC_ERRORS.INVALID_PARAMS_ERROR, "Invalid cardDecks.dealt array.", sessionObj);
     return (false);
   }
   if (typeof(requestParams.cardDecks.dealt.length) != "number") {
     sendError(JSONRPC_ERRORS.INVALID_PARAMS_ERROR, "Invalid cardDecks.dealt array.", sessionObj);
     return (false);
   }
   newContract = requestParams;
   //sanitize private tokens!
   newContract.user_token = "";
   newContract.server_token = "";
   delete newContract.user_token;
   delete newContract.server_token;
   resultObj.contract = newContract;
   //looks okay; if it doesn't fill up it'll be returned
   gameContracts.push(newContract);
   sendResult(resultObj, sessionObj);
   return(true);
}

/**
* Retrieves an indexed array of game contract objects
*
* @param {Event} event A standard WebSocket close event.
*/
function getGameContracts(connectionID) {
   if ((namespace.cpsc[connectionID] == null) || (namespace.cpsc[connectionID] == undefined) || (namespace.cpsc[connectionID] == "")) {
      //create a new container
      namespace.cpsc[connectionID] = new Array();
   }
   return (namespace.cpsc[connectionID]);
}

/**
* Handles a WebSocket close / disconnect event and notifies all active / live
* sessions of the disconnection.
*
* @param {Event} event A standard WebSocket close event.
*/
function handleWebSocketClose(event) {
   try{
      for (var connectionID in namespace.websocket.connections) {
         if ((namespace.websocket.connections[connectionID] != undefined) && (namespace.websocket.connections[connectionID] != null)) {
            for (var count = 0; count < namespace.websocket.connections[connectionID].length; count++) {
               var connectionObj = namespace.websocket.connections[connectionID][count];
               // connectionObj.private_id disconnected
            }
         }
      }
   } catch (err) {
      console.error(err.stack);
   }
}

/**
* Retrieves a live blockchain balance for an address.
*
* @param {String} address The address for which to retrieve the live balance.
* @param {String} [APIType="bitcoin"] The API endpoint configuration to use for
* the API call. This value must match one of the definitions found in the
* <code>config.CPSC.API</code> object.
* @param {String} [network=null] The sub-network, if applicable, from which
* to retrieve the live balance. Valid values include "btc/main" and "btc/test3".
* If <code>null</code>, the default network specified in
* <code>config.CPSC.API[APIType].default.network</code> is used.
*
* @return {Promise} The resolved promise will include a native JavaScript object
* containing the parsed response from the API endpoint. The rejected promise will
* contain the error object.
*/
function getBlockchainBalance(address, APIType="bitcoin", network=null) {
   console.log("getBlockchainBalance(\""+address+"\")")
   var promise = new Promise(function(resolve, reject) {
      var API = config.CPSC.API[APIType];
      var url = API.url.balance;
      if (network == null) {
         network = API.default.network;
      }
      url = url.split("%address%").join(address).split("%network%").join(network);
      request({
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
* Signs a BlockCypher-generated Bitcoin transaction skeleton with a keypair in WIF format.
*
* @param {Object} txObject The transaction skeleton object to sign.
* @param {Object} WIF The Wallet Import Format data to use for signing.
* @param {String} [network=null] The sub-network, if applicable, for which the
* transaction skeleton has been created. Valid values include "btc/main" and "btc/test3".
* If <code>null</code>, the default network specified in
* <code>config.CPSC.API.bitcoin.default.network</code> is used.
*
* @return {Object} The signed Bitcoin transaction object (which can be sent to the network).
*/
function signBTCTx (txObject, WIF, network=null) {
   console.log ("signBTCTx("+txObject+", \""+network+"\")")
   if (network == null) {
      network = config.CPSC.API.bitcoin.default.network;
   }
	if (network == "btc/test3") {
		var keys = new bitcoin.ECPair.fromWIF(WIF, bitcoin.networks.testnet);
	} else {
		keys = new bitcoin.ECPair.fromWIF(WIF);
	}
	var pubkeys = [];
	try {
		var signatures  = txObject.toSign.map(function(toSign) {
			pubkeys.push(keys.getPublicKeyBuffer().toString('hex'));
			return (keys.sign(Buffer.from(toSign, "hex")).toDER().toString("hex"));
		});
		txObject.signatures = signatures;
		txObject.pubkeys = pubkeys;
	} catch (err) {
		txObject = null;
	}
	return (txObject);
}

/**
* Sends a signed Bitcoin transaction skeleton via the BlockCypher API.
*
* @param {Object} txObject The transaction to send.
* @param {String} [network=null] The Bitcoin sub-network for which the
* transaction is intended. Valid values include "btc/main" and "btc/test3".
* If <code>null</code>, the default network specified in
* <code>config.CPSC.API.bitcoin.default.network</code> is used.
*
* @return {Promise} The resolved promise will include a native JavaScript object
* containing the parsed response from the API endpoint. The rejected promise will
* contain the error object.
*/
function sendBTCTx(txObject, network=null) {
   console.log("sendBTCTx("+txObject+", \""+network+"\")");
   var promise = new Promise(function(resolve, reject) {
      var API = config.CPSC.API.bitcoin;
      var url = API.url.send;
      if (network == null) {
         network = API.default.network;
      }
      var token = API.tokens.blockcypher;
      url = url.split("%network%").join(network).split("%token%").join(token);
      request({
         url: url,
   		method: "POST",
   		body: txObject,
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

if (namespace.cpsc == undefined) {
   namespace.cpsc = new Object();
}

namespace.cpsc.getGameContracts = getGameContracts;
namespace.cpsc.getBlockchainBalance = getBlockchainBalance;
