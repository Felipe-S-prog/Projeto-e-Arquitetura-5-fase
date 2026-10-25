// Controller das Provas (T17): só fala HTTP. O professor vem de req.professorId
// (middleware professorContext); as regras ficam no service.
export function createProvaController(provaService) {
  return {
    async listar(req, res) {
      res.json(await provaService.listar(req.professorId));
    },

    async buscar(req, res) {
      res.json(await provaService.buscar(req.params.id, req.professorId));
    },

    async criar(req, res) {
      res.status(201).json(await provaService.criar(req.body, req.professorId));
    },

    async atualizar(req, res) {
      res.json(await provaService.atualizar(req.params.id, req.body, req.professorId));
    },

    async arquivar(req, res) {
      res.json(await provaService.arquivar(req.params.id, req.professorId));
    },
  };
}
