# API — Correção e Notas

Frente de **Correção e Notas** do SGP (tarefas T29 a T33 do backlog): correção automática a partir do
QR Code da cópia, lançamento manual de nota, relatórios de notas e histórico do aluno.

- Base: `http://localhost:3333/api` (local) — todas as rotas abaixo ficam sob ela.
- **Professor:** enquanto o login com JWT (T07) não existe, toda requisição informa `professor_id`
  (na query ou no corpo). Sem ele a resposta é `401 UNAUTHORIZED`. Quando a autenticação entrar, o id
  passa a vir do token (`req.user`) e as rotas não mudam (ver `server/src/middlewares/professorContext.js`).
- **Isolamento (RNF04):** cada consulta filtra pelo professor dono da prova/turma. Cópia, aplicação,
  turma ou aluno de outro professor respondem `404`, como se não existissem.
- Erros seguem o formato padrão da API: `{ "error": { "code", "message", "details"? } }`.

## Como a correção funciona

1. O professor lê o QR Code da folha (ou digita o código impresso nela). O QR contém `SGP1:<código>`.
2. A API devolve a cópia **como foi impressa**: questões na ordem embaralhada daquela cópia e
   alternativas com as letras impressas (A, B, C...). O gabarito não vem nessa resposta.
3. O professor informa a letra marcada em cada objetiva (ou nada, se ficou em branco/anulada) e os
   pontos de cada discursiva.
4. A API calcula a nota: soma a pontuação (`prova_questao.pontuacao`) das objetivas certas com os
   pontos dados nas discursivas, e grava a correção e cada resposta (`correcao` + `correcao_resposta`).

A ordem embaralhada vem de `copia_prova.ordem_embaralhamento`, no mesmo formato gerado pelo front
(`client/src/utils/answerKey.js`) e usado pelo PDF:

```json
{ "questionIds": [12, 7, 9], "alternativesOrder": { "12": [2, 0, 3, 1], "7": [1, 0, 2, 3], "9": [] } }
```

`alternativesOrder[questão]` lista a posição original (`alternativa.ordem`) de cada alternativa na ordem
impressa: no exemplo, a letra **A** da questão 12 é a alternativa de `ordem = 2`.

Regras:

- Uma correção por cópia. Corrigir de novo exige `"substituir": true` (sem isso: `409 CONFLICT`, com a nota
  anterior em `details`).
- Cópia **nominal**: a nota é sempre do aluno impresso nela.
- Cópia **anônima** (prova gerada sem identificação): o professor associa a nota a um aluno matriculado na
  turma da aplicação. É obrigatório no lançamento manual e opcional na correção pelas respostas.
- Um aluno não pode ter duas notas na mesma aplicação (`409`).
- Nota manual: de 0 até a nota máxima da prova, com no máximo 2 casas decimais.

## Endpoints

| Método | Rota | Descrição |
|---|---|---|
| GET | `/correcoes/copias/:codigo` | Cópia lida no QR, pronta para corrigir (questões impressas, alunos da turma se for anônima e a correção existente) |
| POST | `/correcoes` | Correção automática pelas respostas marcadas |
| POST | `/correcoes/manual` | Lançamento manual da nota |
| GET | `/correcoes/:id` | Correção com as respostas e o gabarito da cópia |
| DELETE | `/correcoes/:id` | Exclui a correção (a nota sai dos relatórios e do histórico) |
| GET | `/relatorios/aplicacoes` | Aplicações do professor com total de cópias, corrigidas e média |
| GET | `/relatorios/aplicacoes/:id` | Notas da aplicação, estatísticas e desempenho por questão |
| GET | `/relatorios/aplicacoes/:id/csv` | Exportação das notas da aplicação (CSV para Excel) |
| GET | `/relatorios/turmas` | Turmas do professor (para escolher o consolidado) |
| GET | `/relatorios/turmas/:id` | Consolidado da turma: alunos × aplicações, média de cada aluno e da turma |
| GET | `/relatorios/turmas/:id/csv` | Exportação do consolidado (CSV para Excel) |
| GET | `/alunos/:id/historico` | Histórico de notas e desempenho do aluno nas turmas do professor |

### POST `/correcoes`

```json
{
  "professor_id": 1,
  "codigo": "DEMA33",
  "alunoId": 9002,
  "substituir": false,
  "respostas": [
    { "questaoId": 9003, "letra": "C" },
    { "questaoId": 9001, "letra": null },
    { "questaoId": 9005, "pontos": 1.5 }
  ]
}
```

`alunoId` só é usado em cópia anônima. Objetiva sem resposta enviada conta como em branco; discursiva
precisa dos pontos (de 0 até a pontuação da questão). Resposta `201`:

```json
{
  "id": 1,
  "nota": 7.5,
  "notaMaxima": 10,
  "percentual": 75,
  "tipo": "AUTOMATICA",
  "aluno": { "id": 9002, "nome": "Bruno Cardoso Lima", "email": "...", "matricula": "2026002" },
  "copia": { "id": 9002, "codigo": "DEMA33", "rotulo": "Bruno Cardoso Lima" },
  "respostas": [
    { "numero": 1, "questaoId": 9003, "tipo": "OBJETIVA", "letraMarcada": "C", "letraCorreta": "C", "correta": true, "pontos": 2, "pontuacao": 2 }
  ]
}
```

### POST `/correcoes/manual`

```json
{ "professor_id": 1, "codigo": "DEMB22", "alunoId": 9005, "nota": 8.5, "substituir": false }
```

### Erros mais comuns

| Situação | Status | `code` |
|---|---|---|
| Sem `professor_id` (ou inválido) | 401 | `UNAUTHORIZED` |
| Código fora do formato, letra inexistente na questão, pontos/nota fora do intervalo, discursiva sem pontos, aluno fora da turma, cópia anônima sem aluno no lançamento manual | 400 | `BAD_REQUEST` |
| Código de cópia que não é do professor, correção/aplicação/turma/aluno inexistente | 404 | `NOT_FOUND` |
| Cópia já corrigida sem `substituir`, aluno já tem nota na aplicação, cópia inconsistente com a prova | 409 | `CONFLICT` |

## Exportação (CSV)

Os relatórios em CSV abrem direto no Excel em português: separador `;`, vírgula decimal, acentos
preservados (UTF-8 com BOM) e proteção contra fórmulas em células de texto. O nome do arquivo vem no
cabeçalho `Content-Disposition` (liberado para o front pelo CORS).

## Banco de dados

A migration `003_correcao_respostas.sql` cria `correcao_resposta`: uma linha por questão da correção, com
o número impresso na cópia, a letra marcada, se acertou e os pontos obtidos. É ela que permite reabrir uma
correção, mostrar as respostas no histórico e calcular a taxa de acerto por questão. (O número `002` ficou
para a migration de configurações da frente de Administração.)

## Testando

```bash
cd server
npm run db:migrate
npm run db:seed     # turma, alunos, prova e cópias de demonstração (códigos em database/seeds/001_demo_correcao.sql)
npm run dev
npm test            # testes automáticos da correção e dos relatórios, sem MySQL
```

No front (`client`, `npm run dev`): menu **Correção** → digite `DEMA33` (nominal) ou `DEMB22` (anônima).
Depois veja **Relatórios** e clique no nome de um aluno para abrir o histórico.
