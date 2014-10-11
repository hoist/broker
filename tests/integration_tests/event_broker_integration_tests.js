'use strict';
require('../bootstrap');
var config = require('config');
var util = require('util');
var azure = require('azure');
var expect = require('chai').expect;
var BaseEvent = require('../../lib/event_types/base_event');
var EventBroker = require('../../lib/event_broker');

var serviceBusConnection = azure.createServiceBusService(config.get('Hoist.azure.servicebus.main.connectionString'));

var TestEventType = function () {

};

util.inherits(TestEventType, BaseEvent);

TestEventType.QueueName = 'UnitTestQueue';
describe('integraiton', function () {
  describe.skip('Azure Bus', function () {
    var message;
    this.timeout(10000);
    before(function (done) {

      serviceBusConnection.createQueueIfNotExists('TestMessageQueue', function () {
        serviceBusConnection.sendQueueMessage('TestMessageQueue', {
          brokerProperties: {
            CorrelationId: 'CID'
          },
          customProperties: {
            ApplicationId: 'ApplicationId'
          },
          body: 'some body string'
        }, function (err) {
          console.log(err);
          setTimeout(function () {
            serviceBusConnection.receiveQueueMessage('TestMessageQueue', {
              timeoutIntervalInS: 5
            }, function (err, m) {
              console.log(err);
              message = m;
              done();
            });
          }, 500);

        });
      });
    });
    it('should have a message', function () {
      console.log(message);
    });
    after(function (done) {
      serviceBusConnection.deleteQueue('TestMessageQueue', done);
    });
  });

  describe.skip('EventBroker', function () {
    this.timeout(5000);
    describe('subscribe', function () {
      before(function (done) {
        EventBroker.subscribe(TestEventType, done);
      });
      after(function (done) {
        EventBroker.unsubscribe(TestEventType);
        EventBroker.resetServiceBus();
        serviceBusConnection.deleteTopic('UnitTestQueue', done);

      });
      it('should create the correct topic', function (done) {
        serviceBusConnection.getTopic('UnitTestQueue', function (err, details) {
          expect(details.TopicName).to.eql('UnitTestQueue');
          done();
        });
      });
      it('should create a subscription', function (done) {
        serviceBusConnection.getTopic('UnitTestQueue', function (err, details) {
          expect(details.SubscriptionCount).to.eql('1');
          done();
        });
      });
    });
  });

});
