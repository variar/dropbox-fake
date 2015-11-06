var express = require('express');
var fs = require('fs-extra');
var uuid = require('uuid');
var moment = require('moment');
var getFolderSize = require('get-folder-size');
var path = require('path');
var Q = require('q');

var router = express.Router();

var paths = require('../paths');
var user = require('../user');
var oauth = require('./oauth');

var dateFormat = 'ddd, D MMM YYYY HH:mm:ss ZZ';

router.use(oauth.parseOAuthHeader);
router.use(oauth.verifyOAuthSecret);

/* GET home page. */
router.get('/files/sandbox/*', function(req, res, next) {
  console.log('/files/sandbox/', req.params[0]);

  var fullPath = paths.getDataPath(req.oauthToken, req.params[0]);
  fs.stat(fullPath, function(err, stats) {
    if (err) {
      console.log(err);
      req.status(500).send(err.stack);
      return;
    }

    var fileSize = stats.size;
    if (fileSize < req.range.last) {
      req.range.last = fileSize;
    }
    res.range({
         first: req.range.first,
         last: req.range.last,
         length: req.range.last - req.range.first
       });

    console.log('range', req.range);
    var s = fs.createReadStream(fullPath,
       {start: req.range.first, end: req.range.last}).pipe(res);
    s.on('finish', function() {res.end();});
  });
});

router.put('/files_put/sandbox/*', function(req, res, next) {
  console.log('/files_put/sandbox/', req.params[0]);
  var fullPath = paths.getDataPath(req.oauthToken, req.params[0]);

  var dir = path.dirname(fullPath);
  Q.denodeify(fs.mkdirp)(dir)
  .then(function() {
    var stream = fs.createWriteStream(fullPath);
    return Q.nbind(stream.write, stream)(req.body);
  })
  .then(function() {
    return Q.denodeify(fs.stat)(fullPath);
  })
  .then(function(stats) {
    res.json({
      bytes: stats.size,
      path: '/' + req.params[0],
      modified: moment(stats.mtime).format(dateFormat),
    });
  })
  .catch(function(err) {
    res.sendStatus(500);
  });
});

router.put('/chunked_upload', function(req, res, next) {
  console.log('/files_put/chunked_upload/', req.query.upload_id, req.query.offset, req.header('Content-Length'));
  var uploadId = req.query.upload_id;
  var fileMode = 'r+';
  if (!uploadId) {
    uploadId = uuid();
    fileMode = 'w';
  }

  var offset = req.query.offset;
  if (!offset) {
    offset = 0;
  }

  var chunkPath = paths.getChunkPath(req.oauthToken, uploadId);
  var stream = fs.createWriteStream(chunkPath,
    {flags: fileMode, defaultEncoding: 'binary', start: Number(offset)});

  Q.nbind(stream.write, stream)(req.body)
  .then(function() {
    return Q.denodeify(fs.stat)(chunkPath);
  })
  .then(function(stats) {
    console.log('Chunk uploaded', chunkPath, 'total size', stats.size);
    res.json({
      upload_id: uploadId,
      offset: stats.size,
      expires: 'Tue, 19 Jul 2021 21:55:38 +0000'});
  })
  .catch(function(err) {
    res.status(500).send(err.stack);
  });
});

router.post('/commit_chunked_upload/sandbox/*', function(req, res, next) {
  console.log('/commit_chunked_upload/sandbox/', req.params[0], req.body.upload_id);
  if (req.body.upload_id) {
    var chunkPath = paths.getChunkPath(req.oauthToken, req.body.upload_id);
    var dataPath = paths.getDataPath(req.oauthToken, req.params[0]);

    var dir = path.dirname(datapath);

    Q.denodeify(fs.mkdirp)(dir)
    .then(function() {
      return Q.denodeify(fs.rename)(chunkPath, dataPath);
    })
    .then(function() {
      return Q.denodeify(fs.stat)(dataPath);
    })
    .then(function(stats) {
      res.json({
        bytes: stats.size,
        path: '/' + req.params[0],
        modified: moment(stats.mtime).format(dateFormat),
      });
    })
    .catch(function(err) {
      res.status(500).send(err.stack);
    });
  } else {
    res.sendStatus(400);
  }
});

router.get('/metadata/sandbox/*', function(req, res, next) {
  console.log('/metadata/sandbox/', req.params[0]);
    var fullPath = paths.getDataPath(req.oauthToken, req.params[0]);
    Q.denodeify(fs.stat)(fullPath)
    .then(function (stats) {
      res.json({
        bytes: stats.size,
        path: '/' + req.params[0],
        modified: moment(stats.mtime).utc().format(dateFormat),
        is_dir: stats.isDirectory()
      });
    })
    .catch(function(err) {
      res.sendStatus(404);
    });
});

router.post('/fileops/create_folder', function(req, res, next) {
  console.log('/fileops/create_folder/', req.body.path);
  var fullPath = paths.getDataPath(req.oauthToken, req.body.path);
  fs.mkdirp(fullPath, function(err) {
    if (err) {
      res.sendStatus(403);
    } else {
      res.json({
        bytes: 0,
        path: '/' + req.body.path,
        modified: moment().utc().format(dateFormat),
        is_dir: true
      });
    }
  });
});

router.post('/fileops/delete', function(req, res, next) {
  console.log('/fileops/delete/', req.body.path);
  var fullPath = paths.getDataPath(req.oauthToken, req.body.path);
  fs.remove(fullPath, function(err) {
    if (err) {
      res.sendStatus(403);
    } else {
      res.json({
        bytes: 0,
        path: '/' + req.body.path,
        modified: moment().utc().format(dateFormat),
        is_deleted: true
      });
    }
  });
});

router.get('/account/info', function(req, res, next) {
  console.log('/account/info');
  getFolderSize(paths.getDataPath(req.oauthToken, ''), function(err, size) {
    if (err) {
      res.status(500).send(err.stack);
    } else {
      res.json({
        uid: user.getUserId(req.oauthToken),
        quota_info: {
          shared: 0,
          quota: 2*1024*1024*1024,
          normal: size
        }
      });
    }
  });
});

module.exports = router;
