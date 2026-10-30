import assert from 'node:assert/strict';
import { test } from 'node:test';
import { loadConfig } from '../src/config/env.js';

const base = { DB_USER: 'sgp', DB_PASSWORD: 'segredo', DB_NAME: 'sgp' };

test('loadConfig: aplica os padrões quando só o essencial é informado', () => {
  const config = loadConfig(base);
  assert.equal(config.port, 3333);
  assert.equal(config.nodeEnv, 'development');
  assert.equal(config.auth.accessTokenTtlSeconds, 900);
  assert.equal(config.auth.refreshTokenTtlDays, 30);
  assert.deepEqual(config.auth.adminEmailDomains, ['catolicasc.org.br']);
  assert.deepEqual(config.corsOrigins, ['http://localhost:5173']);
  assert.deepEqual(config.db, { host: '127.0.0.1', port: 3306, user: 'sgp', password: 'segredo', database: 'sgp' });
});

test('loadConfig: lista TODAS as variáveis que faltam', () => {
  assert.throws(() => loadConfig({}), /DB_USER, DB_PASSWORD, DB_NAME/);
  assert.throws(() => loadConfig({ DB_PASSWORD: '' }), /DB_USER, DB_NAME/);
});

test('loadConfig: senha vazia é permitida (MySQL local sem senha), mas a variável precisa existir', () => {
  assert.equal(loadConfig({ ...base, DB_PASSWORD: '' }).db.password, '');
});

test('loadConfig: recusa nome de banco com caracteres perigosos (vai dentro de CREATE DATABASE)', () => {
  for (const name of ['sgp; DROP DATABASE x', 'sgp`', 'meu banco', '', 'a'.repeat(65)]) {
    assert.throws(() => loadConfig({ ...base, DB_NAME: name }), /DB_NAME/, `deveria recusar "${name}"`);
  }
});

test('loadConfig: valida as portas', () => {
  assert.throws(() => loadConfig({ ...base, PORT: 'abc' }), /PORT inválida/);
  assert.throws(() => loadConfig({ ...base, DB_PORT: '70000' }), /DB_PORT inválida/);
  assert.equal(loadConfig({ ...base, PORT: '4000', DB_PORT: '3307' }).port, 4000);
});

test('loadConfig: CLIENT_ORIGIN aceita várias origens separadas por vírgula', () => {
  const config = loadConfig({ ...base, CLIENT_ORIGIN: 'http://localhost:5173, https://sgp.netlify.app ,' });
  assert.deepEqual(config.corsOrigins, ['http://localhost:5173', 'https://sgp.netlify.app']);
});


test('loadConfig exige segredo JWT exclusivo em produção', () => {
  assert.throws(
    () => loadConfig({ ...base, NODE_ENV: 'production' }),
    /JWT_ACCESS_SECRET é obrigatória em produção/,
  );
  assert.doesNotThrow(() => loadConfig({
    ...base,
    NODE_ENV: 'production',
    JWT_ACCESS_SECRET: 'um-segredo-forte-com-mais-de-32-caracteres',
  }));
});


const certificado = '-----BEGIN CERTIFICATE-----\nMIIBfake\n-----END CERTIFICATE-----';

test('loadConfig: sem variáveis de SSL a conexão continua igual (sem ssl)', () => {
  assert.equal('ssl' in loadConfig(base).db, false);
});

test('loadConfig: DB_SSL_CA liga o SSL e aceita "\\n" no lugar das quebras de linha', () => {
  const config = loadConfig({ ...base, DB_SSL_CA: certificado.replace(/\n/g, '\\n') });
  assert.deepEqual(config.db.ssl, { ca: certificado, rejectUnauthorized: true });
});

test('loadConfig: DB_SSL=true liga o SSL sem certificado próprio, sempre verificando o servidor', () => {
  assert.deepEqual(loadConfig({ ...base, DB_SSL: 'true' }).db.ssl, { rejectUnauthorized: true });
});

test('loadConfig: recusa certificado que não parece PEM e arquivo ilegível', () => {
  assert.throws(() => loadConfig({ ...base, DB_SSL_CA: 'qualquer coisa' }), /não parece um certificado PEM/);
  assert.throws(() => loadConfig({ ...base, DB_SSL_CA_PATH: '/nao/existe/ca.pem' }), /DB_SSL_CA_PATH inválido/);
});
