/**
* @file A post-install script for CypherPoker.JS desktop to patch installed modules for
* compatibility with Electron, apply any required file permissions, and configure the application.
* @version 0.4.1
*/
const fs = require("fs");
const {exec} = require('child_process');
const readline = require('readline');
const path = require('path');
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});
const bip39 = require('bip39');
const bip32 = require('bip32');
const bitcoin = require('bitcoinjs-lib');
const bitcoreCash = require('bitcore-lib-cash');

var wallets = null; //generated wallets (newHDWallets) object
var APIToken = null; //BlockCypher API token
//server-originating fees
var fees = {
   bitcoin: {
      mainnet: {
         miner: "50000",
         deposit: "10000"
      },
      testnet: {
         miner: "50000",
         deposit: "10000"
      }
   },
   bitcoincash: {
      mainnet: {
         miner: "5000",
         deposit: "1000"
      },
      testnet: {
         miner: "5000",
         deposit: "1000"
      }
   }
}
var dbFilePath = "../server/db/cypherpoker.js.sqlite3"; //SQlite 3 database file path
var serverConfigPath  = "../server/config.json"; //path to server configuration JSON

/**
* Generates mainnet and testnet Bitcoin HD wallets that can be used to configure
* CypherPoker.JS or used independently for transactions.
*/
function newHDWallets() {
   var walletObj = new Object();
   //bitcoin wallets
   walletObj.bitcoin = new Object();
   walletObj.bitcoin.mainnet = new Object();
   walletObj.bitcoin.testnet = new Object();
   walletObj.bitcoin.mainnet.mnemonic = bip39.generateMnemonic();
   walletObj.bitcoin.testnet.mnemonic = bip39.generateMnemonic();
   var seedBuffer = bip39.mnemonicToSeed(walletObj.bitcoin.mainnet.mnemonic);
   walletObj.bitcoin.mainnet.wallet = bip32.fromSeed(seedBuffer);
   walletObj.bitcoin.testnet.wallet = bip32.fromSeed(seedBuffer, bitcoin.networks.testnet);
   walletObj.bitcoin.mainnet.pubKey = walletObj.bitcoin.mainnet.wallet.neutered().toBase58();
   walletObj.bitcoin.mainnet.pubKeyHex = walletObj.bitcoin.mainnet.wallet.neutered().publicKey.toString("hex");
   walletObj.bitcoin.mainnet.privKey = walletObj.bitcoin.mainnet.wallet.toBase58();
   walletObj.bitcoin.mainnet.privKeyHex = walletObj.bitcoin.mainnet.wallet.privateKey.toString("hex");
   walletObj.bitcoin.mainnet.wif = walletObj.bitcoin.mainnet.wallet.toWIF();
   walletObj.bitcoin.testnet.pubKey = walletObj.bitcoin.testnet.wallet.neutered().toBase58();
   walletObj.bitcoin.testnet.pubKeyHex = walletObj.bitcoin.testnet.wallet.neutered().publicKey.toString("hex");
   walletObj.bitcoin.testnet.privKey = walletObj.bitcoin.testnet.wallet.toBase58();
   walletObj.bitcoin.testnet.privKeyHex = walletObj.bitcoin.testnet.wallet.privateKey.toString("hex");
   walletObj.bitcoin.testnet.wif = walletObj.bitcoin.testnet.wallet.toWIF();
   //bitcoin cash wallets
   walletObj.bitcoincash = new Object();
   walletObj.bitcoincash.mainnet = new Object();
   walletObj.bitcoincash.testnet = new Object();
   walletObj.bitcoincash.mainnet.mnemonic = bip39.generateMnemonic();
   walletObj.bitcoincash.testnet.mnemonic = bip39.generateMnemonic();
   var seedBuffer = bip39.mnemonicToSeed(walletObj.bitcoincash.mainnet.mnemonic);
   walletObj.bitcoincash.mainnet.wallet = bip32.fromSeed(seedBuffer);
   walletObj.bitcoincash.testnet.wallet = bip32.fromSeed(seedBuffer, bitcoin.networks.testnet);
   walletObj.bitcoincash.mainnet.pubKey = walletObj.bitcoincash.mainnet.wallet.neutered().toBase58();
   walletObj.bitcoincash.mainnet.pubKeyHex = walletObj.bitcoincash.mainnet.wallet.neutered().publicKey.toString("hex");
   walletObj.bitcoincash.mainnet.privKey = walletObj.bitcoincash.mainnet.wallet.toBase58();
   walletObj.bitcoincash.mainnet.privKeyHex = walletObj.bitcoincash.mainnet.wallet.privateKey.toString("hex");
   walletObj.bitcoincash.mainnet.wif = walletObj.bitcoincash.mainnet.wallet.toWIF();
   walletObj.bitcoincash.testnet.pubKey = walletObj.bitcoincash.testnet.wallet.neutered().toBase58();
   walletObj.bitcoincash.testnet.pubKeyHex = walletObj.bitcoincash.testnet.wallet.neutered().publicKey.toString("hex");
   walletObj.bitcoincash.testnet.privKey = walletObj.bitcoincash.testnet.wallet.toBase58();
   walletObj.bitcoincash.testnet.privKeyHex = walletObj.bitcoincash.testnet.wallet.privateKey.toString("hex");
   walletObj.bitcoincash.testnet.wif = walletObj.bitcoincash.testnet.wallet.toWIF();
   //remove these for a nicer display:
   delete walletObj.bitcoin.mainnet.wallet;
   delete walletObj.bitcoin.testnet.wallet;
   delete walletObj.bitcoincash.mainnet.wallet;
   delete walletObj.bitcoincash.testnet.wallet;
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
   dataObj.CP.API.database.enabled = true;
   dataObj.CP.API.database.url = "sqlite3://"+dbFilePath;
   dataObj.CP.API.wallets.bitcoin.xprv = wallets.bitcoin.mainnet.privKey;
   dataObj.CP.API.wallets.test3.tprv = wallets.bitcoin.testnet.privKey;
   dataObj.CP.API.wallets.bitcoincash.xprv = wallets.bitcoincash.mainnet.privKey;
   dataObj.CP.API.wallets.bchtest.tprv = wallets.bitcoincash.testnet.privKey;
   if (APIToken != null) {
      dataObj.CP.API.tokens.blockcypher = APIToken;
   }
   dataObj.CP.API.bitcoin.default.main.minerFee = String(fees.bitcoin.mainnet.miner);
   dataObj.CP.API.bitcoin.default.main.depositFee = String(fees.bitcoin.mainnet.deposit);
   dataObj.CP.API.bitcoin.default.test3.minerFee = String(fees.bitcoin.testnet.miner);
   dataObj.CP.API.bitcoin.default.test3.depositFee = String(fees.bitcoin.testnet.deposit);
   dataObj.CP.API.bitcoincash.default.main.minerFee = String(fees.bitcoincash.mainnet.miner);
   dataObj.CP.API.bitcoincash.default.main.depositFee = String(fees.bitcoincash.mainnet.deposit);
   dataObj.CP.API.bitcoincash.default.test.minerFee = String(fees.bitcoincash.testnet.miner);
   dataObj.CP.API.bitcoincash.default.test.depositFee = String(fees.bitcoincash.testnet.deposit);
   for (var count=0; count < dataObj.CP.API.handlers.length; count++) {
      var handler = dataObj.CP.API.handlers[count];
      switch (handler.handlerClass) {
         case "./libs/adapters/BlockCypherAPI.js":
            if (configOptions.blockcypherAPI == true) {
               handler.enabled = true;
            } else {
               handler.enabled = false;
            }
            break;
         case "./libs/adapters/BitcoinComAPI.js":
            if (configOptions.blockchaincomAPI == true) {
               handler.enabled = true;
            } else {
               handler.enabled = false;
            }
            break;
         case "./libs/adapters/BitcoinCoreNative.js":
            if (configOptions.bitcoinCore == true) {
               handler.enabled = true;
            } else {
               handler.enabled = false;
            }
            break;
         case "./libs/adapters/BitcoinCashNative.js":
            if (configOptions.bitcoinCash == true) {
               handler.enabled = true;
            } else {
               handler.enabled = false;
            }
            break;
      }
   }
   return (dataObj);
}

