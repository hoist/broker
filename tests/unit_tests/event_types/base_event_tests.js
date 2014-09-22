'use strict';
var expect = require('chai').expect;
var BaseEvent = require('../../../lib/event_types/base_event');

describe('BaseEvent', function () {
  describe('#initFromBrokeredMessage', function () {
    var baseEvent;
    var brokeredMessage = {
      location:'location',
      brokerProperties: {
        DeliveryCount: 1,
        MessageId: 'MessageIdGuid',
        SequenceNumber: 400,
        SessionId: 'SomeSessionId',
        State: 'Active',
        TimeToLive: 922337203685.47754,
        CorrelationId: 'SomeCID'
      },
      customProperties: {
        key1: 'value1',
        key2: 'value2'
      }
    };
    before(function () {
      baseEvent = new BaseEvent();
      baseEvent.initWithBrokeredMessage(brokeredMessage);
    });
    it('constructs same event', function () {
      baseEvent.should.eql(new BaseEvent(brokeredMessage));
    });
    it('sets #correlationId', function () {
      expect(baseEvent.correlationId).to.eql('SomeCID');
    });
    it('sets #messageId', function () {
      expect(baseEvent.messageId).to.eql('MessageIdGuid');
    });
    it('sets #location',function(){
      expect(baseEvent.location).to.eql('location');
    });
  });
  describe('#initFromProperties', function () {
    var baseEvent;
    var properties = {
      correlationId: 'SomeCID',
      messageId: 'MessageIdGuid',
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
      expect(baseEvent.messageId).to.eql('MessageIdGuid');
    });
  });
  describe('#convertToBrokeredMessage', function () {
    var baseEvent;
    before(function () {
      baseEvent = new BaseEvent();
      baseEvent.correlationId = 'SomeCID';
      baseEvent.messageId = 'MessageIdGuid';
      baseEvent.location = 'location';
    });
    it('exists', function () {
      expect(baseEvent).to.respondTo('convertToBrokeredMessage');
    });
    it('returns basic brokered message', function () {
      expect(baseEvent.convertToBrokeredMessage()).to.eql({
        location:'location',
        brokerProperties: {
          CorrelationId: 'SomeCID',
          MessageId:'MessageIdGuid'
        }
      });
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
