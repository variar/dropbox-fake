var crc = require('crc');
var fs = require('fs-extra');
var Q = require('q');

var dataFolder = './data/';
var chunkFolder = './chunks/';

module.exports.getUserId = function(token) {
  return crc.crc32(token) >>> 0;
};

module.exports.createUserPaths = function(token) {
  return Q.nfcall(fs.mkdirp, dataFolder + token).then(function() {
    return Q.nfcall(fs.mkdirp, chunkFolder + token);
  });
};

module.exports.getDataPath = function(token, relativePath) {
  return dataFolder + token + '/' + relativePath;
};

module.exports.getChunkPath = function(token, relativePath) {
  return chunkFolder + token + '/' + relativePath;
};
