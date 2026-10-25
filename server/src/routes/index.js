
import { Router } from 'express';
import { createHealthRoutes } from './health.routes.js';
import { createAdminRoutes } from './admin.routes.js';
import { createSettingsRoutes } from './settings.routes.js';
import { createTurmasRoutes } from './turmas.routes.js';

export function createRoutes({ pool }) {
  const router = Router();

  router.use('/health', createHealthRoutes({ pool }));
  router.use('/admin', createAdminRoutes({ pool }));
  router.use('/settings', createSettingsRoutes({ pool }));
  router.use('/turmas', createTurmasRoutes({ pool }));

  return router;
}