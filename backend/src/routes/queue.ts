import Redis from 'ioredis';

export type QueueSettings = {
  answerConcurrency: number;
  submitConcurrency: number;
  maxQueue: number;
};

type Task<T> = () => Promise<T>;

type QueuedTask<T> = {
  task: Task<T>;
  resolve: (value: T) => void;
  reject: (error: unknown) => void;
};

type QueueThrottle = {
  tryEnqueue(maxQueue: number): Promise<void>;
  tryAcquire(maxConcurrency: number): Promise<boolean>;
  release(): Promise<void>;
};

class AsyncQueue {
  private queue: Array<QueuedTask<any>> = [];
  private active = 0;
  private concurrency: number;
  private draining = false;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private throttle?: QueueThrottle;
  private getMaxQueue?: () => number;
  private getMaxConcurrency?: () => number;

  constructor(
    concurrency: number,
    options?: {
      throttle?: QueueThrottle;
      getMaxQueue?: () => number;
      getMaxConcurrency?: () => number;
    }
  ) {
    this.concurrency = Math.max(1, concurrency);
    this.throttle = options?.throttle;
    this.getMaxQueue = options?.getMaxQueue;
    this.getMaxConcurrency = options?.getMaxConcurrency;
  }

  setConcurrency(next: number) {
    this.concurrency = Math.max(1, next);
    this.drain();
  }

  size() {
    return this.queue.length;
  }

  async enqueue<T>(task: Task<T>, maxQueue: number): Promise<T> {
    const effectiveMaxQueue = Math.min(maxQueue, this.getMaxQueue?.() ?? maxQueue);
    if (this.queue.length >= effectiveMaxQueue) {
      return Promise.reject(new Error('Queue is full'));
    }
    if (this.throttle) {
      await this.throttle.tryEnqueue(effectiveMaxQueue);
    }
    return new Promise<T>((resolve, reject) => {
      this.queue.push({ task, resolve, reject });
      this.drain();
    });
  }

  private drain() {
    if (this.draining) return;
    this.draining = true;
    void this.process();
  }

  private scheduleRetry() {
    if (this.retryTimer) return;
    this.retryTimer = setTimeout(() => {
      this.retryTimer = null;
      this.drain();
    }, 250);
  }

  private async process() {
    try {
      while (this.active < this.concurrency && this.queue.length > 0) {
        if (this.throttle) {
          const globalMaxConcurrency = this.getMaxConcurrency?.() ?? this.concurrency;
          const acquired = await this.throttle.tryAcquire(globalMaxConcurrency);
          if (!acquired) {
            this.scheduleRetry();
            return;
          }
        }
        const item = this.queue.shift();
        if (!item) return;
        this.active += 1;
        item
          .task()
          .then(item.resolve)
          .catch(item.reject)
          .finally(async () => {
            this.active -= 1;
            if (this.throttle) {
              await this.throttle.release();
            }
            this.drain();
          });
      }
    } finally {
      this.draining = false;
    }
  }
}

export const queueSettings: QueueSettings = {
  answerConcurrency: 10,
  submitConcurrency: 3,
  maxQueue: 1000
};

