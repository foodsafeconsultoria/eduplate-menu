import { describe, expect, it } from "vitest";
import { buildDailyRecordPdf, dailyReportRows } from "./dailyRecordPdf";
import { DAILY_CHECKS, type DailyRecord } from "./dailyRecord";
const record = {
  schoolId: "s",
  schoolName: "Escola",
  date: "2026-10-06",
  scope: "Integral",
  menuSnapshot: null,
  plannedMenu: "Arroz",
  servedMenu: "Arroz",
  compliance: "partial",
  changeReason: "Falta de ingrediente",
  changeDetails: "Feijão substituído por lentilha",
  authorizedBy: "RT Ana",
  servedMeals: 100,
  checks: Object.fromEntries(
    DAILY_CHECKS.map(q => [
      q.id,
      { answer: "yes", note: "Registro de controle disponível" },
    ])
  ),
  action: "Reposição solicitada",
  informedPerson: "Diretora",
  followUp: "pending",
  evidence: "Documento nº 123",
  observations: "",
  supersedesId: "original",
  correctionReason: "Quantidade corrigida",
  id: "corrigido",
  createdAt: "2026-10-06T20:00:00Z",
  actorUid: "u",
  actorName: "Ana",
  actorRole: "nutricionista",
} as DailyRecord;
describe("Relatório diário", () => {
  it("identifica o cardápio sem exigir escola e conserva referências históricas", () => {
    const rows = dailyReportRows({
      ...record,
      schoolId: undefined,
      schoolName: undefined,
      scope: undefined,
      menuSnapshot: {
        menuId: "m",
        title: "Cardápio integral",
        status: "published",
        slots: [],
      },
    });
    expect(rows).toContainEqual(["Cardápio", "Cardápio integral"]);
    expect(rows.some(r => r[0] === "Referência do registro anterior")).toBe(
      false
    );
    expect(dailyReportRows(record)).toContainEqual([
      "Referência do registro anterior",
      "Escola / Integral",
    ]);
  });
  it("inclui perguntas, justificativa, providências, autor e rastreabilidade da correção", () => {
    const rows = dailyReportRows(record);
    expect(
      rows.some(row => row[1].includes("original\nQuantidade corrigida"))
    ).toBe(true);
    expect(rows.some(row => row[1] === "Documento nº 123")).toBe(true);
    expect(
      rows.filter(row => DAILY_CHECKS.some(q => q.label === row[0]))
    ).toHaveLength(6);
    const pdf = buildDailyRecordPdf(record).output();
    expect(pdf).toContain("Reposi");
    expect(pdf).toContain("corrigido");
    expect(pdf).toContain("RT Ana");
  });
  it("pagina relatos extensos sem perder o final da evidência", () => {
    const doc = buildDailyRecordPdf({
      ...record,
      observations:
        "Observação longa para documentar a execução diária. ".repeat(250) +
        "FIM DO RELATO",
    });
    expect(doc.getNumberOfPages()).toBeGreaterThan(2);
    expect(doc.output()).toContain("FIM DO RELATO");
  });
});
