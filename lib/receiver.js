'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.Receiver = undefined;

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _config = require('config');

var _config2 = _interopRequireDefault(_config);

var _logger = require('@hoist/logger');

var _logger2 = _interopRequireDefault(_logger);

var _bluebird = require('bluebird');

var _bluebird2 = _interopRequireDefault(_bluebird);

var _awsSdk = require('aws-sdk');

var _awsSdk2 = _interopRequireDefault(_awsSdk);

var _model = require('@hoist/model');

var _lodash = require('lodash');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

/**
 * Receiver takes messages from RabbitMQ and rehydrates them into events
 */

var Receiver = exports.Receiver = function () {
  /**
   * Create a new receiver
   */

  function Receiver() {
    _classCallCheck(this, Receiver);

    var configOverrides = void 0;
    if (_config2.default.has('Hoist.aws.region')) {
      if (!configOverrides) {
        configOverrides = {};
      }
      configOverrides.region = _config2.default.get('Hoist.aws.region');
    }
    if (_config2.default.has('Hoist.aws.account')) {
      if (!configOverrides) {
        configOverrides = {};
      }
      configOverrides.accessKeyId = _config2.default.get('Hoist.aws.account');
    }
    if (_config2.default.has('Hoist.aws.secret')) {
      if (!configOverrides) {
        configOverrides = {};
      }
      configOverrides.secretAccessKey = _config2.default.get('Hoist.aws.secret');
    }
    if (configOverrides) {
      _awsSdk2.default.config.update(configOverrides);
    }
    var bucketPrefix = '';
    if (_config2.default.has('Hoist.aws.prefix.bucket')) {
      bucketPrefix = _config2.default.get('Hoist.aws.prefix.bucket');
    }
    this._payloadBucketName = bucketPrefix + 'event-payload';
    this._logger = _logger2.default.child({
      cls: this.constructor.name
    });
    this._s3Client = this._s3Client || _bluebird2.default.promisifyAll(new _awsSdk2.default.S3());
  }

  _createClass(Receiver, [{
    key: '_populatePayloadFromS3',
    value: function _populatePayloadFromS3(message) {
      var m = (0, _lodash.clone)(message);
      if (!m.payload) {
        m.payload = {};
        return Promise.resolve(m);
      }

      return this._getPayloadFromId(message.applicationId, message.payload).then(function (payload) {
        delete m.payload;
        m.payload = payload;
        return m;
      }).catch(function () {
        return message;
      });
    }
  }, {
    key: '_getPayloadFromId',
    value: function _getPayloadFromId(applicationId, payloadId) {
      if (!payloadId) {
        return Promise.resolve({});
      }
      return this._s3Client.getObjectAsync({
        Bucket: this._payloadBucketName,
        Key: applicationId + '/' + payloadId
      }).then(function (response) {
        var payload = JSON.parse(response.Body.toString());
        return payload;
      }).catch(function () {
        return null;
      });
    }

    /**
     * reconstiute an {@link Event} from a RabbitMQ message
     * @param {Object} message - the raw rabbitmq message
     * @returns {Promise<Event>} - the reconstituted event
     */

  }, {
    key: 'restore',
    value: function restore(message) {
      return this._populatePayloadFromS3(message).then(function (messageWithPayload) {
        return new _model.Event(messageWithPayload);
      });
    }
  }, {
    key: 'subscribe',
    value: function subscribe(event, eventName) {
      var _this = this;

      var applicationId = event.applicationId;
      var eventQueue = applicationId + '_events';
      return this._openChannel().then(function (channel) {
        return Promise.all([channel.assertQueue(eventQueue, {
          durable: true,
          maxPriority: 10
        }), channel.assertExchange('hoist', 'topic')]).then(function () {
          return channel.bindQueue(eventQueue, 'hoist', 'event.' + applicationId + '.#');
        }).then(function () {
          return new Promise(function (resolve) {
            channel.on(eventName, resolve);
          });
        }).then(function (result) {
          _this._logger.info({
            result: result,
            routingKey: 'event.' + applicationId + '.' + event.eventName + '.' + event.correlationId
          }, 'publsh result');
          _this._logger.info('closing channel');
          return channel.close().then(function () {
            return result;
          });
        }).catch(function (err) {
          _this._logger.error(err);
          _this._logger.info('closing channel');
          return channel.close().then(function () {
            throw err;
          });
        });
      }).then(function (result) {
        _this._logger.info('sending log event');
        return result;
      });
    }
  }]);

  return Receiver;
}();

exports.default = Receiver;
//# sourceMappingURL=receiver.js.map
