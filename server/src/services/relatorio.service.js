import { AppError } from '../errors/AppError.js';
import { toCsv } from '../utils/csv.js';
import { arredondar, percentual } from './correcao.calculo.js';

function parseId(valor, mensagem) {
  const id = Number(valor);
  if (!Number.isInteger(id) || id <= 0) throw AppError.badRequest(mensagem);
  return id;
}

function mediana(valores) {
  if (valores.length === 0) return null;
  const ordenados = [...valores].sort((a, b) => a - b);
  const meio = Math.floor(ordenados.length / 2);
  return ordenados.length % 2 ? ordenados[meio] : arredondar((ordenados[meio - 1] + ordenados[meio]) / 2);
}

// Estatísticas de uma lista de notas da mesma prova.
export function calcularEstatisticas(notas, notaMaxima) {
  if (notas.length === 0) return { corrigidas: 0, media: null, mediana: null, maior: null, menor: null, mediaPercentual: null };
  const mediaDasNotas = media(notas);
  return {
    corrigidas: notas.length,
    media: mediaDasNotas,
    mediana: mediana(notas),
    maior: Math.max(...notas),
    menor: Math.min(...notas),
    mediaPercentual: percentual(mediaDasNotas, notaMaxima),
  };
}

function media(valores) {
  const validos = valores.filter((v) => v !== null);
  if (validos.length === 0) return null;
  return arredondar(validos.reduce((soma, v) => soma + v, 0) / validos.length);
}

// Média do aluno em provas com notas máximas diferentes: média dos percentuais.
function mediaPercentual(itens) {
  return media(itens.map((item) => item.percentual));
}

function nomeDoArquivo(...partes) {
  const base = partes
    .join('-')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
  return `${base || 'relatorio'}.csv`;
}

const TIPO_LEGIVEL = { AUTOMATICA: 'Automática', MANUAL: 'Manual' };

