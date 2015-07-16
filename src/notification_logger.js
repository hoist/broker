'use strict';
import config from 'config';
import RabbitConnectorBase from './rabbit_connector_base';
/**
 * Logger class to save application events
 * @extends {RabbitConnectorBase}
 */
class NotificationLogger extends RabbitConnectorBase {

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
          return channel.publish('notifications', `notification.${notification.applicationId}.${notification.notificationType.toLowerCase()}`, new Buffer(JSON.stringify(notification)), {
            mandatory: false,
            persistent: true,
            priority: 3,
            appId: `${config.get('Hoist.application.name')}`,
            type: 'Notification'
          });
        });
      }).then(() => {
        this._resetTimeout();
      }).catch((err) => {
        this._resetTimeout();
        throw err;
      });
  }
}

export default NotificationLogger;
