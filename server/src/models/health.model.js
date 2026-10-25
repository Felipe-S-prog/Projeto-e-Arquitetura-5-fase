import { toCamelCase } from '../utils/case.js';

// Model: representa o dado como a aplicação o enxerga (e não como veio do SQL).
// Aqui converte a linha do banco { db, now } no objeto usado pelo service.
export function toDatabasePing(row) {
  const { db, now } = toCamelCase(row);
  return {
    database: db,
    serverTime: now instanceof Date ? now.toISOString() : String(now),
  };
}
