import { Router } from 'express';
import { createPdfController } from '../controllers/pdf.controller.js';
import { professorContext } from '../middlewares/professorContext.js';
import { createCopiaRepository } from '../repositories/copia.repository.js';
import { createPdfRepository } from '../repositories/pdf.repository.js';
import { createPdfService } from '../services/pdf.service.js';

// PDF consolidado (T25). Montagem: pool -> repositories -> service -> controller.
export function createPdfRoutes({ pool }) {
  const service = createPdfService({ pdfRepository: createPdfRepository(pool), copiaRepository: createCopiaRepository(pool) });
  const controller = createPdfController(service);

  const router = Router({ mergeParams: true });
  router.use(professorContext);
  router.get('/', controller.baixar); // GET /api/aplicacoes/:id/pdf?modo=completo|folha-de-resposta&frenteVerso=true
  return router;
}
