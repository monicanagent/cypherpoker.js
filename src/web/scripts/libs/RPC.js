/**
* @file Handles asynchronous JSON-RPC 2.0 requests to a HTTP / HTTPS,
* WebSocket / Secure WebSocket, or routed endpoint. Requires {@link EventPromise}
* to exist in the current execution context.
*
* @version 0.4.1
*/

/**
* @property {Number} __rpc_request_id unique RPC message id value that can be used
* across the application. Use {@link uniqueRPCID} to get a new unique value.
* @private
*/
var __rpc_request_id = 0;

/**
* Invokes a RPC (API) request through a HTTP, WebSocket, or routed interface.
*
* @param {String} method The remote procedure/method/function to invoke.
* @param {Object} param The parameters to include with the remote method.
* @param {XMLHttpRequest|WebSocket|router} transport The transport object to use for
* for the request. The request is handled automatically based on this object
* type.
* @param {Boolean} [generateOnly=false] Flag denoting whether the
* request should only be generated and returned (true), or processed and a
* Promise object returned (false).
* @param {String|Number} [msgID=null] ID to include with the request.
* In order to differentiate requests/responses, this value should always
* be unique. If not provided, an internal integer value is used instead.
* @param {Boolean} [resolveOnID=true] If true, the returned promise resolves
* <i>only</i> when a response is received matching the message ID of the request,
* otherwise the first server response or notification resolves the returned promise.
*
* @return {Promise|Object} An asynchorous Promise or JSON-RPC 2.0 object if
* (generateOnly=true).<br/><br/>
*
* The returned Promise will resolve with either the immediate response (if <code>resolveOnID=false</code>)
* or when the mathing response ID matches the request ID (if <code>resolveOnID=true</code>).
* It will reject if the request could not be processed. Note that the result data
* for WebSocket objects is returned as the <i>data</i> property, a string, of
* the result while for XHR objects the result is the <i>target.response</i>
* property which is a native (parsed) object.<br/><br/>
*
* The generated JSON-RPC 2.0 object can be stringified and sent using another
* communication channel.
*
* @example
* var xhr = new XMLHttpRequest();
* xhr.open("POST", "http://localhost:8080");
* RPC("Hello", {}, xhr).then((event) => {
*   //event.target.response is a native (parsed) object in XHR replies
*   var dataObj = event.target.response;
*   alert("Hello" + JSON.stringify(dataObj));
* });
*
* @example
* async function callHTTPRPC() {
*   var xhr = new XMLHttpRequest();
*   xhr.open("POST", "http://localhost:8080");
*   var event = await RPC("Hello", {}, xhr);
*   var dataObj = event.target.response;
*   alert("Hello" + JSON.stringify(dataObj));
* }
* callHTTPRPC();
*
* @example
* var ws = new WebSocket("ws://localhost:8090");
* RPC("Hello", {}, ws).then((event) => {
*   //event.data is a string in WebSocket replies
*   var dataObj = JSON.parse(event.data);
*   alert("Hello" + JSON.stringify(dataObj));
* });
*
* @example
* async function callWSRPC() {
*  var ws = new WebSocket("ws://localhost:8090");
*  var event = await RPC("Hello", {}, ws);
*  var dataObj = JSON.parse(event.data);
*  alert("Hello" + JSON.stringify(dataObj));
* }
* callWSRPC();
*
* @example
* //note that this is just a regular function call and returns an object, not a
* //promise!
* let JSONRequest = RPC("Hello", {}, null, true);
*/
function RPC(method, params, transport, generateOnly=false, msgID=null, resolveOnID=true) {
   if ((transport == null) || (transport == undefined)) {
      var transportType = "generate";
  } else {
     if ((transport["response"] != null) && (transport["response"] != undefined)) {
       transportType = "http";
    } else if (transport.toString() == "APIRouter") {
        //non-API messaging is usually handled by the transport directly
        transportType = "router";
     } else {
       transportType = "websocket";
     }
  }
  if (msgID == null) {
      msgID = uniqueRPCID();
  }
  let requestObj = buildJSONRPC("request", {"method":method, "params":params, "id":msgID});
  //https / wss are assumed to have identical interfaces as http / ws (for now)
  switch (transportType) {
    case "http":
      //response ID will always match request ID when using HTTP/S
      transport.overrideMimeType("application/json-rpc");
      transport.responseType = "json";
      var promise = transport.onEventPromise("load");
      transport.send(JSON.stringify(requestObj));
      break;
    case "router":
      if (resolveOnID == true) {
         promise = transport.request(requestObj, msgID);
      } else {
         promise = transport.request(requestObj);
      }
      break;
    case "websocket":
      if (resolveOnID == true) {
         promise = new Promise((resolve, reject) => {
            handleRPCResponses(transport, "websocket", msgID, resolve, reject);
         })
      } else {
         promise = transport.onEventPromise("message");
      }
      if (transport.readyState != transport.OPEN) {
         //socket not yet connected
         transport.onEventPromise("open").then((event) => {
           transport.send(JSON.stringify(requestObj));
         });
      } else {
         //socket already open
         transport.send(JSON.stringify(requestObj));
      }
      break;
   case "generate":
      //generate only - swap generated request for usual promise
      promise = requestObj;
      break;
   default:
      break;
  }
  return (promise);
}

