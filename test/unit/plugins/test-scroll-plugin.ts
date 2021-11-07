import { assert } from 'chai';
import { createSandbox, SinonSandbox } from 'sinon';
import ScrollPlugin from '../../../src/plugins/default/ScrollPlugin';
import * as utils from '../../../src/plugins/dom-utils';
import Resource from '../../../src/storage/base/Resource';

describe('ScrollPlugin', () => {
  let sandbox:SinonSandbox;
  let plugin: ScrollPlugin;
  const project:any = {};

  beforeEach(() => {
    sandbox = createSandbox();
    sandbox.stub(window, 'scrollTo');
  });

  afterEach(() => {
    sandbox.restore();
  });

  it('test conditions', () => {
    plugin = new ScrollPlugin();
    assert.isFalse(plugin.test(project, null));
    assert.isFalse(plugin.test(project, <Resource>{ actions: [ 'clickA' ] }));
    assert.isTrue(plugin.test(project, <Resource>{ contentType: 'text/html' }));
  });

  it('apply DOM unchanged', async () => {
    plugin = new ScrollPlugin();
    const stubWaitForStability = sandbox.stub(utils, 'waitForDomStability');
    stubWaitForStability.returns(new Promise(resolve => resolve(utils.DomStabilityStatus.Unchanged)));

    const actualResult = await plugin.apply();
    assert.isNull(actualResult);
  });

  it('apply DOM changed, stable', async () => {
    plugin = new ScrollPlugin();
    const stubWaitForStability = sandbox.stub(utils, 'waitForDomStability');
    stubWaitForStability.returns(new Promise(resolve => resolve(utils.DomStabilityStatus.Stable)));

    const actualResult = await plugin.apply();
    const expectedResult = { actions: [ 'scroll#1' ], status: 200 };
    assert.deepEqual(actualResult, expectedResult);
  });

  it('apply DOM changed, unstable', async () => {
    plugin = new ScrollPlugin();
    const stubWaitForStability = sandbox.stub(utils, 'waitForDomStability');
    stubWaitForStability.returns(new Promise(resolve => resolve(utils.DomStabilityStatus.Unstable)));

    let actualErr;
    try {
      await plugin.apply();
    }
    catch (err) {
      actualErr = err;
    }

    assert.strictEqual(actualErr.message, `DOM not stable after stabilityTimeout of ${plugin.opts.stabilityTimeout}`);
  });
});
