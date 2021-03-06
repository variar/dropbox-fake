require('dotenv').load();
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

var Q = require('q');
var test = require('./test_sequence');

var httpsPort = process.env.PORT_S || 3000;
var httpsServerUrl = 'https://localhost:' + httpsPort;

var spawn = require('child_process').spawn;
var server = spawn('node', ['./bin/www']);

var exitCode = 0;

console.log('Waiting 5 secons for server to be ready');
Q.delay(5000).then(function() {
  test.runTestSequence(httpsServerUrl)
  .catch(function(err) {
    console.log('Http test failed', err);
    exitCode = 1;
  })
  .finally(function() {
    console.log('Killing sever');
    server.kill();
    process.exit(exitCode);
  });
});
