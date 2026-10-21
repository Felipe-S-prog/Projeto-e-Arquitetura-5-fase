import { Router } from 'express';
import { createCorrecaoRoutes } from './correcao.routes.js';
import { createHealthRoutes } from './health.routes.js';

// Todas as rotas da API ficam sob /api (montado em app.js).
// Cada frente registra aqui o seu recurso, por exemplo:
//   router.use('/questoes', createQuestionRoutes({ pool }));
export function createRoutes({ pool }) {
  const router = Router();
  router.use('/health', createHealthRoutes({ pool }));
  router.use('/correcoes', createCorrecaoRoutes({ pool }));
  return router;
}
