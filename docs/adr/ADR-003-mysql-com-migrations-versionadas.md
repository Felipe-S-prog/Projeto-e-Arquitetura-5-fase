# ADR-003: MySQL como banco e estrutura criada por migrations versionadas

## Contexto
O sistema relaciona usuários, turmas, questões, provas, aplicações, cópias e correções, com integridade entre elas (uma aplicação liga uma prova a uma turma; uma prova tem várias questões, cada uma com sua pontuação). O MySQL é exigido pela stack da disciplina. Como todos criam o banco na própria máquina, também era preciso garantir que a estrutura fosse idêntica para todos e evoluísse sem que cada um alterasse o banco à mão.

## Decisão
- Banco **relacional MySQL 8** (InnoDB, utf8mb4), acessado com `mysql2` por pool de conexões.
- A estrutura é criada por **migrations SQL numeradas** em `server/database/migrations/` (`001_criar_tabelas.sql`, `002_...`, `003_...`), aplicadas por `npm run db:migrate`.
- Cada migration roda **uma única vez por banco**: o nome fica gravado na tabela `schema_migrations`, junto com um checksum que detecta migration editada depois de aplicada.
- Regra do grupo: migration já aplicada não se edita; qualquer mudança vira uma nova migration.
- O modelo (MER/DER) e o dicionário de dados ficam em `docs/modelo-dados/`; a migration 001 (PR #20) implementa esse modelo, com 14 tabelas.
- Enums em MAIÚSCULAS no banco (por exemplo `RASCUNHO`, `PRONTA`); os models da API os convertem para os textos que o front usa (`Rascunho`, `Pronta`).

## Consequências
- Facilita: todos têm o mesmo banco; o histórico das mudanças do banco fica no Git e passa por revisão como o resto do código.
- Custa: quem quer rodar o projeto precisa de um MySQL 8 local (ou do `docker-compose.yml` do `server/`) e de executar as migrations; corrigir um erro em tabela já aplicada exige uma nova migration, não uma edição.
