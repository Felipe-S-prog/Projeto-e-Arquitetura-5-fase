// Controller dos relatórios de notas e do histórico do aluno: só fala HTTP.
export function createRelatorioController(relatorioService) {
  function enviarArquivo(res, { nomeArquivo, tipoConteudo, conteudo }) {
    res.set('Content-Type', tipoConteudo);
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

    async exportarAplicacao(req, res) {
      const formato = req.path.endsWith('/csv') ? 'csv' : req.query.formato;
      enviarArquivo(res, await relatorioService.exportarAplicacao(req.params.id, formato, req.professorId));
    },

    async listarTurmas(req, res) {
      res.json(await relatorioService.listarTurmas(req.professorId));
    },

    async turma(req, res) {
      res.json(await relatorioService.relatorioDaTurma(req.params.id, req.professorId));
    },

    async exportarTurma(req, res) {
      const formato = req.path.endsWith('/csv') ? 'csv' : req.query.formato;
      enviarArquivo(res, await relatorioService.exportarTurma(req.params.id, formato, req.professorId));
    },

    async exportarConsolidado(req, res) {
      enviarArquivo(res, await relatorioService.exportarConsolidado(req.query.formato, req.professorId));
    },

    async historicoDoAluno(req, res) {
      res.json(await relatorioService.historicoDoAluno(req.params.id, req.professorId));
    },
  };
}
