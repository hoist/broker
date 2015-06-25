'use strict';
import config from 'config';
import logger from '@hoist/logger';
import Bluebird from 'bluebird';
import AWS from 'aws-sdk';
import {
  Event
}
from '@hoist/model';
import {
  clone
}
from 'lodash';

/**
 * Receiver takes messages from RabbitMQ and rehydrates them into events
 */
class Receiver {
  /**
   * Create a new receiver
   */
  constructor() {
    var bucketPrefix = '';
    if (config.has('Hoist.aws.prefix.bucket')) {
      bucketPrefix = config.get('Hoist.aws.prefix.bucket');
    }
    this._payloadBucketName = `${bucketPrefix}event-payload`;
    this._logger = logger.child({
      cls: this.constructor.name
    });
    this._s3Client = this._s3Client || Bluebird.promisifyAll(new AWS.S3());
  }

  _populatePayloadFromS3(message) {
    let m = clone(message);
    return this._s3Client.getObjectAsync({
        Bucket: this._payloadBucketName,
        Key: `${message.applicationId}/${message.payload}`
      })
      .then((response) => {
        var payload = JSON.parse(response.Body.toString());
        delete m.payload;
        m.payload = payload;
        return m;
      }).catch(() => {
        return message;
      });
  }

  /**
   * reconstiute an {@link Event} from a RabbitMQ message
   * @param {Object} message - the raw rabbitmq message
   * @returns {Promise<Event>} - the reconstituted event
   */
  restore(message) {
    return this._populatePayloadFromS3(message)
      .then((messageWithPayload) => {
        return new Event(messageWithPayload);
      });
  }
}

export default Receiver;
