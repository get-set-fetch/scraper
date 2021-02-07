/* eslint-disable prefer-destructuring */
import { assert } from 'chai';
import { PluginOpts } from '../../../src/plugins/Plugin';
import { scenarios, mergePluginOpts } from '../../../src/scenarios/scenarios';

describe('MergePluginOpts', () => {
  const { defaultPluginOpts } = scenarios['browser-static-content'];

  it('before anchor', () => {
    const customOpts = [ {
      name: 'CustomBeforePlugin',
      before: 'SelectResourcePlugin',
    } ];

    const mergedOpts = mergePluginOpts(defaultPluginOpts, customOpts);

    assert.sameDeepOrderedMembers(
      mergedOpts,
      [ ...customOpts, ...defaultPluginOpts ],
    );
  });

  it('after anchor', () => {
    const customOpts = [ {
      name: 'CustomAfterPlugin',
      after: 'UpsertResourcePlugin',
    } ];

    const mergedOpts = mergePluginOpts(defaultPluginOpts, customOpts);

    assert.sameDeepOrderedMembers(
      mergedOpts,
      [ ...defaultPluginOpts, ...customOpts ],
    );
  });

  it('replace anchor', () => {
    const customOpts = [ {
      name: 'CustomReplacePlugin',
      replace: 'BrowserFetchPlugin',
    } ];

    const mergedOpts = mergePluginOpts(defaultPluginOpts, customOpts);
    const expectedOpts = [ ...defaultPluginOpts ];
    expectedOpts[1] = customOpts[0];

    assert.sameDeepOrderedMembers(
      mergedOpts,
      expectedOpts,
    );
  });

  it('merge anchor', () => {
    const customOpts = [ {
      name: 'ExtractUrlsPlugin',
      maxDepth: 5,
    } ];

    const mergedOpts = mergePluginOpts(defaultPluginOpts, customOpts);
    const expectedOpts = [ ...defaultPluginOpts ];
    expectedOpts[2] = customOpts[0];

    assert.sameDeepOrderedMembers(
      mergedOpts,
      expectedOpts,
    );
  });

  it('multiple anchors', () => {
    const customOpts = [
      {
        name: 'CustomBefore1Plugin',
        before: 'SelectResourcePlugin',
      },
      {
        name: 'CustomBefore2Plugin',
        before: 'SelectResourcePlugin',
      },
      {
        name: 'CustomAfter1Plugin',
        after: 'ExtractHtmlContentPlugin',
      },
      {
        name: 'CustomAfter2Plugin',
        after: 'ExtractHtmlContentPlugin',
      },
    ];

    const mergedOpts = mergePluginOpts(defaultPluginOpts, customOpts);
    const expectedOpts:PluginOpts[] = [
      {
        name: 'CustomBefore1Plugin',
        before: 'SelectResourcePlugin',
      },
      {
        name: 'CustomBefore2Plugin',
        before: 'SelectResourcePlugin',
      },
      {
        name: 'SelectResourcePlugin',
      },
      {
        name: 'BrowserFetchPlugin',
      },
      {
        name: 'ExtractUrlsPlugin',
      },
      {
        name: 'ExtractHtmlContentPlugin',
      },
      {
        name: 'CustomAfter2Plugin',
        after: 'ExtractHtmlContentPlugin',
      },
      {
        name: 'CustomAfter1Plugin',
        after: 'ExtractHtmlContentPlugin',
      },
      {
        name: 'InsertResourcesPlugin',
      },
      {
        name: 'UpsertResourcePlugin',
      },
    ];

    assert.sameDeepOrderedMembers(
      mergedOpts,
      expectedOpts,
    );
  });
});
