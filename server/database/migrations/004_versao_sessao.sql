ALTER TABLE usuario
ADD COLUMN versao_sessao INT UNSIGNED NOT NULL DEFAULT 0
COMMENT 'Versão da sessão usada para invalidar access tokens';