/**
* Event listener invoked on installation progress events emitted by the <code>request-progress</code>
* module. The progress is displayed on the current line which is cleared on each dispatch.
*
* @param {Event} infoObj A install progress information object.
*/
function onInstallProgress(infoObj) {
   switch (infoObj.phase) {
      case "download":
         var displayStr = String (Math.round(infoObj.size.transferred / 1000)) + " kB";
         displayStr += " of ";
         displayStr += String (Math.round(infoObj.size.total / 1000)) + " kB";
         displayStr += " downloaded - ";
         displayStr += String (Math.round(infoObj.percent * 10000)/100) + "%";
         displayStr += " complete - ";
         displayStr += String (Math.round(infoObj.speed / 1000)) + " kB/s";
         displayStr += " - ";
         displayStr += toTimeString(infoObj.time.elapsed);
         displayStr += " elapsed of ";
         displayStr += toTimeString(infoObj.time.remaining);
         displayStr += " remaining";
         readline.clearLine(process.stdout, -1);
         readline.cursorTo(process.stdout, 0);
         process.stdout.write(displayStr);
         break;
      case "install":
         var displayStr = "Extracting "+infoObj.fileName+" to "+infoObj.targetPath;
         readline.clearLine(process.stdout, -1);
         readline.cursorTo(process.stdout, 0);
         process.stdout.write(displayStr);
         break;
      case "complete":
         var displayStr = "Extracting "+infoObj.fileName+" to "+infoObj.targetPath;
         readline.clearLine(process.stdout, -1);
         readline.cursorTo(process.stdout, 0);
         process.stdout.write(displayStr);
         break;
   }
}

