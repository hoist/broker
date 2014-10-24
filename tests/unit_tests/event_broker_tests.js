'use strict';
require('../bootstrap');
var util = require('util');
var expect = require('chai').expect;
var BaseEvent = require('../../lib/event_types/base_event');
var EventBroker = require('../../lib/event_broker');
var sinon = require('sinon');
var BBPromise = require('bluebird');
var azure = require('azure');
var brokeredMessage = {
  prop: 'brokeredMessage'
};
var TestEventType = function TestEventType() {

};

util.inherits(TestEventType, BaseEvent);

TestEventType.QueueName = 'UnitTestQueue';
TestEventType.prototype.convertToBrokeredMessage = function () {
  return brokeredMessage;
};

describe('EventBroker', function () {
  var serviceBusStub = {
    createQueueIfNotExists: sinon.stub().callsArg(2),
    createTopicIfNotExists: sinon.stub().callsArg(2),
    //receiving
    receiveQueueMessage: sinon.spy(),
    receiveSubscriptionMessage: sinon.spy(),
    //sending
    sendQueueMessage: sinon.stub().callsArg(2),
    sendTopicMessage: sinon.stub().callsArg(2),

    //subscriptions
    getSubscription: sinon.stub(),
    createSubscription: sinon.stub().callsArg(3),
    deleteRule: sinon.stub().callsArg(3),
    createRule: sinon.stub().callsArg(3),
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
      this.createRule.reset();
      this.deleteRule.reset();
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
      var clock;
      var _error;
      before(function (done) {
        clock = sinon.useFakeTimers();
        serviceBusStub.getSubscription = serviceBusStub.getSubscription.callsArgWith(2, 'Subscription does not exist', null);

        sinon.stub(EventBroker, 'process');
        EventBroker.subscribe(TestEventType, function (err) {
          _error = err;
          clock.tick(500);
          done();
        });

      });
      after(function () {
        clock.restore();
        EventBroker.process.restore();
        clearInterval(EventBroker.subscriptions.TestEventType);
        delete EventBroker.subscriptions.TestEventType;
        serviceBusStub.reset();
      });
      it('has no error', function () {
        /* jshint -W030*/
        expect(_error).to.not.exist;
      });
      it('saves the subscripton to subscriptions object', function () {
        /*jshint -W030*/
        expect(EventBroker.subscriptions.TestEventType)
          .to.exist;
      });
      it('creates topic', function () {
        expect(serviceBusStub.createTopicIfNotExists)
          .to.have.been
          .calledWith('UnitTestQueue.topic');
      });
      it('creates a subscription', function () {
        expect(serviceBusStub.createSubscription)
          .to.have.been
          .calledWith('UnitTestQueue.topic', 'All', {
            DeadLetteringOnFilterEvaluationExceptions: true,
            DeadLetteringOnMessageExpiration: true,
            EnableBatchedOperations: true
          });
      });
      it('recieves subscription message', function () {
        expect(serviceBusStub.receiveSubscriptionMessage)
          .to.have.been
          .calledWith('UnitTestQueue.topic', 'All', {
            timeoutIntervalInS: 1,
            isPeekLock: true
          }, sinon.match.func);
      });
      it('calls process', function () {
        var message = {
          brokeredProperties: {
            CorrelationId: 'CID'
          }
        };
        serviceBusStub.receiveSubscriptionMessage.callArgWith(3, null, message);
        var eventType = new TestEventType(message);
        eventType.model = require('hoist-model');
        expect(EventBroker.process).to.have.been.calledWith(eventType);
      });
    });
    describe('with rules', function () {
      var clock;
      before(function (done) {
        clock = sinon.useFakeTimers();
        serviceBusStub.getSubscription = serviceBusStub.getSubscription.callsArgWith(2, 'Subscription does not exist', null);
        sinon.stub(EventBroker, 'process');
        EventBroker.subscribe(TestEventType, {
          subscriptionName: 'subscription_name',
          rules: [{
            name: 'rule1',
          }, {
            name: 'rule2'
          }]
        }).then(function () {
          clock.tick(500);
          done();
        });

      });
      after(function () {
        clock.restore();
        EventBroker.process.restore();
        clearInterval(EventBroker.subscriptions.TestEventType);
        delete EventBroker.subscriptions.TestEventType;
        serviceBusStub.reset();
      });
      it('saves the subscripton to subscriptions object', function () {
        /*jshint -W030*/
        expect(EventBroker.subscriptions.TestEventType)
          .to.exist;
      });
      it('creates topic', function () {
        expect(serviceBusStub.createTopicIfNotExists)
          .to.have.been
          .calledWith('UnitTestQueue.topic');
      });
      it('creates a subscription', function () {
        expect(serviceBusStub.createSubscription)
          .to.have.been
          .calledWith('UnitTestQueue.topic', 'subscription_name', {
            DeadLetteringOnFilterEvaluationExceptions: true,
            DeadLetteringOnMessageExpiration: true,
            EnableBatchedOperations: true
          });
      });
      it('deletes default rule', function () {
        expect(serviceBusStub.deleteRule)
          .to.have.been
          .calledWith('UnitTestQueue.topic', 'subscription_name', '$Default');
      });
      it('creates new rule', function () {
        expect(serviceBusStub.createRule)
          .to.have.been
          .calledWith('UnitTestQueue.topic', 'subscription_name', {
            name: 'rule1'
          });
        expect(serviceBusStub.createRule)
          .to.have.been
          .calledWith('UnitTestQueue.topic', 'subscription_name', {
            name: 'rule2'
          });

      });
      it('recieves subscription message', function () {
        expect(serviceBusStub.receiveSubscriptionMessage)
          .to.have.been
          .calledWith('UnitTestQueue.topic', 'subscription_name', {
            timeoutIntervalInS: 1,
            isPeekLock: true
          }, sinon.match.func);
      });
      it('calls process', function () {
        var message = {
          brokeredProperties: {
            CorrelationId: 'CID'
          }
        };
        serviceBusStub.receiveSubscriptionMessage.callArgWith(3, null, message);
        var eventType = new TestEventType(message);
        eventType.model = require('hoist-model');
        expect(EventBroker.process).to.have.been.calledWith(eventType);
      });
    });
    describe('with an existing subscription', function () {
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
  describe('listen', function () {
    describe('without existing listener', function () {
      var clock;
      before(function (done) {
        clock = sinon.useFakeTimers();
        sinon.stub(EventBroker, 'process');

        EventBroker.listen(TestEventType, function () {
          clock.tick(500);
          done();
        });
      });
      after(function () {
        clock.restore();
        EventBroker.process.restore();
        clearInterval(EventBroker.listeners.TestEventType);
        delete EventBroker.listeners.TestEventType;
        serviceBusStub.reset();
      });
      it('saves the listener to listeners object', function () {
        /*jshint -W030*/
        expect(EventBroker.listeners.TestEventType)
          .to.exist;
      });
      it('creates queue', function () {
        expect(serviceBusStub.createQueueIfNotExists)
          .to.have.been
          .calledWith('UnitTestQueue.queue', {
            DeadLetteringOnFilterEvaluationExceptions: true,
            DeadLetteringOnMessageExpiration: true,
            EnableBatchedOperations: true
          });
      });
      it('recieves queue message', function () {
        expect(serviceBusStub.receiveQueueMessage)
          .to.have.been
          .calledWith('UnitTestQueue.queue', {
            timeoutIntervalInS: 1,
            isPeekLock: true
          }, sinon.match.func);
      });
      it('calls process', function () {
        var message = {
          brokeredProperties: {
            CorrelationId: 'CID'
          }
        };
        serviceBusStub.receiveQueueMessage.callArgWith(2, null, message);
        var expectedEvent= new TestEventType(message);
        expectedEvent.model = require('hoist-model');

        expect(EventBroker.process).to.have.been.calledWith(expectedEvent);
      });
    });
    describe('with existing listener', function () {
      before(function (done) {
        EventBroker.listeners.TestEventType = {};
        EventBroker.listen(TestEventType, done);
      });
      after(function () {
        delete EventBroker.listeners.TestEventType;
        serviceBusStub.reset();
      });
      it('doesn\'t create queue', function () {
        /*jshint -W030*/
        expect(serviceBusStub.createQueueIfNotExists)
          .to.have.not.been
          .called;
      });
    });
  });
  describe('send', function () {
    before(function (done) {
      EventBroker.listeners.TestEventType = {};
      sinon.stub(EventBroker,'logStep');
      EventBroker.send(new TestEventType(), done);
    });
    after(function () {
      EventBroker.logStep.restore();
      serviceBusStub.reset();
    });
    it('should log a step',function(){
      /* jshint -W030 */
      expect(EventBroker.logStep)
      .to.have.been.called;
    });
    it('should create queue', function () {
      expect(serviceBusStub.createQueueIfNotExists)
        .to.have.been.calledWith('UnitTestQueue.queue', {
          DeadLetteringOnFilterEvaluationExceptions: true,
          DeadLetteringOnMessageExpiration: true,
          EnableBatchedOperations: true
        });
    });
    it('should send message', function () {
      expect(serviceBusStub.sendQueueMessage)
        .to.have.been.calledWith('UnitTestQueue.queue', brokeredMessage);
    });
  });
  describe('publish', function () {
    before(function (done) {
      EventBroker.listeners.TestEventType = {};
      sinon.stub(EventBroker,'logStep');
      EventBroker.publish(new TestEventType(), done);
    });
    after(function () {
      EventBroker.logStep.restore();
      serviceBusStub.reset();
    });
    it('should log a step',function(){
      /* jshint -W030 */
      expect(EventBroker.logStep)
      .to.have.been.called;
    });
    it('should create queue', function () {
      expect(serviceBusStub.createTopicIfNotExists)
        .to.have.been.calledWith('UnitTestQueue.topic', {
          DeadLetteringOnFilterEvaluationExceptions: true,
          DeadLetteringOnMessageExpiration: true,
          EnableBatchedOperations: true
        });
    });
    it('should send message', function () {
      expect(serviceBusStub.sendTopicMessage)
        .to.have.been.calledWith('UnitTestQueue.topic', brokeredMessage);
    });
  });
  describe('process', function () {

    var processingEvent = new TestEventType();
    var createdEvent = new TestEventType();
    before(function (done) {
      processingEvent.correlationId = 'CID';
      processingEvent.applicationId = 'applicationId';
      processingEvent.environment = 'environment';
      processingEvent.process = function () {
        return BBPromise.try(function () {
          processingEvent.emit('createEvent', createdEvent);
          processingEvent.emit('publishEvent', createdEvent);
          processingEvent.emit('log.step', 'My:Step');
          processingEvent.emit('log.error', 'some error occurred');
          processingEvent.emit('done');
          done();
        });
      };
      EventBroker.process(processingEvent);
    });
    after(function () {
      serviceBusStub.reset();
    });
    it('sends the created event', function () {
      expect(serviceBusStub.sendQueueMessage)
        .to.have.been.calledWith('UnitTestQueue.queue', createdEvent.convertToBrokeredMessage());
    });
    it('publishes the created event', function () {
      expect(serviceBusStub.sendTopicMessage)
        .to.have.been.calledWith('UnitTestQueue.topic', createdEvent.convertToBrokeredMessage());
    });
    it('sends log.step events', function () {
      expect(serviceBusStub.sendQueueMessage)
        .to.have.been.calledWith('log.step.queue', {
          brokerProperties: {
            CorrelationId: 'CID'
          },
          customProperties: {
            applicationid: 'applicationId',
            stepname: 'My:Step',
            environment: 'environment'
          },
          body: '{"correlationId":"CID"}'
        });
    });
    it('sends log.error events', function () {
      expect(serviceBusStub.sendQueueMessage)
        .to.have.been.calledWith('log.error.queue', {
          brokerProperties: {
            CorrelationId: 'CID'
          },
          customProperties: {
            applicationid: 'applicationId',
            stepname: undefined,
            environment: 'environment',
            error: 'some error occurred'
          },
          body: '{"correlationId":"CID"}'
        });
    });
    it('deletes message', function () {
      expect(serviceBusStub.deleteMessage)
        .to.be.calledWith(processingEvent.convertToBrokeredMessage());
    });
  });
  describe('unsubscribe', function () {
    var clock;
    var callback;
    before(function () {
      clock = sinon.useFakeTimers();
      callback = sinon.spy();
      EventBroker.subscriptions.TestEventType = setInterval(callback, 50);
      EventBroker.unsubscribe(TestEventType);
    });
    after(function () {
      clock.restore();
    });
    it('stops the interval', function () {
      clock.tick(400);
      /*jshint -W030*/
      expect(callback).to.not.be.called;
    });
    it('deletes the interval', function () {
      /*jshint -W030*/
      expect(EventBroker.subscriptions.TestEventType).to.not.exist;
    });
  });
  describe('unlisten', function () {
    var clock;
    var callback;
    before(function () {
      clock = sinon.useFakeTimers();
      callback = sinon.spy();
      EventBroker.listeners.TestEventType = setInterval(callback, 50);
      EventBroker.unlisten(TestEventType);
    });
    after(function () {
      clock.restore();
    });
    it('stops the interval', function () {
      clock.tick(400);
      /*jshint -W030*/
      expect(callback).to.not.be.called;
    });
    it('deletes the interval', function () {
      /*jshint -W030*/
      expect(EventBroker.listeners.TestEventType).to.not.exist;
    });
  });
});
