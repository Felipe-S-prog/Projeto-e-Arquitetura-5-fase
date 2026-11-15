import { AppError } from '../errors/AppError.js';

export function createMeService(repository) {
  return {
    async anonymizeAccount(userId) {
      const id = Number(userId);
      if (!Number.isInteger(id) || id <= 0) {
        throw AppError.unauthorized('Sessão inválida. Entre novamente.');
      }

      const anonymized = await repository.anonymizeAccount(id);
      if (!anonymized) {
        throw AppError.unauthorized('A conta não está ativa ou já foi anonimizada.');
      }

      return { message: 'Conta anonimizada. Todas as sessões foram encerradas.' };
    },
  };
}
