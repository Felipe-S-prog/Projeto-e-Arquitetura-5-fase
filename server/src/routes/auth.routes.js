
import { Router } from 'express';
import { createAuthController } from '../controllers/auth.controller.js';
import { createAuthRepository } from '../repositories/auth.repository.js';
import { createAuthService } from '../services/auth.service.js';

export function createAuthRoutes({ pool, config }) {
  const router = Router();
  const repository = createAuthRepository(pool);
  const service = createAuthService(repository, config);
  const controller = createAuthController(service);

  router.get('/bootstrap-status', controller.bootstrapStatus);
  router.post('/bootstrap-admin', controller.bootstrapAdministrator);
  router.post('/register', controller.register);
  router.post('/login', controller.login);
  router.post('/refresh', controller.refresh);
  router.get('/session', controller.session);
  router.post('/logout', controller.logout);
  router.post('/logout-all', controller.logoutAll);

  return router;
}
