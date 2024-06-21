console.log("changes");

function scoper() {
   let element = document.getElementById("lobby");
   //this.lobbyActive = true;
   //this.show(element);
   // remove hidden="true" from lobby inner div
   console.log(element);
   element.children[0].removeAttribute("hidden");
}
setTimeout(scoper, 4000);
