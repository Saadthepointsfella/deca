// In-memory token buckets for dev. Swap to Redis in prod.
type Key = string;
type Bucket = { tokens: number; last: number; ratePerMin: number; burst: number };

const buckets: Map<Key, Bucket> = new Map();

function nowSec() { return Date.now() / 1000; }

export function allow(key: Key, ratePerMin: number, burst?: number): boolean {
  const ratePerSec = ratePerMin / 60;
  const cap = burst ?? ratePerMin;
  const b = buckets.get(key) ?? { tokens: cap, last: nowSec(), ratePerMin, burst: cap };
  const t = nowSec();
  const elapsed = Math.max(0, t - b.last);
  b.tokens = Math.min(cap, b.tokens + elapsed * ratePerSec);
  b.last = t;
  if (b.tokens < 1) { buckets.set(key, b); return false; }
  b.tokens -= 1;
  buckets.set(key, b);
  return true;
}
