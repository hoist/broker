'use strict';
import config from 'config';
import RabbitConnectorBase from './rabbit_connector_base';
/**
 * Logger class to save application events
 * @extends {RabbitConnectorBase}
 */
class ApplicationEventLogger extends RabbitConnectorBase {

  /**
   * create a new event logger
   */
  constructor() {
    super();
  }

  /**
   * logs a log message to the event log for an applicaiton
   * @param {ExecutionLogEvent} executionLogEvent - the event to log
   */
  log(executionLogEvent) {
    return this._openChannel()
      .then((channel) => {
        return channel.assertExchange('application-log-messages', 'topic').then(() => {
            let drained = new Promise((resolve) => {
              channel.on('drain', resolve);
            });
            this._logger.info('sending application log');
            return channel.publish('application-log-messages', `log.${executionLogEvent.application}.${executionLogEvent.type.toLowerCase()}`, new Buffer(JSON.stringify(executionLogEvent)), {
              mandatory: false,
              persistent: true,
              priority: 3,
              appId: `${config.get('Hoist.application.name')}`,
              messageId: executionLogEvent._id.toString(),
              correlationId: executionLogEvent.correlationId,
              type: 'Execution Log Event'
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

export default ApplicationEventLogger;

/**
 * @external {ExecutionLogEvent} https://github.com/hoist/hoist-model/blob/master/lib/models/execution_log_event.js
 */
