import { describe, it, expect } from 'bun:test';
import { AsyncQueue, QueueThrottle } from '../src/utils/queue';

const delay = (ms: number) => new Promise((res) => setTimeout(res, ms));

describe('AsyncQueue (memory mode)', () => {
  it('rejects when maxQueue exceeded', async () => {
    const queue = new AsyncQueue(1, { getMaxQueue: () => 0 });
    const noop = () => Promise.resolve();
    await expect(queue.enqueue(noop, 0)).rejects.toThrow('Queue is full');
  });

  it('respects concurrency limit', async () => {
    const queue = new AsyncQueue(2);
    let active = 0;
    let maxActive = 0;
    const task = async () => {
      active += 1;
      maxActive = Math.max(maxActive, active);
      await delay(30);
      active -= 1;
    };
    await Promise.all([
      queue.enqueue(task, 5),
      queue.enqueue(task, 5),
      queue.enqueue(task, 5),
      queue.enqueue(task, 5)
    ]);
    expect(maxActive).toBeLessThanOrEqual(2);
  });
});

describe('AsyncQueue with throttle (redis-like stub)', () => {
  it('calls throttle hooks', async () => {
    let enqueued = 0;
    let acquired = 0;
    let released = 0;
    const throttle: QueueThrottle = {
      tryEnqueue: async () => {
        enqueued += 1;
      },
      tryAcquire: async () => {
        acquired += 1;
        return true;
      },
      release: async () => {
        released += 1;
      }
    };
    const queue = new AsyncQueue(1, { throttle });
    await queue.enqueue(() => Promise.resolve('ok'), 5);
    await delay(0); // allow release to flush
    expect(enqueued).toBe(1);
    expect(acquired).toBeGreaterThanOrEqual(1);
    expect(released).toBeGreaterThanOrEqual(1);
  });
});
