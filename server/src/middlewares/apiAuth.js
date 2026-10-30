import { AppError } from '../errors/AppError.js';
import { verifyAccessToken } from '../utils/jwt.js';

const PUBLIC_PATHS = new Set([
  '/health',
  '/health/db',
  '/auth/bootstrap-status',
  '/auth/bootstrap-admin',
  '/auth/register',
  '/auth/login',
  '/auth/refresh',
  '/turmas/ingresso',
]);

const PROTECTED_PREFIXES = [
  '/admin', '/settings', '/turmas', '/questoes', '/provas',
  '/aplicacoes', '/copias', '/correcoes', '/relatorios', '/alunos',
];

export function createApiAuthMiddleware({ pool, config }) {
  return async (req, res, next) => {
    try {
      const path = req.path.replace(/\/$/, '') || '/';
      if (PUBLIC_PATHS.has(path)) return next();

      const isLogout = path === '/auth/logout';
      const protectedPrefix = PROTECTED_PREFIXES.find(
        (prefix) => path === prefix || path.startsWith(`${prefix}/`),
      );
      if (!isLogout && !protectedPrefix) return next();

      const authorization = req.get('authorization') ?? '';
      const match = authorization.match(/^Bearer\s+(.+)$/i);
      if (!match) throw AppError.unauthorized('Envie um token de acesso no cabeçalho Authorization.');

      const payload = verifyAccessToken(match[1], config.auth.jwtSecret);
      const [rows] = await pool.execute(
        `SELECT id, nome, email, papel, status FROM usuario
         WHERE id = ? AND status = 'ATIVO' LIMIT 1`,
        [Number(payload.sub)],
      );
      const user = rows[0];
      if (!user) throw AppError.unauthorized('A conta não está ativa. Entre novamente.');

      if (!isLogout) {
        const requiredRole = path === '/admin' || path.startsWith('/admin/') ||
          path === '/settings' || path.startsWith('/settings/')
          ? 'ADMINISTRADOR'
          : 'PROFESSOR';
        if (user.papel !== requiredRole) {
          throw AppError.forbidden('Seu papel não permite acessar este recurso.');
        }
      }

      req.user = {
        id: Number(user.id),
        name: user.nome,
        email: user.email,
        papel: user.papel,
        role: user.papel,
      };

      // Compatibilidade temporária com rotas antigas que ainda leem professor_id
      // do body/query. O valor vem do JWT e nunca do que o cliente enviou.
      if (user.papel === 'PROFESSOR') {
        req.professorId = Number(user.id);
        if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
          req.body = {};
        }
        req.body.professor_id = Number(user.id);
        Object.defineProperty(req, 'query', {
          configurable: true,
          enumerable: true,
          writable: true,
          value: { ...req.query, professor_id: String(user.id) },
        });
      }
      next();
    } catch (error) {
      next(error);
    }
  };
}
