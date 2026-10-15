import { Router } from 'express';
import { createHealthController } from '../controllers/health.controller.js';
import { createHealthRepository } from '../repositories/health.repository.js';
import { createHealthService } from '../services/health.service.js';

// Rotas: só ligam "método + caminho" ao controller. É aqui que as camadas são
// montadas, de baixo para cima: pool -> repository -> service -> controller.
export function createHealthRoutes({ pool }) {
  const repository = createHealthRepository(pool);
  const service = createHealthService(repository);
  const controller = createHealthController(service);

  const router = Router();
  router.get('/', controller.live); // GET /api/health      -> a API está de pé?
  router.get('/db', controller.database); // GET /api/health/db  -> o MySQL responde?
  return router;
}
