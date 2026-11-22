import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createAuthRepository } from '../src/repositories/auth.repository.js';

test('registro cria uma conta ativa com papel PROFESSOR', async () => {
  const calls = [];
  const user = {
    id: 21,
    nome: 'Professor Teste',
    email: 'professor@exemplo.com',
    senha_hash: 'hash-bcrypt',
    papel: 'PROFESSOR',
    status: 'ATIVO',
    versao_sessao: 0,
  };
  const pool = {
    async execute(sql, params) {
      calls.push({ sql, params });
      if (sql.includes('WHERE email = ?')) return [[], []];
      if (sql.includes('INSERT INTO usuario')) return [{ insertId: 21 }, []];
      if (sql.includes('WHERE id = ?')) return [[user], []];
      throw new Error(`SQL inesperado: ${sql}`);
    },
  };

  const repository = createAuthRepository(pool);
  const created = await repository.registerProfessor({
    name: 'Professor Teste',
    email: 'professor@exemplo.com',
    passwordHash: 'hash-bcrypt',
  });

  assert.equal(created.id, 21);
  assert.equal(created.papel, 'PROFESSOR');
  assert.equal(created.status, 'ATIVO');
  const insert = calls.find((call) => call.sql.includes('INSERT INTO usuario'));
  assert.match(insert.sql, /'PROFESSOR', 'ATIVO'/);
  assert.deepEqual(insert.params, ['Professor Teste', 'professor@exemplo.com', 'hash-bcrypt']);
});

test('registro pode concluir uma conta existente sem senha', async () => {
  const calls = [];
  const existing = {
    id: 12,
    nome: 'Nome antigo',
    email: 'professor@exemplo.com',
    senha_hash: null,
    papel: 'PROFESSOR',
    status: 'ATIVO',
  };
  const updated = { ...existing, nome: 'Nome novo', senha_hash: 'hash-novo' };
  const pool = {
    async execute(sql, params) {
      calls.push({ sql, params });
      if (sql.includes('WHERE email = ?')) return [[existing], []];
      if (sql.includes('UPDATE usuario')) return [{ affectedRows: 1 }, []];
      if (sql.includes('WHERE id = ?')) return [[updated], []];
      throw new Error(`SQL inesperado: ${sql}`);
    },
  };

  const repository = createAuthRepository(pool);
  const result = await repository.registerProfessor({
    name: 'Nome novo',
    email: 'professor@exemplo.com',
    passwordHash: 'hash-novo',
  });

  assert.equal(result.nome, 'Nome novo');
  assert.equal(result.senha_hash, 'hash-novo');
  assert.equal(calls.some((call) => call.sql.includes('INSERT INTO usuario')), false);
});
