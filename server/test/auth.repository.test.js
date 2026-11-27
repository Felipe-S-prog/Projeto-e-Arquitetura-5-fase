
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

function makeRecoveryConnection({
  tokenExists = true,
  userExists = true,
  failOn = null,
} = {}) {
  const calls = [];

  const connection = {
    calls,

    async beginTransaction() {
      calls.push('begin');
    },

    async execute(sql, params) {
      calls.push({ sql, params });

      if (sql.includes('SELECT id FROM token_recuperacao_senha')) {
        return [tokenExists ? [{ id: 9 }] : [], []];
      }

      if (sql.includes('UPDATE usuario')) {
        return [{ affectedRows: userExists ? 1 : 0 }, []];
      }

      if (sql.includes('UPDATE refresh_token')) {
        if (failOn === 'refresh') {
          throw new Error('Falha ao revogar sessões');
        }

        return [{ affectedRows: 1 }, []];
      }

      if (
        sql.includes('UPDATE token_recuperacao_senha') ||
        sql.includes('INSERT INTO token_recuperacao_senha')
      ) {
        return [{ affectedRows: 1, insertId: 10 }, []];
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

test('criar token de recuperação invalida tokens anteriores e insere o novo', async () => {
  const connection = makeRecoveryConnection();

  const repository = createAuthRepository({
    getConnection: async () => connection,
  });

  await repository.createPasswordResetToken({
    userId: 7,
    tokenHash: 'hash-token',
    expiresInMinutes: 15,
  });

  const updateCall = connection.calls.find(
    (call) =>
      typeof call === 'object' &&
      call.sql.includes('UPDATE token_recuperacao_senha'),
  );

  const insertCall = connection.calls.find(
    (call) =>
      typeof call === 'object' &&
      call.sql.includes('INSERT INTO token_recuperacao_senha'),
  );

  assert.deepEqual(updateCall.params, [7]);
  assert.deepEqual(insertCall.params, [7, 'hash-token', 15]);
  assert.ok(connection.calls.includes('commit'));
  assert.equal(connection.calls.at(-1), 'release');
});

test('buscar token de recuperação consulta pelo hash', async () => {
  const token = { id: 9, usuario_id: 7 };
  let query;
  let params;

  const repository = createAuthRepository({
    execute: async (sql, values) => {
      query = sql;
      params = values;
      return [[token], []];
    },
  });

  const result = await repository.findPasswordResetTokenByHash('hash-token');

  assert.deepEqual(result, token);
  assert.deepEqual(params, ['hash-token']);
  assert.match(query, /usado_em IS NULL/);
  assert.match(query, /expira_em > NOW\(\)/);
});

test('recuperar senha atualiza a senha e revoga todas as sessões', async () => {
  const connection = makeRecoveryConnection();

  const repository = createAuthRepository({
    getConnection: async () => connection,
  });

  const result = await repository.resetPassword({
    tokenId: 9,
    userId: 7,
    passwordHash: 'novo-hash',
  });

  const tokenQuery = connection.calls.find(
    (call) =>
      typeof call === 'object' &&
      call.sql.includes('SELECT id FROM token_recuperacao_senha'),
  );

  const userUpdate = connection.calls.find(
    (call) =>
      typeof call === 'object' &&
      call.sql.includes('UPDATE usuario'),
  );

  const refreshUpdate = connection.calls.find(
    (call) =>
      typeof call === 'object' &&
      call.sql.includes('UPDATE refresh_token'),
  );

  assert.equal(result, true);
  assert.deepEqual(tokenQuery.params, [9, 7]);
  assert.match(tokenQuery.sql, /FOR UPDATE/);
  assert.deepEqual(userUpdate.params, ['novo-hash', 7]);
  assert.match(userUpdate.sql, /versao_sessao = versao_sessao \+ 1/);
  assert.deepEqual(refreshUpdate.params, [7]);
  assert.ok(connection.calls.includes('commit'));
  assert.equal(connection.calls.at(-1), 'release');
});

test('recuperar senha retorna false quando o token não é válido', async () => {
  const connection = makeRecoveryConnection({ tokenExists: false });

  const repository = createAuthRepository({
    getConnection: async () => connection,
  });

  const result = await repository.resetPassword({
    tokenId: 9,
    userId: 7,
    passwordHash: 'novo-hash',
  });

  assert.equal(result, false);
  assert.ok(connection.calls.includes('rollback'));
  assert.ok(!connection.calls.some(
    (call) =>
      typeof call === 'object' &&
      call.sql.includes('UPDATE usuario'),
  ));
  assert.equal(connection.calls.at(-1), 'release');
});

test('erro ao revogar sessões cancela a recuperação de senha', async () => {
  const connection = makeRecoveryConnection({ failOn: 'refresh' });

  const repository = createAuthRepository({
    getConnection: async () => connection,
  });

  await assert.rejects(
    repository.resetPassword({
      tokenId: 9,
      userId: 7,
      passwordHash: 'novo-hash',
    }),
    /Falha ao revogar sessões/,
  );

  assert.ok(connection.calls.includes('rollback'));
  assert.ok(!connection.calls.includes('commit'));
  assert.equal(connection.calls.at(-1), 'release');
});
