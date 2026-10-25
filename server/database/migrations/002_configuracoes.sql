
CREATE TABLE IF NOT EXISTS configuracoes (
  id TINYINT UNSIGNED NOT NULL PRIMARY KEY,
  nome_instituicao VARCHAR(255) NOT NULL,
  periodo_padrao VARCHAR(20) NOT NULL,
  atualizado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO configuracoes (id, nome_instituicao, periodo_padrao)
VALUES (1, 'Católica de Santa Catarina', '2026/2')
ON DUPLICATE KEY UPDATE id = id;
