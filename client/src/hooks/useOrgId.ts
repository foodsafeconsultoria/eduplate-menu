/**
 * useOrgId
 *
 * Returns the current user's organizationId — but ONLY after Firebase Auth
 * has fully resolved. Returns null while auth is still loading.
 *
 * WHY THIS MATTERS:
 * Every Firestore hook used to fall back to a shared legacy org.
 * That created cross-tenant leakage risk and eager queries before auth settled.
 *
 * By returning null while auth loads, hooks can simply guard:
 *   if (!orgId) return;
 * and skip the Firestore call until the token is ready.
 */
import { useAuth } from '@/contexts/AuthContext';

export function useOrgId(): string | null {
  const { user, loading: authLoading } = useAuth();
  if (authLoading) return null;
  return user?.organizationId || null;
}
