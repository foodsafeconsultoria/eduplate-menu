/**
 * useOrgId
 *
 * Returns the current user's organizationId — but ONLY after Firebase Auth
 * has fully resolved. Returns null while auth is still loading.
 *
 * WHY THIS MATTERS:
 * Every Firestore hook used to do:
 *   const orgId = user?.organizationId || LEGACY_ORG_ID
 * On first render, user=null (auth still loading), so orgId fell back to
 * LEGACY_ORG_ID and the query fired without an authenticated token, causing
 * "FirebaseError: Missing or insufficient permissions" on every page load.
 *
 * By returning null while auth loads, hooks can simply guard:
 *   if (!orgId) return;
 * and skip the Firestore call until the token is ready.
 */
import { useAuth } from '@/contexts/AuthContext';

const LEGACY_ORG_ID = 'pnae-default-org';

export function useOrgId(): string | null {
  const { user, loading: authLoading } = useAuth();
  if (authLoading) return null;
  return user?.organizationId || LEGACY_ORG_ID;
}
