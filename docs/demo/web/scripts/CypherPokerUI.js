/**
* @file Basic user interface management for CypherPoker.JS.
*
* @version 0.3.0
* @author Patrick Bay
* @copyright MIT License
*/

/**
* @class Basic user interface management for CypherPoker.JS
*/
class CypherPokerUI {

   /**
   * @property {Object} UISelectors Name/value pairs for general UI elements and their
   * associated CSS-style DOM selectors.
   * @property {String} UISelectors.dialog="#mainDialog" The main or primary dialog element.
   * @property {String} UISelectors.accounts="#accounts" The main accounts container element.
   * @property {String} UISelectors.accountLoginForm="#accounts>#loginForm" The main account login container element.
   * @property {String} UISelectors.accountManageForm="#accounts>#manageForm" The main account management container element.
   * @property {String} UISelectors.accountCreateForm="#accounts>#createAccountForm" The main account creation container element.
   * @property {String} UISelectors.clipboardData="#clipboardData" Proxy data container for global clipboard copy commands.
   * @property {String} UISelectors.lobby="#lobby" The main lobby container element.
   */
   get UISelectors() {
      return({
         "dialog":"#mainDialog",
         "dialogMessage":"#mainDialog > #message",
         "accounts":"#accounts",
         "accountLoginForm": "#accounts > #loginForm",
         "accountManageForm": "#accounts > #manageForm",
         "accountCreateForm": "#accounts > #createAccountForm",
         "clipboardData":"#clipboardData",
         "lobby":"#lobby"
      });
   }

   /**
   * @property {Object} gameUISelectors Name/value pairs for game UI elements and their
   * associated CSS-style DOM selectors. Note that these selectors are relative to/children of
   * each game element cloned from the {@link CypherPokerUI#protoGameElement}.
   * @property {String} gameUISelectors.betButton="#betButton" The game's bet button.
   * @property {String} gameUISelectors.foldButton="#foldButton" The game's fold button.
   * @property {String} gameUISelectors.newHandButton="#newHandButton" The game's new hand button.
   * @property {String} gameUISelectors.totalBet="#totalBet" The game's total bet amount display element.
   * @property {String} gameUISelectors.balance="#balance" The remaining game balance amount display element.
   * @property {String} gameUISelectors.potAmount="#potAmount" The game's pot amount input element.
   * @property {String} gameUISelectors.betAmount="#betAmount" The game's bet amount input element.
   * @property {String} gameUISelectors.publicCards="#publicCards" The game's public cards container element.
   * @property {String} gameUISelectors.privateCards="#privateCards" The game's private cards container element.
   * @property {String} gameUISelectors.timeoutAmount="#timeoutAmount" The game's timeout counter container element.
   */
   get gameUISelectors() {
      return({
         "betButton":"#betButton",
         "foldButton":"#foldButton",
         "newHandButton":"#newHandButton",
         "totalBet":"#totalBet",
         "balance":"#balance",
         "potAmount":"#potAmount",
         "betAmount":"#betAmount",
         "timeoutAmount":"#timeoutAmount",
         "publicCards":"#publicCards",
         "privateCards":"#privateCards",
         "handHistory":"#handHistory"
      });
   }

   /**
   * Creates a new instance.
   *
   * @param {HTMLElement} protoElement A reference to the prototype element that will
   * be cloned for use with each new game instance. The original element will
   * remain unchanged (it should be hidden by default).
   */
   constructor(protoElement) {
      this._protoGameElement = protoElement;
      this.loadTemplates().then(complete => {
      //   this.addLobbyUIHandlers(document.querySelector(this.UISelectors.lobby));
      //   this.addAccountsUIHandlers(document.querySelector(this.UISelectors.accounts));
         this._ready = true;
      })
   }

   /**
   * @property {Boolean} ready=false Becomes true when the UI has completed loading and initializing
   * all data such as templates, configurations, etc.
   */
   get ready() {
      if (this._ready == undefined) {
         this._ready = false;
      }
      return (this._ready);
   }

   /**
   * @property {Boolean} autoDeal=true If true, cards are automatically dealt when
   * betting is done and it's our turn to deal. If <code>false</code>, the
   * {@link CypherPokerGame#dealCards} function of the {@link CypherPokerUI#game}
   * reference will need to be invoked manually.
   */
   get autoDeal() {
      if (this._autoDeal == undefined) {
         this._autoDeal = true;
      }
      return (this._autoDeal);
   }

   set autoDeal(adSet) {
      this._autoDeal = adSet;
   }

   /**
   * @property {CypherPokerAccount} selectedAccount=null The currently selected
   * {@link CypherPokerAccount} instance to use when creating or joining games.
   * Note that once created, a {@link CypherPokerGame#account} reference may be different
   * than this one.
   */
   get selectedAccount() {
      if (this._selectedAccount == undefined) {
         this._selectedAccount = null;
      }
      return (this._selectedAccount);
   }

   set selectedAccount(accountSet) {
      this._selectedAccount = accountSet;
   }

   /**
   * @property {Array} gameElements An indexed array of all game container elements
   * cloned from the {@link CypherPokerUI#protoGameElement} object.
   */
   get gameElements() {
      if (this._gameElements == undefined) {
         this._gameElements = new Array();
      }
      return (this._gameElements);
   }
   /**
   * @property {HTMLElement} protoGameElement A reference to the prototype element in which
   * the game user interface is contained, as set at instantiation time. This element will be
   * cloned for each new game instance.
   * @readonly
   */
   get protoGameElement() {
      return (this._protoGameElement);
   }

   /**
   * @property {CypherPoker} cypherpoker A reference to the main {@link CypherPoker} instance.
   * This property may only be set once. When set, a number of event listeners are
   * added to the instance so that the user interface can respond to them.
   */
   set cypherpoker(cpSet) {
      if ((this._cypherpoker == undefined) || (this._cypherpoker == null)) {
         this._cypherpoker = cpSet;
         this.addCypherPokerHandlers();
         if (this._cypherpoker.connected) {
            this.showDialog("Connected to peer-to-peer network.");
            this.hideDialog(3000);
            this.updateAccountsUI();
         } else {
            this._cypherpoker.addEventListener("start", event => {
               this.showDialog("Connected to peer-to-peer network.");
               this.hideDialog(3000);
               this.updateAccountsUI();
            }, this);
         }
      } else {
         throw (new Error("The \"cypherpoker\" reference can only be set once."));
      }
   }

   get cypherpoker() {
      if (this._cypherpoker == undefined) {
         return (null);
      }
      return (this._cypherpoker);
   }

   /**
   * @property {Array} templates The indexed list of sucecssfully loaded, parsed,
   * and appended HTML templates as specified in the templates index JSON data.
   * In addition to containing a copy of that data, each element in the array also
   * contains a <code>document</code> property containing the original <code>HTMLDocument</code>
   * object of the template and a <code>elements</code> array which contains references
   * appended element(s), copied from the <code>document</code> within the main index HTML.
   */
   get templates() {
      if (this._templates == undefined) {
         this._templates = new Array();
      }
      return (this._templates);
   }

