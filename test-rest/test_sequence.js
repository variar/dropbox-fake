require('dotenv').load();

var unirest = require('unirest');
var querystring = require('querystring');
var Q = require('q');
var fs = require('fs-extra');
var helpers = require('../lib/helpers');

var port = process.env.PORT_S || 3001;
var serverUrl = 'https://localhost:' + port;

var makeAuthorizationHeader = function(token) {
  var parts = [];
  parts.push('oauth_token=' + token.oauth_token);
  parts.push('oauth_signature=123&' + token.oauth_token_secret);

  return 'OAuth ' + parts.join();
};

var getRequestToken = function() {
  var deferred = Q.defer();
  unirest.post(serverUrl + '/1/oauth/request_token')
  .end(function(response) {
    console.log(response.request.path, response.status);
    if (response.status == 200) {
      console.log(response.body);
      deferred.resolve(querystring.parse(response.body));
    } else {
      deferred.reject(new Error(response.status));
    }
  });
  return deferred.promise;
};

var authorizeRequestToken = function(requestToken) {
  var deferred = Q.defer();
  unirest.get(serverUrl + '/1/oauth/authorize?' + querystring.stringify(requestToken))
  .header('Authorization', makeAuthorizationHeader(requestToken))
  .end(function(response) {
    console.log(response.request.path, response.status);
    if (response.status == 200) {
      deferred.resolve(requestToken);
    } else {
      deferred.reject(new Error(response.status));
    }
  });
  return deferred.promise;
};

var getAccessToken = function(requestToken) {
  var deferred = Q.defer();
  unirest.post(serverUrl + '/1/oauth/access_token')
  .header('Authorization', makeAuthorizationHeader(requestToken))
  .end(function(response) {
    console.log(response.request.path, response.status);
    if (response.status == 200) {
      console.log(response.body);
      deferred.resolve(querystring.parse(response.body));
    } else {
      deferred.reject(new Error(response.status));
    }
  });
  return deferred.promise;
};

var getAccountInformation = function(accessToken) {
  var deferred = Q.defer();
  unirest.get(serverUrl + '/1/account/info')
  .header('Authorization', makeAuthorizationHeader(accessToken))
  .end(function(response) {
    console.log(response.request.path, response.status);
    if (response.status == 200) {
      console.log(response.body);
      deferred.resolve(accessToken);
    } else {
      deferred.reject(new Error(response.status));
    }
  });
  return deferred.promise;
};

var putSmallFile = function(accessToken) {
  var deferred = Q.defer();
  unirest.put(serverUrl + '/1/files_put/sandbox/full_test/small_file')
  .header('Authorization', makeAuthorizationHeader(accessToken))
  .header('Content-Type', 'application/octet-stream')
  .header('Content-Length', 5)
  .send(new Buffer([1,2,3,4,5]))
  .end(function(response) {
    console.log(response.request.path, response.status);
    if (response.status == 200) {
      console.log(response.body);
      deferred.resolve(accessToken);
    } else {
      deferred.reject(new Error(response.status));
    }
  });
  return deferred.promise;
};

var putSameSmallFileWithoutOverwrite = function(accessToken) {
  var deferred = Q.defer();
  unirest.put(serverUrl + '/1/files_put/sandbox/full_test/small_file?overwrite=false')
  .header('Authorization', makeAuthorizationHeader(accessToken))
  .header('Content-Type', 'application/octet-stream')
  .header('Content-Length', 5)
  .send(new Buffer([1,2,3,4,5]))
  .end(function(response) {
    console.log(response.request.path, response.status);
    if (response.status == 200) {
      deferred.reject(new Error('file overwritten'));
    } else {
      console.log(response.body);
      deferred.resolve(accessToken);
    }
  });
  return deferred.promise;
};

var putSameSmallFileWithOverwrite = function(accessToken) {
  var deferred = Q.defer();
  unirest.put(serverUrl + '/1/files_put/sandbox/full_test/small_file')
  .header('Authorization', makeAuthorizationHeader(accessToken))
  .header('Content-Type', 'application/octet-stream')
  .header('Content-Length', 5)
  .send(new Buffer([1,2,3,4,5]))
  .end(function(response) {
    console.log(response.request.path, response.status);
    if (response.status == 200) {
      console.log(response.body);
      deferred.resolve(accessToken);
    } else {
      deferred.reject(new Error(status));
    }
  });
  return deferred.promise;
};

