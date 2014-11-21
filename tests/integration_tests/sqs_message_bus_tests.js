'use strict';
require('../bootstrap');
var MessageBus = require('../../lib/sqs_message_bus');
var TestEvent = require('../fixtures/test_event');
var config = require('config');
var BBPromise = require('bluebird');
var AWS = require('aws-sdk');
var expect = require('chai').expect;

AWS.config.update({
  accessKeyId: config.get('Hoist.aws.account'),
  secretAccessKey: config.get('Hoist.aws.secret'),
  region: config.get('Hoist.aws.region')
});

var sqs = BBPromise.promisifyAll(new AWS.SQS());


describe.skip('Integration', function () {
  describe('SQSMessageBus', function () {
    this.timeout(20000);
    var messageBus = new MessageBus();
    var messageSent;
    var eventJson = {
      messageId: 'messageId',
      correlationId: 'correlationId'
    };
    describe('#send', function () {
      before(function () {
        TestEvent.QueueName = 'TestQueue_SQSMessageBus_Send_' + Date.now();
        return (messageSent = messageBus.send(new TestEvent(eventJson)).then(function () {
          return sqs.getQueueUrlAsync({
            QueueName: config.get('Hoist.aws.prefix') + TestEvent.QueueName
          }).then(function (data) {
            return sqs.receiveMessageAsync({
              QueueUrl: data.QueueUrl
            }).then(function (response) {
              return [response.Messages, data.QueueUrl];
            });
          });
        }));
      });
      it('puts a message on the queue', function () {
        return messageSent.spread(function (messages) {
          expect(messages.length).to.eql(1);
        });
      });
      it('puts the correct message on queue', function () {
        return messageSent.spread(function (messages) {
          expect(messages[0].Body).to.eql(JSON.stringify(eventJson));
        });
      });
      after(function () {
        //delete queue
        return messageSent.spread(function (messages, QueueUrl) {
          return sqs.deleteQueueAsync({
            QueueUrl: QueueUrl
          });
        });
      });
    });
  });
});
