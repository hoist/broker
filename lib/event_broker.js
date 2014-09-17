'use strict';
var azure = require('azure');
var q = require('q');
var _ = require('lodash');
var models = require('hoist-model');
var Application = models.Application;
var config = require('config');

var EventBroker = function () {};

EventBroker.prototype = {
  serviceBus: function () {
    return this._serviceBus ||
      (this._serviceBus = azure.createServiceBusService(config.azure.servicebus.main.connectionString));
  },
  start: function () {
    var self = this;
    return q.ninvoke(self.serviceBus(), 'createQueueIfNotExists', 'application.event')
      .then(function () {
        return self.serviceBus().receiveQueueMessage('application.event', {
          isPeekLock: true
        }, _.bind(self.processApplicationEvent, self));
      });
  },
  processApplicationEvent: function (err, applicationEvent) {
    var self = this;

    return q.fcall(function throwIfError() {

      return self.logApplicationEvent('message:received', applicationEvent);
    }).then(function lookUpApplication() {

      return Application.findOneQ({
        _id: applicationEvent.customProperties.applicationid
      });
    }).then(function lookUpEvent(application) {

      return application.settings[applicationEvent.customProperties.environment].on[applicationEvent.customProperties.eventname];
    }).then(function processEvent(ev) {
      var moduleMapper = function (module) {
        return self.fireModuleEvent(module, applicationEvent);
      };
      return q.all(
        _.map(ev.modules, moduleMapper)
      );
    }).then(function () {
      return q.ninvoke(self.serviceBus(), 'deleteMessage', applicationEvent);
    });
  },
  fireModuleEvent: function (module, originalEvent) {
    var self = this;
    var newEvent = {
      brokerProperties: {
        CorrelationId: originalEvent.brokerProperties.CorrelationId
      },
      customProperties: _.cloneDeep(originalEvent.customProperties),
      body: originalEvent.body
    };
    newEvent.customProperties.modulename = module;
    return q.ninvoke(this.serviceBus(), 'createQueueIfNotExists', 'module.run')
      .then(function () {
        return q.ninvoke(self.serviceBus(), 'sendQueueMessage', 'module.run', newEvent)
          .then(function () {
            return self.logApplicationEvent('message:sent', newEvent);
          });
      });
  },
  logApplicationEvent: function (step, ev) {
    var self = this;

    var loggedEvent = _.cloneDeep(ev.customProperties);
    loggedEvent.data = JSON.parse(ev.body);
    try {
      self.serviceBus().createTopicIfNotExists('event.log', function () {
        self.serviceBus().sendTopicMessage('event.log', {
          body: JSON.stringify(loggedEvent),
          brokerProperties: {
            CorrelationId: ev.brokerProperties.CorrelationId
          },
          customProperties: {
            step: step,
            eventname: 'application:event'
          }
        }, function () {});
      });
    } catch (e) {

    }
  }
};

module.exports = EventBroker;
