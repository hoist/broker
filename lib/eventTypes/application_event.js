'use strict';
var BaseEvent = require('./base_event');
var ModuleEvent = require('./module_event');
var util = require('util');
var Application = require('hoist-model').Application;
var EventBroker = require('../event_broker');
var hoistErrors = require('hoist-errors');
var q = require('q');
var _ = require('lodash');

var ApplicationEvent = function () {
  BaseEvent.call(this);
};

util.inherits(ApplicationEvent, BaseEvent);

ApplicationEvent.QueueName = 'application.event';

ApplicationEvent.prototype.process = function () {
  var self = this;
  return q.fcall(function emitStart() {
    self.emit('log.step', 'message:received', self);
  }).then(function lookUpApplication() {
    return Application.findOneQ({
      _id: self.applicationid
    });
  }).then(function lookUpEvent(application) {
    if (!application) {
      var error = new hoistErrors.model.application.NotFoundError();
      throw error;
    }
    return application.settings[self.environment].on[self.eventname];
  }).then(function processEvent(ev) {
    if (ev) {
      var moduleMapper = function (module) {
        var moduleEvent = new ModuleEvent(module, ev);
        EventBroker.send(moduleEvent);
      };
      return q.all(
        _.map(ev.modules, moduleMapper)
      );
    }
  }).then(function () {
    self.emit('log.step', 'message:processed', self);
  }).fail(function (err) {
    if (err instanceof hoistErrors.model.NotFoundError) {
      self.emit('log.error', 'message:error', self, err);
    } else {
      throw err;
    }
  });
};
