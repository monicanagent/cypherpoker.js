//dev URLs:
var sessionURL = "ws://localhost:8090";
var handshakeURL = "http://localhost:8080";
console.log ("Starting crypto test...");


// TEST 1: Asynchronous SRA cryptosystem example:
var SRA = new SRACrypto(1);

async function encryptionTest() {
   var resultObj = await SRA.invoke("randomPrime", {bitLength:128, radix:16});
   var prime = resultObj.data.result;
   console.log ("New random prime: "+prime);

   resultObj = await SRA.invoke("randomKeypair", {"prime":prime});
   var keypair1 = resultObj.data.result.keypair;
   console.log ("Keypair 1: "+JSON.stringify(keypair1));

   resultObj = await SRA.invoke("randomKeypair", {"prime":prime});
   var keypair2 = resultObj.data.result.keypair;
   console.log ("Keypair 2: "+JSON.stringify(keypair2));

   resultObj = await SRA.invoke("randomQuadResidues", {"prime":prime, "numValues":1})
   var residue = resultObj.data.result[0];
   console.log ("Quadratic residue mod prime: "+residue);

   resultObj = await SRA.invoke("encrypt", {"value":residue, "keypair":keypair1});
   var encrypted = resultObj.data.result;
   console.log ("Encrypted value: "+encrypted);

   resultObj = await SRA.invoke("encrypt", {"value":encrypted, "keypair":keypair2});
   encrypted = resultObj.data.result;
   console.log ("Double-encrypted value: "+encrypted);

   resultObj = await SRA.invoke("decrypt", {"value":encrypted, "keypair":keypair2});
   var decrypted = resultObj.data.result;
   console.log ("Single-decrypted value: "+decrypted);

   resultObj = await SRA.invoke("decrypt", {"value":decrypted, "keypair":keypair1});
   decrypted = resultObj.data.result;

   console.log ("Plaintext value: "+decrypted);
   console.log ("Matches original QR? "+(decrypted == residue));
}
encryptionTest();

// Asynchronous WebSocket Sessions using WSS.js example:

async function startWebSocketSession(HURL, SURL) {
   session = new WSS (HURL);
   if (HURL.toLowerCase().trim().startsWith("http")) {
      var websocket = await session.connect(SURL, true);
   } else {
      websocket = await session.connect(SURL, false);
   }
   return (session);
}

startWebSocketSession(handshakeURL, sessionURL).then(session => {
   session.addEventListener("message", onSessionMessage);
   session.addEventListener("close", onSessionClose);
   session.addEventListener("peerconnect", onPeerConnect);
   session.addEventListener("peerdisconnect", onPeerDisconnect);
   console.log ("Successfully established WebSocket Session!");
}).catch (err => {
   console.error ("Couldn't establish WebSocket Session:\n"+err);
})

function onSessionMessage(event) {
   console.log ("onsessionmessage: "+JSON.stringify(event.data));
   var resultObj = event.data.result;
   alert ("Got "+resultObj.type+" message: "+resultObj.data +"\n\nFrom: "+resultObj.from);
}

function onSessionClose(event) {
   //may be closed by server, network connectivity issues, etc.
   console.log ("WebSocket Session has been externaly terminated.");
}

function onPeerConnect(event) {
   console.log ("A new peer has connected: "+event.data.result.connect);
}

function onPeerDisconnect(event) {
   console.log ("A peer has disconnected: "+event.data.result.disconnect);
}

console.log ("index.js loaded and running");
