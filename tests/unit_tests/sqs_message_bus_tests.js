'use strict';
require('../bootstrap');
var sinon = require('sinon');
var SQSMessageBus = require('../../lib/sqs_message_bus');
var Listener = SQSMessageBus.Listener;
var TestEvent = require('../fixtures/test_event');
var AWS = require('aws-sdk');
var expect = require('chai').expect;

describe('Listener', function () {
  describe('constructor', function () {
    var listener = new Listener('url', TestEvent);
    it('sets QueueUrl', function () {
      expect(listener.QueueUrl).to.eql('url');
    });
    it('set EventType', function () {
      expect(listener.EventType).to.eql(TestEvent);
    });

  });
  describe('#start', function () {
    var listener = new Listener();
    before(function () {
      sinon.stub(listener, 'poll');
      listener.start();
    });
    it('sets listening', function () {
      expect(listener.listening).to.eql(true);
    });
    it('calls #poll', function () {
      return expect(listener.poll).to.have.been.called;
    });
  });
  describe('#poll', function () {
    var listener;

    function MockSQS() {

    }
    MockSQS.prototype.receiveMessage = sinon.stub();
    var url = 'url';

    before(function () {
      sinon.stub(AWS, 'SQS', MockSQS);
      listener = new Listener(url, TestEvent);
      listener.emit = sinon.stub();
      listener.poll();
    });
    after(function () {
      AWS.SQS.restore();
    });
    it('calls receiveMessage', function () {
      expect(MockSQS.prototype.receiveMessage)
        .to.have.been.calledWith({
          QueueUrl: url,
          WaitTimeSeconds: 20,
          MaxNumberOfMessages: 8
        });
    });
    describe('on error', function () {
      describe('if listening', function () {
        before(function () {
          listener.listening = true;
          sinon.stub(listener, 'poll');
          MockSQS.prototype.receiveMessage.callArgWith(1, new Error('error messsage'));
        });
        after(function () {
          listener.poll.restore();
        });
        it('calls poll', function () {
          return expect(listener.poll)
            .to.have.been.called;
        });
      });
      describe('if not listening', function () {
        before(function () {
          listener.listening = false;
          sinon.stub(listener, 'poll');
          MockSQS.prototype.receiveMessage.callArgWith(1, new Error('error messsage'));
        });
        after(function () {
          listener.poll.restore();
          listener.poll();
        });
        it('doesn\'t call poll', function () {
          return expect(listener.poll)
            .to.not.have.been.called;
        });
      });
    });
    describe('on response', function () {
      describe('if listening', function () {
        before(function () {
          listener.listening = true;
          sinon.stub(listener, 'poll');
          MockSQS.prototype.receiveMessage.callArgWith(1, null, {
            Messages: [{
              MessageId: 'SQSMessageId',
              ReceiptHandle: 'ReceiptHandle',
              Body: JSON.stringify({
                messageId: 'messageId',
                correlationId: 'CorrelationId'
              })
            }]
          });
        });
        after(function () {
          listener.poll.restore();
        });
        it('calls poll', function () {
          return expect(listener.poll)
            .to.have.been.called;
        });
        it('emits event', function () {
          expect(listener.emit)
            .to.have.been.calledWith('NewEvent', sinon.match(function (evt) {

              expect(evt.messageId).to.eql('messageId');
              expect(evt.correlationId).to.eql('CorrelationId');
              expect(evt.ReceiptHandle).to.eql('ReceiptHandle');
              expect(evt.SQSMessageId).to.eql('SQSMessageId');
              return true;
            }));
        });
      });
      describe('if not listening', function () {
        before(function () {
          listener.listening = false;
          sinon.stub(listener, 'poll');
          MockSQS.prototype.receiveMessage.callArgWith(1, null, {
            Messages: [{
              MessageId: 'SQSMessageId',
              ReceiptHandle: 'ReceiptHandle',
              Body: JSON.stringify({
                messageId: 'messageId',
                correlationId: 'CorrelationId'
              })
            }]
          });
        });
        after(function () {
          listener.poll.restore();
          listener.poll();
        });
        it('doesn\'t call poll', function () {
          return expect(listener.poll)
            .to.not.have.been.called;
        });
        it('emits event', function () {
          expect(listener.emit)
            .to.have.been.calledWith('NewEvent', sinon.match(function (evt) {

              expect(evt.messageId).to.eql('messageId');
              expect(evt.correlationId).to.eql('CorrelationId');
              expect(evt.ReceiptHandle).to.eql('ReceiptHandle');
              expect(evt.SQSMessageId).to.eql('SQSMessageId');
              return true;
            }));
        });
      });
    });
  });
  describe('#stop', function () {
    var listener = new Listener();
    before(function () {
      listener.listening = true;
      listener.stop();
    });
    it('marks listening as false', function () {
      expect(listener.listening).to.eql(false);
    });
  });
});
describe('SQSMessageBus', function () {
  function MockSQS() {

  }
  MockSQS.prototype = {
    sendMessage: function () {
      throw new Error('this method should be mocked');
    },
    createQueue: function () {
      throw new Error('this method should be mocked');
    },
    deleteMessage: function () {
      throw new Error('this method should be mocked');
    }
  };
  before(function () {
    sinon.stub(AWS, 'SQS', MockSQS);
  });
  after(function () {
    AWS.SQS.restore();
  });
  describe('#send', function () {
    var ev = {
      eventId:'eventId',
      messageId: 'messageId',
      correlationId: 'correlationId'

    };
    var sqsMessageBus;
    before(function (done) {
      sinon.stub(MockSQS.prototype, 'createQueue').callsArgWith(1, null, {
        QueueUrl: 'QueueUrl'
      });
      sinon.stub(MockSQS.prototype, 'sendMessage').callsArg(1);
      sqsMessageBus = new SQSMessageBus();
      sqsMessageBus.send(new TestEvent(ev),1000, done);
    });
    after(function () {
      MockSQS.prototype.createQueue.restore();
      MockSQS.prototype.sendMessage.restore();
    });
    it('creates the correct queue', function () {
      return expect(MockSQS.prototype.createQueue)
        .to.have.been.calledWith({
          Attributes: {
            DelaySeconds: '0'
          },
          QueueName: 'BROKER_TEST_TestEventQueue'
        });
    });
    it('doesn\'t recreate queue on subsequent calls', function () {
      return sqsMessageBus.send(new TestEvent(ev)).then(function () {
        return expect(MockSQS.prototype.createQueue).to.have.been.calledOnce;
      });
    });
    it('sends the correct message', function () {
      return expect(AWS.SQS.prototype.sendMessage)
        .to.have.been.calledWith({
          MessageBody: JSON.stringify(ev),
          QueueUrl: 'QueueUrl'
        });
    });
  });
  describe('listen', function () {
    var sqsMessageBus;
    var onEvent = sinon.stub();
    before(function () {
      sinon.stub(MockSQS.prototype, 'createQueue').callsArgWith(1, null, {
        QueueUrl: 'QueueUrl'
      });
      sinon.stub(SQSMessageBus.Listener.prototype, 'start');
      sqsMessageBus = new SQSMessageBus();

      return sqsMessageBus.listen(TestEvent, onEvent);
    });
    after(function () {
      MockSQS.prototype.createQueue.restore();
      SQSMessageBus.Listener.prototype.start.restore();
    });
    it('calls listener#start', function () {
      return expect(SQSMessageBus.Listener.prototype.start)
        .to.have.been.called;
    });
    it('sets up listener hash', function () {
      return expect(sqsMessageBus.listeners[TestEvent.name]).to.exist;
    });
    it('sets up listener with correct type and queue', function () {
      expect(sqsMessageBus.listeners[TestEvent.name].EventType).to.eql(TestEvent);
      expect(sqsMessageBus.listeners[TestEvent.name].QueueUrl).to.eql('QueueUrl');
    });
    it('links NewEvent event on listener', function () {
      var ev = {};
      sqsMessageBus.listeners[TestEvent.name].emit('NewEvent', ev);
      expect(onEvent).to.have.been.calledWith(ev);
    });
  });
  describe('unlisten', function () {
    var sqsMessageBus;
    var listener = {
      stop: sinon.stub()
    };
    before(function () {
      sqsMessageBus = new SQSMessageBus();
      sqsMessageBus.listeners[TestEvent.name] = listener;
      sqsMessageBus.unlisten(TestEvent);
    });
    it('calls listener#stop', function () {
      return expect(listener.stop)
        .to.have.been.called;
    });
    it('deletes listener from hash', function () {
      return expect(sqsMessageBus.listeners[TestEvent.name]).to.eql(false);
    });
  });
  describe('delete', function () {
    before(function () {
      sinon.stub(MockSQS.prototype, 'createQueue').callsArgWith(1, null, {
        QueueUrl: 'QueueUrl'
      });
      sinon.stub(MockSQS.prototype, 'deleteMessage').callsArg(1);
      var sqsMessageBus = new SQSMessageBus();
      var ev = new TestEvent();
      ev.ReceiptHandle = 'ReceiptHandle';
      return sqsMessageBus.delete(ev);
    });
    after(function () {
      MockSQS.prototype.createQueue.restore();
    });
    it('calls deleteMessage', function () {
      expect(MockSQS.prototype.deleteMessage)
        .to.have.been.calledWith({
          QueueUrl: 'QueueUrl',
          ReceiptHandle: 'ReceiptHandle'
        });
    });
  });
});
