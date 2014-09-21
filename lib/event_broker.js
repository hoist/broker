'use strict';
var azure = require('azure');
var config = require('config');
var _serviceBus;

var EventBroker = {
  listeners: {

  },
  subscriptions: {

  },
  resetServiceBus:function(){
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
      if (!err) {
        EventBroker.serviceBus().getSubscription(EventType.QueueName, 'All', function (err) {
          var setupSubscription = function () {
            EventBroker.subscriptions[EventType.name] = setInterval(function () {
              EventBroker.serviceBus().receiveSubscriptionMessage(EventType.QueueName, 'All', {
                timeoutIntervalInS: Math.max(config.timers.subscriptionTimeout/1000,1)
              }, function (err, brokeredMessage) {
                if (!err) {
                  var ev = new EventType(brokeredMessage);
                  ev.process();
                } else {
                  console.warn(err);
                }
              });
            }, config.timers.subscriptionTimeout);
            return callback();
          };
          if (err) {
            EventBroker.serviceBus().createSubscription(EventType.QueueName, 'All', function (err) {
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
    if (EventBroker.subscriptions[EventType.name]) {
      clearInterval(EventBroker.subscriptions[EventType.name]);
      delete EventBroker.subscriptions[EventType.name];
    }
  },
  send: function (event, callback) {

    EventBroker.serviceBus().createQueueIfNotExists(event.queueName, function (err) {
      if (!err) {
        EventBroker.serviceBus().sendQueueMessage(event.QueueName, event.convertToBrokeredMessage(), callback);
      } else if (callback) {
        callback(err);
      }
    });
  },
  publish: function (event, callback) {

    EventBroker.serviceBus().createTopicIfNotExists(event.queueName, function (err) {
      if (!err) {
        EventBroker.serviceBus().sendTopicMessage(event.QueueName, event.convertToBrokeredMessage(), callback);
      } else if (callback) {
        callback(err);
      }
    });
  },
  listen: function (EventType, callback) {
    if (EventBroker.listeners[EventType.name]) {
      return;
    }
    EventBroker.serviceBus().createQueueIfNotExists(EventType.QueueName, function (err) {
      if (!err) {
        EventBroker.listeners[EventType.name] = setInterval(function () {
          EventBroker.serviceBus().receiveQueueMessage(EventType.QueueName, {
            timeoutIntervalInS: Math.max(config.timers.listenTimeout/1000,1)
          }, function (err, brokeredMessage) {
            if (!err) {
              var ev = new EventType(brokeredMessage);
              ev.process();
            } else {
              console.warn(err);
            }
          });
        }, config.timers.listenTimeout);
      } else {
        if (callback) {
          callback(err);
        }
      }

    });
  },
  unlisten: function (EventType) {
    if (EventBroker.listeners[EventType.name]) {
      clearInterval(EventBroker.listeners[EventType.name]);
      delete EventBroker.listeners[EventType.name];
    }
  }
};

module.exports = EventBroker;
