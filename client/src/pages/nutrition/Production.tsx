import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useProductionLogs } from '@/hooks/useProductionLogs';
import { useOrgSettings } from '@/hooks/useOrgSettings';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ClipboardList, Pencil, Plus, Printer, Trash2, Thermometer, CheckCircle2, XCircle, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { jsPDF } from 'jspdf';
import { storage } from '@/lib/firebase';
import { ref as storageRef, getBytes } from 'firebase/storage';
import type { ProductionLog } from '@/types/nutrition';

// ── helpers ───────────────────────────────────────────────────────────────────

function safeDate(v: unknown): Date {
  if (!v) return new Date();
  if (typeof (v as any).toDate === 'function') return (v as any).toDate();
  if (v instanceof Date) return v;
  const d = new Date(v as string | number);
  return isNaN(d.getTime()) ? new Date() : d;
}

const destinationLabel: Record<ProductionLog['destination'], string> = {
  reuse:    'Reaproveitado',
  discard:  'Descartado',
  donation: 'Doado',
};

const destinationColor: Record<ProductionLog['destination'], string> = {
  reuse:    'bg-blue-100 text-blue-800',
  discard:  'bg-red-100 text-red-700',
  donation: 'bg-green-100 text-green-800',
};

/** RDC 216/2004 — conformidade de temperatura */
function rdc216Status(log: ProductionLog): 'conforme' | 'nao_conforme' | 'sem_dado' {
  if (log.temperature == null || !log.foodType) return 'sem_dado';
  if (log.foodType === 'quente') return log.temperature >= 60 ? 'conforme' : 'nao_conforme';
  // frio: ≤ 10 °C conforme
  return log.temperature <= 10 ? 'conforme' : 'nao_conforme';
}

const rdc216Label = {
  conforme:     { label: 'Conforme RDC 216', color: 'bg-green-100 text-green-800', Icon: CheckCircle2 },
  nao_conforme: { label: 'Não conforme',     color: 'bg-red-100 text-red-700',     Icon: XCircle     },
  sem_dado:     { label: 'Temp. não aferida', color: 'bg-gray-100 text-gray-500',  Icon: AlertCircle },
};

// ── PDF ───────────────────────────────────────────────────────────────────────

