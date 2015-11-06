var express = require('express');
var path = require('path');
var logger = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var range = require('express-range');

var oauth = require('./routes/oauth');
var files = require('./routes/files');

var app = express();

// uncomment after placing your favicon in /public
//app.use(favicon(path.join(__dirname, 'public', 'favicon.ico')));
app.use(logger('dev'));
app.use(bodyParser.raw({limit: '10mb'}));
app.use(bodyParser.urlencoded({extended: false}));
app.use(cookieParser());
app.use(range({
  accept: 'bytes',
  limit:1024*1024*1024*100
}));
app.use(express.static(path.join(__dirname, 'public')));

app.use('/1/oauth', oauth);

app.use('/1', files);

app.use('/', function(req, res, next) {
  res.sendStatus(200);
});

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  var err = new Error('Not Found');
  err.status = 404;
  next(err);
});

// error handlers
app.use(function(err, req, res, next) {
  console.log(err);
  res.status(err.status || 500).send(err.stack);
});

module.exports = app;
