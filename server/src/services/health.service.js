// Service: regras de negócio. Não conhece Express (req/res) nem SQL: só chama
// repositories e lança AppError quando uma regra é violada.
export function createHealthService(healthRepository) {
  return {
    live() {
      return {
        status: 'ok',
        uptimeSeconds: Math.round(process.uptime()),
        timestamp: new Date().toISOString(),
      };
    },

    async database() {
      const startedAt = performance.now();
      const ping = await healthRepository.pingDatabase(); // se o banco cair, o erro sobe até o errorHandler (503)
      return {
        status: 'ok',
        database: ping.database,
        serverTime: ping.serverTime,
        latencyMs: Math.round(performance.now() - startedAt),
      };
    },
  };
}