var getNotExistingFileMetadata = function(accessToken) {
  var deferred = Q.defer();
  unirest.get(serverUrl + '/1/metadata/sandbox/small_file')
  .header('Authorization', makeAuthorizationHeader(accessToken))
  .end(function(response) {
    console.log(response.request.path, response.status);
    if (response.status == 200) {
      deferred.reject(new Error('file should be not found'));
    } else {
      console.log(response.body);
      deferred.resolve(accessToken);
    }
  });
  return deferred.promise;
};

var getExistingFileMetadata = function(accessToken) {
  var deferred = Q.defer();
  unirest.get(serverUrl + '/1/metadata/sandbox/full_test/small_file')
  .header('Authorization', makeAuthorizationHeader(accessToken))
  .end(function(response) {
    console.log(response.request.path, response.status);
    if (response.status == 200) {
      console.log(response.body);
      deferred.resolve(accessToken);
    } else {
      deferred.reject(new Error(response.status));
    }
  });
  return deferred.promise;
};

var uploadChunk1 = function(accessToken) {
  var deferred = Q.defer();
  unirest.put(serverUrl + '/1/chunked_upload')
  .header('Authorization', makeAuthorizationHeader(accessToken))
  .header('Content-Type', 'application/octet-stream')
  .header('Content-Length', 5)
  .send(new Buffer([1,2,3,4,5]))
  .end(function(response) {
    console.log(response.request.path, response.status);
    if (response.status == 200) {
      console.log(response.body);
      accessToken.upload = response.body;
      deferred.resolve(accessToken);
    } else {
      deferred.reject(new Error(response.status));
    }
  });
  return deferred.promise;
};

var uploadChunk2 = function(accessToken) {
  var deferred = Q.defer();
  var query = querystring.stringify(accessToken.upload);
  unirest.put(serverUrl + '/1/chunked_upload?' + query)
  .header('Authorization', makeAuthorizationHeader(accessToken))
  .header('Content-Type', 'application/octet-stream')
  .header('Content-Length', 5)
  .send(new Buffer([1,2,3,4,5]))
  .end(function(response) {
    console.log(response.request.path, response.status);
    if (response.status == 200) {
      console.log(response.body);
      accessToken.upload = response.body;
      deferred.resolve(accessToken);
    } else {
      deferred.reject(new Error(response.status));
    }
  });
  return deferred.promise;
};

var commitChunkedUpload = function(accessToken) {
  var deferred = Q.defer();
  var query = querystring.stringify(accessToken.upload);
  unirest.post(serverUrl + '/1/commit_chunked_upload/sandbox/full_test/large_file')
  .header('Authorization', makeAuthorizationHeader(accessToken))
  .header('Content-Type', 'application/x-www-form-urlencoded')
  .header('Content-Length', query.length)
  .send(query)
  .end(function(response) {
    console.log(response.request.path, response.status);
    if (response.status == 200) {
      console.log(response.body);
      deferred.resolve(accessToken);
    } else {
      deferred.reject(new Error(response.status));
    }
  });
  return deferred.promise;
};

var createFolder = function(accessToken) {
  var deferred = Q.defer();
  var query = querystring.stringify({root: 'sandbox', path:'new_folder'});
  unirest.post(serverUrl + '/1/fileops/create_folder')
  .header('Authorization', makeAuthorizationHeader(accessToken))
  .header('Content-Type', 'application/x-www-form-urlencoded')
  .header('Content-Length', query.length)
  .send(query)
  .end(function(response) {
    console.log(response.request.path, response.status);
    if (response.status == 200) {
      console.log(response.body);
      deferred.resolve(accessToken);
    } else {
      deferred.reject(new Error(response.status));
    }
  });
  return deferred.promise;
};

