/**
* @file A custom File System DataBase adapter for data storage and retrieval in CypherPoker.JS
*
* @version 0.5.2
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
   * @property {Object} emptyDBObj An object containing the default empty database
   * structure and any optional data to include (typically used when the specified
   * database file doesn't exist)
   * @readonly
   */
   get emptyDBObj() {
      //all numeric / date / other types are stored as strings to maintain compatibility
      var dbStruct = new Object();
      dbStruct.schema = new Object();
      dbStruct.schema.accounts = new Array();
      var primary_key = new Object();
      primary_key.name = "primary_key";
      primary_key.primary_key = true;
      primary_key.default = "0";
      primary_key.description = "Unique auto-incrementing primary key";
      var type = new Object();
      type.name = "type";
      type.default = null;
      type.description = "The cryptocurrency type";
      var network = new Object();
      network.name = "network";
      network.default = null;
      network.description = "Cryptocurrency subnetwork";
      var chain = new Object();
      chain.name = "chain";
      chain.default = null;
      chain.description = "HD derivation path first parameter";
      var addressIndex = new Object();
      addressIndex.name = "addressIndex";
      addressIndex.default = null;
      addressIndex.description = "HD derivation path second parameter";
      var address = new Object();
      address.name = "address";
      address.default = null;
      address.description = "Account (cryptocurrency) address";
      var pwhash = new Object();
      pwhash.name = "pwhash";
      pwhash.default = null;
      pwhash.description = "SHA256 hash of password";
      var balance = new Object();
      balance.name = "balance";
      balance.default = null;
      balance.description = "Account balance in smallest denomination";
      var updated = new Object();
      updated.name = "updated";
      updated.default = null;
      updated.description = "Date/Time this row was created";
      dbStruct.schema.accounts.push (primary_key);
      dbStruct.schema.accounts.push (type);
      dbStruct.schema.accounts.push (network);
      dbStruct.schema.accounts.push (chain);
      dbStruct.schema.accounts.push (addressIndex);
      dbStruct.schema.accounts.push (address);
      dbStruct.schema.accounts.push (pwhash);
      dbStruct.schema.accounts.push (balance);
      dbStruct.schema.accounts.push (updated);
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
   * Verifies that the FSDB file exists or creates it if it doesn't.
   *
   * @param {String} dbFilePath The filesystem path to the default FSDB database file to
   * open / create.
   */
   openDBFile(dbFilePath) {
      this._initData.dbFilePath = dbFilePath;
      var promise = new Promise((resolve, reject) => {
        try {
          filesystem.open(dbFilePath, "r", (err, fd) => {
            if (err) {
              //create new database file
              filesystem.writeFile(dbFilePath, JSON.stringify(this.emptyDBObj, null, this.formatSpaces), (err) => {
                if (err) {
                  console.error ("FSDB > Database can't be created!");
                  reject (false);
                  return (false);
                } else {
                  //file successfully created
                }
              });
            } else {
              //file exists
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
   * Reads a FSDB file into memory.
   *
   * @param {String} [dbFilePath=null] The filesystem path to the FSDB database file to
   * read. If not specified the <code>dbFilePath</code> property of [initData]{@link initData} is
   * used.
   * @param {Boolean} [parseOnLoad=true] If true, the loaded JSON data will be parsed to a native
   * object before being returned. If false, the raw loaded data will be returned.
   *
   * @return {Promise} Resolves with the loaded file data or rejects with an error (for example,
   * the file doesn't exist or not valid JSON data). Note that the loaded data should not be assumed
   * to be valid FSDB data.
   */
   readDBFile(dbFilePath=null, parseOnLoad=true) {
      if (dbFilePath == null) {
        dbFilePath = this.initData.dbFilePath;
      }
      var promise = new Promise((resolve, reject) => {
        try {
          var options = new Object();
          options.encoding = "utf8";
          options.flag = "r";
          filesystem.readFile(dbFilePath, options, (err, data) => {
            if (err) {
              reject (error);
            } else {
              if (parseOnLoad == true) {
                var JSONData = JSON.parse(data);
                resolve(JSONData);
              } else {
                resolve(data);
              }
            }
          });
        } catch (error) {
          reject (error);
        }
      });
      return (promise);
    }

    /**
    * Writes FSDB data to a file.
    *
    * @param {*} data The FSDB data to write. If this is a string it will be written as-is.
    * If it's an object it will be stringified by the JSON parser first. Any other data types
    * will throw an exception.
    * @param {String} [dbFilePath=null] The filesystem path to the FSDB database file to write
    * to. If not specified the <code>dbFilePath</code> property of [initData]{@link initData} is
    * used.
    *
    * @return {Promise} Resolves with true when the FSDB file is successfully written and closed.
    * Rejects with any error.
    */
    saveDBFile(data, dbFilePath=null) {
       if (dbFilePath == null) {
         dbFilePath = this.initData.dbFilePath;
       }
       if (typeof(data) == "object") {
         var writeData = JSON.stringify(data, null, this.formatSpaces);
       } else if (typeof(data) == "string") {
         writeData = data;
       } else {
         throw (new Error("Unsupported FSDB data format: \""+typeof(data)+"\""));
       }
       var promise = new Promise((resolve, reject) => {
         try {
           var options = new Object();
           options.encoding = "utf8";
           options.flag = "w";
           filesystem.writeFile(dbFilePath, writeData, options, (err) => {
             if (err) {
               reject (error);
             } else {
               resolve(true);
             }
           });
         } catch (error) {
           reject (error);
         }
       });
       return (promise);
     }

    /**
    * Validates FSDB data by checking for the presence of <code>schema</code>
    * and <code>tables</code> properties.
    *
    * @param {Object} data The data to validate.
    *
    * @return {Boolean} True if the data appears to be a valid FSDB object, otherwise
    * false is returned.
    */
    validateDBData(data) {
      if (typeof(data) != "object") {
        return (false);
      }
      if ((typeof(data.schema) == "object") && (typeof(data.tables) == "object")) {
        return (true);
      }
      return (false);
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
   * Creates a new database row using a specified table's schema.
   *
   * @param {Object} dbData The FSDB database in which to create the new row.
   * @param {String} table The name of the table in which to create the new row. If this
   * table doesn't exist or isn't an array, a new one is created,
   * @param {Boolean} [checkPK=false] If true, the entire database is checked for the
   * last used primary key before assigning the next one to the new row (slower but safe).
   * If false, only the last row in the database is used to determine the next primary key
   * value (fast but may result in duplicate or out-of-order primary keys).
   *
   * @return {Object} The newly-created database row within the supplied FSDB
   * database object.
   */
   createRow(dbData, table, checkPK=false) {
     if ((dbData.schema[table] == undefined) || (dbData.schema[table] == null)) {
       throw (new Error("Schema for table \""+table+"\" doesn't exist."));
     }
     var newRow = new Object();
     //should the following steps be optional (another parameter)?
     if ((dbData.tables == undefined) || (dbData.tables == null)) {
       dbData.tables = new Object();
     }
     if ((dbData.tables[table] == undefined) || (dbData.tables[table] == null)) {
       dbData.tables[table] = new Array();
     }
     if (typeof(dbData.tables[table].length) != "number") {
       dbData.tables[table] = new Array();
     }
     var PKField = null;
     //get primary key field from schema
     for (var count=0; count < dbData.schema[table].length; count++) {
       var currentField = dbData.schema[table][count];
       if (currentField.primary_key == true) {
         PKField = currentField.name;
         break;
       }
     }
     var previousPK = 0;
     if (PKField != null) {
       var tableData = dbData.tables[table];
       if (checkPK == true) {
         //slow but safe
         for (count=0; count<tableData.length; count++) {
           var currentRow = tableData[count];
           var currentPK = Number(currentRow[PKField]);
           if (currentPK > previousPK) {
             previousPK = currentPK;
           }
         }
       } else {
         //quick but unsafe
         previousPK = tableData[tableData.length-1];
       }
       if (tableData.length > 0) {
         previousPK++;
       }
     }
     for (count=0; count < dbData.schema[table].length; count++) {
        currentField = dbData.schema[table][count];
        if (currentField.name == PKField) {
          newRow[currentField.name] = String(previousPK);
        } else {
          newRow[currentField.name] = currentField.default;
        }
     }
     dbData.tables[table].push(newRow);
     console.log ("Created new row: "+JSON.stringify(newRow));
     return (newRow);
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
         var dbData = await this.readDBFile(); //path should be set at this point
         if (this.validateDBData(dbData) == false) {
           console.error("FSDB > "+this.initData.dbFilePath+" is not a valid JSON-formatted file.");
           return (null);
         }
         if (typeof(dbData.tables.accounts) != "object") {
           console.error("FSDB > 'accounts' table missing or not an object.");
           return (null);
         }
         if (typeof(dbData.tables.accounts.length) != "number") {
           console.error("FSDB > 'accounts' table is not an array.");
           return (null);
         }
         var accountsData = dbData.tables.accounts;
         var jsonObj = this.buildJSONRPC();
         var resultObj = jsonObj.result;
         resultObj.bitcoin = new Object();
         resultObj.bitcoincash = new Object();
         resultObj.bitcoin.main = new Object();
         resultObj.bitcoin.test3 = new Object();
         resultObj.bitcoincash.main = new Object();
         resultObj.bitcoincash.test = new Object();
         //indexes must be strings in order to maintain compatibility
         resultObj.bitcoin.main.startChain = "0";
         resultObj.bitcoin.main.startIndex = "0";
         resultObj.bitcoin.test3.startChain = "0";
         resultObj.bitcoin.test3.startIndex = "0";
         resultObj.bitcoincash.main.startChain = "0";
         resultObj.bitcoincash.main.startIndex = "0";
         resultObj.bitcoincash.test.startChain = "0";
         resultObj.bitcoincash.test.startIndex = "0";
         resultObj.db = new Object();
         var latestUpdate = new Date(0); //start of epoch
         for (var count=0; count < accountsData.length; count++) {
           var currentRow = accountsData[count];
           if (Number(currentRow.chain) > Number(resultObj[currentRow.type][currentRow.network].startChain)) {
             resultObj[currentRow.type][currentRow.network].startChain = currentRow.chain;
           }
           if (Number(currentRow.addressIndex) > Number(resultObj[currentRow.type][currentRow.network].startIndex)) {
             resultObj[currentRow.type][currentRow.network].startIndex = currentRow.addressIndex;
           }
           var currentUpdate = new Date(currentRow.updated);
           if (currentUpdate > latestUpdate) {
             latestUpdate = currentUpdate;
           }
         }
         var sizeMB = this.getFileSize(this._initData.dbFilePath, "MB");;
         resultObj.db.sizeMB = sizeMB;
         resultObj.db.maxMB = this.dbMaxMB;
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
         var dbData = await this.readDBFile();
         if (this.validateDBData(dbData) == false) {
           console.error("FSDB > "+this.initData.dbFilePath+" is not a valid JSON-formatted file.");
           return (null);
         }
         if (typeof(dbData.tables.accounts) != "object") {
           console.error("FSDB > 'accounts' table missing or not an object.");
           return (null);
         }
         if (typeof(dbData.tables.accounts.length) != "number") {
           console.error("FSDB > 'accounts' table is not an array.");
           return (null);
         }
         var accountsData = dbData.tables.accounts;
         var resultsArr = new Array();
         //check from last (newest) to first (oldest):
         for (var count=(accountsData.length-1);count >=0; count--) {
           var currentRow = accountsData[count];
           if ((currentRow.address == address) && (currentRow.type == accountType) && (currentRow.network == network)) {
             resultsArr.push(currentRow);
             if (resultsArr.length == 2) {
               break;
             }
           }
         }
         //Note that in standard SQL queries the results are ordered in ascending order by the primary key.
         //This will almost always be the same order in which the records appear but if not then
         //an additional sort should be applied here.
         if (resultsArr.length > 0) {
           jsonObj.result = resultsArr;
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
   *
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
         var jsonObj = this.buildJSONRPC();
         var message = requestObj.params.message;
         var dbData = await this.readDBFile();
         if (this.validateDBData(dbData) == false) {
           console.error("FSDB > "+this.initData.dbFilePath+" is not a valid JSON-formatted file.");
           return (null);
         }
         if (typeof(dbData.tables.accounts) != "object") {
           console.error("FSDB > 'accounts' table missing or not an object.");
           return (null);
         }
         if (typeof(dbData.tables.accounts.length) != "number") {
           console.error("FSDB > 'accounts' table is not an array.");
           return (null);
         }
         var newRow = this.createRow(dbData, "accounts", true);
         newRow.type = message.type;
         newRow.network = message.network;
         newRow.chain = String(message.chain);
         newRow.addressIndex = String(message.addressIndex);
         newRow.address = message.address;
         newRow.pwhash = message.pwhash;
         newRow.balance = String(message.balance);
         newRow.updated = message.updated;
         await this.saveDBFile(dbData);
         jsonObj.result = "OK";
      } catch (err) {
        console.error(err);
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
   *
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
         var message = requestObj.params.message;
         var dbData = await this.readDBFile();
         if (this.validateDBData(dbData) == false) {
           console.error("FSDB > "+this.initData.dbFilePath+" is not a valid JSON-formatted file.");
           return (null);
         }
         if (typeof(dbData.tables.accounts) != "object") {
           console.error("FSDB > 'accounts' table missing or not an object.");
           return (null);
         }
         if (typeof(dbData.tables.accounts.length) != "number") {
           console.error("FSDB > 'accounts' table is not an array.");
           return (null);
         }
         var accountsData = dbData.tables.accounts;
         var rowFound = false;
         for (var count=0; count < accountsData.length; count++) {
           var currentRow = accountsData[count];
           if (String(currentRow.primary_key) == String(message.primary_key)) {
             currentRow.updated = message.updated;
             rowFound = true;
             break;
           }
         }
         if (rowFound == false) {
           jsonObj = this.buildJSONRPC("2.0", false);
           jsonObj.error.code = -32602;
           jsonObj.error.message = "No matching row.";
         } else {
           await this.saveDBFile(dbData);
           var jsonObj = this.buildJSONRPC();
           jsonObj.result = "OK";
         }
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
