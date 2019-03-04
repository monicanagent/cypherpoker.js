/**
* @file A SQLite 3 adapter for data storage and retrieval in CypherPoker.JS
*
* @version 0.0.1
* @author Patrick Bay
* @copyright MIT License
*/

const {spawn} = require('child_process');
const filesystem = require('fs');

/**
* @property {Object} sqlite3=null The child SQLite 3 process managed by this script.
*/
var sqlite3 = null;
/**
* @property {String} binVersion=null The version of the SQLite 3 binary.
*/
var binVersion = null;
/**
* @property {Object} initData=null The dynamic initialization data object received and
* processed by the {@link initialize} function.
*/
var initData = null;
/**
* @property {Boolean} dbOpened=true True if a valid SQLite 3 database file was opened
* via the {@link openDBFile} function. Database functionality may still be available
* if this value is false but the database will probably be in-memory only unless
* manually saved or exported.
*/
var dbOpened = false;
/**
* @property {Boolean} firstCapture=true True if the adapter is awaiting the first output
* from the child process' STDOUT output; set to false afterward.
*/
var firstCapture = true;
/**
* @property {Boolean} busy=true True if the adapter is currently busy processing a
* request, false if it's available.
*/
var busy = true;
/**
* @property {Array} requestQueue Array of requests queued if {@link busy} is true.
* The newest request is at the end of the array and the oldest at the beginning.
*/
var requestQueue = new Array();;
/**
* @property {Promise} currentPromise=null The promise representing the binary operation currently
* being processed.
*/
var currentPromise = null;
/**
* @property {Number} dbMaxMB=500 The maximum allowable size of the SQLite 3 database file.
*/
var dbMaxMB = 500;
/**
* @property {Boolean} logErrors=true Sends the SQLite 3 binary's error output to the error console if
* true.
*/
const logErrors = true;

/**
* Initializes the adapter and launches the binary appropriate to the detected platform
* and system architecture. This function is usually invoked by the parent host.
*
* @param {Object} initObj The initialization data object for the adapter.
*/
function initialize(initObj) {
   console.log ("Initializing SQLite 3 adapter...");
   var promise = new Promise(function(resolve, reject) {
      initData = initObj;
      var os = "";
      var bin = "";
      switch (process.platform) {
         case "win32":
            os = "win";
            //currently only 32-bit binaries are available for both architectures
            if (process.arch == "x32") {
               os += "32";
            } else if (process.arch == "x64") {
               os += "32";
            } else {
               throw (new Error ("Unrecognized hardware architecture: "+process.arch));
            }
            bin = "sqlite3.exe";
            break;
         case "linux":
            os = "linux";
            if (process.arch == "x32") {
               os += "32";
            } else if (process.arch == "x64") {
               os += "64";
            } else if (process.arch == "ia32") {
               os += "32";
            } else if (process.arch == "ia64") {
               os += "64";
            } else {
               throw (new Error ("Unrecognized hardware architecture: "+process.arch));
            }
            bin = "sqlite3";
            break;
         case "darwin":
            os = "osx";
            //todo: find out how OSX hardware architectures differ
            if (process.arch == "x32") {
               os += "";
            } else if (process.arch == "x64") {
               os += "";
            } else {
               throw (new Error ("Unrecognized OS: "+process.platform));
            }
            bin = "sqlite3";
            break;
         default:
            throw (new Error ("Unrecognized hardware architecture: "+process.arch));
            break;
      }
      initData.bin = initData.bin.split("%os%").join(os).split("%bin%").join(bin);
      initData.bin = filesystem.realpathSync.native(initData.bin); //convert to native path
      console.log ("Executing SQLite 3 binary: "+initData.bin);
      var options = new Object();
      options.cwd = "."; //process working directory
      options.shell = true; //hide console window
      options.windowsHide = true; //hide console window
      //add quotes to work with paths containing spaces
      initData.bin = "\""+initData.bin+"\"";
      //MUST include "-interactive" flag in order to receive STDOUT output:
      sqlite3 = spawn(initData.bin, ["-interactive"], options);
      //add output and process close handlers
      sqlite3.stdout.on('data', onSTDOUT);
      sqlite3.stderr.on('data', onSTDERR);
      sqlite3.on('close', onProcessClose);
      initData.dbFilePath = null; //no file open yet (using in-memory db by default)
      currentPromise = new Object();
      currentPromise.resolve = resolve;
      currentPromise.reject = reject;
      console.log ("SQLite3 adapter initialized.");
   });
   return (promise);
}

