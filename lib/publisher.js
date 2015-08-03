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

var _uuid = require('uuid');

var _uuid2 = _interopRequireDefault(_uuid);

var _awsSdk = require('aws-sdk');

var _awsSdk2 = _interopRequireDefault(_awsSdk);

var _application_event_logger = require('./application_event_logger');

var _application_event_logger2 = _interopRequireDefault(_application_event_logger);

var _bluebird = require('bluebird');

var _bluebird2 = _interopRequireDefault(_bluebird);

var _hoistModel = require('@hoist/model');

/**
 * Takes {@link Event} objects and publishes them to the bus.
 * also saves the paylod to S3
 * @extends {ApplicationEventLogger}
 */

var Publisher = (function (_ApplicationEventLogger) {
  _inherits(Publisher, _ApplicationEventLogger);

  /**
   * Create a new Publisher
   */

  function Publisher() {
    _classCallCheck(this, Publisher);

    _get(Object.getPrototypeOf(Publisher.prototype), 'constructor', this).call(this);
    var bucketPrefix = '';
    var configOverrides = undefined;
    if (_config2['default'].has('Hoist.aws.region')) {
      if (!configOverrides) {
        configOverrides = {};
      }
      configOverrides.region = _config2['default'].get('Hoist.aws.region');
    }
    if (_config2['default'].has('Hoist.aws.account')) {
      if (!configOverrides) {
        configOverrides = {};
      }
      configOverrides.accessKeyId = _config2['default'].get('Hoist.aws.account');
    }
    if (_config2['default'].has('Hoist.aws.secret')) {
      if (!configOverrides) {
        configOverrides = {};
      }
      configOverrides.secretAccessKey = _config2['default'].get('Hoist.aws.secret');
    }
    if (configOverrides) {
      _awsSdk2['default'].config.update(configOverrides);
    }
    if (_config2['default'].has('Hoist.aws.prefix.bucket')) {
      bucketPrefix = _config2['default'].get('Hoist.aws.prefix.bucket');
    }
    this._payloadBucketName = bucketPrefix + 'event-payload';
    this._s3Client = this._s3Client || _bluebird2['default'].promisifyAll(new _awsSdk2['default'].S3());
  }

  _createClass(Publisher, [{
    key: '_savePayloadToS3',
    value: function _savePayloadToS3(event) {
      var _this = this;

      return Promise.resolve(_uuid2['default'].v4()).then(function (payloadId) {
        _this._logger.info({
          bucketName: _this._payloadBucketName
        }, 'looking up bucket');
        if (!event.payload) {
          return Promise.resolve(null);
        }
        var payload = JSON.stringify(event.payload);
        return _this._s3Client.headBucketAsync({
          Bucket: _this._payloadBucketName
        })['catch'](function (err) {
          _this._logger.error(err);
          _this._logger.info({
            bucketName: _this._payloadBucketName
          }, 'creating bucket');
          return _this._s3Client.createBucketAsync({
            Bucket: _this._payloadBucketName,
            ACL: 'private'
          });
        }).then(function () {
          _this._logger.info({
            bucketName: _this._payloadBucketName
          }, 'uploading payload');
          return _this._s3Client.uploadAsync({
            Bucket: _this._payloadBucketName,
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
      var _this2 = this;

      var applicationId = event.applicationId;
      var eventQueue = applicationId + '_events';
      return this._openChannel().then(function (channel) {
        return Promise.all([channel.assertQueue(eventQueue, {
          durable: true
        }), channel.assertExchange('hoist', 'topic')]).then(function () {
          return channel.bindQueue(eventQueue, 'hoist', 'event.' + applicationId + '.#');
        }).then(function () {
          return _this2._shallowEvent(event);
        }).then(function (shallowEvent) {
          var drained = new Promise(function (resolve) {
            channel.on('drain', resolve);
          });
          var result = channel.publish('hoist', 'event.' + applicationId + '.' + event.eventName + '.' + event.correlationId, new Buffer(shallowEvent), {
            mandatory: true,
            persistent: true,
            priority: 3,
            appId: '' + _config2['default'].get('Hoist.application.name'),
            messageId: event._id.toString(),
            correlationId: event.correlationId,
            type: 'Hoist Event'
          });
          _this2._logger.info({
            result: result,
            routingKey: 'event.' + applicationId + '.' + event.eventName + '.' + event.correlationId
          }, 'publsh result');
          return result || drained;
        }).then(function () {
          _this2._logger.info('closing connection');
          var connection = channel.connection;
          return channel.close().then(function () {
            return connection.close();
          });
        })['catch'](function (err) {
          _this2._logger.error(err);
          _this2._logger.info('closing connection');
          var connection = channel.connection;
          return channel.close().then(function () {
            console.log(connection.close);
            return (connection.close() || Promise.resolve()).then(function () {
              throw err;
            });
          });
        });
      }).then(function () {
        _this2._logger.info('sending log event');
        _this2.log(new _hoistModel.ExecutionLogEvent({
          application: applicationId,
          environment: 'live',
          eventId: event.eventId,
          correlationId: event.correlationId,
          moduleName: event.eventName,
          type: 'EVT',
          message: 'event ' + event.eventName + ' raised (id: ' + event.eventId + ')'
        }));
      });
    }
  }]);

  return Publisher;
})(_application_event_logger2['default']);

exports['default'] = Publisher;
module.exports = exports['default'];
//# sourceMappingURL=publisher.js.map