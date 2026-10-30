import { Router } from 'express';
import { createCorrecaoRoutes } from './correcao.routes.js';
import { createHealthRoutes } from './health.routes.js';
import { createAplicacaoRoutes } from './aplicacao.routes.js';
import { createCopiaRoutes, createCopiasDaAplicacaoRoutes } from './copia.routes.js';
import { createPdfRoutes } from './pdf.routes.js';
import { createAlunoHistoricoRoutes, createRelatorioRoutes } from './relatorio.routes.js';
import { createAdminRoutes } from './admin.routes.js';
import { createSettingsRoutes } from './settings.routes.js';
import { createProvaRoutes } from './prova.routes.js';
import { createTurmasRoutes } from './turmas.routes.js';
import { createQuestoesRoutes } from './questoes.routes.js';

export function createRoutes({ pool }) {
  const router = Router();

  router.use('/health', createHealthRoutes({ pool }));
  router.use('/aplicacoes/:aplicacaoId/copias', createCopiasDaAplicacaoRoutes({ pool }));
  router.use('/aplicacoes/:aplicacaoId/pdf', createPdfRoutes({ pool }));
  router.use('/aplicacoes', createAplicacaoRoutes({ pool }));
  router.use('/copias', createCopiaRoutes({ pool }));
  router.use('/correcoes', createCorrecaoRoutes({ pool }));
  router.use('/relatorios', createRelatorioRoutes({ pool }));
  router.use('/alunos', createAlunoHistoricoRoutes({ pool }));
  router.use('/admin', createAdminRoutes({ pool }));
  router.use('/settings', createSettingsRoutes({ pool }));
  router.use('/turmas', createTurmasRoutes({ pool }));
  router.use('/questoes', createQuestoesRoutes({ pool }));
  router.use('/provas', createProvaRoutes({ pool }));

  return router;
}
