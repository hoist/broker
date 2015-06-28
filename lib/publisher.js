'use strict';
Object.defineProperty(exports, '__esModule', {
  value: true
});

var _createClass = (function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ('value' in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; })();

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError('Cannot call a class as a function'); } }

var _config = require('config');

var _config2 = _interopRequireDefault(_config);

var _hoistLogger = require('@hoist/logger');

var _hoistLogger2 = _interopRequireDefault(_hoistLogger);

var _amqplib = require('amqplib');

var _amqplib2 = _interopRequireDefault(_amqplib);

var _uuid = require('uuid');

var _uuid2 = _interopRequireDefault(_uuid);

var _awsSdk = require('aws-sdk');

var _awsSdk2 = _interopRequireDefault(_awsSdk);

var _bluebird = require('bluebird');

var _bluebird2 = _interopRequireDefault(_bluebird);

if (_config2['default'].has('Hoist.aws.region')) {
  _awsSdk2['default'].config.update({
    region: _config2['default'].get('Hoist.aws.region')
  });
}

/**
 * Takes {@link Event} objects and publishes them to the bus.
 * also saves the paylod to S3
 */

var Publisher = (function () {

  /**
   * Create a new Publisher
   */

  function Publisher() {
    _classCallCheck(this, Publisher);

    var bucketPrefix = '';
    if (_config2['default'].has('Hoist.aws.prefix.bucket')) {
      bucketPrefix = _config2['default'].get('Hoist.aws.prefix.bucket');
    }
    this._payloadBucketName = bucketPrefix + 'event-payload';
    this._logger = _hoistLogger2['default'].child({
      cls: this.constructor.name
    });
    this._s3Client = this._s3Client || _bluebird2['default'].promisifyAll(new _awsSdk2['default'].S3());
  }

  _createClass(Publisher, [{
    key: '_openChannel',
    value: function _openChannel() {
      var _this = this;

      if (this._idleTimeout) {
        clearTimeout(this._idleTimeout);
        delete this._idleTimeout;
      }
      if (this._channel) {
        this._logger.debug('reusing existing channel');
        return Promise.resolve(this._channel);
      } else {
        this._logger.debug('creating new channel');
        return Promise.resolve(_amqplib2['default'].connect(_config2['default'].get('Hoist.rabbit.url'), {
          heartbeat: _config2['default'].get('Hoist.publisher.heartbeat')
        })).then(function (connection) {
          _this._logger.debug('connection open');
          _this._logger.info('got a connection, creating channel');
          _this._connection = connection;
          connection.once('close', function () {
            if (_this._idleTimeout) {
              clearTimeout(_this._idleTimeout);
              delete _this._idelTimeout;
            }
            delete _this._connection;
            delete _this._channel;
          });
          return connection.createChannel();
        }).then(function (channel) {
          channel.once('close', function () {
            _this._logger.debug('channel closed');
          });
          _this._logger.debug('channel open');
          _this._logger.info('returning channel');
          _this._channel = channel;
          return channel;
        });
      }
    }
  }, {
    key: '_savePayloadToS3',
    value: function _savePayloadToS3(event) {
      var _this2 = this;

      return Promise.resolve(_uuid2['default'].v4()).then(function (payloadId) {
        var payload = JSON.stringify(event.payload);
        return _this2._s3Client.headBucketAsync({
          Bucket: _this2._payloadBucketName
        })['catch'](function () {
          return _this2._s3Client.createBucketAsync({
            Bucket: _this2._payloadBucketName,
            ACL: 'private'
          });
        }).then(function () {
          return _this2._s3Client.uploadAsync({
            Bucket: _this2._payloadBucketName,
            Key: event.applicationId + '/' + payloadId,
            Body: payload,
            ServerSideEncryption: 'AES256'
          });
        }).then(function () {
          return payloadId;
        });
      });
    }
  }, {
    key: '_shallowEvent',
    value: function _shallowEvent(event) {
      return this._savePayloadToS3(event).then(function (payloadId) {
        var jsonObject = event.toJSON();
        jsonObject.payload = payloadId;
        return JSON.stringify(jsonObject);
      });
    }
  }, {
    key: 'publish',

    /**
     * publish the event to RabbitMQ and save the paylod to S3
     * @param {Event} event - the event to publish
     * @returns {Promise<Event>} - Promise resolves once the event is published to the bus
     */
    value: function publish(event) {
      var _this3 = this;

      var applicationId = event.applicationId;
      var eventQueue = applicationId + '_events';
      return this._openChannel().then(function (channel) {
        return Promise.all([channel.assertQueue(eventQueue, {
          durable: true
        }), channel.assertExchange('hoist', 'topic')]).then(function () {
          return channel.bindQueue(eventQueue, 'hoist', 'event.' + applicationId + '.#');
        }).then(function () {
          return _this3._shallowEvent(event);
        }).then(function (shallowEvent) {
          return channel.publish('hoist', 'event.' + applicationId + '.' + event.eventName, new Buffer(shallowEvent), {
            mandatory: true,
            persistent: true,
            priority: 3,
            appId: '' + _config2['default'].get('Hoist.application.name'),
            messageId: event._id.toString(),
            correlationId: event.correlationId,
            type: 'Hoist Event'
          });
        });
      }).then(function () {
        if (_this3._idleTimeout) {
          clearTimeout(_this3._idleTimeout);
          delete _this3._idleTimeout;
        }
        _this3._idleTimeout = setTimeout(function () {
          if (_this3._connection) {
            _this3._connection.close();
          }
        }, _config2['default'].get('Hoist.publisher.timeout'));
      })['catch'](function (err) {
        console.log('in catch');
        if (_this3._idleTimeout) {
          clearTimeout(_this3._idleTimeout);
          delete _this3._idleTimeout;
        }
        _this3._idleTimeout = setTimeout(function () {
          if (_this3._connection) {
            _this3._connection.close();
          }
        }, _config2['default'].get('Hoist.publisher.timeout'));
        throw err;
      });
    }
  }]);

  return Publisher;
})();

exports['default'] = Publisher;
module.exports = exports['default'];
//# sourceMappingURL=publisher.js.map