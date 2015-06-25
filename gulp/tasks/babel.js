'use strict';
var gulp = require('gulp');
var loadPlugins = require('gulp-load-plugins');

var plugins = loadPlugins();

gulp.task('transpile', ['clean-compiled'], function () {
  return gulp.src('src/**/*.js')
    .pipe(plugins.sourcemaps.init())
    .pipe(plugins.babel())
    .pipe(plugins.sourcemaps.write('.'))
    .pipe(gulp.dest('lib'));
});