// Service dos relatórios de notas (T32) e do histórico do aluno (T33).
export function createRelatorioService(repository) {
  async function carregarAplicacao(id, professorId) {
    const aplicacao = await repository.findAplicacao(parseId(id, 'Aplicação inválida.'), professorId);
    if (!aplicacao) throw AppError.notFound('Aplicação não encontrada.');
    return aplicacao;
  }

  async function carregarTurma(id, professorId) {
    const turma = await repository.findTurma(parseId(id, 'Turma inválida.'), professorId);
    if (!turma) throw AppError.notFound('Turma não encontrada.');
    return turma;
  }

  async function relatorioDaAplicacao(id, professorId) {
    const aplicacao = await carregarAplicacao(id, professorId);
    const [linhas, questoes] = await Promise.all([
      repository.listNotasDaAplicacao(aplicacao.id),
      repository.listDesempenhoPorQuestao(aplicacao.id, aplicacao.prova.id),
    ]);

    const notas = linhas.map((linha) => ({
      ...linha,
      percentual: linha.nota === null ? null : percentual(linha.nota, aplicacao.notaMaxima),
    }));
    const corrigidas = notas.filter((n) => n.nota !== null);

    return {
      aplicacao,
      estatisticas: {
        ...calcularEstatisticas(corrigidas.map((n) => n.nota), aplicacao.notaMaxima),
        totalCopias: notas.length,
        pendentes: notas.length - corrigidas.length,
        semAluno: corrigidas.filter((n) => !n.aluno).length,
      },
      notas,
      questoes: questoes.map((q) => ({
        ...q,
        taxaAcerto: q.tipo === 'OBJETIVA' && q.corrigidas > 0 ? percentual(q.acertos, q.corrigidas) : null,
        mediaPontos: q.mediaPontos === null ? null : arredondar(q.mediaPontos),
      })),
    };
  }

  async function relatorioDaTurma(id, professorId) {
    const turma = await carregarTurma(id, professorId);
    const [aplicacoes, matriculados, notas] = await Promise.all([
      repository.listAplicacoesDaTurma(turma.id, professorId),
      repository.listAlunosDaTurma(turma.id),
      repository.listNotasDaTurma(turma.id),
    ]);

    // Alunos matriculados + quem tem nota na turma e já saiu dela (a nota não some do relatório).
    const alunos = new Map(matriculados.map((a) => [a.id, { ...a, matriculado: true }]));
    for (const nota of notas) {
      if (!alunos.has(nota.alunoId)) {
        alunos.set(nota.alunoId, { id: nota.alunoId, nome: nota.alunoNome, email: null, matricula: nota.alunoMatricula, matriculado: false });
      }
    }

    const notaMaximaPorAplicacao = new Map(aplicacoes.map((a) => [a.id, a.notaMaxima]));
    const linhas = [...alunos.values()]
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
      .map((aluno) => {
        const doAluno = notas.filter((n) => n.alunoId === aluno.id);
        const porAplicacao = aplicacoes.map((aplicacao) => {
          const nota = doAluno.find((n) => n.aplicacaoId === aplicacao.id);
          return nota
            ? { aplicacaoId: aplicacao.id, correcaoId: nota.correcaoId, nota: nota.nota, tipo: nota.tipo, percentual: percentual(nota.nota, notaMaximaPorAplicacao.get(aplicacao.id)) }
            : { aplicacaoId: aplicacao.id, correcaoId: null, nota: null, tipo: null, percentual: null };
        });
        return { aluno, notas: porAplicacao, provasFeitas: porAplicacao.filter((n) => n.nota !== null).length, mediaPercentual: mediaPercentual(porAplicacao) };
      });

    return {
      turma,
      aplicacoes: aplicacoes.map((aplicacao) => ({
        ...aplicacao,
        estatisticas: calcularEstatisticas(
          notas.filter((n) => n.aplicacaoId === aplicacao.id).map((n) => n.nota),
          aplicacao.notaMaxima
        ),
      })),
      alunos: linhas,
      mediaPercentualDaTurma: media(linhas.map((l) => l.mediaPercentual)),
    };
  }

  return {
    listarAplicacoes(professorId) {
      return repository.listAplicacoes(professorId);
    },

    listarTurmas(professorId) {
      return repository.listTurmas(professorId);
    },

    relatorioDaAplicacao,
    relatorioDaTurma,

    async csvDaAplicacao(id, professorId) {
      const { aplicacao, notas } = await relatorioDaAplicacao(id, professorId);
      const linhas = notas.map((n) => [
        n.codigo,
        n.rotulo,
        n.aluno?.nome ?? '',
        n.aluno?.matricula ?? '',
        n.nota,
        n.percentual,
        n.tipo ? TIPO_LEGIVEL[n.tipo] : 'Pendente',
      ]);
      return {
        nomeArquivo: nomeDoArquivo('notas', aplicacao.prova.titulo, aplicacao.turma.nome),
        conteudo: toCsv(['Código', 'Identificação na prova', 'Aluno', 'Matrícula', `Nota (máx. ${aplicacao.notaMaxima})`, '% da nota', 'Correção'], linhas),
      };
    },

    async csvDaTurma(id, professorId) {
      const { turma, aplicacoes, alunos } = await relatorioDaTurma(id, professorId);
      const cabecalho = [
        'Aluno',
        'Matrícula',
        ...aplicacoes.map((a) => `${a.prova.titulo}${a.dataAplicacao ? ` (${a.dataAplicacao.split('-').reverse().join('/')})` : ''} - máx. ${a.notaMaxima}`),
        'Provas feitas',
        'Média (%)',
      ];
      const linhas = alunos.map((l) => [l.aluno.nome, l.aluno.matricula ?? '', ...l.notas.map((n) => n.nota), l.provasFeitas, l.mediaPercentual]);
      return { nomeArquivo: nomeDoArquivo('notas-consolidadas', turma.nome), conteudo: toCsv(cabecalho, linhas) };
    },

    // T33: histórico de notas e desempenho de um aluno nas turmas do professor.
    async historicoDoAluno(id, professorId) {
      const aluno = await repository.findAlunoDoProfessor(parseId(id, 'Aluno inválido.'), professorId);
      if (!aluno) throw AppError.notFound('Aluno não encontrado nas suas turmas.');

      const [turmas, historico] = await Promise.all([
        repository.listTurmasDoAluno(aluno.id, professorId),
        repository.listHistoricoDoAluno(aluno.id, professorId),
      ]);
      const notas = historico.map((item) => ({ ...item, percentual: percentual(item.nota, item.notaMaxima) }));
      const percentuais = notas.map((n) => n.percentual).filter((p) => p !== null);

      return {
        aluno,
        turmas,
        resumo: {
          provas: notas.length,
          mediaPercentual: mediaPercentual(notas),
          melhorPercentual: percentuais.length ? Math.max(...percentuais) : null,
          piorPercentual: percentuais.length ? Math.min(...percentuais) : null,
        },
        notas,
      };
    },
  };
}
