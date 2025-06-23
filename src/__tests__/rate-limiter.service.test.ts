import { RateLimiterService } from '../services/rate-limiter.service';
import { MemoryStorageAdapter } from '../adapters/memory-storage.adapter';

describe('RateLimiterService', () => {
  let rateLimiterService: RateLimiterService;
  let storageAdapter: MemoryStorageAdapter;

  beforeEach(async () => {
    storageAdapter = new MemoryStorageAdapter();
    await storageAdapter.initialize();
    
    rateLimiterService = new RateLimiterService(storageAdapter);
  });

  afterEach(async () => {
    await storageAdapter.close();
  });

  describe('rate limit checking', () => {
    it('should allow requests within limit', async () => {
      const options = {
        maxRequests: 5,
        windowMs: 60000,
      };

      // First few requests should be allowed
      for (let i = 0; i < 5; i++) {
        const result = await rateLimiterService.checkRateLimit('test-key', options);
        expect(result.allowed).toBe(true);
        expect(result.count).toBe(i + 1);
        expect(result.remaining).toBe(4 - i);
      }
    });

    it('should block requests exceeding limit', async () => {
      const options = {
        maxRequests: 2,
        windowMs: 60000,
      };

      // First two requests should be allowed
      await rateLimiterService.checkRateLimit('blocked-key', options);
      await rateLimiterService.checkRateLimit('blocked-key', options);

      // Third request should be blocked
      const result = await rateLimiterService.checkRateLimit('blocked-key', options);
      expect(result.allowed).toBe(false);
      expect(result.count).toBe(2);
      expect(result.remaining).toBe(0);
      expect(typeof result.resetTime).toBe('number');
      expect(result.resetTime).toBeGreaterThan(0);
    });

    it('should handle different keys independently', async () => {
      const options = {
        maxRequests: 1,
        windowMs: 60000,
      };

      // Use up limit for key1
      const result1 = await rateLimiterService.checkRateLimit('key1', options);
      expect(result1.allowed).toBe(true);

      const blocked1 = await rateLimiterService.checkRateLimit('key1', options);
      expect(blocked1.allowed).toBe(false);

      // key2 should still be allowed
      const result2 = await rateLimiterService.checkRateLimit('key2', options);
      expect(result2.allowed).toBe(true);
    });

    it('should reset after window expires', async () => {
      const options = {
        maxRequests: 1,
        windowMs: 100, // Very short window for testing
      };

      // Use up the limit
      const first = await rateLimiterService.checkRateLimit('reset-key', options);
      expect(first.allowed).toBe(true);

      const blocked = await rateLimiterService.checkRateLimit('reset-key', options);
      expect(blocked.allowed).toBe(false);

      // Wait for window to expire
      await new Promise(resolve => setTimeout(resolve, 150));

      // Should be allowed again
      const afterReset = await rateLimiterService.checkRateLimit('reset-key', options);
      expect(afterReset.allowed).toBe(true);
      expect(afterReset.count).toBe(1);
      expect(afterReset.remaining).toBe(0);
    });
  });

  describe('rate limit increment', () => {
    it('should increment counter', async () => {
      const options = {
        maxRequests: 5,
        windowMs: 60000,
      };

      await rateLimiterService.checkRateLimit('increment-key', options);
      await rateLimiterService.checkRateLimit('increment-key', options);

      const result = await rateLimiterService.checkRateLimit('increment-key', options);
      expect(result.count).toBe(3); // 3 checks total
    });

    it('should handle first check', async () => {
      const options = {
        maxRequests: 3,
        windowMs: 60000,
      };

      const result = await rateLimiterService.checkRateLimit('new-key', options);
      expect(result.count).toBe(1); // First check
      expect(result.allowed).toBe(true);
    });
  });

  describe('rate limit reset', () => {
    it('should reset rate limit', async () => {
      const options = {
        maxRequests: 2,
        windowMs: 60000,
      };

      // Use up the limit
      await rateLimiterService.checkRateLimit('reset-test-key', options);
      await rateLimiterService.checkRateLimit('reset-test-key', options);

      const blocked = await rateLimiterService.checkRateLimit('reset-test-key', options);
      expect(blocked.allowed).toBe(false);

      // Reset rate limit
      await rateLimiterService.resetRateLimit('reset-test-key');

      // Status should be null after reset (deleted)
      let status = await rateLimiterService.getRateLimitStatus('reset-test-key', options);
      expect(status).toBeNull();
    });

    it('should handle reset of non-existent key', async () => {
      await expect(
        rateLimiterService.resetRateLimit('non-existent-key')
      ).resolves.not.toThrow();
    });
  });

  describe('rate limit status', () => {
    it('should get rate limit status', async () => {
      const options = {
        maxRequests: 3,
        windowMs: 60000,
      };

      // Initial status should be null (no active rate limit)
      let status = await rateLimiterService.getRateLimitStatus('status-key', options);
      expect(status).toBeNull();

      // Create a rate limit
      await rateLimiterService.checkRateLimit('status-key', options);
      await rateLimiterService.checkRateLimit('status-key', options);

      // Now check status
      status = await rateLimiterService.getRateLimitStatus('status-key', options);
      expect(status).not.toBeNull();
      expect(status!.count).toBe(2);
      expect(status!.remaining).toBe(1);
      expect(status!.allowed).toBe(true);
      expect(typeof status!.resetTime).toBe('number');
    });

    it('should return zero status for non-existent key', async () => {
      const options = {
        maxRequests: 5,
        windowMs: 60000,
      };

      const status = await rateLimiterService.getRateLimitStatus('missing-key', options);
      expect(status).toBeNull();
    });
  });

  describe('key generation', () => {
    it('should generate keys correctly', async () => {
      const key1 = RateLimiterService.createQueueKey('test-queue');
      const key2 = RateLimiterService.createUserKey('user-123', 'custom-id');
      const key3 = RateLimiterService.createQueueKey('other-queue');

      expect(key1).toBe('queue:test-queue');
      expect(key2).toBe('user:user-123:custom-id');
      expect(key3).toBe('queue:other-queue');

      expect(key1).not.toBe(key2);
      expect(key1).not.toBe(key3);
    });

    it('should handle special characters in keys', async () => {
      const key = RateLimiterService.createQueueKey('queue-with.special:characters');
      expect(key).toBe('queue:queue-with.special:characters');
    });
  });

  describe('concurrent access', () => {
    it('should handle concurrent rate limit checks', async () => {
      const options = {
        maxRequests: 5,
        windowMs: 60000,
      };

      // Make many concurrent requests
      const promises = Array.from({ length: 10 }, (_, i) =>
        rateLimiterService.checkRateLimit('concurrent-key', options)
      );

      const results = await Promise.all(promises);

      // Count allowed and blocked requests
      const allowed = results.filter(r => r.allowed);
      const blocked = results.filter(r => !r.allowed);

      expect(allowed).toHaveLength(5);
      expect(blocked).toHaveLength(5);

      // The last allowed request should have the highest count
      const sortedAllowed = allowed.sort((a, b) => b.count - a.count);
      const lastAllowed = sortedAllowed[0];
      expect(lastAllowed.count).toBe(5);
      expect(lastAllowed.remaining).toBe(0);
    });
  });

  describe('window management', () => {
    it('should handle overlapping windows', async () => {
      const options = {
        maxRequests: 2,
        windowMs: 200,
      };

      // First window
      await rateLimiterService.checkRateLimit('window-key', options);
      await rateLimiterService.checkRateLimit('window-key', options);

      // Should be blocked
      const blocked = await rateLimiterService.checkRateLimit('window-key', options);
      expect(blocked.allowed).toBe(false);

      // Wait for partial window expiry
      await new Promise(resolve => setTimeout(resolve, 100));

      // Still should be blocked (window hasn't fully expired)
      const stillBlocked = await rateLimiterService.checkRateLimit('window-key', options);
      expect(stillBlocked.allowed).toBe(false);

      // Wait for full window expiry
      await new Promise(resolve => setTimeout(resolve, 150));

      // Should be allowed again
      const allowed = await rateLimiterService.checkRateLimit('window-key', options);
      expect(allowed.allowed).toBe(true);
    });
  });

  describe('edge cases', () => {
    it('should handle zero max requests', async () => {
      const options = {
        maxRequests: 0,
        windowMs: 60000,
      };

      const result = await rateLimiterService.checkRateLimit('zero-limit-key', options);
      expect(result.allowed).toBe(false);
      expect(result.count).toBe(0);
      expect(result.remaining).toBe(0);
    });

    it('should handle very large max requests', async () => {
      const options = {
        maxRequests: 1000000,
        windowMs: 60000,
      };

      const result = await rateLimiterService.checkRateLimit('large-limit-key', options);
      expect(result.allowed).toBe(true);
      expect(result.count).toBe(1);
      expect(result.remaining).toBe(999999);
    });

    it('should handle very short windows', async () => {
      const options = {
        maxRequests: 1,
        windowMs: 1, // 1ms window
      };

      const result1 = await rateLimiterService.checkRateLimit('short-window-key', options);
      expect(result1.allowed).toBe(true);

      // Wait for window to expire
      await new Promise(resolve => setTimeout(resolve, 10));

      const result2 = await rateLimiterService.checkRateLimit('short-window-key', options);
      expect(result2.allowed).toBe(true);
      expect(result2.count).toBe(1);
    });
  });

  describe('storage adapter integration', () => {
    it('should work with different storage adapters', async () => {
      // This test verifies that the service works with the storage adapter interface
      const options = {
        maxRequests: 3,
        windowMs: 60000,
      };

      // Verify storage operations work correctly
      const result = await rateLimiterService.checkRateLimit('storage-test-key', options);
      expect(result.allowed).toBe(true);

      // Verify data persists in storage
      const status = await rateLimiterService.getRateLimitStatus('storage-test-key', options);
      expect(status!.count).toBe(1);
    });

    it('should handle storage adapter errors gracefully', async () => {
      // Mock storage adapter to throw errors
      const errorAdapter = {
        ...storageAdapter,
        incrementRateLimit: jest.fn().mockRejectedValue(new Error('Storage error')),
      };

      const errorService = new RateLimiterService(errorAdapter as any);

      await expect(
        errorService.checkRateLimit('error-key', { maxRequests: 1, windowMs: 1000 })
      ).rejects.toThrow('Storage error');
    });
  });
});
