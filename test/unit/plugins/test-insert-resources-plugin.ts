import { assert } from 'chai';
import { createSandbox, SinonSandbox, SinonSpy } from 'sinon';
import InsertResourcesPlugin from '../../../src/plugins/default/InsertResourcesPlugin';
import Resource from '../../../src/storage/base/Resource';

describe('InsertResourcesPlugin', () => {
  let sandbox:SinonSandbox;
  let spySaveResources:SinonSpy;
  let plugin: InsertResourcesPlugin;
  const site:any = { resourceCount: 0, saveResources: () => undefined, getResource: () => undefined, countResources: () => 0 };

  beforeEach(() => {
    sandbox = createSandbox();
    spySaveResources = sandbox.spy(site, 'saveResources');
  });

  afterEach(() => {
    sandbox.restore();
  });

  it('test conditions', () => {
    plugin = new InsertResourcesPlugin();
    assert.isFalse(plugin.test(site, null));
    assert.isFalse(plugin.test(site, <Resource>{ resourcesToAdd: [ ] }));
    assert.isTrue(plugin.test(site, <Resource>{ resourcesToAdd: [ { url: 'http://a.com' } ] }));
  });

  it('fully save new resources, maxResources undefined', async () => {
    plugin = new InsertResourcesPlugin();
    await plugin.apply(site, <Resource>{ depth: 0, resourcesToAdd: [ { url: 'urlA' }, { url: 'urlB' } ] });

    assert.isTrue(spySaveResources.calledOnce);
    const [ saveResources ] = spySaveResources.getCall(0).args;
    assert.sameDeepMembers([ { url: 'urlA', depth: 1 }, { url: 'urlB', depth: 1 } ], saveResources);
  });

  it('fully save new resources, maxResources defined', async () => {
    plugin = new InsertResourcesPlugin({ maxResources: 2 });
    await plugin.apply(site, <Resource>{ depth: 0, resourcesToAdd: [ { url: 'urlA' }, { url: 'urlB' } ] });

    assert.isTrue(spySaveResources.calledOnce);
    const [ saveResources ] = spySaveResources.getCall(0).args;
    assert.sameDeepMembers([ { url: 'urlA', depth: 1 }, { url: 'urlB', depth: 1 } ], saveResources);
  });

  it('partially save new resources', async () => {
    plugin = new InsertResourcesPlugin({ maxResources: 1 });
    await plugin.apply(site, <Resource>{ depth: 0, resourcesToAdd: [ { url: 'urlA' }, { url: 'urlB' } ] });

    assert.isTrue(spySaveResources.calledOnce);
    const [ saveResources ] = spySaveResources.getCall(0).args;
    assert.sameDeepMembers([ { url: 'urlA', depth: 1 } ], saveResources);
  });
});
