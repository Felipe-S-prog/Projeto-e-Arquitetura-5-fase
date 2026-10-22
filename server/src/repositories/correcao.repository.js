import { toAlternativa, toCopia, toCorrecao, toQuestaoDaProva, toResposta } from '../models/correcao.model.js';

// Repository da Correção e Notas: ÚNICA camada com SQL desta frente.
// Toda consulta filtra pelo professor dono da prova (RNF04).

const SELECT_COPIA = `
  SELECT cp.id, cp.codigo, cp.rotulo, cp.ordem_embaralhamento, cp.gabarito_publicado,
         cp.aplicacao_id, a.data_aplicacao, a.turma_id, t.nome AS turma_nome,
         p.id AS prova_id, p.titulo AS prova_titulo,
         al.id AS aluno_id, al.nome AS aluno_nome, al.email AS aluno_email, al.numero_matricula AS aluno_matricula
    FROM copia_prova cp
    JOIN aplicacao a ON a.id = cp.aplicacao_id
    JOIN prova p ON p.id = a.prova_id
    JOIN turma t ON t.id = a.turma_id
    LEFT JOIN aluno al ON al.id = cp.aluno_id`;

const SELECT_CORRECAO = `
  SELECT c.id, c.copia_prova_id, c.professor_id, c.nota, c.tipo, c.corrigida_em,
         al.id AS aluno_id, al.nome AS aluno_nome, al.email AS aluno_email, al.numero_matricula AS aluno_matricula
    FROM correcao c
    LEFT JOIN aluno al ON al.id = c.aluno_id`;

export function createCorrecaoRepository(pool) {
  return {
    async findCopiaByCodigo(codigo, professorId) {
      const [rows] = await pool.query(`${SELECT_COPIA} WHERE cp.codigo = ? AND p.professor_id = ?`, [codigo, professorId]);
      return rows.length ? toCopia(rows[0]) : null;
    },

    async findCopiaById(copiaId, professorId) {
      const [rows] = await pool.query(`${SELECT_COPIA} WHERE cp.id = ? AND p.professor_id = ?`, [copiaId, professorId]);
      return rows.length ? toCopia(rows[0]) : null;
    },

    async listQuestoesDaProva(provaId) {
      const [rows] = await pool.query(
        `SELECT pq.questao_id, pq.posicao, pq.pontuacao, q.tipo, q.enunciado
           FROM prova_questao pq
           JOIN questao q ON q.id = pq.questao_id
          WHERE pq.prova_id = ?
          ORDER BY pq.posicao`,
        [provaId]
      );
      return rows.map(toQuestaoDaProva);
    },

    async listAlternativas(questaoIds) {
      if (questaoIds.length === 0) return [];
      const [rows] = await pool.query(
        'SELECT questao_id, ordem, texto, correta FROM alternativa WHERE questao_id IN (?) ORDER BY questao_id, ordem',
        [questaoIds]
      );
      return rows.map(toAlternativa);
    },

    async listAlunosDaTurma(turmaId) {
      const [rows] = await pool.query(
        `SELECT al.id, al.nome, al.email, al.numero_matricula
           FROM matricula m
           JOIN aluno al ON al.id = m.aluno_id
          WHERE m.turma_id = ?
          ORDER BY al.nome`,
        [turmaId]
      );
      return rows.map((row) => ({ id: row.id, nome: row.nome, email: row.email, matricula: row.numero_matricula }));
    },

    async isAlunoMatriculado(alunoId, turmaId) {
      const [rows] = await pool.query('SELECT 1 FROM matricula WHERE aluno_id = ? AND turma_id = ?', [alunoId, turmaId]);
      return rows.length > 0;
    },

    // Outra cópia da mesma aplicação já corrigida para este aluno (evita duas notas na mesma prova).
    async findCorrecaoDoAlunoNaAplicacao(alunoId, aplicacaoId, ignorarCopiaId) {
      const [rows] = await pool.query(
        `SELECT cp.codigo
           FROM correcao c
           JOIN copia_prova cp ON cp.id = c.copia_prova_id
          WHERE c.aluno_id = ? AND cp.aplicacao_id = ? AND cp.id <> ?
          LIMIT 1`,
        [alunoId, aplicacaoId, ignorarCopiaId]
      );
      return rows.length ? rows[0].codigo : null;
    },

    async findCorrecaoByCopia(copiaId) {
      const [rows] = await pool.query(`${SELECT_CORRECAO} WHERE c.copia_prova_id = ?`, [copiaId]);
      return rows.length ? toCorrecao(rows[0]) : null;
    },

    async findCorrecaoById(correcaoId, professorId) {
      const [rows] = await pool.query(
        `${SELECT_CORRECAO}
           JOIN copia_prova cp ON cp.id = c.copia_prova_id
           JOIN aplicacao a ON a.id = cp.aplicacao_id
           JOIN prova p ON p.id = a.prova_id
          WHERE c.id = ? AND p.professor_id = ?`,
        [correcaoId, professorId]
      );
      return rows.length ? toCorrecao(rows[0]) : null;
    },

    async listRespostas(correcaoId) {
      const [rows] = await pool.query(
        'SELECT questao_id, numero, letra_marcada, correta, pontos FROM correcao_resposta WHERE correcao_id = ? ORDER BY numero',
        [correcaoId]
      );
      return rows.map(toResposta);
    },

    // Grava a correção e as respostas de uma vez (transação). Se a cópia já tinha
    // correção, ela é substituída: as respostas antigas saem junto (ON DELETE CASCADE).
    async salvarCorrecao({ copiaId, alunoId, professorId, nota, tipo, respostas }) {
      const conn = await pool.getConnection();
      try {
        await conn.beginTransaction();
        await conn.query('DELETE FROM correcao WHERE copia_prova_id = ?', [copiaId]);
        const [result] = await conn.query(
          'INSERT INTO correcao (aluno_id, copia_prova_id, professor_id, nota, tipo) VALUES (?, ?, ?, ?, ?)',
          [alunoId, copiaId, professorId, nota, tipo]
        );
        if (respostas.length > 0) {
          await conn.query(
            'INSERT INTO correcao_resposta (correcao_id, questao_id, numero, letra_marcada, correta, pontos) VALUES ?',
            [respostas.map((r) => [result.insertId, r.questaoId, r.numero, r.letraMarcada, r.correta === null ? null : Number(r.correta), r.pontos])]
          );
        }
        await conn.commit();
        return result.insertId;
      } catch (err) {
        await conn.rollback();
        throw err;
      } finally {
        conn.release();
      }
    },

    async removerCorrecao(correcaoId) {
      const [result] = await pool.query('DELETE FROM correcao WHERE id = ?', [correcaoId]);
      return result.affectedRows > 0;
    },
  };
}
