import { assert } from 'chai';
import { encode, decode } from '../../../src/confighash/config-hash';

describe('ConfigHash', () => {
  const expectedDefinition = {
    url: 'http://sitea.com/index.html',
    scenario: 'static-content',
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

  const expectedConfigHash = 'eLt7R4n7Q041wERTDHRVIjjlZOalpFZQnHxIi8fojKLUNBVbdbC16rFKIA+gKsnMTQc5GyO9EJNMY4EaAYNFVQE=';

  it('encode', () => {
    const encodedDefinition = encode(expectedDefinition);
    assert.deepEqual(encodedDefinition, expectedConfigHash);
  });

  it('decode', () => {
    const decodedDefinition = decode(expectedConfigHash);
    assert.deepEqual(decodedDefinition, expectedDefinition);
  });
});
