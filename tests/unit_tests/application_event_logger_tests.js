'use strict';
import {
  ApplicationEventLogger
}
from '../../src/application_event_logger';
import sinon from 'sinon';
import {
  expect
}
from 'chai';
import {
  ExecutionLogEvent
}
from '@hoist/model';


/* @test {ApplicationEventLogger} */
describe('ApplicationEventLogger', () => {
  /* @test {ApplicationEventLogger#log} */
  describe('ApplicationEventLogger#log', () => {
    let executionLogEvent;
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
        this.connection.close.reset();
        this.close.reset();
      }
    };
    before(() => {
      executionLogEvent = new ExecutionLogEvent({
        application: 'application-id',
        environment: 'live',
        moduleName: 'moduleName',
        eventId: 'event-id',
        correlationId: 'correlation-id',
        error: false,
        message: 'this is a message',
        type: 'EVT',
        errorStack: ['string1', 'string2']
      });
      let applicationEventLogger = new ApplicationEventLogger();
      sinon.stub(applicationEventLogger, '_openChannel').returns(Promise.resolve(mockChannel));
      return applicationEventLogger.log(executionLogEvent);
    });
    it('creates an exchange for execution log events', () => {
      return expect(mockChannel.assertExchange)
        .to.have.been.calledWith('application-log-messages', 'topic');
    });
    it('logs the message with correct params', () => {
      return expect(mockChannel.publish)
        .to.have.been.calledWith('application-log-messages', 'log.application-id.evt', new Buffer(JSON.stringify(executionLogEvent)), {
          mandatory: false,
          persistent: true,
          priority: 3,
          appId: 'Broker',
          messageId: executionLogEvent._id.toString(),
          correlationId: 'correlation-id',
          type: 'Execution Log Event'
        });
    });
  });
});
