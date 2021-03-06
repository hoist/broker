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
export class Receiver {
  /**
   * Create a new receiver
   */
  constructor() {
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
    if (!m.payload) {
      m.payload = {};
      return Promise.resolve(m);
    }

    return this._getPayloadFromId(message.applicationId, message.payload)
      .then((payload) => {
        delete m.payload;
        m.payload = payload;
        return m;
      }).catch(() => {
        return message;
      });

  }

  _getPayloadFromId(applicationId, payloadId) {
    if (!payloadId) {
      return Promise.resolve({});
    }
    return this._s3Client.getObjectAsync({
        Bucket: this._payloadBucketName,
        Key: `${applicationId}/${payloadId}`
      })
      .then((response) => {
        this._logger.info('inside payload response');
        var payload = JSON.parse(response.Body.toString());
        return payload;
      }).catch(() => {
        return null;
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
