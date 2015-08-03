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

var NotificationLogger = (function (_RabbitConnectorBase) {
  _inherits(NotificationLogger, _RabbitConnectorBase);

  /**
   * create a new event logger
   */

  function NotificationLogger() {
    _classCallCheck(this, NotificationLogger);

    _get(Object.getPrototypeOf(NotificationLogger.prototype), 'constructor', this).call(this);
  }

  /**
   * logs a log message to the event log for an applicaiton
   * @param {Notification} notification - the notificaiton to log
   */

  _createClass(NotificationLogger, [{
    key: 'log',
    value: function log(notification) {
      var _this = this;

      return this._openChannel().then(function (channel) {
        return channel.assertExchange('notifications', 'topic').then(function () {
          var drained = new Promise(function (resolve) {
            channel.on('drain', resolve);
          });
          _this._logger.info('sending notification');
          return channel.publish('notifications', 'notification.' + notification.applicationId + '.' + notification.notificationType.toLowerCase(), new Buffer(JSON.stringify(notification)), {
            mandatory: false,
            persistent: true,
            priority: 3,
            appId: '' + _config2['default'].get('Hoist.application.name'),
            type: 'Notification'
          }) || drained;
        }).then(function () {
          _this._logger.info('closing connection');
          var connection = channel.connection;
          return channel.close().then(function () {
            return connection.close();
          });
        })['catch'](function (err) {
          _this._logger.error(err);
          _this._logger.info('closing connection');
          var connection = channel.connection;
          return channel.close().then(function () {
            return connection.close().then(function () {
              throw err;
            });
          });
        });
      });
    }
  }]);

  return NotificationLogger;
})(_rabbit_connector_base2['default']);

exports['default'] = NotificationLogger;
module.exports = exports['default'];
//# sourceMappingURL=notification_logger.js.map