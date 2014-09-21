'use strict';
require('../bootstrap');
var config = require('config');
var util = require('util');
var azure = require('azure');
var expect = require('chai').expect;
var BaseEvent = require('../../lib/eventTypes/base_event');
var EventBroker = require('../../lib/event_broker');

var serviceBusConnection = azure.createServiceBusService(config.azure.servicebus.main.connectionString);

var TestEventType = function () {

};

util.inherits(TestEventType, BaseEvent);

TestEventType.QueueName = 'UnitTestQueue';

describe('EventBroker', function () {
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
