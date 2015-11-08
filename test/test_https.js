require('dotenv').load();
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

var test = require('./test_sequence');

var httpsPort = process.env.PORT_S || 3000;
var httpsServerUrl = 'https://localhost:' + httpsPort;

test.runTestSequence(httpsServerUrl)
.catch(function(err) {
  console.log('Https test failed', err);
});
