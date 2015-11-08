var express = require('express');
var Q = require('q');

var helpers = require('../lib/helpers');
var oauth = require('../lib/oauth');

var router = express.Router();

router.parseOAuthHeader = function(req, res, next) {
  var oauthHeader = req.header('Authorization');
  if (!oauthHeader) {
    return res.sendStatus(403);
  }
  req.oauthHeader = oauth.parseOAuthHeader(oauthHeader);
  return next();
};

router.verifyOAuthSecret = function(req, res, next) {
  if (!req.oauthHeader.signature || !req.oauthHeader.token) {
    return res.sendStatus(403);
  }

  oauth.verifyOAuthSignature(req.oauthHeader.token, req.oauthHeader.signature)
  .then(function(isValid) {
    if (isValid) {
      return next();
    } else {
      return res.sendStatus(403);
    }
  },
  function(err) {
    res.sendStatus(400);
  });
};

router.issueRequestToken = function(req, res) {
  oauth.issueRequestToken().then(function(requestToken) {
    var response = [];
    response.push('oauth_token_secret=' + requestToken.secret);
    response.push('oauth_token=' + requestToken.token);
    res.send(response.join('&'));
  })
  .catch(function(err) {
    console.log(err, err.stack);
    res.sendStatus(500);
  });
};

router.authorize = function(req, res) {
  oauth.authorizeRequestToken(req.query.oauth_token, true)
  .then(function() {
    return res.sendStatus(200);
  },
  function(err) {
    return res.sendStatus(400);
  })
  .catch(function(err) {
    throw err;
  });
};

router.getAccessToken = function(req, res) {
  var response = [];
  oauth.getAccessToken(req.oauthHeader.token)
  .then(function(accessToken) {
    response.push('oauth_token_secret=' + accessToken.secret);
    response.push('oauth_token=' + accessToken.token);
    response.push('uid=' + helpers.getUserId(accessToken.token));
    return helpers.createUserPaths(accessToken.token);
  })
  .then(function() {
    res.send(response.join('&'));
  })
  .catch(function(err) {
    console.log(err, err.stack);
    res.sendStatus(403);
  });
};

router.post('/request_token', router.issueRequestToken);
router.get('/authorize', router.authorize);
router.post('/access_token',
  router.parseOAuthHeader,
  router.verifyOAuthSecret,
  router.getAccessToken
);

module.exports = router;
