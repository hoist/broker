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
   * open up a new channel to rabbit or reuse an existing one
   * @protected
   * @returns {Promise}
   */
  _openChannel() {
    this._logger.debug('creating new channel');
    return Promise.resolve(amqp.connect(config.get('Hoist.rabbit.url'), {
        heartbeat: config.get('Hoist.publisher.heartbeat')
      }))
      .then((connection) => {
        this._logger.debug('connection open');
        this._logger.info('got a connection, creating channel');
        return connection.createChannel();
      }).then((channel) => {
        this._logger.debug('channel open');
        this._logger.info('returning channel');
        return channel;
      });
  }
}

export default RabbitConnectorBase;
