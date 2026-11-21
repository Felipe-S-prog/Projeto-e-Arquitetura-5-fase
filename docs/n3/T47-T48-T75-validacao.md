# Turmas e Questões — Camila — 16/11/2026

## Entrega

- T47 (14/11): remoção de matrícula pelo professor, com confirmação. Remove somente `matricula`; preserva aluno, cópias e correções. Turma arquivada não permite alterar matrículas.
- T75 (15/11): importação CSV UTF-8 (inclusive exportado pelo Excel), separador vírgula ou ponto e vírgula, aspas e BOM. Cabeçalho `nome,email,matricula` (matrícula opcional). Até 500 alunos e 500 KB. Resumo de importados e recusados com linha e motivo. Arquivo malformado não grava; falha de banco reverte toda a importação. Não altera o cadastro de um aluno existente.
- T48 (17/11): testes de validação, isolamento, duplicados, rollback, autenticação, upload PNG e rejeição de conteúdo falso. Teste MySQL separado para duas matrículas simultâneas e preservação de notas.
- Escopo: retirados código/link de convite da tela, regeneração e ingresso público da API. O professor cadastra/importa os alunos; não existe acesso do aluno à turma. O gabarito público permanece disponível.
- Texto `eta Remover última` corrigido. Setas das listas estão corretas no código; a correção do histórico está na PR #60.

## API

Todas as rotas abaixo exigem JWT de professor e verificam a propriedade da turma.

| Método | Rota | Resultado |
| --- | --- | --- |
| POST | `/api/turmas/:id/matriculas` | 201 com aluno; 400 para inválido, duplicado ou arquivada; 404 para turma alheia/inexistente |
| DELETE | `/api/turmas/:id/matriculas/:alunoId` | 200, preservando histórico; 404 para matrícula ausente; 400 para arquivada |
| POST | `/api/turmas/:id/matriculas/importar` | JSON `{ "csv": "nome,email\nAna,ana@example.com" }`; retorna `total`, `imported` e `rejected` |

As alterações de matrícula usam transação e `SELECT ... FOR UPDATE` na turma. A chave única do e-mail e a chave composta da matrícula evitam duplicados. O fluxo manual e a importação compartilham a mesma implementação.

## Evidências e limites

- Execução pelo terminal do VS Code: 161 testes, 160 aprovados, 0 falhas, 1 ignorado (migração MySQL). Essa execução ocorreu antes da inclusão do teste adicional de concorrência MySQL.
- Build do client aprovado. Lint sem erros, com avisos existentes sobre efeitos/hooks.
- PR #60, commit `9794ef4`: Actions `42823802073`, job `129855715877`: 150 testes aprovados, 0 ignorados. Inclui migração MySQL 8 com duplicadas, preservação de vínculos e repetição da migração. Lint e build passaram. Evidência anterior, não valida automaticamente este novo commit.
- O teste de concorrência MySQL usa banco descartável próprio `sgp_matriculas_test_<pid>`; nunca lê `DB_NAME` da aplicação. Roda quando `N3_MYSQL_TEST=true`, como no workflow existente.
- A validação visual completa, importação no navegador e verificação no sistema hospedado continuam pendentes. Não foram usados dados do banco compartilhado.

## Próximas tarefas do backlog

| Tarefa | Prazo | Situação |
| --- | --- | --- |
| T79/T80/T81 | 10–13/11 | Implementadas na PR #60; CI/MySQL comprovados acima; falta conferência visual |
| T47/T75 | 14–15/11 | Implementadas nesta branch; revisar e validar visualmente |
| T48 | 17/11 | Testes adicionados; conferir nova execução MySQL no Actions |
| T67 | 21/11 | Depende de T66, ainda não incluída nesta entrega |
| T88 | 22/11 | Depende do guia T86; não antecipar padrões sem o guia |
| T68 | 23/11 | Fechamento após integrações e confirmação do publicado |
| T70 | 24/11 | Diário individual após fechamento |

## Compatibilidade com PRs abertas

Esta branch integra a PR #60 à main para validar o conjunto. Mesclar a #60 primeiro faz suas alterações desaparecerem do diff desta PR. Não foram integradas automaticamente implementações dos colegas.

| PR | Observação em 16/11 |
| --- | --- |
| #60 | Nossa base de tags/histórico/edição de turmas; ainda aberta |
| #61 | Impressão e fotografia reais pendentes; não substituídas pela simulação |
| #68 | Bloqueio de regeração após correção; preservar ao integrar aplicações |
| #93 | Documentação precisa refletir a retirada do administrador |
| #94 | GitHub informa conflito com main; revisar integração de AnswerKey antes de merge |
| #96 | GitHub informa conflito com main; atualizar testes antes de merge |
| #97 | Estatísticas das alternativas; validar com relatórios T66 antes de T67 |
| #99/#100 | Autenticação/anonimização do Bruno; não alteradas aqui |
| #101 | Deploy do front após push em main com client/**; primeiro deploy depende de merge e verificação no Actions |

Não foram removidos dados do banco, aprovadas PRs, feitos merges na main ou alteradas configurações de hospedagem.
