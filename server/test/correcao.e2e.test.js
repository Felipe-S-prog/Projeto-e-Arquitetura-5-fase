import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { createApp } from '../src/app.js';
import { loadConfig } from '../src/config/env.js';
import { dropDatabase, runMigrations } from '../src/database/migrator.js';
import { createPool } from '../src/database/pool.js';
import { hashPassword } from '../src/utils/password.js';

// Casos de borda da correção e do lançamento manual (T65), de ponta a ponta: requisição HTTP
// com login real, rotas, regras e MySQL. Só roda com um banco de teste configurado:
//
//   TEST_DB_USER=root TEST_DB_PASSWORD= TEST_DB_NAME=sgp_e2e npm test
//
// O banco é APAGADO e recriado a cada execução, por isso o nome precisa terminar em _test ou _e2e.
// Os dados entram direto no banco: o teste não depende das rotas das outras frentes.
const env = process.env;
const enabled = Boolean(env.TEST_DB_USER && env.TEST_DB_NAME);
const skip = enabled ? false : 'defina TEST_DB_USER e TEST_DB_NAME para rodar os testes de ponta a ponta';

const PASSWORD = 'Senha@Forte123';

describe('correção de ponta a ponta (MySQL)', { skip }, () => {
  let pool;
  let server;
  let base;
  let token;
  let other;
  let ids;

  async function call(method, path, body, auth = token) {
    const res = await fetch(base + path, {
      method,
      headers: { ...(body ? { 'content-type': 'application/json' } : {}), ...(auth ? { authorization: `Bearer ${auth}` } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    return { status: res.status, body: text ? JSON.parse(text) : null };
  }

  async function login(email) {
    const res = await call('POST', '/auth/login', { email, password: PASSWORD, device: 'teste' }, null);
    assert.equal(res.status, 200, JSON.stringify(res.body));
    return res.body.accessToken;
  }

  // Letras impressas da cópia: a correta e uma errada de cada questão, na ordem da folha.
  async function lettersOf(codigo) {
    const { body } = await call('GET', `/correcoes/copias/${codigo}`);
    const gabarito = { 'Q1': 'certa1', 'Q2': 'certa2', 'Q3': 'certa3' };
    return body.questoes.map((q) => ({
      questaoId: q.questaoId,
      certa: q.alternativas.find((a) => a.texto === gabarito[q.enunciado]).letra,
      errada: q.alternativas.find((a) => a.texto !== gabarito[q.enunciado]).letra,
    }));
  }

  before(async () => {
    if (!/_(test|e2e)$/.test(env.TEST_DB_NAME)) throw new Error('TEST_DB_NAME precisa terminar em _test ou _e2e (o banco é apagado).');
    const config = loadConfig({
      DB_HOST: env.TEST_DB_HOST ?? '127.0.0.1',
      DB_PORT: env.TEST_DB_PORT ?? '3306',
      DB_USER: env.TEST_DB_USER,
      DB_PASSWORD: env.TEST_DB_PASSWORD ?? '',
      DB_NAME: env.TEST_DB_NAME,
      NODE_ENV: 'test',
    });
    await dropDatabase(config.db);
    await runMigrations({ db: config.db, log() {} });
    pool = createPool(config.db);

    const hash = await hashPassword(PASSWORD);
    const [prof] = await pool.query("INSERT INTO usuario (nome, email, senha_hash, papel, status) VALUES ('Prof A', 'a@catolicasc.edu.br', ?, 'PROFESSOR', 'ATIVO')", [hash]);
    await pool.query("INSERT INTO usuario (nome, email, senha_hash, papel, status) VALUES ('Prof B', 'b@catolicasc.edu.br', ?, 'PROFESSOR', 'ATIVO')", [hash]);
    const professorId = prof.insertId;

    const [turma] = await pool.query("INSERT INTO turma (professor_id, nome, disciplina, periodo) VALUES (?, 'Turma E2E', 'Mat', '2026/2')", [professorId]);
    const alunos = {};
    for (const nome of ['Ana', 'Bruno', 'Carla', 'Diego']) {
      const [a] = await pool.query('INSERT INTO aluno (nome, email) VALUES (?, ?)', [nome, `${nome.toLowerCase()}@exemplo.com`]);
      await pool.query('INSERT INTO matricula (turma_id, aluno_id) VALUES (?, ?)', [turma.insertId, a.insertId]);
      alunos[nome] = a.insertId;
    }
    const [fora] = await pool.query("INSERT INTO aluno (nome, email) VALUES ('Fora', 'fora@exemplo.com')");
    alunos.Fora = fora.insertId;

    // 3 questões: 4 + 3 + 3 = 10 pontos.
    const [prova] = await pool.query("INSERT INTO prova (professor_id, titulo, status) VALUES (?, 'Prova E2E', 'PRONTA')", [professorId]);
    const questoes = [];
    for (const [i, pontos] of [4, 3, 3].entries()) {
      const [q] = await pool.query("INSERT INTO questao (professor_id, tipo, enunciado) VALUES (?, 'OBJETIVA', ?)", [professorId, `Q${i + 1}`]);
      for (const [ordem, texto] of [`certa${i + 1}`, 'errada x', 'errada y', 'errada z'].entries()) {
        await pool.query('INSERT INTO alternativa (questao_id, texto, correta, ordem) VALUES (?, ?, ?, ?)', [q.insertId, texto, ordem === 0 ? 1 : 0, ordem]);
      }
      await pool.query('INSERT INTO prova_questao (prova_id, questao_id, posicao, pontuacao) VALUES (?, ?, ?, ?)', [prova.insertId, q.insertId, i + 1, pontos]);
      questoes.push(q.insertId);
    }

    // Aplicação nominal (Ana e Bruno) e aplicação anônima (2 cópias), com questões e alternativas embaralhadas.
    const ordem = (qs, alts) => JSON.stringify({ questionIds: qs, alternativesOrder: Object.fromEntries(qs.map((q, i) => [q, alts[i]])) });
    const [q1, q2, q3] = questoes;
    const [nominal] = await pool.query("INSERT INTO aplicacao (turma_id, prova_id, status, quantidade, vincular_alunos) VALUES (?, ?, 'APLICADA', 2, 1)", [turma.insertId, prova.insertId]);
    const [anonima] = await pool.query("INSERT INTO aplicacao (turma_id, prova_id, status, quantidade, vincular_alunos) VALUES (?, ?, 'APLICADA', 2, 0)", [turma.insertId, prova.insertId]);
    const copias = [
      [nominal.insertId, alunos.Ana, 'ANAE2E', 'Ana', ordem([q2, q1, q3], [[3, 0, 1, 2], [2, 3, 0, 1], [1, 2, 3, 0]])],
      [nominal.insertId, alunos.Bruno, 'BRUE2E', 'Bruno', ordem([q3, q2, q1], [[0, 1, 2, 3], [1, 0, 3, 2], [3, 2, 1, 0]])],
      [anonima.insertId, null, 'ANO1E2', 'Prova #01', ordem([q1, q2, q3], [[2, 0, 3, 1], [0, 1, 2, 3], [1, 3, 0, 2]])],
      [anonima.insertId, null, 'ANO2E2', 'Prova #02', ordem([q3, q1, q2], [[0, 2, 1, 3], [3, 1, 0, 2], [2, 0, 3, 1]])],
    ];
    for (const c of copias) {
      await pool.query('INSERT INTO copia_prova (aplicacao_id, aluno_id, codigo, rotulo, ordem_embaralhamento) VALUES (?, ?, ?, ?, ?)', c);
    }
    ids = { alunos, nominal: nominal.insertId, anonima: anonima.insertId };

    server = createApp({ pool, config }).listen(0);
    await new Promise((resolve) => server.once('listening', resolve));
    base = `http://127.0.0.1:${server.address().port}/api`;
    token = await login('a@catolicasc.edu.br');
    other = await login('b@catolicasc.edu.br');
  });

  after(async () => {
    server?.close();
    await pool?.end();
  });

  test('todas em branco (letra nula) valem zero; letra minúscula é aceita', async () => {
    const letras = await lettersOf('ANAE2E');
    const branco = await call('POST', '/correcoes', { codigo: 'ANAE2E', respostas: letras.map((l) => ({ questaoId: l.questaoId, letra: null })) });
    assert.equal(branco.status, 201);
    assert.equal(branco.body.nota, 0);
    assert.ok(branco.body.respostas.every((r) => r.letraMarcada === null && r.correta === false));

    const certas = await call('POST', '/correcoes', {
      codigo: 'ANAE2E',
      substituir: true,
      respostas: letras.map((l) => ({ questaoId: l.questaoId, letra: l.certa.toLowerCase() })),
    });
    assert.equal(certas.status, 201);
    assert.equal(certas.body.nota, 10);
  });

  test('marcação dupla chega anulada (letra nula) e não pontua; as outras questões contam', async () => {
    const letras = await lettersOf('BRUE2E');
    const res = await call('POST', '/correcoes', {
      codigo: 'BRUE2E',
      respostas: letras.map((l, i) => ({ questaoId: l.questaoId, letra: i === 0 ? null : l.certa })),
    });
    assert.equal(res.status, 201);
    // a primeira questão impressa da cópia do Bruno é a Q3 (3 pontos)
    assert.equal(res.body.nota, 7);
    assert.equal(res.body.respostas[0].letraMarcada, null);
  });

  test('corrigir de novo sem confirmar devolve 409 com a nota anterior', async () => {
    const letras = await lettersOf('BRUE2E');
    const res = await call('POST', '/correcoes', { codigo: 'BRUE2E', respostas: letras.map((l) => ({ questaoId: l.questaoId, letra: l.errada })) });
    assert.equal(res.status, 409);
    assert.equal(res.body.error.details.nota, 7);
  });

  test('letra que não existe na questão e questão de outra prova são recusadas', async () => {
    const letras = await lettersOf('ANO1E2');
    const letraE = await call('POST', '/correcoes', { codigo: 'ANO1E2', respostas: [{ questaoId: letras[0].questaoId, letra: 'E' }] });
    assert.equal(letraE.status, 400);
    const outra = await call('POST', '/correcoes', { codigo: 'ANO1E2', respostas: [{ questaoId: 999999, letra: 'A' }] });
    assert.equal(outra.status, 400);
  });

  test('cópia anônima: lançamento manual exige aluno matriculado e nota dentro do máximo', async () => {
    const semAluno = await call('POST', '/correcoes/manual', { codigo: 'ANO1E2', nota: 5 });
    assert.equal(semAluno.status, 400);
    const naoMatriculado = await call('POST', '/correcoes/manual', { codigo: 'ANO1E2', nota: 5, alunoId: ids.alunos.Fora });
    assert.equal(naoMatriculado.status, 400);
    const acima = await call('POST', '/correcoes/manual', { codigo: 'ANO1E2', nota: 10.5, alunoId: ids.alunos.Carla });
    assert.equal(acima.status, 400);
    const negativa = await call('POST', '/correcoes/manual', { codigo: 'ANO1E2', nota: -1, alunoId: ids.alunos.Carla });
    assert.equal(negativa.status, 400);
    const ok = await call('POST', '/correcoes/manual', { codigo: 'ANO1E2', nota: 8.5, alunoId: ids.alunos.Carla });
    assert.equal(ok.status, 201);
    assert.equal(ok.body.tipo, 'MANUAL');
    assert.equal(ok.body.aluno.nome, 'Carla');
  });

  test('o mesmo aluno não recebe duas notas na mesma aplicação (nota duplicada)', async () => {
    const res = await call('POST', '/correcoes/manual', { codigo: 'ANO2E2', nota: 6, alunoId: ids.alunos.Carla });
    assert.equal(res.status, 409);
    assert.match(res.body.error.message, /ANO1E2/);
  });

  test('cópia anônima também pode ser corrigida pelas respostas, com ou sem aluno', async () => {
    const letras = await lettersOf('ANO2E2');
    const res = await call('POST', '/correcoes', { codigo: 'ANO2E2', respostas: letras.map((l) => ({ questaoId: l.questaoId, letra: l.certa })) });
    assert.equal(res.status, 201);
    assert.equal(res.body.aluno, null);
    assert.equal(res.body.nota, 10);
  });

  test('a lista da aplicação e o relatório refletem as correções', async () => {
    const lista = await call('GET', `/correcoes/aplicacoes/${ids.anonima}`);
    assert.equal(lista.status, 200);
    assert.deepEqual(lista.body.resumo, { corrigidas: 2, pendentes: 0, semFolha: 3, totalCopias: 2 });
    const relatorio = await call('GET', `/relatorios/aplicacoes/${ids.nominal}`);
    assert.equal(relatorio.body.estatisticas.corrigidas, 2);
    assert.equal(relatorio.body.estatisticas.media, 8.5);
  });

  test('outro professor não enxerga nada desta turma (404) e sem login é 401', async () => {
    assert.equal((await call('GET', '/correcoes/copias/ANAE2E', null, other)).status, 404);
    assert.equal((await call('GET', `/correcoes/aplicacoes/${ids.nominal}`, null, other)).status, 404);
    assert.equal((await call('POST', '/correcoes/manual', { codigo: 'ANO2E2', nota: 1, alunoId: ids.alunos.Diego }, other)).status, 404);
    assert.equal((await call('GET', '/correcoes/copias/ANAE2E', null, null)).status, 401);
  });

  test('excluir a correção libera a cópia para ser corrigida de novo', async () => {
    const { body } = await call('GET', '/correcoes/copias/ANO2E2');
    assert.equal((await call('DELETE', `/correcoes/${body.correcao.id}`)).status, 204);
    const depois = await call('GET', '/correcoes/copias/ANO2E2');
    assert.equal(depois.body.correcao, null);
  });
});
