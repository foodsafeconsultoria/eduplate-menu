import type { Menu, MenuSlot } from '../types/nutrition';

export function validMealCount(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

export function slotMealCount(menu: Pick<Menu, 'mealCount' | 'studentCount'>, slot?: Pick<MenuSlot, 'mealCount'>): number | undefined {
  if (slot?.mealCount == null && menu.mealCount == null && !(Number(menu.studentCount) > 0)) return undefined;
  const count = slot?.mealCount ?? menu.mealCount ?? menu.studentCount;
  return validMealCount(count) ? count : undefined;
}

/** Portion weights are g or ml; production is kg or L. */
export function productionAmount(perCapita: number, mealCount: number): number {
  return Number.isFinite(perCapita) && perCapita >= 0 && validMealCount(mealCount)
    ? perCapita * mealCount / 1000 : 0;
}

/** Costs use the same per-meal counts as production and purchasing. */
export function menuProductionCost(menu: Pick<Menu, 'slots' | 'mealCount' | 'studentCount'>): number | undefined {
  let total = 0;
  for (const slot of menu.slots) {
    if (!slot.composicao.length) continue;
    const count = slotMealCount(menu, slot);
    if (count === undefined) return undefined;
    total += slot.composicao.reduce((sum, item) => sum + (item.pesoReferencia > 0 ? item.custoBase * item.pesoAtual / item.pesoReferencia : 0), 0) * count;
  }
  return total;
}