   /**
   * Returns a successfully loaded HTML template by its name from the {@link CypherPokerUI@templates}
   * array.
   *
   * @param {String} name The HTML template name to reterieve, as specified in the associated
   * templates JSON data.
   *
   * @return {Object} The object containing data and references matching the specified template,
   * or <code>null</code> if no matching template can be found.
   */
   getTemplateByName(name) {
      for (var count=0; count < this.templates.length; count++) {
         if (this.templates[count].name == name) {
            return (this.templates[count]);
         }
      }
      return (null);
   }

   /**
   * Loads and parses HTML templates for the application, then adds them to their
   * specified targets within the main page HTML. Every successfully loaded template
   * can be accessed via the {@link CypherPokerUI#templates} array or the
   * {@link CypherPokerUI#getTemplate} function.
   *
   * Note that templates are appended to their specified targets in the order listed.
   *
   * @param {String} [indexURL="./templates/index.json"] The URL of the JSON file containing
   * the list of templates to load.
   *
   * @private
   * @async
   */
   async loadTemplates(indexURL="./templates/index.json") {
      this.debug("CypherPokerUI: Loading HTML templates...");
      var promise = await loadJSON(indexURL).onEventPromise("load");
      var templatesData = promise.target.response;
      for (var count=0; count < templatesData.length; count++) {
         var templateInfo = templatesData[count];
         templateInfo.document = await this.loadHTMLTemplate(templateInfo.url);
         templateInfo.sourceHTML = templateInfo.document.body.innerHTML
         this.templates.push(templateInfo);
         if (templateInfo.append == true) {
            var target = document.querySelector(templateInfo.target);
            this.buildHTMLTemplate(templateInfo, target, templateInfo.hidden);
         }
      }
      return (true);
   }

   /**
   * Builds a template by generating the elements specified and processing any included parameters.
   * The built template is then attached to the target DOM element.
   *
   * @param {Object} templateInfo An object containing information about the template to generate.
   * @param {HTMLElement} target The target element to append the generated template to as a child.
   * @param {Boolean} hidden=false If true, the generated element is initially hidden.
   * @param {Object} metaData Name-value pairs containing the data to replace in the
   * document body. Each name is automatically surrounded by "%"; for example,
   * <code>metaData["version"]="0.3.0"</code> replaces any <code>%version%</code> metatag
   * in the document with <code>0.3.0</code>.
   *
   * @reutrn {HTMLElement} The newly built and appended element.
   *
   * @private
   */
   buildHTMLTemplate(templateInfo, target, hidden=false, metaData=null) {
      //assume document only has <head> (firstChild) and <body> (lastChild) tags within a <html> (documentElement) tag
      var bodyNode = templateInfo.document.documentElement.lastChild;
      if (templateInfo.elements == undefined) {
         templateInfo.elements = new Array();
      }
      var nodeCopy = document.importNode(bodyNode.firstChild, true);
      if (metaData != null) {
         this.parseHTMLTemplateTags(nodeCopy, metaData);
      }
      var newChild = target.appendChild(nodeCopy);
      templateInfo.elements.push(newChild);
      if (hidden == true) {
         this.hide(templateInfo.elements[templateInfo.elements.length-1]);
      }
      return (templateInfo.elements[templateInfo.elements.length-1]);
   }

   /**
   * Loads and parses an external HTML template file using XMLHTTPRequest.
   *
   * @param {String} htmlURL The URL of the HTML template file to load.
   * @return {HTMLDocument} A HTMLDocument object containing the loaded HTML
   * document. Any meta tags found in the main body are automatically parsed
   * using the {@link CypherPokerUI#parseTemplateTags} function.
   *
   * @private
   * @async
   */
   async loadHTMLTemplate(htmlURL) {
      var xhr = new XMLHttpRequest();
      if (_useCache == false) {
         //force new data load
         htmlURL = htmlURL + "?" + String(Math.random()).split("0.")[1];
      }
      xhr.open("GET", htmlURL);
      xhr.responseType = "document";
      xhr.send();
      var promise = await xhr.onEventPromise("load");
      if (promise.target.response != null) {
         return (promise.target.response);
      } else {
         throw (new Error(`Couldn't load HTML template: (${htmlURL})`));
      }
   }

   /**
   * Parses/replaces any meta tags found in a HTML element.
   *
   * @param {HTMLElement} The element in which to search/replace metatags.
   * @param {Object} metaData Name-value pairs containing the data to replace in the
   * document body. Each name is automatically surrounded by "%"; for example,
   * <code>metaData["version"]="0.3.0"</code> replaces any <code>%version%</code> metatag
   * in the document with <code>0.3.0</code>.
   *
   * @private
   */
   parseHTMLTemplateTags(element, metaData) {
      var html = element.innerHTML;
      for (var tag in metaData) {
         html = html.split("%"+tag+"%").join(metaData[tag]);
      }
      element.innerHTML = html; //copy back to document body
   }

   /**
   * Adds game event listeners and callbacks to user interface elements defined in
   * {@link CypherPokerUI#gameUISelectors} and contained in a clone of the {@link CypherPokerUI#protoGameElement}
   * element.
   *
   * @param {HTMLElement} gameElement The cloned game element to which to add handlers to.
   * @param {CypherPokerGame} gameRef A reference to the game instance associated with the
   * game element.
   */
   addGameUIHandlers(gameElement, gameRef) {
      //add references to game and this instance to all game elements
      for (var item in this.gameUISelectors) {
         try {
            let element = gameElement.querySelector(this.gameUISelectors[item]);
            element.game = gameRef;
            element.ui = this;
         } catch (err) {
         }
      }
      //each of the following has a "game" and "ui" reference added to it
      var betButton = gameElement.querySelector(this.gameUISelectors.betButton);
      var foldButton = gameElement.querySelector(this.gameUISelectors.foldButton);
      var newHandButton = gameElement.querySelector(this.gameUISelectors.newHandButton);
      //element-scoped event listeners
      betButton.addEventListener("click", this.onBetButtonClick);
      foldButton.addEventListener("click", this.onFoldButtonClick);
      newHandButton.addEventListener("click", this.onNewHandButtonClick);
      //this-scoped event listeners
      gameRef.addEventListener("gamedeal", this.onCardDeal, this);
      gameRef.addEventListener("gamebet", this.onBetPlaced, this);
      gameRef.addEventListener("gameend", this.onGameEnd, this);
      gameRef.addEventListener("gamescored", this.onGameScored, this);
      this.disable(betButton);
   }

   /**
   * Starts the timeout timer for a specific game instance.
   *
   * @param {HTMLElement} timeoutElement The element containing the timeout
   * time display.
   * @param {Number} timeoutAmount The timeout amount, in seconds, to track.
   * @param {CypherPokerGame} game The game instance for which to track
   * the timeout (in the UI).
   *
   * @private
   */
   startTimeoutTimer(timeoutElement, timeoutAmount, game) {
      this.stopTimeoutTimer(timeoutElement);
      var now = new Date();
      //or Date.now()...
      timeoutElement._startTime = now.valueOf();
      timeoutElement._timeoutID = setTimeout(this.onTimeoutTimerTick, 1000, timeoutElement, timeoutAmount, game, this);
   }

