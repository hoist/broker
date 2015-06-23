'use strict';
var util = require('util');
var EventEmitter = require('events').EventEmitter;
var config = require('config');
var BBPromise = require('bluebird');
var AWS = require('aws-sdk');
var _ = require('lodash');
var logger = require('@hoist/logger');
var ModelResolver = require('./model_resolver');

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

  return this.checkPaused().bind(this).then(function () {
      return this.sqs.receiveMessageAsync({
        QueueUrl: this.QueueUrl,
        WaitTimeSeconds: 20,
        MaxNumberOfMessages: this.ConcurrentMessages
      });
    })
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
Listener.prototype.checkPaused = function () {
  var self = this;
  if (!self.paused) {
    return BBPromise.resolve(null);
  } else {
    return BBPromise.delay(500)
      .then(function () {
        return self.checkPaused();
      });
  }

};
Listener.prototype.pause = function () {
  this.paused = true;
};
Listener.prototype.resume = function () {
  this.paused = false;
};
Listener.prototype.start = function () {
  this.listening = true;
  this.paused = false;
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
  this.applicationQueueUrls = {};
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
SQSMessageBus.prototype.getApplicationQueueUrl = function (type, applicationId) {
  var getQueueUrl;
  if (this.applicationQueueUrls[type.name + ':' + applicationId]) {
    getQueueUrl = BBPromise.resolve(this.applicationQueueUrls[type.name + ':' + applicationId])
      .bind(this);
  } else {
    getQueueUrl = this.sqs.createQueueAsync({
      Attributes: this.defaultQueueAttributes,
      QueueName: config.get('Hoist.aws.prefix') + type.QueueName + '-' + applicationId,
    }).bind(this).then(function (data) {
      this.applicationQueueUrls[type.name + ':' + applicationId] = data.QueueUrl;
      return data.QueueUrl;
    });
  }
  return getQueueUrl;
};
SQSMessageBus.prototype.send = function (ev, delay, callback) {
  logger.info(ev, 'starting sqsmessageBus send');
  delay = delay || 1000;
  var eventToSend = ev.toJSON();
  var Event = ModelResolver.get().Event;
  var eventModel = new Event(eventToSend);
  delete eventToSend.payload;
  var json = JSON.stringify(eventToSend);
  var eventSaved;
  if (!ev._saved) {
    eventSaved = eventModel.saveAsync().then(function () {
      logger.info('inside sqsMessageBus eventSaved');
      ev._saved = true;
    }).catch(function (err) {
      logger.error(err);
      logger.info({eventModel:eventModel},'the eventModel tried to save but failed');
      throw err;
    });
  } else {
    logger.info(ev, 'inside SQSMessageBus#send ev._saved true');
    eventSaved = BBPromise.resolve(null);
  }
  return eventSaved
    .bind(this)
    .then(function () {
      return BBPromise.all([
        this.getQueueUrl(ev.constructor),
        this.getApplicationQueueUrl(ev.constructor, ev.applicationId)
      ]).catch(function (err) {
        logger.info(err, 'caught error in get queue url, SQSMessageBus#send');
      });
    })
    .spread(function (url, url2) {
      return BBPromise.all([
        this.sqs.sendMessageAsync({
          MessageBody: json,
          QueueUrl: url
        }), this.sqs.sendMessageAsync({
          MessageBody: json,
          QueueUrl: url2
        })
      ]);
    }).catch(function (err) {
      logger.error(err, 'error sending event, pausing and retrying');
      delay = delay * 2;
      logger.info({
        delay: delay
      }, 'pasuing before trying again');
      return BBPromise.delay(delay)
        .bind(this)
        .then(function () {
          return this.send(ev, delay);
        });
    }).nodeify(callback);
};
SQSMessageBus.prototype.pause = function (EventType) {
  if (!this.listeners[EventType.name]) {
    return;
  } else {
    this.listeners[EventType.name].pause();
  }
};
SQSMessageBus.prototype.resume = function (EventType) {
  if (!this.listeners[EventType.name]) {
    return;
  } else {
    this.listeners[EventType.name].resume();
  }
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
      ModelResolver.get().Event.findOneAsync({
        applicationId: event.applicationId,
        eventId: event.eventId
      }).then(function mapPayload(eventModel) {
        //rehidrate payload
        event.payload = eventModel.payload;
        delete event.saved;
        onEvent(event);
      });

    });
    listener.start();
    this.listeners[EventType.name] = listener;
  });
};
SQSMessageBus.prototype.keepAlive = function (ev) {
  return this.getQueueUrl(ev.constructor)
    .then(function (url) {
      logger.debug('keeping message alive for another minute');
      return this.sqs.changeMessageVisibilityAsync({
        QueueUrl: url,
        ReceiptHandle: ev.ReceiptHandle,
        VisibilityTimeout: 60
      });
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