/**
* Handles asynchronous JSON-RPC 2.0 responses where a response ID must match a request ID before
* associated promises can be resolved.
*
* @param {Object} transport A reference to the network transport handling thr response.
* @param {String} type The transport type being handled. Supported types include: "websocket"
* @param {String|Number} expectedResponseID The expected response ID to match from messages
* received by the <code>transport</code> before resolving.
* @param {Function} resolve A promise resolve function to invoke with the response data when
* the response ID matches <code>expectedResponseID</code>
* @param {Function} reject A promise reject function. Not currently used.
*
* @async
*/
async function handleRPCResponses(transport, type, expectedResponseID, resolve, reject) {
   if (type == "websocket") {
      var responseID = null;
      while (responseID != expectedResponseID) {
         var response = await transport.onEventPromise("message");
         var responseObj = JSON.parse(response.data);
         responseID = responseObj.id;
      }
      resolve(response);
   }
}

/**
* Builds a valid JSON-RPC request, result, or notification object.
*
* @param {String} [type="request"] The JSON-RPC message type. Valid types include:<br/>
* <ul>
* <li><code>"request"</code>: A request / method invocation object. </li>
* <li><code>"result"</code>: An invocation result object.</li>
* <li><code>"notification"</code>: A notification object.</li>
* </ul>
* @param {Object} [options=null] An object containing additional options
* for the returned object depending on its type.
* @param {Object} [options.id=null] An id value for the object. If <code>type</code>
* is a "result" or "request" and this value is <code>null</code> or omiited,
* a random value is used. If <code>type</code> is "notification" the <code>id</code>
* is ommitted according to specification.
* @param {String} [options.method=null] A remote RPC method to invoke. If <code>type</code>
* is "request" and this value is <code>null</code> or omiited, an exception is thrown.
* If <code>type</code> is not "request" this option is ignored.
* @param {Object|Array} [options.params=null] Parameters to invoke the remote <code>method</code>
* with. If <code>type</code> is not "request" this option is ignored.
* @param {String} [version="2.0"] The JSON-RPC version identifier.
*
* @return {Object} A JSON-RPC-formatted object of the defined type.
*
* @see https://www.jsonrpc.org/specification
*/
function buildJSONRPC (type="request", options=null, version="2.0") {
   var JSONRPC = new Object();
   JSONRPC.jsonrpc = version;
   if (options == null) {
      options = new Object();
   }
   if ((type == "result") || (type == "request")) {
      if (options["id"] == undefined) {
         JSONRPC.id = String(Math.random()).split(".")[1];
      } else {
         JSONRPC.id = options.id;
      }
   }
   if ((type == "result") || (type == "notification")) {
      JSONRPC.result = new Object();
   } else if (type == "request") {
      if (typeof(options["method"]) != "string") {
         throw (new Error("options.method must be a string."));
      }
      JSONRPC.method = options.method;
      if (options["params"] != undefined) {
         if (typeof(options.params) != "object") {
            throw (new Error("options.params must be an array or object."));
         }
         JSONRPC.params = options.params;
      }
   }
   return (JSONRPC);
}

/**
* Returns a unique RPC <code>id</code> value that can be used to identify
* JSON-RPC 2.0 messages.
*
* @return {String} A unique <code>id</code>.
*/
function uniqueRPCID() {
   __rpc_request_id++;
   return (String(__rpc_request_id));
}
