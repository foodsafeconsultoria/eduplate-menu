/**
 * Returns the full URL for a backend API path.
 *
 * In development (proxy via Vite), returns the path as-is.
 * In production on Firebase Hosting, prepends VITE_API_URL (Railway server).
 *
 * Usage:  fetch(apiUrl('/api/stripe/portal'), { ... })
 */
export function apiUrl(path: string): string {
  const base = (import.meta.env.VITE_API_URL as string) ?? '';
  return `${base}${path}`;
}

/**
 * Returns headers including the Firebase ID token of the logged-in user.
 * Required by protected API routes (/api/email, /api/ai, /api/stripe/portal etc).
 *
 * Usage:
 *   fetch(apiUrl('/api/email/send-menu'), {
 *     method: 'POST',
 *     headers: await authHeaders(),
 *     body: JSON.stringify({...}),
 *   })
 */
export async function authHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  try {
    const { auth } = await import('@/lib/firebase');
    const token = await auth.currentUser?.getIdToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;
  } catch {
    // sem token — a API retorna 401 e o caller exibe o erro
  }
  return headers;
}
