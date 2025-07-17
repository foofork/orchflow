/**
 * Enterprise Rate Limiter Implementation
 */

import { LRUCache } from 'lru-cache';

interface RateLimiterConfig {
  windowMs: number;
  maxRequests: number;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
  keyGenerator?: (identifier: string) => string;
  onLimitReached?: (identifier: string, resetTime: number) => void;
}

interface WindowInfo {
  count: number;
  resetTime: number;
}

export class RateLimiter {
  private cache: LRUCache<string, WindowInfo>;
  protected config: Required<RateLimiterConfig>;

  constructor(config: RateLimiterConfig) {
    this.config = {
      skipSuccessfulRequests: false,
      skipFailedRequests: false,
      keyGenerator: (id) => id,
      onLimitReached: () => {},
      ...config
    };

    this.cache = new LRUCache<string, WindowInfo>({
      max: 10000, // Max number of unique identifiers to track
      ttl: this.config.windowMs,
      updateAgeOnGet: false,
      updateAgeOnHas: false
    });
  }

  /**
   * Check if a request should be rate limited
   */
  async checkLimit(identifier: string, statusCode?: number): Promise<boolean> {
    // Skip based on status code if configured
    if (statusCode !== undefined) {
      if (this.config.skipSuccessfulRequests && statusCode < 400) {
        return true;
      }
      if (this.config.skipFailedRequests && statusCode >= 400) {
        return true;
      }
    }

    const key = this.config.keyGenerator(identifier);
    const now = Date.now();
    const windowInfo = this.cache.get(key) || this.createWindow(now);

    // Check if window has expired
    if (now > windowInfo.resetTime) {
      windowInfo.count = 0;
      windowInfo.resetTime = now + this.config.windowMs;
    }

    windowInfo.count++;
    this.cache.set(key, windowInfo);

    // Check if limit exceeded
    if (windowInfo.count > this.config.maxRequests) {
      this.config.onLimitReached(identifier, windowInfo.resetTime);
      return false;
    }

    return true;
  }

  /**
   * Reset rate limit for a specific identifier
   */
  reset(identifier: string): void {
    const key = this.config.keyGenerator(identifier);
    this.cache.delete(key);
  }

  /**
   * Reset all rate limits
   */
  resetAll(): void {
    this.cache.clear();
  }

  /**
   * Get current rate limit status for an identifier
   */
  getStatus(identifier: string): { count: number; remaining: number; resetTime: number } | null {
    const key = this.config.keyGenerator(identifier);
    const windowInfo = this.cache.get(key);

    if (!windowInfo) {
      return {
        count: 0,
        remaining: this.config.maxRequests,
        resetTime: Date.now() + this.config.windowMs
      };
    }

    const now = Date.now();
    if (now > windowInfo.resetTime) {
      return {
        count: 0,
        remaining: this.config.maxRequests,
        resetTime: now + this.config.windowMs
      };
    }

    return {
      count: windowInfo.count,
      remaining: Math.max(0, this.config.maxRequests - windowInfo.count),
      resetTime: windowInfo.resetTime
    };
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<RateLimiterConfig>): void {
    Object.assign(this.config, config);

    // Update cache TTL if window changed
    if (config.windowMs !== undefined) {
      const oldCache = this.cache;
      this.cache = new LRUCache<string, WindowInfo>({
        max: 10000,
        ttl: config.windowMs,
        updateAgeOnGet: false,
        updateAgeOnHas: false
      });

      // Transfer existing entries
      for (const [key, value] of oldCache.entries()) {
        this.cache.set(key, value);
      }
    }
  }

  /**
   * Get metrics for monitoring
   */
  getMetrics(): {
    totalIdentifiers: number;
    totalRequests: number;
    blockedRequests: number;
    memoryUsage: number;
  } {
    let totalRequests = 0;
    let blockedRequests = 0;

    for (const windowInfo of this.cache.values()) {
      totalRequests += windowInfo.count;
      if (windowInfo.count > this.config.maxRequests) {
        blockedRequests += windowInfo.count - this.config.maxRequests;
      }
    }

    return {
      totalIdentifiers: this.cache.size,
      totalRequests,
      blockedRequests,
      memoryUsage: this.cache.size * 50 // Approximate bytes per entry
    };
  }

