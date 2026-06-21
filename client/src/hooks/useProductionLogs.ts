import { useEffect, useMemo, useState } from 'react';
import { loadHybridCollection, persistHybridSnapshot, removeHybridDocument, syncHybridDocument } from '@/lib/hybridStore';
import type { ProductionLog } from '@/types/nutrition';
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

const STORAGE_KEY = 'pnae_nutrition_production_logs';
const COLLECTION_NAME = 'nutrition_production_logs';

export interface CreateProductionLogInput {
  schoolId?: string;
  schoolName?: string;
  date: Date;
  shift: ProductionLog['shift'];
  dishName: string;
  producedQuantity: number;
  cleanLeftover: number;
  destination: ProductionLog['destination'];
  destinationEntity?: string;
  // RDC ANVISA 216/2004 — controle de temperatura
  foodType?: ProductionLog['foodType'];
  temperature?: number;
  temperatureTime?: string;
  observations?: string;
}

function normalizeProductionLogs(raw: unknown): ProductionLog[] {
  if (!Array.isArray(raw)) return [];

  return raw.map((item, index) => {
    const log = item as Partial<ProductionLog>;
    return {
      id: log.id || `production-imported-${index}`,
      schoolId: log.schoolId || '',
      schoolName: log.schoolName || '',
      date: toDate(log.date),
      shift: log.shift || 'morning',
      dishName: log.dishName || '',
      producedQuantity: Number(log.producedQuantity) || 0,
      cleanLeftover: Number(log.cleanLeftover) || 0,
      destination: log.destination || 'discard',
      destinationEntity: log.destinationEntity || '',
      foodType: log.foodType,
      temperature: log.temperature != null ? Number(log.temperature) : undefined,
      temperatureTime: log.temperatureTime || undefined,
      observations: log.observations || undefined,
      createdAt: toDate(log.createdAt),
      updatedAt: toDate(log.updatedAt),
    };
  });
}

export function useProductionLogs() {
  const { user } = useAuth();
  const orgId = useOrgId();

  const [productionLogs, setProductionLogs] = useState<ProductionLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!orgId) { setLoading(false); return; }
    let mounted = true;


    loadHybridCollection({
      orgId,
      collectionName: COLLECTION_NAME,
      storageKey: STORAGE_KEY,
      normalize: normalizeProductionLogs,
      fallbackData: [],
    })
      .then((items) => {
        if (mounted) setProductionLogs(items);
      })
      .catch((error) => {
        console.error('Erro ao carregar producao:', error);
        if (mounted) setProductionLogs([]);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [orgId]);

  const persist = (next: ProductionLog[]) => {
    setProductionLogs(next);
    persistHybridSnapshot(`${STORAGE_KEY}_${orgId}`, next);
  };

  const actions = useMemo(
    () => ({
      addProductionLog: (input: CreateProductionLogInput) => {
        const timestamp = new Date();
        const newLog: ProductionLog = {
          id: `production-${crypto.randomUUID()}`,
          schoolId: input.schoolId || '',
          schoolName: input.schoolName || '',
          date: input.date,
          shift: input.shift,
          dishName: input.dishName.trim(),
          producedQuantity: input.producedQuantity,
          cleanLeftover: input.cleanLeftover,
          destination: input.destination,
          destinationEntity: input.destinationEntity || '',
          foodType: input.foodType,
          temperature: input.temperature,
          temperatureTime: input.temperatureTime,
          observations: input.observations,
          createdAt: timestamp,
          updatedAt: timestamp,
        };
        persist([newLog, ...productionLogs]);
        void syncHybridDocument(orgId, COLLECTION_NAME, newLog);
        return newLog;
      },

      updateProductionLog: (id: string, input: Partial<CreateProductionLogInput>) => {
        const target = productionLogs.find((l) => l.id === id);
        if (!target) return false;
        const updated: ProductionLog = {
          ...target,
          ...input,
          dishName: input.dishName ? input.dishName.trim() : target.dishName,
          updatedAt: new Date(),
        };
        persist(productionLogs.map((l) => (l.id === id ? updated : l)));
        void syncHybridDocument(orgId, COLLECTION_NAME, updated);
        return true;
      },

      deleteProductionLog: (id: string) => {
        persist(productionLogs.filter((l) => l.id !== id));
        void removeHybridDocument(orgId, COLLECTION_NAME, id);
      },
    }),
    [productionLogs, orgId]
  );

  return {
    productionLogs,
    loading,
    ...actions,
  };
}
