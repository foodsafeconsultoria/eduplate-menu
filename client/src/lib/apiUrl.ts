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
