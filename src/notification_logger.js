'use strict';
import config from 'config';
import {
  RabbitConnectorBase
}
from './rabbit_connector_base';
/**
 * Logger class to save application events
 * @extends {RabbitConnectorBase}
 */
export class NotificationLogger extends RabbitConnectorBase {

  /**
   * create a new event logger
   */
  constructor() {
    super();
  }

  /**
   * logs a log message to the event log for an applicaiton
   * @param {Notification} notification - the notificaiton to log
   */
  log(notification) {
    return this._openChannel()
      .then((channel) => {
        return channel.assertExchange('notifications', 'topic').then(() => {
            let drained = new Promise((resolve) => {
              channel.on('drain', resolve);
            });
            this._logger.info('sending notification');
            return channel.publish('notifications', `notification.${notification.applicationId}.${notification.notificationType.toLowerCase()}`, new Buffer(JSON.stringify(notification)), {
              mandatory: false,
              persistent: true,
              priority: 3,
              appId: `${config.get('Hoist.application.name')}`,
              type: 'Notification'
            }) || drained;
          }).then(() => {
            this._logger.info('closing channel');
            return channel.close();
          })
          .catch((err) => {
            this._logger.error(err);
            this._logger.info('closing channel');
            return channel.close().then(() => {
              throw err;
            });
          });
      });
  }
}

export
default NotificationLogger;
