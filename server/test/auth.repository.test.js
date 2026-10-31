
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createAuthRepository } from '../src/repositories/auth.repository.js';

function makeConnection({ userExists = true, failRefresh = false } = {}) {
  const calls = [];

  const connection = {
    calls,

    async beginTransaction() {
      calls.push('begin');
    },

    async execute(sql, params) {
      calls.push({ sql, params });

      if (sql.includes('UPDATE usuario')) {
        return [{ affectedRows: userExists ? 1 : 0 }, []];
      }

      if (sql.includes('UPDATE refresh_token')) {
        if (failRefresh) throw new Error('Falha ao revogar tokens');

        return [{ affectedRows: 2 }, []];
      }

      throw new Error('Consulta inesperada');
    },

    async commit() {
      calls.push('commit');
    },

    async rollback() {
      calls.push('rollback');
    },

    release() {
      calls.push('release');
    },
  };

  return connection;
}

test('revogar todas as sessões incrementa a versão e revoga os refresh tokens', async () => {
  const connection = makeConnection();

  const pool = {
    getConnection: async () => connection,
  };

  const repository = createAuthRepository(pool);

  const result = await repository.revokeAllSessions(7);

  assert.equal(result, true);

  assert.equal(connection.calls[0], 'begin');

  const userUpdate = connection.calls[1];

  assert.match(userUpdate.sql, /versao_sessao = versao_sessao \+ 1/);
  assert.deepEqual(userUpdate.params, [7]);

  const refreshUpdate = connection.calls[2];

  assert.match(refreshUpdate.sql, /UPDATE refresh_token/);
  assert.match(refreshUpdate.sql, /revogado_em IS NULL/);
  assert.deepEqual(refreshUpdate.params, [7]);

  assert.ok(connection.calls.includes('commit'));
  assert.equal(connection.calls.at(-1), 'release');
});

test('revogação retorna false quando o usuário não existe', async () => {
  const connection = makeConnection({ userExists: false });

  const pool = {
    getConnection: async () => connection,
  };

  const repository = createAuthRepository(pool);

  const result = await repository.revokeAllSessions(999);

  assert.equal(result, false);
  assert.ok(connection.calls.includes('rollback'));
  assert.ok(!connection.calls.some(
    (call) => typeof call === 'object' && call.sql.includes('UPDATE refresh_token'),
  ));
  assert.equal(connection.calls.at(-1), 'release');
});

test('erro ao revogar refresh tokens cancela a transação', async () => {
  const connection = makeConnection({ failRefresh: true });

  const pool = {
    getConnection: async () => connection,
  };

  const repository = createAuthRepository(pool);

  await assert.rejects(
    repository.revokeAllSessions(7),
    /Falha ao revogar tokens/,
  );

  assert.ok(connection.calls.includes('rollback'));
  assert.ok(!connection.calls.includes('commit'));
  assert.equal(connection.calls.at(-1), 'release');
});
