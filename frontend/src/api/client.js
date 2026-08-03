const SESSION_VERSION = '1.8.2';
const VERSION_KEY = 'sgiDydSessionVersion';
const TOKEN_KEY = 'sgiDydToken';
const USER_KEY = 'sgiDydUser';

function ensureSessionVersion() {
  const storedVersion = localStorage.getItem(VERSION_KEY);
  if (storedVersion !== SESSION_VERSION) {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    localStorage.setItem(VERSION_KEY, SESSION_VERSION);
  }
}

ensureSessionVersion();

export const session = {
  token: () => localStorage.getItem(TOKEN_KEY),
  user: () => {
    try { return JSON.parse(localStorage.getItem(USER_KEY) || 'null'); } catch { return null; }
  },
  save(payload) {
    localStorage.setItem(VERSION_KEY, SESSION_VERSION);
    localStorage.setItem(TOKEN_KEY, payload.token);
    localStorage.setItem(USER_KEY, JSON.stringify(payload.user));
  },
  clear() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    localStorage.setItem(VERSION_KEY, SESSION_VERSION);
  }
};

export class ApiError extends Error {
  constructor(message, status, payload = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.payload = payload;
  }
}

async function request(path, options = {}) {
  const response = await fetch(`/api${path}`, {
    ...options,
    headers: {
      ...(options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
      ...(session.token() ? { Authorization: `Bearer ${session.token()}` } : {}),
      ...(options.headers || {})
    }
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new ApiError(data.error || 'No se pudo completar la operación.', response.status, data);
  }
  return data;
}

export const api = {
  get: (path) => request(path),
  post: (path, body = {}) => request(path, { method: 'POST', body: JSON.stringify(body) }),
  put: (path, body = {}) => request(path, { method: 'PUT', body: JSON.stringify(body) }),
  delete: (path) => request(path, { method: 'DELETE' }),
  upload(scope, id, file, extra = {}) {
    const body = new FormData();
    body.append('file', file);
    Object.entries(extra).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') body.append(key, value);
    });
    return request(`/upload/${scope}/${id}`, { method: 'POST', body });
  }
};