   /**
   * Stops the timeout timer started by {@link CypherPokerUI@startTimeoutTimer}.
   *
   * @param {HTMLElement} timeoutElement The element containing the timer
   * time display.
   *
   * @private
   */
   stopTimeoutTimer(timeoutElement) {
      try {
         //stop any existing timers
         clearTimeout(timeoutElement._timeoutID);
      } catch (err){}
   }


   /**
   * Timer function invoked on every tick of the timeout timer for a specific game.
   *
   * @param {HTMLElement} timeoutElement The element containing the timer time
   * display.
   * @param {Number} timeoutAmount The timeout amount, in seconds, being tracked.
   * @param {CypherPokerGame} game The game instance for which the timer is active.
   * @param {CypherPokerUI} ui The UI handler to be used to update the <code>timeoutElement</code>.
   *
   * @private
   */
   onTimeoutTimerTick(timeoutElement, timeoutAmount, game, ui) {
      var now = new Date();
      //use system timestamp to determine number of elapsed seconds rather than imprecise timer
      var secondsElapsed = Math.floor((now.valueOf() - timeoutElement._startTime) / 1000);
      var secondsRemaining = timeoutAmount - secondsElapsed;
      if (secondsRemaining < 0) {
         secondsRemaining = 0;
      }
      if (secondsRemaining > 0) {
         var timeoutHours = Math.floor(secondsRemaining / 3600);
         var timeoutMinutes = Math.floor(secondsRemaining / 60) % 60;
         var timeoutSeconds = secondsRemaining % 60;
         var timeStr = String(timeoutHours) + ":";
         if (timeoutMinutes < 10) {
            timeStr += "0";
         }
         timeStr += String(timeoutMinutes) + ":";
         if (timeoutSeconds < 10) {
            timeStr += "0";
         }
         timeStr += String(timeoutSeconds);
         if (secondsRemaining <= 5) {
            timeoutElement.innerHTML = "<span id=\"timeoutCritical\">" + timeStr + "</span>";
         } else {
            timeoutElement.innerHTML = "<span id=\"timeout\">" + timeStr + "</span>";
         }
         timeoutElement._timeoutID = setTimeout(ui.onTimeoutTimerTick, 1000, timeoutElement, timeoutAmount, game, ui);
      } else {
         //contract has timed out
         timeStr = "0:00:00";
         timeoutElement.innerHTML = "<span id=\"timeoutCritical\">" + timeStr + "</span>";
         ui.disableGameUI.call(ui, game);
         ui.showDialog("A player has timed out. Awaiting confirmation from contract...");
      }
   }

   /**
   * Adds event listeners and callbacks to the {@link CypherPoker} instance assigned to
   * the {@link CypherPokerUI#cypherpoker} property.
   */
   addCypherPokerHandlers() {
      this.cypherpoker.addEventListener("newgame", this.onNewGame, this);
      this.cypherpoker.addEventListener("tablenew", this.onNewTableAnnouncement, this);
      this.cypherpoker.captureNewTables = true;
   }

   /**
   * Event listener invoked when an account-related button is clicked. The event
   * is raised by the DOM via something like a <code>onclick</code> attribute.
   *
   * @param {String} buttonType The type of button being clicked.
   * @param {String} [subType=subType] Additional information provided with the button click.
   *
   * @async
   * @private
   */
   async onAccountButtonClick(buttonType, subType=null) {
      switch (buttonType) {
         case "first_run_yes":
            this.hide(this.getTemplateByName("firstRun").elements[0]);
            this.hideDialog();
            this.show(this.getTemplateByName("accountCreate").elements[0]);
            break;
         case "first_run_no":
            this.hide(this.getTemplateByName("firstRun").elements[0]);
            this.showDialog("You need to create an account in order to play.");
            this.hideDialog(5000);
            break;
         case "create_account":
            if (subType == "login") {
               var element = this.getTemplateByName("accountCreate").elements[0];
               this.show(element);
               element = this.getTemplateByName("accountLogin").elements[0];
               this.hide(this.getTemplateByName("accountManage").elements[0]);
               this.hide(element);
               return (true);
            }
            this.hide(this.getTemplateByName("firstRun").elements[0]);
            element = this.getTemplateByName("accountCreate").elements[0];
            var accountTypeSelect = element.querySelector("#newAccountType");
            var accountType = accountTypeSelect.options[accountTypeSelect.selectedIndex].value;
            var password = element.querySelector("#newAccountPassword").value;
            if (password.split(" ").join("") == "") {
               //insert additional password valifity checks here
               this.showDialog("Password can't be empty.");
               this.hideDialog(4000);
               return (false);
            }
            var typeSplit = accountType.split("/");
            this.cypherpoker.createAccount(typeSplit[0], password, typeSplit[1]).then(newAccount => {
               this.hide(element);
               element = this.getTemplateByName("help").elements[0];
               if (typeSplit[1] == "test3") {
                  var helpElement = element.querySelector("#new_account_btc_test3");
               } else {
                  helpElement = element.querySelector("#new_account_btc");
               }
               helpElement.innerHTML = helpElement.innerHTML.split("%address%").join(newAccount.address);
               this.show(helpElement);
               this.showDialog();
               var newOptionElement = document.createElement("option");
               var optionValue = newAccount.address + ":" + newAccount.type + "/" + newAccount.network;
               newOptionElement.setAttribute("value", optionValue);
               newOptionElement.innerHTML = newAccount.address + " ("+newAccount.type+" / "+newAccount.network+")";
               newOptionElement.account = newAccount;
               element = this.getTemplateByName("accountLogin").elements[0];
               var manageElement = this.getTemplateByName("accountManage").elements[0];
               var currentAccounts = element.querySelector("#currentAccounts");
               currentAccounts.appendChild(newOptionElement);
               currentAccounts.value = optionValue; //set new item as current selection
               element.querySelector("#accountPassword").value = newAccount.password; //set password for account
            //   this.showDialog("Account created: "+newAccount.address);
            //   this.hideDialog(4000);
            //   this.show(element);
            //   this.show(manageElement);
            }).catch(error => {
               this.showDialog(error);
            });
            break;
         case "use_account":
            this.hide(this.getTemplateByName("accountManage").elements[0]);
            var element = this.getTemplateByName("accountLogin").elements[0];
            var password = element.querySelector("#accountPassword").value;
            var accountsList = element.querySelector("#currentAccounts");
            if (accountsList.length == 0) {
               this.showDialog("No accounts available.");
               this.hideDialog(3000);
               return;
            }
            if (password == "") {
               this.showDialog("Password can't be empty.");
               this.hideDialog(3000);
               return;
            }
            var selectedOption = accountsList.options[accountsList.selectedIndex];
            var useAccount = selectedOption.account;
            if (useAccount.balance.equals(0)) {
               this.showDialog("Account has 0 balance.");
               this.hideDialog(3000);
               return;
            }
            this.selectedAccount = useAccount;
            this.hide(element);
            element = this.getTemplateByName("lobby").elements[0];
            this.show(element);
            break;
         case "select_account":
            var element = this.getTemplateByName("accountLogin").elements[0];
            var selectElement = element.querySelector("#currentAccounts");
            var selectedOption = selectElement.options[selectElement.selectedIndex];
            var selectedAccount = selectedOption.account;
            element.querySelector("#accountPassword").value = selectedAccount.password;
            selectedAccount.update().then(done => {
               var satoshiAmount = selectedAccount.balance.toString(10);
               var btcAmount = this.convertDenom(satoshiAmount, "satoshi", "bitcoin");
               element.querySelector("#accountBalance").innerHTML =  satoshiAmount+ " satoshis";
            }).catch(error => {
               element.querySelector("#accountBalance").innerHTML =  "unavailable";
               console.error(error);
            });
            break;
         case "copy_account_to_clipboard":
            var element = this.getTemplateByName("accountLogin").elements[0];
            var accountsList = element.querySelector("#currentAccounts");
            if (accountsList.length == 0) {
               this.showDialog("No account.");
               this.hideDialog(3000);
               return;
            }
            var selectedOption = accountsList.options[accountsList.selectedIndex];
            var useAccount = selectedOption.account;
            this.copyToClipboard(useAccount.address, this);
            this.showDialog("Copied to clipboard.");
            this.hideDialog(3000);
            break
         case "cashout_account":
            var manageElement = this.getTemplateByName("accountManage").elements[0];
            element = this.getTemplateByName("accountLogin").elements[0];
            var cashoutAddress = manageElement.querySelector("#cashoutAddress").value;
            var cashoutAmount = manageElement.querySelector("#cashoutAmount").value;
            var selectElement = element.querySelector("#currentAccounts");
            var selectedOption = selectElement.options[selectElement.selectedIndex];
            var selectedAccount = selectedOption.account;
            if (cashoutAmount.split(" ").join("") == "") {
               this.showDialog("Enter an amount to cash out.");
               this.hideDialog(3000);
               return (false);
            } else {
               try {
                  cashoutAmount = bigInt(cashoutAmount);
               } catch (err) {
                  this.showDialog("Invalid cashout amount. Must be in satoshis.");
                  this.hideDialog(3000);
                  return (false);
               }
            }
            if (cashoutAmount.equals(0)) {
               this.showDialog("Cashout amount must be greater than 0.");
               this.hideDialog(3000);
               return (false);
            }
            if (cashoutAddress.length == 0) {
               this.showDialog("Enter a valid address.");
               this.hideDialog(3000);
               return (false);
            }
            var minerFees = null; //use default for now
            selectedAccount.cashout(cashoutAmount, cashoutAddress, minerFees).then(done => {
               var satoshiAmount = selectedAccount.balance.toString(10);
               var btcAmount = this.convertDenom(satoshiAmount, "satoshi", "bitcoin");
               element.querySelector("#accountBalance").innerHTML =  satoshiAmount+ " satoshis";
            }).catch(error => {
               this.showDialog(error);
               this.hideDialog(3000);
               console.error(error);
            });
            break;
         case "transfer_account":
            var manageElement = this.getTemplateByName("accountManage").elements[0];
            element = this.getTemplateByName("accountLogin").elements[0];
            var transferAccount = manageElement.querySelector("#transferAccount").value;
            var transferAmount = manageElement.querySelector("#transferAmount").value;
            var selectElement = element.querySelector("#currentAccounts");
            var selectedOption = selectElement.options[selectElement.selectedIndex];
            var selectedAccount = selectedOption.account;
            if (transferAmount.split(" ").join("") == "") {
               ui.showDialog("Enter an amount to transfer.");
               ui.hideDialog(3000);
               return;
            } else {
               try {
                  transferAmount = bigInt(transferAmount);
               } catch (err) {
                  this.showDialog("Invalid transfer amount. Must be in satoshis.");
                  this.hideDialog(3000);
                  return;
               }
            }
            if (transferAmount.equals(0)) {
               this.showDialog("Transfer amount must be greater than 0.");
               this.hideDialog(3000);
               return;
            }
            if (transferAccount.length == 0) {
               this.showDialog("Enter a valid address.");
               this.hideDialog(3000);
               return;
            }
            selectedAccount.transfer(transferAmount, transferAccount).then(done => {
               var satoshiAmount = selectedAccount.balance.toString(10);
               var btcAmount = this.convertDenom(satoshiAmount, "satoshi", "bitcoin");
               element.querySelector("#accountBalance").innerHTML =  satoshiAmount+ " satoshis";
            }).catch(error => {
               console.error(error);
               this.showDialog(error);
               this.hideDialog(3000);
            });
            break;
         default:
            return (false);
            break;
      }
      return (true);
   }

