import { useEffect, useMemo, useState } from 'react';
import { loadHybridCollection, persistHybridSnapshot, removeHybridDocument, syncHybridDocument } from '@/lib/hybridStore';
import type { Acceptability } from '@/types';
import { useAuth } from '@/contexts/AuthContext';
import { useOrgId } from '@/hooks/useOrgId';

const LEGACY_ORG_ID = 'pnae-default-org';

function toDate(val: unknown): Date {
  if (!val) return new Date();
  if (typeof (val as { toDate?: unknown }).toDate === 'function')
    return (val as { toDate: () => Date }).toDate();
  const d = new Date(val as string | number);
  return isNaN(d.getTime()) ? new Date() : d;
}

const STORAGE_KEY = 'pnae_acceptability';
const COLLECTION_NAME = 'quality_acceptability';

export interface CreateAcceptabilityInput {
  schoolId: string;
  schoolName: string;
  testDate: Date;
  mealType: string;
  dishName?: string;
  totalStudents: number;
  approvedStudents: number;
}

function normalizeRecords(raw: unknown): Acceptability[] {
  if (!Array.isArray(raw)) return [];

  return raw.map((item, index) => {
    const record = item as Partial<Acceptability>;
    return {
      id: record.id || `acceptability-imported-${index}`,
      schoolId: record.schoolId || '',
      schoolName: record.schoolName || '',
      testDate: record.testDate ? new Date(record.testDate) : new Date(),
      mealType: record.mealType || '',
      dishName: record.dishName || '',
      totalStudents: Number(record.totalStudents) || 0,
      approvedStudents: Number(record.approvedStudents) || 0,
      percentualAprovacao: Number(record.percentualAprovacao) || 0,
      createdAt: toDate(record.createdAt),
      createdBy: record.createdBy || 'Sistema',
    };
  });
}

export function useAcceptabilityRecords() {
  const { user } = useAuth();
  const orgId = useOrgId();

  const [records, setRecords] = useState<Acceptability[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!orgId) { setLoading(false); return; }
    let mounted = true;


    loadHybridCollection({
      orgId,
      collectionName: COLLECTION_NAME,
      storageKey: STORAGE_KEY,
      normalize: normalizeRecords,
      fallbackData: [],
    })
      .then((items) => {
        if (mounted) setRecords(items);
      })
      .catch((error) => {
        console.error('Erro ao carregar aceitabilidade:', error);
        if (mounted) setRecords([]);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [orgId]);

  const persist = (next: Acceptability[]) => {
    setRecords(next);
    persistHybridSnapshot(`${STORAGE_KEY}_${orgId}`, next);
  };

  const actions = useMemo(
    () => ({
      addRecord: (input: CreateAcceptabilityInput) => {
        const percentual =
          input.totalStudents > 0 ? Number(((input.approvedStudents / input.totalStudents) * 100).toFixed(2)) : 0;

        const newRecord: Acceptability = {
          id: `acceptability-${crypto.randomUUID()}`,
          schoolId: input.schoolId,
          schoolName: input.schoolName,
          testDate: input.testDate,
          mealType: input.mealType,
          dishName: input.dishName || '',
          totalStudents: input.totalStudents,
          approvedStudents: input.approvedStudents,
          percentualAprovacao: percentual,
          createdAt: new Date(),
          createdBy: 'Sistema',
        };

        persist([newRecord, ...records]);
        void syncHybridDocument(orgId, COLLECTION_NAME, newRecord);
        return newRecord;
      },
      deleteRecord: (id: string) => {
        persist(records.filter((record) => record.id !== id));
        void removeHybridDocument(orgId, COLLECTION_NAME, id);
      },
    }),
    [records, orgId]
  );

  return {
    records,
    loading,
    ...actions,
  };
}
