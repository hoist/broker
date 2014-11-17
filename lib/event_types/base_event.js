'use strict';
var util = require('util');
var events = require('events');
var uuid = require('uuid');
function BaseEvent(brokeredMessageOrProperties) {
  events.EventEmitter.call(this);
  if (!brokeredMessageOrProperties) {
    return;
  }
  if (brokeredMessageOrProperties.brokerProperties) {
    //treat as a brokered message
    this.initWithBrokeredMessage(brokeredMessageOrProperties);
  } else {
    //treat as properties
    this.initWithProperties(brokeredMessageOrProperties);
  }
  this.messageId = this.messageId || uuid.v4().split('-').join('');
}

util.inherits(BaseEvent, events.EventEmitter);
BaseEvent.QueueName = 'Subclasses should define their own queue name';
BaseEvent.prototype.setModel = function (model) {
  this.model = model;
};
BaseEvent.prototype.getModel = function () {
  return this.model || require('hoist-model');
};
BaseEvent.prototype.convertToBrokeredMessage = function () {
  var message = {
    brokerProperties: {}
  };
  if (this.location) {
    message.location = this.location;
  }
  /* istanbul ignore else */
  if (this.correlationId) {
    message.brokerProperties.CorrelationId = this.correlationId;
  }
  /* istanbul ignore else */
  if (this.messageId) {
    message.brokerProperties.MessageId = this.messageId;
  }
  return message;
};
BaseEvent.prototype.process = function () {
  throw new Error('Subclasses should override this method');
};
BaseEvent.prototype.initWithBrokeredMessage = function (brokeredMessage) {
  this.location = brokeredMessage.location;
  /* istanbul ignore else */
  if (brokeredMessage.brokerProperties) {
    var brokerProperties = brokeredMessage.brokerProperties;
    /* istanbul ignore else */
    if (brokerProperties.CorrelationId) {
      this.correlationId = brokerProperties.CorrelationId;
    }
    /* istanbul ignore else */
    if (brokerProperties.MessageId) {
      this.messageId = brokerProperties.MessageId;
    }
  }
};
BaseEvent.prototype.initWithProperties = function (properties) {
  this.messageId = properties.messageId;
  this.correlationId = properties.correlationId;
};
BaseEvent.prototype.toJSON = function () {
  return {
    messageId: this.messageId,
    correlationId: this.correlationId
  };
};

module.exports = BaseEvent;
