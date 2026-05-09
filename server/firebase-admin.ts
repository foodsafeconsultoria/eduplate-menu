/**
 * Firebase Admin SDK — server-side only.
 * Used by Stripe webhooks to update org subscription status in Firestore
 * without going through client-side security rules.
 *
 * Required env vars (set in .env):
 *   FIREBASE_SERVICE_ACCOUNT_KEY  — full JSON string of the service account key
 *   (download from Firebase Console → Project Settings → Service Accounts → Generate new private key)
 */
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

let adminDb: ReturnType<typeof getFirestore> | null = null;

export function getAdminDb(): ReturnType<typeof getFirestore> {
  if (adminDb) return adminDb;

  const keyJson = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (!keyJson) {
    throw new Error(
      'FIREBASE_SERVICE_ACCOUNT_KEY env var is missing. ' +
      'Download the service account key from Firebase Console → Project Settings → Service Accounts.'
    );
  }

  let serviceAccount: object;
  try {
    serviceAccount = JSON.parse(keyJson);
  } catch {
    throw new Error('FIREBASE_SERVICE_ACCOUNT_KEY is not valid JSON.');
  }

  if (!getApps().length) {
    initializeApp({ credential: cert(serviceAccount as any) });
  }

  adminDb = getFirestore();
  return adminDb;
}
