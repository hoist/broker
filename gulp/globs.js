var root = process.cwd();
module.exports = {
  js: {
    lib: [root + '/src/**/*.js'],
    gulpfile: ['Gulpfile.js'],
    specs: ['tests/**/*.js', '!tests/fixtures/**/*']
  },
  specs: ['tests/**/*.js', '!tests/fixtures/**/*']
};
