'use strict';
var BaseEvent = require('./base_event');
var util = require('util');

function ApplicationEvent(properties) {
  BaseEvent.call(this, properties);
}

util.inherits(ApplicationEvent, BaseEvent);

ApplicationEvent.QueueName = 'application_event';

ApplicationEvent.prototype.initWithProperties = function (properties) {
  BaseEvent.prototype.initWithProperties.call(this, properties);
  this.applicationId = properties.applicationId;
  this.eventName = properties.eventName;
  this.environment = properties.environment;
  this.sessionId = properties.sessionId;
  this.bucketId = properties.bucketId;
  this.payload = properties.payload;
};

ApplicationEvent.prototype.toJSON = function () {
  var jsonObj = BaseEvent.prototype.toJSON.call(this);
  jsonObj.eventName = this.eventName;
  jsonObj.applicationId = this.applicationId;
  jsonObj.environment = this.environment;
  jsonObj.sessionId = this.sessionId;
  jsonObj.bucketId = this.bucketId;
  jsonObj.payload = this.payload;
  return jsonObj;
};

module.exports = ApplicationEvent;