/**
* Creates a "hour:minute:seconds" time string from a total seconds value.
*
* @param {Number} totalSeconds The total number of seconds to convert to a time
* string.
*
* @return {String} A time string in the format "H:MM:SS".
*/
function toTimeString(totalSeconds) {
   totalSeconds = Math.floor(totalSeconds);
   var hours = Math.floor(totalSeconds / 3600);
   totalSeconds %= 3600;
   var minutes = Math.floor(totalSeconds / 60);
   var seconds = totalSeconds % 60;
   var timeStr = String(hours)+":";
   if (minutes < 10) {
      timeStr += "0"+String(minutes)+":";
   } else {
      timeStr += String(minutes)+":";
   }
   if (seconds < 10) {
      timeStr += "0"+String(seconds);
   } else {
      timeStr += String(seconds);
   }
   return (timeStr);
}

// POST-INSTALL PATCH BEGINS
console.log ("Patching installed modules for Electron compatibility...");

//don't update 32-bit Linux (only OpenSSL in legacy Electron version)
if (process.arch != "ia32") {
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
}

console.log ("All patches applied.");

console.log ("Updating modes for binaries...");
try {
   fs.chmodSync("../server/bin/sqlite/linux32/sqlite3", 755);
   fs.chmodSync("../server/bin/sqlite/linux32/sqldiff", 755);
   fs.chmodSync("../server/bin/sqlite/linux32/sqlite3_analyzer", 755);
   fs.chmodSync("../server/bin/sqlite/linux64/sqlite3", 755);
   fs.chmodSync("../server/bin/sqlite/linux64/sqldiff", 755);
   fs.chmodSync("../server/bin/sqlite/linux64/sqlite3_analyzer", 755);
   fs.chmodSync("../server/bin/sqlite/osx/sqlite3", 755);
   fs.chmodSync("../server/bin/sqlite/osx/sqldiff", 755);
   fs.chmodSync("../server/bin/sqlite/osx/sqlite3_analyzer", 755);
   console.log ("Modes for binaries updated.");
} catch (err) {
   console.error("One or more binary file modes couldn't be set:");
   console.error(err);
}
// POST-INSTALL PATCH ENDS

