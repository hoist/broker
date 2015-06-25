'use strict';
var gulp = require('gulp');
var requireDir = require('require-dir');
require('git-guppy')(gulp);

requireDir('./gulp/tasks', {
  recurse: true
});
gulp.task('test', ['eslint-build', 'mocha-server']);
gulp.task('default', function () {
  return gulp.start('eslint-build',
    'mocha-server',
    function (cb) {
      cb(global.error);
    });
});

gulp.task('post-commit', ['test', 'esdoc']);

gulp.task('pre-commit', function () {

});
