/**
* @file A SQLite 3 adapter for data storage and retrieval in CypherPoker.JS
*
* @version 0.5.0
* @author Patrick Bay
* @copyright MIT License
*/

const {spawn} = require("child_process");
const filesystem = require("fs");
const path = require("path");

/**
* @class Adapter for SQLite 3 database functionality using the native binary.
*/
module.exports = class SQLite3 {

   /**
   * Creates a new instance of the SQLite 3 adapter.
   *
   * @param {Object} serverRef A reference to the server-exposed objects made available
   * to this class.
   */
   constructor(serverRef) {
      this._server = serverRef
      this._firstCapture = true;
   }

   /**
   * @property {Object} server A reference to the server-exposed objects made available
   * to this class at instantiation time.
   * @readonly
   */
   get server() {
      return (this._server);
   }

   /**
   * @property {Object} sqlite3=null The child SQLite 3 process managed by this script.
   * @readonly
   */
   get sqlite3() {
      if (this._sqlite3 == undefined) {
         this._sqlite3 = null;
      }
      return (this._sqlite3);
   }

   /**
   * @property {String} binVersion=null The version of the SQLite 3 binary.
   * @readonly
   */
   get binVersion() {
      if (this._binVersion == undefined) {
         this._binVersion = null;
      }
      return (this._binVersion);
   }

   /**
   * @property {Object} initData=null The dynamic initialization data object received and
   * processed by the {@link initialize} function.
   * @readonly
   */
   get initData() {
      if (this._initData == undefined) {
         this._initData = null;
      }
      return (this._initData);
   }
   /**
   * @property {Boolean} dbOpened=false True if a valid SQLite 3 database file was opened
   * via the {@link openDBFile} function. Database functionality may still be available
   * if this value is false but the database will probably be in-memory only unless
   * manually saved or exported.
   * @readonly
   */
   get dbOpened() {
      if (this._dbOpened == undefined) {
         this._dbOpened = false;
      }
      return (this._dbOpened);
   }

   /**
   * @property {String} EORDelimiter A delimiter string appended to the end
   * of database result sets in order to determine when results have been
   * fully received (especially important when empty results are received).
   * This value should be chosen carefully so that it won't match any returned
   * values.
   *
   * @readonly
   */
   get EORDelimiter() {
      return ("<!--ENDOFRESULTS-->");
   }

   /**
   * @property {Number} dbMaxMB=500 The maximum allowable size of the SQLite 3 database file.
   * @readonly
   */
   get dbMaxMB() {
      return (500);
   }
   /**
   * @property {Boolean} logErrors=true Sends the SQLite 3 binary's error output to the error console if
   * true.
   * @readonly
   */
   get logErrors() {
      return (true);
   }

   /**
   * Initializes the adapter and launches the binary appropriate to the detected platform
   * and system architecture. This function is usually invoked by the parent host.
   *
   * @param {Object} initObj The initialization data object for the adapter.
   */
   initialize(initObj) {
      console.log ("SQLite3 > Initializing SQLite 3 adapter...");
      var promise = new Promise((resolve, reject) => {
         this._initData = initObj;
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
         this._initData.bin = this._initData.bin.split("%os%").join(os).split("%bin%").join(bin);
         this._initData.bin = filesystem.realpathSync.native(this._initData.bin); //convert to native path
         console.log ("SQLite3 > Executing SQLite 3 binary: "+this._initData.bin);
         var options = new Object();
         if (this.server.hostEnv.embedded == true) {
            //run in / output to temp directory
            options.cwd = this.server.hostEnv.dir.temp;
         } else {
            //run in / output to current (process) directory
            options.cwd = ".";
         }
         options.shell = true; //hide console window
         options.windowsHide = true; //hide console window
         //add quotes to work with paths containing spaces
         this._initData.bin = "\""+this._initData.bin+"\"";
         //MUST include "-interactive" flag in order to receive STDOUT output:
         this._sqlite3 = spawn(this._initData.bin, ["-interactive"], options);
         //add output and process close handlers
         this._sqlite3.stdin.write(".echo off\n");
         this._sqlite3.stdout.on('data', this.onSTDOUT.bind(this));
         this._sqlite3.stderr.on('data', this.onSTDERR.bind(this));
         this._sqlite3.on('close', this.onProcessClose.bind(this));
         this._initData.dbFilePath = null; //no file open yet (using in-memory db by default)
         this.currentPromise = new Object();
         this.currentPromise.resolve = resolve;
         this.currentPromise.reject = reject;
         console.log ("SQLite3 > Initialized.");
      });
      return (promise);
   }

   /**
   * Handles the console (STDOUT) output of the SQLite 3 binary.
   *
   * @param {Buffer} data The raw data output of the binary.
   */
   onSTDOUT(data) {
      if (this._firstCapture == false) {
         //process command or query result
         if (this.currentPromise != null) {
            if (this.currentPromise.sql == undefined) {
               this.currentPromise.resolve.call(this, null);
            }
         }
      } else {
         //process startup messages
         var versionStr = data.toString().split("\n")[0];
         var versionSplit = versionStr.split(" ");
         //this._binVersion = versionSplit[0]+" "+versionSplit[1]+" "+versionSplit[2]; //full version
         this._binVersion = versionSplit[2]; //version number (short version)
         console.log ("SQLite3 > Binary version: "+this.binVersion);
         this._firstCapture = false;
         this.currentPromise.resolve.call(this, true);
      }
   }

   /**
   * Handles the error (STDERR) output of the SQLite 3 binary.
   *
   * @param {Buffer} data The error output of the binary.
   */
   onSTDERR(data) {
      if (this.logErrors) {
         console.error ("SQLite3 > "+data.toString());
      }
   }

   /**
   * Event handler invoked when the child SQLite 3 binary process terminates.
   *
   * @param {Number} code The exit code with which the process ended.
   */
   onProcessClose(code) {
      //we don't expect the process to terminate while the application is running so we
      // display an error message:
      console.error ("SQLite3 > Process has terminated with code "+code);
      this._firstCapture = true; //in case it's restarted
   }


   /**
   * Issues a file open command to the running SQLite 3 binary. Note that the binary
   * automatically updates the opened file so no "save" function is provided.
   *
   * @param {String} dbFilePath The filesystem path to the default SQLite 3 database file to
   * open. If the file doesn't exist it will be created if possible.
   */
   openDBFile(dbFilePath) {
      console.log ("SQLite3 > Opening database file: "+dbFilePath);
      dbFilePath = dbFilePath.split("\\").join("/"); //sqlite requires all paths to use forward slashes (even Windows)
      this._initData.dbFilePath = dbFilePath;
      var promise = new Promise((resolve, reject) => {
         this._sqlite3.stdin.write(".open "+this._initData.dbFilePath+"\n"); //issue ".open" command
         this.currentPromise = new Object();
         //use a non-standard structure for this call:
         this.currentPromise.resolve = this.onOpenDBFile;
         this.currentPromise.openResolve = resolve;
         this.currentPromise.reject = this.onOpenDBFileFail;
         this.currentPromise.openReject = reject;
      });
      return (promise);
   }

   /**
   * Function invoked when a database file is successfully opened via the {@link openDBFile}
   * function.
   */
   onOpenDBFile() {
      this._dbOpened = true;
      this.currentPromise.openResolve(true);
   }

   /**
   * Function invoked when a database cannot be opened or created via the {@link openDBFile}
   * function.
   */
   onOpenDBFileFail() {
      this._dbOpened = false;
      this.currentPromise.openReject(false);
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
   getFileSize(filePath, units="MB") {
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
   parseSchema(resultArray) {
      var schemaArray = new Array();
      for (var count=0; count < resultArray.length; count++) {
         var currentLine = resultArray[count];
         var columnData = new Object();
         columnData.index = parseInt(currentLine[0]);
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
   * @param {String} [rowDelimiter="\n"] The delimiter used to separate rows in the <code>resultData</code>.
   *
   * @return {Array} An indexed array of collated results. If the <code>schemaArray</code> is supplied then each
   * array element contains a name-value combination (where the name is the column name), otherwise only the value
   * is containing in each element.
   */
   collateResults(resultData, schemaArray=null, columnDelimiter="|", rowDelimiter="\n") {
      var resultLines = resultData.split(rowDelimiter);
      var resultArray = new Array();
      //final line is prompt so omit it
      for (var count=0; count < (resultLines.length-1); count++) {
         var currentLine = resultLines[count];
         currentLine = currentLine.split("\r").join("");
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
   *
   * @async
   */
   async getWalletStatus() {
      try {
         var jsonObj = this.buildJSONRPC();
         var resultObj = jsonObj.result;
         resultObj.bitcoin = new Object();
         resultObj.bitcoincash = new Object();
         resultObj.bitcoin.main = new Object();
         resultObj.bitcoin.test3 = new Object();
         resultObj.bitcoincash.main = new Object();
         resultObj.bitcoincash.test = new Object();
         resultObj.db = new Object();
         var querySQL = "PRAGMA table_info(`accounts`);"; //retrieve table schema
         var schemaData = await this.query(querySQL);
         var schema = this.parseSchema(schemaData);
         var querySQL = "SELECT * FROM `accounts` WHERE `type`=\"bitcoin\" AND `network`=\"main\" ORDER BY `addressIndex` DESC LIMIT 1;";
         var result = await this.query(querySQL, schema);
         if (result.length < 1) {
            //database empty
            resultObj.bitcoin.main.startChain = "0";
            resultObj.bitcoin.main.startIndex = "0";
         } else {
            resultObj.bitcoin.main.startChain = String(result[0].chain);
            resultObj.bitcoin.main.startIndex = String(result[0].addressIndex);
         }
         querySQL = "SELECT * FROM `accounts` WHERE `type`=\"bitcoin\" AND `network`=\"test3\" ORDER BY `addressIndex` DESC LIMIT 1;";
         result = await this.query(querySQL, schema);
         if (result.length < 1) {
            //database empty
            resultObj.bitcoin.test3.startChain = "0";
            resultObj.bitcoin.test3.startIndex = "0";
         } else {
            resultObj.bitcoin.test3.startChain = String(result[0].chain);
            resultObj.bitcoin.test3.startIndex = String(result[0].addressIndex);
         }
         querySQL = "SELECT * FROM `accounts` WHERE `type`=\"bitcoincash\" AND `network`=\"main\" ORDER BY `addressIndex` DESC LIMIT 1;";
         var result = await this.query(querySQL, schema);
         if (result.length < 1) {
            //database empty
            resultObj.bitcoincash.main.startChain = "0";
            resultObj.bitcoincash.main.startIndex = "0";
         } else {
            resultObj.bitcoincash.main.startChain = String(result[0].chain);
            resultObj.bitcoincash.main.startIndex = String(result[0].addressIndex);
         }
         querySQL = "SELECT * FROM `accounts` WHERE `type`=\"bitcoincash\" AND `network`=\"test\" ORDER BY `addressIndex` DESC LIMIT 1;";
         result = await this.query(querySQL, schema);
         if (result.length < 1) {
            //database empty
            resultObj.bitcoincash.test.startChain = "0";
            resultObj.bitcoincash.test.startIndex = "0";
         } else {
            resultObj.bitcoincash.test.startChain = String(result[0].chain);
            resultObj.bitcoincash.test.startIndex = String(result[0].addressIndex);
         }
         var sizeMB = this.getFileSize(this._initData.dbFilePath, "MB");;
         resultObj.db.sizeMB = sizeMB;
         resultObj.db.maxMB = this.dbMaxMB;
         querySQL = "SELECT * FROM `accounts` WHERE `updated`=(SELECT MAX(DATETIME(updated)) FROM `accounts`) LIMIT 1;"
         result = await this.query(querySQL, schema);
         try {
            if (result.length < 1) {
               //no entries
               var latestUpdate = new Date(0); //start of epoch
            } else {
               var latestUpdate = new Date(result[0].updated);
            }
         } catch (err) {
            console.error("SQLite3 > Unexpected database result in getWalletStatus:");
            console.dir(result);
         }
         var now = new Date();
         var elapsedUpdateSeconds = Math.floor((now.valueOf() - latestUpdate.valueOf()) / 1000);
         resultObj.db.elapsedUpdateSeconds = elapsedUpdateSeconds;
      } catch (err) {
         var jsonObj = this.buildJSONRPC("2.0", false);
         jsonObj.error.code = -32603;
         jsonObj.error.message = err.stack;
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
   *
   * @async
   */
   async getAccountRecord(requestObj) {
      try {
         var message = requestObj.params.message;
         var address = message.address;
         var accountType = message.type;
         var network = message.network;
         var jsonObj = this.buildJSONRPC();
         var querySQL = "PRAGMA table_info(`accounts`);"; //retrieve table schema
         var schemaData = await this.query(querySQL);
         var schema = this.parseSchema(schemaData);
         var querySQL = "SELECT * FROM `accounts` WHERE `address`=\""+address+"\" AND `type`=\""+accountType+"\" AND `network`=\""+network+"\" ORDER BY `primary_key` DESC LIMIT 2;";
         var result = await this.query(querySQL, schema);
         if (result.length > 0) {
            jsonObj.result = result;
         } else {
            jsonObj = this.buildJSONRPC("2.0", false);
            jsonObj.error.code = -32602;
            jsonObj.error.message = "No matching account.";
         }
      } catch (err) {
         var jsonObj = this.buildJSONRPC("2.0", false);
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
   async putAccountRecord(requestObj) {
      var sizeMB = this.getFileSize(this._initData.dbFilePath, "MB");
      if (sizeMB >= this.dbMaxMB) {
         var jsonObj = this.buildJSONRPC("2.0", false);
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
         var jsonObj = this.buildJSONRPC();
         var result = await this.query(querySQL);
         jsonObj.result = "OK";
      } catch (err) {
         jsonObj = this.buildJSONRPC("2.0", false);
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
   async updateAccountRecord(requestObj) {
      var sizeMB = this.getFileSize(this._initData.dbFilePath, "MB");
      if (sizeMB >= this.dbMaxMB) {
         var jsonObj = this.buildJSONRPC("2.0", false);
         jsonObj.error.code = -32603;
         jsonObj.error.message = "Database limit exceeded.";
         return (jsonObj);
      }
      try {
         var jsonObj = this.buildJSONRPC();
         var message = requestObj.params.message;
         var querySQL = "UPDATE `accounts` SET `updated`=\""+message.updated+"\" WHERE `primary_key`="+message.primary_key+";";
         var result = await this.query(querySQL);
         jsonObj.result = "OK";
      } catch (err) {
         jsonObj = this.buildJSONRPC("2.0", false);
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
   getElapsedUpdateSeconds(latestUpdate) {
      var now = new Date();
      var elapsedSeconds = (date.valueOf() - latestUpdate.valueOf()) / 1000;
      if (elapsedSeconds < 0) {
         elapsedSeconds = 0;
      }
      return (elapsedSeconds);
   }

   /**
   * Invokes an asynchronous request to the adapter, usually by a hosted application module
   * (e.g. server API function).
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
   invoke(requestObj) {
      var promiseObj = new Object();
      promiseObj.requestObj = requestObj;
      var promise = new Promise((resolve, reject) => {
         promiseObj.resolve = resolve;
         promiseObj.reject = reject;
      });
      this.processRequest(promiseObj);
      return (promise);
   }

   /**
   * Immediately processes a queued request made to the adapter.
   *
   * @param {Object} promiseObj An object containing the request and promise references.
   * @param {Object} promiseObj.requestObj Contains the details and parameters of the
   * request.
   * @param {Function} promiseObj.resolve The associated Promise's <code>resolve</code> function
   * to be invoked when the request has successfully been processed.
   * @param {Function} promiseObj.reject The associated Promise's <code>reject</code> function
   * to be invoked when the request has been rejected (an error thrown or an invalid result received).
   */
   processRequest(promiseObj) {
      var requestObj = promiseObj.requestObj;
      var resolve = promiseObj.resolve;
      var reject = promiseObj.reject;
      switch (requestObj.method) {
         case "walletstatus":
            this.getWalletStatus().then(resultObj => {
               resolve(resultObj);
            }).catch(errorObj => {
               reject(errorObj);
            });
            break;
         case "getrecord":
            this.getAccountRecord(requestObj).then(resultObj => {
               resolve(resultObj);
            }).catch(errorObj => {
               reject(errorObj);
            });
            break;
         case "putrecord":
            this.putAccountRecord(requestObj).then(resultObj => {
               resolve(resultObj);
            }).catch(errorObj => {
               reject(errorObj);
            });
            break;
         case "updaterecord":
            this.updateAccountRecord(requestObj).then(resultObj => {
               resolve(resultObj);
            }).catch(errorObj => {
               reject(errorObj);
            });
            break;
         default:
            var errorObj = this.buildJSONRPC("2.0", false);
            errorObj.error.code = -32601;
            errorObj.error.message = "Method "+requestObj.method+" not found.";
            reject (errorObj);
            break;
      }
   }

   /**
   * Executes an asynchronous query on the database and produces an unique output file for
   * the query results.
   *
   * @param {String} SQL The query to execute.
   * @param {Array} [schemaArray=null] A parsed table schema array to apply to to the query result.
   * If omitted, each result row's column is returned as an indexed element rather than
   * a named one.
   * @param {String} [baseFileName="queryResult%id%.txt"] The base or prototype file name to use
   * for the unique query result file. The metastring "%id%" must be included and will be replaced
   * with a unique identifier for the result.
   * @param {Boolean} [deleteOnResult=true] Defines whether or not the unique file generated for the
   * query result should be deleted once the result is fully processed. Set this value to false to
   * retain a history of query results.
   *
   * @return {Promise} The promise resolves with an array of results with each element containing
   * a result row. Each result row will either contain indexed (anonymous) column values if
   * <code>schema</code> is null or name-value pairs if a matching table <code>schema</code> is
   * supplied. A standard <code>Error</code> object is included with a rejection.
   */
   query(SQL, schemaArray=null, baseFileName="queryResult%id%.txt", deleteOnResult=true) {
      var promise = new Promise((resolve, reject) => {
         if (typeof(this._outputID) != "number") {
            this._outputID = 0;
         }
         var baseOutputFile = baseFileName.split("%id%").join(String(this._outputID));
         if (this.server.hostEnv.embedded == true) {
            //use writeable temp directory
            var outputFile = path.resolve(this.server.hostEnv.dir.temp, baseOutputFile);
         } else {
            outputFile = baseOutputFile;
         }
         var queryObject = new Object();
         queryObject.schema = schemaArray;
         queryObject.outputFile = outputFile;
         queryObject.deleteOnResult = deleteOnResult;
         queryObject.sql = SQL;
         queryObject.resolve = resolve;
         queryObject.reject = reject;
         filesystem.writeFileSync(outputFile, ">"); //create file before starting to watch it
         queryObject.watch = filesystem.watch(outputFile, {persistent:true}, this.onResultFileChange.bind(this, queryObject));
         this._sqlite3.stdin.write(".output "+baseOutputFile+"\n"); //send asynchronous result output to file
         this._sqlite3.stdin.write(SQL+";\nSELECT \""+this.EORDelimiter+"\";\n"); //append end result delimter so even empty results can be detected
         this._outputID++; //ensure file indexing / naming is unique for each request / result
      });
      return (promise);
   }

   /**
   * Event listener invoked when a query result file changes (is written to, renamed, or deleted).
   * When a full result is detected as being received, it's parsed, the associated promise is resolved,
   * the file watch is removed, and the file is deleted.
   *
   * @param {Object} queryObject An object containing details of the asynchronous query including
   * properties such as the original query <code>sql</code>, the associated table <code>schema</code>,
   * the <code>outputFile</code> into which the result is written, the <code>watch</code> object doing the
   * watching, a <code>deleteOnResult</code> specifying if the file should be deleted once successfully processed,
   * and the associated Promise <code>resolve</code> and <code>reject</code> functions.
   * @param {Event} event The event that triggered this file change.
   * @param {String} fileName The file name associated with the change (this may not necessarily match the
   * <code>queryObject.outputFile</code> property).
   */
   onResultFileChange(queryObject, event, fileName) {
      try {
         filesystem.openSync(queryObject.outputFile, "r+");
         var queryResult = filesystem.readFileSync(queryObject.outputFile, {encoding: "utf8"});
         if (queryResult.indexOf(this.EORDelimiter) > -1) {
            //remove end-of-result delimiter
            queryResult = queryResult.split(this.EORDelimiter)[0];
         } else {
            //end-of-result delimiter not found in data (yet)
            return;
         }
         var results = this.collateResults(queryResult, queryObject.schema);
         queryObject.resolve.call(this, results);
         queryObject.watch.close();
         if (queryObject.deleteOnResult == true) {
            filesystem.unlinkSync(queryObject.outputFile);
         }
      } catch (err) {
         //file still open / being written to
      }
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
   buildJSONRPC(version="2.0", isResult=true, includeUniqueID=false) {
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

   toString() {
      return("adapter:SQLite3");
   }
}
