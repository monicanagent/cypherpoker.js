/**
* @file Entry point for CypherPoker.JS desktop (Electron) that launches bundled server and client processes.
* @version 0.4.1
* @author Patrick Bay
* @copyright MIT License
*/

//JSDoc typedefs:
/**
* Application objects exposed to the loaded server context in addition to any
* already available objects.
* @typedef {Object} Exposed_Application_Objects
* @default {
*  electronEnv:{@link electronEnv},<br/>
*  require:require,<br/>
*  Buffer:Buffer,<br/>
*  console:console,<br/>
*  module:module,<br/>
*  setInterval:setInterval,<br/>
*  clearInterval:clearInterval,<br/>
*  setTimeout:setTimeout,<br/>
*  clearTimeout:clearTimeout,<br/>
*  process:process,<br/>
* startDatabase: startDatabase
* }
*/

const {app, BrowserWindow, ipcMain,Menu} = require("electron");
const vm = require("vm");
const fs = require("fs");

/**
* @property {String} appVersion The version of the application. This information
* is appended to the {@link appTitle} and may be used in other places in the application.
*/
const appVersion = "0.4.0";
/**
* @property {String} appName The name of the application. This information
* is prepended to the {@link appTitle} and may be used in other places in the application.
*/
const appName = "CypherPoker.JS";
/**
* @property {String} appTitle The title of the application as it should appear in
* the main app window. This title may pre-pend additional information in any
* launched child windows.
*/
const appTitle = appName+" v"+appVersion;
/**
* Electron application environment settings and references. Note that the values
* defined here may be overwritten at any time during runtime from their
* default values.
* @property {Object} electronEnv
* @property {Object} electronEnv.dir (Usually) relative directory references for
* the application.
* @property {String} electronEnv.dir.server="../server/" Directory containing the
* WebSocket Sessions server, accompanying API functionality, and data.
* @property {String} electronEnv.dir.client="../web/" Directory containing the
* web/browser client functionality and data.
* @property {String} electronEnv.dir.bin="./bin/" Directory containing additional
* platform-specific binaries used by CypherPoker.JS desktop.
* @property {Object} electronEnv.client Contains references and information
* about the web/browser client portion of the application. This information is made
* available to any child windows created by the main process.
* @property {Number} electronEnv.client.width=1024 The initial width of the main
* Electron {@link BrowserWindow} object.
* @property {Number} electronEnv.client.height=768 The initial height of the main
* Electron {@link BrowserWindow} object.
* @property {Object} electronEnv.server Contains references and information
* about the server portion of the application.
* @property {Exposed_Application_Objects} electronEnv.server.exposed_objects Objects exposed to
* (made available to), the execution context of the server.
* @property {Function} electronEnv.server.onInit=createClient The callback function to be
* invoked by the loaded server when it has fully initialized. This function typically opens
* the first/main user interface window.
* @property {Object} electronEnv.database Contains settings for the database adapters that
* can be started using the {@link startDatabase} function. Each adapter's settings vary
* but each has at least a <code>script</code> path that specifies the adapter's script and
* an <code>adapter</code> reference that points to the virtual machine instance hosting the
* running <code>script</code>.
* @property {Number} electronEnv.host=this A reference to the main Electron
* process used to launch the server and client.
*/
var electronEnv = {
   dir: {
      server:"../server/",
      client:"../web/"
   },
   client: {
      version:appVersion,
      name:appName,
      title:appTitle,
      width:1024,
      height:768
   },
   server: {
      exposed_objects: {
        electronEnv:null,
        require:require,
        Buffer:Buffer,
        console:console,
        module:module,
        setInterval:setInterval,
        clearInterval:clearInterval,
        setTimeout:setTimeout,
        clearTimeout:clearTimeout,
        process:process,
        startDatabase:startDatabase
     },
     onInit:createClient
   },
   database: {
    sqlite3: {
      adapter: null,
      script: "./adapters/sqlite3.js",
      bin: "./bin/sqlite/%os%/%bin%"
    }
   },
   host:null
}

/**
* @property {Array} windows Indexed array of objects, each containing a
* <code>win</code> BrowserWindow reference and an <code>ipcID</code> identifier
* string for IPC communications.
*/
var windows = new Array();
/**
* Handles any uncaught promise rejections (Node.js will terminate on
* uncaught rejections in future versions).
*/
process.on("unhandledRejection", (reason, p) => {
  console.log("Unhandled Promise Rejection: "+reason);
  //application specific logging, throwing an error, or other logic here
});

/**
* Starts a database adapter and makes it available to the application.
*
* @param {String} dbAdapter The database adapter to start. The name must match one of those defined
* in the {@link electronEnv}.database objects.
*/
async function startDatabase(dbAdapter) {
   var adapterData = electronEnv.database[dbAdapter];
   var scriptPath = adapterData.script;
   var adapterScript = fs.readFileSync(scriptPath, {encoding:"UTF-8"});
   var vmContext = new Object();
   vmContext = Object.assign(electronEnv.server.exposed_objects, vmContext);
   var context = vm.createContext(vmContext);
   vm.runInContext(adapterScript, context, {
     displayErrors: true,
     filename: scriptPath
   });
   adapterData.adapter = context;
   try {
      var result = await context.initialize(adapterData);
      return (true);
   } catch (err) {
      console.error ("Couldn't initialize \""+dbAdapter+"\" database adapter: \n"+err.stack);
      return (false);
   }
}

