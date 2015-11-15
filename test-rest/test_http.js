require('dotenv').load();
var Q = require('q');

var test = require('./test_sequence');

var httpPort = process.env.PORT || 3000;
var httpServerUrl = 'http://localhost:' + httpPort;

var spawn = require('child_process').spawn;
var server = spawn('node', ['./bin/www']);

var exitCode = 0;

console.log('Waiting 5 secons for server to be ready');
Q.delay(5000).then(function() {
  test.runTestSequence(httpServerUrl)
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
