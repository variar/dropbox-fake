require('dotenv').load();
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

var Q = require('q');
var test = require('./test_sequence');

var httpPort = process.env.PORT || 3000;
var httpServerUrl = 'http://localhost:' + httpPort;

var httpsPort = process.env.PORT_S || 3000;
var httpsServerUrl = 'https://localhost:' + httpsPort;

test.runTestSequence(httpsServerUrl)
.then(
  function() {
    return test.runTestSequence(httpsServerUrl);
  },
  function(err) {
    console.log('Http test failed', err);
  }
)
.catch(function(err) {
  console.log('Https test failed', err);
});
