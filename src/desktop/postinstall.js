/**
* @file A post-install script for CypherPoker.JS desktop to patch installed modules for
* compatibility with Electron, apply any required file permissions, etc.
*
* @version 0.0.1
*/
const fs = require("fs");

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
