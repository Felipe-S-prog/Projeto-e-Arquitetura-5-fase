import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import mysql from 'mysql2/promise';

test('T79: migration MySQL unifica duplicadas sem perder vínculos e pode ser repetida', { skip: process.env.N3_MYSQL_TEST !== 'true' }, async () => {
  // Banco descartável exclusivo deste teste. Nunca utiliza DB_NAME da aplicação.
  const db = 'sgp_n3_tags_test_' + process.pid;
  const conn = await mysql.createConnection({
    host: '127.0.0.1', user: 'root', password: process.env.N3_MYSQL_PASSWORD,
    multipleStatements: true, charset: 'utf8mb4',
  });
  try {
    await conn.query('CREATE DATABASE ' + db + ' CHARACTER SET utf8mb4');
    await conn.query('USE ' + db);
    await conn.query(`
      CREATE TABLE tag (id INT UNSIGNED PRIMARY KEY AUTO_INCREMENT, nome VARCHAR(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL UNIQUE);
      CREATE TABLE questao_tag (questao_id INT UNSIGNED NOT NULL, tag_id INT UNSIGNED NOT NULL, PRIMARY KEY (questao_id, tag_id), FOREIGN KEY (tag_id) REFERENCES tag(id));
      INSERT INTO tag (nome) VALUES ('Matematica'), ('matemática'), ('mat'), (' matemat '), ('Álgebra   Linear'), ('algebra linear'), ('Matemática');
      INSERT INTO questao_tag VALUES (10,1), (10,2), (11,3), (12,4), (12,5), (12,6), (13,7);
    `);
    const sql = await readFile(new URL('../database/migrations/005_normalizar_tags.sql', import.meta.url), 'utf8');
    await conn.query(sql);
    const [tags] = await conn.query('SELECT nome FROM tag ORDER BY nome');
    assert.deepEqual(tags.map((tag) => tag.nome), ['algebra linear', 'matematica']);
    const [links] = await conn.query('SELECT questao_id, tag.nome FROM questao_tag JOIN tag ON tag.id = tag_id ORDER BY questao_id, tag.nome');
    assert.deepEqual(links.map((link) => [link.questao_id, link.nome]), [[10,'matematica'], [11,'matematica'], [12,'algebra linear'], [12,'matematica'], [13,'matematica']]);
    await conn.query(sql);
    const [again] = await conn.query('SELECT COUNT(*) AS total FROM questao_tag');
    assert.equal(again[0].total, 5);
  } finally {
    await conn.query('ROLLBACK');
    await conn.query('DROP DATABASE IF EXISTS ' + db);
    await conn.end();
  }
});
