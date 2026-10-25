
export function createSettingsRepository(pool) {
  return {
    async get() {
      const [rows] = await pool.query(
        `SELECT nome_instituicao AS institutionName,
                periodo_padrao AS defaultPeriod
         FROM configuracoes
         WHERE id = 1`
      );

      return rows[0] ?? null;
    },

    async update(settings) {
      await pool.query(
        `INSERT INTO configuracoes
           (id, nome_instituicao, periodo_padrao)
         VALUES (1, ?, ?)
         ON DUPLICATE KEY UPDATE
           nome_instituicao = VALUES(nome_instituicao),
           periodo_padrao = VALUES(periodo_padrao)`,
        [settings.institutionName, settings.defaultPeriod]
      );

      return this.get();
    },
  };
}
