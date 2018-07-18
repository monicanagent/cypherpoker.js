/**
* @file API example of a simple response to "Hello".
*
* @example
* Client Request -> {"jsonrpc":"2.0","method":"Hello","id":"0","params":{}}
* Server Response -> {"jsonrpc":"2.0","result":{", World!"},"id":"0"}
*
*/
async function Hello (sessionObj) {
  sendResult(", World!", sessionObj);
}
