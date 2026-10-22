// Cliente HTTP da API do SGP (pasta server/).
// O endereço vem de VITE_API_URL (veja client/.env.example); sem ele, usa a API local.
const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:3333/api').replace(/\/+$/, '');

// Enquanto o login com JWT (T07) não existe, cada requisição informa o professor
// em "professor_id", o mesmo combinado das rotas de turmas. Em desenvolvimento é o 1.
const PROFESSOR_ID = import.meta.env.VITE_PROFESSOR_ID || '1';

// Erro da API com o status e o código padronizados pelo back-end
// ({ error: { code, message, details } }), para as telas tratarem cada caso.
export class ApiError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

function buildUrl(path) {
  const url = new URL(API_URL + path);
  url.searchParams.set('professor_id', PROFESSOR_ID);
  return url;
}

async function send(path, { method = 'GET', body } = {}) {
  let response;
  try {
    response = await fetch(buildUrl(path), {
      method,
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, 'NETWORK_ERROR', 'Não foi possível conectar à API. Confira se o servidor está rodando.');
  }

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new ApiError(
      response.status,
      data.error?.code ?? 'HTTP_ERROR',
      data.error?.message ?? data.message ?? `Erro na API (${response.status}).`,
      data.error?.details
    );
  }
  return response;
}

export async function apiRequest(path, options) {
  const response = await send(path, options);
  return response.status === 204 ? null : response.json();
}

// Baixa um arquivo gerado pela API (ex.: relatório CSV) com o nome que ela sugerir.
export async function apiDownload(path, fallbackName) {
  const response = await send(path);
  const disposition = response.headers.get('Content-Disposition') ?? '';
  const name = disposition.match(/filename="?([^";]+)"?/)?.[1] ?? fallbackName;

  const url = URL.createObjectURL(await response.blob());
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
