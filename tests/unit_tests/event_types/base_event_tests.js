'use strict';
var expect = require('chai').expect;
var BaseEvent = require('../../../lib/event_types/base_event');

describe('BaseEvent', function () {
  describe('#initFromProperties', function () {
    var baseEvent;
    var properties = {
      correlationId: 'SomeCID',
      messageId: 'eventId',
      eventId:'eventId'
    };
    before(function () {
      baseEvent = new BaseEvent();
      baseEvent.initWithProperties(properties);
    });
    it('constructs same event', function () {
      baseEvent.should.eql(new BaseEvent(properties));
    });
    it('sets #correlationId', function () {
      expect(baseEvent.correlationId).to.eql('SomeCID');
    });
    it('sets #messageId', function () {
      expect(baseEvent.messageId).to.eql('eventId');
    });
  });
  describe('.QueueName', function () {
    it('exists', function () {
      expect(BaseEvent).to.have.property('QueueName');
    });
    it('is a bogus queue name', function () {
      expect(BaseEvent.QueueName).to.eql('Subclasses should define their own queue name');
    });
  });
  describe('#process', function () {
    it('exists', function () {
      expect(new BaseEvent()).to.respondTo('process');
    });
    it('throws an exeception', function () {
      expect(new BaseEvent().process).to.throw('Subclasses should override this method');
    });
  });
  describe('name', function () {
    it('is BaseEvent', function () {
      expect(BaseEvent.name).to.eql('BaseEvent');
    });
  });
});
