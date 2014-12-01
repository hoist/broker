'use strict';
var expect = require('chai').expect;
var ApplicationEvent = require('../../../lib/event_types/application_event');

describe('ApplicationEvent', function () {
  it('defines .QueueName', function () {
    ApplicationEvent.QueueName.should.eql('application_event');
  });
  it('has name', function () {
    ApplicationEvent.name.should.eql('ApplicationEvent');
  });

  describe('constructed with properties', function () {
    var applicationEvent;
    var properties = {
      messageId: 'eventId',
      sessionId: 'sessionId',
      correlationId: 'CID',
      applicationId: 'applicationid',
      environment: 'live',
      eventName: 'wfm:contact:new',
      eventId:'eventId',
      payload: {
        response: {
          key: 'val'
        }
      }
    };
    before(function () {
      applicationEvent = new ApplicationEvent(properties);
    });
    it('creates correct #toJSON', function () {
      expect(applicationEvent.toJSON()).to.eql(properties);
    });
    it('sets #messageId', function () {
      expect(applicationEvent.messageId).to.eql('eventId');
    });
    it('sets #sessionId', function () {
      expect(applicationEvent.sessionId).to.eql('sessionId');
    });
    it('sets #correlationId', function () {
      expect(applicationEvent.correlationId).to.eql('CID');
    });
    it('sets #applicationId', function () {
      expect(applicationEvent.applicationId).to.eql('applicationid');
    });
    it('sets #eventName', function () {
      expect(applicationEvent.eventName).to.eql('wfm:contact:new');
    });
    it('sets #environment', function () {
      expect(applicationEvent.environment).to.eql('live');
    });
  });

});
