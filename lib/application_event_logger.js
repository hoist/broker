'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.ApplicationEventLogger = undefined;

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _config = require('config');

var _config2 = _interopRequireDefault(_config);

var _rabbit_connector_base = require('./rabbit_connector_base');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

/**
 * Logger class to save application events
 * @extends {RabbitConnectorBase}
 */

var ApplicationEventLogger = exports.ApplicationEventLogger = function (_RabbitConnectorBase) {
  _inherits(ApplicationEventLogger, _RabbitConnectorBase);

  /**
   * create a new event logger
   */

  function ApplicationEventLogger() {
    _classCallCheck(this, ApplicationEventLogger);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(ApplicationEventLogger).call(this));
  }

  /**
   * logs a log message to the event log for an applicaiton
   * @param {ExecutionLogEvent} executionLogEvent - the event to log
   */


  _createClass(ApplicationEventLogger, [{
    key: 'log',
    value: function log(executionLogEvent) {
      var _this2 = this;

      return this._openChannel().then(function (channel) {
        return channel.assertExchange('application-log-messages', 'topic').then(function () {
          var drained = new Promise(function (resolve) {
            channel.on('drain', resolve);
          });
          _this2._logger.info('sending application log');
          return channel.publish('application-log-messages', 'log.' + executionLogEvent.application + '.' + executionLogEvent.type.toLowerCase(), new Buffer(JSON.stringify(executionLogEvent)), {
            mandatory: false,
            persistent: true,
            priority: 3,
            appId: '' + _config2.default.get('Hoist.application.name'),
            messageId: executionLogEvent._id.toString(),
            correlationId: executionLogEvent.correlationId,
            type: 'Execution Log Event'
          }) || drained;
        }).then(function () {
          _this2._logger.info('closing channel');
          return channel.close();
        }).catch(function (err) {
          _this2._logger.error(err);
          _this2._logger.info('closing channel');
          return channel.close().then(function () {
            throw err;
          });
        });
      });
    }
  }]);

  return ApplicationEventLogger;
}(_rabbit_connector_base.RabbitConnectorBase);

exports.default = ApplicationEventLogger;

/**
 * @external {ExecutionLogEvent} https://github.com/hoist/hoist-model/blob/master/lib/models/execution_log_event.js
 */
//# sourceMappingURL=application_event_logger.js.map
