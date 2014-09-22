'use strict';
require('../bootstrap');
var util = require('util');
var expect = require('chai').expect;
var BaseEvent = require('../../lib/event_types/base_event');
var EventBroker = require('../../lib/event_broker');
var sinon = require('sinon');
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
      var clock;
      before(function (done) {
        clock = sinon.useFakeTimers();
        serviceBusStub.getSubscription = serviceBusStub.getSubscription.callsArgWith(2, 'Subscription does not exist', null);

        sinon.stub(EventBroker, 'process');
        EventBroker.subscribe(TestEventType, function () {
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
          .calledWith('UnitTestQueue');
      });
      it('creates a subscription', function () {
        expect(serviceBusStub.createSubscription)
          .to.have.been
          .calledWith('UnitTestQueue', 'All');
      });
      it('recieves subscription message', function () {
        expect(serviceBusStub.receiveSubscriptionMessage)
          .to.have.been
          .calledWith('UnitTestQueue', 'All', {
            timeoutIntervalInS: 1,
            isPeekLock:true
          }, sinon.match.func);
      });
      it('calls process', function () {
        var message = {
          brokeredProperties: {
            CorrelationId: 'CID'
          }
        };
        serviceBusStub.receiveSubscriptionMessage.callArgWith(3, null, message);
        expect(EventBroker.process).to.have.been.calledWith(new TestEventType(message));
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
          .calledWith('UnitTestQueue');
      });
      it('recieves queue message', function () {
        expect(serviceBusStub.receiveQueueMessage)
          .to.have.been
          .calledWith('UnitTestQueue', {
            timeoutIntervalInS: 1,
            isPeekLock:true
          }, sinon.match.func);
      });
      it('calls process', function () {
        var message = {
          brokeredProperties: {
            CorrelationId: 'CID'
          }
        };
        serviceBusStub.receiveQueueMessage.callArgWith(2, null, message);
        expect(EventBroker.process).to.have.been.calledWith(new TestEventType(message));
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
      EventBroker.send(new TestEventType(), done);
    });
    after(function () {

      serviceBusStub.reset();
    });
    it('should create queue', function () {
      expect(serviceBusStub.createQueueIfNotExists)
        .to.have.been.calledWith('UnitTestQueue');
    });
    it('should send message', function () {
      expect(serviceBusStub.sendQueueMessage)
        .to.have.been.calledWith('UnitTestQueue', brokeredMessage);
    });
  });
  describe('publish', function () {
    before(function (done) {
      EventBroker.listeners.TestEventType = {};
      EventBroker.publish(new TestEventType(), done);
    });
    after(function () {

      serviceBusStub.reset();
    });
    it('should create queue', function () {
      expect(serviceBusStub.createTopicIfNotExists)
        .to.have.been.calledWith('UnitTestQueue');
    });
    it('should send message', function () {
      expect(serviceBusStub.sendTopicMessage)
        .to.have.been.calledWith('UnitTestQueue', brokeredMessage);
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
        this.emit('createEvent', createdEvent);
        this.emit('log.step', 'My:Step');
        this.emit('log.error', 'some error occurred');
        this.emit('done');
        done();
      };
      EventBroker.process(processingEvent);
    });
    after(function () {
      serviceBusStub.reset();
    });
    it('sends the created event', function () {
      expect(serviceBusStub.sendQueueMessage)
        .to.have.been.calledWith('UnitTestQueue', createdEvent.convertToBrokeredMessage());
    });
    it('sends log.step events', function () {
      expect(serviceBusStub.sendQueueMessage)
        .to.have.been.calledWith('log.step', {
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
        .to.have.been.calledWith('log.error', {
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
