
export function createSettingsService(repository) {
  return {
    async getSettings() {
      const settings = await repository.get();

      if (!settings) {
        throw new Error('Configurações não encontradas.');
      }

      return settings;
    },

    async updateSettings(input) {
      const institutionName = input?.institutionName?.trim();
      const defaultPeriod = input?.defaultPeriod?.trim();

      if (!institutionName || !defaultPeriod) {
        const error = new Error(
          'Nome da instituição e período padrão são obrigatórios.',
        );
        error.statusCode = 400;
        throw error;
      }

      if (institutionName.length > 255 || defaultPeriod.length > 20) {
        const error = new Error('Um ou mais campos excedem o tamanho permitido.');
        error.statusCode = 400;
        throw error;
      }

      return repository.update({ institutionName, defaultPeriod });
    },
  };
}
