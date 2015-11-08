var fs = require('fs-extra');
var moment = require('moment');
var getFolderSize = require('get-folder-size');
var path = require('path');
var Q = require('q');

var helpers = require('../lib/helpers');

var dateFormat = 'ddd, D MMM YYYY HH:mm:ss ZZ';

var ensureDirectory = module.exports.ensureDirectory = function(dir) {
  return Q.nfcall(fs.mkdirp, dir).
  then(function() {
    return Q.resolve({
      bytes: 0,
      modified: moment().utc().format(dateFormat),
      is_dir: true
    });
  });
};

var getFileStats = module.exports.getFileStats = function(fullPath) {
  return Q.nfcall(fs.stat, fullPath).then(function(stats) {
    return Q.resolve({
      bytes: stats.size,
      is_dir: stats.isDirectory(),
      modified: moment(stats.mtime).utc().format(dateFormat),
    });
  });
};

module.exports.readFileRange = function(fullPath, range, writeStream) {
  var deferred = Q.defer();
  fs.createReadStream(fullPath, {
    start: range.start, end: range.end})
  .pipe(writeStream)
  .on('finish', function() {
    deferred.resolve();
  });
  return deferred.promise;
};

module.exports.writeData = function(fullPath, data, offset) {
  var options = {
    defaultEncoding: 'binary',
    flags: 'w',
    start: Number(offset),
  };

  if (offset > 0) {
    options.flags = 'r+';
  }

  return ensureDirectory(path.dirname(fullPath))
  .then(function() {
    var stream = fs.createWriteStream(fullPath, options);
    return Q.nbind(stream.write, stream)(data);
  })
  .then(function() {
    return getFileStats(fullPath);
  });
};

module.exports.renameFile = function(fromPath, toPath) {
  console.log('ensuredir', toPath);
  return ensureDirectory(path.dirname(toPath))
  .then(function() {
    console.log('rename', fromPath, toPath);
    return Q.nfcall(fs.rename, fromPath, toPath);
  })
  .then(function() {
    console.log('getstats', toPath);
    return getFileStats(toPath);
  });
};

module.exports.remove = function(fullPath) {
  return getFileStats(fullPath)
  .then(function(stats) {
    return Q.nfcall(fs.remove, fullPath)
    .then(function() {
      stats.bytes = 0;
      stats.modified = moment().utc().format(dateFormat);
      stats.is_deleted = true;
      return Q.resolve(stats);
    });
  });
};

module.exports.getFolderSize = function(fullPath) {
  return Q.nfcall(getFolderSize, fullPath);
};
