require('dotenv').load();
var test = require('./test_sequence');

var httpPort = process.env.PORT || 3000;
var httpServerUrl = 'http://localhost:' + httpPort;

test.runTestSequence(httpServerUrl)
.catch(function(err) {
  console.log('Http test failed', err);
});
