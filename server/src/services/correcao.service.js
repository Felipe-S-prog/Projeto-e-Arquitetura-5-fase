import { AppError } from '../errors/AppError.js';
import { arredondar, calcularCorrecao, montarQuestoesImpressas, percentual, validarNotaManual } from './correcao.calculo.js';

// Mesmo formato de código gerado pelo front (utils/answerKey.js e utils/qrPayload.js).
const CODIGO_PATTERN = /^[A-Z0-9]{4,12}$/;

function normalizarCodigo(valor) {
  const codigo = String(valor ?? '').trim().toUpperCase();
  if (!CODIGO_PATTERN.test(codigo)) throw AppError.badRequest('Código de prova inválido.');
  return codigo;
}

function parseId(valor, mensagem) {
  const id = Number(valor);
  if (!Number.isInteger(id) || id <= 0) throw AppError.badRequest(mensagem);
  return id;
}

// Service da Correção e Notas (T29, T30 e T31).
// - Correção automática: o professor lê o QR da cópia, informa o que o aluno marcou
//   e a nota sai da pontuação de cada questão da prova.
// - Lançamento manual: a nota é digitada, associando a cópia ao aluno correto
//   (caso das provas geradas sem identificação).
export function createCorrecaoService(repository) {
  async function carregarCopia(codigo, professorId) {
    const copia = await repository.findCopiaByCodigo(normalizarCodigo(codigo), professorId);
    if (!copia) throw AppError.notFound('Prova não encontrada para este código.');
    return { copia, ...(await carregarGabarito(copia)) };
  }

  // Questões como foram impressas na cópia (com a letra correta) e a nota máxima da prova.
  async function carregarGabarito(copia) {
    const questoes = await repository.listQuestoesDaProva(copia.prova.id);
    if (questoes.length === 0) throw AppError.conflict('A prova desta cópia não tem questões.');
    const alternativas = await repository.listAlternativas(questoes.map((q) => q.questaoId));
    const questoesImpressas = montarQuestoesImpressas(copia.ordem, questoes, alternativas);
    const notaMaxima = arredondar(questoes.reduce((soma, q) => soma + q.pontuacao, 0));

    return { questoesImpressas, notaMaxima };
  }

  // Une as respostas gravadas com o gabarito da cópia (letra correta e pontuação de cada questão).
  function detalharRespostas(respostas, questoesImpressas) {
    const porQuestao = new Map(respostas.map((r) => [r.questaoId, r]));
    return questoesImpressas.map((q) => {
      const r = porQuestao.get(q.questaoId);
      return {
        numero: q.numero,
        questaoId: q.questaoId,
        tipo: q.tipo,
        letraMarcada: r?.letraMarcada ?? null,
        letraCorreta: q.letraCorreta,
        correta: r ? r.correta : null,
        pontos: r ? r.pontos : null,
        pontuacao: q.pontuacao,
      };
    });
  }

  async function montarResultado(correcao, copia, questoesImpressas, notaMaxima) {
    const respostas = correcao.tipo === 'AUTOMATICA' ? detalharRespostas(await repository.listRespostas(correcao.id), questoesImpressas) : [];
    return {
      ...correcao,
      copia: { id: copia.id, codigo: copia.codigo, rotulo: copia.rotulo },
      prova: copia.prova,
      turma: copia.turma,
      aplicacao: copia.aplicacao,
      notaMaxima,
      percentual: percentual(correcao.nota, notaMaxima),
      respostas,
    };
  }

  // Decide de qual aluno é a nota. Cópia nominal: sempre o aluno dela.
  // Cópia anônima: o aluno escolhido pelo professor, que precisa estar matriculado na turma.
  async function resolverAluno(copia, alunoIdInformado, { obrigatorio }) {
    if (copia.aluno) {
      if (alunoIdInformado != null && alunoIdInformado !== '' && Number(alunoIdInformado) !== copia.aluno.id) {
        throw AppError.badRequest('Esta prova já é nominal de outro aluno.');
      }
      return copia.aluno.id;
    }

    if (alunoIdInformado == null || alunoIdInformado === '') {
      if (obrigatorio) throw AppError.badRequest('Selecione o aluno dono desta prova.');
      return null;
    }

    const alunoId = parseId(alunoIdInformado, 'Aluno inválido.');
    if (!(await repository.isAlunoMatriculado(alunoId, copia.turma.id))) {
      throw AppError.badRequest('O aluno selecionado não está matriculado na turma desta aplicação.');
    }
    const outraCopia = await repository.findCorrecaoDoAlunoNaAplicacao(alunoId, copia.aplicacao.id, copia.id);
    if (outraCopia) throw AppError.conflict(`Este aluno já tem nota nesta aplicação (prova ${outraCopia}).`);
    return alunoId;
  }

  async function garantirQueRecorrecaoFoiConfirmada(copia, substituir) {
    const existente = await repository.findCorrecaoByCopia(copia.id);
    if (existente && substituir !== true) {
      throw AppError.conflict('Esta prova já foi corrigida. Confirme para substituir a nota anterior.', {
        correcaoId: existente.id,
        nota: existente.nota,
        tipo: existente.tipo,
      });
    }
  }

  return {
    // Dados para a tela de correção: a cópia como foi impressa, os alunos da turma
    // (para identificar provas anônimas) e a correção já feita, se houver.
    async buscarCopiaParaCorrecao(codigo, professorId) {
      const { copia, questoesImpressas, notaMaxima } = await carregarCopia(codigo, professorId);
      const [alunos, correcao] = await Promise.all([
        copia.aluno ? Promise.resolve([]) : repository.listAlunosDaTurma(copia.turma.id),
        repository.findCorrecaoByCopia(copia.id),
      ]);

      return {
        copia: { id: copia.id, codigo: copia.codigo, rotulo: copia.rotulo, aluno: copia.aluno },
        prova: copia.prova,
        turma: copia.turma,
        aplicacao: copia.aplicacao,
        notaMaxima,
        questoes: questoesImpressas.map(({ letraCorreta, ...questao }) => questao), // o gabarito só aparece depois de corrigir
        alunos,
        correcao: correcao ? await montarResultado(correcao, copia, questoesImpressas, notaMaxima) : null,
      };
    },

    // T30: correção automática a partir das respostas marcadas.
    async corrigirAutomaticamente(dados, professorId) {
      const { copia, questoesImpressas, notaMaxima } = await carregarCopia(dados?.codigo, professorId);
      await garantirQueRecorrecaoFoiConfirmada(copia, dados.substituir);
      const alunoId = await resolverAluno(copia, dados.alunoId, { obrigatorio: false });
      const { nota, respostas } = calcularCorrecao(questoesImpressas, dados.respostas);

      const id = await repository.salvarCorrecao({ copiaId: copia.id, alunoId, professorId, nota, tipo: 'AUTOMATICA', respostas });
      return montarResultado(await repository.findCorrecaoById(id, professorId), copia, questoesImpressas, notaMaxima);
    },

    // T31: lançamento manual da nota, associando a prova ao aluno correto.
    async lancarNotaManual(dados, professorId) {
      const { copia, questoesImpressas, notaMaxima } = await carregarCopia(dados?.codigo, professorId);
      await garantirQueRecorrecaoFoiConfirmada(copia, dados.substituir);
      const alunoId = await resolverAluno(copia, dados.alunoId, { obrigatorio: true });
      const nota = validarNotaManual(dados.nota, notaMaxima);

      const id = await repository.salvarCorrecao({ copiaId: copia.id, alunoId, professorId, nota, tipo: 'MANUAL', respostas: [] });
      return montarResultado(await repository.findCorrecaoById(id, professorId), copia, questoesImpressas, notaMaxima);
    },

    async buscarCorrecao(id, professorId) {
      const correcao = await repository.findCorrecaoById(parseId(id, 'Correção inválida.'), professorId);
      if (!correcao) throw AppError.notFound('Correção não encontrada.');
      const copia = await repository.findCopiaById(correcao.copiaId, professorId);
      const { questoesImpressas, notaMaxima } = await carregarGabarito(copia);
      return montarResultado(correcao, copia, questoesImpressas, notaMaxima);
    },

    async removerCorrecao(id, professorId) {
      const correcaoId = parseId(id, 'Correção inválida.');
      if (!(await repository.findCorrecaoById(correcaoId, professorId))) throw AppError.notFound('Correção não encontrada.');
      await repository.removerCorrecao(correcaoId);
    },
  };
}
