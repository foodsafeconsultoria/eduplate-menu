import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { ANSWER_LABELS, DAILY_CHECKS, type DailyRecord } from "./dailyRecord";
export const COMPLIANCE_LABELS = {
  "": "Sem resposta",
  yes: "Sim",
  partial: "Parcialmente",
  no: "Não",
};
export function dailyReportRows(record: DailyRecord): string[][] {
  return [
    [
      "Cardápio",
      record.menuSnapshot?.title ||
        "Cardápio informado manualmente (registro anterior)",
    ],
    ...(record.schoolId
      ? [
          [
            "Referência do registro anterior",
            [record.schoolName, record.scope].filter(Boolean).join(" / "),
          ],
        ]
      : []),
    ["Data do atendimento", record.date.split("-").reverse().join("/")],
    ["Registrado por", `${record.actorName} (${record.actorRole})`],
    [
      "Data e hora do registro",
      new Date(record.createdAt).toLocaleString("pt-BR"),
    ],
    ["Identificador", record.id],
    [
      "Versão anterior / motivo da correção",
      record.supersedesId
        ? `${record.supersedesId}\n${record.correctionReason}`
        : "Registro inicial",
    ],
    [
      "Cardápio vinculado",
      record.menuSnapshot
        ? `${record.menuSnapshot.title} / situação no momento: ${record.menuSnapshot.status}`
        : "Informado manualmente",
    ],
    ["Cardápio previsto", record.plannedMenu],
    ...(record.menuSnapshot?.slots || []).map(s => [
      "Planejamento / " + s.meal,
      `${s.preparation}\nRefeições previstas: ${s.mealCount ?? "não informado"}\n${s.portions.map(p => `${p.name}: ${p.amount} ${p.unit} por porção`).join("; ")}`,
    ]),
    ["Cardápio cumprido?", COMPLIANCE_LABELS[record.compliance]],
    ["Efetivamente servido", record.servedMenu],
    ["Total de refeições servidas", String(record.servedMeals)],
    [
      "Motivo / descrição das alterações",
      `${record.changeReason}\n${record.changeDetails}`.trim() ||
        "Nenhuma alteração declarada",
    ],
    [
      "Substituição orientada ou autorizada por",
      record.authorizedBy || "Não informado",
    ],
    ...DAILY_CHECKS.map(q => [
      q.label,
      `${ANSWER_LABELS[record.checks[q.id].answer]}\n${record.checks[q.id].note}`.trim(),
    ]),
    [
      "Providência tomada / encaminhamento",
      record.action || "Nenhuma informada",
    ],
    ["Quem foi informado", record.informedPerson || "Não informado"],
    [
      "Acompanhamento",
      record.followUp === "pending"
        ? "Pendente"
        : "Concluído conforme declaração",
    ],
    ["Referências de evidências", record.evidence || "Nenhuma informada"],
    ["Observações", record.observations || "Nenhuma"],
  ];
}
export function buildDailyRecordPdf(record: DailyRecord) {
  const doc = new jsPDF();
  doc.setFontSize(16);
  doc.text("Registro diário da alimentação escolar", 14, 18);
  doc.setFontSize(9);
  doc.text(
    "Relato da execução e das verificações do dia, informado pelo responsável.",
    14,
    25
  );
  autoTable(doc, {
    startY: 31,
    head: [["Item", "Registro"]],
    body: dailyReportRows(record),
    styles: { fontSize: 9, cellPadding: 3, overflow: "linebreak" },
    columnStyles: { 0: { cellWidth: 65 } },
    margin: { bottom: 20 },
    didDrawPage: () => {
      doc.setFontSize(8);
      doc.text(
        "Registro declaratório. Referências de evidências devem ser preservadas pela unidade.",
        14,
        285
      );
      doc.text(`Página ${doc.getNumberOfPages()}`, 180, 291);
    },
  });
  return doc;
}
export function exportDailyRecord(record: DailyRecord) {
  buildDailyRecordPdf(record).save(
    `registro-diario-${record.date}-${record.id.slice(0, 8)}.pdf`
  );
}
