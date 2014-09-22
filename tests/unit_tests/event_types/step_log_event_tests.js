'use strict';
var StepLogEvent = require('../../../lib/event_types/step_log_event');
var expect = require('chai').expect;
describe('StepLogEvent', function () {
  it('defines .QueueName', function () {
    StepLogEvent.QueueName.should.eql('log.step');
  });
  it('has name', function () {
    StepLogEvent.name.should.eql('StepLogEvent');
  });

  describe('constructed from brokered message', function () {
    var stepLogEvent;
    before(function () {
      stepLogEvent = new StepLogEvent();
    });
    it('has #convertToBrokeredMessage defined', function () {
      expect(stepLogEvent).to.respondTo('convertToBrokeredMessage');
    });
  });
  describe('constructed with properties', function () {
    var stepLogEvent;
    var properties = {
      messageId: 'MessageIdGuid',
      correlationId: 'CID',
      applicationId: 'applicationid',
      environment: 'live',
      stepName: 'process:started',
      baseEvent: {
        contact: {
          name: 'some name'
        }
      }
    };
    before(function () {
      stepLogEvent = new StepLogEvent(properties);
    });
    it('sets #messageId', function () {
      expect(stepLogEvent.messageId).to.eql('MessageIdGuid');
    });
    it('sets #correlationId', function () {
      expect(stepLogEvent.correlationId).to.eql('CID');
    });
    it('sets #applicationId', function () {
      expect(stepLogEvent.applicationId).to.eql('applicationid');
    });
    it('sets #stepName', function () {
      expect(stepLogEvent.stepName).to.eql('process:started');
    });
    it('sets #environment', function () {
      expect(stepLogEvent.environment).to.eql('live');
    });
    it('sets #baseEvent', function () {
      expect(stepLogEvent.baseEvent).to.eql({
        contact: {
          name: 'some name'
        }
      });
    });
    it('creates correct #toJSON', function () {
      expect(stepLogEvent.toJSON()).to.eql(properties);
    });
    it('serializes correctly', function () {
      expect(stepLogEvent.convertToBrokeredMessage()).to.eql({
        brokerProperties: {
          CorrelationId: 'CID',
          MessageId: 'MessageIdGuid'
        },
        customProperties: {
          applicationid: 'applicationid',
          environment: 'live',
          stepname: 'process:started'
        },
        body: JSON.stringify({
          contact: {
            name: 'some name'
          }
        })

      });
    });
  });
  describe('constructed with brokeredMessage', function () {
    var stepLogEvent;
    var message = {
      brokerProperties: {
        CorrelationId: 'CID',
        MessageId: 'MessageIdGuid'
      },
      customProperties: {
        applicationid: 'applicationid',
        environment: 'live',
        stepname: 'process:started'
      },
      body: JSON.stringify({
        applicationId: 'some response',
        environment: 'live'
      })
    };
    before(function () {
      stepLogEvent = new StepLogEvent(message);
    });
    it('sets #messageId', function () {
      expect(stepLogEvent.messageId).to.eql('MessageIdGuid');
    });
    it('sets #correlationId', function () {
      expect(stepLogEvent.correlationId).to.eql('CID');
    });
    it('sets #applicationId', function () {
      expect(stepLogEvent.applicationId).to.eql('applicationid');
    });
    it('sets #eventName', function () {
      expect(stepLogEvent.stepName).to.eql('process:started');
    });
    it('sets #environment', function () {
      expect(stepLogEvent.environment).to.eql('live');
    });
    it('serializes correctly', function () {
      expect(stepLogEvent.convertToBrokeredMessage()).to.eql(message);
    });
  });
});
