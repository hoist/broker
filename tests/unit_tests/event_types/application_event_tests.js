'use strict';
var expect = require('chai').expect;
var ApplicationEvent = require('../../../lib/event_types/application_event');
var Application = require('hoist-model').Application;
var BBPromise = require('bluebird');
var sinon = require('sinon');
var hoistErrors = require('hoist-errors');

describe('ApplicationEvent', function () {
  it('defines .QueueName', function () {
    ApplicationEvent.QueueName.should.eql('application.event');
  });
  it('has name', function () {
    ApplicationEvent.name.should.eql('ApplicationEvent');
  });

  describe('constructed from brokered message', function () {
    var applicationEvent;
    before(function () {
      applicationEvent = new ApplicationEvent();
    });
    it('has #convertToBrokeredMessage defined', function () {
      expect(applicationEvent).to.respondTo('convertToBrokeredMessage');
    });
  });
  describe('constructed with properties', function () {
    var applicationEvent;
    var properties = {
      messageId: 'MessageIdGuid',
      correlationId: 'CID',
      applicationId: 'applicationid',
      environment: 'live',
      eventName: 'wfm:contact:new',
      body: {
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
      expect(applicationEvent.messageId).to.eql('MessageIdGuid');
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
    it('serializes correctly', function () {
      expect(applicationEvent.convertToBrokeredMessage()).to.eql({
        brokerProperties: {
          CorrelationId: 'CID',
          MessageId: 'MessageIdGuid'
        },
        customProperties: {
          applicationid: 'applicationid',
          environment: 'live',
          eventname: 'wfm:contact:new'
        },
        body: JSON.stringify({
          response: {
            key: 'val'
          }
        })

      });
    });
  });
  describe('constructed with brokeredMessage', function () {
    var applicationEvent;
    var message = {
      brokerProperties: {
        CorrelationId: 'CID',
        MessageId: 'MessageIdGuid'
      },
      customProperties: {
        applicationid: 'applicationid',
        environment: 'live',
        eventname: 'wfm:contact:new'
      },
      body: JSON.stringify({
        response: {
          key: 'val'
        }
      })
    };
    before(function () {
      applicationEvent = new ApplicationEvent(message);
    });

    it('sets #messageId', function () {
      expect(applicationEvent.messageId).to.eql('MessageIdGuid');
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
    it('sets #body', function () {
      expect(applicationEvent.body).to.eql({
        response: {
          key: 'val'
        }
      });
    });
    it('serializes correctly', function () {
      expect(applicationEvent.convertToBrokeredMessage()).to.eql(message);
    });
  });
  describe('#process', function () {
    describe('with no matching application', function () {
      var applicationEvent;
      before(function (done) {
        sinon.stub(Application, 'findOneAsync', function () {
          return BBPromise.resolve(null);
        });
        applicationEvent = new ApplicationEvent({
          eventName: 'my:event',
          applicationId: 'applicationId',
          environment: 'live',
          correlationId: 'my.cid',
          body: {
            response: 'text'
          }
        });
        applicationEvent.emit = sinon.spy();
        applicationEvent.process().then(done);
      });
      after(function () {
        Application.findOneAsync.restore();
      });
      it('logs beginning', function () {
        expect(applicationEvent.emit).to.be.calledWith('log.step', 'message:received');
      });
      it('logs error', function () {
        expect(applicationEvent.emit).to.be.calledWith('log.error', sinon.match.instanceOf(hoistErrors.model.application.NotFoundError));
      });
      it('doesn\'t emit done', function () {
        expect(applicationEvent.emit).to.not.be.calledWith('done');
      });
    });
    describe('onSuccess', function () {
      var applicationEvent;
      var application = {
        applicationId: 'applicationId',
        settings: {
          live: {
            on: {
              'my:event': {
                modules: ['my:module']
              }
            }
          }
        }
      };
      before(function (done) {
        sinon.stub(Application, 'findOneAsync', function () {
          return BBPromise.resolve(application);
        });
        applicationEvent = new ApplicationEvent({
          eventName: 'my:event',
          applicationId: 'applicationId',
          environment: 'live',
          correlationId: 'my.cid',
          body: {
            response: 'text'
          }
        });
        applicationEvent.emit = sinon.spy();
        applicationEvent.process().then(done);

      });
      after(function () {
        Application.findOneAsync.restore();
      });
      it('logs beginning', function () {
        expect(applicationEvent.emit).to.be.calledWith('log.step', 'message:received');
      });
      it('creates event', function () {

        expect(applicationEvent.emit).to.be.calledWith('createEvent', sinon.match({
          moduleName: 'my:module',
          applicationId: 'applicationId',
          environment: 'live',
          correlationId: 'my.cid',
          eventName: 'my:event',
          body: {
            response: 'text'
          }
        }));
      });
      it('logs end', function () {
        expect(applicationEvent.emit).to.be.calledWith('log.step', 'message:processed');
      });
      it('emits done', function () {
        expect(applicationEvent.emit).to.be.calledWith('done');
      });
    });
  });
});
