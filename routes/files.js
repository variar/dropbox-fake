var express = require('express');
var uuid = require('uuid');
var Q = require('q');
var range = require('express-range');

var router = express.Router();

var helpers = require('../lib/helpers');
var fileops = require('../lib/fileops');

var parseRange = range({accept: 'bytes', limit: 1024*1024*1024*100});

var sendFileRange = router.sendFileRange = function(req, res) {
  console.log('/files/sandbox/', req.params[0]);
  var fullPath = helpers.getDataPath(req.oauthHeader.token, req.params[0]);

  fileops.readFileRange(fullPath, req.range, res)
  .then(function(range) {
    res.range = range;
    res.range.length = range.last - range.first;
    return fileops.getFileStats(fullPath);
  })
  .then(function(stats) {
    stats.path = '/' + req.params[0];
    res.header('x-dropbox-metadata', JSON.stringify(stats));
    res.end();
  })
  .catch(function(err) {
    console.log(err);
    res.sendStatus(404);
  });
};

var recieveFile = router.recieveFile = function(req, res) {
  console.log('/files_put/sandbox/', req.params[0]);

  if (!req.header('Content-Length')) {
    console.log('Content-Length not set');
    return res.sendStatus(411);
  }

  var fullPath = helpers.getDataPath(req.oauthHeader.token, req.params[0]);

  fileops.getFileStats(fullPath).then(
    function(stats) {
      if (!req.query.overwrite) {
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
    .catch(function(err) {
      console.log(err);
      res.sendStatus(500);
    });
};

var recieveFileChunk = router.recieveFileChunk = function(req, res) {
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
      if (offset != stats.size) {
        res.status(400).json({
          upload_id: uploadId,
          offset: stats.size,
          expires: 'Tue, 19 Jul 2021 21:55:38 +0000'});
        return Q.reject(new Error('unexpected offset'));
      }
      return Q.resolve();
    },
    function(err) {
      if (req.query.upload_id) {
        res.sendStatus(404);
        return Q.reject(new Error('unexpected upload_id'));
      }
      return Q.resolve();
    }
  ).then(function() {
    return fileops.writeData(chunkPath, req.body, offset)
    .then(function(stats) {
      console.log('Chunk uploaded', chunkPath, 'total size', stats.size);
      res.json({
        upload_id: uploadId,
        offset: stats.size,
        expires: 'Tue, 19 Jul 2021 21:55:38 +0000'});
      return Q.resolve();
    });
  })
  .catch(function(err) {
    console.log(err);
    res.sendStatus(500);
  });
};

var commitFileChunks = router.commitFileChunks = function(req, res) {
  if (!req.body.upload_id) {
    return res.sendStatus(400);
  }
  var chunkPath = helpers.getChunkPath(
    req.oauthHeader.token,
    req.body.upload_id);

  fileops.getFileStats(chunkPath)
  .fail(function(err) {
    res.sendStatus(400);
    return Q.reject(new Error('no upload with such id'));
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
  .catch(function(err) {
    console.log(err);
    res.sendStatus(500);
  });
};

var getMetadata = router.getMetadata = function(req, res) {
  console.log('/metadata/sandbox/', req.params[0]);
  var fullPath = helpers.getDataPath(req.oauthHeader.token, req.params[0]);

  fileops.getFileStats(fullPath)
  .then(function(stats) {
    stats.path = '/' + req.params[0];
    res.json(stats);
    return Q.resolve();
  })
  .catch(function(err) {
    res.sendStatus(404);
  });
};

var createFolder = router.createFolder = function(req, res) {
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
  .catch(function(err) {res.sendStatus(403);});
};

var removeObject = router.removeObject = function(req, res) {
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
  .catch(function(err) {res.sendStatus(404);});
};

var getAccountInfo = router.getAccountInfo = function(req, res) {
  console.log('/account/info');
  fileops.getFolderSize(helpers.getDataPath(req.oauthHeader.token, ''))
  .then(function(size) {
    res.json({
      uid: helpers.getUserId(req.oauthToken),
      quota_info: {
        shared: 0,
        quota: 2*1024*1024*1024,
        normal: size
      }
    });
    return Q.resolve();
  })
  .catch(function(err) {
    console.log(err);
    res.sendStatus(500);
  });
};

router.get('/files/sandbox/*', parseRange, sendFileRange);
router.put('/files_put/sandbox/*', recieveFile);
router.put('/chunked_upload', recieveFileChunk);
router.post('/commit_chunked_upload/sandbox/*', commitFileChunks);
router.get('/metadata/sandbox/*', getMetadata);
router.post('/fileops/create_folder', createFolder);
router.post('/fileops/delete', removeObject);
router.get('/account/info', getAccountInfo);

module.exports = router;
