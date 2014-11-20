'use strict';
var BaseEvent = require('./base_event');
var ModuleEvent = require('./module_event');
var util = require('util');
var hoistErrors = require('hoist-errors');
var BBPromise = require('bluebird');
var _ = require('lodash');
var logger = require('hoist-logger');
var ModelResolver = require('../model_resolver');
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
    return ModelResolver.get().Application.findOneAsync({
      _id: self.applicationId
    }).catch(function (err) {
      logger.error(err);
      throw err;
    });
  }).then(function lookUpEvent(application) {
    if (!application) {
      var error = new hoistErrors.model.application.NotFoundError();
      throw error;
    }
    var settings = application.settings[self.environment];
    return settings.on[self.eventName];
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
    logger.keen('event:processed',{
      applicationId:self.applicationId,
      eventName:self.eventName,
      eventId: self.messageId
    });
    self.emit('done');
  }).catch(function (err) {
    logger.error(err);
    logger.alert(err, self.applicationId);
    if (err instanceof hoistErrors.model.NotFoundError) {
      self.emit('log.error', err);
    } else {
      throw err;
    }
  }).nodeify(callback);
};
module.exports = ApplicationEvent;