const readLimit = (value: string | undefined, fallback: number) => {
  if (value === undefined || value === '') return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const queueDriver = (process.env.QUEUE_DRIVER?.trim().toLowerCase() || 'memory');
const redisUrl = process.env.REDIS_URL;
const useRedis = queueDriver === 'redis';

const getGlobalMaxQueue = () => readLimit(process.env.QUEUE_GLOBAL_MAX_QUEUE, queueSettings.maxQueue);
const getGlobalAnswerConcurrency = () =>
  readLimit(process.env.QUEUE_GLOBAL_ANSWER_CONCURRENCY, queueSettings.answerConcurrency);
const getGlobalSubmitConcurrency = () =>
  readLimit(process.env.QUEUE_GLOBAL_SUBMIT_CONCURRENCY, queueSettings.submitConcurrency);

class RedisThrottle implements QueueThrottle {
  private redis: Redis;
  private queuedKey: string;
  private activeKey: string;

  constructor(redis: Redis, name: string) {
    this.redis = redis;
    this.queuedKey = `queue:${name}:queued`;
    this.activeKey = `queue:${name}:active`;
  }

  async tryEnqueue(maxQueue: number): Promise<void> {
    const ttlSeconds = 3600;
    const result = await this.redis.eval(
      `local queued = tonumber(redis.call('GET', KEYS[1]) or '0')
       if queued >= tonumber(ARGV[1]) then return 0 end
       redis.call('INCR', KEYS[1])
       redis.call('EXPIRE', KEYS[1], tonumber(ARGV[2]))
       return 1`,
      1,
      this.queuedKey,
      maxQueue,
      ttlSeconds
    );
    if (Number(result) !== 1) {
      throw new Error('Queue is full');
    }
  }

  async tryAcquire(maxConcurrency: number): Promise<boolean> {
    const ttlSeconds = 3600;
    const result = await this.redis.eval(
      `local queued = tonumber(redis.call('GET', KEYS[1]) or '0')
       if queued <= 0 then return 0 end
       local active = tonumber(redis.call('GET', KEYS[2]) or '0')
       if active >= tonumber(ARGV[1]) then return 0 end
       redis.call('DECR', KEYS[1])
       redis.call('INCR', KEYS[2])
       redis.call('EXPIRE', KEYS[1], tonumber(ARGV[2]))
       redis.call('EXPIRE', KEYS[2], tonumber(ARGV[2]))
       return 1`,
      2,
      this.queuedKey,
      this.activeKey,
      maxConcurrency,
      ttlSeconds
    );
    return Number(result) === 1;
  }

  async release(): Promise<void> {
    const ttlSeconds = 3600;
    await this.redis.eval(
      `local active = tonumber(redis.call('GET', KEYS[1]) or '0')
       if active <= 0 then return 0 end
       redis.call('DECR', KEYS[1])
       redis.call('EXPIRE', KEYS[1], tonumber(ARGV[1]))
       return 1`,
      1,
      this.activeKey,
      ttlSeconds
    );
  }
}

let redisClient: Redis | null = null;
const getRedisThrottle = (name: string): QueueThrottle | undefined => {
  if (!useRedis) return undefined;
  if (!redisUrl) {
    throw new Error('REDIS_URL is required when QUEUE_DRIVER=redis');
  }
  if (!redisClient) {
    redisClient = new Redis(redisUrl, { maxRetriesPerRequest: 2 });
  }
  return new RedisThrottle(redisClient, name);
};

export const answerQueue = new AsyncQueue(queueSettings.answerConcurrency, {
  throttle: getRedisThrottle('answer'),
  getMaxQueue: getGlobalMaxQueue,
  getMaxConcurrency: getGlobalAnswerConcurrency
});
export const submitQueue = new AsyncQueue(queueSettings.submitConcurrency, {
  throttle: getRedisThrottle('submit'),
  getMaxQueue: getGlobalMaxQueue,
  getMaxConcurrency: getGlobalSubmitConcurrency
});

export const updateQueueSettings = (settings: Partial<QueueSettings>) => {
  if (settings.answerConcurrency !== undefined) {
    queueSettings.answerConcurrency = Math.max(1, settings.answerConcurrency);
    answerQueue.setConcurrency(queueSettings.answerConcurrency);
  }
  if (settings.submitConcurrency !== undefined) {
    queueSettings.submitConcurrency = Math.max(1, settings.submitConcurrency);
    submitQueue.setConcurrency(queueSettings.submitConcurrency);
  }
  if (settings.maxQueue !== undefined) {
    queueSettings.maxQueue = Math.max(10, settings.maxQueue);
  }
};