/**
* Handles the console (STDOUT) output of the SQLite 3 binary.
*
* @param {Buffer} data The raw data output of the binary.
*/
function onSTDOUT(data) {
   if (firstCapture == false) {
      //process command or query result
      if (currentPromise != null) {
         var results = collateResults(data.toString(), currentPromise.schema);
         currentPromise.resolve(results);
      }
      busy = false;
      processRequestQueue();
   } else {
      //process startup messages
      var versionStr = data.toString().split("\n")[0];
      var versionSplit = versionStr.split(" ");
      binVersion = versionSplit[0]+" "+versionSplit[1]+" "+versionSplit[2];
      console.log (binVersion);
      firstCapture = false;
      currentPromise.resolve(true);
      busy = false;
      processRequestQueue();
   }
}

/**
* Handles the error (STDERR) output of the SQLite 3 binary.
*
* @param {Buffer} data The error output of the binary.
*/
function onSTDERR(data) {
   if (logErrors) {
      console.error (data.toString());
   }
   if (firstCapture == false) {
      currentPromise.reject(data.toString());
      currentPromise = null;
   }
}

/**
* Event handler invoked when the child SQLite 3 binary process terminates.
*
* @param {Number} code The exit code with which the process ended.
*/
function onProcessClose(code) {
   //we don't expect the process to terminate while the application is running so we
   // display an error message:
   console.error ("SQLite3 process has terminated with code "+code);
   busy = true; //prevent any additional attempts to communicate with the process
   firstCapture = true; //in case it's restarted
}


/**
* Issues a file open command to the running SQLite 3 binary. Note that the binary
* automatically updates the opened file so no "save" function is provided.
*
* @param {String} dbFilePath The filesystem path to the SQLite 3 database file to
* open. If the file doesn't exist it will be created if possible.
*/
function openDBFile(dbFilePath) {
   initData.dbFilePath = dbFilePath;
   var promise = new Promise(function(resolve, reject) {
      sqlite3.stdin.write(".open "+initData.dbFilePath+"\n"); //issue ".open" command
      currentPromise = new Object();
      //use a non-standard structure for this call:
      currentPromise.resolve = onOpenDBFile;
      currentPromise.openResolve = resolve;
      currentPromise.reject = onOpenDBFileFail;
      currentPromise.openReject = reject;
   });
   return (promise);
}

/**
* Function invoked when a database file is successfully opened via the {@link openDBFile}
* function.
*/
function onOpenDBFile() {
   dbOpened = true;
   currentPromise.openResolve(true);
}

/**
* Function invoked when a database cannot be opened or created via the {@link openDBFile}
* function.
*/
function onOpenDBFileFail() {
   dbOpened = false;
   currentPromise.openReject(false);
}

/**
* Returns the size of a filesystem file.
*
* @param {String} filePath The filesystem path of the file to analyze.
* @param {String} [units="MB"] The case-sensitive units in which to return the resulting
* file size in. Valid values include: <code>KB</code> (kilobytes), <code>MB</code> (megabytes),
* and <code>GB</code> (gigabytes). If omitted or not one of the valid values then the result is
* returned in bytes.
*
* @return {Number} The size of the file specified by <code>filePath</code> in the specified
* <code>units</code>.
*/
function getFileSize(filePath, units="MB") {
   var stats = filesystem.statSync(filePath);
   var fileSize = stats.size;
   if (units == "KB") {
      fileSize /= 1000;
   } else if (units == "MB") {
      fileSize /= 1000000;
   } else if (units == "GB") {
      fileSize /= 1000000000;
   } else {
      //assume bytes
   }
   return (fileSize);
}

