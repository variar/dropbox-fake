var dataFolder = './data/';
var chunkFolder = './chunks/';

var fs = require('fs-extra');

module.exports.createUserPaths = function(token, callback) {
  fs.mkdir(dataFolder + token, function(err) {
    if (err) {
      callback(err);
    }
    else {
      fs.mkdir(chunkFolder + token, callback);
    }
  });
};

module.exports.getDataPath = function(token, relativePath) {
  return dataFolder + token + '/' + relativePath;
};

module.exports.getChunkPath = function(token, relativePath) {
  return chunkFolder + token + '/' + relativePath;
};
