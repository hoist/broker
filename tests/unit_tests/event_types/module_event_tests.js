'use strict';
var ModuleEvent = require('../../../lib/event_types/module_event');
var expect = require('chai').expect;
describe('ModulEvent', function () {
  it('defines .QueueName', function () {
    ModuleEvent.QueueName.should.eql('module_run');
  });
  it('has name', function () {
    ModuleEvent.name.should.eql('ModuleEvent');
  });

  describe('constructed with properties', function () {
    var moduleEvent;
    var properties = {
      messageId: 'eventId',
      correlationId: 'CID',
      applicationId: 'applicationid',
      environment: 'live',
      sessionId: 'sessionId',
      eventName: 'wfm:contact:new',
      moduleName: 'my:module',
      eventId:'eventId',
      payload: {
        contact: {
          name: 'some name'
        }
      }
    };
    before(function () {
      moduleEvent = new ModuleEvent(properties);
    });
    it('sets #messageId', function () {
      expect(moduleEvent.messageId).to.eql('eventId');
    });
    it('sets #sessionId', function () {
      expect(moduleEvent.sessionId).to.eql('sessionId');
    });
    it('sets #correlationId', function () {
      expect(moduleEvent.correlationId).to.eql('CID');
    });
    it('sets #applicationId', function () {
      expect(moduleEvent.applicationId).to.eql('applicationid');
    });
    it('sets #moduleName', function () {
      expect(moduleEvent.moduleName).to.eql('my:module');
    });
    it('sets #eventName', function () {
      expect(moduleEvent.eventName).to.eql('wfm:contact:new');
    });
    it('sets #environment', function () {
      expect(moduleEvent.environment).to.eql('live');
    });
    it('creates correct #toJSON', function () {
      expect(moduleEvent.toJSON()).to.eql(properties);
    });

  });
});
