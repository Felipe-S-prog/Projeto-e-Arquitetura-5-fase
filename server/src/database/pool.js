import mysql from 'mysql2/promise';

// Pool de conexões compartilhado pela aplicação inteira: cada repository
// recebe este pool e faz pool.query(sql, valores). Nunca monte SQL juntando
// texto com dados do usuário; use sempre "?" (ou :nome) para os valores.
export function createPool(dbConfig) {
  return mysql.createPool({
    host: dbConfig.host,
    port: dbConfig.port,
    user: dbConfig.user,
    password: dbConfig.password,
    database: dbConfig.database,
    ssl: dbConfig.ssl, // só definido quando o banco hospedado exige SSL (ver DB_SSL_CA em .env.example)
    waitForConnections: true,
    connectionLimit: 10,
    charset: 'utf8mb4',
    timezone: 'Z', // datas sempre em UTC, igual em qualquer computador do grupo
    decimalNumbers: true, // DECIMAL (ex.: notas 7.5) volta como número, não como texto
    namedPlaceholders: true, // permite WHERE id = :id além do "?"
  });
}
