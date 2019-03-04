/**
* @file Main file responsible for starting up the web (client) portion of
* CypherPoker.JS. Also provides functionality for dynamic loading of additional
* scripts and JSON data.
*/

/**
* @property {String} appVersion The version of the application. This information
* is appended to the {@link appTitle}.
*/
var appVersion = "0.4.1";
/**
* @property {String} appName The name of the application. This information
* is prepended to the {@link appTitle}.
*/
var appName = "CypherPoker.JS";
/**
* @property {String} appTitle The title of the application as it should appear in
* the main browser window / tab and any new windows / tabs. If running as a desktop
* (Electron) application, this is the name that appears on all child windows of
* the main process.
*/
var appTitle = appName+" v"+appVersion;
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
* @property {Object} hostEnv=null Contains settings and references supplied by
* a non-browser host environment such as Electron. When running as a standard web
* page in a browser this value should remain null.
*/
var hostEnv = null;
/**
* @property {Object} ipcRenderer=null A reference to the <code>ipcRenderer</code>
* object of the host desktop (Electron) environment. If this script is running
* within a standard web browser this reference will remain <code>null</code>.
*/
var ipcRenderer = null;
/**
* @property {String} ipcID=null an interprocess communication ID used to
* identify this window (child process) to the main process. If not running
* in a desktop (Electron) environment, this value will remain <code>null</code>.
*/
var ipcID = null;
/**
* @property {Array} _require Indexed array of required external scripts,
* in the order that they must be loaded in.
* @property {String} _require.url The URL of the external script to load.
* @property {Function} [_require.onload] A function reference to invoke
* when the script is finished loading.
* @private
*/
const _require = [
   {"url":"./scripts/libs/platform.js"},
   {"url":"./scripts/libs/Polyfills.js"},
   {"url":"./scripts/libs/EventDispatcher.js"},
   {"url":"./scripts/libs/EventPromise.js"},
   {"url":"./scripts/libs/RPC.js"},
   {"url":"./scripts/libs/WSS.js"},
   {"url":"./scripts/libs/WebRTCClient.js"},
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
         //game UI to be contained in the #game element
         var gameElement = document.querySelector("#game");
         ui = new CypherPokerUI(gameElement);
      }
   },
   {"url":"./scripts/CypherPoker.js",
      "onload": () => {

         //Temporary WebRTC test code starts:
         //var rtc = new WebRTCClient();
         //var promise = rtc.onEventPromise("icecandidate").then (event => {
         //   console.log ("description:\n"+JSON.stringify(event.description));
         //});
         //rtc.createPeerConnection();
         //Temporary WebRTC test code ends.

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
      //force script load (ignore cache)
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
*
* @return {XMLHTTPRequest} The XHR instance used to load the data.
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
* Sends an IPC command to the main Electron process if this script is
* running within a desktop (Electron) environment.
*
* @param {String} command The command to send to the main process via IPC.
* @param {*} [data=null] Any accompanying data to include with the <code>command</code>.
* If omitted or <code>null</code>, an empty object is created.
*
* @return {Object} A reply object is immediately returned if the desktop IPC
* interface is available otherwise <code>null</code> is returned.
*/
function IPCSend (command, data=null) {
   if (isDesktop()) {
      var request = new Object();
      request.command = command;
      if (data == null) {
         data = new Object();
      }
      request.data = data;
      request.data.ipcID = ipcID;
      try {
         return (ipcRenderer.sendSync("ipc-main", request));
      } catch (err) {
         console.error (err.stack);
      }
   } else {
      return (null);
   }
}

/**
* Invoked when an interprocess message is asynchronously received
* from the main process on the "ipc-main" channel. The synchronous IPC response
* will be an object with at least a response <code>type</code> string and some
* <code>data</code>. If this script is not running in a desktop (Electron)
* host environemnt this handler will never be invoked.
*
* @param {Event} event The event being dispatched.
* @param {Object} request The request object. It must contain at least
* a <code>command</string> to process by the handler.
*
* @private
*/
function onIPCMessage(event, request) {
   var response = new Object();
   if (request.ipcID != ipcID) {
      //not for this window / child process
      return;
   }
   //be sure not to include any circular references in the response
   //since it will be stringified before being returned...
   switch (request.command) {
      default:
         response.type = "error";
         response.data = new Object();
         response.data.code = -1;
         response.data.message = "Unrecognized IPC request command \""+request.command+"\"";
         break;
   }
   event.returnValue = response; //respond immediately
   //...or respond asynchronously:
   //event.sender.send(request.ipcID, response);
}

/**
* Invoked when a key, or key combination, is pressed on the keyboard.
*
* @param {Event} event The event being dispatched.
* @param {Object} request The request object. It must contain at least
* a <code>command</string> to process by the handler.
*
* @private
*/
function onKeyPress(event) {
   const key = event.key;
   var alt = event.altKey;
   var ctrl = event.ctrlKey;
   var shift = event.shiftKey;
   if (isDesktop()) {
      //matches Dev Tools toogle keyboard shortcut in standard browser
      if ((ctrl == true) && (alt == false) && (shift == true) && ((key == "i") || (key == "I"))) {
         //toggle Dev Tools on all open windows:
         // IPCSend("toggle-devtools", {all:true});
         IPCSend("toggle-devtools");
      }
   }
}

/**
* Tests whether or not the host environment is a desktop (Electron) one.
*
* @return {Boolean} True if the host environment is a desktop (Electron) one
* otherwise it's a standard web (browser) host environment.
*/
function isDesktop() {
   if ((ipcRenderer != null) && (ipcID != null)) {
      return (true);
   }
   return (false);
}

/**
* Main page load handler; invokes {@link loadJavaScript} with the first
* JavaScript file found in the {@link _requires} array.
* @private
*/
onload = function () {
   try {
      //try initializing through Electron IPC
      ipcRenderer = require("electron").ipcRenderer;
      ipcRenderer.on("ipc-main", onIPCMessage); //set IPC message handler
      ipcID = String(Math.random()).split("0.")[1];
      var initData = new Object();
      initData.ipcID = ipcID;
      hostEnv = IPCSend("init", initData).data;
      appVersion = hostEnv.version;
      appName = hostEnv.name;
      appTitle = hostEnv.title;
      console.log ("Desktop (Electron) host environment detected.");
   } catch (err) {
      //probably running in standard browser
      console.log ("Browser (web) host environment detected.");
      ipcRenderer = null;
      hostEnv = null;
      ipcID = null;
   } finally {
      window.addEventListener('keydown', onKeyPress);
   }
   document.title = appTitle;
   loadJavaScript (_require[0].url);
}
