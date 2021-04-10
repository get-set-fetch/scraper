/* eslint-disable max-classes-per-file */
import os from 'os';
import { getLogger } from '../logger/Logger';

export type RuntimeOptionsEntry = {
  /**
  * Memory usage (bytes)
  */
  mem: number;

  /**
  * Memory usage (percentage)
  */
  memPct: number;

  /**
  * Average cpu usage (percentage)
  */
  cpuPct: number;
}

export type RuntimeOptions = {
  /**
  * Usage at OS level
  */
  global: RuntimeOptionsEntry;

  /**
  * Usage at process level
   */
  process: RuntimeOptionsEntry
}

export class RuntimeMetricsError extends Error {
  snapshot: RuntimeOptions;

  constructor(snapshot: RuntimeOptions) {
    super();

    this.snapshot = snapshot;
  }
}

export default class RuntimeMetrics {
  logger = getLogger('RuntimeMetrics');

  opts: Partial<RuntimeOptions>;

  lastCheck: number;
  minCheckInterval: number = 1000;

  snapshot: RuntimeOptions;

  cpuUsage: {
    totalIdle:number;
    totalTick:number;
    processTick: NodeJS.CpuUsage;
  }

  constructor(opts: Partial<RuntimeOptions> = {}) {
    this.opts = opts;

    /*
    cpu ticks are calculated since system start
    to get usage within a certain time interval do diffs, start right away with a 1st reading
    */
    this.cpuUsage = this.getCpuUsage();
  }

  getMemoryUsage() {
    return {
      freeMem: os.freemem(),
      totalMem: os.totalmem(),
      processMem: process.memoryUsage().rss,
    };
  }

  getCpuUsage() {
    let totalIdle = 0;
    let totalTick = 0;

    const cpus = os.cpus();

    cpus.forEach(cpu => {
      Object.keys(cpu.times).forEach(timeKey => {
        totalTick += cpu.times[timeKey];
      });
      totalIdle += cpu.times.idle;
    });

    return {
      totalTick: totalTick / cpus.length,
      totalIdle: totalIdle / cpus.length,
      processTick: process.cpuUsage((this.cpuUsage || {}).processTick),
    };
  }

  takeSnapshot():RuntimeOptions {
    // memory
    const { freeMem, totalMem, processMem } = this.getMemoryUsage();

    // cpu
    const { totalTick: oldTotalTick, totalIdle: oldTotalIdle } = this.cpuUsage;
    this.cpuUsage = this.getCpuUsage();
    const { totalTick, totalIdle, processTick } = this.cpuUsage;
    const totalTickDiff = totalTick - oldTotalTick;
    const totalIdleDff = totalIdle - oldTotalIdle;

    return {
      global: {
        mem: (totalMem - freeMem),
        memPct: ((totalMem - freeMem) / totalMem) * 100,
        cpuPct: ((totalTickDiff - totalIdleDff) / totalTickDiff) * 100,
      },
      process: {
        mem: processMem,
        memPct: (processMem / totalMem) * 100,
        // process tick is measures in microseconds, total tick in miliseconds
        cpuPct: ((processTick.system + processTick.user) / 1000 / totalTickDiff) * 100,
      },
    };
  }

  check():void {
    // no runtime usage thresholds have been set, nothing to do
    if (!(this.opts.global || this.opts.process)) return;

    // min interval between process check is not met
    if (this.lastCheck && (Date.now() - this.lastCheck) < this.minCheckInterval) return;

    // update usage
    this.snapshot = this.takeSnapshot();
    this.logger.warn(this.snapshot, 'memory and cpu usage');

    Object.keys(this.snapshot).forEach(level => {
      Object.keys(this.snapshot[level]).forEach(metric => {
        if (
          this.opts[level]
          && this.opts[level][metric]
          && this.snapshot[level][metric] > this.opts[level][metric]
        ) {
          // runtime conditions not met, actual usage is higher than defined threshold
          throw new RuntimeMetricsError(this.snapshot);
        }
      });
    });
  }
}
