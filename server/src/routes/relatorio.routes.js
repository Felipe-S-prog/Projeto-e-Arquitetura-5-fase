import { Router } from 'express';
import { createRelatorioController } from '../controllers/relatorio.controller.js';
import { professorContext } from '../middlewares/professorContext.js';
import { createRelatorioRepository } from '../repositories/relatorio.repository.js';
import { createRelatorioService } from '../services/relatorio.service.js';

function createController(pool) {
  return createRelatorioController(createRelatorioService(createRelatorioRepository(pool)));
}

// Relatórios de notas (T32), montados em /api/relatorios.
export function createRelatorioRoutes({ pool }) {
  const controller = createController(pool);

  const router = Router();
  router.use(professorContext);
  router.get('/aplicacoes', controller.listarAplicacoes); // GET /api/relatorios/aplicacoes -> aplicações com resumo das notas
  router.get('/aplicacoes/:id', controller.aplicacao); // GET /api/relatorios/aplicacoes/:id -> notas, estatísticas e acerto por questão
  router.get('/aplicacoes/:id/exportar', controller.exportarAplicacao); // GET /api/relatorios/aplicacoes/:id/exportar?formato=csv|xlsx|pdf
  router.get('/aplicacoes/:id/csv', controller.exportarAplicacao); // GET /api/relatorios/aplicacoes/:id/csv -> mesmo que ?formato=csv
  router.get('/turmas', controller.listarTurmas); // GET /api/relatorios/turmas -> turmas do professor
  router.get('/turmas/:id', controller.turma); // GET /api/relatorios/turmas/:id -> consolidado: alunos x aplicações
  router.get('/turmas/:id/exportar', controller.exportarTurma); // GET /api/relatorios/turmas/:id/exportar?formato=csv|xlsx|pdf
  router.get('/turmas/:id/csv', controller.exportarTurma); // GET /api/relatorios/turmas/:id/csv -> mesmo que ?formato=csv
  router.get('/exportar', controller.exportarConsolidado); // GET /api/relatorios/exportar?formato=csv|xlsx|pdf -> todas as turmas
  return router;
}

// Histórico de notas do aluno (T33), montado em /api/alunos.
export function createAlunoHistoricoRoutes({ pool }) {
  const controller = createController(pool);

  const router = Router();
  router.use(professorContext);
  router.get('/:id/historico', controller.historicoDoAluno); // GET /api/alunos/:id/historico -> notas e desempenho do aluno
  return router;
}
