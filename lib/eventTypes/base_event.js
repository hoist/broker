'use strict';
var util = require('util');
var events = require('events');

var BaseEvent = function () {
  events.EventMitter.call(this);
  var listenInterval;
  var subscribeInterval;
  this.listen= function () {
    if (listenInterval) {
      return;
    }
    if (!this.process) {

    }
  };
  this.unlisten= function () {
    if(subscribeInterval){
      return;
    }
  };
};

BaseEvent.prototype = {

};

util.inherits(BaseEvent,events.EventEmitter);

module.exports = BaseEvent;


