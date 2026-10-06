import { useEffect, useState } from "react";
import { Link } from "wouter";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useMenus } from "@/hooks/useMenus";
import { useAuth } from "@/contexts/AuthContext";
import { useOrgId } from "@/hooks/useOrgId";
import { useDailyRecords } from "@/hooks/useDailyRecords";
import {
  DAILY_CHECKS,
  ANSWER_LABELS,
  currentDailyRecords,
  dailyIssues,
  emptyChecks,
  localDate,
  menuApplies,
  snapshotDescription,
  snapshotMenuDay,
  type CheckAnswer,
  type DailyRecord,
  type DailyRecordInput,
} from "@/lib/dailyRecord";
import {
  COMPLIANCE_LABELS,
  dailyReportRows,
  exportDailyRecord,
} from "@/lib/dailyRecordPdf";

const fieldClass =
  "w-full rounded-md border border-input bg-background px-3 py-2 text-sm";
function blank(): DailyRecordInput {
  return {
    date: localDate(),
    menuSnapshot: null,
    plannedMenu: "",
    servedMenu: "",
    compliance: "",
    changeReason: "",
    changeDetails: "",
    authorizedBy: "",
    servedMeals: NaN,
    checks: emptyChecks(),
    action: "",
    informedPerson: "",
    followUp: "pending",
    evidence: "",
    observations: "",
    supersedesId: null,
    correctionReason: "",
  };
}
function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="grid gap-2 text-sm font-medium">
      {label}
      {children}
    </label>
  );
}
export default function DailyRecords() {
  const { menus, loading: menusLoading } = useMenus();
  const { user } = useAuth();
  const store = useDailyRecords();
  const orgId = useOrgId();
  const [form, setForm] = useState<DailyRecordInput>(blank);
  const [issues, setIssues] = useState<string[]>([]);
  const [historyMenu, setHistoryMenu] = useState("");
  const [historyDate, setHistoryDate] = useState(localDate());
  const [showAllDates, setShowAllDates] = useState(false);
  const [detail, setDetail] = useState<DailyRecord | null>(null);
  useEffect(() => {
    setForm(blank());
    setDetail(null);
    setIssues([]);
    setHistoryMenu("");
    setHistoryDate(localDate());
  }, [orgId]);
  const change = <K extends keyof DailyRecordInput>(
    key: K,
    value: DailyRecordInput[K]
  ) => setForm(prev => ({ ...prev, [key]: value }));
  const availableMenus = menus.filter(m => menuApplies(m, form.date));
  const currentIds = new Set(currentDailyRecords(store.records).map(r => r.id));
  const history = store.records
    .filter(
      r =>
        (!historyMenu ||
          (historyMenu === "legacy-manual"
            ? !r.menuSnapshot
            : r.menuSnapshot?.menuId === historyMenu)) &&
        (showAllDates || r.date === historyDate)
    )
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const pendingCount = DAILY_CHECKS.filter(q =>
    ["no", "unknown"].includes(form.checks[q.id].answer)
  ).length;
  const resetContext = (date: string) => {
    const menu = menus.find(
      m => m.id === form.menuSnapshot?.menuId && menuApplies(m, date)
    );
    const snapshot = menu ? snapshotMenuDay(menu, date) : null;
    setForm({
      ...blank(),
      date,
      menuSnapshot: snapshot,
      plannedMenu: snapshot ? snapshotDescription(snapshot) : "",
    });
    setIssues([]);
  };
  const historyOptions = new Map(menus.map(m => [m.id, m.title]));
  for (const record of store.records)
    if (record.menuSnapshot)
      historyOptions.set(record.menuSnapshot.menuId, record.menuSnapshot.title);
  async function save() {
    const errors = dailyIssues(form);
    setIssues(errors);
    if (errors.length) return;
    try {
      const result = await store.save(form);
      toast.success(
        result.synced
          ? "Registro salvo e sincronizado."
          : "Registro salvo neste navegador. Sincronização pendente."
      );
      setHistoryMenu(form.menuSnapshot?.menuId || "legacy-manual");
      setHistoryDate(form.date);
      setDetail(result.record);
      setForm({
        ...blank(),
        date: form.date,
        menuSnapshot: form.menuSnapshot,
        plannedMenu: form.plannedMenu,
      });
      setIssues([]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível salvar.");
    }
  }
  function correct(record: DailyRecord) {
    setForm({ ...record, supersedesId: record.id, correctionReason: "" });
    setDetail(null);
    setIssues([]);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  return (
    <div className="p-4 md:p-8 space-y-6 max-w-6xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold">Registro diário</h1>
        <p className="text-muted-foreground mt-2">
          Ao final do dia, documente o cumprimento do cardápio, as verificações
          técnicas e as providências tomadas.
        </p>
      </div>
      {store.error && (
        <p role="status" className="p-3 rounded-md bg-amber-50 text-amber-900">
          {store.error}
        </p>
      )}
      {store.pending.length > 0 && (
        <div className="p-3 rounded-md bg-amber-50 flex flex-wrap gap-3 items-center">
          <span>
            {store.pending.length} registro(s) salvo(s) somente neste navegador.
            Sincronização pendente.
          </span>
          <Button
            variant="outline"
            disabled={store.saving || !store.canWrite}
            onClick={() => void store.retrySync()}
          >
            Tentar sincronizar
          </Button>
        </div>
      )}
      <Card>
        <CardHeader>
          <CardTitle>
            {form.supersedesId ? "Correção do registro" : "Fechamento do dia"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <p className="text-sm text-muted-foreground">
            Responsável pelo preenchimento:{" "}
            <strong>{user?.displayName || user?.email}</strong>. Data e hora de
            gravação serão registradas automaticamente.
          </p>
          {!store.canWrite && (
            <p className="text-amber-800">
              Seu perfil permite consultar os registros. A gravação está
              disponível para nutricionista e administrador.
            </p>
          )}
          <fieldset
            disabled={
              !store.canWrite || store.loading || store.saving || menusLoading
            }
            className="space-y-6 disabled:opacity-70"
          >
            <Field label="Data do atendimento">
              <input
                type="date"
                className={fieldClass}
                value={form.date}
                max={localDate()}
                disabled={!!form.supersedesId}
                onChange={e => resetContext(e.target.value)}
              />
            </Field>
            <p className="text-xs text-muted-foreground">
              Preencha um registro por cardápio e dia. Alterar a data ou o
              cardápio inicia um formulário vazio.
            </p>
            {form.supersedesId && (
              <Field label="Por que este registro está sendo corrigido?">
                <textarea
                  className={fieldClass}
                  value={form.correctionReason}
                  onChange={e => change("correctionReason", e.target.value)}
                />
              </Field>
            )}
            {
              <Field label="Cardápio planejado">
                <select
                  className={fieldClass}
                  value={form.menuSnapshot?.menuId || ""}
                  disabled={!!form.supersedesId && !!form.menuSnapshot}
                  onChange={e => {
                    const m = availableMenus.find(m => m.id === e.target.value);
                    const snapshot = m ? snapshotMenuDay(m, form.date) : null;
                    setForm(prev => ({
                      ...(prev.supersedesId ? prev : blank()),
                      date: prev.date,
                      menuSnapshot: snapshot,
                      plannedMenu: snapshot
                        ? snapshotDescription(snapshot)
                        : "",
                      servedMenu: "",
                      compliance: "",
                    }));
                  }}
                >
                  <option value="">Selecione o cardápio</option>
                  {form.menuSnapshot &&
                    !availableMenus.some(
                      m => m.id === form.menuSnapshot?.menuId
                    ) && (
                      <option value={form.menuSnapshot.menuId}>
                        {form.menuSnapshot.title} (versão preservada)
                      </option>
                    )}
                  {availableMenus.map(m => (
                    <option key={m.id} value={m.id}>
                      {m.title} ({m.status})
                    </option>
                  ))}
                </select>
              </Field>
            }
            {form.menuSnapshot && (
              <div className="bg-muted rounded-md p-3 space-y-2 text-sm">
                <strong>{form.menuSnapshot.title}</strong>
                <p>
                  Situação no momento do registro: {form.menuSnapshot.status}.
                  Confira se esta é a versão adotada pela unidade.
                </p>
                {form.menuSnapshot.slots.length === 0 && (
                  <p className="text-amber-800">
                    Não há refeições planejadas para este dia neste cardápio.
                  </p>
                )}
                {form.menuSnapshot.slots.map((s, i) => (
                  <p key={i}>
                    {s.meal}: {s.preparation} ·{" "}
                    {s.mealCount ?? "Quantidade não informada"} refeições
                    <br />
                    <span className="text-muted-foreground">
                      {s.portions
                        .map(p => `${p.name}: ${p.amount} ${p.unit}/porção`)
                        .join(" • ")}
                    </span>
                  </p>
                ))}
              </div>
            )}
            <Field label="O que estava previsto para este dia?">
              <textarea
                rows={3}
                className={fieldClass}
                readOnly={!!form.menuSnapshot}
                value={form.plannedMenu}
                onChange={e => change("plannedMenu", e.target.value)}
                placeholder="Refeições e preparações previstas"
              />
            </Field>
            <div className="grid md:grid-cols-2 gap-4">
              <Field label="Consegui cumprir o cardápio do dia?">
                <select
                  className={fieldClass}
                  value={form.compliance}
                  onChange={e =>
                    setForm(prev => ({
                      ...prev,
                      compliance: e.target
                        .value as DailyRecordInput["compliance"],
                      servedMenu:
                        e.target.value === "yes" && !prev.servedMenu
                          ? prev.plannedMenu
                          : prev.servedMenu,
                      changeReason:
                        e.target.value === "yes" ? "" : prev.changeReason,
                      changeDetails:
                        e.target.value === "yes" ? "" : prev.changeDetails,
                      authorizedBy:
                        e.target.value === "yes" ? "" : prev.authorizedBy,
                    }))
                  }
                >
                  <option value="">Selecione</option>
                  <option value="yes">Sim</option>
                  <option value="partial">Parcialmente</option>
                  <option value="no">Não</option>
                </select>
              </Field>
              <Field label="Total de refeições efetivamente servidas">
                <input
                  type="number"
                  min="0"
                  step="1"
                  className={fieldClass}
                  value={Number.isNaN(form.servedMeals) ? "" : form.servedMeals}
                  onChange={e =>
                    change(
                      "servedMeals",
                      e.target.value === "" ? NaN : Number(e.target.value)
                    )
                  }
                />
                <span className="text-xs text-muted-foreground">
                  Some as refeições deste cardápio; não é o número de alunos.
                  Informe zero se não houve oferta.
                </span>
              </Field>
            </div>
            <Field label="O que foi efetivamente servido?">
              <textarea
                rows={3}
                className={fieldClass}
                value={form.servedMenu}
                onChange={e => change("servedMenu", e.target.value)}
                placeholder="Informe preparações, substituições e refeições não ofertadas"
              />
            </Field>
            {["partial", "no"].includes(form.compliance) && (
              <div className="p-4 border border-amber-200 rounded-md space-y-4">
                <Field label="Por que o cardápio não foi cumprido integralmente?">
                  <select
                    className={fieldClass}
                    value={form.changeReason}
                    onChange={e => change("changeReason", e.target.value)}
                  >
                    <option value="">Selecione</option>
                    {[
                      "Falta de ingrediente",
                      "Problema na entrega",
                      "Equipamento ou estrutura",
                      "Falta de pessoal",
                      "Alteração no atendimento",
                      "Aceitação das preparações",
                      "Outro motivo",
                    ].map(r => (
                      <option key={r}>{r}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Descreva a alteração e sua causa">
                  <textarea
                    className={fieldClass}
                    value={form.changeDetails}
                    onChange={e => change("changeDetails", e.target.value)}
                  />
                </Field>
                <Field label="Quem orientou ou autorizou a substituição? (se houve)">
                  <input
                    className={fieldClass}
                    value={form.authorizedBy}
                    onChange={e => change("authorizedBy", e.target.value)}
                    placeholder="Nome, função e referência da orientação, ou não houve autorização"
                  />
                </Field>
              </div>
            )}
            <div className="space-y-4">
              <h2 className="text-lg font-semibold">Conferência técnica</h2>
              <p className="text-sm text-muted-foreground">
                Registre o que foi verificado. Para não, não verificado ou não
                se aplica, explique. Os procedimentos são os adotados pela
                unidade.
              </p>
              {DAILY_CHECKS.map(q => (
                <div key={q.id} className="border rounded-md p-4 space-y-3">
                  <Field label={q.label}>
                    <select
                      className={fieldClass}
                      value={form.checks[q.id].answer}
                      onChange={e =>
                        change("checks", {
                          ...form.checks,
                          [q.id]: {
                            ...form.checks[q.id],
                            answer: e.target.value as CheckAnswer,
                          },
                        })
                      }
                    >
                      {Object.entries(ANSWER_LABELS).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field
                    label={
                      form.checks[q.id].answer === "yes"
                        ? "Observação ou referência do controle (opcional)"
                        : "Explicação / ocorrência / referência do controle"
                    }
                  >
                    <textarea
                      rows={2}
                      className={fieldClass}
                      value={form.checks[q.id].note}
                      onChange={e =>
                        change("checks", {
                          ...form.checks,
                          [q.id]: {
                            ...form.checks[q.id],
                            note: e.target.value,
                          },
                        })
                      }
                    />
                  </Field>
                </div>
              ))}
              <div className="flex gap-4 flex-wrap text-sm text-primary">
                <Link href="/temperatura">Controle de temperatura</Link>
                <Link href="/nutrition/production">Manejo de sobras</Link>
                <Link href="/documents">Documentos e evidências</Link>
              </div>
            </div>
            {(pendingCount > 0 ||
              ["partial", "no"].includes(form.compliance)) && (
              <p className="text-amber-800 text-sm">
                Há alteração ou verificação pendente. Informe a providência e
                quem foi comunicado.
              </p>
            )}
            <Field label="Providência tomada / encaminhamento">
              <textarea
                className={fieldClass}
                value={form.action}
                onChange={e => change("action", e.target.value)}
                placeholder="O que foi feito, o que falta resolver e prazo/responsável, se necessário"
              />
            </Field>
            <div className="grid md:grid-cols-2 gap-4">
              <Field label="Quem foi informado?">
                <input
                  className={fieldClass}
                  value={form.informedPerson}
                  onChange={e => change("informedPerson", e.target.value)}
                  placeholder="Nome, função, horário e forma de contato"
                />
              </Field>
              <Field label="Situação do acompanhamento">
                <select
                  className={fieldClass}
                  value={form.followUp}
                  onChange={e =>
                    change(
                      "followUp",
                      e.target.value as DailyRecordInput["followUp"]
                    )
                  }
                >
                  <option value="pending">Pendente de acompanhamento</option>
                  <option value="closed">Providências concluídas</option>
                </select>
              </Field>
            </div>
            <Field label="Referências de evidências (opcional)">
              <textarea
                className={fieldClass}
                value={form.evidence}
                onChange={e => change("evidence", e.target.value)}
                placeholder="Nome ou identificador do documento, registro de temperatura, foto ou protocolo"
              />
              <span className="text-xs text-muted-foreground">
                Cadastre os arquivos em Documentos e informe suas referências
                aqui. Evite dados pessoais de alunos.
              </span>
            </Field>
            <Field label="Observações adicionais (opcional)">
              <textarea
                className={fieldClass}
                value={form.observations}
                onChange={e => change("observations", e.target.value)}
              />
            </Field>
            {issues.length > 0 && (
              <div
                role="alert"
                className="bg-red-50 text-red-800 p-3 rounded-md"
              >
                <ul className="list-disc pl-5">
                  {issues.map((i, n) => (
                    <li key={n}>{i}</li>
                  ))}
                </ul>
              </div>
            )}
            <div className="flex gap-3 flex-wrap">
              <Button onClick={() => void save()}>
                {store.saving
                  ? "Salvando…"
                  : form.supersedesId
                    ? "Salvar nova versão"
                    : "Salvar registro do dia"}
              </Button>
              {form.supersedesId && (
                <Button
                  variant="outline"
                  onClick={() => resetContext(form.date)}
                >
                  Cancelar correção
                </Button>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              O registro documenta suas declarações e providências. Preserve os
              controles e documentos citados. Corrigir cria uma nova versão e
              mantém o relato anterior.
            </p>
          </fieldset>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Histórico por cardápio e data</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-2 gap-3">
            <Field label="Filtrar cardápio">
              <select
                className={fieldClass}
                value={historyMenu}
                onChange={e => setHistoryMenu(e.target.value)}
              >
                <option value="">Todos</option>
                {Array.from(historyOptions).map(([id, title]) => (
                  <option key={id} value={id}>
                    {title}
                  </option>
                ))}
                {store.records.some(r => !r.menuSnapshot) && (
                  <option value="legacy-manual">
                    Sem vínculo (registros anteriores)
                  </option>
                )}
              </select>
            </Field>
            <Field label="Filtrar data">
              <input
                className={fieldClass}
                type="date"
                value={historyDate}
                onChange={e => setHistoryDate(e.target.value)}
              />
            </Field>
          </div>
          <label className="flex gap-2 items-center text-sm">
            <input
              type="checkbox"
              checked={showAllDates}
              onChange={e => setShowAllDates(e.target.checked)}
            />
            Mostrar todas as datas
          </label>
          {store.loading ? (
            <p>Carregando histórico…</p>
          ) : history.length === 0 ? (
            <p className="text-muted-foreground">
              Nenhum registro para este filtro.
            </p>
          ) : (
            history.map(r => (
              <div key={r.id} className="border rounded-md p-4 space-y-2">
                <strong>
                  {r.menuSnapshot?.title ||
                    "Cardápio informado manualmente (registro anterior)"}{" "}
                  · {r.date.split("-").reverse().join("/")}
                </strong>
                <p className="text-sm">
                  Cardápio cumprido: {COMPLIANCE_LABELS[r.compliance]} ·{" "}
                  {r.followUp === "pending"
                    ? "Acompanhamento pendente"
                    : "Providências concluídas"}
                  {!currentIds.has(r.id)
                    ? " · Versão substituída"
                    : r.supersedesId
                      ? " · Versão corrigida"
                      : ""}
                </p>
                <p className="text-xs text-muted-foreground">
                  {r.actorName} ·{" "}
                  {new Date(r.createdAt).toLocaleString("pt-BR")} ·{" "}
                  {store.pending.includes(r.id)
                    ? "Sincronização pendente"
                    : "Sincronizado"}
                </p>
                <div className="flex gap-2 flex-wrap">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setDetail(r)}
                  >
                    Ver registro
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => exportDailyRecord(r)}
                  >
                    Exportar PDF
                  </Button>
                  {store.canWrite && currentIds.has(r.id) && (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={store.saving}
                      onClick={() => correct(r)}
                    >
                      Corrigir / atualizar acompanhamento
                    </Button>
                  )}
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
      {detail && (
        <Card>
          <CardHeader>
            <CardTitle>Registro salvo</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => exportDailyRecord(detail)}
              >
                Exportar PDF
              </Button>
              <Button variant="ghost" onClick={() => setDetail(null)}>
                Fechar detalhes
              </Button>
            </div>
            {dailyReportRows(detail).map(([label, value], i) => (
              <div key={i} className="border-b pb-3">
                <strong className="text-sm">{label}</strong>
                <p className="text-sm whitespace-pre-wrap break-words">
                  {value}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
