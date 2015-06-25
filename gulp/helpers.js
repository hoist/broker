'use strict';
var notifier = require('node-notifier');


module.exports = {
  errorHandler: function (err) {
    notifier.notify({
      title: 'A Gulp error occurred',
      message: err.message
    });
    global.error = err;
    console.log('Error:', err.message, err.stack);
  }
};
