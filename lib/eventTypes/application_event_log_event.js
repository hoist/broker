'use strict';
var BaseEvent = require('./base_event');
var util = require('util');
var ApplicationEventLogEvent = function (step, baseEvent) {
  BaseEvent.call(this, baseEvent);
  this.step = step;
  this.baseEvent = baseEvent;
};

util.inherits(ApplicationEventLogEvent, BaseEvent);

ApplicationEventLogEvent.prototype.queueName = 'event.log';

ApplicationEventLogEvent.prototype.convertToBrokeredMessage = function () {
  var brokeredMessage = ApplicationEventLogEvent.super_.prototype.convertToBrokeredMessage.call(this);
  brokeredMessage.customProperties.step = this.step;
  brokeredMessage.body = JSON.stringify(this.baseEvent);
  return brokeredMessage;
};


module.exports = ApplicationEventLogEvent;
