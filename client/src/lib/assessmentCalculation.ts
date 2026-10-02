import type { NutritionalAssessmentSex, NutritionalAssessmentStatus } from '../types';

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

export function diffMonths(birthDate: Date, assessmentDate: Date): number {
  const years = assessmentDate.getFullYear() - birthDate.getFullYear();
  const months = assessmentDate.getMonth() - birthDate.getMonth();
  let total = years * 12 + months;
  if (assessmentDate.getDate() < birthDate.getDate()) total -= 1;
  return Math.max(total, 0);
}

function interpolate(valueA: number, valueB: number, ratio: number) {
  return valueA + (valueB - valueA) * ratio;
}

export function getReferenceBand(sex: NutritionalAssessmentSex, ageMonths: number): ReferenceBand {
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

export function calculateApproxZScore(sex: NutritionalAssessmentSex, ageMonths: number, bmi: number) {
  const ref = getReferenceBand(sex, ageMonths);

  if (bmi < ref.minus3) return -3 - (ref.minus3 - bmi) / Math.max(ref.minus2 - ref.minus3, 0.1);
  if (bmi < ref.minus2) return -2 - (ref.minus2 - bmi) / Math.max(ref.minus2 - ref.minus3, 0.1);
  if (bmi <= ref.plus1) return -2 + ((bmi - ref.minus2) / Math.max(ref.plus1 - ref.minus2, 0.1)) * 3;
  if (bmi <= ref.plus2) return 1 + (bmi - ref.plus1) / Math.max(ref.plus2 - ref.plus1, 0.1);
  if (bmi <= ref.plus3) return 2 + (bmi - ref.plus2) / Math.max(ref.plus3 - ref.plus2, 0.1);
  return 3 + (bmi - ref.plus3) / Math.max(ref.plus3 - ref.plus2, 0.1);
}

export function classifyByZScore(zScore: number): NutritionalAssessmentStatus {
  if (zScore < -3) return 'Magreza acentuada';
  if (zScore < -2) return 'Magreza';
  if (zScore <= 1) return 'Eutrofia';
  if (zScore <= 2) return 'Sobrepeso';
  if (zScore <= 3) return 'Obesidade';
  return 'Obesidade grave';
}

export const ASSESSMENT_REFERENCES = [
  { label: 'Ministério da Saúde — SISVAN, Norma Técnica, 2011', url: 'https://bvsms.saude.gov.br/bvs/publicacoes/orientacoes_coleta_analise_dados_antropometricos.pdf' },
  { label: 'OMS 2007 — IMC por idade, 5–19 anos', url: 'https://www.who.int/tools/growth-reference-data-for-5to19-years/indicators/bmi-for-age' },
];

export const ASSESSMENT_METHOD = 'Método interno aproximado: interpolação por sexo entre 60, 120, 180 e 228 meses. Fonte dos valores internos não documentada; não implementa as tabelas oficiais OMS.';
export const BMI_FORMULA = 'IMC (kg/m²) = peso (kg) / [altura (cm) / 100]²';

export function bmiCalculation(weightKg: number, heightCm: number): string {
  if (!(weightKg > 0) || !(heightCm > 0)) return 'Peso ou altura inválidos: cálculo indisponível.';
  return weightKg + ' / (' + heightCm + ' / 100)² = ' + (weightKg / (heightCm / 100) ** 2).toFixed(2) + ' kg/m²';
}
