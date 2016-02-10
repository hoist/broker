'use strict';
import {
  Publisher
}
from '../../src';
import {
  Event
}
from '@hoist/model';
import sinon from 'sinon';
import {
  expect
}
from 'chai';
import amqp from 'amqplib';
import config from 'config';

/** @test {Publisher} */
describe('Publisher', () => {
  let mockChannel = {
    assertQueue: sinon.stub().returns(Promise.resolve(null)),
    assertExchange: sinon.stub().returns(Promise.resolve(null)),
    bindQueue: sinon.stub().returns(Promise.resolve(null)),
    publish: sinon.stub().returns(Promise.resolve(true)),
    once: sinon.stub(),
    close: sinon.stub().returns(Promise.resolve(null)),
    connection: {
      close: sinon.stub().returns(Promise.resolve(null))
    },
    reset: function () {
      this.assertQueue.reset();
      this.assertExchange.reset();
      this.bindQueue.reset();
      this.publish.reset();
      this.close.reset();
      this.connection.close.reset();

    }
  };
  let mockConnection = {
    close: sinon.stub(),
    once: sinon.stub(),
    createChannel: sinon.stub().returns(mockChannel),
    on: sinon.stub(),
    reset: function () {
      this.close.reset();
      this.on.reset();
    }
  };

  /** @test {Publisher#publish} */
  describe('Publisher#publish', () => {
    let event = new Event({
      applicationId: 'application-id',
      eventName: 'eventName',
      correlationId: 'c-id'
    });
    let shallowEvent = JSON.stringify({
      shallow: true
    });
    before(() => {
      sinon.stub(config, 'has').returns(true);
      sinon.stub(config, 'get');
      config.get.withArgs('Hoist.aws.account').returns('aws-account');
      config.get.withArgs('Hoist.aws.secret').returns('aws-secret');
      config.get.withArgs('Hoist.aws.prefix.bucket').returns('test-');

      let publisher = new Publisher();
      sinon.stub(publisher, '_openChannel').returns(Promise.resolve(mockChannel));
      sinon.stub(publisher, '_shallowEvent').returns(Promise.resolve(shallowEvent));
      publisher._connection = mockConnection;
      return publisher.publish(event);
    });
    after(() => {
      config.get.restore();
      config.has.restore();
      mockChannel.reset();
      mockConnection.reset();
    });
    it('sets up the hoist exchange', () => {
      return expect(mockChannel.assertExchange)
        .to.have.been.calledWith('hoist', 'topic');
    });
    it('sets up the exector queue', () => {
      return expect(mockChannel.assertQueue)
        .to.have.been.calledWith('application-id_events', {
          durable: true,
          maxPriority: 10
        });
    });
    it('binds queue to exchange', () => {
      return expect(mockChannel.bindQueue)
        .to.have.been.calledWith('application-id_events', 'hoist', 'event.application-id.#');
    });
    it('publishes event', () => {
      return expect(mockChannel.publish)
        .to.have.been.calledWith('hoist', 'event.application-id.eventName.c-id', sinon.match((buffer) => {
          return expect(buffer.toString()).to.eql(shallowEvent);
        }));
    });
    it('closes channel', () => {
      return expect(mockChannel.close).to.have.been.called;
    });
  });
  describe('Publisher#publish on error', () => {
    let event = new Event({
      applicationId: 'application-id',
      eventName: 'eventName'
    });
    let result;
    before(() => {
      let publisher = new Publisher();
      sinon.stub(publisher, '_openChannel', () => {
        return new Promise((resolve, reject) => {
          reject(new Error('this is a test error'));
        });
      });
      publisher._connection = mockConnection;
      result = publisher.publish(event);
    });
    after(() => {
      mockChannel.reset();
      mockConnection.reset();
    });
    it('percolates the error', () => {
      return expect(result).to.be.rejectedWith('this is a test error');
    });
  });
  /** @test {Publisher#_openChannel} */
  describe('Publisher#_openChannel', () => {
    var result;
    let publisher = new Publisher();
    before(() => {
      sinon.stub(amqp, 'connect').returns(Promise.resolve(mockConnection));
      return publisher._openChannel().then((connection) => {
        result = connection;
      });
    });
    after(() => {
      amqp.connect.restore();
      mockChannel.reset();
      mockConnection.reset();
    });
    it('returns channel', () => {
      return expect(result).to.eql(mockChannel);
    });
  });
  describe('Publisher#_savePayloadToS3', () => {
    describe('if bucket doesnt exist', () => {
      let result;
      let event = {
        applicationId: 'application-id',
        payload: {
          payload: true
        }
      };
      let publisher;
      before(() => {

        publisher = new Publisher();
        sinon.stub(publisher._s3Client, 'headBucket').yields(new Error());
        sinon.stub(publisher._s3Client, 'createBucket').yields();
        sinon.stub(publisher._s3Client, 'upload').yields();
        return publisher._savePayloadToS3(event).then((res) => {
          result = res;
        });
      });
      it('returns an id', () => {
        return expect(result).to.exist;
      });
      it('saves payload to s3 with payload id', () => {
        return expect(publisher._s3Client.upload).to.have.been.calledWith({
          Bucket: 'test-event-payload',
          Key: `${event.applicationId}/${result}`,
          Body: '{"payload":true}',
          ServerSideEncryption: 'AES256'
        });
      });
      it('creates bucket', () => {
        return expect(publisher._s3Client.createBucket).to.have.been.calledWith({
          Bucket: 'test-event-payload',
          ACL: 'private'
        });
      });
    });
    describe('if bucket already exists', () => {
      let result;
      let event = {
        applicationId: 'application-id',
        payload: {
          payload: true
        }
      };
      let publisher;
      before(() => {
        publisher = new Publisher();
        sinon.stub(publisher._s3Client, 'headBucket').yields();
        sinon.stub(publisher._s3Client, 'createBucket').yields();
        sinon.stub(publisher._s3Client, 'upload').yields();
        return publisher._savePayloadToS3(event).then((res) => {
          result = res;
        });
      });
      it('returns an id', () => {
        return expect(result).to.exist;
      });
      it('saves payload to s3 with payload id', () => {
        return expect(publisher._s3Client.upload).to.have.been.calledWith({
          Bucket: 'test-event-payload',
          Key: `${event.applicationId}/${result}`,
          Body: '{"payload":true}',
          ServerSideEncryption: 'AES256'
        });
      });
      it('doesnt create bucket', () => {
        return expect(publisher._s3Client.createBucket).to.not.have.been.called;
      });
    });
  });
});
