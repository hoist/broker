'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.Notification = undefined;

var _moment = require('moment');

var _moment2 = _interopRequireDefault(_moment);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var Notification = exports.Notification = function Notification(properties) {
  _classCallCheck(this, Notification);

  this.applicationId = properties.applicationId;
  this.notificationType = Notification.Types[properties.notificationType];
  this.dateTime = new _moment2.default().utc();
};

Notification.Types = {
  Update: 'UPDATE'
};
exports.default = Notification;
//# sourceMappingURL=notification.js.map