/**
* Parses a table schema result and returns it as an associate array for use
* with subsequent queries.
*
* @param {Array} resultArray The indexed result of a table schema (usually "PRAGMA") query.
*
* @return {Array} The parsed database schema as an indexed array with each element
* containing a column <code>name</code> and <code>type</code>.
*/
function parseSchema(resultArray) {
   var schemaArray = new Array();
   for (var count=0; count < resultArray.length; count++) {
      var currentLine = resultArray[count];
      var columnData = new Object();
      columnData.name = currentLine[1];
      columnData.type = currentLine[2];
      schemaArray.push(columnData);
   }
   return (schemaArray);
}

/**
* Parses and collates a query result using an optional schema definition.
*
* @param {String} resultData The raw query result string (for example, as that captured
* by {@link onSTDOUT}).
* @param {Array} [schemaArray=null] The optional schema array, as generated by a {@link parseSchema}
* call. If omitted, the data returned is anonymous (no column names are included).
* @param {String} [columnDelimiter="|"] The delimiter used to separate column data in the <code>resultData</code>.
* @param {String} [rowDelimiter="\r\n"] The delimiter used to separate rows in the <code>resultData</code>.
*
* @return {Array} An indexed array of collated results. If the <code>schemaArray</code> is supplied then each
* array element contains a name-value combination (where the name is the column name), otherwise only the value
* is containing in each element.
*/
function collateResults(resultData, schemaArray=null, columnDelimiter="|", rowDelimiter="\r\n") {
   var resultLines = resultData.split(rowDelimiter);
   var resultArray = new Array();
   //final line is prompt so omit it
   for (var count=0; count < (resultLines.length-1); count++) {
      var currentLine = resultLines[count];
      var rowArray = currentLine.split(columnDelimiter);
      if (schemaArray == null) {
         //value only (no column names)
         resultArray.push(rowArray);
      } else {
         var resultObj = new Object();
         for (var count2=0; count2<rowArray.length; count2++) {
            var currentColumnData = rowArray[count2];
            //name-value pairs
            resultObj[schemaArray[count2].name] = currentColumnData;
         }
         resultArray.push(resultObj);
      }
   }
   return (resultArray);
}

/**
* Returns the current CypherPoker.JS server wallet status, usually in response to
* a "walletstatus" API call.
*
* @return {Object} A JSON-RPC 2.0 data object containing the current server wallet
* information.
*/
async function getWalletStatus() {
   try {
      var jsonObj = buildJSONRPC();
      var resultObj = jsonObj.result;
      resultObj.bitcoin = new Object();
      resultObj.db = new Object();
      resultObj.bitcoin.main = new Object();
      resultObj.bitcoin.test3 = new Object();
      var querySQL = "PRAGMA table_info(`accounts`);"; //retrieve table schema
      var schemaData = await query(querySQL);
      var schema = parseSchema(schemaData);
      var querySQL = "SELECT * FROM `accounts` WHERE `type`=\"bitcoin\" AND `network`=\"main\" ORDER BY `addressIndex` DESC LIMIT 1;";
      var result = await query(querySQL, schema);
      if (result.length < 1) {
         //database empty
         resultObj.bitcoin.main.startChain = "0";
         resultObj.bitcoin.main.startIndex = "0";
      } else {
         resultObj.bitcoin.main.startChain = String(result[0].chain);
         resultObj.bitcoin.main.startIndex = String(result[0].addressIndex);
      }
      querySQL = "SELECT * FROM `accounts` WHERE `type`=\"bitcoin\" AND `network`=\"test3\" ORDER BY `addressIndex` DESC LIMIT 1;";
      result = await query(querySQL, schema);
      if (result.length < 1) {
         //database empty
         resultObj.bitcoin.test3.startChain = "0";
         resultObj.bitcoin.test3.startIndex = "0";
      } else {
         resultObj.bitcoin.test3.startChain = String(result[0].chain);
         resultObj.bitcoin.test3.startIndex = String(result[0].addressIndex);
      }
      var sizeMB = getFileSize(initData.dbFilePath, "MB");;
      resultObj.db.sizeMB = sizeMB;
      resultObj.db.maxMB = dbMaxMB;
      querySQL = "SELECT * FROM `accounts` WHERE `updated`=(SELECT MAX(DATETIME(updated)) FROM `accounts`) LIMIT 1;"
      result = await query(querySQL, schema);
      try {
         if (result.length < 1) {
            //no entries
            var latestUpdate = new Date(0); //start of epoch
         } else {
            var latestUpdate = new Date(result[0].updated);
         }
      } catch (err) {
         console.error("Unexpected database result in getWalletStatus:");
         console.dir(result);
      }
      var now = new Date();
      var elapsedUpdateSeconds = Math.floor((now.valueOf() - latestUpdate.valueOf()) / 1000);
      resultObj.db.elapsedUpdateSeconds = elapsedUpdateSeconds;
   } catch (err) {
      var jsonObj = buildJSONRPC("2.0", false);
      jsonObj.error.code = -32603;
      jsonObj.error.message = err;
   }
   return (jsonObj);
}

