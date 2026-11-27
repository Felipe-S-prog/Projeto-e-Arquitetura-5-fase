import { Router } from 'express';
import { createAuthController } from '../controllers/auth.controller.js';
import { createAuthRepository } from '../repositories/auth.repository.js';
import { createAuthService } from '../services/auth.service.js';
import { createRateLimiter } from '../middlewares/rateLimit.js';

export function createAuthRoutes({ pool, config }) {
  const router = Router();
  const repository = createAuthRepository(pool);
  const service = createAuthService(repository, config);
  const controller = createAuthController(service);

  const registerLimiter = createRateLimiter({
    windowMs: 60 * 60 * 1000,
    max: 5,
  });

  const loginLimiter = createRateLimiter({
    windowMs: 15 * 60 * 1000,
    max: 5,
    countOnlyStatus: 401,
  });

  const refreshLimiter = createRateLimiter({
    windowMs: 15 * 60 * 1000,
    max: 30,
  });

  router.post('/register', registerLimiter, controller.register);
  router.post('/login', loginLimiter, controller.login);
  router.post('/refresh', refreshLimiter, controller.refresh);
  router.get('/session', controller.session);
  router.post('/logout', controller.logout);
  router.post('/logout-all', controller.logoutAll);

  return router;
}
