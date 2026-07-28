/**
 * Referências de adequação nutricional do PNAE.
 *
 * IMPORTANTE: estes valores são os MESMOS já adotados na tela de Cardápios
 * (constante fndeTargets), referentes a UMA refeição que cobre cerca de 20%
 * das necessidades diárias (almoço/refeição principal, ensino fundamental),
 * conforme a Resolução CD/FNDE nº 4/2026 (vigente, revogou a 06/2020). Servem como PARÂMETRO de conferência
 * na ficha técnica — a nutricionista RT valida conforme a etapa e o percentual
 * de cobertura da unidade (parcial 20%/30% ou integral 70%).
 *
 * Não são um substituto da avaliação técnica: são uma régua de apoio.
 */
export interface FndeReferenceItem {
  key: 'kcal' | 'protein' | 'calcium' | 'iron' | 'zinc' | 'vitaminA' | 'vitaminC';
  label: string;
  unit: string;
  /** Valor de referência por refeição (≈20% das necessidades) */
  ref: number;
  dec: number;
}

export const FNDE_MEAL_REFERENCE: FndeReferenceItem[] = [
  { key: 'kcal',     label: 'Energia',     unit: 'kcal', ref: 300, dec: 0 },
  { key: 'protein',  label: 'Proteínas',   unit: 'g',    ref: 9.4, dec: 1 },
  { key: 'calcium',  label: 'Cálcio',      unit: 'mg',   ref: 210, dec: 0 },
  { key: 'iron',     label: 'Ferro',       unit: 'mg',   ref: 1.8, dec: 1 },
  { key: 'zinc',     label: 'Zinco',       unit: 'mg',   ref: 1.4, dec: 1 },
  { key: 'vitaminA', label: 'Vitamina A',  unit: 'µg',   ref: 100, dec: 0 },
  { key: 'vitaminC', label: 'Vitamina C',  unit: 'mg',   ref: 7,   dec: 0 },
];

export const FNDE_REFERENCE_NOTE =
  'Referência: refeição cobrindo ~20% das necessidades diárias (Ensino Fundamental, Res. CD/FNDE nº 4/2026). Ajuste conforme a etapa e o percentual de cobertura da unidade.';

/** Calcula o % de adequação de um valor frente à referência da refeição. */
export function adequacyPercent(value: number, ref: number): number {
  if (ref <= 0) return 0;
  return Math.round((value / ref) * 100);
}
