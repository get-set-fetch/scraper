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
});
