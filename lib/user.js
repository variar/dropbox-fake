var crc = require('crc');

module.exports.getUserId = function(token) {
  return crc.crc32(token) >>> 0;
};
