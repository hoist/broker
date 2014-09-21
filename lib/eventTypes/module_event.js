'use strict';
var util = require('util');
var BaseEvent = require('./base_event');

var ModuleEvent = function (moduleName) {
  if (!moduleName) {

  }
  BaseEvent.call(this);
};

util.inherits(ModuleEvent, BaseEvent);

ModuleEvent.QueueName = 'module.run';

ModuleEvent.prototype.convertToBrokeredMessage = function () {
  var brokeredMessage = ModuleEvent.super_.prototype.convertToBrokeredMessage.call(this);
  brokeredMessage.customProperties.modulename = module;
  return brokeredMessage;
};
