import { AppError } from '../errors/AppError.js';

// Erros de conexão/credencial do MySQL: para quem chama a API, o banco está indisponível.
const DB_UNAVAILABLE_CODES = new Set([
  'ECONNREFUSED',
  'ECONNRESET',
  'ENOTFOUND',
  'ETIMEDOUT',
  'EHOSTUNREACH',
  'PROTOCOL_CONNECTION_LOST',
  'ER_CON_COUNT_ERROR',
  'ER_ACCESS_DENIED_ERROR',
  'ER_BAD_DB_ERROR',
]);

// Converte qualquer erro em { status, body }. Função pura, fácil de testar.
// Formato de erro de toda a API:  { "error": { "code": "...", "message": "...", "details"?: ... } }
export function toHttpError(err) {
  if (err instanceof AppError) {
    const error = { code: err.code, message: err.message };
    if (err.details !== undefined) error.details = err.details;
    return { status: err.statusCode, body: { error } };
  }

  // Algumas rotas antigas ainda lançam Error com statusCode em vez de AppError.
  if ([400, 401, 403, 404, 409].includes(err?.statusCode)) {
    const code = err.statusCode === 400 ? 'BAD_REQUEST'
      : err.statusCode === 401 ? 'UNAUTHORIZED'
        : err.statusCode === 403 ? 'FORBIDDEN'
          : err.statusCode === 404 ? 'NOT_FOUND' : 'CONFLICT';
    return { status: err.statusCode, body: { error: { code, message: err.message || 'A requisição não pôde ser concluída.' } } };
  }

  // Erros do leitor de JSON do Express
  if (err?.type === 'entity.parse.failed') {
    return { status: 400, body: { error: { code: 'INVALID_JSON', message: 'O corpo da requisição não é um JSON válido.' } } };
  }
  if (err?.type === 'entity.too.large') {
    return { status: 413, body: { error: { code: 'PAYLOAD_TOO_LARGE', message: 'O corpo da requisição é grande demais.' } } };
  }

  // Erros do MySQL que acontecem em CRUD comum, para ninguém precisar tratar um por um
  switch (err?.code) {
    case 'ER_DUP_ENTRY': // valor repetido em coluna UNIQUE (ex.: e-mail já cadastrado)
      return { status: 409, body: { error: { code: 'DUPLICATE_ENTRY', message: 'Já existe um registro com esse valor.' } } };
    case 'ER_NO_REFERENCED_ROW_2': // chave estrangeira apontando para algo que não existe
      return { status: 409, body: { error: { code: 'REFERENCE_NOT_FOUND', message: 'O registro relacionado não existe.' } } };
    case 'ER_ROW_IS_REFERENCED_2': // tentou apagar algo que ainda é usado por outro registro
      return { status: 409, body: { error: { code: 'IN_USE', message: 'O registro está em uso e não pode ser removido.' } } };
    default:
      break;
  }

  if (DB_UNAVAILABLE_CODES.has(err?.code)) {
    return { status: 503, body: { error: { code: 'DB_UNAVAILABLE', message: 'Banco de dados indisponível.' } } };
  }

  // Qualquer outra coisa é bug nosso: não vaza detalhe interno para quem chamou.
  return { status: 500, body: { error: { code: 'INTERNAL_ERROR', message: 'Erro interno do servidor.' } } };
}

// O Express reconhece middleware de erro pelos 4 parâmetros (não remova o "next").
// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  if (res.headersSent) return next(err);
  const { status, body } = toHttpError(err);
  // Mostra no terminal o erro verdadeiro quando é 5xx (o cliente só recebe a versão segura).
  if (status >= 500) console.error(`[${req.method} ${req.originalUrl}]`, err);
  res.status(status).json(body);
}
