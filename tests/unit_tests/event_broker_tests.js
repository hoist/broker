'use strict';
require('../bootstrap.js');

var EventBroker = require('../../lib/event_broker');
var azure = require('azure');
var sinon = require('sinon');
var Application = require('hoist-model').Application;
var expect = require('chai').expect;
var q = require('q');
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
              'wfm:new:contact': {
                'modules': ['module:name']
              }
            }
          }
        }
      };
      var message = {
        brokerProperties: {
          CorrelationId: 'cid'
        },
        customProperties: {
          applicationid: 'applicationId',
          environment: 'live',
          eventname: 'wfm:new:contact'
        },
        body: JSON.stringify({
          contactName: 'some_contact_name'
        })
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
            brokerProperties: {
              CorrelationId: 'cid'
            },
            customProperties: {
              applicationid: 'applicationId',
              modulename: 'module:name',
              environment: 'live',
              eventname: 'wfm:new:contact'
            },
            body: JSON.stringify({
              contactName: 'some_contact_name'
            })
          });
        });
      });
      it('should publish log messages', function () {
        expect(stubServiceBus.sendTopicMessage).to.have.been.calledWith('event.log', {
          brokerProperties: {
            CorrelationId: 'cid'
          },
          customProperties: {
            step: 'message:received',
            eventname: 'application:event',
          },
          body: JSON.stringify({
            applicationid: 'applicationId',
            environment: 'live',
            eventname: 'wfm:new:contact',
            data: {
              contactName: 'some_contact_name'
            }
          })
        });
        expect(stubServiceBus.sendTopicMessage).to.have.been.calledWith('event.log', {
          brokerProperties: {
            CorrelationId: 'cid'
          },
          customProperties: {
            step: 'message:sent',
            eventname: 'application:event'
          },
          body: JSON.stringify({
            applicationid: 'applicationId',
            environment: 'live',
            eventname: 'wfm:new:contact',
            modulename: 'module:name',
            data: {
              contactName: 'some_contact_name'
            }
          })
        });
      });
      it('should ack the message', function () {
        expect(stubServiceBus.deleteMessage).to.have.been.calledWith(message, sinon.match.func);
      });
    });
  });
});
