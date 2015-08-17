'use strict';
import config from 'config';
import amqp from 'amqplib';
import logger from '@hoist/logger';
class ConnectionManager {
  constructor() {
    this._logger = logger.child({
      cls: this.constructor.name
    });
  }
  _getConnection() {
    if (this._connection) {
      return Promise.resolve(this._connection);
    } else {
      return Promise.resolve(amqp.connect(config.get('Hoist.rabbit.url'), {
        heartbeat: config.get('Hoist.publisher.heartbeat')
      })).then((connection) => {
        this._logger.debug('connection open');
        this._connection = connection;
        connection.on('close', () => {
          this._logger.error('connection closed');
          delete this._connection;
        });
        connection.on('error', (err) => {
          this._logger.error(err, 'connection threw error');
        });
        return this._connection;
      });
    }
  }
  _closeConnection() {
    if (this._connection) {
      return this._connection.close();
    }
  }
}

export default new ConnectionManager();
