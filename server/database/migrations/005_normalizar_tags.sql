-- T79: unifica tags existentes e preserva todos os vínculos.
-- Executar com npm run db:migrate antes de publicar a API; pausar escritas durante a migração.
START TRANSACTION;
CREATE TEMPORARY TABLE tags_normalizadas (
  id INT UNSIGNED PRIMARY KEY,
  nome VARCHAR(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL
);
INSERT INTO tags_normalizadas (id, nome)
SELECT id, CASE WHEN normalizada IN ('mat', 'matemat') THEN 'matematica' ELSE normalizada END
FROM (SELECT id, REGEXP_REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(LOWER(TRIM(REGEXP_REPLACE(nome, '[[:space:]]+', ' '))), 'á', 'a'), 'à', 'a'), 'â', 'a'), 'ã', 'a'), 'ä', 'a'), 'é', 'e'), 'è', 'e'), 'ê', 'e'), 'ë', 'e'), 'í', 'i'), 'ì', 'i'), 'î', 'i'), 'ï', 'i'), 'ó', 'o'), 'ò', 'o'), 'ô', 'o'), 'õ', 'o'), 'ö', 'o'), 'ú', 'u'), 'ù', 'u'), 'û', 'u'), 'ü', 'u'), 'ç', 'c'), 'ñ', 'n'), '[̀-ͯ]', '') AS normalizada FROM tag) AS origem;
CREATE TEMPORARY TABLE tags_destino (
  nome VARCHAR(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin PRIMARY KEY,
  id INT UNSIGNED NOT NULL
);
INSERT INTO tags_destino (nome, id)
SELECT nome, MIN(id) FROM tags_normalizadas GROUP BY nome;
INSERT IGNORE INTO questao_tag (questao_id, tag_id)
SELECT qt.questao_id, d.id
FROM questao_tag qt
JOIN tags_normalizadas n ON n.id = qt.tag_id
JOIN tags_destino d ON d.nome = n.nome;
DELETE qt FROM questao_tag qt
JOIN tags_normalizadas n ON n.id = qt.tag_id
JOIN tags_destino d ON d.nome = n.nome
WHERE n.id <> d.id;
DELETE t FROM tag t
JOIN tags_normalizadas n ON n.id = t.id
JOIN tags_destino d ON d.nome = n.nome
WHERE n.id <> d.id;
UPDATE tag t JOIN tags_destino d ON d.id = t.id SET t.nome = d.nome;
DROP TEMPORARY TABLE tags_destino;
DROP TEMPORARY TABLE tags_normalizadas;
COMMIT;
