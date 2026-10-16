import { toDatabasePing } from '../models/health.model.js';

// Repository: ÚNICA camada que escreve SQL. Recebe o pool pronto (injetado em
// routes/health.routes.js) e devolve objetos do model, nunca linhas cruas.
export function createHealthRepository(pool) {
  return {
    async pingDatabase() {
      const [rows] = await pool.query('SELECT DATABASE() AS db, NOW(3) AS now');
      return toDatabasePing(rows[0]);
    },
  };
}
