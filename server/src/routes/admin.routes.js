
import { Router } from 'express';
import { createAdminRepository } from '../repositories/admin.repository.js';
import { createAdminService } from '../services/admin.service.js';

export function createAdminRoutes({ pool }) {
  const router = Router();
  const repository = createAdminRepository(pool);
  const service = createAdminService(repository);

  router.get('/usuarios', async (req, res, next) => {
    try {
      res.json(await service.listUsers());
    } catch (error) {
      next(error);
    }
  });

  router.post('/usuarios', async (req, res, next) => {
    try {
      res.status(201).json(await service.createUser(req.body));
    } catch (error) {
      next(error);
    }
  });

  router.put('/usuarios/:id', async (req, res, next) => {
    try {
      const user = await service.updateUser(req.params.id, req.body);

      if (!user) {
        return res.status(404).json({ message: 'Usuário não encontrado.' });
      }

      return res.json(user);
    } catch (error) {
      next(error);
    }
  });

  router.delete('/usuarios/:id', async (req, res, next) => {
    try {
      const removed = await service.removeUser(req.params.id);

      if (!removed) {
        return res.status(404).json({ message: 'Usuário não encontrado.' });
      }

      return res.status(204).end();
    } catch (error) {
      next(error);
    }
  });

  return router;
}
