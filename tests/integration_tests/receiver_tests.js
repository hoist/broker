'use strict';
import uuid from 'uuid';
import {
  Receiver
}
from '../../lib';
import AWS from 'aws-sdk';
import config from 'config';
import {
  Event
}
from '@hoist/model';
import {
  expect
}
from 'chai';
import Bluebird from 'bluebird';

AWS.config.update({
  region: config.get('Hoist.aws.region')
});

let s3 = Bluebird.promisifyAll(new AWS.S3());

/** @test {Receiver} */
describe('Receiver', () => {
  /** @test {Receiver#restore} */
  describe('Receiver#restore', function () {
    this.timeout(5000);
    let payload = {
      value: true
    };
    let message = {
      eventId: 'event-id',
      applicationId: 'application-id',
      eventName: 'eventName',
      environment: 'live',
      correlationId: 'correlation-id',
      bucketId: 'bucket-id',
      payload: uuid.v4()
    };
    let event;
    before(() => {
      let receiver = new Receiver();
      return s3.headBucketAsync({
        Bucket: 'test-event-payload'
      }).catch(() => {
        return s3.createBucketAsync({
          Bucket: 'test-event-payload',
          ACL: 'private'
        }).then(() => {
          return s3.putBucketLifecycleAsync({
            Bucket: 'test-event-payload',
            LifecycleConfiguration: {
              Rules: [{
                Prefix: '',
                Status: 'Enabled',
                Expiration: {
                  Days: 1
                }
              }]
            }
          });
        });
      }).then(() => {
        return s3.uploadAsync({
          Bucket: 'test-event-payload',
          Key: `${message.applicationId}/${message.payload}`,
          Body: JSON.stringify(payload),
          ServerSideEncryption: 'AES256'
        });
      }).then(() => {
        return receiver.restore(message)
          .then((ev) => {
            event = ev;
          });
      });
    });
    it('returns event with payload', () => {
      return expect(event.payload).to.eql(payload);
    });
    it('returns an Event', () => {
      return expect(event).to.be.instanceOf(Event);
    });
    it('populates event id', ()=>{
      return expect(event.eventId).to.eql(message.eventId);
    });
    it('populates application id', ()=>{
      return expect(event.applicationId).to.eql(message.applicationId);
    });
  });
});
