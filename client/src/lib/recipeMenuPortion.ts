import type { Menu, MenuInsumo, Recipe } from '../types/nutrition';

/** Recipe weights are stored in kg; menu weights are edited in g. */
export function recipePortionGrams(recipe: Pick<Recipe, 'perCapita'>): number {
  return recipe.perCapita > 0 ? recipe.perCapita * 1000 : 100;
}

/** Repair the old recipe-only kg reference, preserving portions already entered in g. */
export function repairLegacyRecipePortion(item: MenuInsumo): MenuInsumo {
  // New entries carry an explicit unit version. Old foods always used 100 g.
  // A sub-gram recipe reference with >10 kcal/g identifies the old unit mismatch.
  if (item.portionUnitVersion === 1 || item.type !== 'recipe'
    || !(item.pesoReferencia > 0 && item.pesoReferencia <= 1)
    || !(item.valoresNutricionaisBase.kcal / item.pesoReferencia > 10)) return item;

  return {
    ...item,
    pesoReferencia: item.pesoReferencia * 1000,
    // Untouched or proportionally replicated old portions are also in kg.
    pesoAtual: item.pesoAtual > 0 && item.pesoAtual <= 1
      ? item.pesoAtual * 1000 : item.pesoAtual,
    portionUnitVersion: 1,
  };
}

/** Recompute stored totals when a legacy reference was repaired. No database write. */
export function repairLegacyMenuPortions(menu: Menu): Menu {
  let changed = false;
  const slots = menu.slots.map(slot => ({
    ...slot,
    composicao: slot.composicao.map(item => {
      const repaired = repairLegacyRecipePortion(item);
      if (repaired !== item) changed = true;
      return repaired;
    }),
  }));
  if (!changed) return menu;

  const days = new Set(slots.filter(slot => slot.composicao.length > 0).map(slot => slot.dayLabel)).size || 1;
  let kcal = 0, protein = 0, cost = 0;
  for (const item of slots.flatMap(slot => slot.composicao)) {
    const scale = item.pesoReferencia > 0 ? item.pesoAtual / item.pesoReferencia : 0;
    kcal += item.valoresNutricionaisBase.kcal * scale;
    protein += item.valoresNutricionaisBase.protein * scale;
    cost += item.custoBase * scale;
  }
  return { ...menu, slots, averageKcal: kcal / days, averageProtein: protein / days, averageCost: cost / days };
}
