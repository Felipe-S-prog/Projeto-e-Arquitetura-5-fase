# T22 - Módulo de montagem do PDF consolidado

## Onde colocar

Copie a pasta `client/src/pdf/` para dentro de `client/src/` do projeto (4 arquivos novos, nenhum arquivo existente é alterado).

Depende dos arquivos de QR da T21 (`utils/qrCode.js`, `utils/qrPath.js`, `utils/qrPayload.js`). Instale as bibliotecas dentro de `client/`:

```
npm install pdf-lib qrcode jsqr
```

## O que cada arquivo faz

| Arquivo | Função |
|---|---|
| `buildConsolidatedPdf.js` | Monta UM PDF com todas as cópias em sequência (cabeçalho, orientações, quadro de resposta com QR Code e questões na ordem embaralhada de cada cópia). |
| `sheetLayout.js` | Posição de cada elemento do quadro de resposta (QR, 4 quadrados pretos dos cantos, bolinhas). É a fonte única: o PDF desenha a partir dele e a correção automática (T30) deve ler a foto usando o mesmo arquivo. |
| `pdfText.js` | Tratamento de texto para as fontes do PDF (troca símbolos que a fonte não tem, quebra de linha). |
| `loadQuestionImages.js` | Converte as imagens das questões para PNG no navegador, para entrarem no PDF. |

## Como usar (a ligação com o botão "Baixar todas em PDF" é a T25)

```js
import { buildConsolidatedPdf } from '../pdf/buildConsolidatedPdf';
import { loadQuestionImages } from '../pdf/loadQuestionImages';

const { images, failed } = await loadQuestionImages(questions);
const { bytes, pageCount, copies, warnings } = await buildConsolidatedPdf({
  exam,            // { title }
  className, date, institution,
  questions,       // { id, excerpt, alternatives: [{ text }], score, imageUrl }
  copies,          // cópias de utils/answerKey.js (buildApplicationCopies)
  images,
  mode: 'completo',   // ou 'folha-de-resposta' (só a folha de cada cópia)
  duplex: false,      // true: cada cópia termina em página par (frente e verso)
});

const url = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));
```

`failed` (imagens que não carregaram) e `warnings` podem ser mostrados ao professor.
`copies` do retorno informa a página inicial e a quantidade de páginas de cada cópia.

## Limites

- No máximo 25 questões e de 2 a 5 alternativas por questão (acima disso o módulo para com uma mensagem em português, antes de montar o PDF).
- A fonte do PDF (Helvetica) não tem os símbolos ≤ ≥ ≠ → √ π: eles saem como texto (`<=`, `>=`, `!=`, `->`, `raiz de`, `pi`). Qualquer outro caractere sem suporte vira `?`.
- Cada questão fica inteira na mesma página; só uma questão maior que uma página é dividida.
