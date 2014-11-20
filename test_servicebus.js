'use strict';
var BBPromise = require('bluebird');
var azure = require('azure');
var _ = require('lodash');

var serviceBus = BBPromise.promisifyAll(azure.createServiceBusService('Endpoint=sb://hoist-test.servicebus.windows.net/;SharedAccessKeyName=Hoist-Tests;SharedAccessKey=Ao7kCKCY6HR/t7mm912LtVbJbpjbrYc+LC2W7bTtrxw='));

serviceBus.createQueueIfNotExistsAsync('test.load.queue')
  .catch(function (err) {
    console.log('error creating queue', err);
  })
  .then(function () {
    return BBPromise.all(
      _.map(_.range(10000), function (number) {
        console.log('sending message', number);
        return serviceBus.sendQueueMessageAsync('test.load.queue', {
            body: 'numer ' + number
          })
          .then(function () {
            console.log('sent message', number);
          })
          .catch(function (err) {
            console.log('error sending message', number, err);
          });
      }));
  }).then(function () {
    console.log('done');
  });
