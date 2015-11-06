var express = require('express');
var router = express.Router();

var fs = require('fs-extra');
var uuid = require('uuid');
var moment = require('moment');
var getFolderSize = require('get-folder-size');
var path = require('path');

var paths = require('../paths');
var user = require('../user');

var dateFormat = 'ddd, D MMM YYYY HH:mm:ss ZZ';

var parseOAuthHeader = function(req, res, next) {
  var oauth = req.header('Authorization');
  console.log('OAuth: ' + oauth);

  var oauth = oauth.replace(/OAuth/, '');
  var oauth = oauth.replace(/\s/g, '');
  var oauth = oauth.replace(/\"/g, '');

  var parts = oauth.split(',');
  parts.forEach(function(part) {
    var keyValue = part.split('=');
    if (keyValue[0] == 'oauth_token') {
      req.oauthToken = keyValue[1];
    } else if (keyValue[0] == 'oauth_signature') {
      req.oauthSignature = keyValue[1];
    }
  });

  return next();
};

var verifyOAuthSecret = function(req, res, next) {
  var signatureParts = req.oauthSignature.split('&');
  console.log("Verify signature", signatureParts[1]);
  if (signatureParts[1] == req.oauthToken) {
    return next();
  } else {
    console.log('OAuth error, token', req.oauthToken,
    'signature', req.oauthSignature);
    res.sendStatus(403);
  }
};

/* GET home page. */
router.get('/files/sandbox/*', parseOAuthHeader, verifyOAuthSecret, function(req, res, next) {
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

router.put('/files_put/sandbox/*', parseOAuthHeader, verifyOAuthSecret, function(req, res, next) {
  console.log('/files_put/sandbox/', req.params[0]);
  var fullPath = paths.getDataPath(req.oauthToken, req.params[0]);

  var dir = path.dirname(fullPath);
  fs.mkdirp(dir, function(err) {
    if (err) {
      res.sendStatus(500);
    } else {
      var stream = fs.createWriteStream(fullPath);
      stream.write(req.body, function() {
        fs.stat(fullPath, function(err, stats) {
          res.json({
            bytes: stats.size,
            path: '/' + req.params[0],
            modified: moment(stats.mtime).format(dateFormat),
          });
        });
      });
    }
  });
});

router.put('/chunked_upload', parseOAuthHeader, verifyOAuthSecret, function(req, res, next) {
  console.log('/files_put/chunked_upload/', req.query.upload_id, req.query.offset, req.header('Content-Length'));
  var upload_id = req.query.upload_id;
  var fileMode = 'r+';
  if (!upload_id) {
    upload_id = uuid();
    fileMode = 'w';
  }

  var offset = req.query.offset;
  if (!offset) {
    offset = 0;
  }

  var chunkPath = paths.getChunkPath(req.oauthToken, upload_id);
  var stream = fs.createWriteStream(chunkPath, {flags: fileMode, defaultEncoding: 'binary', start: Number(offset)});
  stream.write(req.body, function () {
    fs.stat(chunkPath, function(err, stats) {
      console.log('Chunk uploaded', chunkPath, 'total size', stats['size']);
      res.json({
        upload_id: upload_id,
        offset: stats.size,
        expires: 'Tue, 19 Jul 2021 21:55:38 +0000'});
    });
  });
});

router.post('/commit_chunked_upload/sandbox/*', parseOAuthHeader, verifyOAuthSecret, function(req, res, next) {
  console.log('/commit_chunked_upload/sandbox/', req.params[0], req.body.upload_id);
  if (req.body.upload_id) {
    var chunkPath = paths.getChunkPath(req.oauthToken, req.body.upload_id);
    var datapath = paths.getDataPath(req.oauthToken, req.params[0]);

    var dir = path.dirname(datapath);
    fs.mkdirp(dir, function(err) {
      if (err) {
        res.sendStatus(500);
      } else {
        fs.rename(chunkPath, datapath, function(err) {
          fs.stat(datapath, function(err, stats) {
            res.json({
              bytes: stats.size,
              path: '/' + req.params[0],
              modified: moment(stats.mtime).format(dateFormat),
            });
          });
        });
      }
    });
  } else {
    res.sendStatus(400);
  }
});

router.get('/metadata/sandbox/*', parseOAuthHeader, verifyOAuthSecret, function(req, res, next) {
  console.log('/metadata/sandbox/', req.params[0]);
    var fullPath = paths.getDataPath(req.oauthToken, req.params[0]);
    fs.stat(fullPath, function(err, stats) {
      if(err) {
        res.sendStatus(404);
      } else {
        res.json({
          bytes: stats.size,
          path: '/' + req.params[0],
          modified: moment(stats.mtime).utc().format(dateFormat),
          is_dir: stats.isDirectory()
        });
      }
    });
});

router.post('/fileops/create_folder', parseOAuthHeader, verifyOAuthSecret, function(req, res, next) {
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

router.post('/fileops/delete', parseOAuthHeader, verifyOAuthSecret, function(req, res, next) {
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

router.get('/account/info', parseOAuthHeader, verifyOAuthSecret, function(req, res, next) {
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
