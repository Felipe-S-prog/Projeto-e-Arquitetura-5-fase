-- Correção e Notas (T29/T30): resposta de cada questão em uma correção.
-- A tabela correcao (migration 001) guarda só a nota final; aqui fica o que o
-- aluno marcou em cada questão, para mostrar o acerto/erro de cada uma, montar
-- a taxa de acerto por questão nos relatórios e reabrir uma correção já feita.

CREATE TABLE `correcao_resposta` (
  `correcao_id` INT UNSIGNED NOT NULL COMMENT 'Correção a que a resposta pertence',
  `questao_id` INT UNSIGNED NOT NULL COMMENT 'Questão respondida',
  `numero` TINYINT UNSIGNED NOT NULL COMMENT 'Número da questão como foi impressa nesta cópia (1 a 20)',
  `letra_marcada` CHAR(1) NULL COMMENT 'Letra marcada pelo aluno, na ordem impressa da cópia; nulo quando ficou em branco ou é discursiva',
  `correta` TINYINT(1) NULL COMMENT '1 se a letra marcada é a correta; nulo nas discursivas',
  `pontos` DECIMAL(5,2) NOT NULL COMMENT 'Pontos obtidos na questão',
  PRIMARY KEY (`correcao_id`, `questao_id`),
  UNIQUE KEY `uq_correcao_resposta_correcao_id_numero` (`correcao_id`, `numero`),
  KEY `idx_correcao_resposta_questao_id` (`questao_id`),
  CONSTRAINT `fk_correcao_resposta_correcao_id` FOREIGN KEY (`correcao_id`) REFERENCES `correcao` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_correcao_resposta_questao_id` FOREIGN KEY (`questao_id`) REFERENCES `questao` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `ck_correcao_resposta_1` CHECK (letra_marcada IN ('A','B','C','D','E')),
  CONSTRAINT `ck_correcao_resposta_2` CHECK (pontos >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='Respostas de uma correção, uma por questão da prova (T29/T30).';
