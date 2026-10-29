# API — Cópias da prova e gabarito

Frente de **Geração de PDF e Gabarito** do SGP (tarefa T23 do backlog): as cópias de cada aplicação
deixam de ficar só na memória do navegador e passam a ser geradas e gravadas pelo servidor na tabela
`copia_prova`, junto com a publicação do gabarito.

- Base: `http://localhost:3333/api` (local) — todas as rotas abaixo ficam sob ela.
- **Professor:** todas as rotas exigem `Authorization: Bearer <accessToken>` (T07); o professor vem do token.
- **Isolamento (RNF04):** a cópia é do professor dono da prova da aplicação. Aplicação de outro professor
  responde `404`, como se não existisse.
- Erros seguem o formato padrão da API: `{ "error": { "code", "message", "details"? } }`.

## Como a geração funciona

1. O professor configura a aplicação (quantidade, embaralhar questões, embaralhar alternativas) pela API
   de aplicações (T18).
2. `POST /aplicacoes/:id/copias` gera uma cópia por pessoa: cada uma com um código de 6 caracteres único no
   banco (sem `0/O` e `1/I`) e sua própria ordem de questões e de alternativas. Gerar de novo troca todas as
   cópias da aplicação; os códigos antigos nunca são reaproveitados.
3. Ao confirmar o download do PDF (`POST /aplicacoes/:id/aplicar`), a aplicação vira **Aplicada** e as
   cópias ficam fixas, porque os códigos já foram impressos.

A ordem fica em `copia_prova.ordem_embaralhamento`, no formato que a correção (T30) e o PDF (T22) leem:

```json
{ "questionIds": [12, 7, 9], "alternativesOrder": { "12": [2, 0, 3, 1], "7": [1, 0, 2, 3], "9": [] } }
```

Regras:

- Só gera enquanto a aplicação está **Pendente** (`409` depois de Aplicada).
- Não regera uma aplicação que já tem correção lançada (`409`), para não apagar notas.
- A prova precisa ter ao menos uma questão (`409`).
- Gerar uma cópia por aluno matriculado ("vincular à turma") fica para a T24 (`409` por enquanto).
- Publicar o gabarito não tem volta e nunca revela nota; quem já estava publicado mantém a data.

## Endpoints

| Método | Caminho | O que faz |
|---|---|---|
| `GET` | `/copias` | Todas as cópias do professor (o front carrega junto com as aplicações). |
| `GET` | `/aplicacoes/:id/copias` | Cópias de uma aplicação. |
| `POST` | `/aplicacoes/:id/copias` | Gera (ou regera) as cópias da aplicação. Responde `201` com a lista. |
| `POST` | `/aplicacoes/:id/copias/gabarito` | Publica o gabarito. Corpo `{ "code": "ABC234" }` publica uma cópia; corpo vazio publica todas. |

Cada cópia volta neste formato (o mesmo que as telas já usavam):

```json
{
  "id": 41,
  "applicationId": 7,
  "code": "MXH2HE",
  "label": "Prova #02",
  "studentId": null,
  "studentName": null,
  "questionIds": [9003, 9004, 9001],
  "alternativesOrder": { "9001": [0, 3, 1, 2], "9003": [1, 0, 2, 3], "9004": [1, 0, 2, 3] },
  "answerKeyPublished": false,
  "answerKeyPublishedAt": null
}
```

## Consulta pública do gabarito (T26)

`GET /gabarito/:codigo` é **pública** (sem `Authorization`): é a consulta que o aluno faz na página
`/gabarito` digitando o código impresso na prova. O aluno não tem conta no sistema (RF03).

- Só responde depois que o professor publicou o gabarito daquela cópia (`POST /aplicacoes/:id/copias/gabarito`).
- Devolve só o título da prova e a letra certa de cada questão, na ordem **impressa** daquela cópia. Nunca
  devolve nota, pontuação, nome do aluno ou dados do professor. Questão discursiva vem com `correctLetter: null`.
- `Cache-Control: no-store`, para a publicação aparecer na hora.
- Código inexistente: `404`. Gabarito ainda não publicado: `403`. Código em formato inválido: `400`.

