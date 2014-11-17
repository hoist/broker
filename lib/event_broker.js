'use strict';
var azure = require('azure');
var config = require('config');
var StepLogEvent = require('./event_types/step_log_event');
var ErrorLogEvent = require('./event_types/error_log_event');
var BBPromise = require('bluebird');
var logger = require('hoist-logger');
var _serviceBus;
var _ = require('lodash');
var defaultTopicOptions = {
  DeadLetteringOnMessageExpiration: true,
  DeadLetteringOnFilterEvaluationExceptions: true,
  EnableBatchedOperations: true
};
var EventBroker = {
  getModel: function () {
    return EventBroker.model || require('hoist-model');
  },
  configure: function (configuration) {
    var defaults = {
      azure: {
        servicebus: {
          main: {
            connectionString: 'thisshouldbeconfigured'
          }
        }
      },
      timers: {
        subscriptionTimeout: 5000,
        listenTimeout: 5000
      }
    };
    config.util.extendDeep(defaults, configuration);
    config.util.setModuleDefaults('Hoist', defaults);
  },
  listeners: {

  },
  subscriptions: {

  },
  resetServiceBus: function () {
    _serviceBus = null;
  },
  serviceBus: function () {
    return _serviceBus || (_serviceBus = BBPromise.promisifyAll(azure.createServiceBusService(config.get('Hoist.azure.servicebus.main.connectionString'))));
  },
  subscribe: function (EventType, ruleDescOrCallback, callback) {
    var rules;
    if ((!callback) && ruleDescOrCallback && _.isFunction(ruleDescOrCallback)) {
      callback = ruleDescOrCallback;
      ruleDescOrCallback = null;
    } else {
      rules = ruleDescOrCallback;
    }
    //already subscribed
    if (EventBroker.subscriptions[EventType.name]) {
      return BBPromise.resolve(null).nodeify(callback);
    }
    return EventBroker.serviceBus().createTopicIfNotExistsAsync(EventType.QueueName + '.topic', defaultTopicOptions)
      .then(function () {

        var subscriptionName = 'All';
        if (rules && rules.subscriptionName) {
          subscriptionName = rules.subscriptionName;
        }
        return EventBroker.serviceBus().getSubscriptionAsync(EventType.QueueName + '.topic', subscriptionName)
          .catch(function () {

            return EventBroker.serviceBus().createSubscriptionAsync(EventType.QueueName + '.topic', subscriptionName, defaultTopicOptions)
              .then(function () {

                if (rules) {


                  //delete default rule
                  return EventBroker.serviceBus().deleteRuleAsync(EventType.QueueName + '.topic', subscriptionName, azure.Constants.ServiceBusConstants.DEFAULT_RULE_NAME)
                    .then(function () {
                      //create new rules
                      if (rules.rules) {
                        return BBPromise.all(_.map(rules.rules, function (rule) {
                          return EventBroker.serviceBus().createRuleAsync(EventType.QueueName + '.topic', subscriptionName, rule);
                        }));
                      }
                    });
                }
              });
          });
      }).then(function () {
        var subscriptionName = 'All';
        if (rules) {
          subscriptionName = rules.subscriptionName || 'All';
        }
        logger.info({
          eventType: EventType.name
        }, 'loading event subscription');
        EventBroker.subscriptions[EventType.name] = setInterval(function () {
          EventBroker.serviceBus().receiveSubscriptionMessage(EventType.QueueName + '.topic', subscriptionName, {
            timeoutIntervalInS: Math.max(config.get('Hoist.timers.subscriptionTimeout') / 1000, 1),
            isPeekLock: true
          }, function (err, brokeredMessage) {
            if (!err) {
              var ev = new EventType(brokeredMessage);
              ev.model = EventBroker.getModel();
              EventBroker.process(ev);
            } else {
              if (err !== 'No messages to receive') {
                logger.error(err);
              } else {
                logger.debug('no messages');
              }
            }
          });
        }, config.get('Hoist.timers.subscriptionTimeout'));
      }).nodeify(callback);
  },
  unsubscribe: function (EventType) {
    /* istanbul ignore else */
    if (EventBroker.subscriptions[EventType.name]) {
      clearInterval(EventBroker.subscriptions[EventType.name]);
      delete EventBroker.subscriptions[EventType.name];
    }
  },
  send: function (ev, callback) {
    logger.info({
      eventId: ev.messageId,
      applicationId: ev.applicationId,
      correlationId: ev.correlationId,
      type: ev.constructor.name
    }, 'sending event');
    return EventBroker.serviceBus().createQueueIfNotExistsAsync(ev.constructor.QueueName + '.queue', defaultTopicOptions)
      .then(function () {
        if (!(ev instanceof StepLogEvent)) {
          EventBroker.logStep(ev, 'event:send:' + ev.constructor.name);
        }
        return EventBroker.serviceBus().sendQueueMessageAsync(ev.constructor.QueueName + '.queue', ev.convertToBrokeredMessage());
      }).nodeify(callback);
  },
  publish: function (ev, callback) {
    logger.info({
      eventId: ev.messageId,
      applicationId: ev.applicationId,
      correlationId: ev.correlationId,
      type: ev.constructor.name
    }, 'publishing event');
    return EventBroker.serviceBus().createTopicIfNotExistsAsync(ev.constructor.QueueName + '.topic', defaultTopicOptions).then(function () {
      if (!(ev instanceof StepLogEvent)) {
        EventBroker.logStep(ev, 'event:publish:' + ev.constructor.name);
      }
      return EventBroker.serviceBus().sendTopicMessageAsync(ev.constructor.QueueName + '.topic', ev.convertToBrokeredMessage());
    }).nodeify(callback);
  },
  listen: function (EventType, callback) {

    if (EventBroker.listeners[EventType.name]) {
      return BBPromise.resolve(null).nodeify(callback);
    }
    logger.info({
      eventType: EventType.name
    }, 'loading event listener');
    return EventBroker.serviceBus().createQueueIfNotExistsAsync(EventType.QueueName + '.queue', defaultTopicOptions)
      .then(function () {
        EventBroker.listeners[EventType.name] = setInterval(function () {
          EventBroker.serviceBus().receiveQueueMessage(EventType.QueueName + '.queue', {
            timeoutIntervalInS: Math.max(config.get('Hoist.timers.listenTimeout') / 1000, 1),
            isPeekLock: true
          }, function (err, brokeredMessage) {
            if (!err) {
              logger.info('brokered message receieved');
              var ev = new EventType(brokeredMessage);
              ev.model = EventBroker.getModel();
              EventBroker.process(ev);
            } else {
              if (err !== 'No messages to receive') {
                logger.error(err);
              } else {
                logger.debug('no messages');
              }
            }
          });
        }, config.get('Hoist.timers.listenTimeout'));

      }).nodeify(callback);
  },
  unlisten: function (EventType) {
    /* istanbul ignore else */
    if (EventBroker.listeners[EventType.name]) {
      clearInterval(EventBroker.listeners[EventType.name]);
      delete EventBroker.listeners[EventType.name];
    }
  },
  logError: function (ev, error) {
    var logEvent = {
      applicationId: ev.applicationId,
      environment: ev.environment,
      correlationId: ev.correlationId,
      baseEvent: ev.toJSON(),
      error: error.message || error.toString()
    };
    EventBroker.send(new ErrorLogEvent(logEvent));
  },
  logStep: function (ev, stepName) {
    var logEvent = {
      applicationId: ev.applicationId,
      environment: ev.environment,
      stepName: stepName,
      correlationId: ev.correlationId,
      baseEvent: ev.toJSON()
    };
    EventBroker.send(new StepLogEvent(logEvent));
  },
  process: function (ev) {
    logger.info({
      event: ev
    }, 'processing event');
    ev.on('createEvent', function (newEvent) {
      EventBroker.send(newEvent);
    }).on('publishEvent', function (newEvent) {
      EventBroker.publish(newEvent);
    }).on('log.step', function (stepName) {
      logger.info({
        stepName: stepName,
        eventId: ev.messageId,
        applicationId: ev.applicationId,
        correlationId: ev.correlationId,
        type: ev.constructor.name
      }, 'logging step');
      EventBroker.logStep(ev, stepName);
    }).on('log.error', function (error) {
      logger.info({
        error: error,
        eventId: ev.messageId,
        applicationId: ev.applicationId,
        correlationId: ev.correlationId,
        type: ev.constructor.name
      }, 'logging error');
      EventBroker.logError(ev, error);
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
      EventBroker.serviceBus().deleteMessage(ev.convertToBrokeredMessage(), function () {});
    }).process().catch(function (err) {
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
      throw err;
    }).done();
  }
};

module.exports = EventBroker;