/**
* Returns an account record stored by the current CypherPoker.JS server, usually in response to
* a "getrecord" API call.
*
* @param {Object} requestObj The JSON-RPC 2.0 request containing the parameters of which
* account record to retrieve.
*
* @return {Object} A JSON-RPC 2.0 result object containing the found account information
* or a JSON-RPC 2.0 error object containing a description of the error generated during the
* attempt.
*/
async function getAccountRecord(requestObj) {
   try {
      var message = requestObj.params.message;
      var address = message.address;
      var accountType = message.type;
      var network = message.network;
      var jsonObj = buildJSONRPC();
      var querySQL = "PRAGMA table_info(`accounts`);"; //retrieve table schema
      var schemaData = await query(querySQL);
      var schema = parseSchema(schemaData);
      var querySQL = "SELECT * FROM `accounts` WHERE `address`=\""+address+"\" AND `type`=\""+accountType+"\" AND `network`=\""+network+"\" ORDER BY `primary_key` DESC LIMIT 2;";
      var result = await query(querySQL, schema);
      if (result.length > 0) {
         jsonObj.result = result;
      } else {
         jsonObj = buildJSONRPC("2.0", false);
         jsonObj.error.code = -32602;
         jsonObj.error.message = "No matching account.";
      }
   } catch (err) {
      var jsonObj = buildJSONRPC("2.0", false);
      jsonObj.error.code = -32603;
      jsonObj.error.message = err;
   }
   return (jsonObj);
}

/**
* Stores an account record to the current CypherPoker.JS server, usually in response to
* a "putrecord" API call.
*
* @param {Object} requestObj The JSON-RPC 2.0 request containing the parameters of the
* account to store.
*
* @return {Object} A JSON-RPC 2.0 result object containing an "OK" result if successful
* or a JSON-RPC 2.0 error object containing a description of the error generated during the
* attempt.
* @async
*/
async function putAccountRecord(requestObj) {
   var sizeMB = getFileSize(initData.dbFilePath, "MB");
   if (sizeMB >= dbMaxMB) {
      var jsonObj = buildJSONRPC("2.0", false);
      jsonObj.error.code = -32603;
      jsonObj.error.message = "Database limit exceeded.";
      return (jsonObj);
   }
   try {
      var message = requestObj.params.message;
      var querySQL = "INSERT INTO `accounts` (`type`, `network`, `chain`, `addressIndex`, `address`, `pwhash`, `balance`,`updated`) VALUES (";
      querySQL += "\""+message.type+"\",";
      querySQL += "\""+message.network+"\",";
      querySQL += message.chain+",";
      querySQL += message.addressIndex+",";
      querySQL += "\""+message.address+"\",";
      querySQL += "\""+message.pwhash+"\",";
      querySQL += "\""+message.balance+"\",";
      querySQL += "\""+message.updated+"\"";
      querySQL += ");";
      var jsonObj = buildJSONRPC();
      var result = await query(querySQL);
      jsonObj.result = "OK";
   } catch (err) {
      jsonObj = buildJSONRPC("2.0", false);
      jsonObj.error.code = -32603;
      jsonObj.error.message = err;
   }
   return (jsonObj);
}

