import { AppError } from '../errors/AppError.js';

// Usa a identidade validada pelo middleware JWT. O fallback para query/body fica
// apenas para testes/compatibilidade; em requisições autenticadas, req.user tem prioridade.

export function professorContext(req, res, next) {
  const raw = req.user?.id ?? req.query.professor_id ?? req.body?.professor_id;
  const professorId = Number(raw);
  if (raw === undefined || raw === '' || !Number.isInteger(professorId) || professorId <= 0) {
    throw AppError.unauthorized('Professor não identificado.');
  }
  req.professorId = professorId;
  next();
}
