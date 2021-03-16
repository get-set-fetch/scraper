import { assert } from 'chai';
import { encode, decode } from '../../../src/confighash/config-hash';

describe('ConfigHash', () => {
  const expectedDefinition = {
    url: 'http://sitea.com/index.html',
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
  };

  const expectedConfigHash = 'ePm8oZWZQ045wIRTDDQ5EZx6MvNSUiuITkKE0gtpURWdUZSapmKrDrZePVYJ5BFUJZm56SDn65CTLmOBGgF4cVg0';

  it('encode', () => {
    const encodedDefinition = encode(expectedDefinition);
    assert.deepEqual(encodedDefinition, expectedConfigHash);
  });

  it('decode', () => {
    const decodedDefinition = decode(expectedConfigHash);
    assert.deepEqual(decodedDefinition, expectedDefinition);
  });
});