/**
* Updates an account record to the current CypherPoker.JS server, usually in response to
* a "updaterecord" API call. Currently only the "updated" property of the account is
* changed with this call. For updating any other information use the {@link putAccountRecord}
* function in order to maintain a history of changes.
*
* @param {Object} requestObj The JSON-RPC 2.0 request containing the parameters of the
* account to update.
*
* @return {Object} A JSON-RPC 2.0 result object containing an "OK" result if successful
* or a JSON-RPC 2.0 error object containing a description of the error generated during the
* attempt.
* @async
*/
async function updateAccountRecord(requestObj) {
   var sizeMB = getFileSize(initData.dbFilePath, "MB");
   if (sizeMB >= dbMaxMB) {
      var jsonObj = buildJSONRPC("2.0", false);
      jsonObj.error.code = -32603;
      jsonObj.error.message = "Database limit exceeded.";
      return (jsonObj);
   }
   try {
      var jsonObj = buildJSONRPC();
      var message = requestObj.params.message;
      var querySQL = "UPDATE `accounts` SET `updated`=\""+message.updated+"\" WHERE `primary_key`="+message.primary_key+";";
      var result = await query(querySQL);
      jsonObj.result = "OK";
   } catch (err) {
      jsonObj = buildJSONRPC("2.0", false);
      jsonObj.error.code = -32603;
      jsonObj.error.message = err;
   }
   return (jsonObj);
}

/**
* Returns the number of seconds elapsed since the last update of any account in the database.
*
* @param {Date} latestUpdate A native Date object containing the date/time of the latest (newest) row
* retrieved from the database.
*
* @return {Number} The number of seconds elapsed since the last update of any account in the database.
*/
function getElapsedUpdateSeconds(latestUpdate) {
   var now = new Date();
   var elapsedSeconds = (date.valueOf() - latestUpdate.valueOf()) / 1000;
   if (elapsedSeconds < 0) {
      elapsedSeconds = 0;
   }
   return (elapsedSeconds);
}

/**
* Invokes an asynchronous request to the adapter, usually by a hosted application module
* (e.g. server API function). If the adapter is currently {@link busy} then the
* request is queued using {@link queueRequest}, otherwise it is processed immediately via
* {@link processRequest}.
*
* @param {Object} requestObj An object containing details of the request.
* @param {String} requestObj.method A database access method to invoke.
* @param {Object} requestObj.message Additional data included with the <code>method</code>
* such as a search parameter.
* @param {Function} requestObj.resolve The <code>resolve</code> method supplied in the caller's
* generated Promise to call on a successful result.
* @param {Function} requestObj.reject The <code>reject</code> method supplied in the caller's
* generated Promise to call on a failure.
*
* @return {Promise} The promise resolves with the result of the invocation or rejects
* with an error.
*/
function invoke(requestObj) {
   var queueObj = new Object();
   queueObj.requestObj = requestObj;
   var promise = new Promise(function(resolve, reject) {
      queueObj.resolve = resolve;
      queueObj.reject = reject;
   });
   if (busy == false) {
      processRequest(queueObj);
   } else {
      queueRequest(queueObj);
   }
   return (promise);
}

/**
* Queues a request made through the {@link invoke} function, usually if the adapter
* is currently {@link busy}, to the {@link requestQueue}.
*
* @param {Object} queueObj An object containing the request and promise references to
* queue.
* @param {Object} queueObj.requestObj Contains the details and parameters of the
* request being queued.
* @param {Function} queueObj.resolve The associated Promise's <code>resolve</code> function
* to be invoked when the request has successfully been processed.
* @param {Function} queueObj.reject The associated Promise's <code>reject</code> function
* to be invoked when the request has been rejected (an error thrown or an invalid result received).
*/
function queueRequest(queueObj) {
   requestQueue.push(queueObj);
}

/**
* Removes the first queued request in the {@link requestQueue} and
* processes it via {@link processRequest}.
*/
function processRequestQueue() {
   if (requestQueue.length > 0) {
      var queueObj = requestQueue.shift();
      processRequest(queueObj);
   }
}

