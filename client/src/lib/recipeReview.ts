import type { Food, Recipe } from "../types/nutrition";
import { validIngredientWeights } from "./recipeCalculation";

/** Completeness and numerical consistency, not approval of the recipe by the RT. */
export function recipeReviewIssues(
  recipe: Pick<
    Recipe,
    | "name"
    | "ingredients"
    | "servings"
    | "yieldTotal"
    | "perCapita"
    | "totalGrossWeight"
    | "totalNetWeight"
    | "costTotal"
    | "costPerServing"
    | "preparationMethod"
    | "presentationStandard"
    | "nutrientsPerServing"
  >,
  foods?: Food[]
): string[] {
  const issues: string[] = [];
  if (!recipe.name.trim()) issues.push("Nome da preparação ausente.");
  if (!recipe.preparationMethod?.trim())
    issues.push("Modo de preparo ausente.");
  if (!recipe.presentationStandard?.trim())
    issues.push("Padrão de apresentação/serviço ausente.");
  if (!Number.isSafeInteger(recipe.servings) || recipe.servings <= 0)
    issues.push("Número de porções inválido.");
  if (!Number.isFinite(recipe.yieldTotal) || recipe.yieldTotal <= 0)
    issues.push("Rendimento pronto não informado.");
  if (!recipe.ingredients.length) issues.push("Ingredientes não informados.");
  for (const ingredient of recipe.ingredients) {
    if (!ingredient.foodName.trim() || !validIngredientWeights(ingredient))
      issues.push(
        `Revisar pesos/FC de ${ingredient.foodName || "ingrediente sem nome"}.`
      );
    if (
      foods &&
      !foods.some(
        f =>
          f.id === ingredient.foodId ||
          f.name.toLocaleLowerCase().trim() ===
            ingredient.foodName.toLocaleLowerCase().trim()
      )
    )
      issues.push(
        `Ingrediente sem vínculo nutricional: ${ingredient.foodName}.`
      );
  }
  const gross = recipe.ingredients.reduce((s, i) => s + i.grossWeight, 0);
  const net = recipe.ingredients.reduce((s, i) => s + i.netWeight, 0);
  const cost = recipe.ingredients.reduce((s, i) => s + i.estimatedCost, 0);
  if (
    !Number.isFinite(recipe.totalGrossWeight) ||
    !Number.isFinite(recipe.totalNetWeight) ||
    Math.abs(recipe.totalGrossWeight - gross) > 0.001 ||
    Math.abs(recipe.totalNetWeight - net) > 0.001
  )
    issues.push("Totais de peso diferentes da soma dos ingredientes.");
  if (
    Math.abs(recipe.costTotal - cost) > 0.01 ||
    recipe.costTotal < 0 ||
    !Number.isFinite(recipe.costTotal)
  )
    issues.push("Custo total inconsistente.");
  if (!(recipe.costTotal > 0))
    issues.push("Custo zerado: conferir preços e custo por porção.");
  if (
    recipe.servings > 0 &&
    (Math.abs(recipe.perCapita - recipe.yieldTotal / recipe.servings) >
      0.00001 ||
      !(recipe.perCapita > 0))
  )
    issues.push(
      "Per capita diferente do rendimento pronto dividido pelas porções."
    );
  if (
    recipe.servings > 0 &&
    (!Number.isFinite(recipe.costPerServing) ||
      Math.abs(recipe.costPerServing - recipe.costTotal / recipe.servings) >
        0.01)
  )
    issues.push("Custo por porção inconsistente.");
  if (
    !recipe.nutrientsPerServing ||
    Object.values(recipe.nutrientsPerServing).some(
      v => !Number.isFinite(v) || v < 0
    ) ||
    !(recipe.nutrientsPerServing.kcal > 0)
  )
    issues.push("Informação nutricional incompleta ou inválida.");
  return Array.from(new Set(issues));
}
