import type { Menu, NutritionNutrientSet } from "../types/nutrition";
export const FNDE_SOURCE =
  "https://www.gov.br/fnde/pt-br/acesso-a-informacao/legislacao/resolucoes/2026/resolucao-cd_fnde-no-4-de-26-de-fevereiro-de-2026.pdf/@@download/file";
export const AGE_GROUPS = [
  { id: "7-11m", label: "Creche — 7 a 11 meses" },
  { id: "1-3y", label: "Creche — 1 a 3 anos" },
  { id: "4-5y", label: "Pré-escola — 4 a 5 anos" },
  { id: "6-10y", label: "Fundamental — 6 a 10 anos" },
  { id: "11-15y", label: "Fundamental — 11 a 15 anos" },
  { id: "16-18y", label: "Médio — 16 a 18 anos" },
  { id: "19-30y", label: "EJA — 19 a 30 anos" },
  { id: "31-60y", label: "EJA — 31 a 60 anos" },
] as const;
export type NutritionAgeGroup = (typeof AGE_GROUPS)[number]["id"];
export interface NutritionProfile {
  nutritionAgeGroups?: NutritionAgeGroup[];
  mealsPerStudentDay?: number;
  traditionalCommunity?: boolean;
  attendanceMode?: "partial" | "integral";
}
export interface ReferenceTarget {
  key: keyof NutritionNutrientSet;
  label: string;
  unit: string;
  min: number;
  max?: number;
  review?: boolean;
}
// Transcribed from Annex IV, pp. 30–32 of the official PDF (not scaled from older tables).
// Order: energy, carbohydrates [min,max], protein [min,max], lipids [min,max], optional A,C,Ca,Fe.
type Row = [
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  ...number[],
];
const TABLE: Record<NutritionAgeGroup, Partial<Record<20 | 30 | 70, Row>>> = {
  "7-11m": {
    30: [204, 28, 33, 5, 8, 6, 8, 150, 15, 78, 2],
    70: [204, 65, 77, 12, 18, 13, 18, 350, 35, 182, 5],
  },
  "1-3y": {
    30: [304, 42, 49, 8, 11, 8, 12, 63, 4, 150, 1],
    70: [304, 97, 115, 18, 27, 20, 28, 147, 9, 350, 2],
  },
  "4-5y": {
    20: [270, 37, 44, 7, 10, 8, 11],
    30: [405, 56, 66, 10, 15, 11, 16],
    70: [945, 130, 154, 24, 35, 26, 37],
  },
  "6-10y": {
    20: [329, 45, 53, 8, 12, 9, 13],
    30: [493, 68, 80, 12, 18, 14, 19],
    70: [1150, 158, 187, 29, 43, 32, 45],
  },
  "11-15y": {
    20: [473, 65, 77, 12, 18, 13, 18],
    30: [710, 98, 115, 18, 27, 20, 28],
    70: [1656, 228, 269, 41, 62, 46, 64],
  },
  "16-18y": {
    20: [543, 75, 88, 14, 20, 15, 21],
    30: [815, 112, 132, 20, 31, 23, 32],
    70: [1902, 262, 309, 48, 71, 53, 74],
  },
  "19-30y": {
    20: [477, 66, 77, 12, 18, 8, 16],
    30: [715, 98, 116, 18, 27, 12, 24],
    70: [1668, 229, 271, 42, 63, 28, 56],
  },
  "31-60y": {
    20: [459, 63, 75, 11, 17, 8, 15],
    30: [689, 95, 112, 17, 26, 11, 23],
    70: [1607, 221, 261, 40, 60, 27, 54],
  },
};
export const PLANNED_DAYS = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta"];
export const ZERO: NutritionNutrientSet = {
  kcal: 0,
  protein: 0,
  lipids: 0,
  carbohydrates: 0,
  fiber: 0,
  calcium: 0,
  iron: 0,
  zinc: 0,
  vitaminA: 0,
  vitaminC: 0,
};
export function nutritionReference(
  profile: NutritionProfile,
  age: NutritionAgeGroup
) {
  const meals = profile.mealsPerStudentDay;
  if (
    !profile.attendanceMode ||
    !Number.isSafeInteger(meals) ||
    !meals ||
    meals < 1 ||
    !TABLE[age]
  )
    return undefined;
  const nursery = age === "7-11m" || age === "1-3y";
  // Art. 18 III: 30% PER MEAL for PCT, except creches, including when integral.
  const perMeal = !nursery && Boolean(profile.traditionalCommunity);
  const coverage = perMeal
    ? 30
    : profile.attendanceMode === "integral"
      ? 70
      : nursery || meals >= 2
        ? 30
        : 20;
  const row = TABLE[age][coverage];
  if (!row) return undefined;
  const targets: ReferenceTarget[] = [
    {
      key: "kcal",
      label: "Energia",
      unit: "kcal",
      min: row[0],
      review: nursery && coverage === 70,
    },
    {
      key: "carbohydrates",
      label: "Carboidratos",
      unit: "g",
      min: row[1],
      max: row[2],
    },
    { key: "protein", label: "Proteínas", unit: "g", min: row[3], max: row[4] },
    { key: "lipids", label: "Lipídios", unit: "g", min: row[5], max: row[6] },
  ];
  if (nursery)
    targets.push(
      ...(
        [
          ["vitaminA", "Vitamina A", "µg", row[7]],
          ["vitaminC", "Vitamina C", "mg", row[8]],
          ["calcium", "Cálcio", "mg", row[9]],
          ["iron", "Ferro", "mg", row[10]],
        ] as const
      ).map(([key, label, unit, min]) => ({ key, label, unit, min }))
    );
  return {
    coverage,
    perMeal,
    targets,
    minMeals: perMeal
      ? 1
      : profile.attendanceMode === "integral"
        ? 3
        : nursery
          ? 2
          : 1,
  };
}
export function slotNutrients(
  slot: Menu["slots"][number]
): NutritionNutrientSet {
  const sum = { ...ZERO };
  for (const item of slot.composicao) {
    const ratio =
      item.pesoReferencia > 0 ? item.pesoAtual / item.pesoReferencia : 0;
    for (const key of Object.keys(sum) as (keyof NutritionNutrientSet)[]) {
      const value = item.valoresNutricionaisBase?.[key];
      sum[key] += Number.isFinite(value) && value >= 0 ? value * ratio : 0;
    }
  }
  return sum;
}
export function assessMenuNutrition(
  menu: Pick<Menu, "slots"> & NutritionProfile
) {
  const alerts: string[] = [];
  const groups = menu.nutritionAgeGroups || [];
  if (
    !groups.length ||
    !menu.attendanceMode ||
    !Number.isSafeInteger(menu.mealsPerStudentDay) ||
    !menu.mealsPerStudentDay ||
    menu.mealsPerStudentDay < 1
  ) {
    return {
      alerts: [
        "Informe faixa etária, jornada e refeições por aluno/dia para avaliar o Anexo IV.",
      ],
      groups: [],
    };
  }
  const slots = menu.slots.filter(
    s => s.composicao.length && s.mealCount !== 0
  );
  const invalidData = slots.some(slot =>
    slot.composicao.some(
      item =>
        !(item.pesoReferencia > 0) ||
        !Number.isFinite(item.pesoReferencia) ||
        !Number.isFinite(item.pesoAtual) ||
        item.pesoAtual < 0 ||
        Object.keys(ZERO).some(key => {
          const v =
            item.valoresNutricionaisBase?.[key as keyof NutritionNutrientSet];
          return !Number.isFinite(v) || v < 0;
        })
    )
  );
  if (invalidData)
    alerts.push(
      "Há pesos ou dados nutricionais inválidos/incompletos; revisar a composição antes de avaliar a adequação."
    );
  const daily = PLANNED_DAYS.map(day => {
    const meals = slots.filter(s => s.dayLabel === day);
    const sum = { ...ZERO };
    for (const slot of meals) {
      const nutrients = slotNutrients(slot);
      for (const key of Object.keys(sum) as (keyof NutritionNutrientSet)[])
        sum[key] += nutrients[key];
    }
    if (meals.length !== menu.mealsPerStudentDay)
      alerts.push(
        `${day}: ${meals.length} refeições planejadas; informado ${menu.mealsPerStudentDay} por aluno/dia.`
      );
    return sum;
  });
  if (menu.slots.some(s => !PLANNED_DAYS.includes(s.dayLabel)))
    alerts.push(
      "Há dias fora da semana de segunda a sexta; revise o período de avaliação."
    );
  const average = { ...ZERO };
  for (const key of Object.keys(average) as (keyof NutritionNutrientSet)[])
    average[key] =
      daily.reduce((sum, n) => sum + n[key], 0) / PLANNED_DAYS.length;
  const results = groups.flatMap(age => {
    const reference = nutritionReference(menu, age);
    if (!reference) {
      alerts.push(`Faixa etária sem referência disponível: ${age}.`);
      return [];
    }
    const label = AGE_GROUPS.find(g => g.id === age)!.label;
    if (menu.mealsPerStudentDay! < reference.minMeals)
      alerts.push(
        `${label}: jornada exige no mínimo ${reference.minMeals} refeições/dia.`
      );
    if (reference.targets.some(t => t.review))
      alerts.push(
        `${label}: energia da creche integral na tabela publicada repete a da parcial; conferir com FNDE/RT. Não há aprovação automática desse valor.`
      );
    const multiplier = reference.perMeal ? menu.mealsPerStudentDay! : 1;
    const rows = reference.targets.map(target => {
      const min = target.min * multiplier,
        max = target.max == null ? undefined : target.max * multiplier;
      const actual = average[target.key];
      const status =
        target.review || invalidData
          ? "review"
          : actual < min - 1e-8
            ? "below"
            : max != null && actual > max + 1e-8
              ? "above"
              : "within";
      if (status === "below" || status === "above")
        alerts.push(
          `${label}: ${target.label} ${status === "below" ? "abaixo" : "acima"} da referência.`
        );
      if (
        reference.perMeal &&
        slots.some(s => {
          const v = slotNutrients(s)[target.key];
          return (
            v < target.min - 1e-8 ||
            (target.max != null && v > target.max + 1e-8)
          );
        })
      )
        alerts.push(
          `${label}: conferir ${target.label} em cada refeição (PCT: referência de 30% por refeição).`
        );
      return {
        ...target,
        review: target.review || invalidData,
        min,
        max,
        actual,
        status,
        percent: min > 0 ? (actual / min) * 100 : 0,
      };
    });
    return [
      {
        age,
        label,
        coverage: reference.coverage,
        perMeal: reference.perMeal,
        rows,
      },
    ];
  });
  if (groups.length > 1)
    alerts.push(
      "Mais de uma faixa etária: esta comparação usa a mesma porção cadastrada. Diferencie as porções em cardápios próprios para cada faixa."
    );
  return { alerts: Array.from(new Set(alerts)), groups: results };
}