/**
* Immediately processes a queued request made to the adapter.
*
* @param {Object} queueObj An object containing the queued request and promise references.
* @param {Object} queueObj.requestObj Contains the details and parameters of the
* queued request.
* @param {Function} queueObj.resolve The associated Promise's <code>resolve</code> function
* to be invoked when the request has successfully been processed.
* @param {Function} queueObj.reject The associated Promise's <code>reject</code> function
* to be invoked when the request has been rejected (an error thrown or an invalid result received).
*/
function processRequest(queueObj) {
   busy = true;
   var requestObj = queueObj.requestObj;
   var resolve = queueObj.resolve;
   var reject = queueObj.reject;
   switch (requestObj.method) {
      case "walletstatus":
         getWalletStatus().then(resultObj => {
            resolve(resultObj);
            busy = false;
            processRequestQueue();
         }).catch(errorObj => {
            reject(errorObj);
            busy = false;
            processRequestQueue();
         });
         break;
      case "getrecord":
         getAccountRecord(requestObj).then(resultObj => {
            resolve(resultObj);
            busy = false;
            processRequestQueue();
         }).catch(errorObj => {
            reject(errorObj);
            busy = false;
            processRequestQueue();
         });
         break;
      case "putrecord":
         putAccountRecord(requestObj).then(resultObj => {
            resolve(resultObj);
            busy = false;
            processRequestQueue();
         }).catch(errorObj => {
            reject(errorObj);
            busy = false;
            processRequestQueue();
         });
         break;
      case "updaterecord":
         updateAccountRecord(requestObj).then(resultObj => {
            resolve(resultObj);
            busy = false;
            processRequestQueue();
         }).catch(errorObj => {
            reject(errorObj);
            busy = false;
            processRequestQueue();
         });
         break;
      default:
         var errorObj = buildJSONRPC("2.0", false);
         errorObj.error.code = -32601;
         errorObj.error.message = "Method "+requestObj.method+" not found.";
         reject (errorObj);
         busy = false;
         processRequestQueue();
         break;
   }
}

/**
* Executes an asynchronous query on the database.
*
* @param {String} SQL The query to execute.
* @param {Array} [schemaArray=null] A parsed table schema array to apply to to the query result.
* If omitted, each result row's column is returned as an indexed element rather than
* a named one.
*
* @return {Promise} The promise resolves with an array of results with each element containing
* a result row. Each result row will either contain indexed (anonymous) column values if
* <code>schema</code> is null or name-value pairs if a matching table <code>schema</code> is
* supplied. A standard <code>Error</code> object is included with a rejection.
*/
function query(SQL, schemaArray=null) {
   var promise = new Promise(function(resolve, reject) {
      currentPromise = new Object();
      currentPromise.schema = schemaArray;
      currentPromise.resolve = resolve;
      currentPromise.reject = reject;
      sqlite3.stdin.write(SQL+"\n");
   });
   return (promise);
}

/**
* Builds a JSON-RPC message object.
*
* @param {String} [version="2.0"] The JSON-RPC version to designate the object as.
* Currently only JSON-RPC 2.0 message formatting is supported and other versions
* will throw an error. If this parameter is null, the default value is assumed.
* @param {Boolean} [isResult=true] True if this is a result object or
* notification, false if it's an error.
* @param {Boolean} [includeUniqueID=false] A uniquely generated message ID
* will be generated if true otherwise no ID is included (e.g. notification).
*/
function buildJSONRPC(version="2.0", isResult=true, includeUniqueID=false) {
   var jsonObj = new Object();
   if (version == null) {
      version = "2.0";
   }
   version = version.trim();
   if (version != "2.0") {
      throw (new Error("Unsupported JSON-RPC message format version (\"" + version + "\")"));
   }
   jsonObj.jsonrpc = version;
   if (includeUniqueID) {
      jsonObj.id = String(Date.now()).split("0.").join("");
   }
   if (isResult) {
      jsonObj.result = new Object();
   } else {
      jsonObj.error = new Object();
      jsonObj.error.message = "An error occurred.";
      jsonObj.error.code = -32603; //internal error
   }
   return (jsonObj);
}
