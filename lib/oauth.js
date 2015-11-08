var Q = require('q');
var uuid = require('uuid');
var randomstring = require('randomstring');

var database = require('./database');

var generateToken = function() {
  return {
    token: uuid().replace(/\-/g,''),
    secret: randomstring.generate(12),
  };
};

module.exports.parseOAuthHeader = function(header) {
  var oauth = header.replace(/(OAuth|\s|\")/g, '');
  var parts = oauth.split(',');

  oauthHeader = {};

  parts.forEach(function(part) {
    var keyValue = part.split('=');
    if (keyValue[0] == 'oauth_token') {
      oauthHeader.token = keyValue[1];
    } else if (keyValue[0] == 'oauth_signature') {
      oauthHeader.signature = keyValue[1];
    }
  });

  return oauthHeader;
};

module.exports.verifyOAuthSignature = function(tokenKey, oauthSignature) {
  var signatureParts = oauthSignature.split('&');
  var consumerSecret = signatureParts[0];
  var tokenSecret = signatureParts[1];

  return database.getToken(tokenKey).then(function(storedToken) {
    if (!storedToken) {
      return Q.reject(new Error('Invalid token', tokenKey));
    }
    if (storedToken.secret != tokenSecret) {
      console.log('Invalid signature ', oauthSignature, storedToken.secret);
      return Q.resolve(false);
    }

    return Q.resolve(true);
  });
};

module.exports.issueRequestToken = function() {
  var token = generateToken();
  return database.insertToken(token);
};

module.exports.authorizeRequestToken = function(requestToken, authorize) {
  console.log('authorizeRequestToken', requestToken, authorize);
  return database.getToken(requestToken)
  .then(function(token) {
    if (!token) {
      return Q.reject(new Error('Request token not found', requestToken));
    }

    if (authorize) {
      token.authorized = true;
      return database.updateToken(token);
    } else {
      return database.removeToken(token);
    }
  });
};

module.exports.getAccessToken = function(requestToken) {
  return database.getToken(requestToken).then(function(token) {
    if (!token) {
      return Q.reject(new Error('Request token not found', requestToken));
    }
    if (token.authorized) {
      var promises = [];
      promises.push(database.removeToken(token));
      var accessToken = generateToken();
      promises.push(database.insertToken(accessToken));
      return Q.all(promises).then(function() {return Q.resolve(accessToken);});
    } else {
      return Q.reject(new Error('Request token not authorized', requestToken));
    }
  });
};
