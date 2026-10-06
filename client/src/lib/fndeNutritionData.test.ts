import { describe, expect, it } from "vitest";
import { assessMenuNutrition, ZERO } from "./fndeNutrition";
import type { MenuSlot } from "../types/nutrition";
describe("Dados nutricionais incompletos", () => {
  it("não mostra adequação quando um peso ou nutriente está inválido", () => {
    const slot = {
      id: "s",
      dayLabel: "Segunda",
      mealLabel: "Almoço",
      nomeFantasia: "Arroz",
      composicao: [
        {
          id: "i",
          nome: "Arroz",
          type: "food",
          referenceId: "f",
          pesoAtual: 100,
          pesoReferencia: 100,
          custoBase: 1,
          valoresNutricionaisBase: { ...ZERO, kcal: Infinity },
        },
      ],
    } as MenuSlot;
    const result = assessMenuNutrition({
      slots: [slot],
      nutritionAgeGroups: ["6-10y"],
      mealsPerStudentDay: 1,
      attendanceMode: "partial",
    });
    expect(result.groups[0].rows.every(row => row.status === "review")).toBe(
      true
    );
    expect(
      result.alerts.some(alert => alert.includes("inválidos/incompletos"))
    ).toBe(true);
  });
});
