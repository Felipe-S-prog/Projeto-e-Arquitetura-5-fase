
import {
  clearAuthSession,
  getAccessToken,
  getRefreshToken,
  saveAuthSession,
} from './authStorage';

const API_URL = (
  import.meta.env.VITE_API_URL || 'http://localhost:3333/api'
).replace(/\/+$/, '');

let refreshPromise = null;

function notifyAuthExpired() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('sgp:auth-expired'));
  }
}

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
  return new URL(API_URL + path);
}

async function rawSend(path, { method = 'GET', body, headers = {} } = {}) {
  const requestHeaders = { ...headers };

  const isFormData =
    typeof FormData !== 'undefined' && body instanceof FormData;

  // O navegador define automaticamente o Content-Type e o boundary
  // quando o corpo da requisição é um FormData.
  if (
    body !== undefined &&
    !isFormData &&
    !Object.keys(requestHeaders).some(
      (key) => key.toLowerCase() === 'content-type',
    )
  ) {
    requestHeaders['Content-Type'] = 'application/json';
  }

  const accessToken = getAccessToken();

  if (
    accessToken &&
    !Object.keys(requestHeaders).some(
      (key) => key.toLowerCase() === 'authorization',
    )
  ) {
    requestHeaders.Authorization = 'Bearer ' + accessToken;
  }

  try {
    return await fetch(buildUrl(path), {
      method,
      headers: requestHeaders,
      body:
        body === undefined
          ? undefined
          : isFormData || typeof body === 'string'
            ? body
            : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(
      0,
      'NETWORK_ERROR',
      'Não foi possível conectar à API. Confira se o servidor está rodando.',
    );
  }
}

function shouldTryRefresh(path) {
  return ![
    '/auth/login',
    '/auth/register',
    '/auth/bootstrap-admin',
    '/auth/bootstrap-status',
    '/auth/refresh',
  ].includes(path);
}

async function refreshSession() {
  if (!refreshPromise) {
    const refreshToken = getRefreshToken();

    if (!refreshToken) {
      clearAuthSession();
      notifyAuthExpired();

      throw new ApiError(
        401,
        'UNAUTHORIZED',
        'Sua sessão expirou. Entre novamente.',
      );
    }

    refreshPromise = (async () => {
      const response = await rawSend('/auth/refresh', {
        method: 'POST',
        body: { refreshToken },
      });

      if (!response.ok) {
        throw new ApiError(
          401,
          'UNAUTHORIZED',
          'Sua sessão expirou. Entre novamente.',
        );
      }

      const session = await response.json();
      saveAuthSession(session);

      return session;
    })()
      .catch((error) => {
        clearAuthSession();
        notifyAuthExpired();
        throw error;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }

  return refreshPromise;
}

async function send(path, options = {}) {
  let response = await rawSend(path, options);

  if (
    response.status === 401 &&
    shouldTryRefresh(path) &&
    getRefreshToken()
  ) {
    try {
      await refreshSession();
      response = await rawSend(path, options);
    } catch {
      // Mantém a resposta original 401 se a renovação falhar.
    }
  }

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));

    throw new ApiError(
      response.status,
      data.error?.code ?? 'HTTP_ERROR',
      data.error?.message ??
        data.message ??
        `Erro na API (${response.status}).`,
      data.error?.details,
    );
  }

  return response;
}

export async function apiRequest(path, options = {}) {
  const response = await send(path, options);

  return response.status === 204 ? null : response.json();
}

// Baixa um arquivo da API sem salvar: devolve o conteúdo, o nome sugerido pelo servidor
// (Content-Disposition) e os cabeçalhos, para a tela decidir o que fazer com ele.
export async function apiBlob(path, fallbackName) {
  const response = await send(path);
  const disposition = response.headers.get('Content-Disposition') ?? '';
  const name = disposition.match(/filename="?([^";]+)"?/)?.[1] ?? fallbackName;

  return { blob: await response.blob(), name, headers: response.headers };
}
export async function apiDownload(path, fallbackName) {
  const { blob, name } = await apiBlob(path, fallbackName);

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.href = url;
  link.download = name;

  document.body.appendChild(link);
  link.click();
  link.remove();

  URL.revokeObjectURL(url);
}

export async function apiUpload(path, formData) {
  return apiRequest(path, {
    method: 'POST',
    body: formData,
  });
}

export function resolveAssetUrl(imagePath) {
  if (!imagePath) {
    return '';
  }

  if (/^https?:\/\//i.test(imagePath)) {
    return imagePath;
  }

  const origin = API_URL.replace(/\/api\/?$/, '');
  const cleanPath = imagePath.replace(/^\/+/, '');

  return origin + '/' + cleanPath;
}