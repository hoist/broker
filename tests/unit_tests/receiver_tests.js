'use strict';
import {
  Receiver
}
from '../../lib';
import {
  Event
}
from '@hoist/model';
import Sinon from 'sinon';
import {
  expect
}
from 'chai';

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
