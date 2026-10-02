import type { RecipeIngredient } from '../types/nutrition';

/** Rendimento pronto (kg) é medido após cocção, separado dos ingredientes crus. */
export function recipeYieldMetrics(yieldKg: number, servings: number, netKg: number, grossKg: number) {
  return {
    perCapita: yieldKg > 0 && servings > 0 ? yieldKg / servings : 0,
    yieldPercentage: yieldKg > 0 && grossKg > 0 ? yieldKg / grossKg * 100 : 0,
    cookingIndex: yieldKg > 0 && netKg > 0 ? yieldKg / netKg : 0,
  };
}

export function validIngredientWeights(ingredient: RecipeIngredient): boolean {
  const { grossWeight: gross, netWeight: net, correctionFactor: fc, estimatedCost: cost } = ingredient;
  return [gross, net, fc, cost].every(Number.isFinite)
    && gross > 0 && net > 0 && net <= gross && fc >= 1 && cost >= 0
    && Math.abs(net - gross / fc) <= 0.00011;
}
