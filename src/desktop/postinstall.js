/**
* @file A post-install script for CypherPoker.JS desktop to patch installed modules for
* compatibility with Electron, apply any required file permissions, and configure the application.
* @version 0.0.2
*/
const fs = require("fs");
const { exec } = require('child_process');
const readline = require('readline');
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});
const bip39 = require('bip39');
const bip32 = require('bip32');
const bitcoin = require('bitcoinjs-lib');

var wallets = null; //generated wallets (newHDWallets) object
var APIToken = null; //BlockCypher API token
//server-originating fees
var fees = {
   mainnet: {
      miner: "50000",
      deposit: "10000"
   },
   testnet: {
      miner: "50000",
      deposit: "10000"
   }
}
var dbFilePath = "./db/cypherpoker.js.sqlite3"; //SQlite 3 database file path
var serverConfigPath  = "../server/config.json"; //path to server configuration JSON

/**
* Generates mainnet and testnet Bitcoin HD wallets that can be used to configure
* CypherPoker.JS or used independently for transactions.
*/
function newHDWallets() {
   var walletObj = new Object();
   walletObj.mainnet = new Object();
   walletObj.testnet = new Object();
   walletObj.mainnet.mnemonic = bip39.generateMnemonic();
   walletObj.testnet.mnemonic = bip39.generateMnemonic();
   var seedBuffer = bip39.mnemonicToSeed(walletObj.mainnet.mnemonic);
   walletObj.mainnet.wallet = bip32.fromSeed(seedBuffer);
   walletObj.testnet.wallet = bip32.fromSeed(seedBuffer, bitcoin.networks.testnet);
   walletObj.mainnet.pubKey = walletObj.mainnet.wallet.neutered().toBase58();
   walletObj.mainnet.pubKeyHex = walletObj.mainnet.wallet.neutered().publicKey.toString("hex");
   walletObj.mainnet.privKey = walletObj.mainnet.wallet.toBase58();
   walletObj.mainnet.privKeyHex = walletObj.mainnet.wallet.privateKey.toString("hex");
   walletObj.mainnet.wif = walletObj.mainnet.wallet.toWIF();
   walletObj.testnet.pubKey = walletObj.testnet.wallet.neutered().toBase58();
   walletObj.testnet.pubKeyHex = walletObj.testnet.wallet.neutered().publicKey.toString("hex");
   walletObj.testnet.privKey = walletObj.testnet.wallet.toBase58();
   walletObj.testnet.privKeyHex = walletObj.testnet.wallet.privateKey.toString("hex");
   walletObj.testnet.wif = walletObj.testnet.wallet.toWIF();
   //remove these for a nicer display:
   delete walletObj.mainnet.wallet;
   delete walletObj.testnet.wallet;
   return (walletObj);
}

/**
* Updates a provided configuration data object with variables configured by this script.
*
* @param {String} configDataStr The unparsed configuration data JSON string to update.
*
* @return {Object} The updated native configuration object.
*/
function updateServerConfig(configDataStr) {
   var dataObj = JSON.parse(configDataStr);
   dataObj.CP.API.database.url = "sqlite3://"+dbFilePath;
   dataObj.CP.API.wallets.bitcoin.xprv = wallets.mainnet.privKey;
   dataObj.CP.API.wallets.test3.tprv = wallets.testnet.privKey;
   if (APIToken != null) {
      dataObj.CP.API.tokens.blockcypher = APIToken;
   }
   dataObj.CP.API.bitcoin.default.main.minerFee = String(fees.mainnet.miner);
   dataObj.CP.API.bitcoin.default.main.depositFee = String(fees.mainnet.deposit);
   dataObj.CP.API.bitcoin.default.test3.minerFee = String(fees.testnet.miner);
   dataObj.CP.API.bitcoin.default.test3.depositFee = String(fees.testnet.deposit);
   return (dataObj);
}

// POST-INSTALL PATCH BEGINS
console.log ("Patching installed modules for Electron compatibility...");

// Replace "rmd160" hash reference with "ripemd160" which is required as of Electron 4.0.4 because
// of switch from OpenSSL to BoringSSL): https://github.com/electron/electron/pull/16574
console.log ("Patching bip32 library...");
var patchScript = fs.readFileSync("./node_modules/bip32/crypto.js", {encoding:"UTF-8"});
patchScript = patchScript.split("rmd160").join("ripemd160");
fs.writeFileSync("./node_modules/bip32/crypto.js", patchScript, {encoding:"UTF-8"});
console.log ("bip32 patched.");
console.log ("Patching bitcoinjs-lib library...");
var patchScript = fs.readFileSync("./node_modules/bitcoinjs-lib/src/crypto.js", {encoding:"UTF-8"});
patchScript = patchScript.split("rmd160").join("ripemd160");
fs.writeFileSync("./node_modules/bitcoinjs-lib/src/crypto.js", patchScript, {encoding:"UTF-8"});
console.log ("bitcoinjs-lib patched.");