  private createWindow(now: number): WindowInfo {
    return {
      count: 0,
      resetTime: now + this.config.windowMs
    };
  }
}

/**
 * Distributed Rate Limiter using Redis (for multi-instance deployments)
 */
export class DistributedRateLimiter extends RateLimiter {
  private redisClient: any; // Would use ioredis in production

  constructor(config: RateLimiterConfig & { redisClient?: any }) {
    super(config);
    this.redisClient = config.redisClient;
  }

  override async checkLimit(identifier: string, statusCode?: number): Promise<boolean> {
    if (!this.redisClient) {
      // Fallback to in-memory if Redis not available
      return super.checkLimit(identifier, statusCode);
    }

    // Skip based on status code if configured
    if (statusCode !== undefined) {
      if (this.config.skipSuccessfulRequests && statusCode < 400) {
        return true;
      }
      if (this.config.skipFailedRequests && statusCode >= 400) {
        return true;
      }
    }

    const key = `ratelimit:${this.config.keyGenerator(identifier)}`;
    const now = Date.now();
    const windowStart = now - this.config.windowMs;

    try {
      // Use Redis sorted set for sliding window
      const pipeline = this.redisClient.pipeline();

      // Remove old entries
      pipeline.zremrangebyscore(key, '-inf', windowStart);

      // Add current request
      pipeline.zadd(key, now, `${now}-${Math.random()}`);

      // Count requests in window
      pipeline.zcard(key);

      // Set expiry
      pipeline.expire(key, Math.ceil(this.config.windowMs / 1000));

      const results = await pipeline.exec();
      const count = results[2][1] as number;

      if (count > this.config.maxRequests) {
        this.config.onLimitReached(identifier, now + this.config.windowMs);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Redis rate limiter error:', error);
      // Fallback to in-memory
      return super.checkLimit(identifier, statusCode);
    }
  }

  override async reset(identifier: string): Promise<void> {
    if (!this.redisClient) {
      return super.reset(identifier);
    }

    const key = `ratelimit:${this.config.keyGenerator(identifier)}`;
    try {
      await this.redisClient.del(key);
    } catch (error) {
      console.error('Redis reset error:', error);
      super.reset(identifier);
    }
  }

  override async resetAll(): Promise<void> {
    if (!this.redisClient) {
      return super.resetAll();
    }

    try {
      const keys = await this.redisClient.keys('ratelimit:*');
      if (keys.length > 0) {
        await this.redisClient.del(...keys);
      }
    } catch (error) {
      console.error('Redis reset all error:', error);
      super.resetAll();
    }
  }
}

/**
 * Token Bucket Rate Limiter (alternative algorithm)
 */
export class TokenBucketRateLimiter {
  private buckets: LRUCache<string, { tokens: number; lastRefill: number }>;
  private tokensPerInterval: number;
  private interval: number;
  private bucketSize: number;

  constructor(config: {
    tokensPerInterval: number;
    interval: number;
    bucketSize: number;
  }) {
    this.tokensPerInterval = config.tokensPerInterval;
    this.interval = config.interval;
    this.bucketSize = config.bucketSize;

    this.buckets = new LRUCache({
      max: 10000,
      ttl: config.interval * 2
    });
  }

  async checkLimit(identifier: string, tokensRequired: number = 1): Promise<boolean> {
    const now = Date.now();
    let bucket = this.buckets.get(identifier);

    if (!bucket) {
      bucket = {
        tokens: this.bucketSize,
        lastRefill: now
      };
    }

    // Calculate tokens to add based on time elapsed
    const timeSinceRefill = now - bucket.lastRefill;
    const tokensToAdd = Math.floor(timeSinceRefill / this.interval) * this.tokensPerInterval;

    if (tokensToAdd > 0) {
      bucket.tokens = Math.min(this.bucketSize, bucket.tokens + tokensToAdd);
      bucket.lastRefill = now;
    }

    if (bucket.tokens >= tokensRequired) {
      bucket.tokens -= tokensRequired;
      this.buckets.set(identifier, bucket);
      return true;
    }

    this.buckets.set(identifier, bucket);
    return false;
  }

  getRemainingTokens(identifier: string): number {
    const bucket = this.buckets.get(identifier);
    return bucket ? bucket.tokens : this.bucketSize;
  }
}