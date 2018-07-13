/**
* @api A simple response to "Hello".
*
* <b>Note that the entry function MUST be the same as the filename and the
* RPC method (all three must match).</b>
*/
function Hello (sessionObj) {
  sendResult(", World!", sessionObj);
}
