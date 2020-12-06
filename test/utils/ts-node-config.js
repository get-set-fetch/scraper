require('ts-node').register({
  project: 'test/tsconfig.test.json',
  files: true,
  pretty: true,
  'no-cache': true,
});

console.log('done register ts-node');
