/**
* @file Basic user interface management for CypherPoker.JS.
*
* @version 0.5.0
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
      this.lobbyActive = false;
      window.__closing = false;
   }

   /**
   * Intializes the UI by loading defined templates and setting
   * the [ready]{@link CypherPokerUI#ready} flag to <code>true</code>.
   *
   * @async
   */
   async initialize() {
      var complete =  await this.loadTemplates();
      window.addEventListener("beforeunload", this.onWindowClose);
      window.addEventListener("click", this.onWindowClick);
      this._ready = true;
   }

   /**
   * @property {Boolean} ready=false Becomes true when the UI has completed loading and initializing
   * all data such as templates, configurations, etc.
   * @readonly
   */
   get ready() {
      if (this._ready == undefined) {
         this._ready = false;
      }
      return (this._ready);
   }

   /**
   * @property {Boolean} lobbyActive=false True if the lobby interface is currently displayed and
   * enabled, otherwise false. Setting this value to true enables automatic table culling in the lobby.
   */
   get lobbyActive() {
      return (this._lobbyActive);
   }

   set lobbyActive(activeSet) {
      if ((activeSet == true) && (this._lobbyActive == false)) {
         this.startLobbyCull();
      }
      if ((activeSet == false) && (this._lobbyActive == true)) {
         this.stopLobbyCull();
      }
      this._lobbyActive = activeSet;
   }

   /**
   * Starts the lobby table culling timer to remove inactive / invalid tables.
   */
   startLobbyCull() {
      this._lobbyCullTimer = setInterval(this.onLobbyCullTick, 3000, this);
   }

   /**
   * Stops the lobby table culling timer if active.
   */
   stopLobbyCull() {
      try {
         clearInterval(this._lobbyCullTimer);
         this._lobbyCullTimer = null;
      } catch (err) {
      }
   }

   /**
   * Timer function invoked to cull (remove) any inactive or unavailable tables appearing
   * in the lobby.
   *
   * @private
   */
   onLobbyCullTick(ui) {
      for (var count=0; count<ui.cypherpoker.announcedTables.length; count++) {
         var currentTable = ui.cypherpoker.announcedTables[count];
         var tableInfo = currentTable.tableInfo;
         var announceTimeout = Number(ui.cypherpoker.settings.lobbyDefaults.announceTimeout) * 1000; //seconds to milliseconds
         var nowDate = new Date();
         var tableDate = new Date(tableInfo.announcedAt);
         var delta = nowDate.valueOf() - tableDate.valueOf();
         if (delta >= announceTimeout) {
            try {
               tableInfo.buttonElement.removeEventListener("click", ui.onJoinTableButtonClick);
               tableInfo.buttonElement.remove();
            } catch (err) {}
            ui.cypherpoker.removeTable(currentTable, true);
         }
      }
   }

   /**
   * @property {Boolean} autoDeal=true If true, cards are automatically dealt when
   * betting is done and it's our turn to deal. If <code>false</code>, the
   * [CypherPokerGame.dealCards]{@link CypherPokerGame#dealCards} function of the
   * [game]{@link CypherPokerUI#game} reference will need to be invoked manually.
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
   * cloned from the [protoGameElement]{@link CypherPokerUI#protoGameElement} object.
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
         if (this._cypherpoker.apiConnected) {
            var msg = "Connected to API services provider.<br/>";
            if (this._cypherpoker.p2pConnected) {
               msg += "Connected to peer-to-peer network.";
            } else {
               msg += "Connection to peer-to-peer network not established.";
            }
            this.showDialog(msg);
            this.hideDialog(5000);
            this.updateAccountsUI();
         } else {
            this._cypherpoker.addEventListener("start", event => {
               if (this._cypherpoker.apiConnected) {
                  var msg = "Connected to API services provider.<br/>";
               } else {
                  msg = "Connection to API services provider not established.<br/>";
               }
               if (this._cypherpoker.p2pConnected) {
                  msg += "Connected to peer-to-peer network.";
               } else {
                  msg += "Connection to peer-to-peer network not established.";
               }
               this.showDialog(msg);
               this.hideDialog(5000);
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
   * Returns a successfully loaded HTML template by its name from the
   * [templates]{@link CypherPokerUI#templates} array.
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
   * Clones an HTML element, appends it to the DOM after the source element, and
   * sets an internal reference to the clone in the source. Use this function
   * to create copies of a dynamic template element that may change multiple times.
   *
   * @param {HTMLElement} sourceElement The HTML element to clone. This element
   * will have an internal <code>_clone</code> reference to the cloned element.
   * @param {Boolean} [internalReference=true] If true, the <code>sourceElement</code>
   * will store a refence to the new clonet within itself as a <code>_clone</code>
   * property so that it can be removed using {@link removeClone}.
   *
   * @return {HTMLElement} The cloned HTML element.
   */
   cloneElement(sourceElement, internalReference=true) {
      var clone = sourceElement.cloneNode(true);
      if (internalReference == true) {
         sourceElement._clone = clone;
      }
      sourceElement.parentNode.appendChild(clone);
      return (clone);
   }

   /**
   * Removes a cloned HTML element created by {@link cloneElement} with
   * <code>internalReference=true</code>.
   *
   * @param {HTMLElement} sourceElement The soucre HTML element from which the
   * clone was created. This element must have an internal <code>_clone</code>
   * property.
   *
   * @return {Boolean} True if the cloned element could be properly removed.
   */
   removeClone(sourceElement) {
      if ((sourceElement["_clone"] == undefined) || (sourceElement["_clone"] == null)) {
         return (false);
      }
      sourceElement.parentNode.removeChild(sourceElement._clone);
      sourceElement._clone = null;
      delete sourceElement._clone;
      return (true);
   }

   /**
   * Loads and parses HTML templates for the application, then adds them to their
   * specified targets within the main page HTML. Every successfully loaded template
   * can be accessed via the [templates]{@link CypherPokerUI#templates} array or the
   * [getTemplate]{@link CypherPokerUI#getTemplate} function.
   *
   * Note that templates are appended to their specified targets in the order listed.
   *
   * @param {String} [indexURL="./templates/index.json"] The URL of the JSON file containing
   * the list of templates to load.
   *
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
            this.cloneHTMLTemplate(templateInfo, target, templateInfo.hidden);
         }
      }
      return (true);
   }

   /**
   * Clones a specified HTML template, processes any meta tags, and appends it to a
   * specified target. A reference to the clone is appended to the template information
   * objects's internal <code>elements</code> array.
   *
   * @param {Object} templateInfo An object containing information about the template to generate.
   * @param {HTMLElement} target The target element to append the generated template to as a child.
   * @param {Boolean} [hidden=false] If true, the generated element is initially hidden.
   * @param {Object} [metaData=null] Name-value pairs containing the data to replace in the
   * document body. Each name is automatically surrounded by "%"; for example,
   * <code>metaData["version"]="0.3.0"</code> replaces any <code>%version%</code> metatag
   * in the document with <code>0.3.0</code>.
   *
   * @return {HTMLElement} The cloned, processed, and appended HTML template element.
   *
   * @private
   */
   cloneHTMLTemplate(templateInfo, target, hidden=false, metaData=null) {
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
   * Builds a HTML template using a supplied template information object.
   * Like {@link cloneHTMLTemplate} the template is cloned and any contained metatags
   * are parsed but unlike {@link cloneHTMLTemplate} the template is destructively
   * appended to the container specified in the template info (i.e. any children in
   * the container are removed), and no reference is added to a internal <code>elements</code>
   * array of the template information object.
   *
   * @param {Object} templateInfo An object containing information about the template to build.
   * @param {Object} [metaData=null] Name-value pairs containing the data to replace in the
   * document body. Each name is automatically surrounded by "%"; for example,
   * <code>metaData["version"]="0.3.0"</code> replaces any <code>%version%</code> metatag
   * in the document with <code>0.3.0</code>.
   *
   * @return {HTMLElement} The cloned, parsed, and appended HTML element.
   *
   * @private
   */
   buildHTMLTemplate(templateInfo, metaData=null) {
      //assume document only has <head> (firstChild) and <body> (lastChild) tags within a <html> (documentElement) tag
      var bodyNode = templateInfo.document.documentElement.lastChild;
      var target = document.querySelector(templateInfo.target);
      var nodeCopy = document.importNode(bodyNode.firstChild, true);
      if (metaData != null) {
         this.parseHTMLTemplateTags(nodeCopy, metaData);
      }
      target.innerHTML = ""; //remove all children
      var newChild = target.appendChild(nodeCopy);
      return (newChild);
   }

   /**
   * Loads and parses an external HTML template file using XMLHTTPRequest.
   *
   * @param {String} htmlURL The URL of the HTML template file to load.
   * @return {HTMLDocument} A HTMLDocument object containing the loaded HTML
   * document. Any meta tags found in the main body are automatically parsed
   * using the [parseTemplateTags]{@link CypherPokerUI#parseTemplateTags} function.
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
   * Returns all of the selected radio button or checkbox elements contained in a specified
   * container.
   *
   * @param {HTMLElement} containerElement The container element that contains
   * the radio button or checkbox <code><input></code> nodes to check.
   *
   * @return {Array} Indexed list of all selected / checked radio buttons or checkboxes
   * (<code>HTMLElement</code> objects). Note that radio buttons with the same
   * <code>name</code> property are treated by the browser as a group and
   * will only allow one selection among them.
   */
   getGroupSelections(containerElement) {
      var radioButtons = containerElement.querySelectorAll("input");
      var returnButtons = new Array();
      for (var count=0; count < radioButtons.length; count++) {
         var radioButton = radioButtons[count];
         if (radioButton.checked) {
            returnButtons.push(radioButton);
         }
      }
      return (returnButtons);
   }

   /**
   * Adds game event listeners and callbacks to user interface elements defined in
   * [gameUISelectors]{@link CypherPokerUI#gameUISelectors} and contained in a clone of the
   * [protoGameElement]{@link CypherPokerUI#protoGameElement} element.
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
   * Event listener invoked when the containing window is about to be closed or
   * refreshed. A dialog box with a warning is displayed to the user if a game is
   * currently active.
   *
   * @param {Event} event A standard DOM event object.
   *
   * @private
   */
   onWindowClose(event) {
      for (var count=0; count < this.ui.cypherpoker.games.length; count++) {
         if (this.ui.cypherpoker.games[count].gameStarted) {
            event.preventDefault();
            event.stopPropagation();
            event.stopImmediatePropagation();
            //unfortunately custom leave messages are no longer supported by most browsers
            event.returnValue = null;
            return (null);
         }
      }
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
   * the [cypherpoker]{@link CypherPokerUI#cypherpoker} property.
   */
   addCypherPokerHandlers() {
      this.cypherpoker.addEventListener("newgame", this.onNewGame, this);
      this.cypherpoker.addEventListener("tablenew", this.onNewTableAnnouncement, this);
      this.cypherpoker.captureNewTables = true;
   }

   /**
   * Invoked when a dropdown button is clicked to toggle an associated menu.
   *
   * @param {String} dropdownSelector The dropdown menu selector to toggle.
   *
   * @private
   */
   toggleDropdown(dropdownSelector) {
      var element = document.querySelector(dropdownSelector);
      element.classList.toggle("showDropdownMenu");
   }

   /**
   * Event listener invoked when the main window is clicked. This triggers
   * functionality such as hiding any currently open dropdowns.
   *
   * @param {Event} event A standard DOM event object.
   *
   * @private
   */
   onWindowClick(event) {
      //only trigger if target isn't a dropdown menu toggle button
     if (event.target.matches(".dropdownMenuButton") == false) {
       var dropdowns = document.querySelectorAll(".dropdownMenuContent");
       for (var count = 0; count < dropdowns.length; count++) {
         var openDropdown = dropdowns[count];
         if (openDropdown.classList.contains('showDropdownMenu')) {
           openDropdown.classList.remove('showDropdownMenu');
         }
       }
     }
   }

   /**
   * Invoked when a main menu option is clicked on.
   *
   * @param {String} selection The identifier of the main menu option that was
   * just clicked on.
   *
   * @private
   */
   onMainMenuClick(selection) {
      switch (selection) {
         case "newWindow":
            if (isDesktop()) {
               var requestData = new Object();
               var result = IPCSend("new-window", requestData)
            } else {
               try {
                  var windowName = "CypherPoker.JS-"+String(Math.random()).split("0.")[1];
                  var windowURL = document.location; //use current full URL
                  var windowFeatures = ""; //use default window features
                  var window = document.open(windowURL, windowName, windowFeatures);
               } catch (err) {
                  alert (err.stack);
               }
            }
            break;
         case "manageConnections":
            var manageElement = this.getTemplateByName("connectivityManage").elements[0];
            cypherpoker.connectivityManager.populateConnectionsList("api");
            cypherpoker.connectivityManager.populateAPIConnectionInputs();
            cypherpoker.connectivityManager.populateConnectionsList("p2p");
            cypherpoker.connectivityManager.populateP2PConnectionInputs();
            var serverTableElement = manageElement.querySelector("#serverTableDivider");
            if (isDesktop()) {
               this.show(serverTableElement);
               cypherpoker.connectivityManager.populateGatewaysList();
            } else {
               this.hide(serverTableElement);
            }
            this.toggleShow(manageElement);
            break;
         case "manageAccount":
            if (this.selectedAccount == null) {
               if (this.cypherpoker.apiConnected == false) {
                  var msg = "You must connect to an API services provider in order to manage accounts";
               } else {
                  msg = "You must login to the account (\"USE ACCOUNT\") you want to manage."
               }
               this.showDialog (msg);
               this.hideDialog(5000);
               return;
            }
            var manageElement = this.getTemplateByName("accountManage").elements[0];
            var loginElement = this.getTemplateByName("accountLogin").elements[0];
            var minerFeeInput = manageElement.querySelector("#minerFee");
            if (this.isHidden(manageElement) == true) {
               this.show(manageElement);
            } else {
               this.hide(manageElement);
            }
            manageElement.querySelector("#accountBalance").innerHTML =  "updating...";
            loginElement.querySelector("#accountBalance").innerHTML =  "updating...";
            this.selectedAccount.update().then(done => {
               var satoshiAmount = this.selectedAccount.balance.toString(10);
               var btcAmount = this.convertDenom(satoshiAmount, "satoshi", "bitcoin");
               manageElement.querySelector("#accountBalance").innerHTML =  satoshiAmount+ " satoshis";
               loginElement.querySelector("#accountBalance").innerHTML =  satoshiAmount+ " satoshis";
               minerFeeInput.value = this.selectedAccount.fees.cashout;
               this.cypherpoker.saveAccounts();
            }).catch(error => {
               manageElement.querySelector("#accountBalance").innerHTML = "unavailable";
               loginElement.querySelector("#accountBalance").innerHTML = "unavailable";
               console.error(error);
               this.showDialog(error.message);
               this.hideDialog(4000);
            });
            break;
         case "gameLobby":
            if (this.cypherpoker.apiConnected == false) {
               var msg = "You must connect to an API services provider<br/>";
               msg += "in order to access to the lobby.";
               this.showDialog(msg);
               this.hideDialog(5000);
               return;
            }
            if (this.lobbyActive) {
               var confirmElement = this.getTemplateByName("lobbyConfirm").elements[0];
               this.hide(confirmElement.querySelector("#gameActive"));
               this.show(confirmElement.querySelector("#lobbyActive"));
               this.show(confirmElement);
               this.showDialog();
               return;
            } else {
               for (var count=0; count < this.cypherpoker.games.length; count++) {
                  var currentGame = this.cypherpoker.games[count];
                  if ((currentGame.gameStarted == true) || (currentGame.gameEnding == true)) {
                     confirmElement = this.getTemplateByName("lobbyConfirm").elements[0];
                     this.hide(confirmElement.querySelector("#lobbyActive"));
                     this.show(confirmElement.querySelector("#gameActive"));
                     this.show(confirmElement);
                     this.showDialog();
                     return;
                  }
               }
            }
            if (this.selectedAccount == null) {
               this.showDialog("You must login to an account (\"USE ACCOUNT\") with a balance in order to access the lobby.");
               this.hideDialog(5000);
            } else {
               //lobby is not active or game has ended
               this.cypherpoker.removeAllGames(true); //remove any completed games
               var lobbyContainer = document.querySelector(ui.UISelectors.lobby);
               this.show(lobbyContainer);
               this.resetLobbyUI(true);
               this.lobbyActive = true;
               this.cypherpoker.captureNewTables = true;
               this.startLobbyCull();
            }
            break;
         case "logOut":
            var confirmElement = this.getTemplateByName("logOutConfirm").elements[0];
            if (this.lobbyActive) {
               this.hide(confirmElement.querySelector("#gameActive"));
               this.hide(confirmElement.querySelector("#standard"));
               this.show(confirmElement.querySelector("#lobbyActive"));
               this.show(confirmElement);
               this.showDialog();
               return;
            } else {
               for (var count=0; count < this.cypherpoker.games.length; count++) {
                  var currentGame = this.cypherpoker.games[count];
                  if ((currentGame.gameStarted == true) || (currentGame.gameEnding == true)) {
                     this.show(confirmElement.querySelector("#gameActive"));
                     this.hide(confirmElement.querySelector("#standard"));
                     this.hide(confirmElement.querySelector("#lobbyActive"));
                     this.show(confirmElement);
                     this.showDialog();
                     return;
                  }
               }
            }
            //neither lobby or game are currently active
            this.hide(confirmElement.querySelector("#gameActive"));
            this.show(confirmElement.querySelector("#standard"));
            this.hide(confirmElement.querySelector("#lobbyActive"));
            this.show(confirmElement);
            this.showDialog();
            break;
         case "about":
            if (isDesktop()) {
               var runtime = "desktop";
               var dbInfoObj = IPCSend("database-info");
               var databaseInfo = "";
               for (var db in dbInfoObj) {
                  var currentDBInfo = dbInfoObj[db];
                  //info object may also contain a function reference
                  if (typeof(currentDBInfo) == "object") {
                     databaseInfo += currentDBInfo.version + " ("+currentDBInfo.dbSizeMB+" MB of "+currentDBInfo.dbMaxMB+" MB)<br/>";
                  }
               }
            } else {
               runtime = "web";
               databaseInfo = "";
            }
            var element = this.getTemplateByName("help").elements[0];
            var helpElement = element.querySelector("#about");
            helpElement.innerHTML = helpElement.innerHTML.split("%appTitle%").join(appTitle);
            helpElement.innerHTML = helpElement.innerHTML.split("%runtime%").join(runtime);
            helpElement.innerHTML = helpElement.innerHTML.split("%runtimeDetails%").join(platform.description);
            helpElement.innerHTML = helpElement.innerHTML.split("%databaseInfo%").join(databaseInfo);
            this.show(helpElement);
            this.showDialog();
            break
         default:
            break;
      }
   }

   /**
   * Invoked by the confirmation dialog opened by the main menu's "Game Lobby" option.
   *
   * @param {Boolean} confirm If true, the user has confirmed that they wish to take the desired
   * action (open the game lobby), and accept the consequences. If false, the currently opened
   * dialog is closed.
   * @private
   * @async
   */
   async onOpenLobbyButtonClick(confirm) {
      var confirmElement = this.getTemplateByName("lobbyConfirm").elements[0];
      this.hide(confirmElement.querySelector("#lobbyActive"));
      this.hide(confirmElement.querySelector("#gameActive"));
      this.hide(confirmElement);
      this.hideDialog();
      if (confirm == true) {
         //player has confirmed that they want to return to lobby
         if (this.lobbyActive) {
            //lobby is active
            this.cypherpoker.removeAllTables(true, true);
         } else {
            //game(s) is active
            this.cypherpoker.removeAllGames(true);
         }
         var lobbyContainer = document.querySelector(ui.UISelectors.lobby);
         this.show(lobbyContainer);
         this.resetLobbyUI(true);
         this.lobbyActive = true;
         this.cypherpoker.captureNewTables = true;
         this.startLobbyCull();
      } else {
         //nothing to do
      }
   }

   /**
   * Invoked by the post-cashout dialog when the "Okay" button is clicked.
   *
   * @private
   * @async
   */
   async onPostCashoutOkayClick() {
      var postCashoutElement = this.getTemplateByName("postCashout").elements[0];
      this.removeClone(postCashoutElement);
      this.hideDialog();
   }

   /**
   * Invoked by the confirmation dialog opened by the main menu's "Log Out" option.
   *
   * @param {Boolean} confirm If true, the user has confirmed that they wish to take the desired
   * action (log out), and accept the consequences. If false, the currently opened dialog is closed.
   * @private
   * @async
   */
   async onLogOutButtonClick(confirm) {
      var confirmElement = this.getTemplateByName("logOutConfirm").elements[0];
      this.hide(confirmElement.querySelector("#lobbyActive"));
      this.hide(confirmElement.querySelector("#gameActive"));
      this.hide(confirmElement.querySelector("#gameAPIChange"));
      this.hide(confirmElement.querySelector("#standard"));
      this.hide(confirmElement);
      this.hideDialog();
      if (confirm == true) {
         //prevent refresh notification since we've already asked for confirmation
         window.removeEventListener("beforeunload", this.onWindowClose);
         location.reload();
      }
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
         case "first_run_ok":
            this.hide(this.getTemplateByName("firstRun").elements[0]);
            this.hideDialog();
            this.show(this.getTemplateByName("accountCreate").elements[0]);
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
               if (typeSplit[0] == "bitcoin") {
                  if (typeSplit[1] == "test3") {
                     var helpElement = element.querySelector("#new_account_btc_test3");
                  } else {
                     helpElement = element.querySelector("#new_account_btc");
                  }
               } else if (typeSplit[0] == "bitcoincash") {
                  if (typeSplit[1] == "test") {
                     var helpElement = element.querySelector("#new_account_bch_test");
                  } else {
                     helpElement = element.querySelector("#new_account_bch");
                  }
               }
               helpElement.innerHTML = helpElement.innerHTML.split("%address%").join(newAccount.address);
               helpElement.innerHTML = helpElement.innerHTML.split("%depositfee%").join(newAccount.fees.deposit);
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
            }).catch(error => {
               this.showDialog(error);
            });
            break;
         case "use_account":
            var manageElement = this.getTemplateByName("accountManage").elements[0];
            this.hide(manageElement);
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
            var metaTags = {
               "account_address": this.selectedAccount.address
            };
            this.parseHTMLTemplateTags(manageElement, metaTags);
            this.hide(element);
            element = this.getTemplateByName("lobby").elements[0];
            this.lobbyActive = true;
            this.show(element);
            if (this.cypherpoker.p2pConnected == false) {
               var msg = "Peer-to-peer networking is not available.<br/>";
               msg += "You won't be able to create or join tables until you're connected.";
               this.showDialog(msg);
               this.hideDialog(6000);
            }
            break;
         case "select_account":
            var element = this.getTemplateByName("accountLogin").elements[0];
            var selectElement = element.querySelector("#currentAccounts");
            var loginElement = this.getTemplateByName("accountLogin").elements[0];
            var manageElement = this.getTemplateByName("accountManage").elements[0];
            var minerFeeInput = manageElement.querySelector("#minerFee");
            var selectedOption = selectElement.options[selectElement.selectedIndex];
            manageElement.querySelector("#accountBalance").innerHTML =  "updating...";
            loginElement.querySelector("#accountBalance").innerHTML =  "updating...";
            var account = selectedOption.account;
            element.querySelector("#accountPassword").value = account.password;
            account.update().then(done => {
               var satoshiAmount = account.balance.toString(10);
               var btcAmount = this.convertDenom(satoshiAmount, "satoshi", "bitcoin");
               manageElement.querySelector("#accountBalance").innerHTML =  satoshiAmount+ " satoshis";
               loginElement.querySelector("#accountBalance").innerHTML =  satoshiAmount+ " satoshis";
               minerFeeInput.value = account.fees.cashout;
               this.cypherpoker.saveAccounts();
            }).catch(error => {
               manageElement.querySelector("#accountBalance").innerHTML = "unavailable";
               loginElement.querySelector("#accountBalance").innerHTML = "unavailable";
               console.error(error);
               this.showDialog(error.message);
               this.hideDialog(4000);
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
            var loginElement = this.getTemplateByName("accountLogin").elements[0];
            element = this.getTemplateByName("accountLogin").elements[0];
            var minerFeeElement = manageElement.querySelector("#minerFee");
            var cashoutAddress = manageElement.querySelector("#cashoutAddress").value;
            var cashoutAmount = manageElement.querySelector("#cashoutAmount").value;
            var selectElement = element.querySelector("#currentAccounts");
            var selectedOption = selectElement.options[selectElement.selectedIndex];
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
            var minerFee = bigInt(minerFeeElement.value);
            if (minerFee.lesser(1)) {
               this.showDialog("Miner fee must be at least 1 satoshi.");
               this.hideDialog(3000);
               return (false);
            }
            minerFee = minerFee.toString(10);
            this.selectedAccount.cashout(cashoutAmount, cashoutAddress, minerFee).then(cashoutResult => {
               var satoshiAmount = this.selectedAccount.balance.toString(10);
               var btcAmount = this.convertDenom(satoshiAmount, "satoshi", "bitcoin");
               manageElement.querySelector("#accountBalance").innerHTML =  satoshiAmount+ " satoshis";
               loginElement.querySelector("#accountBalance").innerHTML =  satoshiAmount+ " satoshis";
               this.copyToClipboard(cashoutResult.txHash, this);
               var postCashoutElement = this.getTemplateByName("postCashout").elements[0];
               this.removeClone(postCashoutElement); //remove clone if it exists
               var clone = this.cloneElement(postCashoutElement, true);
               var btcElement = clone.querySelector("#cashout_btc");
               var test3Element = clone.querySelector("#cashout_test3");
               var bchElement = clone.querySelector("#cashout_bth");
               var bchTestElement = clone.querySelector("#cashout_bchtest");
               if (this.selectedAccount.type == "bitcoin") {
                  if (this.selectedAccount.network == "test3") {
                     //testnet
                     test3Element.innerHTML = test3Element.innerHTML.split("%txHash%").join(cashoutResult.txHash);
                     this.hide(btcElement);
                     this.show(test3Element);
                  } else {
                     //mainnet
                     btcElement.innerHTML = btcElement.innerHTML.split("%txHash%").join(cashoutResult.txHash);
                     this.hide(test3Element);
                     this.show(btcElement);
                  }
               } else if (this.selectedAccount.type == "bitcoincash") {
                  if (this.selectedAccount.network == "test") {
                     //testnet
                     bchTestElement.innerHTML = bchTestElement.innerHTML.split("%txHash%").join(cashoutResult.txHash);
                     this.hide(bchElement);
                     this.show(bchTestElement);
                  } else {
                     //mainnet
                     bchElement.innerHTML = bchElement.innerHTML.split("%txHash%").join(cashoutResult.txHash);
                     this.hide(bchTestElement);
                     this.show(bchElement);
                  }
               }
               this.show(clone);
               this.showDialog();
            }).catch(error => {
               var postCashoutElement = this.getTemplateByName("postCashout").elements[0];
               this.removeClone(postCashoutElement); //remove clone if it exists
               this.showDialog(error);
               this.hideDialog(3000);
               console.error(error);
            });
            break;
         case "transfer_account":
            var manageElement = this.getTemplateByName("accountManage").elements[0];
            var loginElement = this.getTemplateByName("accountLogin").elements[0];
            element = this.getTemplateByName("accountLogin").elements[0];
            var transferAccount = manageElement.querySelector("#transferAccount").value;
            var transferAmount = manageElement.querySelector("#transferAmount").value;
            var selectElement = element.querySelector("#currentAccounts");
            var selectedOption = selectElement.options[selectElement.selectedIndex];
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
            this.selectedAccount.transfer(transferAmount, transferAccount).then(done => {
               var satoshiAmount = this.selectedAccount.balance.toString(10);
               var btcAmount = this.convertDenom(satoshiAmount, "satoshi", "bitcoin");
               manageElement.querySelector("#accountBalance").innerHTML =  satoshiAmount+ " satoshis";
               loginElement.querySelector("#accountBalance").innerHTML =  satoshiAmount+ " satoshis";
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
            if (this.cypherpoker.p2pConnected == false) {
               var msg = "Peer-to-peer networking is not available.<br/>";
               msg += "You can't create or advertise a table until you're connected.";
               this.showDialog(msg);
               this.hideDialog(6000);
               return;
            }
            var element = this.getTemplateByName("lobby").elements[0];
            var createGameElement = element.querySelector("#createGame");
            var joinGameElement = element.querySelector("#joinGame");
            var tableInfo = new Object();
            var lobbyElement = document.querySelector(ui.UISelectors.lobby);
            var alias = createGameElement.querySelector("#playerAliasCreate").value;
            var tableName = createGameElement.querySelector("#tableName").value;
            var numPlayers = Number(createGameElement.querySelector("#numPlayers").value);
            numPlayers--; //exclude self
            var buyInAmount = createGameElement.querySelector("#buyInAmount").value;
            var bigBlindAmount = createGameElement.querySelector("#bigBlindAmount").value;
            var smallBlindAmount = createGameElement.querySelector("#smallBlindAmount").value;
            var inactivityTimeout = Math.round(createGameElement.querySelector("#inactivityTimeoutAmount").value);
            var validationError = this.validateTableCreateForm(createGameElement);
            if (validationError != null) {
               this.showDialog(validationError);
               this.hideDialog(4000);
               return (false);
            }
            tableInfo.buyIn = buyInAmount;
            tableInfo.bigBlind = bigBlindAmount;
            tableInfo.smallBlind = smallBlindAmount;
            tableInfo.timeout = inactivityTimeout;
            this.cypherpoker.addEventListener("tablejoinrequest", this.onPlayerJoinTable, this);
            this.cypherpoker.addEventListener("tablejoin", this.onPlayerJoinTable, this);
            this.cypherpoker.addEventListener("tableleave", this.onPlayerLeaveTable, this);
            this.cypherpoker.removeEventListener("tableready", this.onTableReady);
            this.cypherpoker.addEventListener("tableready", this.onTableReady, this);
            var newTable = this.cypherpoker.createTable(tableName, numPlayers, tableInfo);
            this.cypherpoker.localTableStorage(newTable).alias = alias;
            var announcedAt = new Date();
            var metaTags = {
               "tableName": tableName,
               "tableID": newTable.tableID,
               "joinedPlayers": 1,
               "totalPlayers": (numPlayers+1),
               "needPlayers": numPlayers,
               "ownerPID": newTable.ownerPID,
               "announcedAt": announcedAt.toString(),
               "cancelButtonPrompt": "Cancel Table"
            }
            this.updateJoinedTableStatus(metaTags, true);
            this.hide(createGameElement);
            this.hide(joinGameElement);
            break;
         case "cancel_game":
            try {
               this.removeAllJoinTableButtons(); //do this first before we clear out the associated table arrays!
               var joinedTable = this.cypherpoker.joinedTables[0]; //currently just one joined table per application instance
               this.cypherpoker.leaveJoinedTable(joinedTable); //send table leave notification
               this.cypherpoker.removeAllTables(true, true); //stop announcing
               //clear out current game
               element = this.getTemplateByName("lobby").elements[0];
               this.updateJoinedTableStatus(null, true);
            } catch (err) {
            }
            this.cypherpoker.removeAllTables(true, true);
            //restart lobby
            if (subType == "lobby") {
               var lobbyContainer = document.querySelector(ui.UISelectors.lobby);
               this.show(lobbyContainer);
               this.resetLobbyUI(true);
               this.lobbyActive = true;
            }
            this.cypherpoker.captureNewTables = true;
            this.startLobbyCull();
            break;
         default:
            break;
      }
      return (false);
   }

   /**
   * Validates the data of the table creation form.
   *
   * @param {HTMLElement} createGameElement The HTML element containing the table creation form.
   *
   * @return {String} A validation error if a form element failed validation, or <code>null</code>
   * if all form elements appear to contain valid data.
   * @private
   */
   validateTableCreateForm(createGameElement) {
      var alias = createGameElement.querySelector("#playerAliasCreate").value;
      var tableName = createGameElement.querySelector("#tableName").value;
      var numPlayers = Number(createGameElement.querySelector("#numPlayers").value);
      var buyInAmount = createGameElement.querySelector("#buyInAmount").value;
      var bigBlindAmount = createGameElement.querySelector("#bigBlindAmount").value;
      var smallBlindAmount = createGameElement.querySelector("#smallBlindAmount").value;
      var inactivityTimeout = createGameElement.querySelector("#inactivityTimeoutAmount").value;
      if (String(alias).trim() == "") {
         return ("Your player alias can't be blank.");
      }
      if (String(alias).trim() == "") {
         return ("Your player alias can't be blank.");
      }
      if (String(tableName).trim() == "") {
         return ("The table name can't be blank.");
      }
      if (Number(numPlayers) != Math.round(Number(numPlayers))) {
         return ("The number of players must be a whole number.");
      }
      if (Number(numPlayers) < 2) {
         return ("More than one player required.");
      }
      if (Number(buyInAmount) != Math.round(Number(buyInAmount))) {
         return ("Buy-in amount must be a whole number.");
      }
      if (bigInt(buyInAmount).greater(this.selectedAccount.balance)) {
         return ("Insufficient account balance for buy-in.");
      }
      if (bigInt(buyInAmount).lesserOrEquals(0)) {
         return ("Buy-in must be greater than 0.");
      }
      if (String(buyInAmount).trim() == "") {
         return ("The buy-in amount can't be blank.");
      }
      if (String(bigBlindAmount).trim() == "") {
         return("Big blind amount can't be blank.");
      }
      if (Number(bigBlindAmount) != Math.round(Number(bigBlindAmount))) {
         return ("Big blind amount must be a whole number.");
      }
      if (bigInt(buyInAmount).lesser(bigInt(bigBlindAmount))) {
         return ("Buy-in must be larger than or equal to the big blind amount.");
      }
      if (String(smallBlindAmount).trim() == "") {
         return("Small blind amount can't be blank.");
      }
      if (Number(smallBlindAmount) != Math.round(Number(smallBlindAmount))) {
         return ("Small blind amount must be a whole number.");
      }
      if (bigInt(bigBlindAmount).lesserOrEquals(bigInt(smallBlindAmount))) {
         return("Big blind amount must be larger than small blind amount.");
      }
      if (String(inactivityTimeout).trim() == "") {
         return("Inactivity timeout can't be blank.");
      }
      if (Number(inactivityTimeout) != Math.round(Number(inactivityTimeout))) {
         return ("Inactivity timeout must be a whole number.");
      }
      if (Number(inactivityTimeout) < 1) {
         return("Inactivity timeout must be at least 1 second.");
      }
      return (null);
   }

   /**
   * Event handler invoked when another player has joined a table that we've
   * joined.
   *
   * @param {CypherPoker#event:tablejoinrequest|CypherPoker#event:tablejoin} event a CypherPoker
   * table join related event.
   *
   * @listens CypherPoker#event:tablejoinrequest
   * @listens CypherPoker#event:tablejoin
   */
   onPlayerJoinTable(event) {
      try {
         var tableData = event.table;
         var joinedPlayers = tableData.joinedPID.length;
         var needPlayers = tableData.requiredPID.length;
         var totalPlayers = joinedPlayers + needPlayers;
         var tableName = tableData.tableName;
         var tableID = tableData.tableID;
         var ownerPID = tableData.ownerPID;
         var announcedAt = new Date(tableData.tableInfo.announcedAt);
         var joinedTables = this.cypherpoker.getJoinedTables(tableName, tableID, ownerPID);
         if (ownerPID == this.cypherpoker.p2p.privateID) {
            var cancelButtonPrompt = "Cancel Table";
         } else {
            cancelButtonPrompt = "Cancel Join";
         }
         //since we're currently only able to join one table, assume this is a match...
         if (joinedTables.length > 0) {
            var metaTags = {
               "tableName": tableName,
               "tableID": tableID,
               "joinedPlayers": joinedPlayers,
               "totalPlayers": totalPlayers,
               "needPlayers": needPlayers,
               "ownerPID": ownerPID,
               "announcedAt": announcedAt.toString(),
               "cancelButtonPrompt": cancelButtonPrompt
            }
            this.updateJoinedTableStatus(metaTags, true);
         }
      } catch (err) {
         this.cypherpoker.debug(err, "err");
      }
   }

   /**
   * Event handler invoked when another player has left a table that we've
   * joined.
   *
   * @param {CypherPoker#event:tablejoinrequest|CypherPoker#event:tablejoin} event a CypherPoker
   * table join related event.
   *
   * @listens CypherPoker#event:tablejoinrequest
   * @listens CypherPoker#event:tablejoin
   */
   onPlayerLeaveTable(event) {
      try {
         var tableData = event.table;
         if (tableData != null) {
            //joined player has left the table
            var joinedPlayers = tableData.joinedPID.length;
            var needPlayers = tableData.requiredPID.length;
            var totalPlayers = joinedPlayers + needPlayers;
            var tableName = tableData.tableName;
            var tableID = tableData.tableID;
            var ownerPID = tableData.ownerPID;
            var announcedAt = new Date(tableData.tableInfo.announcedAt);
            var joinedTables = this.cypherpoker.getJoinedTables(tableName, tableID, ownerPID);
            if (ownerPID == this.cypherpoker.p2p.privateID) {
               var cancelButtonPrompt = "Cancel Table";
            } else {
               cancelButtonPrompt = "Cancel Join";
            }
            //since we're currently only able to join one table, assume this is a match...
            if (joinedTables.length > 0) {
               var metaTags = {
                  "tableName": tableName,
                  "tableID": tableID,
                  "joinedPlayers": joinedPlayers,
                  "totalPlayers": totalPlayers,
                  "needPlayers": needPlayers,
                  "ownerPID": ownerPID,
                  "announcedAt": announcedAt.toString(),
                  "cancelButtonPrompt": cancelButtonPrompt
               }
               this.updateJoinedTableStatus(metaTags, true);
               this.showDialog("A player has left the table.");
               this.hideDialog(5000);
            } else {
               //owner/creator has left the table
               this.updateJoinedTableStatus(null, false);
               var lobbyContainer = document.querySelector(ui.UISelectors.lobby);
               this.show(lobbyContainer);
               this.resetLobbyUI(true);
               this.lobbyActive = true;
               this.cypherpoker.captureNewTables = true;
               this.startLobbyCull();
               this.showDialog("Table owner has cancelled the table.");
               this.hideDialog(5000);
            }
         }
      } catch (err) {
         this.cypherpoker.debug(err, "err");
      }
   }

   /**
   * Updates the "joinedTableStatus" HTML template's metatags and visibility.
   *
   * @param {Object} metaData The template's metatags to parse.
   * @param {Boolean} [showStatus=true] If true, any existing template clone is removed, the
   * original template is cloned, metatags parsed, and the clone appended to
   * the target location specified for the source HTML template. If false,
   * any existing template clone is simply removed.
   */
   updateJoinedTableStatus(metaData, showStatus=true) {
      var templateInfo = this.getTemplateByName("joinedTableStatus");
      var containerElement = document.querySelector(templateInfo.target);
      if (showStatus == true) {
         var clone = this.buildHTMLTemplate(templateInfo, metaData);
         this.show(clone);
         this.show(containerElement);
      } else {
         containerElement.innerHTML = "";
         this.hide(containerElement);
      }
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
         case "manage_copy_account":
            var helpElement = element.querySelector("#manage_copy_account");
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
         case "create_table_timeout":
            var helpElement = element.querySelector("#create_table_timeout");
            this.show(helpElement);
            this.showDialog();
            break;
         case "create_table_button":
            var helpElement = element.querySelector("#create_table_button");
            this.show(helpElement);
            this.showDialog();
            break;
         case "join_table_player_alias":
            var helpElement = element.querySelector("#join_table_player_alias");
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
   * Function invoked when an externally advertised table button is clicked to join it.
   *
   * @param {Event} event A standard DOM button event object.
   *
   * @private
   */
   onJoinTableButtonClick(event) {
      //this event may have been triggered by a child node of the button (is there way better way to deal with this?):
      var target = event.target;
      while (target.ui == undefined) {
         target = target.parentNode;
      }
      var ui = target.ui;
      target.removeEventListener("click", ui.onJoinTableButtonClick);
      var table = target.table;
      var element = ui.getTemplateByName("lobby").elements[0];
      var joinGameElement = element.querySelector("#joinGame");
      var createGameElement = element.querySelector("#createGame");
      var alias = joinGameElement.querySelector("#playerAliasJoin").value;
      if (alias.trim() == "") {
         ui.showDialog ("You must enter a player alias (name) before attempting to join a table.");
         ui.hideDialog(4000);
         return;
      }
      var buyInAmount = table.tableInfo.buyIn;
      if (bigInt(buyInAmount).greater(ui.selectedAccount.balance)) {
         ui.showDialog ("Insufficient account balance for buy-in.<br/>Minimum account balance "+buyInAmount+" required.");
         ui.hideDialog(4000);
         return;
      }
      target.remove(); //remove the button here since the reference is not carried through with the joined table
      ui.cypherpoker.localTableStorage(table).alias = alias;
      var tableName = table.tableName;
      ui.hide(createGameElement);
      ui.hide(joinGameElement);
      delete table.tableInfo.buttonElement; //prevent circular reference error when stringifying
      ui.cypherpoker.addEventListener("tablejoinrequest", ui.onPlayerJoinTable, ui);
      ui.cypherpoker.addEventListener("tablejoin", ui.onPlayerJoinTable, ui);
      ui.cypherpoker.addEventListener("tableleave", ui.onPlayerLeaveTable, ui);
      var metaTags = {
         "tableName": table.tableName,
         "tableID": table.tableID,
         "joinedPlayers": table.joinedPID.length,
         "totalPlayers": table.joinedPID.length + table.requiredPID.length,
         "needPlayers": table.requiredPID.length,
         "ownerPID": table.ownerPID,
         "announcedAt": table.tableInfo.announcedAt.toString(),
         "cancelButtonPrompt": "Cancel Join"
      }
      ui.updateJoinedTableStatus(metaTags, true);
      ui.cypherpoker.removeEventListener("tableready", ui.onTableReady);
      ui.cypherpoker.addEventListener("tableready", ui.onTableReady, ui);
      ui.cypherpoker.joinTable(table).catch (err => {
         ui.showDialog("Table join request has timed out.");
         ui.hideDialog(4000);
         ui.onLobbyButtonClick("cancel_game");
      });
   }

   /**
   * Event listener invoked when a {@link CypherPoker#events:tableready} event
   * is dispatched.
   *
   * @param {Event} event A {@link CypherPoker#events:tableready} event object.
   *
   * @listens CypherPoker#events:tableready
   * @private
   */
   onTableReady(event) {
      this.cypherpoker.removeEventListener("tablejoinrequest", this.onPlayerJoinTable);
      this.cypherpoker.removeEventListener("tablejoin", this.onPlayerJoinTable);
      this.cypherpoker.removeEventListener("tableleave", this.onPlayerLeaveTable);
      this.updateJoinedTableStatus(null, false);
      this.stopLobbyCull();
      this.cypherpoker.captureNewTables = false;
      this._lobbyActive = false;
      var playerInfo = new Object();
      playerInfo.alias = this.cypherpoker.localTableStorage(event.table).alias;
      this.cypherpoker.localTableStorage(event.table, true); //no longer needed
      var game = this.cypherpoker.createGame(event.table, this.selectedAccount, playerInfo).start();
      try {
         game.addEventListener("gamerestart", this.onRestartGame, this);
         game.addEventListener("gamekill", this.onKillGame, this);
         game.contract.addEventListener("timeoutstart", this.onStartContractTimeout, this);
         game.contract.addEventListener("timeout", this.onContractTimeout, this);
         game.contract.addEventListener("timeoutinvalid", this.onContractTimeoutInvalid, this);
      } catch (err) {
         this.showDialog(err);
      }
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
   * Event listener invoked when an associated game dispatches a "gamekill" event.
   *
   * @param {CypherPokerGame#event:gamekill} event A "gamekill" event object.
   *
   * @private
   */
   onKillGame(event) {
      var timeoutElement = event.game.DOMElement.querySelector(ui.gameUISelectors.timeoutAmount);
      this.stopTimeoutTimer(timeoutElement);
      try {
         event.game.removeEventListener("gamerestart", this.onRestartGame, this);
         event.game.removeEventListener("gamekill", this.onKillGame, this);
         event.game.contract.removeEventListener("gamerestart", this.onRestartGame, this);
         event.game.contract.removeEventListener("timeoutstart", this.onStartContractTimeout, this);
         event.game.contract.removeEventListener("timeout", this.onContractTimeout, this);
         event.game.contract.removeEventListener("timeoutinvalid", this.onContractTimeoutInvalid, this);
      } catch (err) {
         console.error(err);
      }
      this.showDialog(event.reason);
      this.hideDialog(6000);
      var lobbyContainer = document.querySelector(ui.UISelectors.lobby);
      this.show(lobbyContainer);
      this.resetLobbyUI(true);
      this.lobbyActive = true;
      this.cypherpoker.captureNewTables = true;
      this.startLobbyCull();
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
      metaTags.tableOwnerPID = tableData.ownerPID;
      //can also use just tableData.restorePID.length as of v0.4.0...
      metaTags.numPlayers = String(tableData.requiredPID.length + tableData.joinedPID.length);
      metaTags.buyInAmount = tableData.tableInfo.buyIn;
      metaTags.bigBlind = tableData.tableInfo.bigBlind;
      metaTags.smallBlind = tableData.tableInfo.smallBlind;
      metaTags.timeout = tableData.tableInfo.timeout;
      var joinTableButton = this.cloneHTMLTemplate(templateInfo, containerElement, false, metaTags);
      joinTableButton.table = this.cypherpoker.announcedTables[0]; //newest table reference
      joinTableButton.ui = this;
      this.cypherpoker.announcedTables[0].tableInfo.buttonElement = joinTableButton;
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
      var newGameElement = this.cloneHTMLTemplate(gameTemplate, target, gameTemplate.hidden, metaData);
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
            var newHistoryElement = this.cloneHTMLTemplate(templateInfo, targetElement, false, metaTags);
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
      if (context.cypherpoker.apiConnected == false) {
         //API connection required in order to update accounts
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
         var minerFeeInput = manageElement.querySelector("#minerFee");
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
         var account = selectedOption.account;
         manageElement.querySelector("#accountBalance").innerHTML =  "updating...";
         loginElement.querySelector("#accountBalance").innerHTML =  "updating...";
         loginElement.querySelector("#accountPassword").value = account.password;
         account.update().then(done => {
            var satoshiAmount = account.balance.toString(10);
            var btcAmount = context.convertDenom(satoshiAmount, "satoshi", "bitcoin");
            manageElement.querySelector("#accountBalance").innerHTML =  satoshiAmount+ " satoshis";
            loginElement.querySelector("#accountBalance").innerHTML =  satoshiAmount+ " satoshis";
            loginElement.querySelector("#accountPassword").value = account.password;
            minerFeeInput.value = account.fees.cashout;
         }).catch(error => {
            manageElement.querySelector("#accountBalance").innerHTML = "unavailable";
            loginElement.querySelector("#accountBalance").innerHTML = "unavailable";
            console.error(error.stack);
         });
         context.show(loginElement);
      }
   }

   /**
   * Clears any entries in the accounts list in the user interface. Note that this
   * function does not affect the [CypherPoker#accounts]{@link CypherPoker#accounts} array.
   *
   */
   clearAccountsUI() {
      var loginElement = this.getTemplateByName("accountLogin").elements[0];
      var accountsList = loginElement.querySelector("#currentAccounts");
      accountsList.innerHTML = "";
   }

   /**
   * Removes all the "join table" buttons and any event listeners currently in the
   * lobby. This function does <b>not</b> update any [CypherPoker.joinedTables]{@link CypherPoker#joinedTables}
   * or [CypherPoker.announcedTables]{@link CypherPoker#announcedTables}.
   *
   * @private
   */
   removeAllJoinTableButtons() {
      for (var count=0; count < this.cypherpoker.announcedTables.length; count++) {
         var currentTable = this.cypherpoker.announcedTables[count];
         var tableInfo = currentTable.tableInfo;
         try {
            tableInfo.buttonElement.removeEventListener("click", this.onJoinTableButtonClick);
            tableInfo.buttonElement.remove();
         } catch (err) {}
      }
   }

   /**
   * Resets all of the user interface elements of the lobby to their initial
   * state, including input fields, announced tables list, etc.
   *
   * @param {Boolean} [showOnReset=true] If true, the interface is displayed
   * after being reset otherwise the elements must be shown manually.
   */
   resetLobbyUI (showOnReset=true) {
      var lobbyElement = this.getTemplateByName("lobby").elements[0];
      var createGameElement = lobbyElement.querySelector("#createGame");
      var joinGameElement = lobbyElement.querySelector("#joinGame");
      var ownGamesElement = lobbyElement.querySelector("#joinedTables");
      ownGamesElement.innerHTML = ""; //clear out any existing message
      //reset table creation fields...
      createGameElement.querySelector("#playerAliasCreate").value = "";
      createGameElement.querySelector("#tableName").value = "";
      createGameElement.querySelector("#numPlayers").value = "";
      createGameElement.querySelector("#buyInAmount").value = "";
      createGameElement.querySelector("#bigBlindAmount").value = "";
      createGameElement.querySelector("#smallBlindAmount").value = "";
      createGameElement.querySelector("#inactivityTimeoutAmount").value = "60";
      //reset table join field(s)...
      joinGameElement.querySelector("#playerAliasJoin").value = "";
      //clear out any tables remaining in UI...
      this.removeAllJoinTableButtons();
      this.cypherpoker.removeAllTables(true, true);
      this.show(createGameElement);
      this.show(joinGameElement);
      this.show(ownGamesElement);
      this.show(lobbyElement);
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
                  whole = amountSplit[0].padEnd((amountSplit[0].length + 8), "0");
                  decimal = "";
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
               if (amount == "") {
                  amount = "0";
               }
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
   * @param {HTMLElement|String} elementRef A reference to the object  or
   * a selector to query the document with.
   */
   disable(elementRef) {
      if (typeof(elementRef) == "string") {
         document.querySelector(elementRef).setAttribute("disabled", true);
      } else {
         elementRef.setAttribute("disabled", true);
      }
   }

   /**
   * Enables a specific HTML element by removing the <code>disabled</code>
   * attribute from it.
   *
   * @param {HTMLElement|String} elementRef A reference to the object  or
   * a selector to query the document with.
   */
   enable(elementRef) {
      if (typeof(elementRef) == "string") {
         document.querySelector(elementRef).removeAttribute("disabled");
      } else {
         elementRef.removeAttribute("disabled");
      }
   }

   /**
   * Hides a specific HTML element by adding a <code>hidden="true"</code>
   * attribute to it.
   *
   * @param {HTMLElement|String} elementRef A reference to the object  or
   * a selector to query the document with.
   */
   hide(elementRef) {
      if (typeof(elementRef) == "string") {
         document.querySelector(elementRef).setAttribute("hidden", true);
      } else {
         elementRef.setAttribute("hidden", true);
      }
   }

   /**
   * Shows a specific HTML element by removing the <code>hidden</code>
   * attribute from it.
   *
   * @param {HTMLElement|String} elementRef A reference to the object  or
   * a selector to query the document with.
   */
   show(elementRef) {
      if (typeof(elementRef) == "string") {
         document.querySelector(elementRef).removeAttribute("hidden");
      } else {
         elementRef.removeAttribute("hidden");
      }
   }

   /**
   * Toggles the visibility of a specific HTML element.
   *
   * @param {HTMLElement|String} elementRef A reference to the object  or
   * a selector to query the document with.
   */
   toggleShow(elementRef) {
      if (this.isHidden(elementRef)) {
         this.show(elementRef);
      } else {
         this.hide(elementRef);
      }
   }

   /**
   * Checks if a specified element is hidden.
   *
   * @param {HTMLElement|String} elementRef A reference to the object  or
   * a selector to query the document with.
   *
   * @return {Boolean} True if the element is hidden, false if it's visible
   */
   isHidden(elementRef) {
      if (typeof(elementRef) == "string") {
         var attr = document.querySelector(elementRef).getAttribute("hidden");
      } else {
         attr = elementRef.getAttribute("hidden");
      }

      if ((attr == null) || ((attr == ""))) {
         return (false);
      } else {
         return (true);
      }
   }

   /**
   * Hides the main dialog, as defined in [UISelectors]{@link CypherPokerUI#UISelectors}<code>.dialog</code>,
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
