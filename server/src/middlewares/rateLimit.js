export function createRateLimiter({ windowMs, max }) {
  const clients = new Map();
  let requestsUntilCleanup = 0;

  return (req, res, next) => {
    const now = Date.now();
    const forwardedIp = req.get('x-forwarded-for')?.split(',')[0]?.trim();

    const ip = forwardedIp && forwardedIp.length <= 64
      ? forwardedIp
      : req.ip || req.socket.remoteAddress || 'unknown';

    requestsUntilCleanup += 1;

    if (requestsUntilCleanup >= 100) {
      for (const [key, bucket] of clients) {
        if (bucket.resetAt <= now) clients.delete(key);
      }

      requestsUntilCleanup = 0;
    }

    let bucket = clients.get(ip);

    if (!bucket || bucket.resetAt <= now) {
      bucket = { count: 0, resetAt: now + windowMs };
    }

    if (bucket.count >= max) {
      const retryAfter = Math.ceil((bucket.resetAt - now) / 1000);

      res.set('Retry-After', String(retryAfter));

      return res.status(429).json({
        error: {
          code: 'RATE_LIMITED',
          message: 'Muitas tentativas. Tente novamente mais tarde.',
        },
      });
    }

    bucket.count += 1;
    clients.set(ip, bucket);

    next();
  };
}
