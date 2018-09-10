/**
* @file Handles asynchronous JSON-RPC 2.0 requests to either a HTTP / HTTPS or
* WebSocket / Secure WebSocket endpoints. Requires <code>EventPromise</code>
* to exist in the current execution context.
*/
var __rpc_request_id = 1;

/**
* Invokes a RPC request through either a HTTP or WebSocket (or their secure
* counterparts).
*
* @param {String} method The remote procedure/method/function to invoke.
* @param {Object} param The parameters to include with the remote method.
* @param {XMLHttpRequest|WebSocket} transport The transport object to use for
* for the request. The request is handled automatically based on this object
* type.
* @param {Boolean} [generateOnly=false] Flag denoting whether the
* request should only be generated and returned (true), or processed and a
* Promise object returned (false).
* @param {String|Number} [msgID=null] ID to include with the request.
* In order to differentiate requests/responses, this value should always
* be unique. If not provided, an internal integer value is used instead.
*
* @return {Promise|Object} An asynchorous Promise or JSON-RPC 2.0 object if
* (generateOnly=true).<br/><br/>
*
* The returned Promise will include the RPC result event as the resolution or
* a rejection if the request could not be processed. Note that the result data
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
function RPC(method, params, transport, generateOnly=false, msgID=null) {
   if ((transport == null) || (transport == undefined)) {
      var transportType = "generate";
  } else {
     if ((transport["response"] != null) || (transport["response"] != undefined)) {
       transportType = "http";
     } else {
       transportType = "websocket";
     }
  }
  //https / wss are assumed to have identical interfaces as http / ws (for now)
  let requestObj = new Object();
  requestObj.jsonrpc = "2.0";
  requestObj.method = method;
  if (msgID != null) {
     requestObj.id = msgID;
  } else {
     requestObj.id = __rpc_request_id;
  }
  requestObj.params = params;
  switch (transportType) {
    case "http":
      transport.overrideMimeType("application/json-rpc");
      transport.responseType = "json";
      var promise = transport.onEventPromise("load");
      transport.send(JSON.stringify(requestObj));
      break;
    case "websocket":
      promise = transport.onEventPromise("message");
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
  __rpc_request_id++;
  return (promise);
}
