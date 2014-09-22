'use strict';
var util = require('util');
var events = require('events');

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
}

util.inherits(BaseEvent, events.EventEmitter);
BaseEvent.QueueName = 'Subclasses should define their own queue name';
BaseEvent.prototype.convertToBrokeredMessage = function () {
  var message = {
    brokerProperties: {}
  };
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
BaseEvent.prototype.toJSON = function(){
  return {
    messageId:this.messageId,
    correlationId:this.correlationId
  };
};

module.exports = BaseEvent;
