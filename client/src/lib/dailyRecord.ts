import type { Menu } from "../types/nutrition";
import { slotMealCount } from "./menuProduction";

export const DAILY_CHECKS = [
  {
    id: "portions",
    label:
      "As porções e o preparo seguiram as fichas técnicas e o per capita planejado?",
  },
  {
    id: "access",
    label: "Todas as refeições previstas foram ofertadas aos alunos presentes?",
  },
  {
    id: "diets",
    label:
      "As dietas especiais previstas foram atendidas, com cuidados para evitar contato com alérgenos?",
  },
  {
    id: "temperature",
    label:
      "As temperaturas foram aferidas e registradas conforme o procedimento da unidade?",
  },
  {
    id: "hygiene",
    label:
      "Os controles de higiene, água e condições dos alimentos foram verificados sem ocorrência pendente?",
  },
  {
    id: "samples",
    label:
      "As amostras foram coletadas e identificadas conforme o procedimento aplicável à unidade?",
  },
] as const;
export type CheckId = (typeof DAILY_CHECKS)[number]["id"];
export type CheckAnswer = "" | "yes" | "no" | "unknown" | "na";
export const ANSWER_LABELS = {
  "": "Selecione",
  yes: "Sim",
  no: "Não",
  unknown: "Não verificado",
  na: "Não se aplica",
};
export interface DailyCheck {
  answer: CheckAnswer;
  note: string;
}
export interface MenuDaySnapshot {
  menuId: string;
  title: string;
  status: string;
  slots: {
    meal: string;
    preparation: string;
    portions: { name: string; amount: number; unit: string }[];
    mealCount: number | null;
  }[];
}
export interface DailyRecordInput {
  /** Historical school-based records retain these fields for traceability. */
  schoolId?: string;
  schoolName?: string;
  date: string;
  scope?: string;
  menuSnapshot: MenuDaySnapshot | null;
  plannedMenu: string;
  servedMenu: string;
  compliance: "" | "yes" | "partial" | "no";
  changeReason: string;
  changeDetails: string;
  authorizedBy: string;
  servedMeals: number;
  checks: Record<CheckId, DailyCheck>;
  action: string;
  informedPerson: string;
  followUp: "closed" | "pending";
  evidence: string;
  observations: string;
  supersedesId: string | null;
  correctionReason: string;
}
export interface DailyRecord extends DailyRecordInput {
  id: string;
  createdAt: string;
  actorUid: string;
  actorName: string;
  actorRole: string;
}
export function emptyChecks(): Record<CheckId, DailyCheck> {
  return Object.fromEntries(
    DAILY_CHECKS.map(q => [q.id, { answer: "", note: "" }])
  ) as Record<CheckId, DailyCheck>;
}
export function localDate(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
export function parseDay(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [y, m, d] = value.split("-").map(Number);
  const date = new Date(y, m - 1, d, 12);
  return localDate(date) === value ? date : null;
}
export function menuApplies(menu: Menu, date: string): boolean {
  const day = parseDay(date);
  if (!day) return false;
  if (menu.weekStartDate) {
    const start = parseDay(menu.weekStartDate);
    if (!start) return false;
    const end = new Date(start);
    end.setDate(start.getDate() + 7);
    if (day < start || day >= end) return false;
  } else if (menu.referenceMonth && menu.referenceMonth !== date.slice(0, 7))
    return false;
  return true;
}
export function snapshotMenuDay(menu: Menu, date: string): MenuDaySnapshot {
  const day = parseDay(date);
  const label = day
    ? ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"][
        day.getDay()
      ]
    : "";
  return {
    menuId: menu.id,
    title: menu.title,
    status: menu.status,
    slots: menu.slots
      .filter(s => s.dayLabel === label && s.composicao.length > 0)
      .map(s => ({
        meal: s.mealLabel,
        preparation: s.nomeFantasia || s.composicao.map(i => i.nome).join(", "),
        mealCount: slotMealCount(menu, s) ?? null,
        portions: s.composicao.map(i => ({
          name: i.nome,
          amount: i.pesoAtual,
          unit: i.sourceUnit || "g",
        })),
      })),
  };
}
export function snapshotDescription(s: MenuDaySnapshot): string {
  return s.slots
    .map(
      slot =>
        `${slot.meal}: ${slot.preparation}${slot.mealCount === 0 ? " (cancelada no planejamento)" : ""}`
    )
    .join("\n");
}
export function dailyIssues(
  input: DailyRecordInput,
  today = localDate()
): string[] {
  const issues: string[] = [];
  if (!input.menuSnapshot?.menuId && !(input.supersedesId && input.schoolId))
    issues.push("Selecione o cardápio.");
  if (!parseDay(input.date) || input.date > today)
    issues.push("Informe uma data válida, até hoje.");
  if (!input.plannedMenu.trim())
    issues.push("Informe o cardápio previsto para este dia.");
  if (!input.servedMenu.trim())
    issues.push(
      "Informe o que foi efetivamente servido (ou que não houve oferta)."
    );
  if (!["yes", "partial", "no"].includes(input.compliance))
    issues.push("Responda se o cardápio foi cumprido.");
  if (
    input.compliance !== "yes" &&
    (!input.changeReason.trim() || !input.changeDetails.trim())
  )
    issues.push("Informe o motivo e descreva a alteração do cardápio.");
  if (!Number.isSafeInteger(input.servedMeals) || input.servedMeals < 0)
    issues.push(
      "Informe o total de refeições servidas, inteiro e não negativo."
    );
  if (input.compliance === "yes" && input.servedMeals === 0)
    issues.push(
      "Confira o cumprimento do cardápio: foram declaradas zero refeições servidas."
    );
  for (const q of DAILY_CHECKS) {
    const c = input.checks[q.id];
    if (!c || !["yes", "no", "unknown", "na"].includes(c.answer))
      issues.push(`Responda: ${q.label}`);
    else if (c.answer !== "yes" && !c.note.trim())
      issues.push(`Explique a resposta: ${q.label}`);
  }
  const needsAction =
    input.compliance !== "yes" ||
    DAILY_CHECKS.some(q =>
      ["no", "unknown"].includes(input.checks[q.id]?.answer)
    );
  if (needsAction && (!input.action.trim() || !input.informedPerson.trim()))
    issues.push(
      "Registre a providência e quem foi informado sobre a ocorrência ou pendência."
    );
  if (!["closed", "pending"].includes(input.followUp))
    issues.push("Informe a situação do acompanhamento.");
  if (input.supersedesId && !input.correctionReason.trim())
    issues.push("Informe o motivo da correção.");
  return issues;
}
export function currentDailyRecords(records: DailyRecord[]): DailyRecord[] {
  const replaced = new Set(records.map(r => r.supersedesId).filter(Boolean));
  return records
    .filter(r => !replaced.has(r.id))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/** Preserve school-based history as distinct records; new records use menu and day. */
export function dailyContextKey(input: DailyRecordInput): string {
  return JSON.stringify(
    input.schoolId
      ? [
          "legacy-school",
          input.schoolId,
          input.date,
          (input.scope || "").trim().toLocaleLowerCase(),
        ]
      : ["menu", input.menuSnapshot?.menuId || "", input.date]
  );
}
