'use strict';
require('../bootstrap');

var expect = require('chai').expect;
var TestEvent = require('../fixtures/test_event');
var EventBroker = require('../../lib/event_broker');
var sinon = require('sinon');
var BBPromise = require('bluebird');

describe('EventBroker', function () {
  describe('#process', function () {
    var processingEvent = new TestEvent();
    var createdEvent = new TestEvent();
    var stubMessageBus = {
      delete: sinon.stub()
    };
    var eventBroker;
    before(function (done) {
      processingEvent.correlationId = 'CID';
      processingEvent.applicationId = 'applicationId';
      processingEvent.environment = 'environment';
      processingEvent.process = function () {
        return BBPromise.try(function () {
          processingEvent.emit('createEvent', createdEvent);
          processingEvent.emit('publishEvent', createdEvent);
          processingEvent.emit('done');
          done();
        });
      };
      eventBroker = new EventBroker();
      eventBroker.messageBus = stubMessageBus;
      sinon.stub(eventBroker, 'send');
      eventBroker.process(processingEvent);
    });
    it('sends the created event', function () {
      expect(eventBroker.send)
        .to.have.been.calledWith(createdEvent);
    });
    it('deletes message', function () {
      expect(stubMessageBus.delete)
        .to.be.calledWith(processingEvent);
    });
  });
  describe('#send', function () {
    var eventBroker;
    var ev = new TestEvent();
    before(function () {
      eventBroker = new EventBroker();
      sinon.stub(eventBroker.messageBus, 'send');
      eventBroker.send(ev);
    });
    it('calls messagebus#send', function () {
      expect(eventBroker.messageBus.send)
        .to.have.been.calledWith(ev);
    });
  });
  describe('unlisten', function () {
    var eventBroker;
    before(function () {
      eventBroker = new EventBroker();
      sinon.stub(eventBroker.messageBus, 'unlisten');
      eventBroker.unlisten(TestEvent);
    });
    it('calls messagebus#unlisten', function () {
      expect(eventBroker.messageBus.unlisten)
        .to.have.been.calledWith(TestEvent);
    });
  });
  describe('listen', function () {
    var eventBroker;
    before(function () {
      eventBroker = new EventBroker();
      sinon.stub(eventBroker.messageBus, 'listen');
      eventBroker.listen(TestEvent);
    });
    it('calls messagebus#listen', function () {
      expect(eventBroker.messageBus.listen)
        .to.have.been.calledWith(TestEvent);
    });
  });
});
