'use strict';
import {
  Receiver
}
from '../../src';
import {
  Event
}
from '@hoist/model';
import Sinon from 'sinon';
import {
  expect
}
from 'chai';
import config from 'config';
/** @test {Receiver} */
describe('Receiver', () => {
  /** @test {Receiver#restore} */
  describe('Receiver#restore', () => {
    let receiver;
    let event;
    let message = {
      _id: 'event-id',
      applicationId: 'applicationId',
      payload: 'payload'
    };
    before(() => {
      Sinon.stub(config, 'has').returns(true);
      Sinon.stub(config, 'get');
      config.get.withArgs('Hoist.aws.account').returns('aws-account');
      config.get.withArgs('Hoist.aws.secret').returns('aws-secret');
      config.get.withArgs('Hoist.aws.prefix.bucket').returns('test-');
      receiver = new Receiver();
      Sinon.stub(receiver, '_populatePayloadFromS3', (m) => {
        m.payload = {
          key: 'value'
        };
        return Promise.resolve(m);
      });
      return receiver.restore(message).then((ev) => {
        event = ev;
      });
    });
    after(() => {
      config.get.restore();
      config.has.restore();
      receiver._populatePayloadFromS3.restore();
    });
    it('populates payload', () => {
      return expect(event.payload.key).to.eql('value');
    });
    it('returns an Event', () => {
      return expect(event).to.be.instanceOf(Event);
    });
  });
  /** @test {Receiver#_populatePayloadFromS3} */
  describe('Receiver#_populatePayloadFromS3', () => {
    describe('given payload exists', () => {
      let receiver;
      let result;
      let message = {
        _id: 'event-id',
        applicationId: 'applicationId',
        payload: 'payload'
      };
      before(() => {
        receiver = new Receiver();
        Sinon.stub(receiver._s3Client, 'getObject').yields(null, {
          Body: new Buffer('{"key":"value"}')
        });
        return receiver._populatePayloadFromS3(message).then((m) => {
          result = m;
        });
      });
      it('populates payload', () => {
        return expect(result.payload.key).to.eql('value');
      });
      it('doesnt affect original message', () => {
        return expect(message.payload).to.eql('payload');
      });
    });
  });
});
