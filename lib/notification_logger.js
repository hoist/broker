'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.NotificationLogger = undefined;

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

var NotificationLogger = exports.NotificationLogger = function (_RabbitConnectorBase) {
  _inherits(NotificationLogger, _RabbitConnectorBase);

  /**
   * create a new event logger
   */

  function NotificationLogger() {
    _classCallCheck(this, NotificationLogger);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(NotificationLogger).call(this));
  }

  /**
   * logs a log message to the event log for an applicaiton
   * @param {Notification} notification - the notificaiton to log
   */


  _createClass(NotificationLogger, [{
    key: 'log',
    value: function log(notification) {
      var _this2 = this;

      return this._openChannel().then(function (channel) {
        return channel.assertExchange('notifications', 'topic').then(function () {
          var drained = new Promise(function (resolve) {
            channel.on('drain', resolve);
          });
          _this2._logger.info('sending notification');
          return channel.publish('notifications', 'notification.' + notification.applicationId + '.' + notification.notificationType.toLowerCase(), new Buffer(JSON.stringify(notification)), {
            mandatory: false,
            persistent: true,
            priority: 3,
            appId: '' + _config2.default.get('Hoist.application.name'),
            type: 'Notification'
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

  return NotificationLogger;
}(_rabbit_connector_base.RabbitConnectorBase);

exports.default = NotificationLogger;
//# sourceMappingURL=notification_logger.js.map
