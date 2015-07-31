'use strict';
Object.defineProperty(exports, '__esModule', {
  value: true
});

var _createClass = (function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ('value' in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; })();

var _get = function get(_x, _x2, _x3) { var _again = true; _function: while (_again) { var object = _x, property = _x2, receiver = _x3; desc = parent = getter = undefined; _again = false; if (object === null) object = Function.prototype; var desc = Object.getOwnPropertyDescriptor(object, property); if (desc === undefined) { var parent = Object.getPrototypeOf(object); if (parent === null) { return undefined; } else { _x = parent; _x2 = property; _x3 = receiver; _again = true; continue _function; } } else if ('value' in desc) { return desc.value; } else { var getter = desc.get; if (getter === undefined) { return undefined; } return getter.call(receiver); } } };

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError('Cannot call a class as a function'); } }

function _inherits(subClass, superClass) { if (typeof superClass !== 'function' && superClass !== null) { throw new TypeError('Super expression must either be null or a function, not ' + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var _config = require('config');

var _config2 = _interopRequireDefault(_config);

var _rabbit_connector_base = require('./rabbit_connector_base');

/**
 * Logger class to save application events
 * @extends {RabbitConnectorBase}
 */

var _rabbit_connector_base2 = _interopRequireDefault(_rabbit_connector_base);

var ApplicationEventLogger = (function (_RabbitConnectorBase) {
  _inherits(ApplicationEventLogger, _RabbitConnectorBase);

  /**
   * create a new event logger
   */

  function ApplicationEventLogger() {
    _classCallCheck(this, ApplicationEventLogger);

    _get(Object.getPrototypeOf(ApplicationEventLogger.prototype), 'constructor', this).call(this);
  }

  /**
   * logs a log message to the event log for an applicaiton
   * @param {ExecutionLogEvent} executionLogEvent - the event to log
   */

  _createClass(ApplicationEventLogger, [{
    key: 'log',
    value: function log(executionLogEvent) {
      var _this = this;

      return this._openChannel().then(function (channel) {
        return channel.assertExchange('application-log-messages', 'topic').then(function () {
          return channel.publish('application-log-messages', 'log.' + executionLogEvent.application + '.' + executionLogEvent.type.toLowerCase(), new Buffer(JSON.stringify(executionLogEvent)), {
            mandatory: false,
            persistent: true,
            priority: 3,
            appId: '' + _config2['default'].get('Hoist.application.name'),
            messageId: executionLogEvent._id.toString(),
            correlationId: executionLogEvent.correlationId,
            type: 'Execution Log Event'
          });
        });
      }).then(function () {
        _this._resetTimeout();
      })['catch'](function (err) {
        _this._resetTimeout();
        throw err;
      });
    }
  }]);

  return ApplicationEventLogger;
})(_rabbit_connector_base2['default']);

exports['default'] = ApplicationEventLogger;

/**
 * @external {ExecutionLogEvent} https://github.com/hoist/hoist-model/blob/master/lib/models/execution_log_event.js
 */
module.exports = exports['default'];
//# sourceMappingURL=application_event_logger.js.map