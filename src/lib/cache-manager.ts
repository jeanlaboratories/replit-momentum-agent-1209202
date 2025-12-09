/**
 * Performance Optimization: Simple In-Memory Cache Manager
 *
 * This provides a lightweight caching layer for expensive operations.
 * For production, consider replacing with Redis or Memcache.
 */

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

class CacheManager {
  private cache: Map<string, CacheEntry<any>>;
  private cleanupInterval: NodeJS.Timeout | null;

  constructor() {
    this.cache = new Map();
    this.cleanupInterval = null;

    // Clean up expired entries every 60 seconds
    if (typeof setInterval !== 'undefined') {
      this.cleanupInterval = setInterval(() => {
        this.cleanup();
      }, 60000);
    }
  }

  /**
   * Get value from cache if not expired
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key);

    if (!entry) {
      return null;
    }

    const now = Date.now();
    if (now - entry.timestamp > entry.ttl) {
      // Entry expired, remove it
      this.cache.delete(key);
      return null;
    }

    return entry.data;
  }

  /**
   * Set value in cache with TTL in milliseconds
   */
  set<T>(key: string, data: T, ttl: number): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl,
    });
  }

  /**
   * Check if key exists and is not expired
   */
  has(key: string): boolean {
    const entry = this.cache.get(key);

    if (!entry) {
      return false;
    }

    const now = Date.now();
    if (now - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return false;
    }

    return true;
  }

  /**
   * Delete specific key from cache
   */
  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Get cache statistics
   */
  getStats() {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys()),
    };
  }

  /**
   * Clean up expired entries
   */
  private cleanup(): void {
    const now = Date.now();
    const keysToDelete: string[] = [];

    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > entry.ttl) {
        keysToDelete.push(key);
      }
    }

    for (const key of keysToDelete) {
      this.cache.delete(key);
    }

    if (keysToDelete.length > 0) {
      console.log(`[Cache] Cleaned up ${keysToDelete.length} expired entries`);
    }
  }

  /**
   * Stop cleanup interval (for graceful shutdown)
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.cache.clear();
  }
}

// Singleton instance
const cacheManager = new CacheManager();

// Export both the class and singleton
export { CacheManager };
export default cacheManager;

/**
 * Helper function to get or set cached value
 *
 * Usage:
 * const result = await getOrSetCache(
 *   'my-key',
 *   async () => expensiveOperation(),
 *   5 * 60 * 1000 // 5 minutes TTL
 * );
 */
export async function getOrSetCache<T>(
  key: string,
  fetchFn: () => Promise<T>,
  ttl: number
): Promise<T> {
  // Try to get from cache first
  const cached = cacheManager.get<T>(key);
  if (cached !== null) {
    console.log(`[Cache] HIT: ${key}`);
    return cached;
  }

  // Cache miss - fetch data
  console.log(`[Cache] MISS: ${key}`);
  const data = await fetchFn();

  // Store in cache
  cacheManager.set(key, data, ttl);

  return data;
}
