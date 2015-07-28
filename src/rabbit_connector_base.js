'use strict';
import amqp from 'amqplib';
import config from 'config';
import logger from '@hoist/logger';
/**
 * Base class for managing publising events to rabbit mq
 * manages connection lifecycle etc
 */
class RabbitConnectorBase {

  /**
   * instantiate a new instance
   * @abstract
   */
  constructor() {
    this._logger = logger.child({
      cls: this.constructor.name
    });
  }

  /**
   * stop any existing connection timeout
   * @protected
   */
  _clearTimeout() {
    if (this._idleTimeout) {
      clearTimeout(this._idleTimeout);
      delete this._idleTimeout;
    }
  }

  /**
   * stop and restart connection timeout
   * @protected
   */
  _resetTimeout() {
    this._clearTimeout();
    this._idleTimeout = setTimeout(() => {
      if (this._connection) {
        this._connection.close();
      }
    }, config.get('Hoist.publisher.timeout'));
  }

  /**
   * open up a new channel to rabbit or reuse an existing one
   * @protected
   * @returns {Promise}
   */
  _openChannel() {
    this._clearTimeout();
    if (this._channel) {
      this._logger.debug('reusing existing channel');
      return Promise.resolve(this._channel);
    } else {
      this._logger.debug('creating new channel');
      return Promise.resolve(amqp.connect(config.get('Hoist.rabbit.url'), {
          heartbeat: config.get('Hoist.publisher.heartbeat')
        }))
        .then((connection) => {
          this._logger.debug('connection open');
          this._logger.info('got a connection, creating channel');
          this._connection = connection;
          connection.once('close', () => {
            this._clearTimeout();
            delete this._connection;
            delete this._channel;
          });
          return connection.createChannel();
        }).then((channel) => {
          channel.once('close', () => {
            this._logger.debug('channel closed');
          });
          this._logger.debug('channel open');
          this._logger.info('returning channel');
          this._channel = channel;
          return channel;
        });
    }
  }
}

export default RabbitConnectorBase;
