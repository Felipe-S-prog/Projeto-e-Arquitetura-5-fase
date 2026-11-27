import { Router } from 'express';
import { professorContext } from '../middlewares/professorContext.js';
import { createTurmasService } from '../services/turmas.service.js';
import { createMatriculasService } from '../services/matriculas.service.js';

export function createTurmasRoutes({ pool }) {
  const router = Router();
  router.use(professorContext);
  const service = createTurmasService({ pool });
  const matriculas = createMatriculasService({ pool });

  router.get('/', async (req, res) => {
    res.json(await service.listar(req.professorId));
  });

  router.post('/', async (req, res) => {
    res.status(201).json(await service.criar(req.professorId, req.body));
  });

  router.post('/:id/matriculas', async (req, res) => {
    res.status(201).json(await matriculas.matricular(req.params.id, req.professorId, req.body));
  });

  router.delete('/:id/matriculas/:alunoId', async (req, res) => {
    res.json(await matriculas.remover(req.params.id, req.professorId, req.params.alunoId));
  });

  router.post('/:id/matriculas/importar', async (req, res) => {
    res.json(await matriculas.importar(req.params.id, req.professorId, req.body?.csv));
  });

  router.put('/:id', async (req, res) => {
    res.json(await service.editar(req.params.id, req.professorId, req.body));
  });

  router.patch('/:id/arquivar', async (req, res) => {
    res.json(await service.arquivar(req.params.id, req.professorId));
  });

  router.delete('/:id', async (req, res) => {
    res.json(await service.excluir(req.params.id, req.professorId));
  });

  return router;
}
