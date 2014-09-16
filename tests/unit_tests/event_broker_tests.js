'use strict';
var EventBroker = require('../../lib/event_broker');
var azure = require('azure');
var sinon = require('sinon');
var Application = require('hoist-model').Application;
var expect = require('chai').expect;
var q = require('q');
require('../bootstrap.js');
describe('EventBroker', function () {
  var stubServiceBus = {
    createQueueIfNotExists: sinon.stub().callsArg(1),
    createTopicIfNotExists: sinon.stub().callsArg(1),
    //receiving
    receiveQueueMessage: sinon.spy(),
    //sending
    sendQueueMessage: sinon.stub().callsArg(2),
    sendTopicMessage: sinon.stub().callsArg(2),

    //deleting
    deleteMessage: sinon.stub().callsArg(1),

  };
  before(function () {
    sinon.stub(azure, 'createServiceBusService', function () {
      return stubServiceBus;
    });
  });
  after(function () {
    azure.createServiceBusService.restore();
  });
  describe('#start', function () {
    var eventBroker;
    var started;
    before(function () {
      eventBroker = new EventBroker();
      started = eventBroker.start();
      eventBroker.processApplicationEvent = sinon.stub();
    });
    it('sets up listener for application.event', function () {
      return started.then(function () {
        expect(stubServiceBus.receiveQueueMessage)
          .to.have.been
          .calledWith('application.event', {
            isPeekLock: true
          }, sinon.match.func);
      });
    });
    it('sets up application.event to call processApplicationEvent', function () {
      return started.then(function () {
        /*jshint -W030 */
        expect(eventBroker.processApplicationEvent).to.have.not.been.called;
      }).then(function () {
        var err = {};
        var ev = {};
        stubServiceBus.receiveQueueMessage.callArgWith(2, err, ev);
        expect(eventBroker.processApplicationEvent).to.have.been.calledWith(err, ev);
      });
    });
  });
  describe('#processApplicationEvent', function () {
    describe('with a matching event linked to module', function () {
      var eventBroker;
      var processed;
      var application = {
        _id: 'applicationId',
        settings: {
          live: {
            on: {
              'wfm.new.contact': {
                'modules': ['module.name']
              }
            }
          }
        }
      };
      var message = {
        applicationId: 'applicationId',
        environment: 'live',
        eventId: 'eventId',
        eventName: 'wfm.new.contact',
        cid: 'corrolation_id',
        data: {
          contactName: 'some_contact_name'
        },
      };
      before(function () {
        sinon.stub(Application, 'findOneQ', function () {
          return q(application);
        });
        eventBroker = new EventBroker();
        processed = eventBroker.processApplicationEvent(null, message);
      });
      after(function () {
        Application.findOneQ.restore();
      });
      it('should send a message to module.run', function () {
        return processed.then(function () {
          expect(stubServiceBus.sendQueueMessage).to.have.been.calledWith('module.run', {
            applicationId: 'applicationId',
            moduleName: 'module.name',
            environment: 'live',
            cid: 'corrolation_id',
            eventName: 'wfm.new.contact',
            eventId: 'eventId',
            data: {
              contactName: 'some_contact_name'
            }
          });
        });
      });
      it('should publish log messages', function () {
        expect(stubServiceBus.sendTopicMessage).to.have.been.calledWith('event.log', {
          step: 'message.received',
          eventName: 'application.event',
          data: {
            applicationId: 'applicationId',
            eventId: 'eventId',
            eventName: 'wfm.new.contact',
            environment: 'live',
            cid: 'corrolation_id',
            data: {
              contactName: 'some_contact_name'
            },
          }
        });
        expect(stubServiceBus.sendTopicMessage).to.have.been.calledWith('event.log', {
          step: 'message.sent',
          eventName: 'application.event',
          data: {
            applicationId: 'applicationId',
            eventId: 'eventId',
            moduleName: 'module.name',
            environment: 'live',
            cid: 'corrolation_id',
            eventName: 'wfm.new.contact',
            data: {
              contactName: 'some_contact_name'
            }
          }
        });
      });
      it('should ack the message', function () {
        expect(stubServiceBus.deleteMessage).to.have.been.calledWith(message, sinon.match.func);
      });
    });
  });
});
