import { Router } from 'express';
import { createMeController } from '../controllers/me.controller.js';
import { createMeRepository } from '../repositories/me.repository.js';
import { createMeService } from '../services/me.service.js';

export function createMeRoutes({ pool }) {
  const router = Router();
  const repository = createMeRepository(pool);
  const service = createMeService(repository);
  const controller = createMeController(service);

  router.post('/anonymize', controller.anonymize);

  return router;
}
