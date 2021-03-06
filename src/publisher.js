'use strict';
import config from 'config';
import uuid from 'uuid';
import AWS from 'aws-sdk';
import {
  ApplicationEventLogger
}
from './application_event_logger';
import Bluebird from 'bluebird';
import {
  ExecutionLogEvent
}
from '@hoist/model';


/**
 * Takes {@link Event} objects and publishes them to the bus.
 * also saves the paylod to S3
 * @extends {ApplicationEventLogger}
 */
export class Publisher extends ApplicationEventLogger {

  /**
   * Create a new Publisher
   */
  constructor() {
    super();
    var bucketPrefix = '';
    let configOverrides;
    if (config.has('Hoist.aws.region')) {
      if (!configOverrides) {
        configOverrides = {};
      }
      configOverrides.region = config.get('Hoist.aws.region');

    }
    if (config.has('Hoist.aws.account')) {
      if (!configOverrides) {
        configOverrides = {};
      }
      configOverrides.accessKeyId = config.get('Hoist.aws.account');
    }
    if (config.has('Hoist.aws.secret')) {
      if (!configOverrides) {
        configOverrides = {};
      }
      configOverrides.secretAccessKey = config.get('Hoist.aws.secret');

    }
    if (configOverrides) {
      AWS.config.update(configOverrides);
    }
    if (config.has('Hoist.aws.prefix.bucket')) {
      bucketPrefix = config.get('Hoist.aws.prefix.bucket');
    }
    this._payloadBucketName = `${bucketPrefix}event-payload`;
    this._s3Client = this._s3Client || Bluebird.promisifyAll(new AWS.S3());
  }
  _ensureS3Setup() {
    if (this._s3setup) {
      return this._s3setup;
    } else {

      this._s3setup = this._s3Client.headBucketAsync({
        Bucket: this._payloadBucketName
      })
        .catch((err) => {
          this._logger.error(err);
          this._logger.info({
            bucketName: this._payloadBucketName
          }, 'creating bucket');

          return this._s3Client.createBucketAsync({
            Bucket: this._payloadBucketName,
            ACL: 'private'
          });
        });

      return this._s3setup;
    }
  }
  _savePayloadToS3(event) {

    return Promise.resolve(uuid.v4())
      .then((payloadId) => {
        this._logger.info({
          bucketName: this._payloadBucketName
        }, 'looking up bucket');
        if (!event.payload) {
          return Promise.resolve(null);
        }
        var payload = JSON.stringify(event.payload);
        return this._ensureS3Setup()
          .then(() => {
            this._logger.info({
              bucketName: this._payloadBucketName
            }, 'uploading payload');
            return this._s3Client.uploadAsync({
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
              durable: true,
              maxPriority: 10
            }),
            channel.assertExchange('hoist', 'topic')
          ]).then(() => {
            return channel.bindQueue(eventQueue, 'hoist', `event.${applicationId}.#`);
          }).then(() => {
            return this._shallowEvent(event);
          }).then((shallowEvent) => {
            let drained = new Promise((resolve) => {
              channel.on('drain', resolve);
            });
            let result = channel.publish('hoist', `event.${applicationId}.${event.eventName}.${event.correlationId}`, new Buffer(shallowEvent), {
              mandatory: true,
              persistent: true,
              priority: event.priority || 3,
              appId: `${config.get('Hoist.application.name')}`,
              messageId: event._id.toString(),
              correlationId: event.correlationId,
              type: 'Hoist Event'
            });
            this._logger.info({
              result,
              routingKey: `event.${applicationId}.${event.eventName}.${event.correlationId}`
            }, 'publish result');
            return result || drained;
          }).then(() => {
            this._logger.info('closing channel');
            return channel.close();
          })
          .catch((err) => {
            this._logger.error(err);
            this._logger.info('closing channel');
            return channel.close().then(() => {
              throw err;
            });
          });
      }).then(() => {
        this._logger.info('sending log event');
        this.log(new ExecutionLogEvent({
          application: applicationId,
          environment: 'live',
          eventId: event.eventId,
          correlationId: event.correlationId,
          moduleName: event.eventName,
          type: 'EVT',
          message: `event ${event.eventName} raised (id: ${event.eventId})`
        }));
      });

  }
}

export
default Publisher;
