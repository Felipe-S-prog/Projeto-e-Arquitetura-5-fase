import { toCopiaDaProva } from '../models/copia.model.js';

// Repository da consulta pública do gabarito (T26): ÚNICA camada com SQL desta frente.
// A consulta é pelo código impresso na cópia, sem login; por isso só lê o necessário para
// montar as letras certas e nunca nota, aluno ou dados do professor.
export function createGabaritoRepository(pool) {
  return {
    async findCopiaPorCodigo(codigo) {
      const [rows] = await pool.query(
        `SELECT cp.id, cp.aplicacao_id, cp.codigo, cp.rotulo, cp.ordem_embaralhamento,
                cp.gabarito_publicado, cp.gabarito_publicado_em, a.prova_id, p.titulo AS prova_titulo
           FROM copia_prova cp
           JOIN aplicacao a ON a.id = cp.aplicacao_id
           JOIN prova p ON p.id = a.prova_id
          WHERE cp.codigo = ?`,
        [codigo]
      );
      if (!rows.length) return null;
      const copia = toCopiaDaProva(rows[0]);
      return { ...copia, provaId: rows[0].prova_id, provaTitulo: rows[0].prova_titulo };
    },

    // Alternativas de cada questão da prova, na ordem original, só com a marcação de correta.
    async listAlternativasDaProva(provaId) {
      const [rows] = await pool.query(
        `SELECT alt.questao_id, alt.correta
           FROM prova_questao pq
           JOIN alternativa alt ON alt.questao_id = pq.questao_id
          WHERE pq.prova_id = ?
          ORDER BY alt.questao_id, alt.ordem`,
        [provaId]
      );
      const porQuestao = new Map();
      for (const r of rows) {
        if (!porQuestao.has(r.questao_id)) porQuestao.set(r.questao_id, []);
        porQuestao.get(r.questao_id).push(Boolean(r.correta));
      }
      return porQuestao;
    },
  };
}
