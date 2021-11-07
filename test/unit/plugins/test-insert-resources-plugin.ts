import { assert } from 'chai';
import { createSandbox, SinonSandbox, SinonStubbedInstance } from 'sinon';
import InsertResourcesPlugin from '../../../src/plugins/default/InsertResourcesPlugin';
import Queue from '../../../src/storage/base/Queue';
import Resource from '../../../src/storage/base/Resource';

describe('InsertResourcesPlugin', () => {
  let sandbox:SinonSandbox;
  let plugin: InsertResourcesPlugin;
  let project:{queue: SinonStubbedInstance<Queue>};

  beforeEach(() => {
    sandbox = createSandbox();

    const queue = sandbox.stub<Queue>(<any>{
      countResources: () => null,
      checkIfPresent: () => null,
      add: () => null,
    });
    queue.countResources.returns(Promise.resolve(0));
    queue.checkIfPresent.returns(Promise.resolve([]));

    project = { queue };
  });

  afterEach(() => {
    sandbox.restore();
  });

  it('test conditions', () => {
    plugin = new InsertResourcesPlugin();
    assert.isFalse(plugin.test(<any>project, null));
    assert.isFalse(plugin.test(<any>project, <Resource>{ resourcesToAdd: [ ] }));
    assert.isTrue(plugin.test(<any>project, <Resource>{ resourcesToAdd: [ { url: 'http://a.com' } ] }));
  });

  it('fully save new resources, maxResources undefined', async () => {
    plugin = new InsertResourcesPlugin();
    await plugin.apply(<any>project, <Resource>{ depth: 0, resourcesToAdd: [ { url: 'urlA' }, { url: 'urlB' } ] });

    assert.isTrue(project.queue.checkIfPresent.notCalled);
    assert.isTrue(project.queue.add.calledOnce);

    const [ saveResources ] = project.queue.add.args[0];
    assert.sameDeepMembers([ { url: 'urlA', depth: 1 }, { url: 'urlB', depth: 1 } ], saveResources);
  });

  it('fully save new resources, maxResources defined', async () => {
    plugin = new InsertResourcesPlugin({ maxResources: 2 });
    await plugin.apply(<any>project, <Resource>{ depth: 0, resourcesToAdd: [ { url: 'urlA' }, { url: 'urlB' } ] });

    assert.isTrue(project.queue.checkIfPresent.notCalled);
    assert.isTrue(project.queue.add.calledOnce);

    const [ saveResources ] = project.queue.add.args[0];
    assert.sameDeepMembers([ { url: 'urlA', depth: 1 }, { url: 'urlB', depth: 1 } ], saveResources);
  });

  it('partially save new resources', async () => {
    plugin = new InsertResourcesPlugin({ maxResources: 1 });
    await plugin.apply(<any>project, <Resource>{ depth: 0, resourcesToAdd: [ { url: 'urlA' }, { url: 'urlB' } ] });

    assert.isTrue(project.queue.checkIfPresent.calledOnce);
    assert.isTrue(project.queue.add.calledOnce);

    const [ saveResources ] = project.queue.add.args[0];
    assert.sameDeepMembers([ { url: 'urlA', depth: 1 } ], saveResources);
  });

  it('partially save new/existing resources', async () => {
    project.queue.checkIfPresent.returns(Promise.resolve([ { url: 'urlA' } ]));
    plugin = new InsertResourcesPlugin({ maxResources: 1 });
    await plugin.apply(<any>project, <Resource>{ depth: 0, resourcesToAdd: [ { url: 'urlA' }, { url: 'urlB' } ] });

    assert.isTrue(project.queue.checkIfPresent.calledOnce);
    assert.isTrue(project.queue.add.calledOnce);

    const [ saveResources ] = project.queue.add.args[0];
    assert.sameDeepMembers([ { url: 'urlB', depth: 1 } ], saveResources);
  });
});
