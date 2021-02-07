import { assert } from 'chai';
import { encode, decode } from '../../../src/confighash/config-hash';

describe('ConfigHash', () => {
  const expectedDefinition = {
    url: 'http://sitea.com/index.html',
    scenario: 'browser-static-content',
    pluginOpts: [
      {
        name: 'ExtractUrlsPlugin',
        selectorPairs: [
          {
            urlSelector: "a[href$='.html']",
          },
          {
            urlSelector: 'img',
          },
        ],
      },
      {
        name: 'ExtractHtmlContentPlugin',
        selectorPairs: [
        ],
      },
    ],
  };

  const expectedConfigHash = 'eLsG8L15Q051wERXDHRVIjjlZealpFYQnfwIpTXSojk6oyg1TcVWHWy9eqwSyCOoSjJz00HOx0hOxKTpWKBGAHanWDI=';

  it('encode', () => {
    const encodedDefinition = encode(expectedDefinition);
    assert.deepEqual(encodedDefinition, expectedConfigHash);
  });

  it('decode', () => {
    const decodedDefinition = decode(expectedConfigHash);
    assert.deepEqual(decodedDefinition, expectedDefinition);
  });
});