   /**
   * Event listener invoked when an lobby-related button is clicked. The event
   * is raised by the DOM via something like a <code>onclick</code> attribute.
   *
   * @param {String} buttonType The type of button being clicked.
   * @param {String} [subType=subType] Additional information provided with the button click.
   *
   * @async
   * @private
   */
   async onLobbyButtonClick(buttonType, subType=null) {
      switch (buttonType) {
         case "create_game":
            var element = this.getTemplateByName("lobby").elements[0];
            var createGameElement = element.querySelector("#createGame");
            var joinGameElement = element.querySelector("#joinGame");
            var ownGamesElement = element.querySelector("#ownGames");
            this.hide(createGameElement);
            this.hide(joinGameElement);
            this.show(ownGamesElement);
            var tableInfo = new Object();
            var lobbyElement = document.querySelector(ui.UISelectors.lobby);
            var alias = createGameElement.querySelector("#playerAlias").value;
            var tableName = createGameElement.querySelector("#tableName").value;
            var numPlayers = Number(createGameElement.querySelector("#numPlayers").value);
            numPlayers--; //exclude self
            var buyInAmount = createGameElement.querySelector("#buyInAmount").value;
            var bigBlindAmount = createGameElement.querySelector("#bigBlindAmount").value;
            var smallBlindAmount = createGameElement.querySelector("#smallBlindAmount").value;
            tableInfo.buyIn = buyInAmount;
            tableInfo.bigBlind = bigBlindAmount;
            tableInfo.smallBlind = smallBlindAmount;
            ownGamesElement.innerHTML = "Game \""+alias+"\" created. Awaiting other player(s)...";
            this.cypherpoker.createTable(tableName, numPlayers, tableInfo);
            this.cypherpoker.onEventPromise("tableready").then(event =>{
               var playerInfo = new Object();
               playerInfo.alias = alias;
               var game = this.cypherpoker.createGame(event.table, this.selectedAccount, playerInfo).start();
               try {
                  game.addEventListener("gamerestart", this.onRestartGame, this);
                  game.contract.addEventListener("timeoutstart", this.onStartContractTimeout, this);
                  game.contract.addEventListener("timeout", this.onContractTimeout, this);
                  game.contract.addEventListener("timeoutinvalid", this.onContractTimeoutInvalid, this);
               } catch (err) {
                  this.showDialog(err);
               }
            })
            break;
         default:
            break;
      }
      return (false);
   }

