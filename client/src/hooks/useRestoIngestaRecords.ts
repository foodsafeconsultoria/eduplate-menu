import { useEffect, useMemo, useState } from 'react';
import { loadHybridCollection, persistHybridSnapshot, removeHybridDocument, syncHybridDocument } from '@/lib/hybridStore';
import type { RestoIngesta } from '@/types';
import { useAuth } from '@/contexts/AuthContext';
import { useOrgId } from '@/hooks/useOrgId';

const STORAGE_KEY = 'pnae_resto_ingesta';
const COLLECTION_NAME = 'quality_resto_ingesta';
const LEGACY_ORG_ID = 'pnae-default-org';

export interface CreateRestoIngestaInput {
  schoolId: string;
  schoolName: string;
  dishName: string;
  testDate: Date;
  pesoProducido: number;
  sobraLimpa: number;
  resto: number;
}

function normalizeRecords(raw: unknown): RestoIngesta[] {
  if (!Array.isArray(raw)) return [];

  return raw.map((item, index) => {
    const record = item as Partial<RestoIngesta>;
    return {
      id: record.id || `resto-imported-${index}`,
      schoolId: record.schoolId || '',
      schoolName: record.schoolName || '',
      dishName: record.dishName || '',
      testDate: record.testDate ? new Date(record.testDate) : new Date(),
      pesoProducido: Number(record.pesoProducido) || 0,
      sobraLimpa: Number(record.sobraLimpa) || 0,
      resto: Number(record.resto) || 0,
      percentual: Number(record.percentual) || 0,
      createdAt: record.createdAt ? new Date(record.createdAt) : new Date(),
      createdBy: record.createdBy || 'Sistema',
    };
  });
}

export function useRestoIngestaRecords() {
  const { user } = useAuth();
  const orgId = useOrgId();

  const [records, setRecords] = useState<RestoIngesta[]>([]);
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
        console.error('Erro ao carregar resto/ingesta:', error);
        if (mounted) setRecords([]);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [orgId]);

  const persist = (next: RestoIngesta[]) => {
    setRecords(next);
    persistHybridSnapshot(`${STORAGE_KEY}_${orgId}`, next);
  };

  const actions = useMemo(
    () => ({
      addRecord: (input: CreateRestoIngestaInput) => {
        const percentual = input.pesoProducido > 0 ? Number(((input.resto / input.pesoProducido) * 100).toFixed(2)) : 0;

        const newRecord: RestoIngesta = {
          id: `resto-${crypto.randomUUID()}`,
          schoolId: input.schoolId,
          schoolName: input.schoolName,
          dishName: input.dishName.trim(),
          testDate: input.testDate,
          pesoProducido: input.pesoProducido,
          sobraLimpa: input.sobraLimpa,
          resto: input.resto,
          percentual,
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
