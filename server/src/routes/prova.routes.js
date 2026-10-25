import { Router } from 'express';
import { createProvaController } from '../controllers/prova.controller.js';
import { professorContext } from '../middlewares/professorContext.js';
import { createProvaRepository } from '../repositories/prova.repository.js';
import { createProvaService } from '../services/prova.service.js';

// Provas (T17). Montagem: pool -> repository -> service -> controller.
export function createProvaRoutes({ pool }) {
  const controller = createProvaController(createProvaService(createProvaRepository(pool)));

  const router = Router();
  router.use(professorContext);
  router.get('/', controller.listar); // GET /api/provas -> provas do professor, com as questões e pontuações
  router.post('/', controller.criar); // POST /api/provas -> cria em Rascunho
  router.get('/:id', controller.buscar); // GET /api/provas/:id
  router.put('/:id', controller.atualizar); // PUT /api/provas/:id -> edita título, descrição e questões (só Rascunho)
  router.post('/:id/arquivar', controller.arquivar); // POST /api/provas/:id/arquivar -> arquivamento manual
  return router;
}
