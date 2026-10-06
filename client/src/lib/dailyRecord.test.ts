import { describe, expect, it } from "vitest";
import {
  DAILY_CHECKS,
  currentDailyRecords,
  dailyIssues,
  dailyContextKey,
  emptyChecks,
  menuApplies,
  parseDay,
  snapshotDescription,
  snapshotMenuDay,
  type DailyRecord,
  type DailyRecordInput,
} from "./dailyRecord";
import type { Menu } from "../types/nutrition";
export function completeDailyInput(): DailyRecordInput {
  return {
    date: "2026-10-06",
    menuSnapshot: {
      menuId: "m",
      title: "Cardápio integral",
      status: "published",
      slots: [],
    },
    plannedMenu: "Almoço: arroz e feijão",
    servedMenu: "Almoço: arroz e feijão",
    compliance: "yes",
    changeReason: "",
    changeDetails: "",
    authorizedBy: "",
    servedMeals: 100,
    checks: Object.fromEntries(
      DAILY_CHECKS.map(q => [q.id, { answer: "yes", note: "" }])
    ) as DailyRecordInput["checks"],
    action: "",
    informedPerson: "",
    followUp: "closed",
    evidence: "",
    observations: "",
    supersedesId: null,
    correctionReason: "",
  };
}
const menu = {
  id: "menu",
  title: "Semana",
  status: "published",
  schoolIds: ["s"],
  weekStartDate: "2026-10-05",
  mealCount: 100,
  slots: [
    {
      dayLabel: "Terça",
      mealLabel: "Almoço",
      nomeFantasia: "Arroz",
      composicao: [{ nome: "Arroz", pesoAtual: 150, sourceUnit: "g" }],
    },
    {
      dayLabel: "Quarta",
      mealLabel: "Almoço",
      composicao: [{ nome: "Feijão", pesoAtual: 80, sourceUnit: "g" }],
    },
  ],
} as Menu;
describe("Registro diário da execução", () => {
  it("registra por cardápio e data sem escola ou grupo obrigatório", () => {
    const input = completeDailyInput();
    expect(dailyIssues(input, "2026-10-06")).toEqual([]);
    expect(
      dailyIssues({ ...input, menuSnapshot: null }, "2026-10-06")
    ).toContain("Selecione o cardápio.");
    expect(dailyContextKey(input)).not.toBe(
      dailyContextKey({ ...input, date: "2026-10-05" })
    );
    expect(dailyContextKey(input)).not.toBe(
      dailyContextKey({
        ...input,
        menuSnapshot: { ...input.menuSnapshot!, menuId: "outro" },
      })
    );
    expect(dailyContextKey(input)).toBe(
      dailyContextKey({ ...input, scope: "Opcional legado" })
    );
  });
  it("preserva o contexto e a correção de registros anteriores por escola", () => {
    const legacy = {
      ...completeDailyInput(),
      schoolId: "s",
      schoolName: "Escola",
      scope: "Integral",
      menuSnapshot: null,
      supersedesId: "anterior",
      correctionReason: "Contagem corrigida",
    };
    expect(dailyIssues(legacy, "2026-10-06")).toEqual([]);
    expect(dailyContextKey(legacy)).not.toBe(
      dailyContextKey({ ...legacy, schoolId: "outra" })
    );
    expect(dailyContextKey(legacy)).not.toBe(
      dailyContextKey(completeDailyInput())
    );
  });
  it("não assume respostas e exige conferência de todas as perguntas", () => {
    expect(Object.values(emptyChecks()).every(c => c.answer === "")).toBe(true);
    expect(
      dailyIssues(
        { ...completeDailyInput(), checks: emptyChecks() },
        "2026-10-06"
      )
    ).toHaveLength(6);
    expect(dailyIssues(completeDailyInput(), "2026-10-06")).toEqual([]);
  });
  it("exige motivo, alteração, providência e comunicação quando o cardápio não foi cumprido", () => {
    expect(
      dailyIssues({ ...completeDailyInput(), compliance: "no" }, "2026-10-06")
    ).toHaveLength(2);
    expect(
      dailyIssues(
        {
          ...completeDailyInput(),
          compliance: "no",
          servedMeals: 0,
          servedMenu: "Nenhuma refeição ofertada",
          changeReason: "Falta de água",
          changeDetails: "Cozinha interrompida",
          action: "Acionada gestão para atendimento alternativo",
          informedPerson: "Diretora",
          followUp: "pending",
        },
        "2026-10-06"
      )
    ).toEqual([]);
  });
  it("diferencia não verificado de sim e exige explicação e encaminhamento", () => {
    const input = completeDailyInput();
    input.checks.temperature = { answer: "unknown", note: "" };
    expect(dailyIssues(input, "2026-10-06")).toHaveLength(2);
    input.checks.temperature.note = "Termômetro danificado";
    input.action = "Solicitada substituição";
    input.informedPerson = "Direção";
    expect(dailyIssues(input, "2026-10-06")).toEqual([]);
  });
  it("exige justificativa para não se aplica sem gerar uma ocorrência por isso", () => {
    const input = completeDailyInput();
    input.checks.diets = { answer: "na", note: "" };
    expect(dailyIssues(input, "2026-10-06")).toHaveLength(1);
    input.checks.diets.note = "Não havia dieta especial prevista neste grupo";
    expect(dailyIssues(input, "2026-10-06")).toEqual([]);
  });
  it.each([-1, 1.5, NaN, Infinity])("recusa refeições inválidas %s", value =>
    expect(
      dailyIssues({ ...completeDailyInput(), servedMeals: value }, "2026-10-06")
        .length
    ).toBeGreaterThan(0)
  );
  it("recusa datas inexistentes, futuras e confirmação com zero refeições", () => {
    expect(parseDay("2026-02-30")).toBeNull();
    expect(
      dailyIssues({ ...completeDailyInput(), date: "2026-10-07" }, "2026-10-06")
        .length
    ).toBeGreaterThan(0);
    expect(
      dailyIssues({ ...completeDailyInput(), servedMeals: 0 }, "2026-10-06")
        .length
    ).toBeGreaterThan(0);
  });
  it("restringe o vínculo de cardápio à semana correta, independentemente das escolas vinculadas, inclusive no limite", () => {
    expect(menuApplies(menu, "2026-10-06")).toBe(true);

    expect(menuApplies(menu, "2026-10-04")).toBe(false);
    expect(menuApplies(menu, "2026-10-12")).toBe(false);
    expect(
      menuApplies(
        { ...menu, weekStartDate: undefined, referenceMonth: "2026-09" },
        "2026-10-06"
      )
    ).toBe(false);
  });
  it("preserva o planejamento, per capita e quantidade mesmo se o cardápio mudar depois", () => {
    const changed = structuredClone(menu);
    const snapshot = snapshotMenuDay(changed, "2026-10-06");
    changed.slots[0].composicao[0].pesoAtual = 200;
    changed.slots[0].nomeFantasia = "Novo prato";
    expect(snapshot.slots[0].portions[0].amount).toBe(150);
    expect(snapshot.slots[0].mealCount).toBe(100);
    expect(snapshotDescription(snapshot)).toBe("Almoço: Arroz");
    expect(snapshot.slots).toHaveLength(1);
    expect(snapshotMenuDay(menu, "2026-10-10").slots).toEqual([]);
  });
  it("mantém versões anteriores e exige motivo para correção", () => {
    const old = {
      ...completeDailyInput(),
      id: "old",
      createdAt: "2026-10-06T20:00:00Z",
    } as DailyRecord;
    const next = {
      ...old,
      id: "new",
      supersedesId: "old",
      correctionReason: "Contagem corrigida",
      createdAt: "2026-10-06T21:00:00Z",
    };
    const records = [old, next];
    expect(currentDailyRecords(records).map(r => r.id)).toEqual(["new"]);
    expect(records).toHaveLength(2);
    expect(
      dailyIssues(
        { ...completeDailyInput(), supersedesId: "old" },
        "2026-10-06"
      ).length
    ).toBeGreaterThan(0);
  });
});
