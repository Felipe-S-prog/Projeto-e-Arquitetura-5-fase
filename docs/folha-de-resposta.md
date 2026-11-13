# Folha de resposta: medidas para a leitura automática (T89)

Este documento passa à correção automática (T63 e T64) as medidas da folha de resposta impressa pelo SGP e o que a simulação de leitura mostrou. A fonte única da geometria é [`server/src/pdf/sheetLayout.js`](../server/src/pdf/sheetLayout.js): o PDF desenha a partir dele e a leitura deve usar o mesmo arquivo. Qualquer mudança de medida é feita só lá.

## Convenções

- Unidade: ponto (pt), 1/72 de polegada. 1 pt = 0,353 mm.
- Origem no canto superior esquerdo da página A4 (595,28 × 841,89 pt), com o eixo y crescendo para baixo.
- O quadro de resposta fica sempre na página 1 da cópia (ou na única página, no modo "só folha de resposta").

## Medidas

| Elemento | Medida | Em mm |
|---|---|---|
| Marcadores dos cantos | quadrados pretos sólidos de 20 pt | 7,1 mm |
| Bolinha, até 20 questões | raio 5,5 pt | 3,9 mm de diâmetro |
| Bolinha, de 21 a 25 questões | raio = 0,36 × passo das linhas (25 questões: 4,9 pt) | 3,5 mm de diâmetro com 25 |
| Contorno da bolinha | 0,8 pt, cinza 45%, miolo branco | |
| Passo entre linhas | 17 pt até 20 questões; 340 / n acima disso (25 questões: 13,6 pt) | 6,0 mm / 4,8 mm |
| Passo entre colunas (A a E) | 30 pt | 10,6 mm |
| Papel livre entre bolinhas vizinhas | no mínimo 2,5 pt (garantido por teste) | 0,9 mm |
| QR Code | caixa de 140 pt com margem branca de 4 módulos; nível de correção Q | 49,4 mm |

Posições, a partir de `getSheetGeometry(optionCounts)`:

- Coluna j (0 = A): `cx = 364 + 30 × j`.
- Linha i (0 = questão 1): `cy = 340 + i × passo`.
- Marcadores: superior esquerdo em (290, 294); o direito fica 22 pt depois da última coluna; o de baixo fica 26 pt abaixo da última linha. `markerCenters(geometry)` devolve os 4 centros na ordem superior esquerdo, superior direito, inferior direito e inferior esquerdo.
- QR: caixa em (66, 294). O símbolo começa 4 módulos para dentro da caixa, e o módulo mede `140 / (lado + 8)`, onde lado = 17 + 4 × versão.

Exemplo com 10 questões de 5 alternativas: centros dos marcadores em (300, 304), (516, 304), (516, 529) e (300, 529); bolinha A da questão 1 em (364, 340) e E da questão 10 em (484, 493).

A geometria depende só do número de alternativas de cada questão, na ordem impressa da cópia. O QR traz `SGP1:<código da cópia>` (formato em `server/src/pdf/qr.js` e `client/src/utils/qrPayload.js`). Com o código, a API sabe as questões da cópia e pode calcular a geometria. Como o front não importa arquivos do servidor, a sugestão é a rota de correção devolver o resultado de `getSheetGeometry` junto com a cópia.

## O que mudou na T89

- Bolinha de 4,6 para 5,5 pt de raio (3,2 para 3,9 mm de diâmetro), mais fácil de preencher com caneta e mais tolerante a erro de alinhamento. Com mais de 20 questões, o raio acompanha o passo para não juntar as bolinhas.
- As letras de baixo do quadro desceram 2 pt para não encostarem na última linha.
- Os centros das bolinhas, os marcadores e o QR não mudaram. Uma folha impressa antes da T89 é lida com a mesma geometria. Se um dia algum centro mudar, troque o prefixo do QR (por exemplo, `SGP2:`) para o leitor saber qual geometria usar.

## Simulação de leitura

Sem impressora no ambiente de desenvolvimento, a folha foi testada assim: o PDF real gerado por `buildConsolidatedPdf` foi renderizado a 200 dpi com pdf.js e as bolinhas foram preenchidas como caneta azul (tamanho e posição variando). Depois a imagem virou uma "foto", com perspectiva, rotação, luz desigual, desfoque, ruído e compressão JPEG, e passou por um leitor de referência que segue o roteiro da próxima seção.

