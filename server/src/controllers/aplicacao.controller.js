// Controller das Aplicações (T18): só fala HTTP. O professor vem de req.professorId
// (middleware professorContext); as regras ficam no service.
export function createAplicacaoController(aplicacaoService) {
  return {
    async listar(req, res) {
      res.json(await aplicacaoService.listar(req.professorId));
    },

    async buscar(req, res) {
      res.json(await aplicacaoService.buscar(req.params.id, req.professorId));
    },

    async criar(req, res) {
      res.status(201).json(await aplicacaoService.criar(req.body, req.professorId));
    },

    async atualizar(req, res) {
      res.json(await aplicacaoService.atualizar(req.params.id, req.body, req.professorId));
    },

    async aplicar(req, res) {
      res.json(await aplicacaoService.aplicar(req.params.id, req.professorId));
    },
  };
}
