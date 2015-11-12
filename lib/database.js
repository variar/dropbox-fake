var Loki = require('lokijs');
var Q = require('q');

var db = new Loki('./data/db.json', {autosave: process.env.SAVE_DB});

module.exports.load = function() {
  return Q.nbind(db.loadDatabase, db)({})
  .then(function() {
    console.info('DB loaded');
    var tokens = db.getCollection('tokens');
    if (!tokens) {
      tokens = db.addCollection('tokens');
      tokens.ensureUniqueIndex('token');
    }
    return Q.resolve();
  },
  function(err) {
    console.info('DB created');
    var tokens = db.addCollection('tokens');
    tokens.ensureUniqueIndex('token');
    if (db.autosave) {
      db.saveDatabase();
    }
    return Q.resolve();
  });
};

module.exports.insertToken = function(token) {
  console.log('Trying to insert token', {token:token});
  var tokens = db.getCollection('tokens');
  return Q.resolve(tokens.insert(token));
};

module.exports.updateToken = function(token) {
  console.log('Trying to update token', {token:token});
  var tokens = db.getCollection('tokens');
  return Q.resolve(tokens.update(token));
};

module.exports.removeToken = function(token) {
  console.log('Trying to remove token', {token:token});
  var tokens = db.getCollection('tokens');
  return Q.resolve(tokens.remove(token));
};

module.exports.getToken = function(tokenKey) {
  var tokens = db.getCollection('tokens');
  return Q.resolve(tokens.findOne({token: tokenKey}));
};
