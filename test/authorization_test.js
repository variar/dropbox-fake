var Q = require('q');
var expect = require('chai').expect;
var authorization = require('../routes/authorization');
var sinon = require('sinon');

var oauth = require('../lib/oauth');
var helpers = require('../lib/helpers');

describe('Authorization', function() {
  var requestToken = {token: '123', secret: '456'};
  var sandbox = sinon.sandbox.create();

  afterEach(function() {
    sandbox.restore();
  });

  describe('OAuth routes', function() {
    describe('POST /oauth/request_token', function() {
      before(function() {
        oauth.issueRequestToken = sandbox.stub(oauth, 'issueRequestToken',
        function() {return Q.resolve(requestToken);});
      });

      it('returns request token in plain text', function(done) {
        var res = {};
        res.send = function(tokenString) {
          var match = tokenString.match(/oauth_token_secret=(.+)&oauth_token=(.+)/);
          expect(match).not.to.be.null;
          expect(match[1]).to.equal(requestToken.secret);
          expect(match[2]).to.equal(requestToken.token);
          expect(oauth.issueRequestToken.calledOnce).to.be.true;
          done();
        };

        authorization.issueRequestToken({}, res);
      });
    });

    describe('GET /oauth/authorize', function() {
      beforeEach(function() {
        oauth.authorizeRequestToken = sandbox.stub(oauth,
          'authorizeRequestToken',
          function(tokenKey, authorize) {
            if (tokenKey == requestToken.token) {
              return Q.resolve(requestToken);
            } else {
              return Q.reject(new Error());
            }
          });
      });

      describe('request token exists', function() {
        it('shoud send 200', function(done) {
          var req = {
            query: {
              'oauth_token': requestToken.token
            }
          };

          var res = {
            sendStatus: function(status) {
              expect(status).to.equal(200);
              expect(oauth.authorizeRequestToken.calledOnce).to.be.true;
              done();
            }
          };
          authorization.authorize(req, res);
        });
      });

      describe('request token not exists', function() {
        it('shoud send 400', function(done) {
          var req = {
            query: {
              'oauth_token': requestToken.token + '123'
            }
          };

          var res = {
            sendStatus: function(status) {
              expect(status).to.equal(400);
              expect(oauth.authorizeRequestToken.calledOnce).to.be.true;
              done();
            }
          };
          authorization.authorize(req, res);
        });
      });
    });

    describe('POST /oauth/access_token', function() {

      beforeEach(function() {
        oauth.getAccessToken = sandbox.stub(oauth, 'getAccessToken',
        function(tokenKey) {
          expect(tokenKey).not.to.be.undefined;
          if (tokenKey == requestToken.token) {
            return Q.resolve(requestToken);
          } else {
            return Q.reject(new Error());
          }
        });

        helpers.createUserPaths = sandbox.stub(helpers, 'createUserPaths',
        function(tokenKey) {return Q.resolve(); });
      });

      describe('request is valid', function() {
        it('should create user paths', function(done) {
          var req = {
            oauthHeader: {
              token: requestToken.token,
              signature: '123'
            }
          };

          var res = {
            send: function(response) {
              var match = response.match(/oauth_token_secret=(.+)&oauth_token=(.+)&uid=(.+)/);
              expect(match).not.to.be.null;
              expect(match[1]).to.equal(requestToken.secret);
              expect(match[2]).to.equal(requestToken.token);
              expect(Number(match[3])).equal(helpers.getUserId(requestToken.token));
              expect(oauth.getAccessToken.calledOnce).to.be.true;
              expect(helpers.createUserPaths.calledOnce).to.be.true;
              done();
            }
          };
          authorization.getAccessToken(req, res);
        });
      });

      describe('request is invalid', function() {
        it('should send 403', function(done) {

          oauth.getAccessToken.restore();
          oauth.getAccessToken = sandbox.stub(oauth, 'getAccessToken',
          function(tokenKey) {
            expect(tokenKey).not.to.be.undefined;
            return Q.reject(new Error());
          });

          var req = {
            oauthHeader: {
              token: requestToken.token,
              signature: '123'
            }
          };

          var res = {
            sendStatus: function(status) {
              expect(status).to.equal(403);
              expect(oauth.getAccessToken.calledOnce).to.be.true;
              expect(helpers.createUserPaths.called).to.be.not.true;
              done();
            }
          };
          authorization.getAccessToken(req, res);
        });
      });

      describe('failed to create paths', function() {
        it('should send 403', function(done) {

          helpers.createUserPaths.restore();
          helpers.createUserPaths = sandbox.stub(helpers, 'createUserPaths',
            function(tokenKey) {
              expect(tokenKey).not.to.be.undefined;
              return Q.reject(new Error());
          });

          var req = {
            oauthHeader: {
              token: requestToken.token,
              signature: '123'
            }
          };

          var res = {
            sendStatus: function(status) {
              expect(status).to.equal(403);
              expect(oauth.getAccessToken.calledOnce).to.be.true;
              expect(helpers.createUserPaths.calledOnce).to.be.true;
              done();
            }
          };
          authorization.getAccessToken(req, res);
        });
      });
    });
  });

  describe('OAuth middleware', function() {
    describe('parseOAuthHeader', function() {
      describe('has Authorization header', function() {
        it('calls next', function(done) {
          var req = {
            header: function(header) {
              return 'OAuth oauth_token=123, oauth_signature=aaa&456';
            }
          };
          authorization.parseOAuthHeader(req, {}, done);
        });
      });

      describe('has no header', function() {
        it('sends 403', function(done) {
          var req = {
            header: function(header) {
              return undefined;
            }
          };

          var res = {
            sendStatus: function(status) {
              expect(status).to.equal(403);
              done();
            }
          };

          authorization.parseOAuthHeader(req, res);
        });
      });

    });

    describe('verifyOAuthSecret', function() {

      beforeEach(function() {
        oauth.verifyOAuthSignature = sandbox.stub(oauth, 'verifyOAuthSignature',
        function(tokenKey, signature) {
          return Q.resolve(tokenKey == requestToken.token);
        });
      });

      describe('header is valid', function() {
        it('should call next', function(done) {
          var req = {
            oauthHeader: {
              token: requestToken.token,
              signature: '123'
            }
          };

          authorization.verifyOAuthSecret(req, {}, function() {
            expect(oauth.verifyOAuthSignature.calledOnce).to.be.true;
            done();
          });
        });
      });

      describe('header has no token', function() {
        it('should send 403', function(done) {
          var req = {
            oauthHeader: {
              signature: '123'
            }
          };

          var res = {
            sendStatus: function(status) {
              expect(status).to.be.equal(403);
              expect(oauth.verifyOAuthSignature.called).to.equal.false;
              done();
            }
          };

          authorization.verifyOAuthSecret(req, res);
        });
      });

      describe('header has no signature', function() {
        it('should send 403', function(done) {
          var req = {
            oauthHeader: {
              token: requestToken.token,
            }
          };

          var res = {
            sendStatus: function(status) {
              expect(status).to.be.equal(403);
              expect(oauth.verifyOAuthSignature.called).to.equal.false;
              done();
            }
          };

          authorization.verifyOAuthSecret(req, res);
        });
      });

      describe('header has invalid signature', function() {
        it('should send 403', function(done) {
          var req = {
            oauthHeader: {
              token: requestToken.token + '1',
              signature: '124'
            }
          };

          var res = {
            sendStatus: function(status) {
              expect(status).to.be.equal(403);
              expect(oauth.verifyOAuthSignature.calledOnce).to.equal.true;
              done();
            }
          };

          authorization.verifyOAuthSecret(req, res);
        });
      });

      describe('header has invalid token', function() {
        it('should send 400', function(done) {
          oauth.verifyOAuthSignature.restore();
          oauth.verifyOAuthSignature = sandbox.stub(oauth,
            'verifyOAuthSignature', function(token, signature) {
            return Q.reject(new Error());
          });

          var req = {
            oauthHeader: {
              token: requestToken.token,
              signature: '124'
            }
          };

          var res = {
            sendStatus: function(status) {
              expect(status).to.be.equal(400);
              expect(oauth.verifyOAuthSignature.calledOnce).to.equal.true;
              done();
            }
          };

          authorization.verifyOAuthSecret(req, res);
        });
      });

    });
  });

});
