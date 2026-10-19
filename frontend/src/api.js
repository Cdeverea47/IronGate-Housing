const BASE = '/api';

function getToken() {
  return localStorage.getItem('token');
}

async function request(path, { method = 'GET', body, isForm = false } = {}) {
  const headers = {};
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  if (!isForm && body !== undefined) headers['Content-Type'] = 'application/json';

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : isForm ? body : JSON.stringify(body),
  });

  if (res.status === 204) return null;

  const contentType = res.headers.get('content-type') || '';
  const data = contentType.includes('application/json') ? await res.json() : await res.text();

  // Stale login (expired token, or the account no longer exists after a server
  // reset): clear it and send the user to the login page.
  if (res.status === 401 && token && !path.startsWith('/auth/login') && !path.startsWith('/auth/register')) {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    if (!window.location.pathname.startsWith('/login')) window.location.href = '/login';
  }

  if (!res.ok) {
    const message = (data && data.error) || 'Request failed';
    throw new Error(message);
  }
  return data;
}

export const api = {
  get: (path) => request(path),
  post: (path, body, opts) => request(path, { method: 'POST', body, ...opts }),
  put: (path, body) => request(path, { method: 'PUT', body }),
  patch: (path, body) => request(path, { method: 'PATCH', body }),
  del: (path) => request(path, { method: 'DELETE' }),
  downloadUrl: (id) => `${BASE}/documents/${id}/download`,
  portalDownloadUrl: (id) => `${BASE}/portal/documents/${id}/download`,
};
