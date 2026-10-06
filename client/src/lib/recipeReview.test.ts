import { describe, expect, it } from "vitest";
import { recipeReviewIssues } from "./recipeReview";
import { DEFAULT_RECIPES } from "../data/defaultRecipes";
import { ZERO } from "./fndeNutrition";
import type { Recipe } from "../types/nutrition";
const recipe = {
  name: "Arroz",
  servings: 10,
  yieldTotal: 1,
  perCapita: 0.1,
  totalGrossWeight: 0.5,
  totalNetWeight: 0.5,
  costTotal: 5,
  costPerServing: 0.5,
  preparationMethod: "Cozinhar.",
  presentationStandard: "Arroz solto; servir quente.",
  nutrientsPerServing: { ...ZERO, kcal: 100 },
  ingredients: [
    {
      id: "i",
      foodId: "f",
      foodName: "Arroz",
      grossWeight: 0.5,
      netWeight: 0.5,
      correctionFactor: 1,
      estimatedCost: 5,
    },
  ],
} as Recipe;
describe("Revisão das fichas técnicas", () => {
  it("aceita campos e cálculos consistentes sem declarar aprovação da RT", () =>
    expect(recipeReviewIssues(recipe)).toEqual([]));
  it("aponta modo de preparo e padrão de apresentação ausentes", () => {
    expect(
      recipeReviewIssues({
        ...recipe,
        preparationMethod: "",
        presentationStandard: "",
      })
    ).toEqual([
      "Modo de preparo ausente.",
      "Padrão de apresentação/serviço ausente.",
    ]);
  });
  it("detecta porções, custo e pesos inconsistentes", () => {
    const result = recipeReviewIssues({
      ...recipe,
      perCapita: 0.2,
      costPerServing: 2,
      totalNetWeight: 3,
    });
    expect(result).toContain(
      "Per capita diferente do rendimento pronto dividido pelas porções."
    );
    expect(result).toContain("Custo por porção inconsistente.");
    expect(result).toContain(
      "Totais de peso diferentes da soma dos ingredientes."
    );
  });
  it("não oculta ingrediente sem vínculo nutricional", () =>
    expect(recipeReviewIssues(recipe, [])).toContain(
      "Ingrediente sem vínculo nutricional: Arroz."
    ));
  it("não classifica a biblioteca modelo como fichas aprovadas", () => {
    expect(DEFAULT_RECIPES.length).toBeGreaterThan(0);
    for (const template of DEFAULT_RECIPES) {
      const issues = recipeReviewIssues(template);
      expect(issues, template.name).toContain(
        "Padrão de apresentação/serviço ausente."
      );
      expect(issues, template.name).toContain(
        "Custo zerado: conferir preços e custo por porção."
      );
      expect(
        issues.filter(
          i =>
            i.includes("Totais de peso") || i.includes("Per capita diferente")
        ),
        template.name
      ).toEqual([]);
    }
  });
});
