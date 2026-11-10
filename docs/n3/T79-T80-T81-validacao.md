# N3 — T79, T80 e T81 — Camila Texeira

## Alterações

- T79: normalização idêntica na API e na interface (caixa, acentos, espaços e aliases explícitos mat/matemat → matematica); sugestões clicáveis das tags das questões carregadas do professor; filtro por tag normalizada. Não há associação aproximada de palavras arbitrárias.
- A migration 005 agrupa as tags existentes e transfere os vínculos antes de remover duplicatas. Aplicar com `npm run db:migrate`, pausando escritas durante a migração.
- T80: no código atual o título “HISTÓRICO DE APLICAÇÕES NESTA TURMA” já está correto. Foi encontrado “Abrir ÔåÆ”; corrigido para “Abrir →”. Nome da turma, nomes de alunos e títulos das provas ganham quebra de texto; os cartões do histórico se reorganizam em telas estreitas. O relato original pode envolver outro texto: esta entrega corrige o defeito identificável no código.
- T81: editar turma arquivada liberado na API e na interface; removido bloqueio de nomes repetidos no cliente, que não existia na API. Limites de campos e identidade do professor são mantidos.
- Exclusão de questões continua lógica, sem apagar provas e correções; erros agora aparecem na lista.
- Novo botão de excluir turma: sem aplicações, exclui turma e matrículas mantendo o cadastro dos alunos; com aplicações, arquiva e informa que o histórico foi preservado. A verificação e a alteração ocorrem em transação, com bloqueio do registro.
- Avisos explicam o efeito da edição/exclusão nos vínculos. Turmas arquivadas continuam sem receber novas matrículas/aplicações: preserva-se o significado do arquivamento.

## Verificação automatizada

- `node --test test/tags.test.js`: normalização, aliases, sugestões, termos distintos e equivalência entre cliente e API.
- `node --test test/turmas-questoes.routes.test.js`: roteador Express real com pool simulado, sem abrir portas; edição arquivada/sem alteração, exclusão com/sem aplicações, isolamento do professor e rollback em erro.
- `N3_MYSQL_TEST=true N3_MYSQL_PASSWORD=... node --test test/tags-migration.test.js`: MySQL 8 em banco descartável exclusivo; duplicatas com acentos compostos/decompostos, espaços, múltiplos vínculos, preservação e reaplicação da migration.
- Workflow N3: suíte completa da API, migration em MySQL 8, lint e build do frontend.
- Validação local: 124 testes passaram (incluindo os 11 novos), 1 teste MySQL não executado; build do frontend concluído; lint sem erros (avisos preexistentes de hooks/Fast Refresh).
- As dependências já instaladas no projeto foram reutilizadas porque não há DNS para o npm. Os testes HTTP da suíte existente falham com EACCES nas conexões de loopback deste ambiente; o teste MySQL e o aceite visual ainda precisam ser executados. O workflow completo ainda não foi executado.

## Roteiro de aceite visual (ainda necessário)

1. Criar questões com Matematica, matemática, MAT e matemat. Recarregar: uma tag matematica; ao digitar mat, selecionar a sugestão; filtrar e verificar todas as questões.
2. Confirmar que Física e Química continuam distintas e que tags do outro professor não aparecem nas sugestões.
3. Abrir turma com nome de 100 caracteres e prova com título de 150 caracteres, com acentos, em tela larga e estreita. Conferir rótulo Abrir →, nomes e teclado Enter/Espaço no histórico.
4. Editar nome/disciplina/período de turma ativa e arquivada; recarregar para confirmar persistência.
5. Excluir turma sem aplicações: ela sai da lista, alunos continuam nas outras turmas. Excluir turma com aplicações: é arquivada, cópias/notas continuam consultáveis.
6. Excluir questão usada em prova: sai do banco de questões, mas a prova continua acessível. Confirmar aviso antes de alterar uma questão vinculada.
7. Com dois professores, confirmar que um não altera/exclui registros do outro.

As tarefas T47, T75, T48 e T67 permanecem fora deste conjunto por serem de prioridade média.
