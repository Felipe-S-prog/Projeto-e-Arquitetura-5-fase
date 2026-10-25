import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { errorHandler } from './middlewares/errorHandler.js';
import { notFound } from './middlewares/notFound.js';
import { requestLogger } from './middlewares/requestLogger.js';
import { createRoutes } from './routes/index.js';

// Monta a aplicação Express. Recebe o pool pronto (em vez de criá-lo aqui)
// para os testes poderem trocar o banco real por um falso.
export function createApp({ pool, config }) {
  const app = express();

  app.use(helmet()); // cabeçalhos de segurança
  app.use(cors({ origin: config.corsOrigins })); // só o front autorizado pode chamar a API
  app.use(express.json({ limit: '1mb' }));
  if (config.nodeEnv !== 'test') app.use(requestLogger);

  app.use('/api', createRoutes({ pool }));

  app.use(notFound);
  app.use(errorHandler); // sempre por último

  return app;
}
