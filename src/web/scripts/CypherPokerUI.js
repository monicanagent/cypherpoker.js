/**
* @file Basic user interface management for CypherPoker.JS.
*
* @version 0.2.0
* @author Patrick Bay
* @copyright MIT License
*/

/**
* @class Basic user interface management for CypherPoker.JS
*/
class CypherPokerUI {

   //TODO: Externalize this data to a JSON file or something similar so that we don't have to manage
   //all of these selectors here in the class header.

   /**
   * @property {Object} UISelectors Name/value pairs for general UI elements and their
   * associated CSS-style DOM selectors.
   * @property {String} UISelectors.dialog="#mainDialog" The main or primary dialog element.
   * @property {String} UISelectors.accounts="#accounts" The main accounts container element.
   * @property {String} UISelectors.accountLoginForm="#accounts>#loginForm" The main account login container element.
   * @property {String} UISelectors.accountManageForm="#accounts>#manageForm" The main account management container element.
   * @property {String} UISelectors.accountCreateForm="#accounts>#createAccountForm" The main account creation container element.
   * @property {String} UISelectors.lobby="#lobby" The main lobby container element.
   */
   get UISelectors() {
      return({
         "dialog":"#mainDialog",
         "accounts":"#accounts",
         "accountLoginForm": "#accounts > #loginForm",
         "accountManageForm": "#accounts > #manageForm",
         "accountCreateForm": "#accounts > #createAccountForm",
         "lobby":"#lobby"
      });
   }

   /**
   * @property {Object} accountsUISelectors Name/value pairs for accounts UI elements and their
   * associated CSS-style DOM selectors. Note that these are direct selectors combining selectors from
   * {@link CypherPokerUI#UISelectors}<code>.accountLoginForm</code> and {@link CypherPokerUI#UISelectors}<code>.accountCreateForm</code>.
   * @property {String} accountsUISelectors.currentAccounts="#currentAccounts" The element containing a list of existing / current accounts in the login form.
   * @property {String} accountsUISelectors.accountBalance="#accountBalance" The element containing the balance of the currently-selected account.
   * @property {String} accountsUISelectors.cashoutButton="#cashoutButton" The account "cash out" button.
   * @property {String} accountsUISelectors.cashoutAmount="#cashoutAmount" The "cash out" amount input field.
   * @property {String} accountsUISelectors.cashoutAddress="#cashoutAddress" The cash out address input field.
   * @property {String} accountsUISelectors.transferButton="#transferButton" The account "transfer" button.
   * @property {String} accountsUISelectors.transferAmount="#transferAmount" The "transfer" amount input field.
   * @property {String} accountsUISelectors.transferAccount="#transferAccount" The transfer account input field.
   * @property {String} accountsUISelectors.accountPassword="#accountPassword" The login form password input field to use with the currently selected account.
   * @property {String} accountsUISelectors.useAccountButton="#useAccountButton" The login form  "use account" button.
   * @property {String} accountsUISelectors.createAccountButton="#createAccountButton" The login form  "create account" button.
   * @property {String} accountsUISelectors.newAccountButton="#newAccountButton" The new account form's new account button.
   * @property {String} accountsUISelectors.newAccountType="#newAccountType" The new account form's new account type selection element.
   * @property {String} accountsUISelectors.newAccountPassword="#newAccountPassword" The new account form's new account password input element.
   */
   get accountsUISelectors() {
      return({
         "currentAccounts":this.UISelectors.accountLoginForm + " > #currentAccounts",
         "accountBalance":this.UISelectors.accountManageForm + " > #accountBalance",
         "cashoutButton":this.UISelectors.accountManageForm + " > #cashoutButton",
         "cashoutAmount":this.UISelectors.accountManageForm + " > #cashoutAmount",
         "cashoutAddress":this.UISelectors.accountManageForm + " > #cashoutAddress",
         "transferButton":this.UISelectors.accountManageForm + " > #transferButton",
         "transferAmount":this.UISelectors.accountManageForm + " > #transferAmount",
         "transferAccount":this.UISelectors.accountManageForm + " > #transferAccount",
         "accountPassword":this.UISelectors.accountLoginForm + " > #accountPassword",
         "useAccountButton":this.UISelectors.accountLoginForm + " > #useAccountButton",
         "createAccountButton":this.UISelectors.accountLoginForm + " > #createAccountButton",
         "newAccountButton":this.UISelectors.accountCreateForm + " > #newAccountButton",
         "newAccountType":this.UISelectors.accountCreateForm + " > #newAccountType",
         "newAccountPassword":this.UISelectors.accountCreateForm + "  > #newAccountPassword"
      });
   }

