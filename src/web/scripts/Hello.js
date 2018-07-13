var ws = new WebSocket("ws://localhost:8090"); //use a shared WebSocket (this will be kept open until closed manually!)
var greeting = "Hello";

async function callWSRPC_small() {
 alert(greeting + JSON.parse((await RPC(greeting, {}, ws)).data).result);
}

async function callWSRPC_extended() {
   //slightly updated and longer notation:
   let raw_response = await RPC(greeting, {}, ws); //there are no parameters in the "Hello" RPC call so use empty object
   let response_obj = JSON.parse(raw_response.data);
   //use a template literal (https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Template_literals):
   alert(`${greeting}${response_obj.result}  (once again!)`);
}

//call the async function (either one):
callWSRPC_small();
//callWSRPC_extended();

//one other way to call the RPC (the async function(s) above may complete first!):
RPC(greeting, {}, ws).then(function (resolve,reject) {
   alert(greeting + JSON.parse(resolve.data).result + " (for the last time?)");
});
