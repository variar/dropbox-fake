module.exports.makeError = function(message, status) {
  var error = new Error(message);
  error.status = status;
  return error;
};

module.exports.makeError = function(message, status, response) {
  var error = new Error(message);
  error.status = status;
  error.res = response;
  return error;
};
