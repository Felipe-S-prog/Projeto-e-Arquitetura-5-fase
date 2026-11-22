import assert from 'node:assert/strict';
import { test } from 'node:test';
import mysql from 'mysql2/promise';
import { createMatriculasService } from '../src/services/matriculas.service.js';

test('T48: concorrência real MySQL não duplica aluno/matrícula e remoção preserva notas', { skip: process.env.N3_MYSQL_TEST !== 'true' }, async () => {
  const database = `sgp_matriculas_test_${process.pid}`;
  const options = { host: '127.0.0.1', user: 'root', password: process.env.N3_MYSQL_PASSWORD, multipleStatements: true, charset: 'utf8mb4' };
  const admin = await mysql.createConnection(options);
  let pool;
  try {
    await admin.query(`CREATE DATABASE ${database} CHARACTER SET utf8mb4`);
    pool = mysql.createPool({ ...options, database, connectionLimit: 4 });
    await pool.query(`
      CREATE TABLE turma (id INT PRIMARY KEY, professor_id INT NOT NULL, status VARCHAR(20));
      CREATE TABLE aluno (id INT PRIMARY KEY AUTO_INCREMENT, nome VARCHAR(120), email VARCHAR(160) UNIQUE, numero_matricula VARCHAR(30));
      CREATE TABLE matricula (turma_id INT, aluno_id INT, PRIMARY KEY(turma_id, aluno_id), FOREIGN KEY(turma_id) REFERENCES turma(id), FOREIGN KEY(aluno_id) REFERENCES aluno(id));
      CREATE TABLE correcao (id INT PRIMARY KEY, aluno_id INT, nota DECIMAL(5,2), FOREIGN KEY(aluno_id) REFERENCES aluno(id));
      INSERT INTO turma VALUES (2,7,'ATIVA'),(3,8,'ATIVA');
    `);
    const service = createMatriculasService({ pool });
    const body = { nome: 'João', email: 'joao@example.com' };
    const results = await Promise.allSettled([service.matricular(2, 7, body), service.matricular(2, 7, body)]);
    assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1);
    assert.equal(results.find((r) => r.status === 'rejected').reason.statusCode, 400);
    const [[counts]] = await pool.query('SELECT (SELECT COUNT(*) FROM aluno) alunos, (SELECT COUNT(*) FROM matricula) matriculas');
    assert.deepEqual([counts.alunos, counts.matriculas], [1, 1]);
    const student = results.find((r) => r.status === 'fulfilled').value;
    await pool.execute('INSERT INTO correcao VALUES (1, ?, 8.5)', [student.id]);
    await assert.rejects(service.remover(2, 8, student.id), { statusCode: 404 });
    await service.remover(2, 7, student.id);
    const [[saved]] = await pool.query('SELECT (SELECT COUNT(*) FROM aluno) alunos, (SELECT COUNT(*) FROM matricula) matriculas, (SELECT COUNT(*) FROM correcao WHERE nota = 8.5) notas');
    assert.deepEqual([saved.alunos, saved.matriculas, saved.notas], [1, 0, 1]);
    await service.matricular(2, 7, body);
    const result = await service.importar(2, 7, 'nome,email\nJoão,joao@example.com\nAna,ana@example.com');
    assert.equal(result.imported.length, 1);
    assert.equal(result.rejected.length, 1);
  } finally {
    await pool?.end();
    await admin.query(`DROP DATABASE IF EXISTS ${database}`);
    await admin.end();
  }
});
