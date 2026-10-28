import { Router } from 'express';
import { createGabaritoController } from '../controllers/gabarito.controller.js';
import { createGabaritoRepository } from '../repositories/gabarito.repository.js';
import { createGabaritoService } from '../services/gabarito.service.js';

// Consulta pública do gabarito (T26). Montagem: pool -> repository -> service -> controller.
// Rota PÚBLICA de propósito: /gabarito não está nas rotas protegidas do middlewares/apiAuth.js,
// porque quem consulta é o aluno, que não tem conta no sistema (RF03).
export function createGabaritoRoutes({ pool }) {
  const controller = createGabaritoController(createGabaritoService(createGabaritoRepository(pool)));

  const router = Router();
  router.get('/:codigo', controller.consultar); // GET /api/gabarito/:codigo -> letras certas, se publicado
  return router;
}
