'use strict';

var _model;
module.exports = {
  get:function(){
    return _model||(_model = require('@hoist/model'));
  },
  set:/* istanbul ignore next */ function(model){
    _model = model;
  }
};
