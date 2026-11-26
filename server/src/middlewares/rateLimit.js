export function createRateLimiter({ windowMs, max, countOnlyStatus = null }) {
  const clients = new Map();
  let requestsUntilCleanup = 0;

  return (req, res, next) => {
    const now = Date.now();
    const ip = req.ip || req.socket.remoteAddress || 'unknown';

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

    clients.set(ip, bucket);

    if (countOnlyStatus !== null) {
      res.once('finish', () => {
        if (res.statusCode === countOnlyStatus) {
          bucket.count += 1;
        }
      });
    } else {
      bucket.count += 1;
    }

    next();
  };
}