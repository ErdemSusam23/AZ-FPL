import { Redis } from '@upstash/redis';

type Loader<T> = () => Promise<T>;
type DynamicLoader<T> = () => Promise<{ value: T; ttlSeconds: number }>;

type MemoryEntry = { value: unknown; expiresAt: number };

class MemoryCache {
  private readonly entries = new Map<string, MemoryEntry>();

  get<T>(key: string): T | null {
    const entry = this.entries.get(key);
    if (!entry || entry.expiresAt <= Date.now()) {
      this.entries.delete(key);
      return null;
    }
    return entry.value as T;
  }

  set<T>(key: string, value: T, ttlSeconds: number): void {
    this.entries.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
  }
}

export class Cache {
  private readonly memory = new MemoryCache();
  private readonly pending = new Map<string, Promise<unknown>>();
  private readonly redis: Redis | null;

  constructor(options: { redisUrl?: string; redisToken?: string } = {}) {
    this.redis = options.redisUrl && options.redisToken
      ? new Redis({ url: options.redisUrl, token: options.redisToken })
    : null;
  }

  async getOrSet<T>(key: string, ttlSeconds: number, loader: Loader<T>): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached !== null) return cached;

    const currentRequest = this.pending.get(key) as Promise<T> | undefined;
    if (currentRequest) return currentRequest;

    const request = loader().then(async (value) => {
      await this.set(key, value, ttlSeconds);
      return value;
    }).finally(() => this.pending.delete(key));

    this.pending.set(key, request);
    return request;
  }

  async getOrSetDynamic<T>(key: string, loader: DynamicLoader<T>): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached !== null) return cached;

    const currentRequest = this.pending.get(key) as Promise<T> | undefined;
    if (currentRequest) return currentRequest;

    const request = loader().then(async ({ value, ttlSeconds }) => {
      await this.set(key, value, ttlSeconds);
      return value;
    }).finally(() => this.pending.delete(key));

    this.pending.set(key, request);
    return request;
  }

  private async get<T>(key: string): Promise<T | null> {
    if (!this.redis) return this.memory.get<T>(key);
    try {
      return await this.redis.get<T>(key);
    } catch (error) {
      console.warn('Redis okunamadı; bellek içi cache kullanılacak.', error);
      return this.memory.get<T>(key);
    }
  }

  private async set<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
    this.memory.set(key, value, ttlSeconds);
    if (!this.redis) return;
    try {
      await this.redis.set(key, value, { ex: ttlSeconds });
    } catch (error) {
      console.warn('Redis yazılamadı; bellek içi cache güncellendi.', error);
    }
  }
}
