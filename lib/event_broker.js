'use strict';
//var azure = require('azure');
var config = require('config');
var logger = require('hoist-logger');
var _ = require('lodash');

function EventBroker(configuration, messageBus) {
  var defaults = {
    timers: {
      subscriptionTimeout: 5000,
      listenTimeout: 5000
    }
  };
  config.util.extendDeep(defaults, configuration);
  config.util.setModuleDefaults('Hoist', defaults);
  if (!messageBus) {
    var MessageBus = require('./' + config.get('Hoist.messageBus.type') + '_message_bus');
    this.messageBus = messageBus || new MessageBus();
  } else {
    /* istanbul ignore next */
    this.messageBus = messageBus;
  }
  this.concurrentMessageCount = {};
  _.bindAll(this);
}

EventBroker.events = require('./event_types');
EventBroker.ModelResolver = require('./model_resolver');

EventBroker.prototype = {
  send: function (ev, callback) {
    logger.info({
      eventId: ev.messageId,
      applicationId: ev.applicationId,
      correlationId: ev.correlationId,
      type: ev.constructor.name
    }, 'sending event');

    if (ev.constructor.name === 'ApplicationEvent') {
      logger.keen('event:raised', {
        applicationId: ev.applicationId,
        eventName: ev.eventName,
        eventId: ev.messageId
      });
    }
    if (ev.constructor.name === 'ModuleEvent') {
      logger.keen('module:queued', {
        applicationId: ev.applicationId,
        moduleName: ev.moduleName,
        eventId: ev.messageId
      });
    }

    return this.messageBus.send(ev, callback);
  },
  listen: function (EventType, callback) {
    logger.info({
      eventType: EventType.name
    }, 'loading event listener');
    return this.messageBus.listen(EventType, this.process, callback);
  },
  unlisten: function (EventType) {
    logger.info({
      eventType: EventType.name
    }, 'unloading event listener');
    return this.messageBus.unlisten(EventType);
  },

  logError: /* istanbul ignore next */ function (ev, error) {
    var logEvent = {
      applicationId: ev.applicationId,
      environment: ev.environment,
      correlationId: ev.correlationId,
      baseEvent: ev.toJSON(),
      error: error.message || error.toString()
    };
    logger.error(logEvent);
  },

  logStep: /* istanbul ignore next */ function (ev, stepName) {
    var logEvent = {
      applicationId: ev.applicationId,
      environment: ev.environment,
      stepName: stepName,
      correlationId: ev.correlationId,
      baseEvent: ev.toJSON()
    };
    logger.info(logEvent);
  },
  process: function (ev) {

    var self = this;
    self.concurrentMessageCount[ev.constructor.name] = self.concurrentMessageCount[ev.constructor.name] || 0;
    self.concurrentMessageCount[ev.constructor.name] ++;
    if (config.has('Hoist.messageBus.concurrentMessages')) {
      if (self.concurrentMessageCount[ev.constructor.name] >= config.get('Hoist.messageBus.concurrentMessages')) {
        self.messageBus.pause(ev.constructor);
      }
    }
    logger.info({
      event: ev
    }, 'processing event');
    ev.on('createEvent', function (newEvent) {
      self.send(newEvent);
    }).on('log.step', /* istanbul ignore next */ function (stepName) {
      logger.info({
        stepName: stepName,
        eventId: ev.messageId,
        applicationId: ev.applicationId,
        correlationId: ev.correlationId,
        type: ev.constructor.name
      }, 'logging step');
      self.logStep(ev, stepName);
    }).on('log.error', /* istanbul ignore next */ function (error) {
      logger.info({
        error: error,
        eventId: ev.messageId,
        applicationId: ev.applicationId,
        correlationId: ev.correlationId,
        type: ev.constructor.name
      }, 'logging error');
      self.logError(ev, error);
    }).on('done', function () {
      logger.info({
        eventId: ev.messageId,
        applicationId: ev.applicationId,
        correlationId: ev.correlationId,
        type: ev.constructor.name
      }, 'finished with event');
      logger.debug({
        event: ev
      }, 'event');
      self.messageBus.delete(ev);
    }).process().catch( /* istanbul ignore next */ function (err) {
      logger.error({
        eventId: ev.messageId,
        applicationId: ev.applicationId,
        correlationId: ev.correlationId,
        type: ev.constructor.name
      }, 'unable to process event');
      logger.debug({
        event: ev
      }, 'event');
      logger.error(err);
      logger.alert(err, ev.applicationId);
    }).finally(function () {
      console.log(self.messageBus);
      self.concurrentMessageCount[ev.constructor.name] = self.concurrentMessageCount[ev.constructor.name] || 0;
      self.concurrentMessageCount[ev.constructor.name] --;
      if (!config.has('Hoist.messageBus.concurrentMessages') ||
        self.concurrentMessageCount[ev.constructor.name] < config.get('Hoist.messageBus.concurrentMessages')) {
        self.messageBus.resume(ev.constructor);
      }
    }).done();
  }
};

module.exports = EventBroker;
