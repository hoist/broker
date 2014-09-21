'use strict';
require('../bootstrap');
var util = require('util');
var expect = require('chai').expect;
var BaseEvent = require('../../lib/eventTypes/base_event');
var EventBroker = require('../../lib/event_broker');
var sinon = require('sinon');
var azure = require('azure');
var q = require('q');

var TestEventType = function TestEventType() {

};

util.inherits(TestEventType, BaseEvent);

TestEventType.QueueName = 'UnitTestQueue';

describe('EventBroker', function () {
  var serviceBusStub = {
    createQueueIfNotExists: sinon.stub().callsArg(1),
    createTopicIfNotExists: sinon.stub().callsArg(1),
    //receiving
    receiveQueueMessage: sinon.spy(),
    receiveSubscriptionMessage: sinon.spy(),
    //sending
    sendQueueMessage: sinon.stub().callsArg(2),
    sendTopicMessage: sinon.stub().callsArg(2),

    //subscriptions
    getSubscription: sinon.stub(),
    createSubscription: sinon.stub().callsArg(2),

    //deleting
    deleteMessage: sinon.stub().callsArg(1),
    reset: function () {
      this.createQueueIfNotExists.reset();
      this.createTopicIfNotExists.reset();
      this.receiveQueueMessage.reset();
      this.sendQueueMessage.reset();
      this.sendTopicMessage.reset();
      this.deleteMessage.reset();
      this.getSubscription.reset();
      this.createSubscription.reset();
    }
  };
  before(function () {
    sinon.stub(azure, 'createServiceBusService', function () {
      return serviceBusStub;
    });
  });
  after(function () {
    EventBroker.resetServiceBus();
    azure.createServiceBusService.restore();
  });
  describe('subscribe', function () {
    describe('without an exiting subscription', function () {
      before(function (done) {
        serviceBusStub.getSubscription = serviceBusStub.getSubscription.callsArgWith(2, 'Subscription does not exist', null);
        EventBroker.subscribe(TestEventType, done);
      });
      after(function () {
        clearInterval(EventBroker.subscriptions.TestEventType);
        delete EventBroker.subscriptions.TestEventType;
        serviceBusStub.reset();
      });
      it('saves the subscripton to subscriptions object',function(){
        /*jshint -W030*/
        expect(EventBroker.subscriptions.TestEventType)
        .to.exist;
      });
      it('creates topic', function () {
        expect(serviceBusStub.createTopicIfNotExists)
          .to.have.been
          .calledWith('UnitTestQueue');
      });
      it('creates a subscription', function () {
        expect(serviceBusStub.createSubscription)
          .to.have.been
          .calledWith('UnitTestQueue', 'All');
      });
      it('recieves subscription message', function () {
        return q.delay(100).then(function () {
          expect(serviceBusStub.receiveSubscriptionMessage)
            .to.have.been
            .calledWith('UnitTestQueue', 'All', {
              timeoutIntervalInS: 1
            }, sinon.match.func);
        });
      });
    });
    describe('with an existing subscription',function(){
       before(function (done) {
        EventBroker.subscriptions.TestEventType = {};
        EventBroker.subscribe(TestEventType, done);
      });
      after(function () {
        delete EventBroker.subscriptions.TestEventType;
        serviceBusStub.reset();
      });
      it('doesn\'t create topic', function () {
        /*jshint -W030*/
        expect(serviceBusStub.createTopicIfNotExists)
          .to.have.not.been
          .called;
      });
      it('doesn\'t create a subscription', function () {
        /*jshint -W030*/
        expect(serviceBusStub.createSubscription)
          .to.have.not.been
          .called;
      });
    });
  });
});
