'use strict';
var chai = require('chai');
var _ = require('lodash');
chai.should();
chai.use(require('sinon-chai'));
chai.use(require('chai-as-promised'));
process.env.NODE_ENV = 'test';

var dbUri = 'mongodb://localhost/hoist-model-test';
var mongoose = require('hoist-model')._mongoose;
var BBPromise = require('bluebird');
//BBPromise.longStackTraces();
BBPromise.promisifyAll(mongoose.connection);

before(function (done) {
  if (mongoose.connection.db) {
    return done();
  }
  mongoose.connect(dbUri, done);
});
after(function (done) {
  var collections = _.keys(mongoose.connection.collections);
  BBPromise.all(_.map(collections, function (collectionName) {
    var collection = mongoose.connection.collections[collectionName];
    var dropCollection = BBPromise.promisify(collection.drop, collection);
    return dropCollection().catch(function(){
      console.log('caught an error dropping collection');
    });
  })).then(function () {
    return mongoose.connection.closeAsync();
  }).then(function () {
    delete mongoose.connection.db;
    done();
  }).done();
});
