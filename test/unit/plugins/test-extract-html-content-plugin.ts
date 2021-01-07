import { assert } from 'chai';
import { createSandbox } from 'sinon';
import ExtractHtmlContentPlugin from '../../../src/plugins/default/ExtractHtmlContentPlugin';

describe('ExtractHtmlContentPlugin', () => {
  let sandbox;
  let stubQuerySelectorAll;
  let plugin: ExtractHtmlContentPlugin;

  beforeEach(() => {
    sandbox = createSandbox();
    stubQuerySelectorAll = sandbox.stub(document, 'querySelectorAll');
  });

  afterEach(() => {
    sandbox.restore();
  });

  it('extract html content, single selector', () => {
    plugin = new ExtractHtmlContentPlugin({ selectorPairs: [ { contentSelector: 'h1' } ] });

    stubQuerySelectorAll.withArgs('h1').returns([
      { innerText: 'h1 valA' },
      { innerText: 'h1 valB' },
    ]);

    const expectedContent = [
      [ 'h1 valA' ],
      [ 'h1 valB' ],
    ];

    const { content } = plugin.apply();
    assert.deepEqual(content, expectedContent);
  });

  it('extract html content. missing values', () => {
    plugin = new ExtractHtmlContentPlugin({ selectorPairs: [ { contentSelector: 'h1' }, { contentSelector: 'h2' } ] });

    stubQuerySelectorAll.withArgs('h1').returns([
      { innerText: 'h1 valA' },
      { innerText: 'h1 valB' },
    ]);

    stubQuerySelectorAll.withArgs('h2').returns([
    ]);

    const expectedContent = [
      [ 'h1 valA', '' ],
      [ 'h1 valB', '' ],
    ];

    const { content } = plugin.apply();
    assert.deepEqual(content, expectedContent);
  });

  it('extract html content - multiple selectors, duplicate values', () => {
    plugin = new ExtractHtmlContentPlugin({ selectorPairs: [ { contentSelector: 'h1' }, { contentSelector: 'h2' } ] });

    stubQuerySelectorAll.withArgs('h1').returns([
      { innerText: 'h1 valA' },
      { innerText: 'h1 valA' },
      { innerText: 'h1 valC' },
    ]);

    stubQuerySelectorAll.withArgs('h2').returns([
      { innerText: 'h2 valA' },
      { innerText: 'h2 valB' },
      { innerText: 'h2 valC' },
    ]);

    const expectedContent = [
      [ 'h1 valA', 'h2 valA' ],
      [ 'h1 valA', 'h2 valB' ],
      [ 'h1 valC', 'h2 valC' ],
    ];

    const { content } = plugin.apply();
    assert.deepEqual(content, expectedContent);
  });

  it('extract html content - multiple selectors, different result length', () => {
    plugin = new ExtractHtmlContentPlugin({ selectorPairs: [ { contentSelector: 'h1' }, { contentSelector: 'h2' }, { contentSelector: 'h3' } ] });

    stubQuerySelectorAll.withArgs('h1').returns([
      { innerText: 'h1 valA' },
      { innerText: 'h1 valB' },
    ]);

    stubQuerySelectorAll.withArgs('h2').returns([
      { innerText: 'h2 valA' },
      { innerText: 'h2 valB' },
    ]);

    stubQuerySelectorAll.withArgs('h3').returns([
    ]);

    const expectedContent = [
      [ 'h1 valA', 'h2 valA', '' ],
      [ 'h1 valB', 'h2 valB', '' ],
    ];

    const { content } = plugin.apply();
    assert.deepEqual(content, expectedContent);
  });

  it('extract html content - multiple selectors, same result length, common base', () => {
    plugin = new ExtractHtmlContentPlugin(
      { selectorPairs: [ { contentSelector: '[class|="top"] h1' }, { contentSelector: '[class|="top"] h2' }, { contentSelector: '[class|="top"] h3' } ] },
    );

    stubQuerySelectorAll.withArgs('[class|="top"]').returns([
      {
        querySelectorAll: selector => {
          switch (selector) {
            case 'h1':
              return [ { innerText: 'h1 val1' }, { innerText: 'h1 val2' } ];
            case 'h2':
              return [ { innerText: 'h2 val1' }, { innerText: 'h2 val2' } ];
            case 'h3':
              return [ { innerText: 'h3 val1' }, { innerText: 'h3 val2' } ];
            default:
              return null;
          }
        },
      },
    ]);

    const expectedContent = [
      [ 'h1 val1', 'h2 val1', 'h3 val1' ],
      [ 'h1 val2', 'h2 val2', 'h3 val2' ],
    ];

    const { content } = plugin.apply();
    assert.deepEqual(content, expectedContent);
  });

  it('extract html content - multiple selectors, different result length, common base', () => {
    plugin = new ExtractHtmlContentPlugin(
      { selectorPairs: [ { contentSelector: '[class|="top"] h1' }, { contentSelector: '[class|="top"] h2' }, { contentSelector: '[class|="top"] h3' } ] },
    );

    stubQuerySelectorAll.withArgs('[class|="top"]').returns([
      { querySelectorAll: selector => (selector === 'h3' ? [] : [ { innerText: `${selector} valA` } ]) },
      { querySelectorAll: selector => (selector === 'h2' ? [] : [ { innerText: `${selector} valB` } ]) },
      { querySelectorAll: selector => (selector === 'h1' ? [] : [ { innerText: `${selector} valC` } ]) },
    ]);

    const expectedContent = [
      [ 'h1 valA', 'h2 valA', '' ],
      [ 'h1 valB', '', 'h3 valB' ],
      [ '', 'h2 valC', 'h3 valC' ],
    ];

    const { content } = plugin.apply();
    assert.deepEqual(content, expectedContent);
  });

  it('extract html content - multiple selectors, different result length, common base, invalid rows', () => {
    plugin = new ExtractHtmlContentPlugin(
      { selectorPairs: [ { contentSelector: '[class|="top"] h1' }, { contentSelector: '[class|="top"] h2' }, { contentSelector: '[class|="top"] h3' } ] },
    );

    stubQuerySelectorAll.withArgs('[class|="top"]').returns([
      { querySelectorAll: () => [] },
      { querySelectorAll: selector => (selector === 'h2' ? [] : [ { innerText: `${selector} valB` } ]) },
      { querySelectorAll: selector => (selector === 'h1' ? [] : [ { innerText: `${selector} valC` } ]) },
    ]);

    const expectedContent = [
      [ 'h1 valB', '', 'h3 valB' ],
      [ '', 'h2 valC', 'h3 valC' ],
    ];

    const { content } = plugin.apply();
    assert.deepEqual(content, expectedContent);
  });

  it('extract html content - multiple selectors, different result length, cumulative apply', () => {
    plugin = new ExtractHtmlContentPlugin({ selectorPairs: [ { contentSelector: 'h1' }, { contentSelector: 'h2' }, { contentSelector: 'h3' } ] });

    // 1st apply
    stubQuerySelectorAll.withArgs('h1').returns([
      { innerText: 'h1 valA' },
    ]);

    stubQuerySelectorAll.withArgs('h2').returns([
      { innerText: 'h2 valA' },
      { innerText: 'h2 valB' },
      { innerText: 'h2 valC' },
    ]);

    stubQuerySelectorAll.withArgs('h3').returns([
      { innerText: 'h3 valA' },
      { innerText: 'h3 valB' },
    ]);

    let expectedContent = [
      [ 'h1 valA', 'h2 valA', 'h3 valA' ],
      [ 'h1 valA', 'h2 valB', 'h3 valB' ],
      [ 'h1 valA', 'h2 valC', 'h3 valB' ],
    ];

    let { content } = plugin.apply();
    assert.deepEqual(content, expectedContent);

    // 2nd apply
    stubQuerySelectorAll.withArgs('h1').returns([
      { innerText: 'h1 valA' },
      { innerText: 'h1 valD' },
    ]);

    // also add duplicate values for selector arr content
    stubQuerySelectorAll.withArgs('h2').returns([
      { innerText: 'h2 valA' },
      { innerText: 'h2 valB' },
      { innerText: 'h2 valC' },
      { innerText: 'h2 valD' },
      { innerText: 'h2 valD' },
    ]);

    stubQuerySelectorAll.withArgs('h3').returns([
      { innerText: 'h3 valA' },
      { innerText: 'h3 valB' },
      { innerText: 'h3 valD' },
    ]);

    expectedContent = [
      [ 'h1 valD', 'h2 valB', 'h3 valB' ],
      [ 'h1 valD', 'h2 valC', 'h3 valD' ],
      [ 'h1 valD', 'h2 valD', 'h3 valD' ],
    ];

    ({ content } = plugin.apply());
    assert.deepEqual(content, expectedContent);
  });

  it('extract html content - multiple selectors, different result length, cumulative apply, partial overlap', () => {
    plugin = new ExtractHtmlContentPlugin({ selectorPairs: [ { contentSelector: 'h1' }, { contentSelector: 'h2' }, { contentSelector: 'h3' } ] });

    // 1st apply
    stubQuerySelectorAll.withArgs('h1').returns([
      { innerText: 'h1 valA' },
      { innerText: 'h1 valB' },
    ]);

    stubQuerySelectorAll.withArgs('h2').returns([
      { innerText: 'h2 valA' },
      { innerText: 'h2 valB' },
    ]);

    stubQuerySelectorAll.withArgs('h3').returns([
    ]);

    let expectedContent = [
      [ 'h1 valA', 'h2 valA', '' ],
      [ 'h1 valB', 'h2 valB', '' ],
    ];

    let { content } = plugin.apply();
    assert.deepEqual(content, expectedContent);

    // 2nd apply
    stubQuerySelectorAll.withArgs('h1').returns([
      { innerText: 'h1 valB' },
      { innerText: 'h1 valC' },
    ]);

    stubQuerySelectorAll.withArgs('h2').returns([
      { innerText: 'h2 valB' },
      { innerText: 'h2 valC' },
    ]);

    stubQuerySelectorAll.withArgs('h3').returns([
      { innerText: '' },
      { innerText: 'h3 valC' },
    ]);

    expectedContent = [
      [ 'h1 valC', 'h2 valC', 'h3 valC' ],
    ];

    ({ content } = plugin.apply());
    assert.deepEqual(content, expectedContent);
  });

  it('extract valid selector base', () => {
    plugin = new ExtractHtmlContentPlugin({ selectorPairs: [ { contentSelector: 'div.row' } ] });

    assert.strictEqual(
      plugin.getSelectorBase([
        { contentSelector: 'div.row h1', contentProperty: 'innerText' },
        { contentSelector: 'div.row h2', contentProperty: 'innerText' },
        { contentSelector: 'div.row h3', contentProperty: 'innerText' },
      ]),
      'div.row',
    );

    assert.strictEqual(
      plugin.getSelectorBase([
        { contentSelector: 'div.row a.red h1', contentProperty: 'innerText' },
        { contentSelector: 'div.row a.red h2', contentProperty: 'innerText' },
        { contentSelector: 'div.row a.red h3', contentProperty: 'innerText' },
      ]),
      'div.row a.red',
    );
  });

  it('extract null selector base', () => {
    plugin = new ExtractHtmlContentPlugin({ selectorPairs: [ { contentSelector: 'div.row' } ] });

    const cssBase = plugin.getSelectorBase([
      { contentSelector: 'div.rowA h1', contentProperty: 'innerText' },
      { contentSelector: 'div.rowA h2', contentProperty: 'innerText' },
      { contentSelector: 'div.rowB h3', contentProperty: 'innerText' },
    ]);
    assert.isNull(cssBase);
  });
});
