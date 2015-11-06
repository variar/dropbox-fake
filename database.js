var Loki = require('lokijs');
var Q = require('q');

var uuid = require('uuid');
var randomstring = require('randomstring');

var db = new Loki('./data/db.json', {autosave: process.env.SAVE_DB});

module.exports.load = function() {
  return Q.nbind(db.loadDatabase, db)({})
  .then(function() {
    console.log('DB loaded');
    var tokens = db.getCollection('tokens');
    if (!tokens) {
      tokens = db.addCollection('tokens');
      tokens.ensureUniqueIndex('token');
    }
    return Q.resolve();
  },
  function(err) {
    console.log('DB created');
    var tokens = db.addCollection('tokens');
    tokens.ensureUniqueIndex('token');
    db.saveDatabase();
    return Q.resolve();
  });
};

module.exports.addToken = function(token) {
  var tokens = db.getCollection('tokens');
  return Q.resolve(tokens.insert(token));
};

module.exports.removeToken = function(token) {
  var tokens = db.getCollection('tokens');
  return Q.resolve(tokens.remove(token));
};

module.exports.getToken = function(tokenKey) {
  var tokens = db.getCollection('tokens');
  return Q.resolve(tokens.by('token', tokenKey));
};

module.exports.generateToken = function() {
  return {
    token: uuid().replace(/\-/g,''),
    secret: randomstring.generate(12),
  };
};
