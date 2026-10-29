import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { fileURLToPath } from 'node:url';
import { errorHandler } from './middlewares/errorHandler.js';
import { notFound } from './middlewares/notFound.js';
import { requestLogger } from './middlewares/requestLogger.js';
import { createRoutes } from './routes/index.js';
import { createAuthRoutes } from './routes/auth.routes.js';
import { createApiAuthMiddleware } from './middlewares/apiAuth.js';

// Monta a aplica├º├úo Express. Recebe o pool pronto (em vez de cri├í-lo aqui)
// para os testes poderem trocar o banco real por um falso.
export function createApp({ pool, config }) {
  const app = express();

  app.use(helmet()); // cabeçalhos de segurança
  // só o front autorizado pode chamar a API; Content-Disposition liberado para o front ler o nome dos arquivos baixados
  // e X-Pdf-* para mostrar as páginas e os avisos do PDF consolidado (T25)
  app.use(cors({ origin: config.corsOrigins, exposedHeaders: ['Content-Disposition', 'X-Pdf-Paginas', 'X-Pdf-Avisos'] }));
  app.use(express.json({ limit: '1mb' }));
    // Disponibiliza as imagens das questões para o frontend.
  app.use(
    '/uploads/questoes',
    (req, res, next) => {
      res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
      next();
    },
    express.static(
      fileURLToPath(
        new URL('../uploads/questoes/', import.meta.url),
      ),
      {
        dotfiles: 'deny',
        index: false,
        maxAge: '1d',
      },
    ),
  );
  if (config.nodeEnv !== 'test') app.use(requestLogger);

  // A autentica├º├úo fica antes das rotas de neg├│cio; health e endpoints de entrada s├úo p├║blicos.
  app.use('/api', createApiAuthMiddleware({ pool, config }));
  app.use('/api/auth', createAuthRoutes({ pool, config }));
  app.use('/api', createRoutes({ pool }));

  app.use(notFound);
  app.use(errorHandler); // sempre por ├║ltimo

  return app;
}