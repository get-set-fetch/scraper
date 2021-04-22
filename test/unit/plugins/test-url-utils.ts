import { assert } from 'chai';
import { getUrlColIdx, normalizeUrl } from '../../../src/plugins/url-utils';

describe('URL Utils', () => {
  it('normalizeUrl', async () => {
    assert.strictEqual(normalizeUrl('http://wWw.CaPs.com'), 'http://www.caps.com/');
    assert.strictEqual(normalizeUrl('no-proTocoL.com'), 'https://no-protocol.com/');
    assert.strictEqual(normalizeUrl('WWw.no-proTocoL.com'), 'https://www.no-protocol.com/');
  });

  it('getUrlColIdx', async () => {
    assert.strictEqual(getUrlColIdx('1,http://sitea.com'), 1);
    assert.strictEqual(getUrlColIdx('1, 2, www.sitea.com'), 2);
    assert.strictEqual(getUrlColIdx('sitea.com'), 0);
  });
});
