import { describe, expect, it, vi } from 'vitest';
import { normalizeSchoolDetails, schoolRestrictionSummary, validMealSchedules, validStudentCounts } from './schoolDetails';
import type { School } from '../types';
import type { SpecialDiet } from '../types/nutrition';

const details: Partial<School> = {
  documentation: { mbp: true, pops: false, technicalRecipes: true, popList: 'Higienização das mãos\nControle de pragas' },
  studentCounts: { morning: 120, afternoon: 80, evening: 0, fullTime: 35 },
  mealSchedules: [{ mealLabel: 'Almoço', time: '11:00' }, { mealLabel: 'Almoço', time: '12:30' }],
};
const diet = (id: string, updates: Partial<SpecialDiet> = {}): SpecialDiet => ({ id, schoolId: 'school-a', schoolName: 'A', studentName: id,
  prescription: 'Dieta prescrita', status: 'active', createdAt: new Date(), updatedAt: new Date(), ...updates });

describe('school details persistence and validation', () => {
  it('keeps schedules, document checks, POP text and all periods after JSON reload', () => {
    expect(normalizeSchoolDetails(JSON.parse(JSON.stringify(details)))).toEqual(details);
  });
  it('loads legacy schools without inventing a zero enrollment', () => {
    const normalized = normalizeSchoolDetails({});
    expect(normalized.studentCounts).toEqual({});
    expect(normalized.documentation).toEqual({ mbp: false, pops: false, technicalRecipes: false, popList: '' });
    expect(normalized.mealSchedules).toEqual([]);
  });
  it('allows meals at distinct times and rejects duplicate or invalid rows', () => {
    expect(validMealSchedules(details.mealSchedules!)).toBe(true);
    expect(validMealSchedules([])).toBe(true);
    expect(validMealSchedules([{ mealLabel: 'Almoço', time: '11:00' }, { mealLabel: ' almoço ', time: '11:00' }])).toBe(false);
    for (const row of [{ mealLabel: 'Almoço', time: '25:00' }, { mealLabel: '', time: '11:00' }, { mealLabel: 'Almoço', time: '' }]) expect(validMealSchedules([row])).toBe(false);
  });
  it('distinguishes zero from missing and rejects invalid enrollment', () => {
    expect(validStudentCounts({})).toBe(true);
    expect(validStudentCounts({ morning: 0 })).toBe(true);
    for (const count of [-1, 1.5, NaN, Infinity]) expect(validStudentCounts({ morning: count })).toBe(false);
    expect(normalizeSchoolDetails({ studentCounts: { morning: -1, afternoon: 0 } }).studentCounts).toEqual({ afternoon: 0 });
  });
});
describe('automatic school restriction counts', () => {
  it('counts only active records for the exact school and keeps unknown periods separate', () => {
    const records = [diet('1', { period: 'morning', labels: ['milk', 'gluten'] }), diet('2', { period: 'afternoon' }),
      diet('3'), diet('4', { period: 'morning', status: 'inactive' }), diet('5', { schoolId: 'other', schoolName: 'A' }),
      diet('6', { period: 'fullTime' }), diet('7', { period: 'evening' })];
    expect(schoolRestrictionSummary('school-a', records)).toEqual({ total: 5, unassigned: 1,
      byPeriod: { morning: 1, afternoon: 1, evening: 1, fullTime: 1 } });
    expect(schoolRestrictionSummary('unknown', records).total).toBe(0);
  });
});
