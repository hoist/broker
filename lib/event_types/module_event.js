'use strict';
var util = require('util');
var BaseEvent = require('./base_event');

function ModuleEvent(properties) {
  BaseEvent.call(this, properties);
}

util.inherits(ModuleEvent, BaseEvent);

ModuleEvent.QueueName = 'module_run';

ModuleEvent.prototype.initWithProperties = function (properties) {
  BaseEvent.prototype.initWithProperties.call(this, properties);
  this.applicationId = properties.applicationId;
  this.eventName = properties.eventName;
  this.sessionId = properties.sessionId;
  this.environment = properties.environment;
  this.moduleName = properties.moduleName;
  this.payload = properties.payload;
};

ModuleEvent.prototype.toJSON = function () {
  var jsonObj = BaseEvent.prototype.toJSON.call(this);
  jsonObj.eventName = this.eventName;
  jsonObj.applicationId = this.applicationId;
  jsonObj.environment = this.environment;
  jsonObj.sessionId = this.sessionId;
  jsonObj.moduleName = this.moduleName;
  jsonObj.payload = this.payload;
  return jsonObj;
};

module.exports = ModuleEvent;
