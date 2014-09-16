'use strict';
var azure = require('azure');
var q = require('q');
var _ = require('lodash');
var models = require('hoist-model');
var Application = models.Application;
var EventBroker = function () {
  _.bindAll(this);
};
EventBroker.prototype = {
  start: function () {
    var serviceBusService = azure.createServiceBusService();
    return q.ninvoke(serviceBusService, 'createQueueIfNotExists', 'application.event')
      .then(_.bind(function () {
        return serviceBusService.receiveQueueMessage('application.event', {
          isPeekLock: true
        }, this.processApplicationEvent);
      }, this));
  },
  processApplicationEvent: function (err, applicationEvent) {
    return q.fcall(_.bind(function throwIfError() {
      return this.logApplicationEvent('message.received', applicationEvent);
    }, this)).then(function lookUpApplication() {
      return Application.findOneQ({
        _id: applicationEvent.applicationId
      });
    }).then(function lookUpEvent(application) {
      return application.settings[applicationEvent.environment].on[applicationEvent.eventName];
    }).then(_.bind(function processEvent(ev) {
      var moduleMapper = _.bind(function (module) {
        return this.fireModuleEvent(module, applicationEvent);
      }, this);
      return q.all(
        _.map(ev.modules, moduleMapper)
      );
    }, this)).then(function () {
      var serviceBusService = azure.createServiceBusService();
      return q.ninvoke(serviceBusService, 'deleteMessage', applicationEvent);
    });
  },
  fireModuleEvent: function (module, originalEvent) {
    var newEvent = _.cloneDeep(originalEvent);
    newEvent.moduleName = module;
    var serviceBusService = azure.createServiceBusService();
    return q.ninvoke(serviceBusService, 'createQueueIfNotExists', 'module.run')
      .then(_.bind(function () {
        return q.ninvoke(serviceBusService, 'sendQueueMessage', 'module.run', newEvent)
          .then(_.bind(function () {
            return this.logApplicationEvent('message.sent', newEvent);
          }, this));
      }, this));
  },
  logApplicationEvent: function (step, ev) {
    var loggedEvent = _.cloneDeep(ev);
    var serviceBusService = azure.createServiceBusService();
    return q.ninvoke(serviceBusService, 'createTopicIfNotExists', 'event.log')
      .then(function () {
        return q.ninvoke(serviceBusService, 'sendTopicMessage', 'event.log', {
          data: loggedEvent,
          step: step,
          eventName: 'application.event'
        });
      });
  }
};

module.exports = EventBroker;
