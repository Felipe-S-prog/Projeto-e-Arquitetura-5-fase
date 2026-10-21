import { Router } from 'express';
import { createCorrecaoController } from '../controllers/correcao.controller.js';
import { professorContext } from '../middlewares/professorContext.js';
import { createCorrecaoRepository } from '../repositories/correcao.repository.js';
import { createCorrecaoService } from '../services/correcao.service.js';

// Correção e Notas (T29, T30 e T31). Montagem: pool -> repository -> service -> controller.
export function createCorrecaoRoutes({ pool }) {
  const controller = createCorrecaoController(createCorrecaoService(createCorrecaoRepository(pool)));

  const router = Router();
  router.use(professorContext);
  router.get('/copias/:codigo', controller.buscarCopia); // GET /api/correcoes/copias/:codigo -> cópia lida no QR, pronta para corrigir
  router.post('/', controller.corrigir); // POST /api/correcoes -> correção automática pelas respostas
  router.post('/manual', controller.lancarManual); // POST /api/correcoes/manual -> lançamento manual da nota
  router.get('/:id', controller.buscar); // GET /api/correcoes/:id -> correção com as respostas
  router.delete('/:id', controller.remover); // DELETE /api/correcoes/:id -> desfaz a correção
  return router;
}
