'use strict';
Object.defineProperty(exports, '__esModule', {
  value: true
});

var _createClass = (function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ('value' in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; })();

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError('Cannot call a class as a function'); } }

var _amqplib = require('amqplib');

var _amqplib2 = _interopRequireDefault(_amqplib);

var _config = require('config');

var _config2 = _interopRequireDefault(_config);

var _hoistLogger = require('@hoist/logger');

/**
 * Base class for managing publising events to rabbit mq
 * manages connection lifecycle etc
 */

var _hoistLogger2 = _interopRequireDefault(_hoistLogger);

var RabbitConnectorBase = (function () {

  /**
   * instantiate a new instance
   * @abstract
   */

  function RabbitConnectorBase() {
    _classCallCheck(this, RabbitConnectorBase);

    this._logger = _hoistLogger2['default'].child({
      cls: this.constructor.name
    });
  }

  /**
   * stop any existing connection timeout
   * @protected
   */

  _createClass(RabbitConnectorBase, [{
    key: '_clearTimeout',
    value: function _clearTimeout() {
      if (this._idleTimeout) {
        clearTimeout(this._idleTimeout);
        delete this._idleTimeout;
      }
    }

    /**
     * stop and restart connection timeout
     * @protected
     */
  }, {
    key: '_resetTimeout',
    value: function _resetTimeout() {
      var _this = this;

      this._clearTimeout();
      this._idleTimeout = setTimeout(function () {
        if (_this._connection) {
          _this._connection.close();
        }
      }, _config2['default'].get('Hoist.publisher.timeout'));
    }

    /**
     * open up a new channel to rabbit or reuse an existing one
     * @protected
     * @returns {Promise}
     */
  }, {
    key: '_openChannel',
    value: function _openChannel() {
      var _this2 = this;

      this._clearTimeout();
      if (this._channel) {
        this._logger.debug('reusing existing channel');
        return Promise.resolve(this._channel);
      } else {
        this._logger.debug('creating new channel');
        return Promise.resolve(_amqplib2['default'].connect(_config2['default'].get('Hoist.rabbit.url'), {
          heartbeat: _config2['default'].get('Hoist.publisher.heartbeat')
        })).then(function (connection) {
          _this2._logger.debug('connection open');
          _this2._logger.info('got a connection, creating channel');
          _this2._connection = connection;
          connection.once('close', function () {
            _this2._clearTimeout();
            delete _this2._connection;
            delete _this2._channel;
          });
          return connection.createChannel();
        }).then(function (channel) {
          channel.once('close', function () {
            _this2._logger.debug('channel closed');
          });
          _this2._logger.debug('channel open');
          _this2._logger.info('returning channel');
          _this2._channel = channel;
          return channel;
        });
      }
    }
  }]);

  return RabbitConnectorBase;
})();

exports['default'] = RabbitConnectorBase;
module.exports = exports['default'];
//# sourceMappingURL=rabbit_connector_base.js.map