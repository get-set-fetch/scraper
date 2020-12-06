module.exports = {
  diff: true,
  recursive: true,
  extension: ['ts'],
  package: './package.json',
  reporter: 'spec',
  timeout: 55000,
  file: ['./test/utils/ts-node-config.js', './test/utils/shims.js']
};