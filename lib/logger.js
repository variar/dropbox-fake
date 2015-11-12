var path = require('path');
var moment = require('moment');
var fs = require('fs-extra');
var util = require('util');

var pjson = require('../package');

var logFile = util.format('%s_%s_%s_%d.log',
  pjson.name, pjson.version, moment().format('MM.DD_HH.mm'), process.pid);

var fullLogPath = path.join(process.env.LOG_DIR, logFile);
fs.mkdirpSync(path.dirname(fullLogPath));

var rufus = require('rufus');
rufus.config({
  handlers: {
   'terminal': {
     'class': rufus.handlers.Console,
     'level': rufus.VERBOSE,
     colorize: false
   },
   'logfile': {
     'class': rufus.handlers.File,
     'level': rufus.VERBOSE,
     'file': fullLogPath,
   }
 },
 loggers: {
   'root': {
     'handlers': ['terminal', 'logfile'],
     'level': 'DEBUG',
     'handleExceptions': true,
     'exitOnError': false,
     'propagate': false
   },
 }
});

rufus.console();
