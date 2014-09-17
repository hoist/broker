'use strict';
var chai = require('chai');
var _ = require('lodash');
chai.use(require('sinon-chai'));

process.env.NODE_ENV = 'test';

var dbUri = 'mongodb://localhost/hoist-model-test';
var mongoose = require('hoist-model')._mongoose;
var q = require('q');
q.longStackSupport = true;
before(function (done) {
  if (mongoose.connection.db) {
    return done();
  }
  mongoose.connect(dbUri, done);
});
after(function (done) {


  var collections = _.keys(mongoose.connection.collections);
  q.all(_.map(collections, function (collectionName) {
    var collection = mongoose.connection.collections[collectionName];
    return q.ninvoke(collection, 'drop');
  })).then(function () {
    return q.ninvoke(mongoose.connection, 'close');
  }).then(function () {
    done();
  }).done();
});
