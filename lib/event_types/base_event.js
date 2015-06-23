'use strict';
var util = require('util');
var events = require('events');
var uuid = require('uuid');

function BaseEvent(properties) {
  events.EventEmitter.call(this);
  if (!properties) {
    return;
  }
  this.initWithProperties(properties);
  this.eventId = this.eventId || this.messageId || uuid.v4().split('-').join('');
  this.messageId = this.eventId;
  this.correlationId = this.correlationId || uuid.v4().split('-').join('');
}

util.inherits(BaseEvent, events.EventEmitter);
BaseEvent.QueueName = 'Subclasses should define their own queue name';
BaseEvent.prototype.setModel = function (model) {
  this.model = model;
};
BaseEvent.prototype.getModel = function () {
  return this.model || require('@hoist/model');
};
BaseEvent.prototype.process = function () {
  throw new Error('Subclasses should override this method');
};
BaseEvent.prototype.initWithProperties = function (properties) {
  this.messageId = properties.messageId;
  this.eventId = properties.eventId;
  this.applicationId = properties.applicationId;
  this.correlationId = properties.correlationId;
  this.payload = properties.payload;
};
BaseEvent.prototype.toJSON = function () {
  return {
    eventId: this.eventId,
    messageId: this.messageId,
    correlationId: this.correlationId,
    applicationId: this.applicationId,
    payload: this.payload
  };
};

module.exports = BaseEvent;
