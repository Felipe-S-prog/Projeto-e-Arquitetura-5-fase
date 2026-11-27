import { Router } from 'express';
import { professorContext } from '../middlewares/professorContext.js';
import { createQuestoesService } from '../services/questoes.service.js';

export function createQuestoesRoutes({ pool }) {
  const router = Router();
  router.use(professorContext);
  const service = createQuestoesService({ pool });

  router.get('/', async (req, res) => {
    res.json(await service.listar(req.professorId));
  });

  router.post('/', async (req, res) => {
    res.status(201).json(await service.criar(req.professorId, req.body));
  });

  router.put('/:id', async (req, res) => {
    res.json(await service.editar(req.params.id, req.professorId, req.body));
  });

  router.delete('/:id', async (req, res) => {
    await service.excluir(req.params.id, req.professorId);
    res.status(204).end();
  });

  return router;
}
