const API_BASE = process.env.NEXT_PUBLIC_API_URL || '/api';

function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('caller_token');
}

function clearAuthAndRedirect() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem('caller_token');
  localStorage.removeItem('caller_user');
  localStorage.removeItem('caller_workspace');
  // Only redirect if not already on login page
  if (!window.location.pathname.startsWith('/login')) {
    window.location.href = '/login';
  }
}

async function request<T = unknown>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  if (!res.ok) {
    // 401 = token expired or invalid → log out and redirect
    if (res.status === 401) {
      clearAuthAndRedirect();
      throw new Error('Session expired. Please log in again.');
    }
    const body = await res.json().catch(() => ({}));
    const err = new Error((body as any).message || `Error ${res.status}`);
    (err as any).status = res.status;
    throw err;
  }

  return res.json() as Promise<T>;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'POST', body: JSON.stringify(body) }),
  put: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'PUT', body: JSON.stringify(body) }),
  patch: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'PATCH', body: JSON.stringify(body) }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
};

// Auth (no token needed)
export const authApi = {
  register: (data: { email: string; password: string; workspace_name: string }) =>
    request<{ token: string; user: { id: string; email: string }; workspace: { id: string; name: string } }>(
      '/auth/register', { method: 'POST', body: JSON.stringify(data) }
    ),
  login: (data: { email: string; password: string }) =>
    request<{ token: string; user: { id: string; email: string } }>(
      '/auth/login', { method: 'POST', body: JSON.stringify(data) }
    ),
};
