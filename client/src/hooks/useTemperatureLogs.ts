import { useEffect, useMemo, useState } from 'react';
import { loadHybridCollection, persistHybridSnapshot, removeHybridDocument, syncHybridDocument } from '@/lib/hybridStore';
import { useOrgId } from '@/hooks/useOrgId';

const STORAGE_KEY = 'pnae_temperature_logs';
const COLLECTION_NAME = 'temperature_logs';

/** Temperatura mínima de cocção no centro do alimento (RDC ANVISA 216/2004). */
export const COCCAO_MIN_TEMP = 70; // °C

export interface TemperatureLog {
  id: string;
  /** Data da aferição (meio-dia local para evitar fuso). */
  date: Date;
  /** Hora "HH:MM". */
  time: string;
  /** Preparação / alimento aferido (ex.: "Arroz", "Carne moída"). */
  preparation: string;
  /** Temperatura aferida em °C. */
  temperature: number;
  /** Ação corretiva registrada quando fora do limite. */
  correctiveAction?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateTemperatureLogInput {
  date: Date;
  time: string;
  preparation: string;
  temperature: number;
  correctiveAction?: string;
}

/** Conformidade da cocção: conforme se ≥ limite (padrão COCCAO_MIN_TEMP). */
export function isTemperatureConforme(temp: number, minTemp: number = COCCAO_MIN_TEMP): boolean {
  return temp >= minTemp;
}

function toDate(val: unknown): Date {
  if (!val) return new Date();
  if (typeof (val as { toDate?: unknown }).toDate === 'function') return (val as { toDate: () => Date }).toDate();
  const d = new Date(val as string | number);
  return isNaN(d.getTime()) ? new Date() : d;
}

function normalize(raw: unknown): TemperatureLog[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((item, index) => {
    const log = item as Partial<TemperatureLog>;
    return {
      id: log.id || `temp-imported-${index}`,
      date: toDate(log.date),
      time: log.time || '',
      preparation: log.preparation || '',
      temperature: Number(log.temperature) || 0,
      correctiveAction: log.correctiveAction || undefined,
      createdAt: toDate(log.createdAt),
      updatedAt: toDate(log.updatedAt),
    };
  });
}

export function useTemperatureLogs() {
  const orgId = useOrgId();
  const [logs, setLogs] = useState<TemperatureLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!orgId) { setLoading(false); return; }
    let mounted = true;
    loadHybridCollection({ orgId, collectionName: COLLECTION_NAME, storageKey: STORAGE_KEY, normalize, fallbackData: [] })
      .then((items) => { if (mounted) setLogs(items); })
      .catch((e) => { console.error('Erro ao carregar temperaturas:', e); if (mounted) setLogs([]); })
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, [orgId]);

  const persist = (next: TemperatureLog[]) => {
    setLogs(next);
    persistHybridSnapshot(`${STORAGE_KEY}_${orgId}`, next);
  };

  const actions = useMemo(() => ({
    addTemperatureLog: (input: CreateTemperatureLogInput) => {
      const ts = new Date();
      const log: TemperatureLog = {
        id: `temp-${crypto.randomUUID()}`,
        date: input.date,
        time: input.time,
        preparation: input.preparation.trim(),
        temperature: input.temperature,
        correctiveAction: input.correctiveAction?.trim() || undefined,
        createdAt: ts,
        updatedAt: ts,
      };
      persist([log, ...logs]);
      void syncHybridDocument(orgId, COLLECTION_NAME, log);
      return log;
    },
    updateTemperatureLog: (id: string, input: Partial<CreateTemperatureLogInput>) => {
      const target = logs.find((l) => l.id === id);
      if (!target) return false;
      const updated: TemperatureLog = {
        ...target,
        ...(input.date !== undefined && { date: input.date }),
        ...(input.time !== undefined && { time: input.time }),
        ...(input.preparation !== undefined && { preparation: input.preparation.trim() }),
        ...(input.temperature !== undefined && { temperature: input.temperature }),
        ...(input.correctiveAction !== undefined && { correctiveAction: input.correctiveAction.trim() || undefined }),
        updatedAt: new Date(),
      };
      persist(logs.map((l) => (l.id === id ? updated : l)));
      void syncHybridDocument(orgId, COLLECTION_NAME, updated);
      return true;
    },
    deleteTemperatureLog: (id: string) => {
      persist(logs.filter((l) => l.id !== id));
      void removeHybridDocument(orgId, COLLECTION_NAME, id);
    },
  }), [logs, orgId]);

  return { logs, loading, ...actions };
}
