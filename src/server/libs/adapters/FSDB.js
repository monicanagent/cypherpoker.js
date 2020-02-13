/**
* @file A custom File System DataBase adapter for JSON data storage and retrieval in CypherPoker.JS
*
* @version 0.5.1
* @author Patrick Bay
* @copyright MIT License
*/

const filesystem = require("fs");
const path = require("path");

/**
* @class Adapter for FSDB functionality.
*/
module.exports = class FSDB {

   /**
   * Creates a new instance of the FSDB adapter.
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
   * @property {Boolean} dbOpened=false True if a valid FSDB database file was opened
   * via the {@link openDBFile} function.
   * @readonly
   */
   get dbOpened() {
      if (this._dbOpened == undefined) {
         this._dbOpened = false;
      }
      return (this._dbOpened);
   }

   /**
   * @property {Number} dbMaxMB=500 The maximum allowable size of the FSDB database file.
   * @readonly
   */
   get dbMaxMB() {
      return (500);
   }

   /**
   * @property {Object} emptyDB An object containing the default empty database
   * structure and any optional data to include (typically used when the specified
   * database file doesn't exist).
   *
   * @readonly
   */
   get emptyDB() {
      var dbStruct = new Object();
      dbStruct.schema = new Object();
      dbStruct.schema.accounts = new Object();
      dbStruct.schema.accounts.columns = new Array();
      var primary_key = new Object();
      primary_key.name = "primary_key";
      primary_key.type = "Number";
      primary_key.unique = true;
      primary_key.auto_increment = true;
      primary_key.default = 0;
      primary_key.description = "Unique auto-incrementing primary key";
      var type = new Object();
      type.name = "type";
      type.type = "String";
      type.unique = false;
      type.auto_increment = false;
      type.default = null;
      type.description = "The cryptocurrency type";
      var network = new Object();
      network.name = "network";
      network.type = "String";
      network.unique = false;
      network.auto_increment = false;
      network.default = null;
      network.description = "Cryptocurrency subnetwork";
      var chain = new Object();
      chain.name = "chain";
      chain.type = "Number";
      chain.unique = false;
      chain.auto_increment = false;
      chain.default = null;
      chain.description = "HD derivation path first parameter";
      var addressIndex = new Object();
      addressIndex.name = "addressIndex";
      addressIndex.type = "Number";
      addressIndex.unique = false;
      addressIndex.auto_increment = false;
      addressIndex.default = null;
      addressIndex.description = "HD derivation path second parameter";
      var address = new Object();
      address.name = "address";
      address.type = "String";
      address.unique = false;
      address.auto_increment = false;
      address.default = null;
      address.description = "Account (cryptocurrency) address";
      var pwhash = new Object();
      pwhash.name = "pwhash";
      pwhash.type = "String";
      pwhash.unique = false;
      pwhash.auto_increment = false;
      pwhash.default = null;
      pwhash.description = "SHA256 hash of password";
      var balance = new Object();
      balance.name = "balance";
      balance.type = "String"; //actually numeric but Satoshi amounts may exceed native variable
      balance.unique = false;
      balance.auto_increment = false;
      balance.default = null;
      balance.description = "Account balance in smallest denomination";
      var updated = new Object();
      updated.name = "updated";
      updated.type = "String"; //MySQL date-time string
      updated.unique = false;
      updated.auto_increment = false;
      updated.default = null;
      updated.description = "Date/Time this row was created";
      dbStruct.schema.accounts.columns.push (primary_key);
      dbStruct.schema.accounts.columns.push (type);
      dbStruct.schema.accounts.columns.push (network);
      dbStruct.schema.accounts.columns.push (chain);
      dbStruct.schema.accounts.columns.push (addressIndex);
      dbStruct.schema.accounts.columns.push (address);
      dbStruct.schema.accounts.columns.push (pwhash);
      dbStruct.schema.accounts.columns.push (balance);
      dbStruct.schema.accounts.columns.push (updated);
      dbStruct.tables = new Object();
      dbStruct.tables.accounts = new Array();
      return (dbStruct);
   }

   /**
   * @property {Number} formatSpaces=0 The number of spaces to include when
   * formatting JSON output, as based on the <code>compact</code> setting
   * in the global configuation for the adapter. This value is either 3
   * (<code>compact = false</code>) or 0 (<code>compact = true</code>). This
   * setting only affects the formatting of the JSON data, not the contents.
   *
   * @readonly
   */
   get formatSpaces() {
     if (this.initData.compact == true) {
       return (0);
     } else {
       return (3);
     }
   }

   /**
   * Initializes the adapter. This function is usually invoked by the parent host.
   *
   * @param {Object} initObj The initialization data object for the adapter.
   */
   initialize(initObj) {
      console.log ("FSDB > Initializing FSDB adapter...");
      var promise = new Promise((resolve, reject) => {
         this._initData = initObj;
         this._initData.dbFilePath = null; //no file open yet (using in-memory db by default)
         this.currentPromise = new Object();
         console.log ("FSDB > Initialized.");
         resolve (true);
      });
      return (promise);
   }

   /**
   * Issues a file open command to the running FSDB binary. Note that the binary
   * automatically updates the opened file so no "save" function is provided.
   *
   * @param {String} dbFilePath The filesystem path to the default FSDB database file to
   * open. If the file doesn't exist it will be created if possible.
   */
   openDBFile(dbFilePath) {
      console.log ("FSDB > Opening database file: "+dbFilePath);
      this._initData.dbFilePath = dbFilePath;
      var promise = new Promise((resolve, reject) => {
        try {
          filesystem.open(dbFilePath, "r", (err, fd) => {
            if (err) {
              console.log ("FSDB > Database file doesn't exist. Creating...");
              filesystem.writeFile(dbFilePath, JSON.stringify(this.emptyDB, null, this.formatSpaces), (err) => {
                if (err) {
                  console.error ("FSDB > ... database can't be created!");
                  reject (false);
                  return (false);
                } else {
                  console.log ("FSDB > ... database file created.");
                }
              });
            } else {
              console.log ("FSDB > Database file exists.");
              filesystem.close(fd, (err) => {
                if (err) {
                  console.error ("FSDB > Couldn't close open database file: " + err.toString());
                  reject (false);
                  return (false);
                };
              });
            }
            this._dbOpened = true;
            resolve (true);
          });
        } catch (err) {
          console.error (err);
          reject (false);
        }
      });
      return (promise);
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
      units = String(units).toUpperCase();
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
         console.log ("FSDB > getWalletStatus ...");
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
         console.log (err);
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
   * @param {String} [baseFileName="sqlr%id%.dat"] The base or prototype file name to use
   * for the unique query result file. The metastring "%id%" must be included and will be replaced
   * with a unique identifier for the result.
   * @param {Boolean} [deleteOnResult=false] Defines whether or not the unique file generated for the
   * query result should be deleted once the result is fully processed. Set this value to false to
   * retain a history of query results.
   *
   * @return {Promise} The promise resolves with an array of results with each element containing
   * a result row. Each result row will either contain indexed (anonymous) column values if
   * <code>schema</code> is null or name-value pairs if a matching table <code>schema</code> is
   * supplied. A standard <code>Error</code> object is included with a rejection.
   *
   * @todo Investigate why some file handles are not properly released by SQLite client so that
   * we can enable <code>deleteOnResult</code>
   */
   query(SQL, schemaArray=null, baseFileName="sqlr%id%.dat", deleteOnResult=false) {
      var promise = new Promise((resolve, reject) => {
         if (typeof(this._outputID) != "number") {
            this._outputID = 0;
         }
         var idStr = String(Math.random()).split(".")[1] + "Q" + String(this._outputID);
         var baseOutputFile = baseFileName.split("%id%").join(idStr);
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
   * Timeout function invoked when a query file has not registered a change but does not yet contain a valid
   * result. The {@link SQLite3#onResultFileChange} function is automatically invoked again to re-check
   * the file contents.
   *
   * @param {Object} queryObject An object containing details of the asynchronous query including
   * properties such as the original query <code>sql</code>, the associated table <code>schema</code>,
   * the <code>outputFile</code> into which the result is written, the <code>watch</code> object doing the
   * watching, a <code>deleteOnResult</code> specifying if the file should be deleted once successfully processed,
   * and the associated Promise <code>resolve</code> and <code>reject</code> functions.
   * @param {String} fileName The file name associated with the change (this may not necessarily match the
   * <code>queryObject.outputFile</code> property).
   *
   * @private
   */
   onResultTimeout(queryObject, fileName) {
      this.onResultFileChange(queryObject, null, fileName);
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
   *
   * @private
   */
   onResultFileChange(queryObject, event, fileName) {
      try {
         filesystem.openSync(queryObject.outputFile, "r+");
         var queryResult = filesystem.readFileSync(queryObject.outputFile, {encoding: "utf8"});
         if (queryResult.indexOf(this.EORDelimiter) > -1) {
            //remove end-of-result delimiter
            queryResult = queryResult.split(this.EORDelimiter)[0];
            try {
               clearTimeout(queryObject.timeout);
            } catch (err) {
            }
         } else {
            //end-of-result delimiter not found in data (yet)
            queryObject.timeout = setTimeout(this.onResultTimeout.bind(this), 1000, queryObject, fileName);
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
      return("adapter:FSDB");
   }
}
