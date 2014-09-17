'use strict';
require('../bootstrap');
var EventBroker = require('../../lib/event_broker');
var azure = require('azure');
var config = require('config');
var expect = require('chai').expect;
var Application = require('hoist-model').Application;
var q = require('q');

describe('integration', function () {
  this.timeout(15000);
  describe('#start', function () {
    var eventBroker;
    before(function (done) {
      eventBroker = new EventBroker();
      eventBroker.start().then(done).done();
    });
    describe('given an application.event is posted', function () {
      var moduleRunMessages = [];
      var sent;
      var serviceBus = azure.createServiceBusService(config.azure.servicebus.main.connectionString);
      var moduleRunReceived;
      var logReceived;
      before(function () {
        moduleRunReceived = q.defer();
        logReceived = q.defer();
        sent = q.all([
          q.ninvoke(serviceBus, 'createQueueIfNotExists', 'module.run'),
          q.ninvoke(serviceBus, 'createTopicIfNotExists', 'event.log')
        ]).then(function () {
          q.ninvoke(serviceBus, 'createSubscription', 'event.log', 'AllMessages');
        }).then(function () {
          return q.delay(100);
        })
          .then(function () {
            serviceBus.receiveQueueMessage('module.run', {
              timeoutIntervalInS: 10
            }, function (err, ev) {
              if (err) {
                moduleRunReceived.reject(err);
              } else {
                moduleRunMessages.push(ev);
                moduleRunReceived.resolve();
              }
            });
            serviceBus.receiveSubscriptionMessage('event.log', 'AllMessages', {
              timeoutIntervalInS: 10
            }, function (err, ev) {
              if (err) {
                logReceived.reject(err);
              } else {
                logReceived.resolve(ev);
              }
            });
            return new Application({
              organisation: 'orgkey',
              settings: {
                live: {
                  on: {
                    'my:event': {
                      modules: ['module:1']
                    }
                  }
                }
              }
            }).saveQ().then(function (application) {
              var message = {
                applicationid: application._id,
                environment: 'live',
                eventname: 'my:event'
              };
              return q.ninvoke(serviceBus, 'sendQueueMessage', 'application.event', {
                brokerProperties: {
                  CorrelationId: 'cid'
                },
                customProperties: message,
                body: JSON.stringify({
                  key: 'value'
                })
              });
            });
          });
      });
      after(function (done) {
        serviceBus.deleteQueue('module.run', function () {
          serviceBus.deleteQueue('application.event', function () {
            //serviceBus.deleteTopic('event.log', function () {
              done();
            //});
          });
        });
      });
      it('should create log events', function () {
        return sent.then(function () {
          return logReceived.promise;
        });
      });
      it('should create module.run event', function () {
        return sent.then(function () {
          //let the service bus deliver;
          return moduleRunReceived.promise;
        }).then(function () {
          expect(moduleRunMessages.length).to.eql(1);
        });
      });
    });
  });
});
