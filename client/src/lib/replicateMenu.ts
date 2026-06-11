/**
 * replicateMenu — replica um cardápio para outra etapa de ensino,
 * escalando as porções (pesoAtual) por um fator baseado nas necessidades
 * energéticas relativas de cada faixa etária.
 *
 * Os fatores abaixo são SUGESTÕES iniciais, calculados a partir da proporção
 * entre as necessidades energéticas médias das faixas etárias usadas como
 * referência pelo PNAE (Resolução CD/FNDE nº 06/2020). A nutricionista RT
 * pode ajustar o fator na hora de replicar e refinar cada porção depois,
 * no editor do cardápio.
 */
import type { Menu, MenuSlot } from '@/types/nutrition';
import type { CreateMenuInput } from '@/hooks/useMenus';

export type EtapaCategory = 'Creche' | 'Ensino Infantil' | 'Fundamental 1' | 'Fundamental 2' | 'Médio';

/** Fator sugerido por etapa, relativo a Fundamental 1 (6–10 anos) = 1,00 */
export const SUGGESTED_FACTORS: Record<EtapaCategory, number> = {
  'Creche':          0.60, // 1–3 anos
  'Ensino Infantil': 0.75, // 4–5 anos
  'Fundamental 1':   1.00, // 6–10 anos
  'Fundamental 2':   1.25, // 11–14 anos
  'Médio':           1.35, // 15–17 anos
};

/** Fator sugerido para converter da etapa de origem para a etapa destino. */
export function suggestedFactor(from: string, to: EtapaCategory): number {
  const fromFactor = SUGGESTED_FACTORS[from as EtapaCategory] ?? 1;
  const toFactor = SUGGESTED_FACTORS[to] ?? 1;
  if (fromFactor <= 0) return 1;
  return Math.round((toFactor / fromFactor) * 100) / 100;
}

/**
 * Mapeia o rótulo de refeição entre estruturas de grade diferentes.
 * Creche: Café da manhã / Almoço / Café da tarde / Jantar
 * Ensino Infantil: Almoço / Lanche
 * Fundamental e Médio: Almoço/Jantar / Lanche
 * Retorna null quando a refeição não tem equivalente na etapa destino
 * (ex.: Café da manhã da Creche → Fundamental).
 */
export function mapMealLabel(meal: string, target: EtapaCategory): string | null {
  const isCrecheTarget = target === 'Creche';
  const isInfantilTarget = target === 'Ensino Infantil';

  if (isCrecheTarget) {
    if (meal === 'Almoço/Jantar' || meal === 'Almoço') return 'Almoço';
    if (meal === 'Lanche' || meal === 'Café da tarde') return 'Café da tarde';
    if (meal === 'Café da manhã' || meal === 'Jantar') return meal;
    return meal; // mantém rótulos personalizados
  }

  // Destino: Ensino Infantil, Fundamental ou Médio
  const lunchLabel = isInfantilTarget ? 'Almoço' : 'Almoço/Jantar';
  if (meal === 'Almoço' || meal === 'Almoço/Jantar') return lunchLabel;
  if (meal === 'Lanche' || meal === 'Café da tarde') return 'Lanche';
  if (meal === 'Café da manhã' || meal === 'Jantar') return null; // sem equivalente fora da Creche
  return meal;
}

const round1 = (n: number) => Math.round(n * 10) / 10;

/**
 * Gera o payload de um novo cardápio replicado para a etapa destino,
 * com todas as porções escaladas pelo fator informado.
 * Refeições sem equivalente na grade destino são omitidas (retornadas em `skippedMeals`).
 */
export function replicateMenuForCategory(
  menu: Menu,
  target: EtapaCategory,
  factor: number,
  responsibleName: string,
): { payload: CreateMenuInput; skippedMeals: string[] } {
  const skipped = new Set<string>();

  const slots: MenuSlot[] = [];
  for (const slot of menu.slots || []) {
    const mappedMeal = mapMealLabel(slot.mealLabel, target);
    if (mappedMeal === null) {
      if (slot.composicao.length > 0) skipped.add(slot.mealLabel);
      continue;
    }
    slots.push({
      id: `slot-${crypto.randomUUID()}`,
      dayLabel: slot.dayLabel,
      mealLabel: mappedMeal,
      nomeFantasia: slot.nomeFantasia,
      composicao: slot.composicao.map((ins) => ({
        ...ins,
        id: `ins-${crypto.randomUUID()}`,
        pesoAtual: round1(ins.pesoAtual * factor),
        valoresNutricionaisBase: { ...ins.valoresNutricionaisBase },
      })),
    });
  }

  const payload: CreateMenuInput = {
    title: `${menu.title} — ${target}`,
    category: target,
    targetCategories: [target],
    referenceMonth: menu.referenceMonth,
    weekStartDate: menu.weekStartDate,
    schoolIds: menu.schoolIds || [],
    slots,
    items: [],
    // Aproximações lineares — recalculadas com precisão ao abrir/salvar no editor
    averageCost:    round1((menu.averageCost    || 0) * factor),
    averageKcal:    round1((menu.averageKcal    || 0) * factor),
    averageProtein: round1((menu.averageProtein || 0) * factor),
    familyFarmShare: menu.familyFarmShare || 0,
    missingTargets: [],
    repeatedPreparations: [],
    emptySlots: [],
    complianceAlerts: [],
    responsibleName,
  };

  return { payload, skippedMeals: Array.from(skipped) };
}