   /**
   * Event listener invoked when a help button is clicked. The event
   * is raised by the DOM via something like a <code>onclick</code> attribute.
   *
   * @param {String} buttonType The type of button being clicked.
   *
   * @async
   * @private
   */
   async onHelpButtonClick(buttonType) {
      var element = this.getTemplateByName("help").elements[0];
      //hide all children first
      for (var count=0; count < element.children.length; count++) {
         this.hide(element.children[count]);
      }
      switch (buttonType) {
         case "create_account_password":
            var helpElement = element.querySelector("#create_account_password");
            this.show(helpElement);
            this.showDialog();
            break;
         case "create_account_type":
            var helpElement = element.querySelector("#create_account_type");
            this.show(helpElement);
            this.showDialog();
            break;
         case "select_copy_account":
            var helpElement = element.querySelector("#select_copy_account");
            this.show(helpElement);
            this.showDialog();
            break;
         case "account_balance":
            var helpElement = element.querySelector("#account_balance");
            this.show(helpElement);
            this.showDialog();
            break;
         case "account_password":
            var helpElement = element.querySelector("#account_password");
            this.show(helpElement);
            this.showDialog();
            break;
         case "use_create_account":
            var helpElement = element.querySelector("#use_create_account");
            this.show(helpElement);
            this.showDialog();
            break;
         case "cashout_account":
            var helpElement = element.querySelector("#cashout_account");
            this.show(helpElement);
            this.showDialog();
            break;
         case "transfer_account":
            var helpElement = element.querySelector("#transfer_account");
            this.show(helpElement);
            this.showDialog();
            break;
         case "create_table_form":
            var helpElement = element.querySelector("#create_table_form");
            this.show(helpElement);
            this.showDialog();
            break;
         case "create_table_player_alias":
            var helpElement = element.querySelector("#create_table_player_alias");
            this.show(helpElement);
            this.showDialog();
            break;
         case "create_table_name":
            var helpElement = element.querySelector("#create_table_name");
            this.show(helpElement);
            this.showDialog();
            break;
         case "create_table_num_players":
            var helpElement = element.querySelector("#create_table_num_players");
            this.show(helpElement);
            this.showDialog();
            break;
         case "create_table_buyin":
            var helpElement = element.querySelector("#create_table_buyin");
            this.show(helpElement);
            this.showDialog();
            break;
         case "create_table_bigblind":
            var helpElement = element.querySelector("#create_table_bigblind");
            this.show(helpElement);
            this.showDialog();
            break;
         case "create_table_smallblind":
            var helpElement = element.querySelector("#create_table_smallblind");
            this.show(helpElement);
            this.showDialog();
            break;
         case "create_table_button":
            var helpElement = element.querySelector("#create_table_button");
            this.show(helpElement);
            this.showDialog();
            break;
         case "join_table_list":
            var helpElement = element.querySelector("#join_table_list");
            this.show(helpElement);
            this.showDialog();
            break;
         case "game_buttons":
            var helpElement = element.querySelector("#game_buttons");
            this.show(helpElement);
            this.showDialog();
            break;
         case "game_hand_history":
            var helpElement = element.querySelector("#game_hand_history");
            this.show(helpElement);
            this.showDialog();
            break;
         case "close":
            this.hideDialog();
            break;
         default:
            break;
      }
      return (true);
   }

   /**
   * Copies data to the system clipboard via a proxy HTML element.
   *
   * @param {String} data The data to copy to the clipboard.
   * @param {CypherPokerUI} [context=null] The context in which to execute
   * the function. If <code>null</code>, the default <code>this</code>
   * reference is assumed.
   *
   * @private
   */
   copyToClipboard (data, context=null) {
      if (context == null) {
         context = this;
      }
      document.querySelector(context.UISelectors.clipboardData).value = data;
      document.querySelector(context.UISelectors.clipboardData).focus();
      document.querySelector(context.UISelectors.clipboardData).select();
      document.execCommand("copy");
      document.querySelector(context.UISelectors.clipboardData).value = "";
   }

   /**
   * Event handler invoked when the account list select element is updated (a new
   * account is selected).
   *
   * @param {Event} event A standard DOM button click event.
   * @private
   */
   onSelectAccount(event) {
      var ui = event.target.ui;
      var selectElement = document.querySelector(ui.accountsUISelectors.currentAccounts);
      var selectedOption = selectElement.options[selectElement.selectedIndex];
      var selectedAccount = selectedOption.account;
      document.querySelector(ui.accountsUISelectors.accountPassword).value = selectedAccount.password;
      selectedAccount.update().then(done => {
         var satoshiAmount = selectedAccount.balance.toString(10);
         var btcAmount = ui.convertDenom(satoshiAmount, "satoshi", "bitcoin");
         //document.querySelector(ui.accountsUISelectors.accountBalance).innerHTML =  btcAmount+ " BTC";
         document.querySelector(ui.accountsUISelectors.accountBalance).innerHTML =  satoshiAmount+ " satoshis";
      }).catch(error => {
         document.querySelector(ui.accountsUISelectors.accountBalance).innerHTML =  "? BTC";
         console.error(error);
      });
   }

   /**
   * Function invoked when an externally advertised table button is clicked to join it.
   *
   * @param {Event} event A standard DOM button event object.
   *
   * @private
   */
   onJoinTableButtonClick(event) {
      //this event may have been triggered by a child node of the button (is there wa better way to deal with this?)
      var target = event.target;
      while (target.ui == undefined) {
         target = target.parentNode;
      }
      var ui = target.ui;
      var table = target.table;
      ui.cypherpoker.joinTable(table);
      ui.cypherpoker.onEventPromise("tableready").then(event =>{
         //use updated event.table here
         var playerInfo = new Object();
         playerInfo.alias = "A player";
         var game = ui.cypherpoker.createGame(event.table, ui.selectedAccount, playerInfo).start();
         try {
            game.addEventListener("gamerestart", ui.onRestartGame, ui);
            game.contract.addEventListener("timeoutstart", ui.onStartContractTimeout, ui);
            game.contract.addEventListener("timeout", ui.onContractTimeout, ui);
            game.contract.addEventListener("timeoutinvalid", ui.onContractTimeoutInvalid, ui);
         } catch (err) {
            //game may not have contract
         }
      }).catch(error => {
         ui.showDialog(error);
         ui.hideDialog(4000);
      });
   }

   /**
   * Event listener invoked when the user interface's "bet" button is clicked.
   *
   * @param {Event} event A DOM event object.
   *
   * @listens Event#click
   * @private
   */
   onBetButtonClick(event) {
      var game = event.target.game;
      var ui = event.target.ui;
      ui.debug("onBetButtonClick("+event+")");
      ui.disable(event.target);
      ui.disable(game.DOMElement.querySelector(ui.gameUISelectors.betButton));
      ui.disable(game.DOMElement.querySelector(ui.gameUISelectors.foldButton));
      var betAmount = game.DOMElement.querySelector(ui.gameUISelectors.betAmount);
      try {
         var amount = bigInt(betAmount.value);
         if (amount.lesser(0)) {
            this.showDialog("Bet amount must be positive.");
            this.hideDialog(4000);
            return;
         }
         game.placeBet(betAmount.value);
      } catch (err) {
         //probably wrong bet amount
         ui.showDialog(err.message);
         ui.hideDialog(4000);
         ui.enable(event.target);
         ui.enable(game.DOMElement.querySelector(ui.gameUISelectors.foldButton));
      }
      game.DOMElement.querySelector(ui.gameUISelectors.potAmount).innerHTML = game.pot.toString(10) + " satoshis";
      ui.updateTotalBet.call(ui, game);
      if (game.bettingDone && ui.autoDeal && (game.gameDone == false)) {
         //try to automatically deal cards
         game.dealCards().catch(err => {
            //not our time to deal
         });
      }
   }

