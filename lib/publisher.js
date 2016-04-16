'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.Publisher = undefined;

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _config = require('config');

var _config2 = _interopRequireDefault(_config);

var _uuid = require('uuid');

var _uuid2 = _interopRequireDefault(_uuid);

var _awsSdk = require('aws-sdk');

var _awsSdk2 = _interopRequireDefault(_awsSdk);

var _application_event_logger = require('./application_event_logger');

var _bluebird = require('bluebird');

var _bluebird2 = _interopRequireDefault(_bluebird);

var _model = require('@hoist/model');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

/**
 * Takes {@link Event} objects and publishes them to the bus.
 * also saves the paylod to S3
 * @extends {ApplicationEventLogger}
 */

var Publisher = exports.Publisher = function (_ApplicationEventLogg) {
  _inherits(Publisher, _ApplicationEventLogg);

  /**
   * Create a new Publisher
   */

  function Publisher() {
    _classCallCheck(this, Publisher);

    var _this = _possibleConstructorReturn(this, Object.getPrototypeOf(Publisher).call(this));

    var bucketPrefix = '';
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
    if (_config2.default.has('Hoist.aws.prefix.bucket')) {
      bucketPrefix = _config2.default.get('Hoist.aws.prefix.bucket');
    }
    _this._payloadBucketName = bucketPrefix + 'event-payload';
    _this._s3Client = _this._s3Client || _bluebird2.default.promisifyAll(new _awsSdk2.default.S3());
    return _this;
  }

  _createClass(Publisher, [{
    key: '_ensureS3Setup',
    value: function _ensureS3Setup() {
      var _this2 = this;

      if (this._s3setup) {
        return this._s3setup;
      } else {

        this._s3setup = this._s3Client.headBucketAsync({
          Bucket: this._payloadBucketName
        }).catch(function (err) {
          _this2._logger.error(err);
          _this2._logger.info({
            bucketName: _this2._payloadBucketName
          }, 'creating bucket');

          return _this2._s3Client.createBucketAsync({
            Bucket: _this2._payloadBucketName,
            ACL: 'private'
          });
        });

        return this._s3setup;
      }
    }
  }, {
    key: '_savePayloadToS3',
    value: function _savePayloadToS3(event) {
      var _this3 = this;

      return Promise.resolve(_uuid2.default.v4()).then(function (payloadId) {
        _this3._logger.info({
          bucketName: _this3._payloadBucketName
        }, 'looking up bucket');
        if (!event.payload) {
          return Promise.resolve(null);
        }
        var payload = JSON.stringify(event.payload);
        return _this3._ensureS3Setup().then(function () {
          _this3._logger.info({
            bucketName: _this3._payloadBucketName
          }, 'uploading payload');
          return _this3._s3Client.uploadAsync({
            Bucket: _this3._payloadBucketName,
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
      var _this4 = this;

      var applicationId = event.applicationId;
      var eventQueue = applicationId + '_events';
      return this._openChannel().then(function (channel) {
        return Promise.all([channel.assertQueue(eventQueue, {
          durable: true,
          maxPriority: 10
        }), channel.assertExchange('hoist', 'topic')]).then(function () {
          return channel.bindQueue(eventQueue, 'hoist', 'event.' + applicationId + '.#');
        }).then(function () {
          return _this4._shallowEvent(event);
        }).then(function (shallowEvent) {
          var drained = new Promise(function (resolve) {
            channel.on('drain', resolve);
          });
          var result = channel.publish('hoist', 'event.' + applicationId + '.' + event.eventName + '.' + event.correlationId, new Buffer(shallowEvent), {
            mandatory: true,
            persistent: true,
            priority: event.priority || 3,
            appId: '' + _config2.default.get('Hoist.application.name'),
            messageId: event._id.toString(),
            correlationId: event.correlationId,
            type: 'Hoist Event'
          });
          _this4._logger.info({
            result: result,
            routingKey: 'event.' + applicationId + '.' + event.eventName + '.' + event.correlationId
          }, 'publsh result');
          return result || drained;
        }).then(function () {
          _this4._logger.info('closing channel');
          return channel.close();
        }).catch(function (err) {
          _this4._logger.error(err);
          _this4._logger.info('closing channel');
          return channel.close().then(function () {
            throw err;
          });
        });
      }).then(function () {
        _this4._logger.info('sending log event');
        _this4.log(new _model.ExecutionLogEvent({
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
}(_application_event_logger.ApplicationEventLogger);

exports.default = Publisher;
//# sourceMappingURL=publisher.js.map
