import {
  toAplicacaoResumo,
  toDesempenhoDaQuestao,
  toItemDoHistorico,
  toNotaDaCopia,
  toNotaDoAluno,
  toTurmaResumo,
} from '../models/relatorio.model.js';
import { toCamelCase } from '../utils/case.js';

// Repository dos relatórios e do histórico de notas (T32 e T33).
// Toda consulta filtra pelo professor dono da prova ou da turma (RNF04).

const NOTA_MAXIMA = '(SELECT COALESCE(SUM(pq.pontuacao), 0) FROM prova_questao pq WHERE pq.prova_id = p.id)';

export function createRelatorioRepository(pool) {
  return {
    async listAplicacoes(professorId) {
      const [rows] = await pool.query(
        `SELECT a.id, a.data_aplicacao, a.status, p.id AS prova_id, p.titulo AS prova_titulo,
                t.id AS turma_id, t.nome AS turma_nome, ${NOTA_MAXIMA} AS nota_maxima,
                COUNT(DISTINCT cp.id) AS total_copias, COUNT(c.id) AS corrigidas, AVG(c.nota) AS media
           FROM aplicacao a
           JOIN prova p ON p.id = a.prova_id
           JOIN turma t ON t.id = a.turma_id
           LEFT JOIN copia_prova cp ON cp.aplicacao_id = a.id
           LEFT JOIN correcao c ON c.copia_prova_id = cp.id
          WHERE p.professor_id = ?
          GROUP BY a.id
          ORDER BY a.criada_em DESC, a.id DESC`,
        [professorId]
      );
      return rows.map(toAplicacaoResumo);
    },

    async findAplicacao(aplicacaoId, professorId) {
      const [rows] = await pool.query(
        `SELECT a.id, a.data_aplicacao, a.status, p.id AS prova_id, p.titulo AS prova_titulo,
                t.id AS turma_id, t.nome AS turma_nome, ${NOTA_MAXIMA} AS nota_maxima
           FROM aplicacao a
           JOIN prova p ON p.id = a.prova_id
           JOIN turma t ON t.id = a.turma_id
          WHERE a.id = ? AND p.professor_id = ?`,
        [aplicacaoId, professorId]
      );
      return rows.length ? toAplicacaoResumo(rows[0]) : null;
    },

    // Uma linha por cópia da aplicação, corrigida ou não. A nota é do aluno da
    // correção (lançamento manual) ou, se não houver, do aluno impresso na cópia.
    async listNotasDaAplicacao(aplicacaoId) {
      const [rows] = await pool.query(
        `SELECT cp.id AS copia_id, cp.codigo, cp.rotulo,
                al.id AS aluno_id, al.nome AS aluno_nome, al.numero_matricula AS aluno_matricula,
                c.id AS correcao_id, c.nota, c.tipo, c.corrigida_em
           FROM copia_prova cp
           LEFT JOIN correcao c ON c.copia_prova_id = cp.id
           LEFT JOIN aluno al ON al.id = COALESCE(c.aluno_id, cp.aluno_id)
          WHERE cp.aplicacao_id = ?
          ORDER BY al.nome IS NULL, al.nome, cp.rotulo`,
        [aplicacaoId]
      );
      return rows.map(toNotaDaCopia);
    },

    // Acertos por questão, só das correções automáticas (as manuais não têm respostas).
    async listDesempenhoPorQuestao(aplicacaoId, provaId) {
      const [rows] = await pool.query(
        `SELECT pq.questao_id, pq.posicao, pq.pontuacao, q.tipo, q.enunciado,
                COUNT(r.questao_id) AS corrigidas,
                COALESCE(SUM(r.correta = 1), 0) AS acertos,
                COALESCE(SUM(r.letra_marcada IS NULL AND q.tipo = 'OBJETIVA'), 0) AS em_branco,
                AVG(r.pontos) AS media_pontos
           FROM prova_questao pq
           JOIN questao q ON q.id = pq.questao_id
           LEFT JOIN (
                 SELECT r.questao_id, r.letra_marcada, r.correta, r.pontos
                   FROM correcao_resposta r
                   JOIN correcao c ON c.id = r.correcao_id
                   JOIN copia_prova cp ON cp.id = c.copia_prova_id
                  WHERE cp.aplicacao_id = ?
                ) r ON r.questao_id = pq.questao_id
          WHERE pq.prova_id = ?
          GROUP BY pq.questao_id, pq.posicao, pq.pontuacao, q.tipo, q.enunciado
          ORDER BY pq.posicao`,
        [aplicacaoId, provaId]
      );
      return rows.map(toDesempenhoDaQuestao);
    },

    async listTurmas(professorId) {
      const [rows] = await pool.query(
        `SELECT t.id, t.nome, t.disciplina, t.periodo, t.status,
                (SELECT COUNT(*) FROM matricula m WHERE m.turma_id = t.id) AS total_alunos,
                (SELECT COUNT(*) FROM aplicacao a WHERE a.turma_id = t.id) AS total_aplicacoes
           FROM turma t
          WHERE t.professor_id = ?
          ORDER BY t.status, t.nome`,
        [professorId]
      );
      return rows.map(toTurmaResumo);
    },

    async findTurma(turmaId, professorId) {
      const [rows] = await pool.query(
        'SELECT id, nome, disciplina, periodo, status FROM turma WHERE id = ? AND professor_id = ?',
        [turmaId, professorId]
      );
      return rows.length ? toCamelCase(rows[0]) : null;
    },

    async listAplicacoesDaTurma(turmaId, professorId) {
      const [rows] = await pool.query(
        `SELECT a.id, a.data_aplicacao, a.status, p.id AS prova_id, p.titulo AS prova_titulo,
                t.id AS turma_id, t.nome AS turma_nome, ${NOTA_MAXIMA} AS nota_maxima
           FROM aplicacao a
           JOIN prova p ON p.id = a.prova_id
           JOIN turma t ON t.id = a.turma_id
          WHERE a.turma_id = ? AND p.professor_id = ?
          ORDER BY a.data_aplicacao IS NULL, a.data_aplicacao, a.id`,
        [turmaId, professorId]
      );
      return rows.map(toAplicacaoResumo);
    },

    async listAlunosDaTurma(turmaId) {
      const [rows] = await pool.query(
        `SELECT al.id, al.nome, al.email, al.numero_matricula AS matricula
           FROM matricula m
           JOIN aluno al ON al.id = m.aluno_id
          WHERE m.turma_id = ?
          ORDER BY al.nome`,
        [turmaId]
      );
      return rows.map(toCamelCase);
    },

    // Notas já associadas a um aluno nas aplicações da turma.
    async listNotasDaTurma(turmaId) {
      const [rows] = await pool.query(
        `SELECT c.id AS correcao_id, c.aluno_id, al.nome AS aluno_nome, al.numero_matricula AS aluno_matricula,
                cp.aplicacao_id, c.nota, c.tipo
           FROM correcao c
           JOIN copia_prova cp ON cp.id = c.copia_prova_id
           JOIN aplicacao a ON a.id = cp.aplicacao_id
           JOIN aluno al ON al.id = c.aluno_id
          WHERE a.turma_id = ?`,
        [turmaId]
      );
      return rows.map(toNotaDoAluno);
    },

    // Aluno visível para o professor: matriculado em alguma turma dele.
    async findAlunoDoProfessor(alunoId, professorId) {
      const [rows] = await pool.query(
        `SELECT al.id, al.nome, al.email, al.numero_matricula AS matricula
           FROM aluno al
          WHERE al.id = ?
            AND EXISTS (SELECT 1 FROM matricula m JOIN turma t ON t.id = m.turma_id
                         WHERE m.aluno_id = al.id AND t.professor_id = ?)`,
        [alunoId, professorId]
      );
      return rows.length ? toCamelCase(rows[0]) : null;
    },

    async listTurmasDoAluno(alunoId, professorId) {
      const [rows] = await pool.query(
        `SELECT t.id, t.nome, t.disciplina, t.periodo, t.status
           FROM matricula m
           JOIN turma t ON t.id = m.turma_id
          WHERE m.aluno_id = ? AND t.professor_id = ?
          ORDER BY t.nome`,
        [alunoId, professorId]
      );
      return rows.map(toCamelCase);
    },

    // Histórico do aluno: todas as notas nas provas do professor, da mais recente para a mais antiga.
    async listHistoricoDoAluno(alunoId, professorId) {
      const [rows] = await pool.query(
        `SELECT c.id AS correcao_id, c.nota, c.tipo, c.corrigida_em,
                cp.codigo, cp.gabarito_publicado, cp.gabarito_publicado_em,
                a.id AS aplicacao_id, a.data_aplicacao,
                p.id AS prova_id, p.titulo AS prova_titulo, ${NOTA_MAXIMA} AS nota_maxima,
                t.id AS turma_id, t.nome AS turma_nome
           FROM correcao c
           JOIN copia_prova cp ON cp.id = c.copia_prova_id
           JOIN aplicacao a ON a.id = cp.aplicacao_id
           JOIN prova p ON p.id = a.prova_id
           JOIN turma t ON t.id = a.turma_id
          WHERE c.aluno_id = ? AND p.professor_id = ?
          ORDER BY COALESCE(a.data_aplicacao, DATE(c.corrigida_em)) DESC, c.id DESC`,
        [alunoId, professorId]
      );
      return rows.map(toItemDoHistorico);
    },
  };
}
