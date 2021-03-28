import { assert } from 'chai';
import { SinonSandbox, createSandbox } from 'sinon';
import RuntimeMetrics, { RuntimeOptions } from '../../../src/scraper/RuntimeMetrics';

describe('RuntimeMetrics', () => {
  let sandbox:SinonSandbox;
  let metrics:RuntimeMetrics;

  beforeEach(() => {
    sandbox = createSandbox();
  });

  afterEach(() => {
    sandbox.restore();
  });

  it('snapshot', () => {
    metrics = new RuntimeMetrics();
    metrics.cpuUsage = {
      totalTick: 1000,
      totalIdle: 1000,
      processTick: null,
    };
    sandbox.stub(metrics, 'getMemoryUsage').returns({
      freeMem: 800,
      totalMem: 1000,
      processMem: 100,
    });
    sandbox.stub(metrics, 'getCpuUsage').returns({
      totalTick: 2000,
      totalIdle: 1600,
      processTick: { user: 50000, system: 100000 },
    });

    const snapshot:RuntimeOptions = metrics.takeSnapshot();

    assert.deepEqual(
      snapshot,
      {
        global: { mem: 200, memPct: 20, cpuPct: 40 },
        process: { mem: 100, memPct: 10, cpuPct: 15 },
      },
    );
  });
});
