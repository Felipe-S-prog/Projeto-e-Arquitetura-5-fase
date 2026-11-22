// Tabelas dos relatórios exportados (T66). As mesmas tabelas viram CSV, Excel (.xlsx) e PDF,
// então o professor vê as mesmas colunas em qualquer formato.
//
// Tabela: { nome, titulo, colunas: [{ titulo, tipo: 'texto' | 'numero', largura }], linhas: [[valor]] }

const LETRAS = ['A', 'B', 'C', 'D', 'E'];
const TIPO_LEGIVEL = { AUTOMATICA: 'Automática', MANUAL: 'Manual' };

const texto = (titulo, largura = 14) => ({ titulo, tipo: 'texto', largura });
const numero = (titulo, largura = 10) => ({ titulo, tipo: 'numero', largura });
const centro = (coluna) => ({ ...coluna, alinhamento: 'centro' }); // colunas estreitas das questões no PDF

const numberFormat = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 });
const br = (valor) => (valor === null || valor === undefined ? '-' : numberFormat.format(valor));

export function dataBR(isoDate) {
  return isoDate ? isoDate.split('-').reverse().join('/') : '';
}

// Letra da alternativa marcada na ordem CADASTRADA da questão. A letra gravada é a da ordem
// impressa da cópia; a ordem da cópia diz qual alternativa original ela é. Assim a coluna de uma
// questão tem o mesmo significado para todos os alunos, qualquer que seja a versão da prova.
export function letraOriginal(resposta) {
  if (!resposta.letraMarcada) return null;
  const impressa = LETRAS.indexOf(resposta.letraMarcada);
  const ordem = resposta.alternativesOrder?.[resposta.questaoId];
  const original = ordem ? ordem[impressa] : impressa;
  return LETRAS[original] ?? null;
}

// Relatório de uma aplicação: uma linha por aluno (cópia) com a alternativa marcada em cada
// questão, e uma tabela de desempenho por questão.
// dados: resultado de relatorioDaAplicacao + respostas (listRespostasPorCorrecao) + alternativas (listAlternativasDaProva).
export function tabelasDaAplicacao({ aplicacao, estatisticas, notas, questoes }, respostas, alternativas) {
  const gabarito = new Map();
  for (const a of alternativas) if (a.correta) gabarito.set(a.questaoId, LETRAS[a.ordem]);
  const porCorrecao = new Map();
  for (const r of respostas) {
    if (!porCorrecao.has(r.correcaoId)) porCorrecao.set(r.correcaoId, new Map());
    porCorrecao.get(r.correcaoId).set(r.questaoId, r);
  }

  const colunasQuestoes = questoes.map((q) =>
    centro(q.tipo === 'OBJETIVA' ? texto(`Q${q.posicao} (${gabarito.get(q.questaoId) ?? '?'})`, 7) : numero(`Q${q.posicao} (pts)`, 7))
  );
  const notasTabela = {
    nome: 'Notas',
    titulo: 'Notas por aluno',
    colunas: [texto('Aluno', 24), texto('Matrícula', 11), texto('Código', 9), texto('Correção', 11), numero('Nota', 7), numero('%', 6), ...colunasQuestoes],
    linhas: notas.map((n) => {
      const doAluno = n.correcaoId ? porCorrecao.get(n.correcaoId) : null;
      const marcadas = questoes.map((q) => {
        if (!doAluno) return null; // pendente ou lançamento manual: não há respostas por questão
        const r = doAluno.get(q.questaoId);
        if (!r) return null;
        if (q.tipo !== 'OBJETIVA') return r.pontos;
        return letraOriginal(r) ?? 'Em branco';
      });
      return [n.aluno?.nome ?? `${n.rotulo} (sem aluno)`, n.aluno?.matricula ?? '', n.codigo, n.tipo ? TIPO_LEGIVEL[n.tipo] : 'Pendente', n.nota, n.percentual, ...marcadas];
    }),
  };

  const maxAlternativas = Math.max(0, ...questoes.map((q) => q.distribuicao?.alternativas.length ?? 0));
  const questoesTabela = {
    nome: 'Questões',
    titulo: 'Desempenho por questão (% de quem respondeu)',
    colunas: [
      numero('Nº', 4),
      texto('Enunciado', 40),
      centro(texto('Correta', 7)),
      ...LETRAS.slice(0, maxAlternativas).map((l) => numero(`${l} (%)`, 6)),
      numero('Em branco (%)', 9),
      numero('Acerto (%)', 8),
    ],
    linhas: questoes.map((q) => {
      const d = q.distribuicao;
      return [
        q.posicao,
        q.enunciado,
        q.tipo === 'OBJETIVA' ? gabarito.get(q.questaoId) ?? '' : 'Discursiva',
        ...LETRAS.slice(0, maxAlternativas).map((_, i) => d?.alternativas[i]?.percentual ?? null),
        d?.emBranco.percentual ?? null,
        q.taxaAcerto,
      ];
    }),
  };

  return {
    titulo: `Notas: ${aplicacao.prova.titulo}`,
    subtitulo: [
      `Turma: ${aplicacao.turma.nome}${aplicacao.dataAplicacao ? ` · aplicada em ${dataBR(aplicacao.dataAplicacao)}` : ''} · nota máxima ${br(aplicacao.notaMaxima)}`,
      `Corrigidas: ${estatisticas.corrigidas} de ${estatisticas.totalCopias}` +
        (estatisticas.corrigidas
          ? ` · média ${br(estatisticas.media)} (${br(estatisticas.mediaPercentual)}%) · mediana ${br(estatisticas.mediana)} · maior ${br(estatisticas.maior)} · menor ${br(estatisticas.menor)}`
          : ''),
      'Nas colunas das questões aparece a alternativa marcada pelo aluno, na ordem cadastrada da questão (entre parênteses, a correta).',
    ],
    tabelas: [notasTabela, questoesTabela],
  };
}

