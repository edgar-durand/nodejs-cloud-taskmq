import { IStateStorageAdapter } from '../interfaces/storage-adapter.interface';
import { RateLimiterOptions } from '../interfaces/config.interface';

/**
 * Rate limiting result
 */
export interface RateLimitResult {
  /**
   * Whether the request is allowed
   */
  allowed: boolean;

  /**
   * Current request count
   */
  count: number;

  /**
   * Maximum requests allowed
   */
  limit: number;

  /**
   * Time until reset in milliseconds
   */
  resetTime: number;

  /**
   * Remaining requests
   */
  remaining: number;
}

/**
 * Rate limiter service
 */
export class RateLimiterService {
  constructor(private readonly storageAdapter: IStateStorageAdapter) {}

  /**
   * Check and increment rate limit
   */
  async checkRateLimit(key: string, options: RateLimiterOptions): Promise<RateLimitResult> {
    const { maxRequests, windowMs } = options;

    // Handle zero max requests case
    if (maxRequests <= 0) {
      return {
        allowed: false,
        count: 0,
        limit: maxRequests,
        resetTime: windowMs,
        remaining: 0,
      };
    }

    // Use atomic increment operation
    const result = await this.storageAdapter.incrementRateLimit(key, windowMs, maxRequests);
    const now = Date.now();

    return {
      allowed: result.allowed,
      count: result.count,
      limit: maxRequests,
      resetTime: result.resetTime.getTime() - now,
      remaining: Math.max(0, maxRequests - result.count),
    };
  }

  /**
   * Get current rate limit status without incrementing
   */
  async getRateLimitStatus(key: string, options: RateLimiterOptions): Promise<RateLimitResult | null> {
    const { maxRequests } = options;
    const currentLimit = await this.storageAdapter.getRateLimit(key);
    const now = Date.now();

    if (!currentLimit || currentLimit.resetTime.getTime() <= now) {
      return null; // No active rate limit
    }

    return {
      allowed: currentLimit.count < maxRequests,
      count: currentLimit.count,
      limit: maxRequests,
      resetTime: currentLimit.resetTime.getTime() - now,
      remaining: Math.max(0, maxRequests - currentLimit.count),
    };
  }

  /**
   * Reset rate limit for a key
   */
  async resetRateLimit(key: string): Promise<void> {
    if (this.storageAdapter.deleteRateLimit) {
      await this.storageAdapter.deleteRateLimit(key);
    } else {
      // Fallback for adapters that don't support deleteRateLimit
      console.warn('Rate limit reset not directly supported - limit will expire naturally');
    }
  }

  /**
   * Check if a request would be allowed without incrementing the counter
   */
  async wouldAllow(key: string, options: RateLimiterOptions): Promise<boolean> {
    const status = await this.getRateLimitStatus(key, options);
    return status ? status.allowed : true;
  }

  /**
   * Get remaining requests for a key
   */
  async getRemaining(key: string, options: RateLimiterOptions): Promise<number> {
    const status = await this.getRateLimitStatus(key, options);
    return status ? status.remaining : options.maxRequests;
  }

  /**
   * Get time until reset for a key
   */
  async getTimeUntilReset(key: string): Promise<number> {
    const currentLimit = await this.storageAdapter.getRateLimit(key);
    if (!currentLimit) {
      return 0;
    }

    const now = Date.now();
    const resetTime = currentLimit.resetTime.getTime();
    
    return Math.max(0, resetTime - now);
  }

  /**
   * Create a rate limit key based on various parameters
   */
  static createKey(prefix: string, ...parts: string[]): string {
    return [prefix, ...parts].join(':');
  }

  /**
   * Create a rate limit key for IP address
   */
  static createIpKey(ip: string, endpoint?: string): string {
    return endpoint 
      ? RateLimiterService.createKey('ip', ip, endpoint)
      : RateLimiterService.createKey('ip', ip);
  }

  /**
   * Create a rate limit key for user
   */
  static createUserKey(userId: string, endpoint?: string): string {
    return endpoint 
      ? RateLimiterService.createKey('user', userId, endpoint)
      : RateLimiterService.createKey('user', userId);
  }

  /**
   * Create a rate limit key for queue
   */
  static createQueueKey(queueName: string): string {
    return RateLimiterService.createKey('queue', queueName);
  }

  /**
   * Create a rate limit key for processor
   */
  static createProcessorKey(queueName: string, processorName: string): string {
    return RateLimiterService.createKey('processor', queueName, processorName);
  }
}
