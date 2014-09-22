'use strict';
var azure = require('azure');
var config = require('config');
var StepLogEvent = require('./event_types/step_log_event');
var ErrorLogEvent = require('./event_types/error_log_event');
var _serviceBus;

var EventBroker = {
  listeners: {

  },
  subscriptions: {

  },
  resetServiceBus: function () {
    _serviceBus = null;
  },
  serviceBus: function () {
    return _serviceBus || (_serviceBus = azure.createServiceBusService(config.azure.servicebus.main.connectionString));
  },
  subscribe: function (EventType, callback) {
    //already subscribed
    if (EventBroker.subscriptions[EventType.name]) {
      return callback();
    }
    EventBroker.serviceBus().createTopicIfNotExists(EventType.QueueName, function (err) {
      /* istanbul ignore else */
      if (!err) {
        EventBroker.serviceBus().getSubscription(EventType.QueueName, 'All', function (err) {
          var setupSubscription = function () {
            EventBroker.subscriptions[EventType.name] = setInterval(function () {
              EventBroker.serviceBus().receiveSubscriptionMessage(EventType.QueueName, 'All', {
                timeoutIntervalInS: Math.max(config.timers.subscriptionTimeout / 1000, 1)
              }, function (err, brokeredMessage) {
                if (!err) {
                  var ev = new EventType(brokeredMessage);
                  EventBroker.process(ev);
                } else {
                  console.warn(err);
                }
              });
            }, config.timers.subscriptionTimeout);
            return callback();
          };
          /* istanbul ignore else */
          if (err) {
            EventBroker.serviceBus().createSubscription(EventType.QueueName, 'All', function (err) {
              /* istanbul ignore else */
              if (!err) {
                return setupSubscription();
              } else {
                if (callback) {
                  return callback(err);
                }
              }
            });
          } else {
            return setupSubscription();
          }
        });
      } else {
        if (callback) {
          return callback(err);
        }
      }
    });
  },
  unsubscribe: function (EventType) {
    /* istanbul ignore else */
    if (EventBroker.subscriptions[EventType.name]) {
      clearInterval(EventBroker.subscriptions[EventType.name]);
      delete EventBroker.subscriptions[EventType.name];
    }
  },
  send: function (ev, callback) {
    EventBroker.serviceBus().createQueueIfNotExists(ev.constructor.QueueName, function (err) {
      /* istanbul ignore else */
      if (!err) {
        EventBroker.serviceBus().sendQueueMessage(ev.constructor.QueueName, ev.convertToBrokeredMessage(), callback || function () {});
      } else if (callback) {
        callback(err);
      }
    });
  },
  publish: function (ev, callback) {
    EventBroker.serviceBus().createTopicIfNotExists(ev.constructor.QueueName, function (err) {
      /* istanbul ignore else */
      if (!err) {
        EventBroker.serviceBus().sendTopicMessage(ev.constructor.QueueName, ev.convertToBrokeredMessage(), callback);
      } else if (callback) {
        callback(err);
      }
    });
  },
  listen: function (EventType, callback) {
    if (EventBroker.listeners[EventType.name]) {
      return callback();
    }
    EventBroker.serviceBus().createQueueIfNotExists(EventType.QueueName, function (err) {
      /* istanbul ignore else */
      if (!err) {
        EventBroker.listeners[EventType.name] = setInterval(function () {
          EventBroker.serviceBus().receiveQueueMessage(EventType.QueueName, {
            timeoutIntervalInS: Math.max(config.timers.listenTimeout / 1000, 1)
          }, function (err, brokeredMessage) {
            if (!err) {
              var ev = new EventType(brokeredMessage);
              ev.process();
            } else {
              console.warn(err);
            }
          });
        }, config.timers.listenTimeout);
        return callback();
      } else {
        if (callback) {
          return callback(err);
        }
      }

    });
  },
  unlisten: function (EventType) {
    /* istanbul ignore else */
    if (EventBroker.listeners[EventType.name]) {
      clearInterval(EventBroker.listeners[EventType.name]);
      delete EventBroker.listeners[EventType.name];
    }
  },
  process: function (ev) {
    ev.on('createEvent', function (newEvent) {
      EventBroker.send(newEvent);
    }).on('log.step', function (stepName) {
      var logEvent = {
        applicationId: ev.applicationId,
        environment: ev.environment,
        stepName: stepName,
        correlationId: ev.correlationId,
        baseEvent: ev.toJSON()
      };
      EventBroker.send(new StepLogEvent(logEvent));
    }).on('log.error', function (error) {
      var logEvent = {
        applicationId: ev.applicationId,
        environment: ev.environment,
        correlationId: ev.correlationId,
        baseEvent: ev.toJSON(),
        error: error.message||error.toString()
      };
      EventBroker.send(new ErrorLogEvent(logEvent));
    }).process();
  }
};

module.exports = EventBroker;
