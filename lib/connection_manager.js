'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.connectionManager = exports.ConnectionManager = undefined;

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _config = require('config');

var _config2 = _interopRequireDefault(_config);

var _amqplib = require('amqplib');

var _amqplib2 = _interopRequireDefault(_amqplib);

var _logger = require('@hoist/logger');

var _logger2 = _interopRequireDefault(_logger);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var ConnectionManager = exports.ConnectionManager = function () {
  function ConnectionManager() {
    _classCallCheck(this, ConnectionManager);

    this._logger = _logger2.default.child({
      cls: this.constructor.name
    });
  }

  _createClass(ConnectionManager, [{
    key: '_getConnection',
    value: function _getConnection() {
      var _this = this;

      if (this._connection) {
        return Promise.resolve(this._connection);
      } else {
        return Promise.resolve(_amqplib2.default.connect(_config2.default.get('Hoist.rabbit.url'), {
          heartbeat: _config2.default.get('Hoist.publisher.heartbeat')
        })).then(function (connection) {
          _this._logger.debug('connection open');
          _this._connection = connection;
          connection.on('close', function () {
            _this._logger.error('connection closed');
            delete _this._connection;
          });
          connection.on('error', function (err) {
            _this._logger.error(err, 'connection threw error');
          });
          return _this._connection;
        });
      }
    }
  }, {
    key: '_closeConnection',
    value: function _closeConnection() {
      if (this._connection) {
        return this._connection.close();
      }
    }
  }]);

  return ConnectionManager;
}();

var connectionManager = exports.connectionManager = new ConnectionManager();
//# sourceMappingURL=connection_manager.js.map
