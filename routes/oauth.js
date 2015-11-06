var express = require('express');
var Q = require('q');

var paths = require('../paths');
var user = require('../user');

var database = require('../database');

var router = express.Router();

router.parseOAuthHeader = function(req, res, next) {
  var oauth = req.header('Authorization');
  console.log('OAuth: ' + oauth);

  if (!oauth) {
    return res.sendStatus(403);
  }

  var oauth = oauth.replace(/OAuth/, '');
  var oauth = oauth.replace(/\s/g, '');
  var oauth = oauth.replace(/\"/g, '');

  var parts = oauth.split(',');
  parts.forEach(function(part) {
    var keyValue = part.split('=');
    if (keyValue[0] == 'oauth_token') {
      req.oauthToken = keyValue[1];
    } else if (keyValue[0] == 'oauth_signature') {
      req.oauthSignature = keyValue[1];
    }
  });

  return next();
};

router.verifyOAuthSecret = function(req, res, next) {
  if (!req.oauthSignature || !req.oauthToken) {
    return res.sendStatus(403);
  }

  var signatureParts = req.oauthSignature.split('&');

  var consumerSecret = signatureParts[0];
  var tokenSecret = signatureParts[1];

  database.getToken(req.oauthToken).then(function(storedToken) {
    if (!storedToken) {
      console.log('Unoknown token', req.oauthToken);
      return res.sendStatus(403);
    }

    if (storedToken.secret != tokenSecret) {
      console.log('Invalid signature ', req.oauthSignature, storedToken.secret);
      return res.sendStatus(403);
    }

    return next();
  });
};

router.all('/request_token', function(req, res, next) {
  var token = database.generateToken();
  database.addToken(token).then(function(token) {
    res.send('oauth_token_secret=' + token.secret + '&oauth_token=' + token.token);
  });
});

router.get('/authorize', function(req, res, next) {
  database.getToken(req.query.oauth_token).then(function(requestToken) {
    if (!requestToken) {
      res.sendStatus(403);
    } else {
      res.sendStatus(200);
    }
  });
});

router.all('/access_token',
  router.parseOAuthHeader,
  router.verifyOAuthSecret,
  function(req, res, next) {
    database.getToken(req.oauthToken).then(function(requestToken) {
      if (!requestToken) {
        return res.sendStatus(403);
      }

      var accessToken = database.generateToken();
      var uid = user.getUserId(accessToken.token);

      paths.createUserPaths(accessToken.token, function(err) {
        if (err) {
          res.status(500).send(err.stack);
        } else {
          var promicies = [];
          promicies.push(database.addToken(accessToken));
          promicies.push(database.removeToken(requestToken));
          Q.all(promicies).then(function() {
              res.send('oauth_token_secret=' + accessToken.secret  + '&oauth_token=' + accessToken.token + '&uid='+uid);
          });
        }
      });
    });
  });

module.exports = router;