// Consolidado de uma turma: uma linha por aluno, uma coluna por aplicação.
export function tabelaDaTurma({ turma, aplicacoes, alunos, mediaPercentualDaTurma }) {
  const linhas = alunos.map((l) => [
    l.aluno.nome + (l.aluno.matriculado ? '' : ' (saiu da turma)'),
    l.aluno.matricula ?? '',
    ...l.notas.map((n) => n.nota),
    l.provasFeitas,
    l.mediaPercentual,
  ]);
  if (aplicacoes.length) linhas.push(['Média da aplicação', '', ...aplicacoes.map((a) => a.estatisticas.media), null, mediaPercentualDaTurma]);
  return {
    nome: turma.nome,
    titulo: `${turma.nome}${turma.periodo ? ` (${turma.periodo})` : ''}`,
    colunas: [
      texto('Aluno', 24),
      texto('Matrícula', 11),
      ...aplicacoes.map((a) => numero(`${a.prova.titulo}${a.dataAplicacao ? ` (${dataBR(a.dataAplicacao)})` : ''} - máx. ${br(a.notaMaxima)}`, 14)),
      numero('Provas feitas', 8),
      numero('Média (%)', 8),
    ],
    linhas,
  };
}

// Consolidado do professor: todas as notas de todas as turmas, uma por linha.
export function tabelaDoProfessor(notas) {
  return {
    nome: 'Todas as notas',
    titulo: 'Todas as notas',
    colunas: [texto('Turma', 20), texto('Aluno', 24), texto('Matrícula', 11), texto('Prova', 24), texto('Aplicada em', 10), numero('Nota', 7), numero('Nota máxima', 8), numero('%', 6), texto('Correção', 10)],
    linhas: notas.map((n) => [
      n.turma,
      n.aluno ?? 'Sem aluno associado',
      n.matricula ?? '',
      n.prova,
      dataBR(n.dataAplicacao),
      n.nota,
      n.notaMaxima,
      n.notaMaxima ? Math.round((n.nota / n.notaMaxima) * 10000) / 100 : null,
      TIPO_LEGIVEL[n.tipo],
    ]),
  };
}
