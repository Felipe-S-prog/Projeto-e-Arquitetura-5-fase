// Erro "esperado" da aplicação, com o status HTTP que deve ser devolvido.
// Lance de qualquer camada (normalmente do service):
//   throw AppError.notFound('Questão não encontrada');
// O middleware errorHandler transforma em resposta JSON padronizada.
export class AppError extends Error {
  constructor(statusCode, code, message, details) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }

  static badRequest(message, details) {
    return new AppError(400, 'BAD_REQUEST', message, details);
  }

  static unauthorized(message = 'Não autenticado.') {
    return new AppError(401, 'UNAUTHORIZED', message);
  }

  static forbidden(message = 'Sem permissão para esta ação.') {
    return new AppError(403, 'FORBIDDEN', message);
  }

  static notFound(message = 'Registro não encontrado.') {
    return new AppError(404, 'NOT_FOUND', message);
  }

  static conflict(message, details) {
    return new AppError(409, 'CONFLICT', message, details);
  }
}
