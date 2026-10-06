import { describe, expect, it } from "vitest";
import { jsPDF } from "jspdf";
import { addRecipeToDoc } from "./recipePdf";
import { DEFAULT_RECIPES } from "../data/defaultRecipes";
import type { Recipe } from "../types/nutrition";
describe("PDF da ficha técnica", () => {
  it("inclui padrão de serviço, preparo e dados por porção sem falsa adequação de uma preparação", async () => {
    const recipe = {
      ...DEFAULT_RECIPES[0],
      presentationStandard: "Arroz solto, servido quente.",
      id: "r",
      createdAt: new Date(),
      updatedAt: new Date(),
    } as Recipe;
    const doc = new jsPDF();
    await addRecipeToDoc(doc, recipe);
    const pdf = doc.output();
    expect(pdf).toContain("Arroz solto, servido quente.");
    expect(pdf).toContain("MODO DE PREPARO");
    expect(pdf).toContain("por por");
    expect(pdf).not.toContain("ADEQUA");
    expect(pdf).toContain("Custo zerado");
    expect(doc.getNumberOfPages()).toBeGreaterThan(0);
  });
});
