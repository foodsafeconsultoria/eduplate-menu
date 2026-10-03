import type { School, SchoolDocumentation, SchoolPeriod } from '../types';
import type { SpecialDiet } from '../types/nutrition';

export const SCHOOL_PERIODS: { key: SchoolPeriod; label: string }[] = [
  { key: 'morning', label: 'Manhã' }, { key: 'afternoon', label: 'Tarde' },
  { key: 'evening', label: 'Noite' }, { key: 'fullTime', label: 'Integral' },
];
export const emptySchoolDocumentation: SchoolDocumentation = { mbp: false, pops: false, technicalRecipes: false, popList: '' };
export function isSchoolPeriod(value: unknown): value is SchoolPeriod {
  return SCHOOL_PERIODS.some(period => period.key === value);
}
export function normalizeSchoolDetails(school: Partial<School>) {
  const raw = school.documentation;
  const studentCounts: NonNullable<School['studentCounts']> = {};
  for (const { key } of SCHOOL_PERIODS) {
    const count = school.studentCounts?.[key];
    if (typeof count === 'number' && Number.isSafeInteger(count) && count >= 0) studentCounts[key] = count;
  }
  return {
    documentation: { mbp: raw?.mbp === true, pops: raw?.pops === true,
      technicalRecipes: raw?.technicalRecipes === true, popList: typeof raw?.popList === 'string' ? raw.popList : '' },
    studentCounts,
    mealSchedules: Array.isArray(school.mealSchedules)
      ? school.mealSchedules.filter(row => typeof row?.mealLabel === 'string' && typeof row?.time === 'string')
        .map(row => ({ mealLabel: row.mealLabel.trim(), time: row.time.trim() })) : [],
  };
}
export function validStudentCounts(counts: NonNullable<School['studentCounts']>): boolean {
  return Object.values(counts).every(count => typeof count === 'number' && Number.isSafeInteger(count) && count >= 0);
}
export function validMealSchedules(rows: NonNullable<School['mealSchedules']>): boolean {
  const name = (label: string) => label.trim().toLocaleLowerCase('pt-BR').replace(/\s+/g, ' ');
  return rows.every(row => row.mealLabel.trim() && /^([01]\d|2[0-3]):[0-5]\d$/.test(row.time))
    && new Set(rows.map(row => name(row.mealLabel) + '|' + row.time)).size === rows.length;
}
/** Count active diet records by school ID; multiple restriction labels still count once. */
export function schoolRestrictionSummary(schoolId: string, diets: SpecialDiet[]) {
  const byPeriod: Record<SchoolPeriod, number> = { morning: 0, afternoon: 0, evening: 0, fullTime: 0 };
  let total = 0, unassigned = 0;
  for (const diet of diets) {
    if (diet.schoolId !== schoolId || diet.status !== 'active') continue;
    total++;
    if (isSchoolPeriod(diet.period)) byPeriod[diet.period]++;
    else unassigned++;
  }
  return { total, byPeriod, unassigned };
}
