/**
 * useNotificationState
 *
 * Persiste os IDs de notificações "vistas" pelo usuário no Firestore,
 * garantindo sincronização real entre dispositivos.
 *
 * Coleção: notificationState/{userId}
 * Campo:   seenIds: string[]
 *
 * Mantém localStorage como cache local para leitura rápida sem esperar
 * o Firestore (os dois são mantidos em sincronia).
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { db } from '@/lib/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';

function buildStorageKey(userId?: string | null) {
  return `pnae_seen_notifications:${userId || 'guest'}`;
}

export function useNotificationState(userId?: string | null) {
  const storageKey = useMemo(() => buildStorageKey(userId), [userId]);
  const [seenIds, setSeenIds] = useState<string[]>([]);

  // ── Load: Firestore first, localStorage as fallback ──────────────────────
  useEffect(() => {
    let mounted = true;

    const load = async () => {
      // Start with whatever is already in localStorage (instant)
      try {
        const cached = localStorage.getItem(storageKey);
        if (cached && mounted) {
          setSeenIds(JSON.parse(cached));
        }
      } catch {
        // ignore parse error
      }

      // Then sync from Firestore if we have a real user
      if (!userId) return;
      try {
        const ref = doc(db, 'notificationState', userId);
        const snap = await getDoc(ref);
        if (!mounted) return;
        if (snap.exists()) {
          const firestoreIds: string[] = snap.data()?.seenIds ?? [];
          setSeenIds(firestoreIds);
          localStorage.setItem(storageKey, JSON.stringify(firestoreIds));
        }
      } catch (err) {
        console.warn('[useNotificationState] Firestore read failed, using cache:', err);
      }
    };

    load();
    return () => {
      mounted = false;
    };
  }, [userId, storageKey]);

  // ── Persist: write to both localStorage and Firestore ────────────────────
  const persist = useCallback(
    async (nextIds: string[]) => {
      setSeenIds(nextIds);
      localStorage.setItem(storageKey, JSON.stringify(nextIds));

      if (!userId) return;
      try {
        await setDoc(
          doc(db, 'notificationState', userId),
          { seenIds: nextIds, updatedAt: new Date().toISOString() },
          { merge: true },
        );
      } catch (err) {
        console.warn('[useNotificationState] Firestore write failed:', err);
      }
    },
    [storageKey, userId],
  );

  // ── Public API ────────────────────────────────────────────────────────────
  const markAsSeen = useCallback(
    (id: string) => {
      if (!id || seenIds.includes(id)) return;
      void persist([...seenIds, id]);
    },
    [persist, seenIds],
  );

  const markManyAsSeen = useCallback(
    (ids: string[]) => {
      const next = Array.from(new Set([...seenIds, ...ids.filter(Boolean)]));
      void persist(next);
    },
    [persist, seenIds],
  );

  const markAsUnseen = useCallback(
    (id: string) => {
      void persist(seenIds.filter((item) => item !== id));
    },
    [persist, seenIds],
  );

  const isSeen = useCallback((id: string) => seenIds.includes(id), [seenIds]);

  return { seenIds, isSeen, markAsSeen, markManyAsSeen, markAsUnseen };
}
