require('dotenv').load();

var express = require('express');
var path = require('path');
var morgan = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');

var app = express();

app.use(morgan('dev', {
  'stream': {
    write: function(str) { console.info(str); }
  }
}));

app.use(bodyParser.raw({limit: '10mb'}));
app.use(bodyParser.urlencoded({extended: false}));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));


if (process.env.DISABLE_V1 == "false")
{
  var authorization = require('./routes/authorization');
  var files = require('./routes/files');

  app.use('/1/oauth', authorization);
  app.use('/1/', files);
  app.use('/', function(req, res, next) {
    res.sendStatus(200);
  });

  // catch 404 and forward to error handler
  app.use(function(req, res, next) {
    var err = new Error('Not Found');
    err.status = 404;
    next(err);
  });
}
else {
  app.use(function(req, res, next) {
    res.status(400).json({error: "v1_retired"});
  });
}


// error handlers
app.use(function(err, req, res, next) {
  console.error(err);
  res.status(err.status || 500);
  if (err.res) {
    res.json(res);
  } else {
    res.end();
  }
});

module.exports = app;
