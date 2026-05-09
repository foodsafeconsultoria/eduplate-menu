import { collection, deleteDoc, doc, getDocs, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

/**
 * Firestore rejects documents containing `undefined` values at any nesting level.
 * This helper recursively removes every key whose value is `undefined` so that
 * setDoc() never throws "Unsupported field value: undefined".
 */
function stripUndefined(val: unknown): unknown {
  if (Array.isArray(val)) return val.map(stripUndefined);
  if (val !== null && typeof val === 'object') {
    // Date instances are valid Firestore values — MUST be preserved as-is.
    // Object.entries(new Date()) returns [] which would silently turn every
    // Date field into an empty object {}, breaking all date-based logic.
    if (val instanceof Date) return val;
    return Object.fromEntries(
      Object.entries(val as Record<string, unknown>)
        .filter(([, v]) => v !== undefined)
        .map(([k, v]) => [k, stripUndefined(v)]),
    );
  }
  return val;
}

interface LoadHybridCollectionParams<T> {
  orgId: string;
  collectionName: string;
  storageKey: string;
  normalize: (raw: unknown) => T[];
  fallbackData?: T[];
}

/**
 * One-time migration: reads data from the old flat Firestore collection
 * and old localStorage key, then writes it into the new org-scoped locations.
 * Only runs once per collection per browser (tracked via a tiny flag in localStorage).
 */
async function migrateToOrgScope<T extends { id: string }>(
  orgId: string,
  collectionName: string,
  storageKey: string,   // OLD key (no orgId suffix)
  orgStorageKey: string // NEW key
) {
  // v2: bump version to force re-migration after the double-suffix bug was fixed
  const flagKey = `pnae_migrated_v2_${collectionName}_${orgId}`;
  if (localStorage.getItem(flagKey)) return; // already done

  // Gather old data from localStorage
  let oldLocalRaw: unknown[] = [];
  try {
    const raw = localStorage.getItem(storageKey);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) oldLocalRaw = parsed;
    }
  } catch { /* ignore */ }

  // Gather old data from Firestore flat collection
  let oldFirestoreRaw: unknown[] = [];
  try {
    const snap = await getDocs(collection(db, collectionName));
    if (!snap.empty) {
      oldFirestoreRaw = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    }
  } catch { /* ignore */ }

  // Merge: prefer localStorage (more recent) over Firestore
  const merged = new Map<string, unknown>();
  for (const item of oldFirestoreRaw) {
    const id = (item as any).id;
    if (id) merged.set(id, item);
  }
  for (const item of oldLocalRaw) {
    const id = (item as any).id;
    if (id) merged.set(id, item); // local wins
  }

  if (merged.size === 0) {
    localStorage.setItem(flagKey, '1');
    return;
  }

  const items = Array.from(merged.values()) as T[];

  // Write to new localStorage key and mark migration done immediately
  localStorage.setItem(orgStorageKey, JSON.stringify(items));
  localStorage.setItem(flagKey, '1');

  // Best-effort: also push to new Firestore org path (non-blocking)
  Promise.all(
    items.map((item) =>
      setDoc(doc(db, 'organizations', orgId, collectionName, item.id), stripUndefined(item) as T)
    )
  ).catch(() => {
    // Firestore sync failed — data is safe in localStorage, will sync on next save
  });
}