/**
* Creates and initializes the main WebSocket Sessions server process that
* contains all of the non-client-bound (server) functionality.
*
* @return {Promise} The returned promise resolves with <code>true</code> if the
* server process was successfully started and initialized, otherwise an
* exception is thrown with a standard <code>Error</code> object.
* @async
*/
async function createServer() {
   electronEnv.server.exposed_objects.electronEnv = electronEnv; //add internal self-reference(!)
   var scriptPath = electronEnv.dir.server + "server.js";
   var serverScript = fs.readFileSync(scriptPath, {encoding:"UTF-8"});
   var vmContext = new Object();
   vmContext = Object.assign(electronEnv.server.exposed_objects, vmContext);
   var context = vm.createContext(vmContext);
   vm.runInContext(serverScript, context, {
     displayErrors: true,
     filename: scriptPath
   });
   return (true);
}

/**
* Creates and initializes a main window process that contains the client-bound
* (web browser) functionality. The new window will open with the properties
* defined in the {@link electronEnv}<code>.client</code> object.
*
* @param {String} [script="index.html"] The script file within the <i>web</i>
* ({@link electronEnv}<code>.dir.client</code>) folder to open.
* @param {String} [windowName=appTitle] The name to use in the new windowss title
* bar.
* @param {Boolean} [openDevTools=false] If true the new window will open with
* the Chrome DevTools panel open.
*
* @return {Promise} The returned promise resolves with <code>true</code> if the
* client process was successfully started and initialized, otherwise an
* exception is thrown with a standard <code>Error</code> object.
* @async
*/
async function createClient(script="index.html", windowName=appTitle, openDevTools=false) {
   var windowObj = new Object();
   windowObj.win = new BrowserWindow({
      width:electronEnv.client.width,
      height:electronEnv.client.height,
      nodeIntegration:true
   });
   windowObj.win.loadFile(electronEnv.dir.client + script);
   windowObj.win.setTitle(appTitle);
   if (openDevTools) {
      windowObj.win.webContents.openDevTools();
   }
   windowObj.win.on("closed", onClientHostClosed);
   windows.push(windowObj);
   return (true);
}

/**
* Invoked when an interprocess message is asynchronously received
* from a child process on the "ipc-main" channel. The synchronous IPC response
* will be an object with at least response <code>type</code> string and some
* <code>data</code>.
*
* @param {Event} event The event being dispatched.
* @param {Object} request The request object. It must contain at least
* a <code>command</string> to process by the handler.
*
* @private
*/
function onIPCMessage (event, request) {
   var response = new Object();
   //be sure not to include any circular references in the response
   //since it will be stringified before being returned...
   switch (request.command) {
      case "init":
         response.type = "init";
         response.data = electronEnv.client;
         var winFound = false;
         for (var count=0; count<windows.length; count++) {
            var currentWindow = windows[count].win;
            var windowWC = currentWindow.webContents;
            if (event.sender === windowWC) {
               windows[count].ipcID = request.data.ipcID;
               winFound = true;
               break;
            }
         }
         if (winFound == false) {
            response.type = "error";
            response.data = new Object();
            response.data.code = -2;
            response.data.message = "Couldn't find matching window.webContents reference for ipcID \""+request.data.ipcID+"\".";
         }
         break;
      case "new-window":
         createClient();
         break;
      case "database-info":
         for (var db in electronEnv.database) {
            response[db] = new Object();
            response[db].version = electronEnv.database[db].adapter.binVersion;
            var dbFilePath = electronEnv.database[db].adapter.initData.dbFilePath;
            response[db].dbFilePath = dbFilePath;
            response[db].dbMaxMB = electronEnv.database[db].adapter.dbMaxMB;
            response[db].dbSizeMB = electronEnv.database[db].adapter.getFileSize(dbFilePath, "MB");
         }
         break;
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
* Event listener invoked when the client host environment (Electron), is
* closed.
*/
function onClientHostClosed() {
   electronEnv.client.host = null;
}

//Electron core event handlers and application startup:

console.log ("Electron version: "+process.versions.electron);
console.log ("Chrome version: "+process.versions.chrome);
console.log ("Node.js version: "+process.versions.node);
console.log ("Host platform: "+process.platform+" ("+process.arch+")");

/**
* Function invoked when Electron has fully initialized, full API is available, and client windows
* may now be safely opened.
*
* @param {Object} launchInfo On macOS, launchInfo holds the userInfo of the NSUserNotification
* that was used to open the application, if it was launched from Notification Center.
*/
function onAppReady(launchInfo) {
   Menu.setApplicationMenu(null); //remove default menu
   createServer(); //database is launched by server (if enabled)
}

/**
* (MacOS only)  Various actions can trigger this event, such as launching the
* application for the first time, attempting to re-launch the application when
* it's already running, or clicking on the application's dock or taskbar icon.
*/
function onAppActivate() {
   Menu.setApplicationMenu(null); //remove default menu
  // On macOS it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
   if (mainWindow === null) {
      startDatabase("sqlite3").then(result => {
         createServer();
      }).catch(err => {
         console.error (err.stack);
      });
   }
}

/**
* All child windows have been closed; application will terminate.
*/
function onAppAllWindowsClosed() {
   // On macOS it is common for applications and their menu bar
   // to stay active until the user quits explicitly with Cmd + Q
   if (process.platform !== "darwin") {
     app.quit()
   }
}

/**
* Starts the application by binding core app events, setting initial data
* and references, and invoking any initialization functions.
*/
function start() {
   app.setName(appTitle); //override the default app name
   app.on("ready", onAppReady);
   app.on("window-all-closed", onAppAllWindowsClosed);
   app.on("activate", onAppActivate);
   ipcMain.on("ipc-main", onIPCMessage); //set IPC message handler
}

//start the application:
electronEnv.host = this;
start();
