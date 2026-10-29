import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { errorHandler } from './middlewares/errorHandler.js';
import { notFound } from './middlewares/notFound.js';
import { requestLogger } from './middlewares/requestLogger.js';
import { createRoutes } from './routes/index.js';
import { createAuthRoutes } from './routes/auth.routes.js';
import { createApiAuthMiddleware } from './middlewares/apiAuth.js';

// Monta a aplicação Express. Recebe o pool pronto (em vez de criá-lo aqui)
// para os testes poderem trocar o banco real por um falso.
export function createApp({ pool, config }) {
  const app = express();

  app.use(helmet()); // cabeçalhos de segurança
  // só o front autorizado pode chamar a API; Content-Disposition liberado para o front ler o nome dos arquivos baixados
  app.use(cors({ origin: config.corsOrigins, exposedHeaders: ['Content-Disposition'] }));
  app.use(express.json({ limit: '1mb' }));
  if (config.nodeEnv !== 'test') app.use(requestLogger);

  // A autenticação fica antes das rotas de negócio; health e endpoints de entrada são públicos.
  app.use('/api', createApiAuthMiddleware({ pool, config }));
  app.use('/api/auth', createAuthRoutes({ pool, config }));
  app.use('/api', createRoutes({ pool }));

  app.use(notFound);
  app.use(errorHandler); // sempre por último

  return app;
}