console.log ("All patches applied.");

console.log ("Updating modes for binaries...");
try {
   fs.chmodSync("./bin/sqlite/linux32/sqlite3", 755);
   fs.chmodSync("./bin/sqlite/linux32/sqldiff", 755);
   fs.chmodSync("./bin/sqlite/linux32/sqlite3_analyzer", 755);
   fs.chmodSync("./bin/sqlite/linux64/sqlite3", 755);
   fs.chmodSync("./bin/sqlite/linux64/sqldiff", 755);
   fs.chmodSync("./bin/sqlite/linux64/sqlite3_analyzer", 755);
   fs.chmodSync("./bin/sqlite/osx/sqlite3", 755);
   fs.chmodSync("./bin/sqlite/osx/sqldiff", 755);
   fs.chmodSync("./bin/sqlite/osx/sqlite3_analyzer", 755);
   console.log ("Modes for binaries updated.");
} catch (err) {
   console.error("One or more binary file modes couldn't be set:");
   console.error(err);
}
// POST-INSTALL PATCH ENDS
// POST-INSTALL CONFIGURATION BEGINS
function configPrompt(index) {
   switch (index) {
      case 1:
         rl.question('Would you like to configure CypherPoker.JS now? (Y/n) ', (answer) => {
            answer = new String(answer);
            answer = answer.trim().toLowerCase().substring(0,1);
            switch (answer) {
               case "n":
                  rl.write("\nPlease update the application configuration manually.\n");
                  rl.close();
                  break;
               case "y":
                  configPrompt(2);
                  break;
               case "":
                  configPrompt(2);
                  break;
               default:
                  rl.write("\nPlease enter either \"Y\" or \"N\" followed by the ENTER key.\n");
                  configPrompt(1);
                  break;
            }
         });
         break;
      case 2:
         rl.question('Enter the default SQLite 3 database file path? ('+dbFilePath+') ', (answer) => {
            answer = new String(answer);
            answer = answer.trim();
            switch (answer) {
               case "":
                  configPrompt(3);
                  break;
               default:
                  dbFilePath = answer;
                  configPrompt(3);
                  break;
            }
         });
         break;
      case 3:
         wallets = newHDWallets();
         console.log (wallets);
         rl.question('\nWould you like to (K)eep this wallet or (g)enerate a new one? ', (answer) => {
            answer = new String(answer);
            answer = answer.trim().toLowerCase().substring(0,1);
            switch (answer) {
               case "k":
                  configPrompt(4);
                  break;
               case "":
                  configPrompt(4);
                  break;
               case "g":
                  configPrompt(3);
                  break;
               default:
                  rl.write("\nPlease enter either \"K\" or \"G\" followed by the ENTER key.\n");
                  configPrompt(2);
                  break;
            }
         });
         break;
      case 4:
         rl.question('\nWould you like to launch the BlockCypher.com account page to create an API token? (Y/n)', (answer) => {
            answer = new String(answer);
            answer = answer.trim().toLowerCase().substring(0,1);
            switch (answer) {
               case "y":
                  configPrompt(5);
                  break;
               case "":
                  configPrompt(5);
                  break;
               case "n":
                  rl.write("\nYou will need to update the configuration with your BlockCypher API token manually.\n");
                  configPrompt(6);
                  break;
               default:
                  rl.write("\nPlease enter either \"Y\" or \"N\" followed by the ENTER key.\n");
                  configPrompt(4);
                  break;
            }
         });
         break;
      case 5:
         var url = "https://accounts.blockcypher.com/";
         var start = "";
         if (process.platform == 'darwin') {
            start = "open"; //MacOS
         } else if (process.platform == 'win32') {
            start = "start"; //Windows
         } else {
            start = "xdg-open"; //Linux
         }
         exec(start + " " + url);
         rl.question('\nPaste the BlockCypher API token here: ', (token) => {
            APIToken = new String(token);
            APIToken = APIToken.trim();
            switch (APIToken) {
               case "":
                  rl.write("\nPaste a valid BlockCypher API token and then press ENTER.\n");
                  configPrompt(5);
                  break;
               default:
                  configPrompt(6);
                  break;
            }
         });
         break;
      case 6:
         rl.question('\nEnter a Bitcoin mainnet server-originating miner fee, in satoshis: (default: '+fees.mainnet.miner+')', (answer) => {
            answer = new String(answer);
            answer = answer.trim();
            switch (answer) {
               case "":
                  configPrompt(7);
                  break;
               default:
                  fees.mainnet.miner = answer;
                  configPrompt(7);
                  break;
            }
         });
         break;
      case 7:
         rl.question('\nEnter Bitcoin mainnet deposit fee, in satoshis: (default: '+fees.mainnet.deposit+')', (answer) => {
            answer = new String(answer);
            answer = answer.trim();
            switch (answer) {
               case "":
                  configPrompt(8);
                  break;
               default:
                  fees.mainnet.deposit = answer;
                  configPrompt(8);
                  break;
            }
         });
         break;
      case 8:
         rl.question('\nEnter Bitcoin testnet server-originating miner fee, in satoshis: (default: '+fees.testnet.miner+')', (answer) => {
            answer = new String(answer);
            answer = answer.trim();
            switch (answer) {
               case "":
                  configPrompt(9);
                  break;
               default:
                  fees.testnet.miner = answer;
                  configPrompt(9);
                  break;
            }
         });
         break;
      case 9:
         rl.question('\nEnter Bitcoin testnet deposit fee, in satoshis: (default: '+fees.testnet.deposit+')', (answer) => {
            answer = new String(answer);
            answer = answer.trim();
            switch (answer) {
               case "":
                  configPrompt(10);
                  break;
               default:
                  fees.testnet.deposit = answer;
                  configPrompt(10);
                  break;
            }
         });
         break;
      case 10:
         rl.question('\nConfiguration complete! Would you like to (S)ave the configuration, only (d)isplay it, or (r)estart the configuration process? ', (answer) => {
            answer = new String(answer);
            answer = answer.trim().toLowerCase().substring(0,1);
            switch (answer) {
               case "s":
                  var currentConfig = fs.readFileSync(serverConfigPath, {encoding:"utf-8"});
                  var configData = updateServerConfig(currentConfig);
                  rl.write("\nSaving configuration data...\n");
                  fs.writeFileSync(serverConfigPath, JSON.stringify(configData, null, 3), {encoding:"utf-8"});
                  rl.write("\nConfiguration data saved to: "+serverConfigPath+"\n");
                  configPrompt(11);
                  break;
               case "":
                  var currentConfig = fs.readFileSync(serverConfigPath, {encoding:"utf-8"});
                  var configData = updateServerConfig(currentConfig);
                  rl.write("\nSaving configuration data...\n");
                  fs.writeFileSync(serverConfigPath, JSON.stringify(configData, null, 3), {encoding:"utf-8"});
                  rl.write("\nConfiguration data saved to: "+serverConfigPath+"\n");
                  configPrompt(11);
                  break;
               case "d":
                  var currentConfig = fs.readFileSync(serverConfigPath, {encoding:"utf-8"});
                  var configData = updateServerConfig(currentConfig);
                  rl.write("\nConfiguration JSON data:\n");
                  console.log (JSON.stringify(configData, null, 3)+"\n");
                  configPrompt(11);
                  rl.close();
                  break;
               case "r":
                  rl.write("\nConfiguration data cleared. Starting again.\n");
                  configPrompt(2);
                  break;
               default:
                  rl.write("\nPlease enter either \"S\", \"D\" or \"R\" followed by the ENTER key.\n");
                  configPrompt(10);
                  break;
            }
         });
         break;
      case 11:
         var walletInfo = "Bitcoin HD Wallets\r\n";
         walletInfo += "------------------\r\n";
         walletInfo += "Mainnet wallet mnemonic: "+wallets.mainnet.mnemonic;
         walletInfo += "\r\nMainnet wallet base58 public key (xpub): "+wallets.mainnet.pubKey;
         walletInfo += "\r\nMainnet wallet base58 private key (xpriv): "+wallets.mainnet.privKey;
         walletInfo += "\r\nMainnet wallet hex public key: "+wallets.mainnet.pubKeyHex;
         walletInfo += "\r\nMainnet wallet import format (WIF): "+wallets.mainnet.wif;
         walletInfo += "\r\nMainnet wallet hex private key: "+wallets.mainnet.privKeyHex;
         walletInfo += "\r\n\r\nTestnet wallet mnemonic: "+wallets.testnet.mnemonic;
         walletInfo += "\r\nTestnet wallet base58 public key (tpub): "+wallets.testnet.pubKey;
         walletInfo += "\r\nTestnet wallet base58 private key (tpriv): "+wallets.testnet.privKey;
         walletInfo += "\r\nTestnet wallet hex public key: "+wallets.testnet.pubKeyHex;
         walletInfo += "\r\nTestnet wallet hex private key: "+wallets.testnet.privKeyHex;
         walletInfo += "\r\nTestnet wallet import format (WIF): "+wallets.testnet.wif;
         fs.writeFileSync("wallets.txt", walletInfo, {encoding:"utf-8"});
         rl.write ("The following information has been saved to a \"wallets.txt\" file.\n");
         rl.write ("Be sure to SECURELY and PRIVATELY back up this information!\n\n");
         rl.write (walletInfo+"\n");
         rl.close();
         break;
   }
}

configPrompt(1);
// POST-INSTALL CONFIGURATION ENDS
