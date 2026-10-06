import { describe, expect, it } from "vitest";
import {
  assessMenuNutrition,
  nutritionReference,
  PLANNED_DAYS,
  ZERO,
} from "./fndeNutrition";
import type { MenuSlot } from "../types/nutrition";
const slot = (
  day: string,
  nutrients = { ...ZERO, kcal: 329, carbohydrates: 50, protein: 10, lipids: 10 }
): MenuSlot => ({
  id: day,
  dayLabel: day,
  mealLabel: "Almoço",
  nomeFantasia: "Refeição",
  composicao: [
    {
      id: day,
      nome: "Refeição",
      type: "food",
      referenceId: "f",
      pesoAtual: 100,
      pesoReferencia: 100,
      custoBase: 1,
      valoresNutricionaisBase: nutrients,
    },
  ],
});
const profile = {
  nutritionAgeGroups: ["6-10y" as const],
  attendanceMode: "partial" as const,
  mealsPerStudentDay: 1,
};
describe("Anexo IV por faixa etária e jornada", () => {
  it("usa referências oficiais distintas para 20%, 30% e 70%", () => {
    expect(nutritionReference(profile, "6-10y")!.targets[0].min).toBe(329);
    expect(
      nutritionReference({ ...profile, mealsPerStudentDay: 2 }, "6-10y")!
        .targets[0].min
    ).toBe(493);
    expect(
      nutritionReference(
        { ...profile, attendanceMode: "integral", mealsPerStudentDay: 3 },
        "6-10y"
      )!.targets[0].min
    ).toBe(1150);
    expect(nutritionReference(profile, "16-18y")!.targets[0].min).toBe(543);
    expect(nutritionReference(profile, "31-60y")!.targets[0].min).toBe(459);
  });
  it("limita micronutrientes prioritários à creche e não inventa zinco", () => {
    expect(
      nutritionReference(
        { ...profile, mealsPerStudentDay: 2 },
        "7-11m"
      )!.targets.map(t => t.key)
    ).toEqual([
      "kcal",
      "carbohydrates",
      "protein",
      "lipids",
      "vitaminA",
      "vitaminC",
      "calcium",
      "iron",
    ]);
    expect(nutritionReference(profile, "6-10y")!.targets).toHaveLength(4);
  });
  it("preserva energia publicada da creche integral e exige conferência", () => {
    const ref = nutritionReference(
      { ...profile, attendanceMode: "integral", mealsPerStudentDay: 3 },
      "1-3y"
    )!;
    expect(ref.targets[0]).toMatchObject({ min: 304, review: true });
    expect(ref.targets[1]).toMatchObject({ min: 97, max: 115 });
  });
  it("mantém dias vazios no denominador e verifica número de refeições", () => {
    const result = assessMenuNutrition({
      ...profile,
      slots: [slot("Segunda")],
    });
    expect(result.groups[0].rows[0].actual).toBeCloseTo(65.8);
    expect(result.alerts).toContain(
      "Terça: 0 refeições planejadas; informado 1 por aluno/dia."
    );
    expect(result.groups[0].rows[0].status).toBe("below");
  });
  it("compara limites superiores dos macronutrientes", () => {
    const result = assessMenuNutrition({
      ...profile,
      slots: PLANNED_DAYS.map(day =>
        slot(day, {
          ...ZERO,
          kcal: 400,
          carbohydrates: 70,
          protein: 30,
          lipids: 20,
        })
      ),
    });
    expect(result.groups[0].rows.find(r => r.key === "protein")!.status).toBe(
      "above"
    );
    expect(result.groups[0].rows[0].status).toBe("within");
  });
  it("diferencia porções de produção de refeições por aluno", () => {
    const a = assessMenuNutrition({
      ...profile,
      slots: PLANNED_DAYS.map(day => ({ ...slot(day), mealCount: 20 })),
    });
    const b = assessMenuNutrition({
      ...profile,
      slots: PLANNED_DAYS.map(day => ({ ...slot(day), mealCount: 300 })),
    });
    expect(a).toEqual(b);
    expect(a.groups[0].rows.every(r => r.status === "within")).toBe(true);
  });
  it("PCT exige 30% em cada refeição e soma a referência diária", () => {
    const slots = PLANNED_DAYS.flatMap(day => [
      slot(day, {
        ...ZERO,
        kcal: 100,
        carbohydrates: 5,
        protein: 1,
        lipids: 1,
      }),
      {
        ...slot(day, {
          ...ZERO,
          kcal: 886,
          carbohydrates: 145,
          protein: 29,
          lipids: 29,
        }),
        id: day + "2",
        mealLabel: "Lanche",
      },
    ]);
    const result = assessMenuNutrition({
      ...profile,
      traditionalCommunity: true,
      mealsPerStudentDay: 2,
      slots,
    });
    expect(result.groups[0].rows[0].min).toBe(986);
    expect(result.groups[0].rows[0].status).toBe("within");
    expect(result.alerts.some(a => a.includes("em cada refeição"))).toBe(true);
    expect(
      nutritionReference(
        {
          ...profile,
          traditionalCommunity: true,
          attendanceMode: "integral",
          mealsPerStudentDay: 3,
        },
        "6-10y"
      )!.perMeal
    ).toBe(true);
    expect(
      nutritionReference(
        { ...profile, traditionalCommunity: true, mealsPerStudentDay: 2 },
        "1-3y"
      )!.perMeal
    ).toBe(false);
  });
  it("não presume perfil para cardápios antigos e exige quantidade inteira", () => {
    expect(assessMenuNutrition({ slots: [] }).groups).toEqual([]);
    expect(
      nutritionReference({ ...profile, mealsPerStudentDay: 1.5 }, "6-10y")
    ).toBeUndefined();
  });
  it("verifica mínimo de refeições da creche e do integral", () => {
    expect(
      assessMenuNutrition({
        ...profile,
        nutritionAgeGroups: ["1-3y"],
        slots: [slot("Segunda")],
      }).alerts.some(a => a.includes("no mínimo 2"))
    ).toBe(true);
    expect(
      assessMenuNutrition({
        ...profile,
        attendanceMode: "integral",
        slots: [],
      }).alerts.some(a => a.includes("no mínimo 3"))
    ).toBe(true);
  });
  it("não computa uma refeição cancelada e alerta sobre múltiplas faixas", () => {
    const result = assessMenuNutrition({
      ...profile,
      nutritionAgeGroups: ["6-10y", "11-15y"],
      slots: [{ ...slot("Segunda"), mealCount: 0 }],
    });
    expect(result.groups[0].rows[0].actual).toBe(0);
    expect(result.alerts.some(a => a.includes("Diferencie as porções"))).toBe(
      true
    );
  });
});
