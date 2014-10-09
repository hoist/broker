'use strict';
var BaseEvent = require('./base_event');
var ModuleEvent = require('./module_event');
var util = require('util');
var Application = require('hoist-model').Application;
var hoistErrors = require('hoist-errors');
var BBPromise = require('bluebird');
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
    eventname: this.eventName,
    sessionid: this.sessionId
  };
  brokeredMessage.body = JSON.stringify(this.payload);
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
    this.sessionId = brokeredMessage.customProperties.sessionid;
  }
  this.payload = JSON.parse(brokeredMessage.body);
};
ApplicationEvent.prototype.initWithProperties = function (properties) {
  BaseEvent.prototype.initWithProperties.call(this, properties);
  this.applicationId = properties.applicationId;
  this.eventName = properties.eventName;
  this.environment = properties.environment;
  this.sessionId = properties.sessionId;
  this.payload = properties.payload;
};

ApplicationEvent.prototype.toJSON = function () {
  var jsonObj = BaseEvent.prototype.toJSON.call(this);
  jsonObj.eventName = this.eventName;
  jsonObj.applicationId = this.applicationId;
  jsonObj.environment = this.environment;
  jsonObj.sessionId = this.sessionId;
  jsonObj.payload = this.payload;
  return jsonObj;
};

ApplicationEvent.prototype.process = function (callback) {
  var self = this;
  return BBPromise.try(function emitStart() {
    self.emit('log.step', 'message:received');
  }).then(function lookUpApplication() {
    return Application.findOneAsync({
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
          sessionId: self.sessionId,
          eventName: self.eventName,
          payload: self.payload
        });
        self.emit('createEvent', moduleEvent);
        self.emit('publishEvent', moduleEvent);
      };
      return BBPromise.all(
        _.map(ev.modules, moduleMapper)
      );
    }
  }).then(function () {
    self.emit('log.step', 'message:processed');
  }).then(function () {
    self.emit('done');
  }).catch(function (err) {
    if (err instanceof hoistErrors.model.NotFoundError) {
      self.emit('log.error', err);
    } else {
      throw err;
    }
  }).nodeify(callback);
};
module.exports = ApplicationEvent;
