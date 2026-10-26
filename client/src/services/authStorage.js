const ACCESS_KEY = 'sgp.accessToken';
const REFRESH_KEY = 'sgp.refreshToken';
const USER_KEY = 'sgp.user';

function storage() {
  if (typeof window === 'undefined') return null;
  try { return window.localStorage; } catch { return null; }
}

export function saveAuthSession(session) {
  const store = storage();
  if (!store) return;
  store.setItem(ACCESS_KEY, session.accessToken);
  store.setItem(REFRESH_KEY, session.refreshToken);
  store.setItem(USER_KEY, JSON.stringify(session.user));
}

export function getAccessToken() {
  return storage()?.getItem(ACCESS_KEY) ?? null;
}

export function getRefreshToken() {
  return storage()?.getItem(REFRESH_KEY) ?? null;
}

export function getStoredUser() {
  const value = storage()?.getItem(USER_KEY);
  if (!value) return null;
  try { return JSON.parse(value); } catch { return null; }
}

export function clearAuthSession() {
  const store = storage();
  if (!store) return;
  store.removeItem(ACCESS_KEY);
  store.removeItem(REFRESH_KEY);
  store.removeItem(USER_KEY);
}
