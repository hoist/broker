'use strict';
var util = require('util');
var EventEmitter = require('events').EventEmitter;
var config = require('config');
var BBPromise = require('bluebird');
var AWS = require('aws-sdk');
var _ = require('lodash');
var logger = require('hoist-logger');

AWS.config.update({
  accessKeyId: config.get('Hoist.aws.account'),
  secretAccessKey: config.get('Hoist.aws.secret'),
  region: config.get('Hoist.aws.region')
});

function Listener(QueueUrl, EventType) {
  this.sqs = BBPromise.promisifyAll(new AWS.SQS());
  this.EventType = EventType;
  this.QueueUrl = QueueUrl;
  this.ConcurrentMessages = 10;
  /* istanbul ignore else */
  if (config.has('Hoist.messageBus.concurrentMessages')) {
    this.ConcurrentMessages = config.get('Hoist.messageBus.concurrentMessages');
  }
}
util.inherits(Listener, EventEmitter);
Listener.prototype.poll = function () {

  return this.sqs.receiveMessageAsync({
      QueueUrl: this.QueueUrl,
      WaitTimeSeconds: 20,
      MaxNumberOfMessages: this.ConcurrentMessages
    })
    .bind(this)
    .then(function (response) {
      logger.debug({
        QueueUrl: this.queueUrl,
        response: response
      }, 'got response');
      logger.info({
        QueueUrl: this.queueUrl
      }, 'got messages from bus');
      /* istanbul ignore else */
      if (response.Messages) {
        response.Messages.forEach(_.bind(function (message) {
          var properties = JSON.parse(message.Body);
          var ev = new this.EventType(properties);
          ev.ReceiptHandle = message.ReceiptHandle;
          ev.SQSMessageId = message.MessageId;
          this.emit('NewEvent', ev);
        }, this));
      }
      /* istanbul ignore else */
      if (this.listening) {
        logger.debug('continuing loop');
        return this.poll();
      }
    })
    .catch(function (err) {
      logger.error(err, 'error during poll for messages');
      /* istanbul ignore else */
      if (this.listening) {
        logger.debug('continuing loop');
        return this.poll();
      }
    });
};
Listener.prototype.start = function () {
  this.listening = true;
  this.poll();
};
Listener.prototype.stop = function () {
  this.listening = false;
};



function SQSMessageBus() {
  this.defaultQueueAttributes = {
    DelaySeconds: '0'
  };
  this.listeners = {};
  this.queueUrls = {};
  this.sqs = BBPromise.promisifyAll(new AWS.SQS());
}

util.inherits(SQSMessageBus, EventEmitter);
SQSMessageBus.prototype.getQueueUrl = function (type) {
  var getQueueUrl;
  if (this.queueUrls[type.name]) {
    getQueueUrl = BBPromise.resolve(this.queueUrls[type.name])
      .bind(this);
  } else {
    getQueueUrl = this.sqs.createQueueAsync({
      Attributes: this.defaultQueueAttributes,
      QueueName: config.get('Hoist.aws.prefix') + type.QueueName,
    }).bind(this).then(function (data) {
      this.queueUrls[type.name] = data.QueueUrl;
      return data.QueueUrl;
    });
  }
  return getQueueUrl;
};
SQSMessageBus.prototype.send = function (ev, callback) {
  var json = JSON.stringify(ev.toJSON());


  return this.getQueueUrl(ev.constructor).then(function (url) {
    return this.sqs.sendMessageAsync({
      MessageBody: json,
      QueueUrl: url
    });
  }).nodeify(callback);
};

SQSMessageBus.prototype.listen = function (EventType, onEvent, callback) {
  /* istanbul ignore if */
  if (this.listeners[EventType.name]) {
    return BBPromise.resolve(null).nodeify(callback);
  }
  this.listeners[EventType.name] = true;
  return this.getQueueUrl(EventType).then(function (url) {
    var listener = new Listener(url, EventType);
    listener.on('NewEvent', function (event) {
      onEvent(event);
    });
    listener.start();
    this.listeners[EventType.name] = listener;
  });
};

SQSMessageBus.prototype.unlisten = function (EventType, callback) {
  /* istanbul ignore if */
  if (!this.listeners[EventType.name]) {
    return BBPromise.resolve(null).nodeify(callback);
  }
  var listener = this.listeners[EventType.name];
  this.listeners[EventType.name] = false;
  listener.stop();
};

SQSMessageBus.prototype.delete = function (ev, callback) {
  return this.getQueueUrl(ev.constructor)
    .then(function (url) {
      return this.sqs.deleteMessageAsync({
        QueueUrl: url,
        ReceiptHandle: ev.ReceiptHandle
      });
    }).nodeify(callback);
};


module.exports = SQSMessageBus;
module.exports.Listener = Listener;
