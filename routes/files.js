var express = require('express');
var uuid = require('uuid');
var parseRange = require('range-parser');
var Q = require('q');

var router = express.Router();

var helpers = require('../lib/helpers');
var fileops = require('../lib/fileops');

var parseRangeHeader = function(req, res, next) {
  var rangeHeader = req.header('Range');
  if (rangeHeader) {
    console.log('Found range', rangeHeader);
    res.status(206);
    req.rangeHeader = parseRange(2*1024*1024*1024/*2Gb*/,rangeHeader)[0];
    console.log('Paresed range', req.rangeHeader);
  }
  next();
};

var sendFileRange = router.sendFileRange = function(req, res, next) {
  console.log('/files/sandbox/', req.params[0], req.rangeHeader);
  var fullPath = helpers.getDataPath(req.oauthHeader.token, req.params[0]);

  if (!req.rangeHeader) {
    req.rangeHeader = {name: 'bytes', start: 0, end: Number.MAX_VALUE};
  }

  fileops.getFileStats(fullPath)
  .then(function(stats) {
    stats.path = '/' + req.params[0];
    res.header('x-dropbox-metadata', JSON.stringify(stats));

    if (stats.bytes < req.rangeHeader.end) {
      req.rangeHeader.end = stats.bytes;
    }
    req.rangeHeader.length = stats.bytes;

    res.header('Content-Length', req.rangeHeader.end - req.rangeHeader.start);

    if (res.status == 206) {
      var resRangeHeader = 'bytes=' + req.rangeHeader.start +
                            '-' + req.rangeHeader.end + '/' +
                            req.rangeHeader.length;

      res.header('Range', resRangeHeader);
    }

    console.log('Sending range', req.rangeHeader);
    return fileops.readFileRange(fullPath, req.rangeHeader, res);
  })
  .then(function() {
    res.end();
    return Q.resolve();
  })
  .catch(function(err) {
    err.status = 404;
    next(err);
  });
};

var recieveFile = router.recieveFile = function(req, res, next) {
  console.log('/files_put/sandbox/', req.params[0]);

  if (!req.header('Content-Length')) {
    console.log('Content-Length not set');
    return res.sendStatus(411);
  }

  var fullPath = helpers.getDataPath(req.oauthHeader.token, req.params[0]);

  fileops.getFileStats(fullPath).then(
    function(stats) {
      if (req.query.overwrite === 'false') {
        res.sendStatus(409);
        return Q.reject(new Error('file exists'));
      } else {
        return Q.resolve();
      }
    },
    function(err) {
      return Q.resolve();
    })
    .then(function() {
      return fileops.writeData(fullPath, req.body, 0)
      .then(function(stats) {
        stats.path = '/' + req.params[0];
        res.json(stats);
        return Q.resolve();
      });
    })
    .catch(next);
};

var recieveFileChunk = router.recieveFileChunk = function(req, res, next) {
  console.log('/files_put/chunked_upload/',
              req.query.upload_id,
              req.query.offset,
              req.header('Content-Length'));

  var uploadId = req.query.upload_id;
  if (!uploadId) {
    uploadId = uuid();
  }

  var offset = req.query.offset;
  if (!offset) {
    offset = 0;
  }

  var chunkPath = helpers.getChunkPath(req.oauthHeader.token, uploadId);
  fileops.getFileStats(chunkPath).then(
    function(stats) {
      if (offset != stats.bytes) {
        res.status(400).json({
          upload_id: uploadId,
          offset: stats.bytes,
          expires: 'Tue, 19 Jul 2021 21:55:38 +0000'});
        return Q.reject(new Error('unexpected offset'));
      }
      return Q.resolve();
    },
    function(err) {
      if (req.query.upload_id) {
        return Q.reject(
          httpError('unexpected upload_id'+req.query.upload_id, 404));
      }
      return Q.resolve();
    }
  ).then(function() {
    return fileops.writeData(chunkPath, req.body, offset)
    .then(function(stats) {
      console.log('Chunk uploaded', chunkPath, 'total size', stats.bytes);
      res.json({
        upload_id: uploadId,
        offset: stats.bytes,
        expires: 'Tue, 19 Jul 2021 21:55:38 +0000'});
      return Q.resolve();
    });
  })
  .catch(next);
};

var commitFileChunks = router.commitFileChunks = function(req, res, next) {
  if (!req.body.upload_id) {
    return res.sendStatus(400);
  }
  var chunkPath = helpers.getChunkPath(
    req.oauthHeader.token,
    req.body.upload_id);

  fileops.getFileStats(chunkPath)
  .fail(function(err) {
    return Q.reject(
      httpError('no upload with such id' + req.body.upload_id, 400));
  })
  .then(function() {
    var dataPath = helpers.getDataPath(req.oauthHeader.token, req.params[0]);
    return fileops.renameFile(chunkPath, dataPath)
    .then(function(stats) {
      stats.path = '/' + req.params[0];
      res.json(stats);
      return Q.resolve();
    });
  })
  .catch(next);
};

var getMetadata = router.getMetadata = function(req, res, next) {
  console.log('/metadata/sandbox/', req.params[0]);

  var fullPath = helpers.getDataPath(req.oauthHeader.token, req.params[0]);
  console.log(fullPath);

  fileops.getFileStats(fullPath)
  .then(function(stats) {
    stats.path = '/' + req.params[0];
    res.json(stats);
    return Q.resolve();
  })
  .catch(function(err) {
    err.status = 404;
    next(err);
  });
};

var createFolder = router.createFolder = function(req, res, next) {
  console.log('/fileops/create_folder/', req.body.root, req.body.path);

  if (req.body.root != 'sandbox') {
    return res.sendStatus(403);
  }

  var fullPath = helpers.getDataPath(req.oauthHeader.token, req.body.path);
  fileops.ensureDirectory(fullPath)
  .then(function(stats) {
    stats.path = '/' + req.body.path;
    res.json(stats);
    return Q.resolve();
  })
  .catch(function(err) {
    err.status = 403;
    next(err);
  });
};

var removeObject = router.removeObject = function(req, res, next) {
  console.log('/fileops/delete/', req.body.root, req.body.path);

  if (req.body.root != 'sandbox') {
    return res.sendStatus(403);
  }

  var fullPath = helpers.getDataPath(req.oauthHeader.token, req.body.path);
  fileops.remove(fullPath)
  .then(function(stats) {
    stats.path = '/' + req.body.path;
    res.json(stats);
    return Q.resolve();
  })
  .catch(function(err) {
    err.status = 404;
    next(err);
  });
};

var getAccountInfo = router.getAccountInfo = function(req, res, next) {
  console.log('/account/info');
  fileops.getFolderSize(helpers.getDataPath(req.oauthHeader.token, ''))
  .then(function(size) {
    res.json({
      uid: helpers.getUserId(req.oauthHeader.token),
      quota_info: {
        shared: 0,
        quota: 2 * 1024 * 1024 * 1024, //2Gb
        normal: size
      }
    });
    return Q.resolve();
  })
  .catch(next);
};

var authorization = require('./authorization');
router.use(authorization.parseOAuthHeader);
router.use(authorization.verifyOAuthSecret);

router.get('/files/sandbox/*', parseRangeHeader, sendFileRange);
router.put('/files_put/sandbox/*', recieveFile);
router.put('/chunked_upload', recieveFileChunk);
router.post('/commit_chunked_upload/sandbox/*', commitFileChunks);
router.get('/metadata/sandbox/*', getMetadata);
router.post('/fileops/create_folder', createFolder);
router.post('/fileops/delete', removeObject);
router.get('/account/info', getAccountInfo);

module.exports = router;
