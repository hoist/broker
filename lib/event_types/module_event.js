'use strict';
var util = require('util');
var BaseEvent = require('./base_event');

function ModuleEvent(brokeredMessageOrProperties) {
  BaseEvent.call(this, brokeredMessageOrProperties);
}

util.inherits(ModuleEvent, BaseEvent);

ModuleEvent.QueueName = 'module.run';

ModuleEvent.prototype.convertToBrokeredMessage = function () {
  var brokeredMessage = BaseEvent.prototype.convertToBrokeredMessage.call(this);
  brokeredMessage.customProperties = {
    applicationid: this.applicationId,
    environment: this.environment,
    eventname: this.eventName,
    sessionid: this.sessionId,
    modulename: this.moduleName
  };
  if (this.payload) {
    brokeredMessage.body = JSON.stringify(this.payload);
  }
  return brokeredMessage;
};
ModuleEvent.prototype.initWithBrokeredMessage = function (brokeredMessage) {
  /* istanbul ignore if */
  if (!brokeredMessage) {
    return;
  }
  BaseEvent.prototype.initWithBrokeredMessage.call(this, brokeredMessage);
  /* istanbul ignore else */
  if (brokeredMessage.customProperties) {
    this.applicationId = brokeredMessage.customProperties.applicationid;
    this.eventName = brokeredMessage.customProperties.eventname;
    this.environment = brokeredMessage.customProperties.environment;
    this.sessionId = brokeredMessage.customProperties.sessionid;
    this.moduleName = brokeredMessage.customProperties.modulename;
  }
  for (var i in brokeredMessage.customProperties) {
    if (brokeredMessage.customProperties[i] === null || brokeredMessage.customProperties[i] === undefined) {
      // test[i] === undefined is probably not very useful here
      delete brokeredMessage.customProperties[i];
    }
  }
  if (brokeredMessage.body) {
    this.payload = JSON.parse(brokeredMessage.body);
  }
};

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
