// Controller dos relatórios de notas e do histórico do aluno: só fala HTTP.
export function createRelatorioController(relatorioService) {
  function enviarCsv(res, { nomeArquivo, conteudo }) {
    res.set('Content-Type', 'text/csv; charset=utf-8');
    res.attachment(nomeArquivo); // Content-Disposition: attachment; filename="..."
    res.send(conteudo);
  }

  return {
    async listarAplicacoes(req, res) {
      res.json(await relatorioService.listarAplicacoes(req.professorId));
    },

    async aplicacao(req, res) {
      res.json(await relatorioService.relatorioDaAplicacao(req.params.id, req.professorId));
    },

    async aplicacaoCsv(req, res) {
      enviarCsv(res, await relatorioService.csvDaAplicacao(req.params.id, req.professorId));
    },

    async listarTurmas(req, res) {
      res.json(await relatorioService.listarTurmas(req.professorId));
    },

    async turma(req, res) {
      res.json(await relatorioService.relatorioDaTurma(req.params.id, req.professorId));
    },

    async turmaCsv(req, res) {
      enviarCsv(res, await relatorioService.csvDaTurma(req.params.id, req.professorId));
    },

    async historicoDoAluno(req, res) {
      res.json(await relatorioService.historicoDoAluno(req.params.id, req.professorId));
    },
  };
}
