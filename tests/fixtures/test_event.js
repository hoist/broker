'use strict';
var BaseEvent = require('../../lib/event_types/base_event');
var util = require('util');
function TestEvent(properties){
  BaseEvent.call(this,properties);
}
util.inherits(TestEvent, BaseEvent);


TestEvent.QueueName = 'TestEventQueue';

module.exports = TestEvent;


