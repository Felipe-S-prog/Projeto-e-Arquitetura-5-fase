# Desempenho do PDF consolidado (T60)

Medição do tempo de geração e do tamanho do PDF das provas, com e sem identificação, com várias versões e com turma grande. O PDF é montado no servidor por [`server/src/pdf/buildConsolidatedPdf.js`](../server/src/pdf/buildConsolidatedPdf.js) (T22/T25).

## Resumo

- O tempo cresce de forma linear com o número de cópias: cerca de **10 ms por cópia** na prova completa e 3 a 4 ms por cópia só com a folha de resposta.
- Uma turma de **35 alunos** com prova nominal de 10 questões gera **105 páginas e 325 KB em cerca de 0,3 s** pela API, com banco e rede local.
- Com 100 cópias o PDF fica em torno de **1 s e 1 MB**.
- Identificar as cópias com o nome do aluno não muda o tempo nem o tamanho de forma perceptível.
- As imagens das questões entram uma vez no arquivo e são reaproveitadas por todas as cópias: o PDF cresce o tamanho das imagens, não as imagens vezes o número de cópias.

## Montador isolado

Script reproduzível, sem banco e sem rede, com uma prova típica de 10 questões objetivas de 5 alternativas (enunciados de duas linhas). Cada cópia tem a própria ordem de questões e de alternativas, como a geração das cópias faz. Para rodar, na pasta `server`:

```bash
npm run pdf:medir
```

Resultado em 14/11/2026 (Node v24.20.0, AMD Ryzen 5 5500, 12 núcleos, Windows). Mediana de 5 execuções por cenário, depois de uma de aquecimento:

| Cópias | Identificação | Modo | Imagens | Páginas | Tamanho | Tempo (mediana) | Por cópia |
|---|---|---|---|---|---|---|---|
| 4 | sem nome | completo | 0 | 12 | 38 KB | 40 ms | 9,9 ms |
| 4 | com nome | completo | 0 | 12 | 39 KB | 39 ms | 9,7 ms |
| 30 | sem nome | completo | 0 | 90 | 282 KB | 296 ms | 9,9 ms |
| 30 | com nome | completo | 0 | 90 | 285 KB | 296 ms | 9,9 ms |
| 40 | com nome | completo | 0 | 120 | 379 KB | 389 ms | 9,7 ms |
| 100 | com nome | completo | 0 | 300 | 947 KB | 1.073 ms | 10,7 ms |
| 4 | com nome | completo | 2 | 16 | 122 KB | 51 ms | 12,7 ms |
| 40 | com nome | completo | 2 | 160 | 490 KB | 416 ms | 10,4 ms |
| 100 | com nome | completo | 2 | 400 | 1.102 KB | 1.025 ms | 10,3 ms |
| 40 | com nome | só folha | 0 | 40 | 217 KB | 128 ms | 3,2 ms |
| 100 | com nome | só folha | 0 | 100 | 540 KB | 375 ms | 3,7 ms |

As imagens do script são PNGs de 400 × 300 (cerca de 40 KB cada). Com imagens, a questão ocupa mais espaço e a prova passa de 3 para 4 páginas por cópia.

## Ponta a ponta no sistema

Medido pela API local (`GET /api/aplicacoes/:id/pdf`), com MySQL no Docker, numa turma de 35 alunos matriculados pelo código de convite e uma prova de 10 questões objetivas de 5 alternativas. O tempo inclui as consultas ao banco, a montagem e a transferência do arquivo. Mediana de 5 downloads depois de um de aquecimento:

| Cenário | Páginas | Tamanho | Tempo (mediana) | Mín.–máx. |
|---|---|---|---|---|
| 35 cópias nominais (uma por aluno), prova completa | 105 | 325 KB | 315 ms | 298–473 ms |
| 35 cópias sem identificação, prova completa | 105 | 323 KB | 323 ms | 298–510 ms |
| 35 cópias nominais, só a folha de resposta | 35 | 189 KB | 138 ms | 127–286 ms |
| 35 cópias nominais, frente e verso | 140 | 336 KB | 333 ms | 301–475 ms |
| Gabarito das 35 cópias em PDF (T27) | 4 | 20 KB | 24 ms | 24–25 ms |

Gerar as 35 cópias (`POST /api/aplicacoes/:id/copias`, uma por aluno, todas com ordem diferente) levou cerca de 30 ms. A tela de teste do PDF mostrou 105 páginas, 325 KB e 0,5 s, contando também o tempo do navegador.

## Limites desta medição

- Os números são de uma máquina de desenvolvimento. A API hospedada no plano gratuito tem menos CPU e dorme depois de 15 minutos sem uso; a primeira chamada depois disso inclui o tempo de acordar, que não entra aqui (T42 trata a hospedagem).
- Uma prova com questão discursiva é recusada com `409` ("a questão tem 0 alternativas"): o PDF ainda não aceita discursivas (T56, sugerida para sair do escopo).
- A geração roda inteira na memória do servidor. Até 100 cópias o arquivo fica perto de 1 MB; turmas bem maiores que isso não foram medidas.

## Testes automatizados

[`server/test/buildConsolidatedPdf.test.js`](../server/test/buildConsolidatedPdf.test.js) lê o texto impresso em cada página do PDF e confere:

- com identificação, cada cópia traz o nome do próprio aluno em todas as suas páginas, e nunca o de outro;
- sem identificação, nenhuma página traz nome, a linha ESTUDANTE fica em branco e as páginas levam o código da cópia;
- várias versões saem com a própria ordem de questões e de alternativas;
- uma turma de 35 alunos gera uma cópia por aluno, em sequência, sem misturar páginas;
- em frente e verso toda cópia começa em página ímpar, e só a folha de resposta dá uma página por aluno.