export async function loadHybridCollection<T>({
  orgId,
  collectionName,
  storageKey,
  normalize,
  fallbackData = [],
}: LoadHybridCollectionParams<T>): Promise<T[]> {
  const orgStorageKey = `${storageKey}_${orgId}`;

  // Run one-time migration from old flat collection to org-scoped collection.
  // This is a no-op after the first successful run.
  await migrateToOrgScope(orgId, collectionName, storageKey, orgStorageKey);

  // Always parse localStorage first — it may have unsync'd saves
  let localItems: T[] = [];
  try {
    const raw = localStorage.getItem(orgStorageKey);
    if (raw) localItems = normalize(JSON.parse(raw));
  } catch { /* ignore */ }

  const firestorePath = collection(db, 'organizations', orgId, collectionName);

  try {
    const snapshot = await getDocs(firestorePath);
    if (!snapshot.empty) {
      const remoteData = snapshot.docs.map((item) => ({
        id: item.id,
        ...item.data(),
      }));
      const remoteItems = normalize(remoteData);

      // Merge: prefer whichever version has the newer updatedAt for each doc.
      // This prevents Firestore from overwriting a locally-saved change that
      // hasn't finished syncing to Firebase yet.
      if (localItems.length > 0) {
        type AnyItem = T & { id?: string; updatedAt?: Date };
        const localMap = new Map<string, AnyItem>();
        for (const item of localItems as AnyItem[]) {
          if (item.id) localMap.set(item.id, item);
        }

        const merged: T[] = [];
        const seenIds = new Set<string>();

        for (const remoteItem of remoteItems as AnyItem[]) {
          const id = remoteItem.id;
          if (!id) { merged.push(remoteItem as T); continue; }
          seenIds.add(id);
          const localItem = localMap.get(id);
          if (!localItem) { merged.push(remoteItem as T); continue; }

          const remoteDate = remoteItem.updatedAt instanceof Date ? remoteItem.updatedAt : null;
          const localDate  = localItem.updatedAt  instanceof Date ? localItem.updatedAt  : null;

          // Prefer local if it is newer OR timestamps are equal (tie-break favours unsaved local work).
          // Only use remote when it is provably newer.
          const preferLocal =
            (localDate && remoteDate && localDate >= remoteDate) ||
            (localDate && !remoteDate); // local has a date but remote doesn't
          merged.push(preferLocal ? localItem as T : remoteItem as T);
        }

        // Keep items that exist only in localStorage (pending sync)
        for (const localItem of localItems as AnyItem[]) {
          if (localItem.id && !seenIds.has(localItem.id)) merged.push(localItem as T);
        }

        localStorage.setItem(orgStorageKey, JSON.stringify(merged));
        return merged;
      }

      localStorage.setItem(orgStorageKey, JSON.stringify(remoteItems));
      return remoteItems;
    }
  } catch (error) {
    console.warn(`Firebase indisponivel para ${collectionName}, usando fallback local.`, error);
  }

  if (localItems.length > 0) return localItems;

  localStorage.setItem(orgStorageKey, JSON.stringify(fallbackData));
  return fallbackData;
}

export function persistHybridSnapshot<T>(storageKey: string, items: T[]) {
  localStorage.setItem(storageKey, JSON.stringify(items));
}

export async function syncHybridDocument<T extends { id: string }>(
  orgId: string,
  collectionName: string,
  item: T
): Promise<boolean> {
  try {
    await setDoc(
      doc(db, 'organizations', orgId, collectionName, item.id),
      stripUndefined(item) as T
    );
    return true;
  } catch (error) {
    console.warn(`Falha ao sincronizar ${collectionName}/${item.id} no Firebase.`, error);
    return false;
  }
}

export async function removeHybridDocument(orgId: string, collectionName: string, id: string) {
  try {
    await deleteDoc(doc(db, 'organizations', orgId, collectionName, id));
  } catch (error) {
    console.warn(`Falha ao remover ${collectionName}/${id} no Firebase.`, error);
  }
}

export async function syncHybridCollectionSnapshot<T extends { id: string }>(
  orgId: string,
  collectionName: string,
  items: T[]
) {
  try {
    const orgPath = collection(db, 'organizations', orgId, collectionName);
    const snapshot = await getDocs(orgPath);
    const existingIds = new Set(snapshot.docs.map((item) => item.id));
    const nextIds = new Set(items.map((item) => item.id));

    await Promise.all(
      items.map((item) =>
        setDoc(doc(db, 'organizations', orgId, collectionName, item.id), stripUndefined(item) as T)
      )
    );

    const removedIds = Array.from(existingIds).filter((id) => !nextIds.has(id));
    await Promise.all(
      removedIds.map((id) => deleteDoc(doc(db, 'organizations', orgId, collectionName, id)))
    );
  } catch (error) {
    console.warn(`Falha ao sincronizar snapshot completo de ${collectionName}.`, error);
  }
}
