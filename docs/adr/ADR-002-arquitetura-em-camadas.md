# ADR-002: API em camadas (rota → controller → service → repository → model)

## Contexto
Cinco pessoas desenvolvem a API em paralelo, cada uma em uma frente (Autenticação, Turmas e Questões, Provas e Aplicações, PDF e Gabarito, Correção e Notas). Sem um padrão comum, cada recurso teria sua própria organização, as regras de negócio ficariam espalhadas e o código seria difícil de revisar e de testar.

## Decisão
Toda a API (`server/`) segue o mesmo caminho para qualquer requisição:

`rota → controller → service → repository → MySQL`, com o **model** convertendo a linha do banco no objeto que a API devolve.

- A **rota** só liga o endereço ao controller.
- O **controller** lê a requisição e devolve a resposta.
- O **service** concentra as regras de negócio e as validações.
- O **repository** é a única camada que fala SQL.
- A dependência é sempre de cima para baixo. Erros usam um helper comum (`AppError`) e um `errorHandler` único.

Cada recurso novo é criado como `createXRoutes({ pool })`, e os services são testados com repositórios falsos (`node --test`), sem precisar de banco.

## Consequências
- Facilita: qualquer pessoa do grupo sabe onde procurar cada coisa; as regras são testáveis sem banco; trocar o banco ou a forma de acesso mexe só no repository.
- Custa: para um CRUD simples há mais arquivos do que o mínimo necessário (cinco por recurso).

Documento completo, com o caminho de uma requisição passo a passo: `docs/arquitetura/arquitetura-em-camadas.md` (PR #24).
