'use strict';
var ModuleEvent = require('../../../lib/event_types/module_event');
var expect = require('chai').expect;
describe('ModulEvent', function () {
  it('defines .QueueName', function () {
    ModuleEvent.QueueName.should.eql('module.run');
  });
  it('has name', function () {
    ModuleEvent.name.should.eql('ModuleEvent');
  });

  describe('constructed from brokered message', function () {
    var moduleEvent;
    before(function () {
      moduleEvent = new ModuleEvent();
    });
    it('has #convertToBrokeredMessage defined', function () {
      expect(moduleEvent).to.respondTo('convertToBrokeredMessage');
    });
  });
  describe('constructed with properties', function () {
    var moduleEvent;
    var properties = {
      messageId: 'MessageIdGuid',
      correlationId: 'CID',
      applicationId: 'applicationid',
      environment: 'live',
      sessionId: 'sessionId',
      eventName: 'wfm:contact:new',
      moduleName: 'my:module',
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
      expect(moduleEvent.messageId).to.eql('MessageIdGuid');
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
    it('serializes correctly', function () {
      expect(moduleEvent.convertToBrokeredMessage()).to.eql({
        brokerProperties: {
          CorrelationId: 'CID',
          MessageId: 'MessageIdGuid'
        },
        customProperties: {
          applicationid: 'applicationid',
          environment: 'live',
          modulename: 'my:module',
          eventname: 'wfm:contact:new',
          sessionid: 'sessionId'
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
    var moduleEvent;
    var message = {
      brokerProperties: {
        CorrelationId: 'CID',
        MessageId: 'MessageIdGuid'
      },
      customProperties: {
        applicationid: 'applicationid',
        environment: 'live',
        modulename: 'my:module',
        eventname: 'wfm:contact:new',
        sessionid: 'sessionId'
      },
      body: JSON.stringify({
        response: 'some response'
      })
    };
    before(function () {
      moduleEvent = new ModuleEvent(message);
    });
    it('sets #messageId', function () {
      expect(moduleEvent.messageId).to.eql('MessageIdGuid');
    });
    it('sets #correlationId', function () {
      expect(moduleEvent.correlationId).to.eql('CID');
    });
    it('sets #applicationId', function () {
      expect(moduleEvent.applicationId).to.eql('applicationid');
    });
    it('sets #eventName', function () {
      expect(moduleEvent.eventName).to.eql('wfm:contact:new');
    });
    it('sets #moduleName', function () {
      expect(moduleEvent.moduleName).to.eql('my:module');
    });
    it('sets #sessionId', function () {
      expect(moduleEvent.sessionId).to.eql('sessionId');
    });
    it('sets #environment', function () {
      expect(moduleEvent.environment).to.eql('live');
    });
    it('serializes correctly', function () {
      expect(moduleEvent.convertToBrokeredMessage()).to.eql(message);
    });
  });
});
