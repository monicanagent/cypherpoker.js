/**
* @file Command line utility to generate a HD (Hierarchical Deterministic) wallet
* from which addresses can be generated.
*
* @version 0.2.0
*/
// one time code to generate the master key
const bip39 = require('bip39');
const bip32 = require('bip32');
const bitcoin = require('bitcoinjs-lib');

/**
* @private
*/
function newHDWallet(network=null) {
   //network also be: bitcoin.networks.testnet
   let mnemonic = bip39.generateMnemonic(); //generate a random phrase
   console.log(" ");
   console.log ("Wallet mnemonic recovery: \"" + mnemonic + "\"");
   let seedBuffer = bip39.mnemonicToSeed(mnemonic); //convert the phrase to a seed
   if (network == null) {
      var wallet = bip32.fromSeed(seedBuffer); //Bitcoin mainnet
   } else {
      wallet = bip32.fromSeed(seedBuffer, network); //Bitcoin testnet
   }
   return (wallet);
}

/**
* @private
*/
function recoverWallet(mnemonic, network=null) {
   let seedBuffer = bip39.mnemonicToSeed(mnemonic); //convert the phrase to a seed
   if (network == null) {
      var wallet = bip32.fromSeed(seedBuffer); //Bitcoin mainnet
   } else {
      wallet = bip32.fromSeed(seedBuffer, network); //Bitcoin testnet
   }
   return (wallet);
}

/**
* @private
*/
function makeHDWallet(privKey, network=null) {
   try {
      if (network == null) {
         var node = bitcoin.bip32.fromBase58(privKey);
      } else {
         node = bitcoin.bip32.fromBase58(privKey, network);
      }
   } catch (err) {
      console.error(err.stack);
      return (null);
   }
   return (node);
}

/**
* @private
*/
function getAddress (walletObj, network) {
  return bitcoin.payments.p2pkh({pubkey:walletObj.publicKey, network}).address;
}

var testnet = false;
if (process.argv[2] != "testnet") {
   var wallet = newHDWallet(); //create a mainnet top-level HD node
} else {
   testnet = true;
   wallet = newHDWallet(bitcoin.networks.testnet); //create a testnet top-level HD node
}

let pubKey = wallet.neutered().toBase58();//public key in "xpub"
let pubKeyHex = wallet.neutered().publicKey.toString("hex"); //public key in hex
let privKey = wallet.toBase58(); //private key in "xprv"
let privKeyHex = wallet.privateKey.toString("hex"); //private key in hex
let wif = wallet.toWIF();
if (!testnet) {
   console.log("Wallet root address: "+getAddress(wallet));
   console.log("Wallet \"xpub\": "+pubKey);
   console.log("Wallet \"xprv\": "+privKey);
   console.log("Wallet Import Format (WIF): "+wif);
   console.log("Wallet public key (hex): "+pubKeyHex);
   console.log("Wallet private key (hex): "+privKeyHex);
} else {
   console.log("Testnet wallet root address: "+getAddress(wallet, bitcoin.networks.testnet));
   console.log("Testnet wallet \"tpub\": "+pubKey);
   console.log("Testnet wallet \"tprv\": "+privKey);
   console.log("Testnet Wallet Import Format (WIF): "+wif);
   console.log("Testnet wallet public key (hex): "+pubKeyHex);
   console.log("Testnet wallet private key (hex): "+privKeyHex);
}
console.log(" ");

// Some other examples:

//var wallet = newHDWallet(); //create a mainnet top-level HD node (store these details!)
//var wallet = makeHDWallet("xprv9s21ZrQH143K29WDJvBtkuugkRRWAKe3S6soYUVRPnaCK9KXwc8BEJxrncy5mpHyLCFsx39Q6MPnTGT97UxadieivoWFwj1CiqUPdhHDWnY");
//var wallet = recoverWallet("wait chase vacant code dry seven pelican pioneer plate tissue basic ability");

//var walletTest = newHDWallet(bitcoin.networks.testnet); //same as above but for testnet
//var walletTest = makeHDWallet("tprv8ZgxMBicQKsPf3KjmAH3PZsfn8u2qysxAV88S4eyA5iBWqzPofKd5HjoHrbMDqmNrWJEuxiicpmZjCqLNKqR7trCZs6VNMjbhKHMkxKESVv", bitcoin.networks.testnet);
//var walletTest = recoverWallet("this citizen rude type drop horse frost satisfy feel jelly afford lamp", bitcoin.networks.testnet);

//var copyHDWallet = makeHDWallet(wallet.toBase58()); //create a copy like this (don't use "xpub / tpub"!)

//let pubKey = wallet.neutered().toBase58();//public key as "xpub"
//let pubKeyHex = wallet.neutered().publicKey.toString("hex"); //public key in hex
//let privKey = wallet.toBase58(); //private key as "xprv"
//let privKeyHex = wallet.privateKey.toString("hex"); //private key in hex
//let pubKeyTest = walletTest.neutered().toBase58();//public key as "tpub" (for testnet)
//let pubKeyTestHex = walletTest.publicKey.toString("hex");//public testnet key in hex
//let privKeyTest = walletTest.toBase58();//public key as "tprv" (for testnet)
//let privKeyTestHex = walletTest.privateKey.toString("hex");//private testnet key in hex
//console.log("root address="+getAddress(wallet));
//console.log("root pubKey="+pubKey);
//console.log("root privKey="+privKey);
//console.log("root pubKeyHex="+pubKeyHex);
//console.log("root privKeyHex="+privKeyHex);
//console.log("pubKeyTest="+pubKeyTest);
//console.log("privKeyTest="+privKeyTest);
//console.log("pubKeyTestHex="+pubKeyTestHex);
//console.log("privKeyTestHex="+privKeyTestHex);

//Use the above to derive new addresses (the "/0/0" at the end of both BIP44 (hardened BIP32),
//and BIP32 paths are the chain and address indexes respectively):

//var childBIP44 = wallet.derivePath("m/44'/0'/0'/0/0"); // "m44' /0'/0'/first chain/first child"
//console.log ("First derived BIP44 mainnet address: "+getAddress(childBIP44));
//console.log ("First derived BIP44 mainnet address private key hex: "+childBIP44.privateKey.toString("hex"));
//console.log ("First derived BIP44 mainnet address pub key hex: "+childBIP44.publicKey.toString("hex"));

//..etc; the "/0/0" at the end of the path denote chain and child respectively

//or BIP32 path:
//var childBIP32 = wallet.derivePath("m/0/0"); // "m/first chain/first child"
//console.log ("First derived BIP32 mainnet address: "+getAddress(childBIP32));
//console.log ("First derived BIP32 mainnet address private key hex: "+childBIP32.privateKey.toString("hex"));
//console.log ("First derived BIP32 mainnet address pub key hex: "+childBIP32.publicKey.toString("hex"));
