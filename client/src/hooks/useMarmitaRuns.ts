import { useEffect, useMemo, useState } from 'react';
import { loadHybridCollection, persistHybridSnapshot, removeHybridDocument, syncHybridDocument } from '@/lib/hybridStore';
import type { MarmitaRun } from '@/types/nutrition';
import { useAuth } from '@/contexts/AuthContext';

const STORAGE_KEY = 'pnae_marmita_runs';
const COLLECTION_NAME = 'marmita_runs';
const LEGACY_ORG_ID = 'pnae-default-org';

function toDate(value: unknown): Date {
  if (!value) return new Date();
  if (typeof (value as any).toDate === 'function') return (value as any).toDate();
  if (value instanceof Date) return value;
  const d = new Date(value as string | number);
  return isNaN(d.getTime()) ? new Date() : d;
}

function normalizeRuns(raw: unknown): MarmitaRun[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((item, index) => {
    const r = item as Partial<MarmitaRun>;
    return {
      id: r.id || `run-${index}`,
      date: toDate(r.date),
      dishName: r.dishName || '',
      preparations: Array.isArray(r.preparations) ? r.preparations : [],
      schoolRows: Array.isArray(r.schoolRows) ? r.schoolRows : [],
      ingredients: Array.isArray(r.ingredients) ? r.ingredients : [],
      notes: r.notes || '',
      createdAt: toDate(r.createdAt),
      updatedAt: toDate(r.updatedAt),
    };
  });
}

export type CreateMarmitaRunInput = Omit<MarmitaRun, 'id' | 'createdAt' | 'updatedAt'>;

export function useMarmitaRuns() {
  const { user } = useAuth();
  const orgId = user?.organizationId || LEGACY_ORG_ID;

  const [runs, setRuns] = useState<MarmitaRun[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    loadHybridCollection({
      orgId,
      collectionName: COLLECTION_NAME,
      storageKey: STORAGE_KEY,
      normalize: normalizeRuns,
      fallbackData: [],
    })
      .then((items) => { if (mounted) setRuns(items); })
      .catch(() => { if (mounted) setRuns([]); })
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, [orgId]);

  const persist = (next: MarmitaRun[]) => {
    setRuns(next);
    persistHybridSnapshot(`${STORAGE_KEY}_${orgId}`, next);
  };

  const actions = useMemo(() => ({
    addRun: (input: CreateMarmitaRunInput) => {
      const now = new Date();
      const run: MarmitaRun = { id: `run-${crypto.randomUUID()}`, ...input, createdAt: now, updatedAt: now };
      persist([run, ...runs]);
      void syncHybridDocument(orgId, COLLECTION_NAME, run);
      return run;
    },
    updateRun: (id: string, input: Partial<CreateMarmitaRunInput>) => {
      const now = new Date();
      const next = runs.map((r) => r.id === id ? { ...r, ...input, updatedAt: now } : r);
      persist(next);
      const changed = next.find((r) => r.id === id);
      if (changed) void syncHybridDocument(orgId, COLLECTION_NAME, changed);
    },
    deleteRun: (id: string) => {
      persist(runs.filter((r) => r.id !== id));
      void removeHybridDocument(orgId, COLLECTION_NAME, id);
    },
  }), [runs, orgId]);

  return { runs, loading, ...actions };
}
