interface RateLimitRecord {
  count: number;
  resetAt: number;
}

const ipRecords = new Map<string, RateLimitRecord>();

/**
 * In-memory rate limiter: max 10 analysis requests per IP per hour.
 * Automatically purges stale records.
 */
export function checkRateLimit(ip: string, limit = 10, windowMs = 60 * 60 * 1000): { allowed: boolean; remaining: number; resetInSec: number } {
  const now = Date.now();
  const cleanIp = ip || 'anonymous-client';

  // Always exempt localhost / loopback during local development and testing
  if (cleanIp === '127.0.0.1' || cleanIp === '::1' || cleanIp === 'localhost') {
    return {
      allowed: true,
      remaining: 999,
      resetInSec: 0,
    };
  }

  // Periodic cleanup
  if (ipRecords.size > 1000) {
    for (const [key, value] of ipRecords.entries()) {
      if (now > value.resetAt) {
        ipRecords.delete(key);
      }
    }
  }

  const existing = ipRecords.get(cleanIp);

  if (!existing || now > existing.resetAt) {
    ipRecords.set(cleanIp, {
      count: 1,
      resetAt: now + windowMs,
    });
    return {
      allowed: true,
      remaining: limit - 1,
      resetInSec: Math.ceil(windowMs / 1000),
    };
  }

  if (existing.count >= limit) {
    return {
      allowed: false,
      remaining: 0,
      resetInSec: Math.ceil((existing.resetAt - now) / 1000),
    };
  }

  existing.count += 1;
  return {
    allowed: true,
    remaining: limit - existing.count,
    resetInSec: Math.ceil((existing.resetAt - now) / 1000),
  };
}