async function generateReport(
  logs: ProductionLog[],
  orgSettings: { logoUrl?: string; logoDataUrl?: string; nutritionistName?: string; nutritionistCrn?: string; municipio?: string; uf?: string },
) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pw = doc.internal.pageSize.getWidth();   // 297
  const ph = doc.internal.pageSize.getHeight();  // 210

  // image loader (Firebase-safe, sem CORS)
  const toDataUrl = async (url?: string | null): Promise<string | null> => {
    if (!url) return null;
    if (url.startsWith('data:')) return url;
    const extractStoragePath = (u: string): string | null => {
      try { const m = u.match(/\/o\/([^?]+)/); return m ? decodeURIComponent(m[1]) : null; } catch { return null; }
    };
    const blobToDataUrl = (blob: Blob): Promise<string> =>
      new Promise((res, rej) => { const fr = new FileReader(); fr.onloadend = () => res(fr.result as string); fr.onerror = rej; fr.readAsDataURL(blob); });
    if (url.includes('firebasestorage.googleapis.com')) {
      const path = extractStoragePath(url);
      if (path) { try { const b = await getBytes(storageRef(storage, path)); return await blobToDataUrl(new Blob([b])); } catch { } }
    }
    try { const r = await fetch(url, { mode: 'cors' }); if (!r.ok) return null; return await blobToDataUrl(await r.blob()); } catch { return null; }
  };
  const imgFmt = (d: string) => d.startsWith('data:image/jpeg') || d.startsWith('data:image/jpg') ? 'JPEG' : d.startsWith('data:image/webp') ? 'WEBP' : 'PNG';
  const addImg = (d: string | null, x: number, y: number, w: number, h: number) => { if (!d) return; try { doc.addImage(d, imgFmt(d), x, y, w, h); } catch (_) {} };

  const orgLogo = await toDataUrl(orgSettings.logoDataUrl || orgSettings.logoUrl);

  // ── cabeçalho ──────────────────────────────────────────────────────────────
  const barH = 34;
  doc.setFillColor(27, 42, 74); // #1B2A4A
  doc.rect(0, 0, pw, barH, 'F');

  // Logo — posicionado na faixa azul, sem sobrepor texto
  if (orgLogo) addImg(orgLogo, 8, 7, 20, 20);

  // Título centralizado
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(255, 255, 255);
  doc.text('RELATORIO DE MANEJO DE SOBRAS', pw / 2, 14, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(180, 210, 255);
  doc.text('Conforme RDC ANVISA n. 216/2004 - Boas Praticas para Servicos de Alimentacao', pw / 2, 21, { align: 'center' });

  // Org info — direita
  const infoLines: string[] = [];
  if (orgSettings.nutritionistName) infoLines.push(`Nutr. RT: ${orgSettings.nutritionistName}`);
  if (orgSettings.nutritionistCrn)  infoLines.push(`CRN: ${orgSettings.nutritionistCrn}`);
  if (orgSettings.municipio)        infoLines.push(`${orgSettings.municipio}${orgSettings.uf ? '/' + orgSettings.uf : ''}`);
  doc.setFontSize(7.5); doc.setTextColor(200, 220, 255);
  infoLines.forEach((line, i) => doc.text(line, pw - 8, 11 + i * 5.5, { align: 'right' }));

  // Data de geração — dentro da faixa, canto inferior esquerdo
  doc.setFontSize(7); doc.setTextColor(150, 190, 240);
  doc.text(`Gerado em: ${format(new Date(), "dd/MM/yyyy 'as' HH:mm", { locale: ptBR })}`, 32, 30);

  // ── totais resumo ─────────────────────────────────────────────────────────
  const totalProd  = logs.reduce((s, l) => s + l.producedQuantity, 0);
  const totalSobra = logs.reduce((s, l) => s + l.cleanLeftover, 0);
  const totalServ  = totalProd - totalSobra;
  const pctAprov   = totalProd > 0 ? ((totalServ / totalProd) * 100).toFixed(1) : '0.0';
  const conformes  = logs.filter(l => rdc216Status(l) === 'conforme').length;
  const naoConf    = logs.filter(l => rdc216Status(l) === 'nao_conforme').length;

  const boxY = 37; const boxH = 14;
  const boxes = [
    { label: 'Registros', value: String(logs.length) },
    { label: 'Total produzido', value: `${totalProd.toFixed(3)} kg` },
    { label: 'Total de sobras', value: `${totalSobra.toFixed(3)} kg` },
    { label: 'Total servido', value: `${totalServ.toFixed(3)} kg` },
    { label: '% Aproveitamento', value: `${pctAprov}%` },
    { label: 'Conformes RDC 216', value: conformes > 0 ? `${conformes} OK` : '0' },
    { label: 'Nao conformes',    value: naoConf > 0 ? `${naoConf} (!)`  : '0' },
  ];
  const bw = (pw - 16) / boxes.length;
  boxes.forEach((b, i) => {
    const bx = 8 + i * bw;
    doc.setFillColor(245, 247, 250);
    doc.rect(bx, boxY, bw - 2, boxH, 'F');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(27, 42, 74);
    doc.text(b.value, bx + (bw - 2) / 2, boxY + 6, { align: 'center' });
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(100, 100, 120);
    doc.text(b.label, bx + (bw - 2) / 2, boxY + 11, { align: 'center' });
  });

  // ── tabela ─────────────────────────────────────────────────────────────────
  const headers = ['Data', 'Preparacao', 'Produzido\n(kg)', 'Sobra\n(kg)', 'Servido\n(kg)', '%', 'Tipo', 'Temp\n(C)', 'Conformidade', 'Destino / Local'];
  const colW    = [18, 52, 20, 18, 20, 10, 16, 15, 34, 36];
  let ty = 55;
  const rowH = 7; const hdrH = 9;

  // header da tabela
  doc.setFillColor(27, 42, 74);
  doc.rect(8, ty, pw - 16, hdrH, 'F');
  doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5); doc.setTextColor(255, 255, 255);
  let cx = 8;
  headers.forEach((h, i) => {
    doc.text(h, cx + colW[i] / 2, ty + 5.5, { align: 'center' });
    cx += colW[i];
  });
  ty += hdrH;

  // linhas
  logs.forEach((log, idx) => {
    if (ty + rowH > ph - 20) {
      doc.addPage();
      ty = 15;
    }
    const even = idx % 2 === 0;
    doc.setFillColor(even ? 255 : 249, even ? 255 : 250, even ? 255 : 252);
    doc.rect(8, ty, pw - 16, rowH, 'F');

    doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(30, 30, 30);
    const served = log.producedQuantity - log.cleanLeftover;
    const pct    = log.producedQuantity > 0 ? ((served / log.producedQuantity) * 100).toFixed(0) : '0';
    const status = rdc216Status(log);
    const statusTxt = status === 'conforme' ? 'Conforme' : status === 'nao_conforme' ? 'Nao conforme' : '-';
    const destTxt = log.destination === 'donation' && log.destinationEntity
      ? 'Doado > ' + log.destinationEntity.slice(0, 20)
      : destinationLabel[log.destination];
    const cells = [
      format(safeDate(log.date), 'dd/MM/yy', { locale: ptBR }),
      log.dishName.length > 28 ? log.dishName.slice(0, 28) + '...' : log.dishName,
      log.producedQuantity.toFixed(3),
      log.cleanLeftover.toFixed(3),
      served > 0 ? served.toFixed(3) : '0.000',
      `${pct}%`,
      log.foodType === 'quente' ? 'Quente' : log.foodType === 'frio' ? 'Frio' : '-',
      log.temperature != null ? `${log.temperature}C` : '-',
      statusTxt,
      destTxt,
    ];
    cx = 8;
    cells.forEach((cell, i) => {
      // cor da conformidade
      if (i === 8) {
        if (status === 'conforme')     doc.setTextColor(22, 101, 52);
        else if (status === 'nao_conforme') doc.setTextColor(185, 28, 28);
        else doc.setTextColor(100, 100, 100);
      } else {
        doc.setTextColor(30, 30, 30);
      }
      doc.text(cell, cx + colW[i] / 2, ty + rowH / 2 + 1.5, { align: 'center' });
      cx += colW[i];
    });

    // linha divisória
    doc.setDrawColor(220, 220, 230);
    doc.setLineWidth(0.2);
    doc.line(8, ty + rowH, pw - 8, ty + rowH);
    ty += rowH;
  });

  // ── nota RDC 216 ──────────────────────────────────────────────────────────
  const noteY = Math.min(ty + 6, ph - 22);
  doc.setFont('helvetica', 'italic'); doc.setFontSize(7); doc.setTextColor(100, 100, 120);
  doc.text(
    'RDC 216/2004: Alimentos quentes: manter >= 60 C (max. 6 h). Alimentos frios: manter <= 10 C. Fora da faixa: descartar.',
    pw / 2, noteY, { align: 'center' },
  );

  // ── rodapé ────────────────────────────────────────────────────────────────
  doc.setFillColor(27, 42, 74);
  doc.rect(0, ph - 10, pw, 10, 'F');
  doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(180, 210, 255);
  doc.text('EduPlate Menu — Gestão do PNAE', pw / 2, ph - 4, { align: 'center' });

  doc.save(`manejo-sobras-${format(new Date(), 'yyyy-MM-dd')}.pdf`);
}

