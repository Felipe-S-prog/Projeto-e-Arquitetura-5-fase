// Controller da Correção e Notas: só fala HTTP. O professor vem de req.professorId
// (middleware professorContext); as regras ficam no service.
export function createCorrecaoController(correcaoService) {
  return {
    async buscarCopia(req, res) {
      res.json(await correcaoService.buscarCopiaParaCorrecao(req.params.codigo, req.professorId));
    },

    async corrigir(req, res) {
      res.status(201).json(await correcaoService.corrigirAutomaticamente(req.body, req.professorId));
    },

    async lancarManual(req, res) {
      res.status(201).json(await correcaoService.lancarNotaManual(req.body, req.professorId));
    },

    async buscar(req, res) {
      res.json(await correcaoService.buscarCorrecao(req.params.id, req.professorId));
    },

    async remover(req, res) {
      await correcaoService.removerCorrecao(req.params.id, req.professorId);
      res.status(204).end();
    },
  };
}
