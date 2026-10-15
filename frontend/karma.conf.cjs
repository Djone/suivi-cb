module.exports = config => config.set({
  basePath: '',
  hostname: '127.0.0.1',
  listenAddress: '127.0.0.1',
  frameworks: ['jasmine'],
  plugins: [
    require('karma-jasmine'),
    require('karma-chrome-launcher'),
    require('karma-coverage'),
  ],
  reporters: ['progress'],
  browsers: ['Chrome'],
  coverageReporter: {
    dir: require('node:path').join(__dirname, 'coverage/frontend'),
    subdir: '.',
    reporters: [{ type: 'html' }, { type: 'text-summary' }],
  },
  restartOnFileChange: true,
});
