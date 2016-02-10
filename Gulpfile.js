'use strict';
var gulp = require('gulp');
var requireDir = require('require-dir');
require('git-guppy')(gulp);
var helpers = require('./gulp/helpers');
var runSequence = require('run-sequence');
requireDir('./gulp/tasks', {
  recurse: true
});
gulp.task('test', (cb) => {
  return runSequence('transpile', ['eslint-build', 'mocha-server'], () => {
    cb(helpers.getError());
  });
});
gulp.task('default', ['clean'], function () {
  return runSequence('build', 'eslint-build');
});

gulp.task('post-commit', ['test', 'esdoc']);

gulp.task('pre-commit', ['clean'], function () {
  return gulp.start('build');
});
gulp.task('build', ['transpile']);
