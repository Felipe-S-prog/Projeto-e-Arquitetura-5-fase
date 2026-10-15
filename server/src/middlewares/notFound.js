// Rota que não existe: devolve JSON no mesmo formato dos outros erros.
export function notFound(req, res) {
  res.status(404).json({
    error: { code: 'NOT_FOUND', message: `Rota não encontrada: ${req.method} ${req.originalUrl}` },
  });
}