   /**
   * Event listener invoked when the user interface's "fold" button is clicked.
   *
   * @param {Event} event A DOM event object.
   *
   * @listens Event#click
   * @private
   */
   onFoldButtonClick(event) {
      var game = event.target.game;
      var ui = event.target.ui;
      ui.debug("onFoldButtonClick("+event+")");
      ui.disable(event.target);
      ui.disable(game.DOMElement.querySelector(ui.gameUISelectors.betButton));
      try {
         game.placeBet(-1);
      } catch (err) {}
      if (game.bettingDone && ui.autoDeal && (game.gameDone == false)) {
         //try to automatically deal cards
         game.dealCards().catch(err => {
            //not our time to deal
         });
      }
   }

   /**
   * Event listener invoked when the user interface's "new hand" button is clicked.
   *
   * @param {Event} event A DOM event object.
   *
   * @listens Event#click
   *
   * @private
   */
   onNewHandButtonClick(event) {
      var ui = event.target.ui;
      var game = event.target.game;
      ui.disable(event.target);
      ui.resetGameUI(game);
      game.restartGame();
   }

   /**
   * Event listener invoked when an associated game dispatches a "gamerestart" event.
   *
   * @param {CypherPokerGame#event:gamerestart} event A "gamerestart" event object.
   *
   * @private
   */
   onRestartGame(event) {
      try {
         event.game.contract.addEventListener("timeoutstart", this.onStartContractTimeout, this);
         event.game.contract.addEventListener("timeout", this.onContractTimeout, this);
         event.game.contract.addEventListener("timeoutinvalid", this.onContractTimeoutInvalid, this);
      } catch (err) {
         console.error (err);
         //game may not have contract
      }
   }

   /**
   * Function invoked when a game's contract reports that a timeout timer has been
   * started or restarted.
   *
   * @param {CypherPokerContract#event:timeoutstart} event A "timeoutstart" event.
   *
   * @private
   */
   onStartContractTimeout(event) {
      var timeoutElement = event.contract.game.DOMElement.querySelector(ui.gameUISelectors.timeoutAmount);
      this.startTimeoutTimer(timeoutElement, event.seconds, event.contract.game);
   }

   /**
   * Function invoked when a game's contract reports that a timeout timer is no
   * longer valid (game may have ended).
   *
   * @param {CypherPokerContract#event:timeoutinvalid} event A "timeoutinvalid" event.
   *
   * @private
   */
   onContractTimeoutInvalid(event) {
      var timeoutElement = event.contract.game.DOMElement.querySelector(ui.gameUISelectors.timeoutAmount);
      this.stopTimeoutTimer(timeoutElement);
      try {
         event.game.contract.removeEventListener("gamerestart", this.onRestartGame, this);
         event.game.contract.removeEventListener("timeoutstart", this.onStartContractTimeout, this);
         event.game.contract.removeEventListener("timeout", this.onContractTimeout, this);
         event.game.contract.removeEventListener("timeoutinvalid", this.onContractTimeoutInvalid, this);
      } catch (err) {}
   }

   /**
   * Function invoked when a game's contract reports that it has timed out.
   *
   * @param {CypherPokerContract#event:timeout} event A "timeout" event.
   *
   * @private
   */
   onContractTimeout(event) {
      var timeoutNotification = "The following player(s) have timed out:<br/><br/>";
      for (var count = 0; count < event.penalized.length; count++) {
         var timedOutPlayer = event.contract.getPlayer(event.penalized[count].privateID);
         event.contract.game.debug ("Player has timed out: "+timedOutPlayer.account.address+"<br/>", "err");
         timeoutNotification += timedOutPlayer.info.alias + " ("+timedOutPlayer.account.address+")<br/>";
         timeoutNotification += " Private ID: "+event.penalized[count].privateID+"<br/>";
      }
      this.showDialog(timeoutNotification);
      this.hideDialog(10000);
      var timeoutElement = event.contract.game.DOMElement.querySelector(ui.gameUISelectors.timeoutAmount);
      this.stopTimeoutTimer(timeoutElement);
      try {
         event.contract.removeEventListener("gamerestart", this.onRestartGame, this);
         event.contract.removeEventListener("timeoutstart", this.onStartContractTimeout, this);
         event.contract.removeEventListener("timeout", this.onContractTimeout, this);
         event.contract.removeEventListener("timeoutinvalid", this.onContractTimeoutInvalid, this);
      } catch (err) {
         console.error(err);
      }
      var nextDealerPID = event.contract.game.getNextPlayer(event.contract.game.getDealer().privateID).privateID;
      //if (event.contract.game.getDealer().privateID == event.contract.game.ownPID) {
      if (nextDealerPID == event.contract.game.ownPID) {
         //if we want to auto-restart we should do that below
         this.enable(event.contract.game.DOMElement.querySelector(this.gameUISelectors.newHandButton));
      } else {
         this.resetGameUI(event.contract.game);
         event.contract.game.restartGame();
      }
   }

   /**
   * Event listener invoked when a new table has been announced by another peer.
   *
   * @param {Event} event An event object.
   *
   * @listens CypherPoker#event:tablenew
   * @private
   */
   onNewTableAnnouncement(event) {
      var tableData = event.data.result.data;
      var templateInfo = this.getTemplateByName("tableButton");
      var containerElement = document.querySelector(templateInfo.target);
      var metaTags = new Object();
      metaTags.tableName = tableData.tableName;
      metaTags.numPlayers = String(tableData.requiredPID.length+1);
      metaTags.bigBlind = tableData.tableInfo.bigBlind;
      metaTags.smallBlind = tableData.tableInfo.smallBlind;
      var joinTableButton = this.buildHTMLTemplate(templateInfo, containerElement, false, metaTags);
      joinTableButton.table = this.cypherpoker.announcedTables[0]; //newest table reference
      joinTableButton.ui = this;
      joinTableButton.addEventListener("click", this.onJoinTableButtonClick);
   }

   /**
   * Event listener invoked when the associated {@link CypherPoker} instance
   * dispatches a {@link CypherPoker#event:newgame} event.
   *
   * @param {Event} event An event object.
   *
   * @listens CypherPoker#newgame
   * @private
   */
   onNewGame(event) {
      var gameTemplate = this.getTemplateByName("game");
      var target = document.querySelector(gameTemplate.target);
      var metaData = new Object();
      var newGameElement = this.buildHTMLTemplate(gameTemplate, target, gameTemplate.hidden, metaData);
      var namePrefix = newGameElement.getAttribute("name");
      if ((namePrefix == null) || (namePrefix == "")) {
         namePrefix = newGameElement.getAttribute("id");
      }
      if ((namePrefix == null) || (namePrefix == "")) {
         namePrefix = "game";
      }
      var elementName = namePrefix + String(this.gameElements.length + 1);
      newGameElement.setAttribute("name", elementName)
      this.gameElements.push(newGameElement);
      event.game.DOMElement = newGameElement;
      this.addGameUIHandlers(newGameElement, event.game);
      var lobbyElement = document.querySelector(this.UISelectors.lobby);
      this.hide(lobbyElement);
      this.show(newGameElement);
   }

