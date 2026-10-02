import { describe, expect, it } from 'vitest';
import type { Menu, MenuInsumo } from '../types/nutrition';
import { repairLegacyMenuPortions, repairLegacyRecipePortion, recipePortionGrams } from './recipeMenuPortion';

describe('recipe portions in menus', () => {
  it('keeps energy and cost proportional when a 55 g serving is edited', () => {
    const reference = recipePortionGrams({ perCapita: 0.055 });
    expect(reference).toBe(55);
    // Example values, not a nutritional reference for a particular recipe.
    expect(200 * 55 / reference).toBe(200);
    expect(200 * 110 / reference).toBe(400);
    expect(2 * 110 / reference).toBe(4);
  });

  it('uses the existing 100 g fallback for a missing portion', () => {
    expect(recipePortionGrams({ perCapita: 0 })).toBe(100);
  });
});

const legacyItem: MenuInsumo = {
  id: 'meat', nome: 'Carne com legumes', type: 'recipe', referenceId: 'recipe-meat',
  pesoReferencia: 0.1, pesoAtual: 100, custoBase: 2,
  valoresNutricionaisBase: { kcal: 187.271, protein: 20, lipids: 10, carbohydrates: 5,
    fiber: 1, calcium: 10, iron: 2, zinc: 1, vitaminA: 10, vitaminC: 5 },
};

describe('saved menus with legacy kg references', () => {
  it('repairs the 187271 kcal case without changing the 100 g portion', () => {
    const item = repairLegacyRecipePortion(legacyItem);
    expect(item.pesoAtual).toBe(100);
    expect(item.pesoReferencia).toBe(100);
    expect(item.valoresNutricionaisBase.kcal * item.pesoAtual / item.pesoReferencia).toBeCloseTo(187.271);
    expect(item.valoresNutricionaisBase).toBe(legacyItem.valoresNutricionaisBase);
    expect(legacyItem.pesoReferencia).toBe(0.1);
    expect(repairLegacyRecipePortion(item)).toBe(item);
  });

  it.each([0.1, 0.075])('converts an untouched or replicated old kg portion (%s)', weight => {
    const item = repairLegacyRecipePortion({ ...legacyItem, pesoAtual: weight });
    expect(item.pesoAtual).toBe(weight * 1000);
    expect(item.pesoReferencia).toBe(100);
  });

  it('preserves an explicitly zero portion', () => {
    expect(repairLegacyRecipePortion({ ...legacyItem, pesoAtual: 0 }).pesoAtual).toBe(0);
  });

  it('leaves foods, valid gram portions and marked entries unchanged', () => {
    for (const item of [
      { ...legacyItem, type: 'food' as const },
      { ...legacyItem, pesoReferencia: 100 },
      { ...legacyItem, portionUnitVersion: 1 as const },
      { ...legacyItem, valoresNutricionaisBase: { ...legacyItem.valoresNutricionaisBase, kcal: 0.2 } },
    ]) expect(repairLegacyRecipePortion(item)).toBe(item);
  });

  it('recalculates daily averages with mixed foods and recipes on load', () => {
    const food = { ...legacyItem, id: 'rice', type: 'food' as const, pesoReferencia: 100,
      pesoAtual: 80, custoBase: 1, valoresNutricionaisBase: { ...legacyItem.valoresNutricionaisBase, kcal: 127.5, protein: 2 } };
    const menu = { slots: ['Segunda', 'Terça'].map(dayLabel => ({ id: dayLabel, dayLabel,
      mealLabel: 'Almoço', nomeFantasia: 'Almoço', composicao: [legacyItem, food] })),
      averageKcal: 187373, averageProtein: 20001.6, averageCost: 2000.8 } as Menu;
    const repaired = repairLegacyMenuPortions(menu);
    expect(repaired.averageKcal).toBeCloseTo(289.271);
    expect(repaired.averageProtein).toBeCloseTo(21.6);
    expect(repaired.averageCost).toBeCloseTo(2.8);
    expect(repaired.slots[0].composicao[1]).toBe(food);
    expect(repairLegacyMenuPortions(repaired)).toBe(repaired);
  });
});
