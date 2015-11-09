require('dotenv').load();

var express = require('express');
var path = require('path');
var logger = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');

var app = express();

app.use(logger('dev'));
app.use(bodyParser.raw({limit: '10mb'}));
app.use(bodyParser.urlencoded({extended: false}));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

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

// error handlers
app.use(function(err, req, res, next) {
  console.error(err);
  console.error(err.stack);
  res.sendStatus(err.status || 500);
});

module.exports = app;
