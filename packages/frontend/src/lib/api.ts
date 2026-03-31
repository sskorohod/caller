const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export async function api<T = unknown>(
  path: string,
  options?: RequestInit & { token?: string },
): Promise<T> {
  const { token, ...init } = options ?? {};

  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init?.headers,
    },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as any).message || `API error: ${res.status}`);
  }

  return res.json() as Promise<T>;
}
