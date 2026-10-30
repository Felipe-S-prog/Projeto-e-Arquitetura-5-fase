import { Router } from 'express';
import { createCopiaController } from '../controllers/copia.controller.js';
import { professorContext } from '../middlewares/professorContext.js';
import { createCopiaRepository } from '../repositories/copia.repository.js';
import { createCopiaService } from '../services/copia.service.js';

// Cópias da Prova (T23). Montagem: pool -> repository -> service -> controller.
// Dois routers: a lista geral em /copias e as ações de uma aplicação em /aplicacoes/:aplicacaoId/copias.
function montarController(pool) {
  return createCopiaController(createCopiaService(createCopiaRepository(pool)));
}

export function createCopiaRoutes({ pool }) {
  const controller = montarController(pool);

  const router = Router();
  router.use(professorContext);
  router.get('/', controller.listar); // GET /api/copias -> todas as cópias do professor
  return router;
}

export function createCopiasDaAplicacaoRoutes({ pool }) {
  const controller = montarController(pool);

  const router = Router({ mergeParams: true });
  router.use(professorContext);
  router.get('/', controller.listarDaAplicacao); // GET /api/aplicacoes/:id/copias
  router.post('/', controller.gerar); // POST /api/aplicacoes/:id/copias -> gera (ou regera) as cópias, só Pendente
  router.post('/gabarito', controller.publicarGabarito); // POST /api/aplicacoes/:id/copias/gabarito -> publica uma ({ code }) ou todas
  return router;
}
