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

interface ReferenceBand {
  ageMonths: number;
  minus3: number;
  minus2: number;
  plus1: number;
  plus2: number;
  plus3: number;
}

const BMI_REFERENCE: Record<NutritionalAssessmentSex, ReferenceBand[]> = {
  F: [
    { ageMonths: 60, minus3: 11.8, minus2: 12.9, plus1: 17.2, plus2: 19.2, plus3: 21.3 },
    { ageMonths: 120, minus3: 12.8, minus2: 14.2, plus1: 20.7, plus2: 24.0, plus3: 28.0 },
    { ageMonths: 180, minus3: 14.3, minus2: 16.4, plus1: 24.6, plus2: 29.1, plus3: 33.7 },
    { ageMonths: 228, minus3: 16.3, minus2: 18.6, plus1: 25.2, plus2: 29.6, plus3: 34.8 },
  ],
  M: [
    { ageMonths: 60, minus3: 12.1, minus2: 13.2, plus1: 17.4, plus2: 19.2, plus3: 21.1 },
    { ageMonths: 120, minus3: 12.7, minus2: 14.0, plus1: 19.6, plus2: 22.2, plus3: 25.4 },
    { ageMonths: 180, minus3: 14.4, minus2: 16.4, plus1: 23.3, plus2: 26.8, plus3: 30.8 },
    { ageMonths: 228, minus3: 16.2, minus2: 18.3, plus1: 25.4, plus2: 29.7, plus3: 34.3 },
  ],
};

function toDate(value: unknown): Date {
  if (!value) return new Date();
  if (typeof (value as { toDate?: unknown }).toDate === 'function') {
    return (value as { toDate: () => Date }).toDate();
  }
  const date = new Date(value as string | number);
  return Number.isNaN(date.getTime()) ? new Date() : date;
}

function diffMonths(birthDate: Date, assessmentDate: Date): number {
  const years = assessmentDate.getFullYear() - birthDate.getFullYear();
  const months = assessmentDate.getMonth() - birthDate.getMonth();
  let total = years * 12 + months;
  if (assessmentDate.getDate() < birthDate.getDate()) total -= 1;
  return Math.max(total, 0);
}

function interpolate(valueA: number, valueB: number, ratio: number) {
  return valueA + (valueB - valueA) * ratio;
}

function getReferenceBand(sex: NutritionalAssessmentSex, ageMonths: number): ReferenceBand {
  const bands = BMI_REFERENCE[sex];
  if (ageMonths <= bands[0].ageMonths) return bands[0];
  if (ageMonths >= bands[bands.length - 1].ageMonths) return bands[bands.length - 1];

  for (let index = 0; index < bands.length - 1; index += 1) {
    const current = bands[index];
    const next = bands[index + 1];
    if (ageMonths >= current.ageMonths && ageMonths <= next.ageMonths) {
      const ratio = (ageMonths - current.ageMonths) / (next.ageMonths - current.ageMonths);
      return {
        ageMonths,
        minus3: interpolate(current.minus3, next.minus3, ratio),
        minus2: interpolate(current.minus2, next.minus2, ratio),
        plus1: interpolate(current.plus1, next.plus1, ratio),
        plus2: interpolate(current.plus2, next.plus2, ratio),
        plus3: interpolate(current.plus3, next.plus3, ratio),
      };
    }
  }

  return bands[bands.length - 1];
}

function calculateApproxZScore(sex: NutritionalAssessmentSex, ageMonths: number, bmi: number) {
  const ref = getReferenceBand(sex, ageMonths);

  if (bmi < ref.minus3) return -3 - (ref.minus3 - bmi) / Math.max(ref.minus2 - ref.minus3, 0.1);
  if (bmi < ref.minus2) return -2 - (ref.minus2 - bmi) / Math.max(ref.minus2 - ref.minus3, 0.1);
  if (bmi <= ref.plus1) return -2 + ((bmi - ref.minus2) / Math.max(ref.plus1 - ref.minus2, 0.1)) * 3;
  if (bmi <= ref.plus2) return 1 + (bmi - ref.plus1) / Math.max(ref.plus2 - ref.plus1, 0.1);
  if (bmi <= ref.plus3) return 2 + (bmi - ref.plus2) / Math.max(ref.plus3 - ref.plus2, 0.1);
  return 3 + (bmi - ref.plus3) / Math.max(ref.plus3 - ref.plus2, 0.1);
}

function classifyByZScore(zScore: number): NutritionalAssessmentStatus {
  if (zScore < -3) return 'Magreza acentuada';
  if (zScore < -2) return 'Magreza';
  if (zScore <= 1) return 'Eutrofia';
  if (zScore <= 2) return 'Sobrepeso';
  if (zScore <= 3) return 'Obesidade';
  return 'Obesidade grave';
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
