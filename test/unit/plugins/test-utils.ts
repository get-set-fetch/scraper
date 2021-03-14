/* eslint-disable @typescript-eslint/no-empty-function */
// eslint-disable-next-line max-classes-per-file
import { assert } from 'chai';
import { SinonSandbox, createSandbox } from 'sinon';
import { DomStabilityStatus, waitForDomStability } from '../../../src/plugins/utils';

describe('DOM Utils', () => {
  let sandbox:SinonSandbox;
  let mutationCallback: (mutationList, observer) => void;

  const PollyMutationObserver = class {
    constructor(callback) {
      mutationCallback = callback;
    }

    observe() {}
    disconnect() {}
  };
  global.MutationObserver = <any>PollyMutationObserver;

  beforeEach(() => {
    sandbox = createSandbox();
  });

  afterEach(() => {
    sandbox.restore();
    mutationCallback = null;
  });

  it('waitForDomStability - DomStabilityStatus.Unchanged', async () => {
    sandbox.stub(PollyMutationObserver.prototype);

    const domStatus: DomStabilityStatus = await waitForDomStability({ stabilityCheck: 102, stabilityTimeout: 500 });
    await new Promise(resolve => setTimeout(resolve, 3000));
    assert.strictEqual(domStatus, DomStabilityStatus.Unchanged);
  });

  it('waitForDomStability - DomStabilityStatus.Unstable', async () => {
    const observer = sandbox.createStubInstance(PollyMutationObserver);

    const domStatusPromise: Promise<DomStabilityStatus> = waitForDomStability({ stabilityCheck: 200, stabilityTimeout: 500 });
    const intervalId = setInterval(mutationCallback, 100, [ { type: 'childList' } ], observer);

    const domStatus: DomStabilityStatus = await domStatusPromise;
    assert.strictEqual(domStatus, DomStabilityStatus.Unstable);

    clearInterval(intervalId);
  });

  it('waitForDomStability - DomStabilityStatus.Stable', async () => {
    const observer = sandbox.createStubInstance(PollyMutationObserver);

    const domStatusPromise: Promise<DomStabilityStatus> = waitForDomStability({ stabilityCheck: 200, stabilityTimeout: 500 });
    const intervalId = setTimeout(mutationCallback, 100, [ { type: 'childList' } ], observer);

    const domStatus: DomStabilityStatus = await domStatusPromise;
    assert.strictEqual(domStatus, DomStabilityStatus.Stable);

    clearInterval(intervalId);
  });
});
