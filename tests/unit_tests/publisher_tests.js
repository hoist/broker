'use strict';
import Publisher from '../../lib/publisher';
import {
  Event
}
from '@hoist/model';
import Sinon from 'sinon';
import {
  expect
}
from 'chai';
import amqp from 'amqplib';
/** @test {Publisher} */
describe('Publisher', () => {
  let mockChannel = {
    assertQueue: Sinon.stub().returns(Promise.resolve(null)),
    assertExchange: Sinon.stub().returns(Promise.resolve(null)),
    bindQueue: Sinon.stub().returns(Promise.resolve(null)),
    publish: Sinon.stub().returns(Promise.resolve(null)),
    once: Sinon.stub(),
    reset: function () {
      this.assertQueue.reset();
      this.assertExchange.reset();
      this.bindQueue.reset();
      this.publish.reset();
    }
  };
  let mockConnection = {
    close: Sinon.stub(),
    once: Sinon.stub(),
    createChannel: Sinon.stub().returns(mockChannel),
    reset: function () {
      this.close.reset();
    }
  };
  /** @test {Publisher#publish} */
  describe('Publisher#publish', () => {
    let event = new Event({
      applicationId: 'application-id',
      eventName: 'eventName'
    });
    let shallowEvent = JSON.stringify({
      shallow: true
    });
    let clock;
    let initialTimeoutCalled;
    before(() => {
      clock = Sinon.useFakeTimers();

      let publisher = new Publisher();
      publisher._idleTimeout = setTimeout(() => {
        initialTimeoutCalled = true;
      }, 1);
      Sinon.stub(publisher, '_openChannel').returns(Promise.resolve(mockChannel));
      Sinon.stub(publisher, '_shallowEvent').returns(Promise.resolve(shallowEvent));
      publisher._connection = mockConnection;
      return publisher.publish(event);
    });
    after(() => {
      clock.restore();
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
          durable: true
        });
    });
    it('binds queue to exchange', () => {
      return expect(mockChannel.bindQueue)
        .to.have.been.calledWith('application-id_events', 'hoist', 'event.application-id.#');
    });
    it('publishes event', () => {
      return expect(mockChannel.publish)
        .to.have.been.calledWith('hoist', 'event.application-id.eventName', Sinon.match((buffer) => {
          return expect(buffer.toString()).to.eql(shallowEvent);
        }));
    });
    it('closes connection after timeout', () => {
      return new Promise((resolve) => resolve(expect(mockConnection.close).to.not.have.been.called))
        .then(() => {
          clock.tick(200);
        }).then(() => {
          return expect(mockConnection.close).to.have.been.called;
        });
    });
    it('clears initial timeout', () => {
      return new Promise((resolve) => resolve(expect(initialTimeoutCalled).to.not.exist))
        .then(() => {
          clock.tick(200);
        }).then(() => {
          return expect(initialTimeoutCalled).to.not.exist;
        });
    });
  });
/** @test {Publisher#_openChannel} */
  describe('Publisher#_openChannel', () => {
    describe('without open channel', () => {
      let clock;
      let initialTimeoutCalled;
      var result;
      let publisher = new Publisher();
      before(() => {
        clock = Sinon.useFakeTimers();
        Sinon.stub(amqp, 'connect').returns(Promise.resolve(mockConnection));

        publisher._idleTimeout = setTimeout(() => {
          initialTimeoutCalled = true;
        });
        return publisher._openChannel().then((connection) => {
          result = connection;
        });
      });
      after(() => {
        amqp.connect.restore();
        clock.restore();
        mockChannel.reset();
        mockConnection.reset();
      });
      it('clears initial timeout', () => {
        return new Promise((resolve) => resolve(expect(initialTimeoutCalled).to.not.exist))
          .then(() => {
            clock.tick(200);
          }).then(() => {
            return expect(initialTimeoutCalled).to.not.exist;
          });
      });
      it('returns channel', () => {
        return expect(result).to.eql(mockChannel);
      });
      it('saves connection on publisher', () => {
        return expect(publisher._connection).to.eql(mockConnection);
      });
      it('saves channel on publisher', () => {
        return expect(publisher._channel).to.eql(mockChannel);
      });
    });
    describe('with open channel', () => {
      let clock;
      let initialTimeoutCalled;
      var result;
      let publisher = new Publisher();
      var altChannel = {};
      before(() => {
        clock = Sinon.useFakeTimers();

        publisher._idleTimeout = setTimeout(() => {
          initialTimeoutCalled = true;
        });
        publisher._channel = altChannel;
        return publisher._openChannel().then((connection) => {
          result = connection;
        });
      });
      after(() => {
        clock.restore();
        mockChannel.reset();
        mockConnection.reset();
      });
      it('clears initial timeout', () => {
        return new Promise((resolve) => resolve(expect(initialTimeoutCalled).to.not.exist))
          .then(() => {
            clock.tick(200);
          }).then(() => {
            return expect(initialTimeoutCalled).to.not.exist;
          });
      });
      it('returns channel', () => {
        return expect(result).to.eql(altChannel);
      });
    });
  });
});