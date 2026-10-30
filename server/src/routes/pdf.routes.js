import { Router } from 'express';
import { createPdfController } from '../controllers/pdf.controller.js';
import { professorContext } from '../middlewares/professorContext.js';
import { createCopiaRepository } from '../repositories/copia.repository.js';
import { createPdfRepository } from '../repositories/pdf.repository.js';
import { createPdfService } from '../services/pdf.service.js';

// PDFs da aplicação: provas consolidadas (T25) e gabarito (T27).
// Montagem: pool -> repositories -> service -> controller.
export function createPdfRoutes({ pool }) {
  const service = createPdfService({ pdfRepository: createPdfRepository(pool), copiaRepository: createCopiaRepository(pool) });
  const controller = createPdfController(service);

  const router = Router({ mergeParams: true });
  router.use(professorContext);
  router.get('/', controller.baixar); // GET /api/aplicacoes/:id/pdf?modo=completo|folha-de-resposta&frenteVerso=true
  router.get('/gabarito', controller.baixarGabarito); // GET /api/aplicacoes/:id/pdf/gabarito -> gabarito de todas as cópias
  return router;
}
