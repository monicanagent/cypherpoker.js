/**
* @file JavaScript file responsible for loading additional external scripts. Also
* provides functionality for additional dynamic loading of scripts and JSON
* data.
*/

/**
* @property {String} _settingsURL="./scripts/settings.json" The URL of the main
* settings JSON file.
* @private
*/
const _settingsURL = "./scripts/settings.json";
/**
* @property {Boolean} _useCache=false Will force script-based loads to bypass
* local browser caches if false.
* @private
*/
const _useCache = false;
/**
* @property {CypherPoker} cypherpoker=null A reference to the main CypherPoker.JS instance.
* @private
*/
var cypherpoker = null;
/**
* @property {CypherPokerUI} ui=null A reference to the CypherPokerUI instance
* @private
*/
var ui = null;

/**
* @property {Array} _require Indexed array of required external scripts,
* in the order that they must be loaded in.
* @property {String} _require.url The URL of the external script to load.
* @property {Function} [_require.onload] A function reference to invoke
* when the script is finished loading.
* @private
*/
const _require = [
   {"url":"./scripts/libs/EventDispatcher.js"},
   {"url":"./scripts/libs/EventPromise.js"},
   {"url":"./scripts/libs/RPC.js"},
   {"url":"./scripts/libs/TextEncoder.js"},
   {"url":"./scripts/libs/WSS.js"},
   {"url":"./scripts/libs/WorkerHost.js"},
   {"url":"./scripts/libs/SRACrypto.js"},
   {"url":"./scripts/libs/BigInteger.min.js"},
   {"url":"./scripts/CypherPokerGame.js"},
   {"url":"./scripts/CypherPokerPlayer.js"},
   {"url":"./scripts/CypherPokerAccount.js"},
   {"url":"./scripts/CypherPokerCard.js"},
   {"url":"./scripts/CypherPokerContract.js"},
   {"url":"./scripts/CypherPokerAnalyzer.js"},
   {"url":"./scripts/CypherPokerUI.js",
      "onload": () => {
         //game UI is contained in #game element
         var gameElement = document.querySelector("#game");
         ui = new CypherPokerUI(gameElement);
      }
   },
   {"url":"./scripts/CypherPoker.js",
      "onload": () => {
         ui.showDialog ("Loading game settings...");
         //EventDispatcher and EventPromise must already exist here!
         loadJSON(_settingsURL).onEventPromise("load").then(promise => {
            if (promise.target.response != null) {
               cypherpoker = new CypherPoker(promise.target.response);
               ui.cypherpoker = cypherpoker; //connect the instance to the UI
               cypherpoker.start().then(result => {
                  console.log ("CypherPoker.JS instance fully started and connected.");
               }).catch(err => {
                  ui.showDialog(err.message);
                  console.error(err.stack);
               });
            } else {
               alert (`Settings data (${_settingsURL}) not loaded or parsed.`);
               throw (new Error(`Settings data (${_settingsURL}) not loaded or parsed.`));
            }
         });
      }
   }
]

/**
* Loads an external JavaScript file by adding a <script> tag to the
* DOM's <head> tag.
*
* @param {String} scriptURL The URL of the script to load and parse.
* @private
*/
function loadJavaScript(scriptURL) {
   var script = document.createElement("script");
   script.setAttribute("type", "text/javascript");
   script.setAttribute("language", "text/JavaScript");
   if (_useCache == false) {
      //force new script
      scriptURL = scriptURL + "?" + String(Math.random()).split("0.")[1];
   }
   script.setAttribute("src", scriptURL);
   script.addEventListener ("load", onLoadJavaScript);
   document.getElementsByTagName("head")[0].appendChild(script);
}

/**
* Event handler invoked when an external JavaScript file has completed loading.
* The next file in the {@link _requires} array is automatically loaded.
*
* @param {Event} event A standard DOM event object.
* @private
*/
function onLoadJavaScript(event) {
   var loadedObj = _require.shift(); //important! -- remove current element from array
   var loadedURL = loadedObj.url;
   var loadedTimeStamp = new Date(event.timeStamp);
   console.log (`"${loadedURL}" loaded at ${loadedTimeStamp.getSeconds()}s ${loadedTimeStamp.getMilliseconds()}ms`);
   if (_require.length > 0) {
      loadJavaScript (_require[0].url);
   } else {
      console.log (`All scripts loaded in ${loadedTimeStamp.getSeconds()}s ${loadedTimeStamp.getMilliseconds()}ms`);
   }
   if (typeof loadedObj["onload"] == "function") {
      loadedObj.onload();
   }
}

/**
* Loads an external JSON data file using XMLHTTPRequest.
*
* @param {String} jsonURL The URL of the JSON data file to load and parse.
* @private
*/
function loadJSON(jsonURL) {
   var xhr = new XMLHttpRequest();
   if (_useCache == false) {
      //force new data load
      jsonURL = jsonURL + "?" + String(Math.random()).split("0.")[1];
   }
   xhr.open("GET", jsonURL);
   xhr.overrideMimeType("application/json");
   xhr.responseType = "json";
   xhr.send();
   return (xhr);
}

/**
* Main page load handler; invokes {@link loadJavaScript} with the first
* JavaScript file found in the {@link _requires} array.
* @private
*/
onload = function () {
   loadJavaScript (_require[0].url);
}
