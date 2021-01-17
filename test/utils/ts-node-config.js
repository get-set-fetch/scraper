require('ts-node').register({
  project: 'test/tsconfig.test.json',
  files: true,
  pretty: true,
  'no-cache': true,
  ignore: [ /node_modules\/(?!@get-set-fetch\/test-utils)/ ],
});