   /**
   * Event handler invoked when an associated game instance reports that new cards
   * have been dealt.
   *
   * @param {Event} event An event object.
   *
   * @listens CypherPokerGame#event:gamedeal
   * @private
   */
   onCardDeal(event) {
      var game = event.game;
      var targetElement = game.DOMElement.querySelector(ui.gameUISelectors.privateCards);
      if (event.private == false) {
         targetElement = game.DOMElement.querySelector(ui.gameUISelectors.publicCards);
      }
      for (var count=0; count < event.cards.length; count++) {
         event.cards[count].addToDOM(targetElement);
      }
      //pot may have changed if we've auto-posted blinds
      game.DOMElement.querySelector(this.gameUISelectors.potAmount).innerHTML = game.pot.toString() + " satoshis";
      if (game.canBet) {
         this.updateMinimumBet(game);
         this.enable(game.DOMElement.querySelector(this.gameUISelectors.betButton));
         this.enable(game.DOMElement.querySelector(this.gameUISelectors.foldButton));
      }

      this.updateTotalBet(game);
   }

   /**
   * Event handler invoked when an associated game instance reports that a new bet
   * has been placed by another player.
   *
   * @param {Event} event An event object.
   *
   * @listens CypherPokerGame#event:gamebet
   * @private
   */
   onBetPlaced(event) {
      this.debug("CypherPokerUI.onBetPlaced("+event+")");
      var game = event.game;
      game.DOMElement.querySelector(this.gameUISelectors.potAmount).innerHTML = game.pot.toString() + " satoshis";
      this.updateTotalBet(game);
      if (game.canBet) {
         this.updateMinimumBet(game);
         this.enable(game.DOMElement.querySelector(this.gameUISelectors.betButton));
         this.enable(game.DOMElement.querySelector(this.gameUISelectors.foldButton));
      }
      if (game.bettingDone && this.autoDeal && (game.gameDone == false)) {
         //try to automatically deal cards
         game.dealCards().catch(err => {
            //not our time to deal; no problem
         });
      }
   }

   /**
   * Event handler invoked when an associated game instance reports that it has ended.
   * In other words, the game (hand) has completed.
   *
   * @param {Event} event An event object.
   *
   * @listens CypherPokerGame#event:gameend
   * @private
   * @async
   */
   async onGameEnd(event) {
      this.showDialog("Game is done!");
      var game = event.game;
      var table = event.table;
      this.disable(game.DOMElement.querySelector(this.gameUISelectors.betButton));
      this.disable(game.DOMElement.querySelector(this.gameUISelectors.foldButton));
      var nextDealerPID = game.getNextPlayer(game.getDealer().privateID).privateID;
      //if (game.getDealer().privateID == game.ownPID) {
      if (nextDealerPID == game.ownPID) {
         //if we want to auto-restart we should do that below
         this.enable(game.DOMElement.querySelector(this.gameUISelectors.newHandButton));
      } else {
         this.resetGameUI(game);
         game.restartGame();
      }
   }

   /**
   * Event handler invoked when an associated game instance reports that it has been
   * scored.
   *
   * @param {Event} event An event object.
   *
   * @listens CypherPokerGame#event:gamescored
   * @private
   */
   onGameScored(event) {
      this.debug("CypherPokerUI.onGameScored("+event+")");
      try {
         var analysis = event.analyzer.analysis;
         var allHands = analysis.hands;
         var winningHands = analysis.winningHands;
         var winningPlayers = analysis.winningPlayers;
         var templateInfo = this.getTemplateByName("handHistoryItem");
         for (var count = 0; count < winningHands.length; count++) {
            var winningHand = winningHands[count];
            var winningPlayer = winningPlayers[count];
            var hand = winningHand.hand;
            var targetElement = event.game.DOMElement.querySelector("#handHistory");
            var metaTags = new Object();
            if (winningHands.length > 1) {
               metaTags.header = "Best Hands:&nbsp;";
            } else {
               metaTags.header = "Best Hand:&nbsp;";
            }
            metaTags.handName = winningHand.name;
            if (winningPlayer.privateID == event.game.ownPID) {
               metaTags.handOwner = "Ours";
            } else {
               metaTags.handOwner = "Player: "+winningPlayer.privateID;
            }
            var newHistoryElement = this.buildHTMLTemplate(templateInfo, targetElement, false, metaTags);
            var cardContainerElement = newHistoryElement.querySelector("#handHistoryItemCards")
            for (var count2 = 0; count2 < hand.length; count2++) {
               var card = hand[count2];
               card.addToDOM(cardContainerElement, "historyCard");
            }
         }
      } catch (err) {
         console.error(err);
      }
   }

   /**
   * Updates the "total bet" field in the user interface associated with a specific game.
   *
   * @param {CypherPokerGame} game The game for which to update the UI.
   *
   * @private
   */
   updateTotalBet(game) {
      var totalBetAmount = game.getPlayer(game.ownPID).totalBet.toString();
      var totalBetDiv = game.DOMElement.querySelector(this.gameUISelectors.totalBet);
      var balanceDiv = game.DOMElement.querySelector(this.gameUISelectors.balance);
      balance.innerHTML = String(game.getPlayer(game.ownPID).balance) + " satoshis";
      totalBetDiv.innerHTML = totalBetAmount + " satoshis";
   }

   /**
   * Updates the game user interface with the minimum allowable bet for the current round of
   * betting.
   *
   * @param {CypherPokerGame} gameRef The game instance for which to update the user interface.
   * @private
   */
   updateMinimumBet(gameRef) {
      var betAmountElement = gameRef.DOMElement.querySelector(this.gameUISelectors.betAmount);
      betAmountElement.value = gameRef.minimumBet.toString();
   }

   /**
   * Resets the game UI for a new game (hand) with an optional delay.
   *
   * @param {CypherPokerGame} gameRef A reference to the game containing the
   * <code>DOMElement</code> to clear.
   * @param {Number} [delay=0] A pause, in milliseconds, to wait before
   * resetting the game UI.
   * @param {CypherPokerUI} [context=null] The UI context in which to execute the
   * delayed function. If <code>null</code>, the context resolves to <code>this</code>
   *
   * @private
   */
   resetGameUI(gameRef, delay=0, context=null) {
      if (context == null) {
         context = this;
      }
      context.debug("resetGameUI("+gameRef+", "+delay+", "+context+")");
      if (delay > 0) {
         setTimeout(context.resetGameUI, delay, gameRef, 0, context);
      }
      context.hideDialog.call(context, 3000);
      gameRef.DOMElement.querySelector(context.gameUISelectors.publicCards).innerHTML = "";
      gameRef.DOMElement.querySelector(context.gameUISelectors.privateCards).innerHTML = "";
      gameRef.DOMElement.querySelector(context.gameUISelectors.totalBet).value = "0";
   }

   /**
   * Disables a game's UI (buttons, etc.)
   *
   * @param {CypherPokerGame} game The game instance to disable the UI for.
   *
   * @private
   */
   disableGameUI(game) {
      this.disable(game.DOMElement.querySelector(this.gameUISelectors.betButton));
      this.disable(game.DOMElement.querySelector(this.gameUISelectors.foldButton));
   }

