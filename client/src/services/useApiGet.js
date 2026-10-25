import { useCallback, useEffect, useState } from 'react';
import { apiRequest } from './api';

// Carrega um recurso da API (GET) e devolve { data, error, loading, reload }.
// Com path nulo não faz nada (útil enquanto o usuário ainda não escolheu o item).
// O resultado guarda a "chave" da requisição que o produziu: enquanto ela não bate
// com a atual, a requisição nova ainda está carregando.
export function useApiGet(path) {
  const [version, setVersion] = useState(0);
  const [result, setResult] = useState({ key: null, data: null, error: null });
  const key = path ? `${path}#${version}` : null;

  useEffect(() => {
    if (!path) return undefined;
    let cancelled = false;
    apiRequest(path)
      .then((data) => !cancelled && setResult({ key, data, error: null }))
      .catch((error) => !cancelled && setResult({ key, data: null, error }));
    return () => {
      cancelled = true;
    };
  }, [path, key]);

  const reload = useCallback(() => setVersion((v) => v + 1), []);
  const current = result.key === key;
  return {
    data: current ? result.data : null,
    error: current ? result.error : null,
    loading: Boolean(key) && !current,
    reload,
  };
}