```json
{
  "code": "DEMA33",
  "examTitle": "Prova Demo - Derivadas e Integrais",
  "publishedAt": "2026-10-28T12:00:00.000Z",
  "answers": [{ "number": 1, "correctLetter": "C" }, { "number": 2, "correctLetter": "B" }, { "number": 3, "correctLetter": null }]
}
```

## PDF consolidado (T25)

`GET /aplicacoes/:id/pdf` monta no servidor **um** PDF com todas as cópias gravadas da aplicação, em
sequência (folha de resposta com QR Code e páginas de questões, cada cópia com a sua ordem), e devolve como
download (`Content-Disposition: attachment; filename="provas-<prova>-<turma>.pdf"`).

| Parâmetro (query) | Valores | Padrão |
|---|---|---|
| `modo` | `completo` (folha + questões) ou `folha-de-resposta` | `completo` |
| `frenteVerso` | `true` para cada cópia terminar em página par | `false` |

- Cabeçalhos extras: `X-Pdf-Paginas` (total de páginas) e `X-Pdf-Avisos` (lista em JSON, com
  `encodeURIComponent`), por exemplo uma imagem de questão que não pôde ser incluída.
- Sem cópias geradas: `409`. Dado que o PDF não consegue imprimir (ex.: questão sem alternativas): `409` com o motivo.
- Baixar **não** muda o banco. A tela baixa o arquivo e só depois chama `POST /aplicacoes/:id/aplicar`; se o PDF
  falhar, a aplicação continua Pendente.
- Imagens das questões: as enviadas pelo upload (T12, `/uploads/questoes/<arquivo>`) são lidas direto da
  pasta do servidor, só de dentro dela; endereços de fora são baixados (só `http`/`https`, 8 s). Até 5 MB, e só
  PNG ou JPG entram no PDF: WEBP e GIF saem com aviso.

## Gabarito em PDF (T27)

`GET /aplicacoes/:id/pdf/gabarito` monta **um** PDF com o gabarito de todas as cópias da aplicação, para o
professor enviar às pessoas (ex.: pelo Teams), e devolve como download
(`filename="gabarito-<prova>-<turma>.pdf"`; páginas em `X-Pdf-Paginas`).

- Para cada cópia, um quadro com o rótulo (nome do aluno ou "Prova #NN"), o código impresso e a letra certa de
  cada questão na ordem **impressa** daquela cópia. Discursiva aparece como "disc.". Nunca traz nota ou pontuação.
- As letras saem do mesmo cálculo da consulta pública (`resolverGabarito`, T26): o PDF e a página `/gabarito`
  sempre batem.
- Não exige que o gabarito esteja publicado: o arquivo é do professor, que decide quando enviar.
- Sem cópias geradas: `409`. Aplicação de outro professor: `404`.

## Onde está o código

`server/src/routes/copia.routes.js` → `controllers/copia.controller.js` → `services/copia.service.js`
(regras) e `services/copia.geracao.js` (sorteio, sem banco) → `repositories/copia.repository.js` →
`models/copia.model.js`. Testes em `server/test/copia.geracao.test.js` e `server/test/copia.service.test.js`.

Gabarito público (T26): `routes/gabarito.routes.js` → `controllers/gabarito.controller.js` →
`services/gabarito.service.js` (inclui `resolverGabarito`) → `repositories/gabarito.repository.js`. Testes em
`server/test/gabarito.service.test.js` e `server/test/gabarito.routes.test.js`.

PDF (T25): `routes/pdf.routes.js` → `controllers/pdf.controller.js` → `services/pdf.service.js` →
`repositories/pdf.repository.js`. O montador (T22) fica em `server/src/pdf/` (`buildConsolidatedPdf.js`,
`sheetLayout.js`, `pdfText.js`, `qr.js` e `questionImages.js`). Testes em `server/test/pdf.service.test.js`
e `server/test/questionImages.test.js`.

Gabarito em PDF (T27): mesma rota, controller, service (`gerarGabarito`) e repository do PDF; o montador é
`server/src/pdf/buildAnswerKeyPdf.js`. Testes em `server/test/buildAnswerKeyPdf.test.js` e no
`server/test/pdf.service.test.js`.