   /**
   * Updates the account management UI with existing data (e.g. restored accounts
   * from the {@link CypherPoker} instance).
   *
   * @param {CypherPokerUI} [context=null] Defines the context in which to execute the function.
   * Typically this parameter is provided when delaying startup because all UI data, elements,
   * templates, etc., have not yet loaded and been initialized.
   *
   * @private
   */
   updateAccountsUI(context=null) {
      if (context == null) {
         context = this;
      }
      if (context.ready == false) {
         //delay by 0.5 second
         setTimeout(context.updateAccountsUI, 500, context);
         return;
      }
      if (context.cypherpoker.accounts.length == 0) {
         context.show(context.getTemplateByName("firstRun").elements[0]);
         context.showDialog();
         return;
      } else {
         var loginElement = context.getTemplateByName("accountLogin").elements[0];
         var manageElement = context.getTemplateByName("accountManage").elements[0];
         var accountsList = loginElement.querySelector("#currentAccounts");
         for (var count=0; count < context.cypherpoker.accounts.length; count++) {
            var currentAccount = context.cypherpoker.accounts[count];
            var newOptionElement = document.createElement("option");
            var optionValue = currentAccount.address + ":" + currentAccount.type + "/" + currentAccount.network;
            newOptionElement.setAttribute("value", optionValue);
            newOptionElement.innerHTML = currentAccount.address + " ("+currentAccount.type+" / "+currentAccount.network+")";
            newOptionElement.account = currentAccount;
            accountsList.appendChild(newOptionElement);
         }
         var selectElement = loginElement.querySelector("#currentAccounts");
         var selectedOption = selectElement.options[0];
         var selectedAccount = selectedOption.account;
         loginElement.querySelector("#accountPassword").value = selectedAccount.password;
         selectedAccount.update().then(done => {
            var satoshiAmount = selectedAccount.balance.toString(10);
            var btcAmount = context.convertDenom(satoshiAmount, "satoshi", "bitcoin");
            loginElement.querySelector("#accountBalance").innerHTML =  satoshiAmount+ " satoshis";
            loginElement.querySelector("#accountPassword").value = selectedAccount.password;
         }).catch(error => {
            loginElement.querySelector("#accountBalance").innerHTML =  "unavailable";
            console.error(error.stack);
         });
         context.show(loginElement);
         context.show(manageElement);
      }
   }

   /**
   * Converts an amount from a specific denomination to a specific denomination
   * for display.
   *
   * @param {String} amount The amount to convert.
   * @param {String} fromDenom The source denomination. Valid values include:
   * "satoshi", "bitcoin"
   * @param {String} toDenom The target denomination. Valid values include:
   * "satoshi", "bitcoin"
   *
   * @return {String} The <code>amount</code> converted to from the source
   * denomination to the target denomination.
   */
   convertDenom(amount, fromDenom, toDenom) {
      if (fromDenom == toDenom) {
         return (amount);
      }
      switch (fromDenom) {
         case "satoshi":
            if (toDenom == "bitcoin") {
               amount = amount.padStart(8, "0");
               var decimal = amount.substring(amount.length-8);
               var whole = amount.substring(0,amount.length-8);
               if (whole == "") {
                  whole = "0";
               }
               amount = whole + "." + decimal;
            } else {
               throw (new Error("Unrecognized target denomination \""+toDenom+"\""));
            }
            break;
         case "bitcoin":
            if (toDenom == "satoshis") {
               var amountSplit = amount.split(".");
               if (amountSplit.length > 1) {
                  whole = amountSplit[0];
                  decimal = amountSplit[1].padEnd(8, "0");
               } else {
                  whole = "0";
                  decimal = amountSplit[0].padEnd(8, "0");
               }
               if (decimal.length > 8) {
                  decimal = decimal.substring(0, 7);
               }
               if (whole == "0") {
                  whole = "";
                  while (decimal.startsWith("0")) {
                     decimal = decimal.substring(1);
                  }
               }
               amount = whole + decimal;
            } else {
               throw (new Error("Unrecognized target denomination \""+toDenom+"\""));
            }
            break;
         default:
            throw (new Error("Unrecognized source denomination \""+fromDenom+"\""));
            break;
      }
      return (amount);
   }

   /**
   * Disables a specific HTML element by adding a <code>disabled="true"</code>
   * attribute to it.
   *
   * @param {HTMLElement} elementRef A reference to the object to disable.
   */
   disable(elementRef) {
      elementRef.setAttribute("disabled", true);
   }

   /**
   * Enables a specific HTML element by removing the <code>disabled</code>
   * attribute from it.
   *
   * @param {HTMLElement} elementRef A reference to the object to enable.
   */
   enable(elementRef) {
      elementRef.removeAttribute("disabled");
   }

   /**
   * Hides a specific HTML element by adding a <code>hidden="true"</code>
   * attribute to it.
   *
   * @param {HTMLElement} elementRef A reference to the object to hide.
   */
   hide(elementRef) {
      elementRef.setAttribute("hidden", true);
   }

   /**
   * Shows a specific HTML element by removing the <code>hidden</code>
   * attribute from it.
   *
   * @param {HTMLElement} elementRef A reference to the object to show.
   */
   show(elementRef) {
      elementRef.removeAttribute("hidden");
   }

   /**
   * Hides the main dialog, as defined in {@link CypherPokerUI#UISelectors}<code>.dialog</code>,
   * with an optional delay.
   *
   * @param {Number} [delay=0] The number of milliseconds to delay before closing the
   * dialog.
   * @param {CypherPokerUI} [context=null] A reference to this instance, used in
   * conjunction with the hide delay. If <code>null</code>, <code>this</code> is
   * used as the default context.
   */
   hideDialog(delay=0, context=null) {
      if (delay > 0) {
         this._dialogTimeout = setTimeout(this.hideDialog, delay, 0, this);
         return;
      }
      if (context == null) {
         var dialog = document.querySelector(this.UISelectors.dialog);
      } else {
         dialog = document.querySelector(context.UISelectors.dialog);
      }
      dialog.removeAttribute("open");
   }

   /**
   * Displays the main dialog with any specified content.
   *
   * @param {String} [content=""] The HTML contents to display in the dialog.
   */
   showDialog(contents="") {
      try {
         clearTimeout(this._dialogTimeout);
      } catch (err) {}
      var dialog = document.querySelector(this.UISelectors.dialog);
      var dialogMsg = document.querySelector(this.UISelectors.dialogMessage);
      dialog.setAttribute("open", true);
      dialogMsg.innerHTML = contents;
   }

   /**
   * Creates a <code>console</code>-based log or error message.
   *
   * @param {*} msg The message to send to the console output.
   * @param {String} [type="log"] The type of output that the <code>msg</code> should
   * be sent to. Valid values are "log" - send to the standard <code>log</code> output,
   * "err" or "error" - send to the <code>error</code> output, and "dir"-send to the
   * <code>dir</code> (object inspection) output.
   * @private
   */
   debug (msg, type="log") {
      if ((type == "err") || (type == "error")) {
         console.error(msg);
      } else if (type == "dir") {
         console.dir(msg);
      } else {
         console.log(msg);
      }
   }

   /**
   * @private
   */
   toString() {
      return ("[object CypherPokerUI]");
   }
}
