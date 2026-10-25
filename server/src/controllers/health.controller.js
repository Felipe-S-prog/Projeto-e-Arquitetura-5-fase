// Controller: fala HTTP. Lê a requisição (params, query, body), chama o service
// e devolve a resposta. Sem regra de negócio e sem SQL.
// No Express 5, funções async podem lançar erro direto: ele vai para o errorHandler.
export function createHealthController(healthService) {
  return {
    live(req, res) {
      res.json(healthService.live());
    },

    async database(req, res) {
      res.json(await healthService.database());
    },
  };
}
