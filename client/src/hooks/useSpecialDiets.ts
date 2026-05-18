import { useEffect, useMemo, useState } from 'react';
import { loadHybridCollection, persistHybridSnapshot, removeHybridDocument, syncHybridDocument } from '@/lib/hybridStore';
import type { SpecialDiet } from '@/types/nutrition';
import { useAuth } from '@/contexts/AuthContext';
import { useOrgId } from '@/hooks/useOrgId';

const STORAGE_KEY = 'pnae_nutrition_special_diets';
const COLLECTION_NAME = 'nutrition_special_diets';
const LEGACY_ORG_ID = 'pnae-default-org';

export interface CreateSpecialDietInput {
  studentName: string;
  schoolId: string;
  schoolName: string;
  category?: string;
  restrictionCode?: string;
  diagnosis?: string;
  prescription: string;
  labels?: string[];
  status: SpecialDiet['status'];
}

/** Converte corretamente tanto strings ISO quanto Timestamps do Firestore. */
function toDate(val: unknown): Date {
  if (!val) return new Date();
  if (typeof (val as { toDate?: unknown }).toDate === 'function')
    return (val as { toDate: () => Date }).toDate();
  const d = new Date(val as string | number);
  return isNaN(d.getTime()) ? new Date() : d;
}

function normalizeSpecialDiets(raw: unknown): SpecialDiet[] {
  if (!Array.isArray(raw)) return [];

  return raw.map((item, index) => {
    const diet = item as Partial<SpecialDiet>;
    return {
      id: diet.id || `diet-imported-${index}`,
      studentName: diet.studentName || 'Aluno sem nome',
      schoolId: diet.schoolId || '',
      schoolName: diet.schoolName || '',
      category: diet.category || '',
      restrictionCode: diet.restrictionCode || '',
      diagnosis: diet.diagnosis || '',
      prescription: diet.prescription || '',
      labels: Array.isArray(diet.labels) ? diet.labels : [],
      status: diet.status || 'active',
      createdAt: toDate(diet.createdAt),
      updatedAt: toDate(diet.updatedAt),
    };
  });
}

export function useSpecialDiets() {
  const { user } = useAuth();
  const orgId = useOrgId();

  const [specialDiets, setSpecialDiets] = useState<SpecialDiet[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!orgId) { setLoading(false); return; }
    let mounted = true;


    loadHybridCollection({
      orgId,
      collectionName: COLLECTION_NAME,
      storageKey: STORAGE_KEY,
      normalize: normalizeSpecialDiets,
      fallbackData: [],
    })
      .then((items) => {
        if (mounted) setSpecialDiets(items);
      })
      .catch((error) => {
        console.error('Erro ao carregar dietas especiais:', error);
        if (mounted) setSpecialDiets([]);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [orgId]);

  const persist = (next: SpecialDiet[]) => {
    setSpecialDiets(next);
    persistHybridSnapshot(`${STORAGE_KEY}_${orgId}`, next);
  };

  const actions = useMemo(
    () => ({
      addSpecialDiet: (input: CreateSpecialDietInput) => {
        const timestamp = new Date();
        const newDiet: SpecialDiet = {
          id: `diet-${crypto.randomUUID()}`,
          studentName: input.studentName.trim(),
          schoolId: input.schoolId,
          schoolName: input.schoolName,
          category: input.category || '',
          restrictionCode: input.restrictionCode || '',
          diagnosis: input.diagnosis || '',
          prescription: input.prescription,
          labels: input.labels || [],
          status: input.status,
          createdAt: timestamp,
          updatedAt: timestamp,
        };

        persist([newDiet, ...specialDiets]);
        void syncHybridDocument(orgId, COLLECTION_NAME, newDiet);
        return newDiet;
      },
      updateSpecialDiet: (id: string, updates: Partial<Omit<SpecialDiet, 'id'>>) => {
        const next = specialDiets.map((diet) =>
          diet.id === id ? { ...diet, ...updates, updatedAt: new Date() } : diet
        );
        persist(next);
        const updated = next.find((diet) => diet.id === id);
        if (updated) void syncHybridDocument(orgId, COLLECTION_NAME, updated);
      },
      deleteSpecialDiet: (id: string) => {
        persist(specialDiets.filter((diet) => diet.id !== id));
        void removeHybridDocument(orgId, COLLECTION_NAME, id);
      },
    }),
    [specialDiets, orgId]
  );

  return {
    specialDiets,
    loading,
    ...actions,
  };
}