// ── form ──────────────────────────────────────────────────────────────────────

interface LogForm {
  date: string;
  dishName: string;
  producedQuantity: string;
  cleanLeftover: string;
  destination: ProductionLog['destination'];
  destinationEntity: string;
  foodType: ProductionLog['foodType'] | '';
  temperature: string;
  temperatureTime: string;
  observations: string;
}

const emptyForm = (): LogForm => ({
  date: new Date().toISOString().slice(0, 10),
  dishName: '',
  producedQuantity: '',
  cleanLeftover: '',
  destination: 'discard',
  destinationEntity: '',
  foodType: '',
  temperature: '',
  temperatureTime: new Date().toTimeString().slice(0, 5),
  observations: '',
});

// ── component ─────────────────────────────────────────────────────────────────

export default function Production() {
  const { productionLogs, loading, addProductionLog, updateProductionLog, deleteProductionLog } = useProductionLogs();
  const { settings: orgSettings } = useOrgSettings();

  const [open, setOpen]           = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm]           = useState<LogForm>(emptyForm);
  const [generating, setGenerating] = useState(false);

  const openNew  = () => { setEditingId(null); setForm(emptyForm()); setOpen(true); };
  const openEdit = (log: ProductionLog) => {
    setEditingId(log.id);
    setForm({
      date:              format(safeDate(log.date), 'yyyy-MM-dd'),
      dishName:          log.dishName,
      producedQuantity:  String(log.producedQuantity || ''),
      cleanLeftover:     String(log.cleanLeftover || ''),
      destination:       log.destination,
      destinationEntity: log.destinationEntity || '',
      foodType:          log.foodType || '',
      temperature:       log.temperature != null ? String(log.temperature) : '',
      temperatureTime:   log.temperatureTime || new Date().toTimeString().slice(0, 5),
      observations:      log.observations || '',
    });
    setOpen(true);
  };
  const closeDialog = () => { setOpen(false); setEditingId(null); };

  const handleSave = () => {
    if (!form.dishName.trim()) { toast.error('Informe o nome da preparação.'); return; }
    if (!form.producedQuantity || Number(form.producedQuantity) <= 0) { toast.error('Informe a quantidade produzida em kg.'); return; }
    if (form.destination === 'donation' && !form.destinationEntity.trim()) { toast.error('Informe para onde foi a doação.'); return; }

    const payload: Omit<ProductionLog, 'id' | 'createdAt' | 'updatedAt'> = {
      date:              new Date(form.date + 'T12:00:00'),
      shift:             'morning' as const,
      dishName:          form.dishName.trim(),
      producedQuantity:  Number(form.producedQuantity) || 0,
      cleanLeftover:     Number(form.cleanLeftover) || 0,
      destination:       form.destination,
      destinationEntity: form.destination === 'donation' ? form.destinationEntity.trim() : '',
      foodType:          form.foodType as ProductionLog['foodType'] || undefined,
      temperature:       form.temperature !== '' ? Number(form.temperature) : undefined,
      temperatureTime:   form.temperatureTime || undefined,
      observations:      form.observations.trim() || undefined,
    };

    if (editingId) { updateProductionLog(editingId, payload); toast.success('Registro atualizado.'); }
    else           { addProductionLog(payload);               toast.success('Sobra registrada.');    }
    closeDialog();
  };

  const handleReport = async () => {
    if (productionLogs.length === 0) { toast.error('Nenhum registro para gerar relatório.'); return; }
    setGenerating(true);
    try {
      await generateReport(productionLogs, orgSettings);
      toast.success('Relatório gerado com sucesso.');
    } catch (e) {
      console.error(e);
      toast.error('Erro ao gerar relatório.');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="flex-1 p-4 md:p-8 bg-gray-50 min-h-screen">
      <div className="max-w-4xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Manejo de Sobras</h1>
            <p className="text-gray-600 mt-1">
              Controle de sobras, temperatura e destinação — conforme RDC ANVISA 216/2004.
            </p>
          </div>
          <div className="flex gap-2 shrink-0 flex-wrap">
            <Button
              variant="outline"
              onClick={handleReport}
              disabled={generating || productionLogs.length === 0}
            >
              <Printer className="w-4 h-4 mr-2" />
              {generating ? 'Gerando…' : 'Relatório PDF'}
            </Button>
            <Button onClick={openNew} className="bg-blue-600 hover:bg-blue-700">
              <Plus className="w-4 h-4 mr-2" />
              Novo Registro
            </Button>
          </div>
        </div>

        {/* Aviso RDC 216 */}
        <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800 flex gap-2 items-start">
          <Thermometer className="w-4 h-4 shrink-0 mt-0.5 text-blue-600" />
          <span>
            <strong>RDC 216/2004:</strong> Alimentos quentes >= 60 °C (max. 6 h) · Alimentos frios <= 10 °C.
            Registre a temperatura no momento da aferição para rastrear conformidade.
          </span>
        </div>

        {/* List */}
        {loading || productionLogs.length === 0 ? (
          <Card>
            <CardContent className="py-16 text-center">
              <ClipboardList className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-600 font-medium">Nenhuma sobra registrada.</p>
              <p className="text-sm text-gray-400 mt-1">
                Registre o que foi produzido, quanto sobrou e para onde foi.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {productionLogs.map((log) => {
              const served   = log.producedQuantity - log.cleanLeftover;
              const pctUsed  = log.producedQuantity > 0 ? ((served / log.producedQuantity) * 100).toFixed(0) : '0';
              const status   = rdc216Status(log);
              const rdc      = rdc216Label[status];

              return (
                <Card key={log.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">

                        {/* Title row */}
                        <div className="flex items-center gap-3 flex-wrap">
                          <span className="font-bold text-gray-900 text-lg leading-tight">{log.dishName}</span>
                          <span className="text-sm text-gray-500">
                            {format(safeDate(log.date), "dd/MM/yyyy", { locale: ptBR })}
                          </span>
                          {log.temperatureTime && (
                            <span className="text-xs text-gray-400">{log.temperatureTime}</span>
                          )}
                        </div>

                        {/* Metrics */}
                        <div className="flex flex-wrap gap-3 mt-2 text-sm">
                          <span className="flex items-center gap-1">
                            <span className="text-gray-500">Produzido:</span>
                            <span className="font-semibold text-gray-900">{log.producedQuantity.toFixed(3)} kg</span>
                          </span>
                          <span className="text-gray-300">·</span>
                          <span className="flex items-center gap-1">
                            <span className="text-gray-500">Sobra:</span>
                            <span className="font-semibold text-gray-900">{log.cleanLeftover.toFixed(3)} kg</span>
                          </span>
                          <span className="text-gray-300">·</span>
                          <span className="flex items-center gap-1">
                            <span className="text-gray-500">Servido:</span>
                            <span className="font-semibold text-green-700">
                              {served > 0 ? served.toFixed(3) : '0.000'} kg ({pctUsed}%)
                            </span>
                          </span>
                          {log.temperature != null && (
                            <>
                              <span className="text-gray-300">·</span>
                              <span className="flex items-center gap-1">
                                <Thermometer className="w-3.5 h-3.5 text-gray-400" />
                                <span className="font-semibold text-gray-900">{log.temperature} °C</span>
                                {log.foodType && (
                                  <span className="text-xs text-gray-400">({log.foodType})</span>
                                )}
                              </span>
                            </>
                          )}
                        </div>

                        {/* Badges */}
                        <div className="mt-2 flex items-center gap-2 flex-wrap">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${rdc.color}`}>
                            <rdc.Icon className="w-3 h-3" />
                            {rdc.label}
                          </span>
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${destinationColor[log.destination]}`}>
                            {destinationLabel[log.destination]}
                          </span>
                          {log.destination === 'donation' && log.destinationEntity && (
                            <span className="text-xs text-gray-500">→ {log.destinationEntity}</span>
                          )}
                        </div>

                        {log.observations && (
                          <p className="mt-1.5 text-xs text-gray-500 italic">{log.observations}</p>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="flex gap-2 shrink-0">
                        <Button variant="outline" size="sm" onClick={() => openEdit(log)} title="Editar">
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button variant="destructive" size="sm" onClick={() => { deleteProductionLog(log.id); toast.success('Registro removido.'); }} title="Excluir">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* ── Dialog ── */}
        <Dialog open={open} onOpenChange={(v) => { if (!v) closeDialog(); }}>
          <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingId ? 'Editar Registro' : 'Novo Registro de Sobra'}</DialogTitle>
              <DialogDescription>
                Registre a preparação, quantidade, temperatura e destinação da sobra.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">

              {/* Date + Dish */}
              <div className="grid gap-4 grid-cols-1 sm:grid-cols-2">
                <div>
                  <Label>Data</Label>
                  <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className="mt-1.5" />
                </div>
                <div>
                  <Label>Preparação / Prato</Label>
                  <Input value={form.dishName} onChange={(e) => setForm({ ...form, dishName: e.target.value })} placeholder="Ex.: Frango ao molho" className="mt-1.5" />
                </div>
              </div>

              {/* Quantities */}
              <div className="grid gap-4 grid-cols-1 sm:grid-cols-2">
                <div>
                  <Label>Total produzido (kg)</Label>
                  <Input type="number" value={form.producedQuantity} onChange={(e) => setForm({ ...form, producedQuantity: e.target.value })} placeholder="Ex.: 12.500" step="0.001" min="0" className="mt-1.5" />
                </div>
                <div>
                  <Label>Sobra nas cubas (kg)</Label>
                  <Input type="number" value={form.cleanLeftover} onChange={(e) => setForm({ ...form, cleanLeftover: e.target.value })} placeholder="Ex.: 1.200" step="0.001" min="0" className="mt-1.5" />
                </div>
              </div>

              {/* RDC 216 — Temperatura */}
              <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 space-y-3">
                <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide flex items-center gap-1">
                  <Thermometer className="w-3.5 h-3.5" /> Controle de Temperatura — RDC 216/2004
                </p>
                <div className="grid gap-3 grid-cols-1 sm:grid-cols-3">
                  <div>
                    <Label>Tipo</Label>
                    <Select value={form.foodType} onValueChange={(v) => setForm({ ...form, foodType: v as any })}>
                      <SelectTrigger className="mt-1.5 bg-white">
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="quente">Quente (≥ 60 °C)</SelectItem>
                        <SelectItem value="frio">Frio (≤ 10 °C)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Temperatura (°C)</Label>
                    <Input type="number" value={form.temperature} onChange={(e) => setForm({ ...form, temperature: e.target.value })} placeholder="Ex.: 65" step="0.1" className="mt-1.5 bg-white" />
                  </div>
                  <div>
                    <Label>Hora da aferição</Label>
                    <Input type="time" value={form.temperatureTime} onChange={(e) => setForm({ ...form, temperatureTime: e.target.value })} className="mt-1.5 bg-white" />
                  </div>
                </div>
                {/* live conformidade */}
                {form.foodType && form.temperature !== '' && (
                  <div className={`rounded px-3 py-1.5 text-xs font-semibold flex items-center gap-1.5 ${
                    (form.foodType === 'quente' ? Number(form.temperature) >= 60 : Number(form.temperature) <= 10)
                      ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-700'
                  }`}>
                    {(form.foodType === 'quente' ? Number(form.temperature) >= 60 : Number(form.temperature) <= 10)
                      ? <><CheckCircle2 className="w-3.5 h-3.5" /> Conforme RDC 216/2004</>
                      : <><XCircle className="w-3.5 h-3.5" /> Não conforme — considere o descarte</>
                    }
                  </div>
                )}
              </div>

              {/* Destination */}
              <div>
                <Label>Destino da sobra</Label>
                <Select value={form.destination} onValueChange={(v) => setForm({ ...form, destination: v as ProductionLog['destination'], destinationEntity: '' })}>
                  <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="reuse">Reaproveitado</SelectItem>
                    <SelectItem value="discard">Descartado</SelectItem>
                    <SelectItem value="donation">Doado</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {form.destination === 'donation' && (
                <div>
                  <Label>Doado para</Label>
                  <Input value={form.destinationEntity} onChange={(e) => setForm({ ...form, destinationEntity: e.target.value })} placeholder="Ex.: CRAS Vila Nova, Abrigo São José…" className="mt-1.5" />
                </div>
              )}

              {/* Observations */}
              <div>
                <Label>Observações <span className="text-gray-400 font-normal">(opcional)</span></Label>
                <Input value={form.observations} onChange={(e) => setForm({ ...form, observations: e.target.value })} placeholder="Ex.: Sobra descartada por queda de temperatura" className="mt-1.5" />
              </div>

              {/* Live summary */}
              {form.producedQuantity && Number(form.producedQuantity) > 0 && (
                <div className="rounded-lg bg-gray-50 border px-4 py-3 text-sm space-y-1">
                  <p className="text-gray-500 font-medium">Resumo</p>
                  <p>Produzido: <span className="font-semibold">{Number(form.producedQuantity).toFixed(3)} kg</span></p>
                  <p>Sobrou: <span className="font-semibold">{Number(form.cleanLeftover || 0).toFixed(3)} kg</span></p>
                  <p>Servido: <span className="font-semibold text-green-700">
                    {(Number(form.producedQuantity) - Number(form.cleanLeftover || 0)).toFixed(3)} kg
                    {' '}({(((Number(form.producedQuantity) - Number(form.cleanLeftover || 0)) / Number(form.producedQuantity)) * 100).toFixed(0)}%)
                  </span></p>
                </div>
              )}

              <div className="flex justify-end gap-3 pt-2">
                <Button variant="outline" onClick={closeDialog}>Cancelar</Button>
                <Button onClick={handleSave} className="bg-blue-600 hover:bg-blue-700">
                  {editingId ? 'Salvar Alterações' : 'Registrar Sobra'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

      </div>
    </div>
  );
}
