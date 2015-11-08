var rewire = require('rewire');
var expect = require('chai').expect;
var Loki = require('lokijs');
var Q = require('q');

var database = rewire('../lib/database.js');

describe('Database', function() {

  before(function() {
    var db = new Loki(__dirname + '/test_db.json');
    var tokens = db.addCollection('tokens');
    tokens.ensureUniqueIndex('token');
    database.__set__('db', db);
  });

  afterEach(function() {
    var db = database.__get__('db');
    var tokens = db.getCollection('tokens');
    tokens.removeDataOnly();
  });

  describe('insertToken', function() {
    it('should insert token to db', function(done) {
      var token = {token: 'abc', secret: '123'};
      database.insertToken(token).then(function(storedToken) {
        expect(token).to.equal(storedToken);
        return Q.resolve();
      })
      .then(done,done);
    });
  });

  describe('removeToken', function() {
    it('should remove token from db', function(done) {
      var token = {token: 'abc', secret: '123'};
      database.insertToken(token)
      .then(database.removeToken)
      .then(function() {
        return database.getToken(token.token);
      })
      .then(function(tokenFromDb) {
        expect(tokenFromDb).to.be.null;
        return Q.resolve();
      })
      .then(done,done);
    });
  });

  describe('updateToken', function() {
    it('should update token in db', function(done) {
      var token = {token: 'abc', secret: '123'};
      database.insertToken(token)
      .then(function(savedToken) {
        savedToken.authorized = true;
        return database.updateToken(savedToken);
      })
      .then(function(tokenFromDb) {
        expect(tokenFromDb.authorized);
        return Q.resolve();
      })
      .then(done,done);
    });
  });

  describe('getToken', function() {
    describe('has token in db', function(){
      it('should get same token from db', function(done) {
        var token = {token: 'abc', secret: '123'};
        database.insertToken(token)
        .then(function(storedToken) {
          return database.getToken(storedToken.token);
        })
        .then(function(tokenFromDb) {
          expect(token).to.equal(tokenFromDb);
        })
        .then(done,done);
      });
    });

    describe('no token in db', function() {
      it('should return null', function(done) {
        database.getToken('1234')
        .then(function(tokenFromDb) {
          expect(tokenFromDb).to.be.null;
        })
        .then(done,done);
      });
    });
  });

});
