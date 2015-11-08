require('dotenv').load();
var rewire = require('rewire');
var expect = require('chai').expect;
var Loki = require('lokijs');
var Q = require('q');
var sinon = require('sinon');

var database = require('../lib/database');
var oauth = require('../lib/oauth');

describe('OAuth', function() {

  describe('parseOAuthHeader', function() {
    describe('valid header', function() {
      it('returns header object', function() {
        var header = oauth.parseOAuthHeader('OAuth oauth_token=token, oauth_signature=secret&signature');
        expect(header.token).eq('token');
        expect(header.signature).eq('secret&signature');
      });
    });
  });

  describe('verifyOAuthSignature', function() {
    var sandbox = sinon.sandbox.create();
    var storedToken = {token:'123', secret:'456'};

    beforeEach(function() {
      database.getToken = sandbox.stub(database, 'getToken', function(tokenKey) {
        if (tokenKey == storedToken.token) {
          return Q.resolve(storedToken);
        } else {
          return Q.resolve(undefined);
        }
      });
    });

    afterEach(function() {
      sandbox.restore();
    });

    describe('signature is valid', function() {
      it('shout reslove true', function(done) {
        oauth.verifyOAuthSignature(storedToken.token, 'aaa&456')
        .then(function(result) {
          expect(result).to.be.true;
          return Q.resolve();
        })
        .then(done,done);
      });
    });

    describe('signature is invalid', function() {
      it('shout reslove false', function(done) {
        oauth.verifyOAuthSignature(storedToken.token, 'aaa&123')
        .then(function(result) {
          expect(result).to.be.false;
          return Q.resolve();
        })
        .then(done,done);
      });

      describe('token is invalid', function() {
        it('shout reject', function(done) {
          oauth.verifyOAuthSignature(storedToken.token+'1', 'aaa&123')
          .fail(function(err) {
            expect(err).not.to.be.undefined;
            return Q.resolve();
          })
          .then(done,done);
        });
      });
    });
  });

  describe('issueRequestToken', function() {
    it('saves token in db', sinon.test(function(done) {
      database.insertToken = this.stub(database, 'insertToken', function(token) {
        return Q.resolve(token);
      });
      oauth.issueRequestToken()
      .then(function(token) {
        expect(database.insertToken.calledOnce);
        expect(token.token).not.undefinded;
        expect(token.secret).not.undefinded;
      })
      .then(done,done);
    }));
  });

  describe('authorizeRequestToken', function() {

    var requestToken = {token: 'key', secret: 'sss'};
    var sandbox = sinon.sandbox.create();

    beforeEach(function() {
      database.updateToken = sandbox.stub(database, 'updateToken', function(token) {
        return Q.resolve(token);
      });

      database.getToken = sandbox.stub(database, 'getToken', function(tokenKey) {
        expect(tokenKey).to.equal(requestToken.token);
        return Q.resolve(requestToken);
      });

      database.removeToken = sandbox.stub(database, 'removeToken', function(token) {
        expect(token).to.equal(requestToken);
        return Q.resolve();
      });
    });

    afterEach(function() {
      sandbox.restore();
    });

    describe('token is not found', function() {
      it('return error', function(done) {
        database.getToken.restore();
        database.getToken = sandbox.stub(database, 'getToken', function(tokenKey) {
          expect(tokenKey).to.equal(requestToken.token);
          return Q.resolve(undefined);
        });

        oauth.authorizeRequestToken(requestToken.token, true)
        .fail(function(err) {
          expect(database.updateToken.called).not.to.be.true;
          expect(database.removeToken.called).not.to.be.true;
          return Q.resolve();
        })
        .then(done,done);
      });
    });

    describe('token is not authorized', function() {
      it('removes token from db', function(done) {
        oauth.authorizeRequestToken(requestToken.token, false)
        .then(function(token) {
          expect(database.updateToken.called).not.to.be.true;
          expect(database.removeToken.calledOnce).to.be.true;
          expect(token).to.be.undefined;
          return Q.resolve();
        })
        .then(done,done);
      });
    });

    describe('token is authorized', function() {
      it('saves token in db', function(done) {
        oauth.authorizeRequestToken(requestToken.token, true)
        .then(function(token) {
          expect(database.updateToken.calledOnce).to.be.true;
          expect(database.removeToken.called).not.to.be.true;
          expect(token.authorized).to.be.true;
          return Q.resolve();
        })
        .then(done,done);
      });
    });
  });

  describe('getAccessToken', function() {
    var requestToken = {token: 'key', secret: 'sss'};

    var sandbox = sinon.sandbox.create();

    beforeEach(function () {
      database.insertToken = sandbox.stub(database, 'insertToken', function(token) {
        return Q.resolve(token);
      });

      database.removeToken = sandbox.stub(database, 'removeToken', function(token) {
        expect(token).to.equal(requestToken);
        return Q.resolve();
      });

      database.getToken = sandbox.stub(database, 'getToken', function(tokenKey) {
        expect(tokenKey).to.equal(requestToken.token);
        return Q.resolve(requestToken);
      });
    });

    afterEach(function() {
      sandbox.restore();
    });

    describe('requestToken not found', function() {
      it('shoud return error', function(done) {
        database.getToken.restore();
        database.getToken = sandbox.stub(database, 'getToken', function(tokenKey) {
          expect(tokenKey).to.equal(requestToken.token);
          return Q.resolve(undefined);
        });

        oauth.getAccessToken(requestToken.token)
        .fail(function() {
          expect(database.insertToken.called).not.to.be.true;
          expect(database.removeToken.called).not.to.be.true;
          return Q.resolve();
        })
        .then(done,done);
      });
    });

    describe('requestToken not authorized', function() {
      it('shoud return error', function(done) {
        oauth.getAccessToken(requestToken.token)
        .fail(function() {
          expect(database.insertToken.called).not.to.be.true;
          expect(database.removeToken.called).not.to.be.true;
          done();
        });
      });
    });

    describe('requestToken authorized', function() {
      it('shoud return accessToken', function(done) {
        requestToken.authorized = true;
        oauth.getAccessToken(requestToken.token)
        .then(function(accessToken) {
          expect(database.insertToken.calledOnce).to.be.true;
          expect(database.removeToken.calledOnce).to.be.true;
          expect(accessToken).not.to.be.undefined;
          return Q.resolve();
        })
        .then(done);
      });
    });

  });
});
