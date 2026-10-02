import { describe, expect, it } from 'vitest';
import { recipeYieldMetrics, validIngredientWeights } from './recipeCalculation';
import { getDefaultCorrectionFactor } from '../data/correctionFactors';
import { DEFAULT_RECIPES } from '../data/defaultRecipes';
import type { RecipeIngredient } from '../types/nutrition';

const ingredient: RecipeIngredient = { id: 'carrot', foodId: 'food-9', foodName: 'Cenoura',
  grossWeight: 1.17, netWeight: 1, correctionFactor: 1.17, estimatedCost: 3 };

describe('recipe mass and portion calculations', () => {
  it('uses prepared yield, without dividing raw ingredients by a ready portion', () => {
    const result = recipeYieldMetrics(12, 240, 17.35, 17.35);
    expect(result.perCapita).toBeCloseTo(0.05);
    expect(result.yieldPercentage).toBeCloseTo(69.164265);
    expect(result.cookingIndex).toBeCloseTo(12 / 17.35);
  });
  it('allows hydration to raise cooking yield above one without raising cleaning FC', () => {
    const result = recipeYieldMetrics(2.33, 20, 1, 1);
    expect(result.cookingIndex).toBe(2.33);
    expect(result.perCapita).toBeCloseTo(0.1165);
    expect(getDefaultCorrectionFactor('food-200')).toBe(1);
  });
  it('requires missing factors to be entered rather than silently assuming no loss', () => {
    expect(getDefaultCorrectionFactor('custom-food')).toBe(0);
    expect(getDefaultCorrectionFactor('food-225')).toBe(1.12);
    expect(getDefaultCorrectionFactor('food-9')).toBe(1.17);
  });
  it('validates cleaning masses, missing factors and inconsistent stored weights', () => {
    expect(validIngredientWeights(ingredient)).toBe(true);
    for (const change of [
      { netWeight: 2 }, { grossWeight: 0 }, { correctionFactor: 0 },
      { correctionFactor: 0.8 }, { netWeight: 0.9 }, { estimatedCost: -1 }, { grossWeight: NaN },
    ]) expect(validIngredientWeights({ ...ingredient, ...change })).toBe(false);
    expect(validIngredientWeights({ ...ingredient, grossWeight: 0.2, netWeight: 0.1709 })).toBe(true);
  });
  it('keeps template masses, correction ratios and ready portions consistent', () => {
    for (const recipe of DEFAULT_RECIPES) {
      expect(recipe.perCapita).toBeCloseTo(recipe.yieldTotal / recipe.servings);
      expect(recipe.totalGrossWeight).toBeCloseTo(recipe.ingredients.reduce((sum, item) => sum + item.grossWeight, 0));
      expect(recipe.totalNetWeight).toBeCloseTo(recipe.ingredients.reduce((sum, item) => sum + item.netWeight, 0));
      for (const item of recipe.ingredients) expect(validIngredientWeights(item), recipe.name + ': ' + item.foodName).toBe(true);
    }
  });
});
