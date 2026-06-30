import { useMemo, useState } from 'react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Thermometer, Plus, Download, Trash2, Pencil, Check, AlertTriangle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { useTemperatureLogs, isTemperatureConforme, COCCAO_MIN_TEMP, type TemperatureLog } from '@/hooks/useTemperatureLogs';
import { useOrgSettings } from '@/hooks/useOrgSettings';
import { addPdfHeader, addPdfFooter } from '@/lib/pdfBranding';

const todayISO = () => new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD local
const nowHM = () => new Date().toTimeString().slice(0, 5);

export default function TemperatureControl() {
  const { logs, loading, addTemperatureLog, updateTemperatureLog, deleteTemperatureLog } = useTemperatureLogs();
  const { settings: orgSettings, saveSettings } = useOrgSettings();
  const minTemp = orgSettings?.coccaoMinTemp ?? COCCAO_MIN_TEMP;

  // ── Form (medir e adicionar rápido) ─────────────────────────────────────────
  const [date, setDate] = useState(todayISO());
  const [time, setTime] = useState(nowHM());
  const [preparation, setPreparation] = useState('');
  const [temperature, setTemperature] = useState('');
  const [corrective, setCorrective] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);

  const tempNum = temperature === '' ? null : Number(temperature);
  const conforme = tempNum != null && isTemperatureConforme(tempNum, minTemp);
  const showCorrective = tempNum != null && !conforme;

  const resetForm = () => {
    setDate(todayISO()); setTime(nowHM()); setPreparation(''); setTemperature(''); setCorrective(''); setEditingId(null);
  };

  const handleSave = () => {
    if (!preparation.trim()) { toast.error('Informe a preparação/alimento aferido.'); return; }
    if (temperature === '' || isNaN(Number(temperature))) { toast.error('Informe a temperatura aferida (°C).'); return; }
    const t = Number(temperature);
    if (!isTemperatureConforme(t, minTemp) && !corrective.trim()) {
      toast.error('Temperatura abaixo do limite — registre a ação corretiva tomada.');
      return;
    }
    const payload = {
      date: new Date(`${date}T12:00:00`),
      time,
      preparation: preparation.trim(),
      temperature: t,
      correctiveAction: corrective.trim() || undefined,
    };
    if (editingId) { updateTemperatureLog(editingId, payload); toast.success('Aferição atualizada.'); }
    else { addTemperatureLog(payload); toast.success('Aferição registrada.'); }
    // Mantém data; limpa o resto para a próxima amostra rápida
    setTime(nowHM()); setPreparation(''); setTemperature(''); setCorrective(''); setEditingId(null);
  };

  const startEdit = (log: TemperatureLog) => {
    setEditingId(log.id);
    setDate(log.date.toLocaleDateString('en-CA'));
    setTime(log.time);
    setPreparation(log.preparation);
    setTemperature(String(log.temperature));
    setCorrective(log.correctiveAction || '');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // ── Agrupa por data (mais recente primeiro) ─────────────────────────────────
  const grouped = useMemo(() => {
    const sorted = [...logs].sort((a, b) => {
      const d = b.date.getTime() - a.date.getTime();
      return d !== 0 ? d : b.time.localeCompare(a.time);
    });
    const map = new Map<string, TemperatureLog[]>();
    for (const l of sorted) {
      const key = format(l.date, 'yyyy-MM-dd');
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(l);
    }
    return Array.from(map.entries());
  }, [logs]);

  const naoConformes = logs.filter((l) => !isTemperatureConforme(l.temperature, minTemp)).length;

  // ── Exportar planilha PDF ───────────────────────────────────────────────────
  const exportPDF = async () => {
    if (logs.length === 0) { toast.error('Nenhuma aferição para exportar.'); return; }
    try {
      const doc = new jsPDF();
      let y = await addPdfHeader(doc, {
        title: 'CONTROLE DE TEMPERATURA DE COCÇÃO',
        subtitle: 'PNAE — Boas Práticas (RDC ANVISA 216/2004)',
        municipality: orgSettings?.municipio ? `${orgSettings.municipio}/${orgSettings.uf || ''}` : '',
        orgLogoUrl: orgSettings?.logoUrl,
      });

      doc.setFontSize(8);
      doc.setTextColor(90, 90, 90);
      doc.text(`Limite de conformidade: temperatura no centro do alimento >= ${minTemp} °C`, 15, y);
      y += 5;

      const rows = [...logs]
        .sort((a, b) => (b.date.getTime() - a.date.getTime()) || b.time.localeCompare(a.time))
        .map((l) => [
          format(l.date, 'dd/MM/yyyy'),
          l.time || '—',
          l.preparation,
          `${l.temperature.toFixed(1)} °C`,
          isTemperatureConforme(l.temperature, minTemp) ? 'Conforme' : 'NÃO conforme',
          l.correctiveAction || '—',
        ]);

      autoTable(doc, {
        startY: y,
        head: [['Data', 'Hora', 'Preparação', 'Temp.', 'Situação', 'Ação corretiva']],
        body: rows,
        theme: 'striped',
        margin: { left: 15, right: 15 },
        styles: { fontSize: 8, cellPadding: 2, lineColor: [220, 220, 220], lineWidth: 0.2 },
        headStyles: { fillColor: [22, 101, 52], textColor: 255, fontSize: 8, fontStyle: 'bold', halign: 'center' },
        columnStyles: {
          0: { cellWidth: 24, halign: 'center' },
          1: { cellWidth: 16, halign: 'center' },
          2: { cellWidth: 48 },
          3: { cellWidth: 20, halign: 'center' },
          4: { cellWidth: 26, halign: 'center' },
          5: { cellWidth: 46 },
        },
        didParseCell: (data) => {
          if (data.section === 'body' && data.column.index === 4) {
            data.cell.styles.textColor = data.cell.raw === 'Conforme' ? [22, 101, 52] : [200, 30, 30];
            data.cell.styles.fontStyle = 'bold';
          }
        },
      });

      addPdfFooter(doc, `Controle de temperatura de cocção · ${orgSettings?.nutritionistName || 'Nutricionista RT — PNAE'}`);
      doc.save(`Controle_Temperatura_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
      toast.success('Planilha exportada em PDF.');
    } catch (e) {
      console.error(e);
      toast.error('Erro ao gerar o PDF.');
    }
  };

  return (
    <div className="min-h-screen flex-1 p-4 md:p-8">
      <div className="w-full max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="flex items-center gap-2 text-3xl font-bold text-gray-900">
              <Thermometer className="h-7 w-7 text-red-500" /> Controle de Temperatura
            </h1>
            <p className="mt-2 text-gray-600">
              Registre a temperatura de cocção no centro do alimento ao tirar cada amostra.
              Limite de conformidade: <strong>≥ {minTemp} °C</strong> (RDC ANVISA 216/2004).
            </p>
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className="mb-1 block text-xs font-semibold text-gray-600">Limite de cocção (°C) — seu POP</label>
              <div className="flex items-center gap-2">
                <Input
                  type="number" step="0.5" min="0"
                  value={String(minTemp)}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    if (!isNaN(v) && v > 0) saveSettings({ coccaoMinTemp: v });
                  }}
                  className="w-24"
                  title="Temperatura mínima de cocção exigida pelo seu POP. Padrão 70 °C (RDC 216)."
                />
                <span className="text-xs text-gray-400 whitespace-nowrap">padrão 70 °C</span>
              </div>
            </div>
            <Button variant="secondary" onClick={exportPDF} disabled={loading || logs.length === 0}>
              <Download className="mr-2 h-4 w-4" /> Exportar planilha (PDF)
            </Button>
          </div>
        </div>

        {/* Form rápido */}
        <Card>
          <CardContent className="pt-6">
            <div className="grid gap-3 md:grid-cols-12">
              <div className="md:col-span-2">
                <label className="mb-1 block text-xs font-semibold text-gray-600">Data</label>
                <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              </div>
              <div className="md:col-span-2">
                <label className="mb-1 block text-xs font-semibold text-gray-600">Hora</label>
                <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
              </div>
              <div className="md:col-span-5">
                <label className="mb-1 block text-xs font-semibold text-gray-600">Preparação / alimento</label>
                <Input value={preparation} onChange={(e) => setPreparation(e.target.value)} placeholder="Ex.: Arroz, Carne moída, Feijão" />
              </div>
              <div className="md:col-span-3">
                <label className="mb-1 block text-xs font-semibold text-gray-600">Temperatura (°C)</label>
                <Input type="number" step="0.1" value={temperature} onChange={(e) => setTemperature(e.target.value)} placeholder="Ex.: 78" />
              </div>
            </div>

            {/* Feedback de conformidade ao vivo */}
            {tempNum != null && (
              <div className={`mt-3 flex items-center gap-2 rounded-lg px-3 py-2 text-sm ${conforme ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                {conforme
                  ? <><Check className="h-4 w-4" /> Conforme — {tempNum.toFixed(1)} °C (≥ {minTemp} °C).</>
                  : <><AlertTriangle className="h-4 w-4" /> Abaixo do limite — {tempNum.toFixed(1)} °C. Registre a ação corretiva.</>}
              </div>
            )}

            {showCorrective && (
              <div className="mt-3">
                <label className="mb-1 block text-xs font-semibold text-gray-600">Ação corretiva *</label>
                <Input value={corrective} onChange={(e) => setCorrective(e.target.value)} placeholder="Ex.: Retornou ao fogo até atingir 80 °C antes de servir." />
              </div>
            )}

            <div className="mt-4 flex gap-2">
              <Button onClick={handleSave} className="bg-green-600 hover:bg-green-700">
                <Plus className="mr-2 h-4 w-4" /> {editingId ? 'Salvar alteração' : 'Registrar aferição'}
              </Button>
              {editingId && <Button variant="outline" onClick={resetForm}>Cancelar edição</Button>}
            </div>
          </CardContent>
        </Card>

        {/* Resumo */}
        {logs.length > 0 && (
          <div className="flex flex-wrap gap-3">
            <div className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm">
              <span className="text-gray-500">Aferições registradas:</span> <strong className="text-gray-900">{logs.length}</strong>
            </div>
            <div className={`rounded-xl border px-4 py-3 text-sm ${naoConformes > 0 ? 'border-red-200 bg-red-50' : 'border-green-200 bg-green-50'}`}>
              <span className={naoConformes > 0 ? 'text-red-600' : 'text-green-700'}>Não conformes:</span>{' '}
              <strong className={naoConformes > 0 ? 'text-red-700' : 'text-green-800'}>{naoConformes}</strong>
            </div>
          </div>
        )}

        {/* Lista por dia */}
        {loading ? (
          <Card><CardContent className="py-10 text-center text-gray-500">Carregando…</CardContent></Card>
        ) : logs.length === 0 ? (
          <Card><CardContent className="py-12 text-center text-gray-500">
            <Thermometer className="mx-auto mb-3 h-10 w-10 text-gray-300" />
            Nenhuma aferição registrada ainda. Use o formulário acima ao tirar a amostra.
          </CardContent></Card>
        ) : (
          <div className="space-y-5">
            {grouped.map(([dayKey, dayLogs]) => (
              <div key={dayKey}>
                <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-gray-500">
                  {format(new Date(dayKey + 'T12:00:00'), "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                </h3>
                <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-gray-50 text-left text-gray-600">
                        <th className="px-3 py-2 font-semibold">Hora</th>
                        <th className="px-3 py-2 font-semibold">Preparação</th>
                        <th className="px-3 py-2 font-semibold text-center">Temp.</th>
                        <th className="px-3 py-2 font-semibold text-center">Situação</th>
                        <th className="px-3 py-2 font-semibold">Ação corretiva</th>
                        <th className="px-3 py-2 font-semibold text-right">Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dayLogs.map((l) => {
                        const ok = isTemperatureConforme(l.temperature, minTemp);
                        return (
                          <tr key={l.id} className="border-b last:border-0 hover:bg-gray-50/60">
                            <td className="px-3 py-2 text-gray-700">{l.time || '—'}</td>
                            <td className="px-3 py-2 font-medium text-gray-900">{l.preparation}</td>
                            <td className="px-3 py-2 text-center font-semibold text-gray-900">{l.temperature.toFixed(1)} °C</td>
                            <td className="px-3 py-2 text-center">
                              <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${ok ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                {ok ? 'Conforme' : 'Não conforme'}
                              </span>
                            </td>
                            <td className="px-3 py-2 text-gray-600">{l.correctiveAction || '—'}</td>
                            <td className="px-3 py-2">
                              <div className="flex justify-end gap-1">
                                <button onClick={() => startEdit(l)} title="Editar" className="rounded p-1.5 text-blue-600 hover:bg-blue-50"><Pencil className="h-4 w-4" /></button>
                                <button onClick={() => { deleteTemperatureLog(l.id); toast.success('Aferição removida.'); }} title="Excluir" className="rounded p-1.5 text-red-500 hover:bg-red-50"><Trash2 className="h-4 w-4" /></button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