var getFullFile = function(accessToken) {
  var deferred = Q.defer();
  var query = querystring.stringify({root: 'sandbox', path:'new_folder'});
  unirest.get(serverUrl + '/1/files/sandbox/full_test/large_file')
  .header('Authorization', makeAuthorizationHeader(accessToken))
  .end(function(response) {
    console.log(response.request.path, response.status);
    if (response.status == 200) {
      //console.log(response.body);
      console.log(response.headers)
      deferred.resolve(accessToken);
    } else {
      deferred.reject(new Error(response.status));
    }
  });
  return deferred.promise;
};

var getPartFile = function(accessToken) {
  var deferred = Q.defer();
  var query = querystring.stringify({root: 'sandbox', path:'new_folder'});
  unirest.get(serverUrl + '/1/files/sandbox/full_test/large_file')
  .header('Authorization', makeAuthorizationHeader(accessToken))
  .header('content-range', 'bytes 5-10/*')
  .end(function(response) {
    console.log(response.request.path, response.status);
    if (response.status == 206) {
      console.log(response.headers)
      if (response.body.length != 5) {
        deferred.reject(new Error('range not matched'));
      } else {
        deferred.resolve(accessToken);
      }
    } else {
      deferred.reject(new Error(response.status));
    }
  });
  return deferred.promise;
};

var deleteFile = function(accessToken) {
  var deferred = Q.defer();
  var query = querystring.stringify({root: 'sandbox', path:'full_test/small_file'});
  unirest.post(serverUrl + '/1/fileops/delete')
  .header('Authorization', makeAuthorizationHeader(accessToken))
  .header('Content-Type', 'application/x-www-form-urlencoded')
  .header('Content-Length', query.length)
  .send(query)
  .end(function(response) {
    console.log(response.request.path, response.status);
    if (response.status == 200) {
      console.log(response.body);
      deferred.resolve(accessToken);
    } else {
      deferred.reject(new Error(response.status));
    }
  });
  return deferred.promise;
};

var deleteFileNotExists = function(accessToken) {
  var deferred = Q.defer();
  var query = querystring.stringify({root: 'sandbox', path:'full_test/small_file'});
  unirest.post(serverUrl + '/1/fileops/delete')
  .header('Authorization', makeAuthorizationHeader(accessToken))
  .header('Content-Type', 'application/x-www-form-urlencoded')
  .header('Content-Length', query.length)
  .send(query)
  .end(function(response) {
    console.log(response.request.path, response.status);
    if (response.status == 404) {
      console.log(response.body);
      deferred.resolve(accessToken);
    } else {
      deferred.reject(new Error('deleted non existing file'));
    }
  });
  return deferred.promise;
};

var deleteFolder = function(accessToken) {
  var deferred = Q.defer();
  var query = querystring.stringify({root: 'sandbox', path: ''});
  unirest.post(serverUrl + '/1/fileops/delete')
  .header('Authorization', makeAuthorizationHeader(accessToken))
  .header('Content-Type', 'application/x-www-form-urlencoded')
  .header('Content-Length', query.length)
  .send(query)
  .end(function(response) {
    console.log(response.request.path, response.status);
    if (response.status == 200) {
      console.log(response.body);
      deferred.resolve(accessToken);
    } else {
      deferred.reject(new Error(response.status));
    }
  });
  return deferred.promise;
};

var deleteChunksFolder = function(accessToken) {
  return Q.nfcall(fs.remove, helpers.getChunkPath(accessToken.oauth_token, ''));
}

module.exports.runTestSequence = function(url) {
  serverUrl = url;

  console.log('Running test sequence for server at', serverUrl);

  return getRequestToken()
  .then(authorizeRequestToken)
  .then(getAccessToken)
  .then(getAccountInformation)
  .then(putSmallFile)
  .then(putSameSmallFileWithoutOverwrite)
  .then(putSameSmallFileWithOverwrite)
  .then(getNotExistingFileMetadata)
  .then(getExistingFileMetadata)
  .then(uploadChunk1)
  .then(uploadChunk2)
  .then(commitChunkedUpload)
  .then(createFolder)
  .then(getFullFile)
  .then(getPartFile)
  .then(deleteFile)
  .then(deleteFileNotExists)
  .then(deleteFolder)
  .then(deleteChunksFolder);
};
