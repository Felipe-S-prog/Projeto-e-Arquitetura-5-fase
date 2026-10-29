import { Router } from 'express';
import { createAplicacaoController } from '../controllers/aplicacao.controller.js';
import { professorContext } from '../middlewares/professorContext.js';
import { createAplicacaoRepository } from '../repositories/aplicacao.repository.js';
import { createAplicacaoService } from '../services/aplicacao.service.js';

// Aplicações (T18 e T19). Montagem: pool -> repository -> service -> controller.
export function createAplicacaoRoutes({ pool }) {
  const controller = createAplicacaoController(createAplicacaoService(createAplicacaoRepository(pool)));

  const router = Router();
  router.use(professorContext);
  router.get('/', controller.listar); // GET /api/aplicacoes -> aplicações do professor
  router.post('/', controller.criar); // POST /api/aplicacoes -> liga uma prova a uma turma (Pendente); prova Rascunho vira Pronta
  router.get('/:id', controller.buscar); // GET /api/aplicacoes/:id
  router.put('/:id', controller.atualizar); // PUT /api/aplicacoes/:id -> quantidade e opções de geração (só Pendente)
  router.post('/:id/aplicar', controller.aplicar); // POST /api/aplicacoes/:id/aplicar -> marca como Aplicada (PDF baixado)
  return router;
}
