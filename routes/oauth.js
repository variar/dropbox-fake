var express = require('express');
var router = express.Router();

var crc = require('crc');
var uuid = require('uuid');
var randomstring = require('randomstring');
var paths = require('../paths');
var user = require('../user');

/* GET home page. */
router.all('/request_token', function(req, res, next) {
  var secret = randomstring.generate(12);
  var tempToken = randomstring.generate(12);
  res.send('oauth_token_secret=' + secret  + '&oauth_token=' + tempToken);
});

router.get('/authorize', function(req, res, next) {
  res.sendStatus(200);
});

router.all('/access_token', function(req, res, next) {
  var token = uuid().replace(/\-/g,'');
  var uid = user.getUserId(token);
  paths.createUserPaths(token, function(err) {
    if (err) {
      res.status(500).send(err.stack);
    } else {
      res.send('oauth_token_secret=' + token  + '&oauth_token=' + token + '&uid='+uid);
    }
  });
});

module.exports = router;
