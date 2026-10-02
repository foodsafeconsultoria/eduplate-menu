import { describe, expect, it } from 'vitest';
import { bmiCalculation, calculateApproxZScore, classifyByZScore, diffMonths, getReferenceBand } from './assessmentCalculation';

describe('memory of the existing approximate assessment calculation', () => {
  it('shows the actual cm-to-m BMI calculation', () => {
    expect(bmiCalculation(32, 140)).toBe('32 / (140 / 100)² = 16.33 kg/m²');
    expect(bmiCalculation(32, 0)).toContain('indisponível');
  });
  it('counts completed months before and on the birth day', () => {
    expect(diffMonths(new Date(2016, 8, 28), new Date(2026, 8, 27))).toBe(119);
    expect(diffMonths(new Date(2016, 8, 28), new Date(2026, 8, 28))).toBe(120);
  });
  it('exposes the same sex-specific limits used by the existing calculator', () => {
    expect(getReferenceBand('F', 120).plus1).toBe(20.7);
    expect(getReferenceBand('M', 120).plus1).toBe(19.6);
    expect(getReferenceBand('F', 90).plus1).toBeCloseTo((17.2 + 20.7) / 2);
    expect(calculateApproxZScore('F', 120, 20.7)).toBe(1);
    expect(calculateApproxZScore('F', 120, 24)).toBe(2);
  });
  it('documents the existing extreme-age fallback rather than calling it WHO', () => {
    expect(getReferenceBand('M', 24)).toEqual(getReferenceBand('M', 60));
    expect(getReferenceBand('F', 300)).toEqual(getReferenceBand('F', 228));
  });
  it.each([[-3.01, 'Magreza acentuada'], [-3, 'Magreza'], [-2, 'Eutrofia'], [1, 'Eutrofia'], [1.01, 'Sobrepeso'], [2.01, 'Obesidade'], [3.01, 'Obesidade grave']])('documents classification at z=%s', (z, status) => {
    expect(classifyByZScore(Number(z))).toBe(status);
  });
});