Cada formato (10 questões × 5 alternativas, 20 × 4 e 25 × 5) tem uma questão em branco e uma com marcação dupla. "Folga" é a escuridão da marcada mais clara menos a da vazia mais escura (0 = papel, 1 = preto).

| Cenário | Largura da folha na foto | Raio da bolinha na foto | Erro de alinhamento (fração do raio) | Folga | Questões certas |
|---|---|---|---|---|---|
| Boa (−3°, luz quase uniforme) | 1400 px | 11,3 a 12,7 px | até 0,06 | 0,74 a 0,77 | 100% |
| Média (6°, perspectiva 8%) | 1000 px | 7,7 a 8,6 px | até 0,09 | 0,70 a 0,72 | 100% |
| Ruim (−10°, perspectiva 12%, sombra) | 750 px | 5,7 a 6,5 px | até 0,13 | 0,63 a 0,66 | 100% |
| Extrema (14°, perspectiva 16%, muito desfoque) | 600 px | 4,4 a 5,0 px | até 0,17 | 0,51 a 0,56 | 100% |
| Caneta fraca (azul-claro, meia bolinha) | 900 px | 7,0 a 7,9 px | até 0,10 | 0,14 a 0,18 | 100% com a regra relativa; 25% a 40% com limite fixo de 0,30 |
| Transbordando (marca maior que a bolinha) | 900 px | 7,0 a 7,9 px | até 0,11 | 0,75 a 0,76 | 100% |

Antes da T89 (raio 4,6 pt) os resultados foram parecidos, com erro de alinhamento maior no cenário extremo (0,18 do raio) e folga menor (0,46 a 0,49).

## Roteiro de leitura recomendado

1. **QR primeiro.** Ler com jsQR e conferir o prefixo `SGP1:`. Usar só os cantos superior esquerdo, superior direito e inferior esquerdo de `location`, e completar o quarto como paralelogramo. O canto inferior direito do jsQR é extrapolado (não há padrão de localização ali): na simulação ele errou uns 4 px, o que levou a previsão do marcador mais distante a errar 70 px.
2. **Prever os marcadores pelo QR e procurar perto.** Levar os centros dos marcadores para a foto com a transformação do QR e procurar, numa janela de cerca de 3 vezes o lado previsto, uma mancha escura quase quadrada (área entre 0,45 e 1,9 da esperada, preenchendo 60% ou mais do retângulo que a envolve). O centro da mancha é o centro do marcador.
3. **Homografia pelos 4 marcadores.** Com os 4 centros, calcular a homografia de pt para pixels da foto e levar cada centro de bolinha para a foto.
4. **Medir só o miolo.** Calcular a média do miolo de cada bolinha, num círculo de 0,6 do raio, para não contar o contorno impresso. Usar o canal vermelho, onde a tinta azul fica escura e o papel fica claro. Comparar com o papel em volta da linha (percentil 90 de uma faixa ao redor dela): escuridão = 1 − miolo / papel.
5. **Decidir por linha, não por limite fixo.** Se a bolinha mais escura da linha tiver menos de 0,12, a questão está em branco. Senão, contam como marcadas as bolinhas com pelo menos metade da escuridão da mais escura; mais de uma marcada é marcação dupla. O resultado vai para a tela de conferência do professor (T64) antes de gravar.
6. **Exigir resolução mínima.** Recusar (ou pedir nova foto) quando a folha ocupar menos de 1000 px de largura, ou seja, bolinha com menos de 7 px de raio. Fotos de celular passam disso com folga; o caso de 600 px só passou com a regra relativa.

## Teste com folha impressa

A simulação não substitui papel. Falta imprimir e fotografar:

- [ ] Imprimir uma prova de 10 e uma de 25 questões (PDF do sistema, A4, 100%, sem "ajustar à página").
- [ ] Preencher com caneta azul e preta, incluindo uma questão em branco e uma com marcação dupla.
- [ ] Fotografar com celular: de cima, inclinada e com sombra.
- [ ] Conferir se marcadores e bolinhas ficam nítidos e se o QR é lido pela tela de correção.
- [ ] Medir na folha impressa o lado de um marcador (esperado 7,1 mm) e a distância entre os centros dos marcadores superiores (10 questões × 5: esperado 76,2 mm), para confirmar que a impressão não mudou a escala.
