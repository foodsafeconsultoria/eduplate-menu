import { diffMonths, calculateApproxZScore, classifyByZScore } from '@/lib/assessmentCalculation';
import { useEffect, useMemo, useState } from 'react';
import { loadHybridCollection, persistHybridSnapshot, removeHybridDocument, syncHybridDocument } from '@/lib/hybridStore';
import type {
  NutritionalAssessment,
  NutritionalAssessmentSex,
  NutritionalAssessmentStatus,
} from '@/types';
import { useOrgId } from '@/hooks/useOrgId';

const STORAGE_KEY = 'pnae_nutritional_assessments';
const COLLECTION_NAME = 'nutrition_assessments';

function toDate(value: unknown): Date {
  if (!value) return new Date();
  if (typeof (value as { toDate?: unknown }).toDate === 'function') {
    return (value as { toDate: () => Date }).toDate();
  }
  const date = new Date(value as string | number);
  return Number.isNaN(date.getTime()) ? new Date() : date;
}

export interface CreateNutritionalAssessmentInput {
  studentName: string;
  schoolId: string;
  schoolName: string;
  className?: string;
  sex: NutritionalAssessmentSex;
  birthDate: Date;
  assessmentDate: Date;
  weightKg: number;
  heightCm: number;
  notes?: string;
}

function normalizeRecords(raw: unknown): NutritionalAssessment[] {
  if (!Array.isArray(raw)) return [];

  return raw.map((item, index) => {
    const record = item as Partial<NutritionalAssessment>;
    const birthDate = toDate(record.birthDate);
    const assessmentDate = toDate(record.assessmentDate);
    const weightKg = Number(record.weightKg) || 0;
    const heightCm = Number(record.heightCm) || 0;
    const heightM = heightCm > 0 ? heightCm / 100 : 0;
    const bmi = Number(record.bmi) || (heightM > 0 ? Number((weightKg / (heightM * heightM)).toFixed(2)) : 0);
    const ageMonths = Number(record.ageMonths) || diffMonths(birthDate, assessmentDate);
    const sex = record.sex === 'F' ? 'F' : 'M';
    const zScoreApprox = record.zScoreApprox ?? calculateApproxZScore(sex, ageMonths, bmi);
    return {
      id: record.id || `assessment-imported-${index}`,
      studentName: record.studentName || 'Aluno sem nome',
      schoolId: record.schoolId || '',
      schoolName: record.schoolName || '',
      className: record.className || '',
      sex,
      birthDate,
      assessmentDate,
      ageMonths,
      weightKg,
      heightCm,
      bmi,
      zScoreApprox: Number(zScoreApprox.toFixed(2)),
      status: record.status || classifyByZScore(zScoreApprox),
      notes: record.notes || '',
      createdAt: toDate(record.createdAt),
      createdBy: record.createdBy || 'Sistema',
    };
  });
}

export function buildNutritionalAssessment(input: CreateNutritionalAssessmentInput): NutritionalAssessment {
  const ageMonths = diffMonths(input.birthDate, input.assessmentDate);
  const heightM = input.heightCm / 100;
  const bmi = heightM > 0 ? Number((input.weightKg / (heightM * heightM)).toFixed(2)) : 0;
  const zScoreApprox = Number(calculateApproxZScore(input.sex, ageMonths, bmi).toFixed(2));

  return {
    id: `assessment-${crypto.randomUUID()}`,
    studentName: input.studentName.trim(),
    schoolId: input.schoolId,
    schoolName: input.schoolName,
    className: input.className?.trim() || '',
    sex: input.sex,
    birthDate: input.birthDate,
    assessmentDate: input.assessmentDate,
    ageMonths,
    weightKg: Number(input.weightKg.toFixed(2)),
    heightCm: Number(input.heightCm.toFixed(1)),
    bmi,
    zScoreApprox,
    status: classifyByZScore(zScoreApprox),
    notes: input.notes?.trim() || '',
    createdAt: new Date(),
    createdBy: 'Sistema',
  };
}

export function useNutritionalAssessments() {
  const orgId = useOrgId();
  const [records, setRecords] = useState<NutritionalAssessment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!orgId) {
      setLoading(false);
      return;
    }
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
        console.error('Erro ao carregar avaliações nutricionais:', error);
        if (mounted) setRecords([]);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [orgId]);

  const persist = (next: NutritionalAssessment[]) => {
    setRecords(next);
    persistHybridSnapshot(`${STORAGE_KEY}_${orgId}`, next);
  };

  const actions = useMemo(
    () => ({
      addRecord: (input: CreateNutritionalAssessmentInput) => {
        const newRecord = buildNutritionalAssessment(input);
        persist([newRecord, ...records]);
        void syncHybridDocument(orgId, COLLECTION_NAME, newRecord);
        return newRecord;
      },
      addBulkRecords: (inputs: CreateNutritionalAssessmentInput[]) => {
        const created = inputs.map((input) => buildNutritionalAssessment(input));
        persist([...created, ...records]);
        created.forEach((record) => void syncHybridDocument(orgId, COLLECTION_NAME, record));
        return created;
      },
      deleteRecord: (id: string) => {
        persist(records.filter((record) => record.id !== id));
        void removeHybridDocument(orgId, COLLECTION_NAME, id);
      },
    }),
    [records, orgId],
  );

  return {
    records,
    loading,
    ...actions,
  };
}
