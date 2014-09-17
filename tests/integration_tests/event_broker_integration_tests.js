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
      var messageReceived;
      before(function () {
        messageReceived = q.defer();
        sent = q.ninvoke(serviceBus, 'createQueueIfNotExists', 'module.run')
          .then(function () {
            serviceBus.receiveQueueMessage('module.run', {
              timeoutIntervalInS: 10
            }, function (err, ev) {
              if (err) {
                messageReceived.reject(err);
              } else {
                moduleRunMessages.push(ev);
                messageReceived.resolve();
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
            done();
          });
        });
      });
      it('should create log events', function () {

      });
      it('should create module.run event', function () {
        return sent.then(function () {
          //let the service bus deliver;
          return messageReceived.promise;
        }).then(function () {
          expect(moduleRunMessages.length).to.eql(1);
        });
      });
    });
  });
});
