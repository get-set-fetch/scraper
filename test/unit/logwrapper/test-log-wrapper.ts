import { assert } from 'chai';
import { getLogger, setLogger } from '../../../src/logger/Logger';

describe('LogWrapper', () => {
  it('default log level', () => {
    const childWrapper = getLogger('test');
    assert.strictEqual(childWrapper.logger.level, 'warn');
  });

  it('changes to parent logger propagate to existing child loggers', () => {
    const childWrapper = getLogger('test');

    setLogger({ level: 'info' });
    assert.strictEqual(childWrapper.logger.level, 'info');

    // revert back to default log level
    setLogger({ level: 'warn' });
  });

  it('filter out log arguments', () => {
    const childWrapper = getLogger('test');

    const rawObj = [
      { a: 1, b: Buffer.from('a'), c: null, d: new Uint8Array([ 0, 1, 2 ]) },
      { d: 'message C', e: Buffer.from('a'), cert: {}, f: null },
    ];

    // extra circular reference :)
    rawObj[1].f = rawObj;

    assert.sameDeepMembers(
      childWrapper.filterArg(rawObj),
      [
        {
          a: 1,
          b: '<Buffer> not included',
          c: null,
          d: '<ArrayBuffer|DataView> not included',
        },
        {
          d: 'message C',
          e: '<Buffer> not included',
          cert: '<cert> not included',
          f: null,
        },
      ],
    );
  });

  it('filter out ignore error', () => {
    const childWrapper = getLogger('test');

    const err = new Error('unexpected error');
    const filteredErr = childWrapper.filterArg(err);

    assert.strictEqual(filteredErr.name, err.name);
    assert.strictEqual(filteredErr.message, err.message);
    assert.strictEqual(filteredErr.stack, err.stack);
  });
});
