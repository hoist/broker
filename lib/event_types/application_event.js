'use strict';
var BaseEvent = require('./base_event');
var ModuleEvent = require('./module_event');
var util = require('util');
var Application = require('hoist-model').Application;
var hoistErrors = require('hoist-errors');
var q = require('q');
var _ = require('lodash');

function ApplicationEvent(brokeredMessageOrProperties) {
  BaseEvent.call(this, brokeredMessageOrProperties);
}

util.inherits(ApplicationEvent, BaseEvent);

ApplicationEvent.QueueName = 'application.event';
ApplicationEvent.prototype.convertToBrokeredMessage = function () {
  var brokeredMessage = BaseEvent.prototype.convertToBrokeredMessage.call(this);
  brokeredMessage.customProperties = {
    applicationid: this.applicationId,
    environment: this.environment,
    eventname: this.eventName
  };
  brokeredMessage.body = JSON.stringify(this.body);
  return brokeredMessage;
};
ApplicationEvent.prototype.initWithBrokeredMessage = function (brokeredMessage) {
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
  }
  this.body = JSON.parse(brokeredMessage.body);
};
ApplicationEvent.prototype.initWithProperties = function (properties) {
  BaseEvent.prototype.initWithProperties.call(this, properties);
  this.applicationId = properties.applicationId;
  this.eventName = properties.eventName;
  this.environment = properties.environment;
  this.body = properties.body;
};

ApplicationEvent.prototype.toJSON = function(){
  var jsonObj = BaseEvent.prototype.toJSON.call(this);
  jsonObj.eventName = this.eventName;
  jsonObj.applicationId = this.applicationId;
  jsonObj.environment = this.environment;
  jsonObj.body = this.body;
  return jsonObj;
};

ApplicationEvent.prototype.process = function () {
  var self = this;
  return q.fcall(function emitStart() {
    self.emit('log.step', 'message:received');
  }).then(function lookUpApplication() {
    return Application.findOneQ({
      _id: self.applicationid
    });
  }).then(function lookUpEvent(application) {
    if (!application) {
      var error = new hoistErrors.model.application.NotFoundError();
      throw error;
    }
    return application.settings[self.environment].on[self.eventName];
  }).then(function processEvent(ev) {
    if (ev) {
      var moduleMapper = function (module) {
        var moduleEvent = new ModuleEvent({
          moduleName: module,
          correlationId: self.correlationId,
          applicationId: self.applicationId,
          environment: self.environment,
          eventName: self.eventName,
          body:self.body
        });
        self.emit('createEvent', moduleEvent);
      };
      return q.all(
        _.map(ev.modules, moduleMapper)
      );
    }
  }).then(function () {
    self.emit('log.step', 'message:processed');
  }).then(function(){
    self.emit('done');
  }).fail(function (err) {
    if (err instanceof hoistErrors.model.NotFoundError) {
      self.emit('log.error', err);
    } else {
      throw err;
    }
  });
};
module.exports = ApplicationEvent;
