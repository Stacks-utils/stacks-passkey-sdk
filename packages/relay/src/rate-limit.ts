import type { RelayPolicy } from './types.js';

interface Bucket {
  count: number;
  resetAt: number;
}

export class RateLimiter {
  private buckets = new Map<string, Bucket>();
  private readonly windowMs: number;
  private readonly maxRequests: number;

  constructor(policy: RelayPolicy) {
    this.windowMs = policy.rateLimit.windowMs;
    this.maxRequests = policy.rateLimit.maxRequests;
  }

  check(key: string): boolean {
    const now = Date.now();
    const bucket = this.buckets.get(key);

    if (!bucket || now >= bucket.resetAt) {
      this.buckets.set(key, { count: 1, resetAt: now + this.windowMs });
      return true;
    }

    if (bucket.count >= this.maxRequests) return false;
    bucket.count += 1;
    return true;
  }
}

export function isContractAllowed(contractId: string, policy: RelayPolicy): boolean {
  if (!policy.allowedContracts || policy.allowedContracts.length === 0) return true;
  return policy.allowedContracts.some((allowed) => contractId.startsWith(allowed));
}
