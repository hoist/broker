'use strict';
import {
  Event
}
from '@hoist/model';
import {
  Publisher,
  connectionManager
}
from '../../lib';
import Bluebird from 'bluebird';
import config from 'config';
import request from 'request-promise';
import {
  expect
}
from 'chai';
import AWS from 'aws-sdk';
AWS.config.update({
  region: config.get('Hoist.aws.region')
});

let s3 = Bluebird.promisifyAll(new AWS.S3());

let baseRabbitManagementUri = `${config.get('Hoist.rabbit.managementUrl')}api/`;
/** @test {Publisher#publish} */
describe('Integration: Publisher#publish', function () {

  this.timeout(10000);
  let event = new Event({
    applicationId: 'application-id',
    eventName: 'testevent',
    correlationId: 'c-id',
    payload: {
      key: 'value',
      child: {
        key: 'child value'
      }
    }
  });
  let queueUri = `${baseRabbitManagementUri}queues/${encodeURIComponent('/')}/${encodeURIComponent('application-id_events')}`;
  let exchangeUri = `${baseRabbitManagementUri}exchanges/${encodeURIComponent('/')}/hoist`;
  let publisher;
  before(() => {
    publisher = new Publisher();
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
      return publisher.publish(event).then(() => {
        return Bluebird.delay(2000);
      });
    }).catch((err) => {
      console.log(err, err.stack);
      throw err;
    });
  });
  after(() => {
    return connectionManager._closeConnection().then(() => {
      return Promise.all([
        request({
          method: 'DELETE',
          uri: queueUri,
          json: true
        }),
        request({
          method: 'DELETE',
          uri: exchangeUri,
          json: true
        })
      ]);
    });
  });
  it('saves a shallow copy of the event without payload to rabbitmq', () => {
    return request({
      method: 'POST',
      uri: `${queueUri}/get`,
      body: {
        count: 1,
        requeue: true,
        encoding: 'auto'
      },
      headers: {
        'Content-type': 'application/json',
        'accept': 'text/html'
      },
      json: true
    }).then((response) => {
      let message = response[0];
      expect(message.routing_key).to.eql('event.application-id.testevent.c-id');
      return JSON.parse(message.payload);
    }).then((savedEvent) => {
      return expect(savedEvent._id).to.eql(event._id.toString()) &&
        expect(savedEvent.applicationId).to.eql(event.applicationId) &&
        expect(savedEvent.payload).to.be.a('string');
    });
  });
  it('puts the payload into S3', () => {
    return request({
      method: 'POST',
      uri: `${queueUri}/get`,
      body: {
        count: 1,
        requeue: true,
        encoding: 'auto'
      },
      headers: {
        'Content-type': 'application/json',
        'accept': 'text/html'
      },
      json: true
    }).then((response) => {
      let message = response[0];
      return JSON.parse(message.payload).payload;
    }).then((payloadId) => {
      return s3.getObjectAsync({
        Bucket: 'test-event-payload',
        Key: `application-id/${payloadId}`
      });
    }).then((response) => {
      var payload = JSON.parse(response.Body.toString());
      return expect(payload).to.eql(event.payload);
    });
  });
});
