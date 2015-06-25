'use strict';
import config from 'config';
import logger from '@hoist/logger';
import amqp from 'amqplib';
import uuid from 'uuid';
import AWS from 'aws-sdk';
import Bluebird from 'bluebird';

let s3 = Bluebird.promisifyAll(new AWS.S3());

/**
 * Takes {@link Event} objects and publishes them to the bus.
 * also saves the paylod to S3
 */
class Publisher {
  constructor() {
    console.log(AWS.config);
    var bucketPrefix = '';
    if (config.has('Hoist.aws.prefix.bucket')) {
      bucketPrefix = config.get('Hoist.aws.prefix.bucket');
    }
    this._payloadBucketName = `${bucketPrefix}event-payload`;
    this._logger = logger.child({
      cls: this.constructor.name
    });
  }
  _openChannel() {
    if (this._idleTimeout) {
      clearTimeout(this._idleTimeout);
      delete this._idleTimeout;
    }
    if (this._channel) {
      this._logger.debug('reusing existing channel');
      return Promise.resolve(this._channel);
    } else {
      this._logger.debug('creating new channel');
      return Promise.resolve(amqp.connect(config.get('Hoist.rabbit.url'), {
          heartbeat: config.get('Hoist.publisher.heartbeat')
        }))
        .then((connection) => {
          this._logger.debug('connection open');
          this._logger.info('got a connection, creating channel');
          this._connection = connection;
          connection.once('close', () => {
            if (this._idleTimeout) {
              clearTimeout(this._idleTimeout);
              delete this._idelTimeout;
            }
            delete this._connection;
            delete this._channel;
          });
          return connection.createChannel();
        }).then((channel) => {
          channel.once('close', () => {
            this._logger.debug('channel closed');
          });
          this._logger.debug('channel open');
          this._logger.info('returning channel');
          this._channel = channel;
          return channel;
        });
    }
  }
  _savePayloadToS3(event) {
    return Promise.resolve(uuid.v4())
      .then((payloadId) => {
        var payload = JSON.stringify(event.payload);
        return s3.headBucketAsync({
            Bucket: this._payloadBucketName
          })
          .catch(() => {
            return s3.createBucketAsync({
              Bucket: this._payloadBucketName,
              ACL: 'private'
            });
          }).then(() => {
            return s3.uploadAsync({
              Bucket: this._payloadBucketName,
              Key: `${event.applicationId}/${payloadId}`,
              Body: payload,
              ServerSideEncryption: 'AES256'
            });
          }).then(() => {
            return payloadId;
          });
      });
  }
  _shallowEvent(event) {
    return this._savePayloadToS3(event).then((payloadId) => {
      var jsonObject = event.toJSON();
      jsonObject.payload = payloadId;
      return JSON.stringify(jsonObject);
    });
  };


  /**
   * publish the event to RabbitMQ and save the paylod to S3
   * @param {Event} event - the event to publish
   * @returns {Promise<Event>} - Promise resolves once the event is published to the bus
   */
  publish(event) {
    let applicationId = event.applicationId;
    let eventQueue = `${applicationId}_events`;
    return this._openChannel()
      .then((channel) => {
        return Promise.all([
          channel.assertQueue(eventQueue, {
            durable: true
          }),
          channel.assertExchange('hoist', 'topic')
        ]).then(() => {
          return channel.bindQueue(eventQueue, 'hoist', `event.${applicationId}.#`);
        }).then(() => {
          return this._shallowEvent(event);
        }).then((shallowEvent) => {
          return channel.publish('hoist', `event.${applicationId}.${event.eventName}`, new Buffer(shallowEvent), {
            mandatory: true,
            persistent: true,
            priority: 3,
            appId: `${config.get('Hoist.application.name')}`,
            messageId: event._id.toString(),
            correlationId: event.correlationId,
            type: 'Hoist Event'
          });
        });
      }).then(() => {
        if (this._idleTimeout) {
          clearTimeout(this._idleTimeout);
          delete this._idleTimeout;
        }
        this._idleTimeout = setTimeout(() => {
          if (this._connection) {
            this._connection.close();
          }
        }, config.get('Hoist.publisher.timeout'));
      }).catch((err) => {
        if (this._idleTimeout) {
          clearTimeout(this._idleTimeout);
          delete this._idleTimeout;
        }
        this._idleTimeout = setTimeout(() => {
          if (this._connection) {
            this._connection.close();
          }
        }, config.get('Hoist.publisher.timeout'));
        throw err;
      });

  }
}

export default Publisher;
