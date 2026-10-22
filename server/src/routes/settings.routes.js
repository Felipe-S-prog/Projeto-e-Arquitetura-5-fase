
import { Router } from 'express';
import { createSettingsRepository } from '../repositories/settings.repository.js';
import { createSettingsService } from '../services/settings.service.js';

export function createSettingsRoutes({ pool }) {
  const router = Router();
  const repository = createSettingsRepository(pool);
  const service = createSettingsService(repository);

  router.get('/', async (req, res, next) => {
    try {
      res.json(await service.getSettings());
    } catch (error) {
      next(error);
    }
  });

  router.put('/', async (req, res, next) => {
    try {
      res.json(await service.updateSettings(req.body));
    } catch (error) {
      next(error);
    }
  });

  return router;
}