// POST-INSTALL CONFIGURATION BEGINS
var configOptions = new Object();
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
         rl.question('\nWould you like to (K)eep these wallets or (g)enerate a new ones? ', (answer) => {
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
         rl.question('\nEnable BlockCypher (API) Bitcoin blockchain handler (you will need an access token)? (Y/n)', (answer) => {
            configOptions.blockcypherAPI = false;
            answer = new String(answer);
            answer = answer.trim().toLowerCase().substring(0,1);
            switch (answer) {
               case "y":
                  configOptions.blockcypherAPI = true;
                  configPrompt(5);
                  break;
               case "":
                  configOptions.blockcypherAPI = true;
                  configPrompt(5);
                  break;
               case "n":
                  configPrompt(7);
                  break;
               default:
                  rl.write("\nPlease enter either \"Y\" or \"N\" followed by the ENTER key.\n");
                  configPrompt(4);
                  break;
            }
         });
         break;
      case 5:
         rl.question('\nWould you like to launch the BlockCypher.com account page to create an API token? (Y/n)', (answer) => {
            answer = new String(answer);
            answer = answer.trim().toLowerCase().substring(0,1);
            switch (answer) {
               case "y":
                  configPrompt(6);
                  break;
               case "":
                  configPrompt(6);
                  break;
               case "n":
                  rl.question('\nPaste the BlockCypher API token here: ', (token) => {
                     APIToken = new String(token);
                     APIToken = APIToken.trim();
                     switch (APIToken) {
                        case "":
                           rl.write("\nPaste a valid BlockCypher API token and then press ENTER.\n");
                           configPrompt(5);
                           break;
                        default:
                           configPrompt(7);
                           break;
                     }
                  });
                  break;
               default:
                  rl.write("\nPlease enter either \"Y\" or \"N\" followed by the ENTER key.\n");
                  configPrompt(5);
                  break;
            }
         });
         break;
      case 6:
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
                  configPrompt(6);
                  break;
               default:
                  configPrompt(7);
                  break;
            }
         });
         break;
      case 7:
         rl.question('\nEnable Blockchain.com (API) Bitcoin Cash blockchain handler? (Y/n)', (answer) => {
            configOptions.blockchaincomAPI = false;
            answer = new String(answer);
            answer = answer.trim().toLowerCase().substring(0,1);
            switch (answer) {
               case "y":
                  configOptions.blockchaincomAPI = true;
                  configPrompt(8);
                  break;
               case "":
                  configOptions.blockchaincomAPI = true;
                  configPrompt(8);
                  break;
               case "n":
                  configPrompt(8);
                  break;
               default:
                  rl.write("\nPlease enter either \"Y\" or \"N\" followed by the ENTER key.\n");
                  configPrompt(7);
                  break;
            }
         });
         break;
      case 8:
         rl.question('\nDo you want to install and enable the native Bitcoin (Core) client? (Y/n)', (answer) => {
            configOptions.bitcoinCore = false;
            answer = new String(answer);
            answer = answer.trim().toLowerCase();
            switch (answer) {
               case "y":
                  configOptions.bitcoinCore = true;
                  configPrompt(9);
                  break
               case "":
                  configOptions.bitcoinCore = true;
                  configPrompt(9);
                  break;
               case "n":
                  configPrompt(10);
                  break;
               default:
                  rl.write("\nPlease enter either \"Y\" or \"N\" followed by the ENTER key.\n");
                  configPrompt(8);
                  break;
            }
         });
         break;
      case 9:
         rl.question('\nBitcoin (Core) version to download? (0.18.0)', (answer) => {
            answer = new String(answer);
            answer = answer.trim();
            if (answer == "") {
               answer = "0.18.0";
            }
            var URLPrefix = "https://bitcoin.org/bin/bitcoin-core-"+answer+"/";
            var darwinURL = URLPrefix+"bitcoin-"+answer+"-osx.dmg";
            var linuxURL = URLPrefix+"bitcoin-"+answer+"-x86_64-linux-gnu.tar.gz";
            var winURL = URLPrefix+"bitcoin-"+answer+"-win64.zip";
            var installDirPrefix = "../server/bin/bitcoind/";
            var downloadURL = null;
            switch (process.platform) {
               case "linux":
                  var installDirectory = installDirPrefix + "linux/";
                  downloadURL = linuxURL;
                  var binFiles = ["bitcoin-"+answer+"/bin/bitcoind"];
                  break;
               case "win32":
                  var installDirectory = installDirPrefix + "win/";
                  downloadURL = winURL;
                  binFiles = ["bitcoin-"+answer+"/bin/bitcoind.exe"];
                  break;
               case "darwin":
                  var installDirectory = installDirPrefix + "macOS/";
                  downloadURL = darwinURL;
                  binFiles = ["bitcoin-"+answer+"/bin/bitcoind"];
                  break;
               default:
                  throw (new Error("Unsupported platform: "+process.platform));
                  break;
            }
            var configObj = new Object();
            configObj.downloads = new Object();
            //each "downloads" property must match a detectable process.platform property:
            configObj.downloads.darwin = darwinURL;
            configObj.downloads.linux = linuxURL;
            configObj.downloads.win32 = winURL
            console.log ("Downloading  : "+downloadURL);
            console.log ("Installing to: "+installDirectory);
            process.stdout.write("Starting download...");
            var CryptocurrencyHandler = require("../server/libs/CryptocurrencyHandler");
            var installer = new CryptocurrencyHandler(this, configObj);
            installer.on("progress", onInstallProgress);
            installer.checkInstall(binFiles, installDirectory, true).then(result => {
               configPrompt(10);
            }).catch (err => {
               console.error("Installation failed.");
               console.error(err);
            });
         });
         break;
      case 10:
         rl.question('\nDo you want to install and enable the native Bitcoin Cash (BitcoinABC) client? (Y/n)', (answer) => {
            configOptions.bitcoinCash = false;
            answer = new String(answer);
            answer = answer.trim().toLowerCase();
            switch (answer) {
               case "y":
                  configPrompt(11);
                  break
               case "":
                  configPrompt(11);
                  break
               case "n":
                  configPrompt(12);
                  break;
               default:
                  rl.write("\nPlease enter either \"Y\" or \"N\" followed by the ENTER key.\n");
                  configPrompt(10);
                  break;
            }
         });
         break;
      case 11:
         rl.question('\nBitcoin Cash client (BitcoinABC) version to download? (0.19.6)', (answer) => {
            answer = new String(answer);
            answer = answer.trim();
            if (answer == "") {
               answer = "0.19.6";
            }
            var URLPrefix = "https://download.bitcoinabc.org/"+answer+"/";
            var darwinURL = URLPrefix+"osx/bitcoin-abc-"+answer+"-osx-unsigned.dmg";
            var linuxURL = URLPrefix+"linux/bitcoin-abc-"+answer+"-x86_64-linux-gnu.tar.gz";
            var winURL = URLPrefix+"windows/bitcoin-abc-"+answer+"-win64.zip";
            var installDirPrefix = "../server/bin/bitcoincash/";
            var downloadURL = null;
            switch (process.platform) {
               case "linux":
                  var installDirectory = installDirPrefix + "linux/";
                  downloadURL = linuxURL;
                  var binFiles = ["bitcoin-abc-"+answer+"/bin/bitcoind"];
                  break;
               case "win32":
                  var installDirectory = installDirPrefix + "win/";
                  downloadURL = winURL;
                  binFiles = ["bitcoin-abc-"+answer+"/bin/bitcoind.exe"];
                  break;
               case "darwin":
                  var installDirectory = installDirPrefix + "macOS/";
                  downloadURL = darwinURL;
                  binFiles = ["bitcoin-abc-"+answer+"/bin/bitcoind"];
                  break;
               default:
                  throw (new Error("Unsupported platform: "+process.platform));
                  break;
            }
            var configObj = new Object();
            configObj.downloads = new Object();
            //each "downloads" property must match a detectable process.platform property:
            configObj.downloads.darwin = darwinURL;
            configObj.downloads.linux = linuxURL;
            configObj.downloads.win32 = winURL
            console.log ("Downloading  : "+downloadURL);
            console.log ("Installing to: "+installDirectory);
            process.stdout.write("Starting download...");
            CryptocurrencyHandler = require("../server/libs/CryptocurrencyHandler");
            var installer = new CryptocurrencyHandler(this, configObj);
            installer.on("progress", onInstallProgress);
            installer.checkInstall(binFiles, installDirectory, true).then(result => {
               configPrompt(12);
            }).catch (err => {
               console.error("Installation failed.");
               console.error(err);
            });
         });
         break;
      case 12:
         rl.question('\nEnter a Bitcoin mainnet server-originating miner fee, in satoshis: (default: '+fees.bitcoin.mainnet.miner+')', (answer) => {
            answer = new String(answer);
            answer = answer.trim();
            switch (answer) {
               case "":
                  configPrompt(13);
                  break;
               default:
                  fees.bitcoin.mainnet.miner = answer;
                  configPrompt(13);
                  break;
            }
         });
         break;
      case 13:
         rl.question('\nEnter Bitcoin mainnet deposit fee, in satoshis: (default: '+fees.bitcoin.mainnet.deposit+')', (answer) => {
            answer = new String(answer);
            answer = answer.trim();
            switch (answer) {
               case "":
                  configPrompt(14);
                  break;
               default:
                  fees.bitcoin.mainnet.deposit = answer;
                  configPrompt(14);
                  break;
            }
         });
         break;
      case 14:
         rl.question('\nEnter Bitcoin testnet server-originating miner fee, in satoshis: (default: '+fees.bitcoin.testnet.miner+')', (answer) => {
            answer = new String(answer);
            answer = answer.trim();
            switch (answer) {
               case "":
                  configPrompt(15);
                  break;
               default:
                  fees.bitcoin.testnet.miner = answer;
                  configPrompt(15);
                  break;
            }
         });
         break;
      case 15:
         rl.question('\nEnter Bitcoin testnet deposit fee, in satoshis: (default: '+fees.bitcoin.testnet.deposit+')', (answer) => {
            answer = new String(answer);
            answer = answer.trim();
            switch (answer) {
               case "":
                  configPrompt(16);
                  break;
               default:
                  fees.bitcoin.testnet.deposit = answer;
                  configPrompt(16);
                  break;
            }
         });
         break;
      case 16:
         rl.question('\nEnter a Bitcoin Cash mainnet server-originating miner fee, in satoshis: (default: '+fees.bitcoin.mainnet.miner+')', (answer) => {
            answer = new String(answer);
            answer = answer.trim();
            switch (answer) {
               case "":
                  configPrompt(17);
                  break;
               default:
                  fees.bitcoin.mainnet.miner = answer;
                  configPrompt(17);
                  break;
            }
         });
         break;
      case 17:
         rl.question('\nEnter Bitcoin Cash mainnet deposit fee, in satoshis: (default: '+fees.bitcoin.mainnet.deposit+')', (answer) => {
            answer = new String(answer);
            answer = answer.trim();
            switch (answer) {
               case "":
                  configPrompt(18);
                  break;
               default:
                  fees.bitcoin.mainnet.deposit = answer;
                  configPrompt(18);
                  break;
            }
         });
         break;
      case 18:
         rl.question('\nEnter Bitcoin Cash testnet server-originating miner fee, in satoshis: (default: '+fees.bitcoin.testnet.miner+')', (answer) => {
            answer = new String(answer);
            answer = answer.trim();
            switch (answer) {
               case "":
                  configPrompt(19);
                  break;
               default:
                  fees.bitcoin.testnet.miner = answer;
                  configPrompt(19);
                  break;
            }
         });
         break;
      case 19:
         rl.question('\nEnter Bitcoin Cash testnet deposit fee, in satoshis: (default: '+fees.bitcoin.testnet.deposit+')', (answer) => {
            answer = new String(answer);
            answer = answer.trim();
            switch (answer) {
               case "":
                  configPrompt(20);
                  break;
               default:
                  fees.bitcoin.testnet.deposit = answer;
                  configPrompt(20);
                  break;
            }
         });
         break;
      case 20:
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
                  configPrompt(21);
                  break;
               case "":
                  var currentConfig = fs.readFileSync(serverConfigPath, {encoding:"utf-8"});
                  var configData = updateServerConfig(currentConfig);
                  rl.write("\nSaving configuration data...\n");
                  fs.writeFileSync(serverConfigPath, JSON.stringify(configData, null, 3), {encoding:"utf-8"});
                  rl.write("\nConfiguration data saved to: "+serverConfigPath+"\n");
                  configPrompt(21);
                  break;
               case "d":
                  var currentConfig = fs.readFileSync(serverConfigPath, {encoding:"utf-8"});
                  var configData = updateServerConfig(currentConfig);
                  rl.write("\nConfiguration JSON data:\n");
                  console.log (JSON.stringify(configData, null, 3)+"\n");
                  configPrompt(21);
                  rl.close();
                  break;
               case "r":
                  rl.write("\nConfiguration data cleared. Starting again.\n");
                  configPrompt(2);
                  break;
               default:
                  rl.write("\nPlease enter either \"S\", \"D\" or \"R\" followed by the ENTER key.\n");
                  configPrompt(20);
                  break;
            }
         });
         break;
      case 21:
         var walletInfo = "Bitcoin HD Wallets\r\n";
         walletInfo += "------------------\r\n";
         walletInfo += "Mainnet wallet mnemonic: "+wallets.bitcoin.mainnet.mnemonic;
         walletInfo += "\r\nMainnet wallet base58 public key (xpub): "+wallets.bitcoin.mainnet.pubKey;
         walletInfo += "\r\nMainnet wallet base58 private key (xpriv): "+wallets.bitcoin.mainnet.privKey;
         walletInfo += "\r\nMainnet wallet hex public key: "+wallets.bitcoin.mainnet.pubKeyHex;
         walletInfo += "\r\nMainnet wallet import format (WIF): "+wallets.bitcoin.mainnet.wif;
         walletInfo += "\r\nMainnet wallet hex private key: "+wallets.bitcoin.mainnet.privKeyHex;
         walletInfo += "\r\n\r\nTestnet wallet mnemonic: "+wallets.bitcoin.testnet.mnemonic;
         walletInfo += "\r\nTestnet wallet base58 public key (tpub): "+wallets.bitcoin.testnet.pubKey;
         walletInfo += "\r\nTestnet wallet base58 private key (tpriv): "+wallets.bitcoin.testnet.privKey;
         walletInfo += "\r\nTestnet wallet hex public key: "+wallets.bitcoin.testnet.pubKeyHex;
         walletInfo += "\r\nTestnet wallet hex private key: "+wallets.bitcoin.testnet.privKeyHex;
         walletInfo += "\r\nTestnet wallet import format (WIF): "+wallets.bitcoin.testnet.wif;
         walletInfo += "\r\n\r\nBitcoin Cash HD Wallets\r\n";
         walletInfo += "------------------\r\n";
         walletInfo += "Mainnet wallet mnemonic: "+wallets.bitcoincash.mainnet.mnemonic;
         walletInfo += "\r\nMainnet wallet base58 public key (xpub): "+wallets.bitcoincash.mainnet.pubKey;
         walletInfo += "\r\nMainnet wallet base58 private key (xpriv): "+wallets.bitcoincash.mainnet.privKey;
         walletInfo += "\r\nMainnet wallet hex public key: "+wallets.bitcoincash.mainnet.pubKeyHex;
         walletInfo += "\r\nMainnet wallet import format (WIF): "+wallets.bitcoincash.mainnet.wif;
         walletInfo += "\r\nMainnet wallet hex private key: "+wallets.bitcoincash.mainnet.privKeyHex;
         walletInfo += "\r\n\r\nTestnet wallet mnemonic: "+wallets.bitcoincash.testnet.mnemonic;
         walletInfo += "\r\nTestnet wallet base58 public key (tpub): "+wallets.bitcoincash.testnet.pubKey;
         walletInfo += "\r\nTestnet wallet base58 private key (tpriv): "+wallets.bitcoincash.testnet.privKey;
         walletInfo += "\r\nTestnet wallet hex public key: "+wallets.bitcoincash.testnet.pubKeyHex;
         walletInfo += "\r\nTestnet wallet hex private key: "+wallets.bitcoincash.testnet.privKeyHex;
         walletInfo += "\r\nTestnet wallet import format (WIF): "+wallets.bitcoincash.testnet.wif;
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
