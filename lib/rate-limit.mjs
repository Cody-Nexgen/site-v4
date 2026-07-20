const STORE_KEY = Symbol.for('focuznow.rate-limit.store');
const MAX_BUCKETS = 10_000;

const buckets = globalThis[STORE_KEY] || new Map();
globalThis[STORE_KEY] = buckets;

const getClientKey = (request) => {
  const direct = request.headers.get('x-real-ip')?.trim();
  const forwarded = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  return (direct || forwarded || 'anonymous').slice(0, 128);
};

const consume = (key, limit, windowMs, now) => {
  const cutoff = now - windowMs;
  const recent = (buckets.get(key) || []).filter((timestamp) => timestamp > cutoff);
  const limited = recent.length >= limit;

  if (!limited) recent.push(now);
  buckets.set(key, recent);

  const oldest = recent[0] || now;
  const resetAt = oldest + windowMs;
  return {
    limited,
    limit,
    remaining: Math.max(0, limit - recent.length),
    resetAt,
    retryAfter: Math.max(1, Math.ceil((resetAt - now) / 1000)),
    windowSeconds: Math.ceil(windowMs / 1000),
  };
};

const pruneBuckets = (now, longestWindowMs) => {
  if (buckets.size <= MAX_BUCKETS) return;
  const cutoff = now - longestWindowMs;
  for (const [key, timestamps] of buckets) {
    if (!timestamps.some((timestamp) => timestamp > cutoff)) buckets.delete(key);
  }
  if (buckets.size > MAX_BUCKETS) {
    const overflow = buckets.size - MAX_BUCKETS;
    let removed = 0;
    for (const key of buckets.keys()) {
      buckets.delete(key);
      removed += 1;
      if (removed >= overflow) break;
    }
  }
};

export const checkRateLimits = (request, { namespace, policies }) => {
  const now = Date.now();
  const clientKey = getClientKey(request);
  const results = policies.map(({ limit, windowMs }) =>
    consume(`${namespace}:${windowMs}:${clientKey}`, limit, windowMs, now));
  const rejected = results.filter((result) => result.limited).sort((a, b) => b.retryAfter - a.retryAfter)[0];
  const primary = results[0];

  pruneBuckets(now, Math.max(...policies.map(({ windowMs }) => windowMs)));

  const headers = {
    'RateLimit-Limit': String(primary.limit),
    'RateLimit-Remaining': String(primary.remaining),
    'RateLimit-Reset': String(primary.retryAfter),
    'RateLimit-Policy': policies.map(({ limit, windowMs }) => `${limit};w=${Math.ceil(windowMs / 1000)}`).join(', '),
  };

  if (rejected) headers['Retry-After'] = String(rejected.retryAfter);

  return {
    limited: Boolean(rejected),
    retryAfter: rejected?.retryAfter || 0,
    headers,
  };
};

export const AI_COACH_RATE_LIMITS = [
  { limit: 10, windowMs: 60_000 },
  { limit: 60, windowMs: 60 * 60_000 },
];
