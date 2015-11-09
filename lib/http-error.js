module.exports.makeError = function(message, status) {
  var error = new Error(message);
  error.status = status;
  return error;
};
