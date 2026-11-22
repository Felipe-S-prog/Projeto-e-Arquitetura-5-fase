import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createMatriculasService } from '../src/services/matriculas.service.js';
import { lerAlunosCsv, validarAluno } from '../src/utils/alunosCsv.js';

function fixture({ status = 'ATIVA', owner = true, duplicate = false, fail = false } = {}) {
  const calls = [];
  const conn = {
    async execute(sql, values) {
      calls.push([sql, values]);
      if (sql.startsWith('SELECT id, status')) return [owner ? [{ id: 2, status }] : []];
      if (fail) throw new Error('Banco indisponível');
      if (sql.startsWith('SELECT id, nome')) return [[{ id: 4, nome: 'Ana', email: values[0] }]];
      return [{ affectedRows: duplicate ? 0 : 1 }];
    },
    async beginTransaction() { calls.push(['begin']); },
    async commit() { calls.push(['commit']); },
    async rollback() { calls.push(['rollback']); },
    release() { calls.push(['release']); },
  };
  return { calls, service: createMatriculasService({ pool: { getConnection: async () => conn } }) };
}

test('T75: CSV do Excel aceita BOM, acentos, delimitadores e aspas escapadas', () => {
  const rows = lerAlunosCsv('\uFEFFnome;email;matrícula\r\n"João; Silva";JOAO@EXAMPLE.COM;001\r\n"Ana ""B""";ana@example.com;002');
  assert.equal(rows.length, 2);
  assert.equal(rows[0].line, 2);
  assert.equal(validarAluno(rows[0].body).email, 'joao@example.com');
  assert.equal(rows[1].body.nome, 'Ana "B"');
  assert.equal(lerAlunosCsv('nome,email\nAna,ana@example.com')[0].invalidColumns, false);
});
test('T75: CSV malformado, vazio, sem cabeçalho e acima do limite é recusado', () => {
  for (const csv of ['', 'Ana,ana@example.com', 'nome,email\n"Ana,ana@example.com', 'nome,email\n"Ana"x,ana@example.com', 'nome,email\n', 'nome,email\n' + 'Ana,a@b.com\n'.repeat(501)]) {
    assert.throws(() => lerAlunosCsv(csv), { statusCode: 400 });
  }
});
test('T47: valida nome, e-mail e matrícula antes de gravar', () => {
  for (const body of [{}, { nome: 'Ana', email: 'inválido' }, { nome: 'a'.repeat(121), email: 'a@b.com' }, { nome: 'Ana', email: 'a@b.com', numero_matricula: '1'.repeat(31) }]) assert.throws(() => validarAluno(body), { statusCode: 400 });
});
test('T47: remove somente matrícula, preservando cadastro e notas', async () => {
  const { service, calls } = fixture();
  await service.remover(2, 7, 4);
  assert.deepEqual(calls.find(([sql]) => sql.startsWith('DELETE')), ['DELETE FROM matricula WHERE turma_id = ? AND aluno_id = ?', [2, 4]]);
  assert(!calls.some(([sql]) => /DELETE FROM (aluno|correcao|copia_prova)/.test(sql)));
  assert(calls.some(([sql]) => sql === 'commit'));
});
test('T48: turma de outro professor e turma arquivada não permitem alteração', async () => {
  for (const [options, expected] of [[{ owner: false }, 404], [{ status: 'ARQUIVADA' }, 400]]) {
    for (const operation of ['remover', 'matricular', 'importar']) {
      const { service, calls } = fixture(options);
      const arg = operation === 'remover' ? 4 : operation === 'importar' ? 'nome,email\nAna,a@b.com' : { nome: 'Ana', email: 'a@b.com' };
      await assert.rejects(service[operation](2, 7, arg), { statusCode: expected });
      assert(!calls.some(([sql]) => /^(INSERT|DELETE)/.test(sql)));
      assert(calls.some(([sql]) => sql === 'rollback'));
    }
  }
});
test('T75: importa válidos e informa cada linha recusada', async () => {
  const { service } = fixture();
  const result = await service.importar(2, 7, 'nome;email\nAna;A@B.COM\nOutra;a@b.com\nJoão;errado\nBia;bia@example.com');
  assert.equal(result.total, 4);
  assert.equal(result.imported.length, 2);
  assert.deepEqual(result.rejected.map((r) => r.line), [3, 4]);
});
test('T47/T75: matrícula existente é recusada sem duplicar; importação relata a linha', async () => {
  const { service } = fixture({ duplicate: true });
  await assert.rejects(service.matricular(2, 7, { nome: 'Ana', email: 'a@b.com' }), { statusCode: 400 });
  const result = await service.importar(2, 7, 'nome,email\nAna,a@b.com');
  assert.equal(result.imported.length, 0);
  assert.equal(result.rejected[0].line, 2);
});
test('T48: falha de banco reverte a operação inteira e libera conexão', async () => {
  const { service, calls } = fixture({ fail: true });
  await assert.rejects(service.importar(2, 7, 'nome,email\nAna,a@b.com'), /Banco indisponível/);
  assert(calls.some(([sql]) => sql === 'rollback'));
  assert(!calls.some(([sql]) => sql === 'commit'));
  assert.equal(calls.at(-1)[0], 'release');
});
test('T48: entradas concorrentes usam trava da turma e inserção com chave única', async () => {
  const { service, calls } = fixture();
  await Promise.all([service.matricular(2, 7, { nome: 'Ana', email: 'a@b.com' }), service.matricular(2, 7, { nome: 'Ana', email: 'a@b.com' })]);
  assert.equal(calls.filter(([sql]) => sql.endsWith('FOR UPDATE')).length, 2);
  assert(calls.some(([sql]) => sql.includes('ON DUPLICATE KEY UPDATE')));
  assert(calls.some(([sql]) => sql.startsWith('INSERT IGNORE INTO matricula')));
});
