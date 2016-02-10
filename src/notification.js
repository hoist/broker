'use strict';
import Moment from 'moment';

export class Notification {
  constructor(properties) {
    this.applicationId = properties.applicationId;
    this.notificationType = Notification.Types[properties.notificationType];
    this.dateTime = new Moment().utc();
  }
}
Notification.Types = {
  Update: 'UPDATE'
};
export default Notification;
