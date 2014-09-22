'use strict';
var BaseEvent = require('./base_event');
var util = require('util');
function StepLogEvent(brokeredMessageOrProperties) {
  BaseEvent.call(this, brokeredMessageOrProperties);
}

util.inherits(StepLogEvent, BaseEvent);

StepLogEvent.QueueName = 'log.step';

StepLogEvent.prototype.initWithBrokeredMessage = function (brokeredMessage) {
  /* istanbul ignore if */
  if (!brokeredMessage) {
    return;
  }
  BaseEvent.prototype.initWithBrokeredMessage.call(this, brokeredMessage);
  /* istanbul ignore else */
  if (brokeredMessage.customProperties) {
    this.applicationId = brokeredMessage.customProperties.applicationid;
    this.stepName = brokeredMessage.customProperties.stepname;
    this.environment = brokeredMessage.customProperties.environment;
  }
  this.baseEvent = JSON.parse(brokeredMessage.body);
};

StepLogEvent.prototype.initWithProperties = function (properties) {
  BaseEvent.prototype.initWithProperties.call(this, properties);
  this.applicationId = properties.applicationId;
  this.environment = properties.environment;
  this.stepName = properties.stepName;
  this.baseEvent = properties.baseEvent;
};

StepLogEvent.prototype.convertToBrokeredMessage = function () {
  var brokeredMessage = BaseEvent.prototype.convertToBrokeredMessage.call(this);
  brokeredMessage.customProperties = {
    applicationid: this.applicationId,
    environment: this.environment,
    stepname:this.stepName
  };
  brokeredMessage.body = JSON.stringify(this.baseEvent);
  return brokeredMessage;
};

StepLogEvent.prototype.toJSON = function(){
  var jsonObj = BaseEvent.prototype.toJSON.call(this);
  jsonObj.stepName = this.stepName;
  jsonObj.applicationId = this.applicationId;
  jsonObj.environment = this.environment;
  jsonObj.baseEvent = this.baseEvent;
  return jsonObj;
};

module.exports = StepLogEvent;
