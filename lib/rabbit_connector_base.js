'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.RabbitConnectorBase = undefined;

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _logger = require('@hoist/logger');

var _logger2 = _interopRequireDefault(_logger);

var _connection_manager = require('./connection_manager');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

/**
 * Base class for managing publising events to rabbit mq
 * manages connection lifecycle etc
 */

var RabbitConnectorBase = exports.RabbitConnectorBase = function () {

  /**
   * instantiate a new instance
   * @abstract
   */

  function RabbitConnectorBase() {
    _classCallCheck(this, RabbitConnectorBase);

    this._logger = _logger2.default.child({
      cls: this.constructor.name
    });
  }

  /**
   * open up a new channel to rabbit or reuse an existing one
   * @protected
   * @returns {Promise}
   */


  _createClass(RabbitConnectorBase, [{
    key: '_openChannel',
    value: function _openChannel() {
      var _this = this;

      this._logger.debug('creating new channel');
      return _connection_manager.connectionManager._getConnection().then(function (connection) {
        _this._logger.info('got a connection, creating channel');
        return connection.createChannel();
      }).then(function (channel) {
        _this._logger.debug('channel open');
        _this._logger.info('returning channel');
        return channel;
      });
    }
  }]);

  return RabbitConnectorBase;
}();

exports.default = RabbitConnectorBase;
//# sourceMappingURL=rabbit_connector_base.js.map
