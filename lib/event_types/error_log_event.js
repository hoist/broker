'use strict';
var util = require('util');
var StepLogEvent = require('./step_log_event');
function ErrorLogEvent(brokeredMessageOrProperties){
  StepLogEvent.call(this,brokeredMessageOrProperties);
}
util.inherits(ErrorLogEvent,StepLogEvent);


ErrorLogEvent.QueueName = 'log.error';

ErrorLogEvent.prototype.initWithBrokeredMessage = function (brokeredMessage) {
  /* istanbul ignore if */
  if (!brokeredMessage) {
    return;
  }
  StepLogEvent.prototype.initWithBrokeredMessage.call(this, brokeredMessage);
  /* istanbul ignore else */
  if (brokeredMessage.customProperties) {
    this.error = brokeredMessage.customProperties.error;
  }
};

ErrorLogEvent.prototype.initWithProperties = function (properties) {
  StepLogEvent.prototype.initWithProperties.call(this, properties);
  this.error = properties.error;
};

ErrorLogEvent.prototype.convertToBrokeredMessage = function () {
  var brokeredMessage = StepLogEvent.prototype.convertToBrokeredMessage.call(this);
  brokeredMessage.customProperties.error = this.error;
  return brokeredMessage;
};

ErrorLogEvent.prototype.toJSON = function(){
  var jsonObj = StepLogEvent.prototype.toJSON.call(this);
  jsonObj.error = this.error;
  return jsonObj;
};

module.exports = ErrorLogEvent;
