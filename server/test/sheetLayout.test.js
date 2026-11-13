import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BUBBLE_RADIUS, MARGIN, MARKER_SIZE, PAGE, getSheetGeometry, markerCenters } from '../src/pdf/sheetLayout.js';

const geometria = (questoes, alternativas) => getSheetGeometry(Array(questoes).fill(alternativas));

test('raio da bolinha: 5,5 pt até 20 questões; acima disso acompanha o passo das linhas', () => {
  assert.equal(geometria(10, 5).rows[0].options[0].r, BUBBLE_RADIUS);
  assert.equal(geometria(20, 4).rows[0].options[0].r, 5.5);
  const g25 = geometria(25, 5);
  const passo = g25.rows[1].cy - g25.rows[0].cy;
  assert.ok(Math.abs(g25.rows[0].options[0].r - passo * 0.36) < 1e-9);
});

// A T89 só mudou o raio. Os centros continuam os mesmos das folhas já impressas,
// para que a leitura automática use uma única geometria para todas elas.
test('centros das bolinhas e dos marcadores não mudaram (folhas já impressas continuam legíveis)', () => {
  const g10 = geometria(10, 5);
  assert.deepEqual([g10.rows[0].options[0].cx, g10.rows[0].options[0].cy], [364, 340]);
  assert.deepEqual([g10.rows[9].options[4].cx, g10.rows[9].options[4].cy], [484, 493]);
  assert.deepEqual(markerCenters(g10), [{ x: 300, y: 304 }, { x: 516, y: 304 }, { x: 516, y: 529 }, { x: 300, y: 529 }]);

  const g25 = geometria(25, 5);
  assert.ok(Math.abs(g25.rows[24].cy - 666.4) < 1e-9);
  assert.ok(Math.abs(markerCenters(g25)[2].y - 702.4) < 1e-9);
});

test('para 1 a 25 questões e 2 a 5 alternativas sobra papel entre bolinhas e o quadro cabe na página', () => {
  for (let questoes = 1; questoes <= 25; questoes++) {
    for (let alternativas = 2; alternativas <= 5; alternativas++) {
      const g = geometria(questoes, alternativas);
      const caso = `${questoes} questões, ${alternativas} alternativas`;
      const r = g.rows[0].options[0].r;
      const [tl, tr, br] = markerCenters(g);

      if (questoes > 1) assert.ok(g.rows[1].cy - g.rows[0].cy - 2 * r >= 2.5, `linhas muito juntas: ${caso}`);
      if (alternativas > 1) assert.ok(g.columns[1].cx - g.columns[0].cx - 2 * r >= 2.5, `colunas muito juntas: ${caso}`);

      // toda bolinha fica dentro do retângulo dos marcadores, com folga de pelo menos um raio
      for (const row of g.rows) {
        for (const o of row.options) {
          assert.ok(o.cx - r > tl.x + MARKER_SIZE / 2 && o.cx + r < tr.x - MARKER_SIZE / 2, `bolinha fora dos marcadores (x): ${caso}`);
          assert.ok(o.cy - r > tl.y + MARKER_SIZE / 2 && o.cy + r < br.y - MARKER_SIZE / 2, `bolinha fora dos marcadores (y): ${caso}`);
        }
      }

      // marcadores longe do QR (o leitor não confunde um com o outro) e quadro dentro da margem
      assert.ok(g.markers[0].x - (g.qr.x + g.qr.size) >= 40, `marcador perto do QR: ${caso}`);
      assert.ok(g.card.y + g.card.height <= PAGE.height - MARGIN, `quadro passa da margem: ${caso}`);
      assert.ok(g.markers[1].x + MARKER_SIZE <= g.card.x + g.card.width - 12, `marcador encosta na borda: ${caso}`);
    }
  }
});
