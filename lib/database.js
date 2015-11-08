var Loki = require('lokijs');
var Q = require('q');

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
    if (db.autosave) {
      db.saveDatabase();
    }
    return Q.resolve();
  });
};

module.exports.insertToken = function(token) {
  var tokens = db.getCollection('tokens');
  return Q.resolve(tokens.insert(token));
};

module.exports.updateToken = function(token) {
  var tokens = db.getCollection('tokens');
  return Q.resolve(tokens.update(token));
};

module.exports.removeToken = function(token) {
  var tokens = db.getCollection('tokens');
  return Q.resolve(tokens.remove(token));
};

module.exports.getToken = function(tokenKey) {
  var tokens = db.getCollection('tokens');
  return Q.resolve(tokens.findOne({token: tokenKey}));
};
