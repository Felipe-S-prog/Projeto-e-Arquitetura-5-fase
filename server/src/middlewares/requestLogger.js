
const AUDITED_PATHS = [
  '/api/correcoes',
  '/api/relatorios',
];

function isAuditedAccess(req) {
  if (req.method !== 'GET' || !req.user) return false;

  const isNotesHistory = /^\/api\/alunos\/[^/]+\/historico\/?$/.test(req.path);

  const isNotesOrReports = AUDITED_PATHS.some(
    (path) => req.path === path || req.path.startsWith(`${path}/`),
  );

  return isNotesHistory || isNotesOrReports;
}

export function requestLogger(req, res, next) {
  const start = process.hrtime.bigint();

  res.on('finish', () => {
    const durationMs = Number(process.hrtime.bigint() - start) / 1e6;
    const status = res.statusCode;

    const log = {
      timestamp: new Date().toISOString(),
      level: status >= 500 ? 'error' : status >= 400 ? 'warn' : 'info',
      event: isAuditedAccess(req) && status >= 200 && status < 300
        ? 'data_access'
        : 'http_request',
      method: req.method,
      path: req.path,
      status,
      duration_ms: Number(durationMs.toFixed(2)),
      user_id: req.user?.id ?? null,
      role: req.user?.role ?? null,
    };

    console.log(JSON.stringify(log));
  });

  next();
}
