// Controller da consulta pública do gabarito (T26): só fala HTTP. Não usa professor.
export function createGabaritoController(gabaritoService) {
  return {
    async consultar(req, res) {
      res.set('Cache-Control', 'no-store'); // o gabarito pode ser publicado a qualquer momento
      res.json(await gabaritoService.consultar(req.params.codigo));
    },
  };
}
