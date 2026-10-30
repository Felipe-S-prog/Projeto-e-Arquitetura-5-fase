// Controller das Cópias da Prova (T23): só fala HTTP. O professor vem de req.professorId
// (middleware professorContext); as regras ficam no service.
export function createCopiaController(copiaService) {
  return {
    async listar(req, res) {
      res.json(await copiaService.listar(req.professorId));
    },

    async listarDaAplicacao(req, res) {
      res.json(await copiaService.listarDaAplicacao(req.params.aplicacaoId, req.professorId));
    },

    async gerar(req, res) {
      res.status(201).json(await copiaService.gerar(req.params.aplicacaoId, req.professorId));
    },

    async publicarGabarito(req, res) {
      res.json(await copiaService.publicarGabarito(req.params.aplicacaoId, req.body, req.professorId));
    },
  };
}