   /**
   * @property {Object} lobbyUISelectors Name/value pairs for lobby UI elements and their
   * associated CSS-style DOM selectors. Note that these selectors are relative to/children of the
   * main lobby element defined in {@link CypherPokerUI#UISelectors}<code>.lobby</code>.
   * @property {String} lobbyUISelectors.createGameButton="#createGameForm>#createGameButton" The lobby's create game button.
   * @property {String} lobbyUISelectors.createPlayerAlias="#createGameForm>#playerAlias" The player alias field in the create table form.
   * @property {String} lobbyUISelectors.createTableName="#createGameForm>#tableName" The table name field in the create table form.
   * @property {String} lobbyUISelectors.createNumPlayers="#createGameForm>#numPlayers" The number of players field for the new table in the create table form.
   * @property {String} lobbyUISelectors.createBigBlind="#createGameForm>#bigBlindAmount" The big blind amount field for the new table in the create table form.
   * @property {String} lobbyUISelectors.createSmallBlind="#createGameForm>#smallBlindAmount" The big blind amount field for the new table in the create table form.
   * @property {String} lobbyUISelectors.inactivityTimeout="#createGameForm>#inactivityTimeoutAmount" The inactivity timeout amount (in seconds) field for the new table in the create table form.
   * @property {String} lobbyUISelectors.tableList="#tableList" The lobby's announced table list.
   */
   get lobbyUISelectors() {
      return({
         "createGameButton":"#createGameForm > #createGameButton",
         "createPlayerAlias":"#createGameForm > #playerAlias",
         "createTableName":"#createGameForm > #tableName",
         "createNumPlayers":"#createGameForm > #numPlayers",
         "createBuyIn":"#createGameForm > #buyInAmount",
         "createBigBlind":"#createGameForm > #bigBlindAmount",
         "createSmallBlind":"#createGameForm > #smallBlindAmount",
         "inactivityTimeout":"#createGameForm > #inactivityTimeoutAmount",
         "tableList":"#tableList"
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
      this.addLobbyUIHandlers(document.querySelector(this.UISelectors.lobby));
      this.addAccountsUIHandlers(document.querySelector(this.UISelectors.accounts));
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
   * Adds lobby event listeners and callbacks to user interface elements defined in
   * {@link CypherPokerUI#lobbyUISelectors}.
   *
   * @param {HTMLElement} lobbyElement The lobby element to which to add handlers to.
   */
   addLobbyUIHandlers(lobbyElement) {
      for (var item in this.lobbyUISelectors) {
         try {
            let element = lobbyElement.querySelector(this.lobbyUISelectors[item]);
            element.ui = this;
         } catch (err) {
         }
      }
      var createGameButton = lobbyElement.querySelector(this.lobbyUISelectors.createGameButton);
      createGameButton.addEventListener("click", this.onCreateGameButtonClick);
   }

   /**
   * Adds accounts event listeners and callbacks to user interface elements defined in
   * {@link CypherPokerUI#accountsUISelectors}.
   *
   */
   addAccountsUIHandlers() {
      for (var item in this.accountsUISelectors) {
         try {
            let element = document.querySelector(this.accountsUISelectors[item]);
            element.ui = this;
         } catch (err) {
         }
      }
      //note that these are all direct selectors
      var accountSelect = document.querySelector(this.accountsUISelectors.currentAccounts);
      var cashoutButton = document.querySelector(this.accountsUISelectors.cashoutButton);
      var transferButton = document.querySelector(this.accountsUISelectors.transferButton);
      var newAccountButton = document.querySelector(this.accountsUISelectors.newAccountButton);
      var useAccountButton = document.querySelector(this.accountsUISelectors.useAccountButton);
      var createAccountButton = document.querySelector(this.accountsUISelectors.createAccountButton);
      accountSelect.addEventListener("change", this.onSelectAccount)
      cashoutButton.addEventListener("click", this.onCashoutButtonClick)
      transferButton.addEventListener("click", this.onTransferButtonClick)
      useAccountButton.addEventListener("click", this.onUseAccountButtonClick);
      newAccountButton.addEventListener("click", this.onNewAccountButtonClick);
      createAccountButton.addEventListener("click", this.onCreateAccountButtonClick);
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
   * Event handler invoked when the "Create Account" button is clicked in the accounts
   * div. This function hides the login form and displays the new account form.
   *
   * @param {Event} event A standard DOM button click event.
   * @private
   */
   onCreateAccountButtonClick(event) {
      var ui = event.target.ui;
      ui.hide(document.querySelector(ui.UISelectors.accountLoginForm));
      ui.show(document.querySelector(ui.UISelectors.accountCreateForm));
   }

   /**
   * Event handler invoked when the "Create Account" button is clicked in the DOM.
   *
   * @param {Event} event A standard DOM button click event.
   * @private
   */
   onNewAccountButtonClick(event) {
      var ui = event.target.ui;
      var accountTypeSelect = document.querySelector(ui.accountsUISelectors.newAccountType);
      var accountType = accountTypeSelect.options[accountTypeSelect.selectedIndex].value;
      var password = document.querySelector(ui.accountsUISelectors.newAccountPassword).value;
      var typeSplit = accountType.split("/");
      ui.cypherpoker.createAccount(typeSplit[0], password, typeSplit[1]).then(newAccount => {
         var newOptionElement = document.createElement("option");
         var optionValue = newAccount.address + ":" + newAccount.type + "/" + newAccount.network;
         newOptionElement.setAttribute("value", optionValue);
         newOptionElement.innerHTML = newAccount.address + " ("+newAccount.type+" / "+newAccount.network+")";
         newOptionElement.account = newAccount;
         var currentAccounts = document.querySelector(ui.accountsUISelectors.currentAccounts);
         currentAccounts.appendChild(newOptionElement);
         currentAccounts.value = optionValue; //set new item as current selection
         document.querySelector(ui.accountsUISelectors.accountPassword).value = newAccount.password; //set password for account
         ui.showDialog("Account created: "+newAccount.address);
         ui.hideDialog(4000);
         ui.show(document.querySelector(ui.UISelectors.accountLoginForm));
         ui.hide(document.querySelector(ui.UISelectors.accountCreateForm));
      }).catch(error => {
         ui.showDialog(error);
      });
   }

   /**
   * Event handler invoked when the "Use Account" button is clicked in the accounts
   * div. This function logs the player in using the currently selected account
   * ({@link CypherPokerUI#accountsUISelector}<code>.currentAccounts</code>), and
   * password ({@link CypherPokerUI#accountsUISelector}<code>.accountPassoword</code>)
   *
   * @param {Event} event A standard DOM button click event.
   * @private
   */
   onUseAccountButtonClick(event) {
      var ui = event.target.ui;
      var password = document.querySelector(ui.accountsUISelectors.accountPassword).value;
      var accountsList = document.querySelector(ui.accountsUISelectors.currentAccounts);
      if (accountsList.length == 0) {
         ui.showDialog("No accounts available.");
         ui.hideDialog(3000);
         return;
      }
      if (password == "") {
         ui.showDialog("Password can't be empty.");
         ui.hideDialog(3000);
         return;
      }
      var selectedOption = accountsList.options[accountsList.selectedIndex];
      var useAccount = selectedOption.account;
      if (useAccount.balance.equals(0)) {
         ui.showDialog("Account has 0 balance.");
         ui.hideDialog(3000);
         return;
      }
      ui.selectedAccount = useAccount;
      ui.hide(document.querySelector(ui.UISelectors.accounts));
      ui.show(document.querySelector(ui.UISelectors.lobby));
   }

   /**
   * Event handler invoked when the "Cash Out" button is clicked in the accounts
   * div.
   *
   * @param {Event} event A standard DOM button click event.
   * @private
   */
   onCashoutButtonClick(event) {
      var ui = event.target.ui;
      var cashoutAddress = document.querySelector(ui.accountsUISelectors.cashoutAddress).value;
      var cashoutAmount = document.querySelector(ui.accountsUISelectors.cashoutAmount).value;
      var selectElement = document.querySelector(ui.accountsUISelectors.currentAccounts);
      var selectedOption = selectElement.options[selectElement.selectedIndex];
      var selectedAccount = selectedOption.account;
      if (cashoutAmount.split(" ").join("") == "") {
         ui.showDialog("Enter an amount to cash out.");
         ui.hideDialog(3000);
         return;
      } else {
         try {
            cashoutAmount = bigInt(cashoutAmount);
         } catch (err) {
            ui.showDialog("Invalid cashout amount. Must be in satoshis.");
            ui.hideDialog(3000);
            return;
         }
      }
      if (cashoutAmount.equals(0)) {
         ui.showDialog("Cashout amount must be greater than 0.");
         ui.hideDialog(3000);
         return;
      }
      if (cashoutAddress.length == 0) {
         ui.showDialog("Enter a valid address.");
         ui.hideDialog(3000);
         return;
      }
      var minerFees = null; //use default for now
      selectedAccount.cashout(cashoutAmount, cashoutAddress, minerFees).then(done => {
         var satoshiAmount = selectedAccount.balance.toString(10);
         var btcAmount = ui.convertDenom(satoshiAmount, "satoshi", "bitcoin");
         //document.querySelector(ui.accountsUISelectors.accountBalance).innerHTML =  btcAmount+ " BTC";
         document.querySelector(ui.accountsUISelectors.accountBalance).innerHTML =  satoshiAmount+ " satoshis";
      }).catch(error => {
         ui.showDialog(error);
         ui.hideDialog(3000);
         console.error(error);
      });
   }

   /**
   * Event handler invoked when the "Transfer" button is clicked in the accounts
   * div.
   *
   * @param {Event} event A standard DOM button click event.
   * @private
   */
   onTransferButtonClick(event) {
      var ui = event.target.ui;
      var transferAccount = document.querySelector(ui.accountsUISelectors.transferAccount).value;
      var transferAmount = document.querySelector(ui.accountsUISelectors.transferAmount).value;
      var selectElement = document.querySelector(ui.accountsUISelectors.currentAccounts);
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
            ui.showDialog("Invalid transfer amount. Must be in satoshis.");
            ui.hideDialog(3000);
            return;
         }
      }
      if (transferAmount.equals(0)) {
         ui.showDialog("Transfer amount must be greater than 0.");
         ui.hideDialog(3000);
         return;
      }
      if (transferAccount.length == 0) {
         ui.showDialog("Enter a valid address.");
         ui.hideDialog(3000);
         return;
      }
      selectedAccount.transfer(transferAmount, transferAccount).then(done => {
         var satoshiAmount = selectedAccount.balance.toString(10);
         var btcAmount = ui.convertDenom(satoshiAmount, "satoshi", "bitcoin");
         //document.querySelector(ui.accountsUISelectors.accountBalance).innerHTML =  btcAmount+ " BTC";
         document.querySelector(ui.accountsUISelectors.accountBalance).innerHTML =  satoshiAmount+ " satoshis";
      }).catch(error => {
         console.error(error);
         ui.showDialog(error);
         ui.hideDialog(3000);
      });
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
   * Event handler invoked when the "Create Game" button is clicked in the DOM.
   *
   * @param {Event} event A standard DOM button click event.
   *
   * @private
   */
   onCreateGameButtonClick(event) {
      var ui = event.target.ui; //this CypherPokerUI instance
      ui.disable (event.target);
      var tableInfo = new Object();
      var lobbyElement = document.querySelector(ui.UISelectors.lobby);
      var alias = lobbyElement.querySelector(ui.lobbyUISelectors.createPlayerAlias).value;
      var tableName = lobbyElement.querySelector(ui.lobbyUISelectors.createTableName).value;
      var numPlayers = Number(lobbyElement.querySelector(ui.lobbyUISelectors.createNumPlayers).value);
      numPlayers--; //exclude self
      var buyInAmount = lobbyElement.querySelector(ui.lobbyUISelectors.createBuyIn).value;
      var bigBlindAmount = lobbyElement.querySelector(ui.lobbyUISelectors.createBigBlind).value;
      var smallBlindAmount = lobbyElement.querySelector(ui.lobbyUISelectors.createSmallBlind).value;
      tableInfo.buyIn = buyInAmount;
      tableInfo.bigBlind = bigBlindAmount;
      tableInfo.smallBlind = smallBlindAmount;
      ui.cypherpoker.createTable(tableName, numPlayers, tableInfo);
      ui.cypherpoker.onEventPromise("tableready").then(event =>{
         var playerInfo = new Object();
         playerInfo.alias = alias;
         var game = ui.cypherpoker.createGame(event.table, ui.selectedAccount, playerInfo).start();
         try {
            game.addEventListener("gamerestart", ui.onRestartGame, ui);
            game.contract.addEventListener("timeoutstart", ui.onStartContractTimeout, ui);
            game.contract.addEventListener("timeout", ui.onContractTimeout, ui);
            game.contract.addEventListener("timeoutinvalid", ui.onContractTimeoutInvalid, ui);
         } catch (err) {
            //game may not have contract
         }
      })
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
         this.showDialog(error);
         this.hideDialog(4000);
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
         game.placeBet(betAmount.value);
      } catch (err) {
         //probably wrong bet amount
         ui.enable(event.target);
      }
      game.DOMElement.querySelector(ui.gameUISelectors.potAmount).innerHTML = game.pot.toString(10);
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
         event.game.contract.removeEventListener("gamerestart", this.onRestartGame);
         event.game.contract.removeEventListener("timeoutstart", this.onStartContractTimeout);
         event.game.contract.removeEventListener("timeout", this.onContractTimeout);
         event.game.contract.removeEventListener("timeoutinvalid", this.onContractTimeoutInvalid);
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
      var timeoutNotification = "The following player(s) have timed out:<br/>";
      for (var count = 0; count < event.penalized.length; count++) {
         var timedOutPlayer = event.contract.game.getPlayer(event.penalized[count].privateID);
         event.contract.game.debug ("Player has timed out: "+timedOutPlayer.account.address, "err");
         timeoutNotification += timedOutPlayer.info.alias + " ("+timedOutPlayer.account.address+")<br/>";
      }
      this.showDialog(timeoutNotification);
      this.hideDialog(10000);
      var timeoutElement = event.contract.game.DOMElement.querySelector(ui.gameUISelectors.timeoutAmount);
      this.stopTimeoutTimer(timeoutElement);
      try {
         event.contract.removeEventListener("gamerestart", this.onRestartGame);
         event.contract.removeEventListener("timeoutstart", this.onStartContractTimeout);
         event.contract.removeEventListener("timeout", this.onContractTimeout);
         event.contract.removeEventListener("timeoutinvalid", this.onContractTimeoutInvalid);
      } catch (err) {
         console.error(err);
      }
      try {
         event.contract.game.analyzer.deactivate();
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
      var newTableButton = document.createElement("button");
      newTableButton.setAttribute("class", "joinTableButton");
      var buttonDescriptionHTML = "<span class=\"tableName\">"+tableData.tableName+"</span><br/>"
      buttonDescriptionHTML += "<span class=\"numPlayers\"><small>Number of players: "+(tableData.requiredPID.length+1)+"</small></span><br/>";
      buttonDescriptionHTML += "<span class=\"bigBlindAmount\"><small>Big blind: "+tableData.tableInfo.bigBlind+"</small></span><br/>";
      buttonDescriptionHTML += "<span class=\"smallBlindAmount\"><small>Small blind: "+tableData.tableInfo.smallBlind+"</small></span>";
      newTableButton.innerHTML = buttonDescriptionHTML;
      var containerElement = document.querySelector(this.lobbyUISelectors.tableList);
      var joinTableButton = containerElement.appendChild(newTableButton);
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
      var newGameElement = this._protoGameElement.insertAdjacentElement("beforebegin", this._protoGameElement.cloneNode(true));
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
      game.DOMElement.querySelector(this.gameUISelectors.potAmount).innerHTML = game.pot.toString();
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
      game.DOMElement.querySelector(this.gameUISelectors.potAmount).innerHTML = game.pot.toString();
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
         var historyHTML = document.createElement("div");
         historyHTML.setAttribute("class", "handHistoryItemContainer");
         var headerElement = document.createElement("span");
         headerElement.setAttribute("class", "handHistoryItemHeader");
         if (winningHands.length > 1) {
            headerElement.innerHTML = "Best Hands<br/>";
         } else {
            headerElement.innerHTML = "Best Hand<br/>";
         }
         for (var count = 0; count < winningHands.length; count++) {
            var winningHand = winningHands[count];
            var winningPlayer = winningPlayers[count];
            var hand = winningHand.hand;
            headerElement.innerHTML += "<span class=\"historyHandName\">"+winningHand.name+"</span><br/>";
            if (winningPlayer.privateID == event.game.ownPID) {
               headerElement.innerHTML += "<span class=\"historyHandOwner\">Ours</span><br/>";
            } else {
               headerElement.innerHTML += "<span class=\"historyHandOwner\">Player: "+winningPlayer.privateID+"</span><br/>";
            }
            var cardContainerElement = document.createElement("div");
            cardContainerElement.setAttribute("class", "handHistoryItemCards");
            for (var count2 = 0; count2 < hand.length; count2++) {
               var card = hand[count2];
               card.addToDOM(cardContainerElement, "historyCard");
            }
         }
         historyHTML.appendChild(headerElement);
         historyHTML.appendChild(cardContainerElement);
         var targetElement = event.game.DOMElement.querySelector(this.gameUISelectors.handHistory);
         targetElement.appendChild(historyHTML);
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
      totalBetDiv.innerHTML = totalBetAmount;
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
   * @private
   */
   updateAccountsUI() {
      if (this.cypherpoker.accounts.length == 0) {
         return;
      }
      var accountsList = document.querySelector(this.accountsUISelectors.currentAccounts);
      for (var count=0; count < this.cypherpoker.accounts.length; count++) {
         var currentAccount = this.cypherpoker.accounts[count];
         var newOptionElement = document.createElement("option");
         var optionValue = currentAccount.address + ":" + currentAccount.type + "/" + currentAccount.network;
         newOptionElement.setAttribute("value", optionValue);
         newOptionElement.innerHTML = currentAccount.address + " ("+currentAccount.type+" / "+currentAccount.network+")";
         newOptionElement.account = currentAccount;
         accountsList.appendChild(newOptionElement);
      }
      var selectElement = document.querySelector(this.accountsUISelectors.currentAccounts);
      var selectedOption = selectElement.options[0];
      var selectedAccount = selectedOption.account;
      document.querySelector(this.accountsUISelectors.accountPassword).value = selectedAccount.password;
      selectedAccount.update().then(done => {
         var satoshiAmount = selectedAccount.balance.toString(10);
         var btcAmount = this.convertDenom(satoshiAmount, "satoshi", "bitcoin");
         //document.querySelector(this.accountsUISelectors.accountBalance).innerHTML =  btcAmount+ " BTC";
         document.querySelector(this.accountsUISelectors.accountBalance).innerHTML =  satoshiAmount+ " satoshis";
      }).catch(error => {
         document.querySelector(this.accountsUISelectors.accountBalance).innerHTML =  "? BTC";
         console.error(error.stack);
      });
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
         setTimeout(this.hideDialog, delay, 0, this);
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
   * Displays the main dialog with specified contents
   *
   * @param {String} content The HTML contents to display in the dialog.
   */
   showDialog(contents) {
      var dialog = document.querySelector(this.UISelectors.dialog);
      dialog.setAttribute("open", true);
      dialog.innerHTML = contents;
   }

   /**
   * Creates a <code>console</code>-based.
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
