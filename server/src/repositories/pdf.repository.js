import { toDateOnly } from '../models/correcao.model.js';

// Repository do PDF consolidado (T25): ÚNICA camada com SQL desta frente.
// Lê o que o PDF imprime: a aplicação (prova, turma e data), as questões da prova com as
// alternativas na ordem original e o nome da instituição. As cópias vêm do repository da T23.
// A aplicação é do professor dono da prova (RNF04).
export function createPdfRepository(pool) {
  return {
    async findAplicacao(aplicacaoId, professorId) {
      const [rows] = await pool.query(
        `SELECT a.id, a.status, a.data_aplicacao, p.id AS prova_id, p.titulo AS prova_titulo, t.nome AS turma_nome
           FROM aplicacao a
           JOIN prova p ON p.id = a.prova_id
           JOIN turma t ON t.id = a.turma_id
          WHERE a.id = ? AND p.professor_id = ?`,
        [aplicacaoId, professorId]
      );
      if (!rows.length) return null;
      const row = rows[0];
      return {
        id: row.id,
        status: row.status,
        dataAplicacao: toDateOnly(row.data_aplicacao),
        prova: { id: row.prova_id, titulo: row.prova_titulo },
        turma: { nome: row.turma_nome },
      };
    },

    // Questões na ordem da prova, no formato que os montadores do PDF recebem:
    // { id, excerpt, imageUrl, score, alternatives: [{ text, correct }] } (alternativas pela ordem original).
    // "correct" só é usado pelo PDF do gabarito (T27); a prova impressa ignora o campo.
    async listQuestoesDaProva(provaId) {
      const [questoes] = await pool.query(
        `SELECT q.id, q.enunciado, q.imagem_url, pq.pontuacao
           FROM prova_questao pq
           JOIN questao q ON q.id = pq.questao_id
          WHERE pq.prova_id = ?
          ORDER BY pq.posicao`,
        [provaId]
      );
      if (questoes.length === 0) return [];

      const [alternativas] = await pool.query(
        'SELECT questao_id, texto, correta FROM alternativa WHERE questao_id IN (?) ORDER BY questao_id, ordem',
        [questoes.map((q) => q.id)]
      );

      return questoes.map((q) => ({
        id: q.id,
        excerpt: q.enunciado,
        imageUrl: q.imagem_url ?? null,
        score: Number(q.pontuacao),
        alternatives: alternativas
          .filter((a) => a.questao_id === q.id)
          .map((a) => ({ text: a.texto, correct: Boolean(a.correta) })),
      }));
    },

    async findNomeInstituicao() {
      const [rows] = await pool.query('SELECT nome_instituicao FROM configuracoes WHERE id = 1');
      return rows[0]?.nome_instituicao ?? null;
    },
  };
}
