import { assert } from 'chai';
import { encode, decode } from '../../../src/confighash/config-hash';

describe('ConfigHash', () => {
  const expectedDefinition = {
    name: 'projectA',
    pipeline: 'browser-static-content',
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
    resources: [
      {
        url: 'http://sitea.com/index.html',
      },
    ],
  };

  const expectedConfigHash = 'ePnXQdMJgxtWUJSfBYwER2JSJ6GkSFoqiM4oSk1TsVUHO0o9VgnkQ1QlmbnpIMfqkJPkY/EFCDA8ioHBnggOlMy8lNQKeMgAAOKgZAQ=';

  it('encode', () => {
    const encodedDefinition = encode(expectedDefinition);
    assert.deepEqual(encodedDefinition, expectedConfigHash);
  });

  it('decode', () => {
    const decodedDefinition = decode(expectedConfigHash);
    assert.deepEqual(decodedDefinition, expectedDefinition);
  });
});
