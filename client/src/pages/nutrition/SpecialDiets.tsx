import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { useSchools } from '@/hooks/useFirestore';
import { useSpecialDiets } from '@/hooks/useSpecialDiets';
import type { SpecialDiet } from '@/types/nutrition';
import { Pencil, Plus, Printer, Search, ShieldAlert, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { DIET_LABELS, DIET_LABEL_MAP } from '@/data/dietLabels';

const labelMap = DIET_LABEL_MAP;

const SCHOOL_STAGES = ['Creche', 'Ensino Infantil', 'Fundamental 1', 'Fundamental 2', 'Médio'] as const;

// ── Printable sticker label (single student) ──────────────────────────────────

function printLabel(diet: SpecialDiet) {
  const labelBadges = (diet.labels ?? [])
    .map((key) => {
      const info = DIET_LABELS.find((l) => l.key === key);
      return info ? `<span class="badge">${info.text}</span>` : '';
    })
    .join('');

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<title>Etiqueta — ${diet.studentName}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: Arial, sans-serif;
    background: #fff;
    display: flex; justify-content: center; align-items: center;
    min-height: 100vh;
    padding: 20px;
  }
  .label {
    width: 10cm; min-height: 7cm;
    border: 3px solid #1a5c30;
    border-radius: 10px;
    padding: 16px 18px;
    display: flex; flex-direction: column;
    align-items: center;
    gap: 8px;
    text-align: center;
    page-break-inside: avoid;
  }
  .label-header {
    font-size: 13px; font-weight: bold;
    color: #fff; background: #1a5c30;
    border-radius: 6px; padding: 4px 16px;
    letter-spacing: 1px; text-transform: uppercase;
    width: 100%;
  }
  .student-name {
    font-size: 22px; font-weight: bold;
    color: #111; margin-top: 4px;
    line-height: 1.2;
  }
  .school-name  { font-size: 14px; color: #444; font-weight: 600; }
  .code         { font-size: 12px; color: #777; }
  .badges {
    display: flex; flex-wrap: wrap;
    justify-content: center;
    gap: 5px; margin-top: 4px;
  }
  .badge {
    font-size: 12px; font-weight: 700;
    padding: 3px 10px;
    border-radius: 99px;
    border: 1.5px solid #888;
    background: #f0f0f0; color: #222;
  }
  .prescription {
    font-size: 11px; color: #555;
    margin-top: 6px; line-height: 1.4;
    max-width: 90%;
  }
  @page { margin: 1.5cm; size: A4; }
  @media print {
    body { min-height: unset; }
  }
</style>
</head>
<body>
  <div class="label">
    <div class="label-header">🍱 Marmita Especial</div>
    <div class="student-name">${diet.studentName}</div>
    <div class="school-name">${diet.schoolName}</div>
    ${diet.restrictionCode ? `<div class="code">CID: ${diet.restrictionCode}</div>` : ''}
    <div class="badges">${labelBadges || '<span class="badge">Restrição Especial</span>'}</div>
    <div class="prescription">${diet.prescription.slice(0, 160)}${diet.prescription.length > 160 ? '…' : ''}</div>
  </div>
<script>window.onload = () => { window.print(); }<\/script>
</body>
</html>`;

  const w = window.open('', '_blank', 'width=600,height=550');
  if (!w) { toast.error('Permita pop-ups para imprimir.'); return; }
  w.document.write(html);
  w.document.close();
}

// ── Impressão de TODAS as etiquetas (6 por página, preenchendo A4 inteiro) ────

function printAllLabels(diets: SpecialDiet[]) {
  if (!diets.length) { return; }

  // 2 colunas × 5 linhas = 10 etiquetas por página A4
  // Cada etiqueta ≈ 90mm × 51mm — tamanho ideal para colar em marmita
  const COLS = 2;
  const ROWS = 5;
  const PER_PAGE = COLS * ROWS;
  const pages: SpecialDiet[][] = [];
  for (let i = 0; i < diets.length; i += PER_PAGE) {
    pages.push(diets.slice(i, i + PER_PAGE));
  }

  function makeLabel(diet: SpecialDiet): string {
    const badges = (diet.labels ?? [])
      .map((key) => {
        const info = DIET_LABELS.find((l) => l.key === key);
        return info ? `<span class="badge">${info.text}</span>` : '';
      })
      .join('');
    const prescriptionText = diet.prescription
      ? `${diet.prescription.slice(0, 100)}${diet.prescription.length > 100 ? '…' : ''}`
      : '';
    return `<div class="label">
      <div class="label-header">🍱 MARMITA ESPECIAL</div>
      <div class="student-name">${diet.studentName}</div>
      <div class="school-name">${diet.schoolName}</div>
      ${diet.restrictionCode ? `<div class="code">CID: ${diet.restrictionCode}</div>` : ''}
      <div class="badges">${badges || '<span class="badge">Restrição Especial</span>'}</div>
      ${prescriptionText ? `<div class="prescription">${prescriptionText}</div>` : ''}
    </div>`;
  }

  const pageBlocks = pages.map((group, idx) => {
    const slots = [...group];
    while (slots.length < PER_PAGE) {
      slots.push({ ...group[0], studentName: '', schoolName: '', restrictionCode: '', prescription: '', labels: [], _empty: true } as SpecialDiet & { _empty?: boolean });
    }
    const isLast = idx === pages.length - 1;
    return `<div class="page${isLast ? '' : ' break'}">
      ${slots.map((d) => (d as SpecialDiet & { _empty?: boolean })._empty
        ? `<div class="label label-empty"></div>`
        : makeLabel(d)
      ).join('')}
    </div>`;
  }).join('');

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<title>Etiquetas — Dietas Especiais</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: Arial, sans-serif; background: #fff; }

  .page {
    width: 190mm;
    height: 277mm;
    margin: 0 auto;
    display: grid;
    grid-template-columns: repeat(${COLS}, 1fr);
    grid-template-rows: repeat(${ROWS}, 1fr);
    gap: 6mm;
    padding: 3mm;
  }
  .page.break { page-break-after: always; break-after: page; }

  .label {
    border: 2px solid #1a5c30;
    border-radius: 8px;
    padding: 8px 12px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 5px;
    text-align: center;
    overflow: hidden;
    background: #fff;
  }
  .label-empty { border: 1.5px dashed #ddd; border-radius: 8px; }

  .label-header {
    font-size: 9px;
    font-weight: bold;
    color: #fff;
    background: #1a5c30;
    border-radius: 4px;
    padding: 3px 10px;
    letter-spacing: 1px;
    width: 100%;
  }
  .student-name {
    font-size: 15px;
    font-weight: bold;
    color: #111;
    line-height: 1.2;
  }
  .school-name { font-size: 9.5px; color: #444; font-weight: 600; }
  .code        { font-size: 8.5px; color: #777; }
  .badges {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 3px;
  }
  .badge {
    font-size: 9px;
    font-weight: 700;
    padding: 2px 7px;
    border-radius: 99px;
    border: 1.5px solid #888;
    background: #f0f0f0;
    color: #222;
  }
  .prescription {
    font-size: 8.5px;
    color: #555;
    line-height: 1.3;
    margin-top: 2px;
    font-style: italic;
  }

  @page { size: A4 portrait; margin: 1cm; }
  @media print {
    body { margin: 0; padding: 0; }
    .page { margin: 0; padding: 3mm; }
  }
</style>
</head>
<body>
  ${pageBlocks}
<script>window.onload = () => { window.print(); }<\/script>
</body>
</html>`;

  const w = window.open('', '_blank', 'width=900,height=700');
  if (!w) { return; }
  w.document.write(html);
  w.document.close();
}

// DIET_LABELS and labelMap are imported from @/data/dietLabels

// ── Empty form ─────────────────────────────────────────────────────────────────

const emptyForm = {
  studentName: '',
  schoolId: '',
  category: '' as string,
  restrictionCode: '',
  diagnosis: '',
  prescription: '',
  labels: [] as string[],
  status: 'active' as SpecialDiet['status'],
};

// ── Component ──────────────────────────────────────────────────────────────────

export default function SpecialDiets() {
  const { schools } = useSchools();
  const { specialDiets, loading, addSpecialDiet, updateSpecialDiet, deleteSpecialDiet } = useSpecialDiets();
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [form, setForm] = useState(emptyForm);

  const filteredSpecialDiets = useMemo(() => {
    const term = search.toLowerCase().trim();
    if (!term) return specialDiets;
    return specialDiets.filter(
      (diet) =>
        diet.studentName.toLowerCase().includes(term) ||
        diet.schoolName.toLowerCase().includes(term) ||
        diet.restrictionCode?.toLowerCase().includes(term) ||
        (diet.labels ?? []).some((l) => labelMap.get(l)?.text.toLowerCase().includes(term)),
    );
  }, [search, specialDiets]);

  const resetForm = () => { setForm(emptyForm); setEditingId(null); };

  const openNew = () => { resetForm(); setOpen(true); };

  const openEdit = (diet: SpecialDiet) => {
    setEditingId(diet.id);
    setForm({
      studentName: diet.studentName,
      schoolId: diet.schoolId,
      category: diet.category || '',
      restrictionCode: diet.restrictionCode || '',
      diagnosis: diet.diagnosis || '',
      prescription: diet.prescription,
      labels: diet.labels ?? [],
      status: diet.status,
    });
    setOpen(true);
  };

  const toggleLabel = (key: string) => {
    setForm((prev) => ({
      ...prev,
      labels: prev.labels.includes(key)
        ? prev.labels.filter((l) => l !== key)
        : [...prev.labels, key],
    }));
  };

  const handleSave = () => {
    if (!form.studentName.trim()) { toast.error('Informe o nome do aluno.'); return; }
    if (!form.schoolId) { toast.error('Selecione a escola.'); return; }
    if (!form.prescription.trim()) { toast.error('Informe a prescrição alimentar.'); return; }

    // When editing, the schoolId might already be stored; resolve name from the list if possible.
    const school = schools.find((item) => item.id === form.schoolId);
    const existingDiet = editingId ? specialDiets.find((d) => d.id === editingId) : null;
    const schoolName = school?.name ?? existingDiet?.schoolName ?? form.schoolId;

    const payload = {
      studentName: form.studentName.trim(),
      schoolId: form.schoolId,
      schoolName,
      category: form.category,
      restrictionCode: form.restrictionCode,
      diagnosis: form.diagnosis,
      prescription: form.prescription,
      labels: form.labels,
      status: form.status,
    };

    if (editingId) {
      updateSpecialDiet(editingId, payload);
      toast.success('Dieta especial atualizada.');
    } else {
      addSpecialDiet(payload);
      toast.success('Dieta especial cadastrada.');
    }

    setOpen(false);
    resetForm();
  };

  return (
    <div className="flex-1 p-4 md:p-8 bg-gray-50 min-h-screen">
      <div className="max-w-7xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Dietas Especiais</h1>
            <p className="text-gray-600 mt-2">
              Controle de restrições alimentares por aluno, escola e status de acompanhamento.
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            {specialDiets.length > 0 && (
              <Button
                variant="outline"
                onClick={() => printAllLabels(specialDiets)}
                className="border-green-300 text-green-700 hover:bg-green-50"
              >
                <Printer className="w-4 h-4 mr-2" />
                Imprimir Etiquetas ({specialDiets.length})
              </Button>
            )}
            <Button onClick={openNew} className="bg-blue-600 hover:bg-blue-700">
              <Plus className="w-4 h-4 mr-2" />
              Incluir Aluno
            </Button>
          </div>
        </div>

        {/* ── PNAE Guidance banner ─────────────────────────────────────────── */}
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
          <div className="flex items-start gap-3">
            <ShieldAlert className="h-5 w-5 shrink-0 text-blue-600 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-blue-900">Obrigações PNAE — Resolução CD/FNDE nº 06/2020 (Art. 20)</p>
              <p className="mt-1 text-xs text-blue-700 leading-relaxed">
                É obrigatório oferecer cardápio específico e seguro para alunos com necessidades alimentares especiais mediante <strong>laudo médico ou prescrição de nutricionista</strong>.
                As principais restrições exigidas são: alergia alimentar (leite, ovo, trigo, amendoim, soja, frutos do mar, gergelim), doença celíaca, diabetes, fenilcetonúria e intolerâncias.
                O cardápio substituto deve garantir os mesmos aportes nutricionais previstos no PNAE.
              </p>
            </div>
          </div>
        </div>

        {/* ── Restriction summary chips ─────────────────────────────────────── */}
        {specialDiets.filter(d => d.status === 'active').length > 0 && (() => {
          const countMap = new Map<string, number>();
          specialDiets.filter(d => d.status === 'active').forEach(d => {
            (d.labels ?? []).forEach(label => {
              countMap.set(label, (countMap.get(label) ?? 0) + 1);
            });
            if (!d.labels?.length) countMap.set('_sem-label', (countMap.get('_sem-label') ?? 0) + 1);
          });
          return (
            <div className="flex flex-wrap gap-2">
              {Array.from(countMap.entries())
                .filter(([k]) => k !== '_sem-label')
                .sort((a, b) => b[1] - a[1])
                .map(([key, count]) => {
                  const info = DIET_LABELS.find(l => l.key === key);
                  if (!info) return null;
                  return (
                    <span key={key} className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${info.color}`}>
                      {info.text} <span className="rounded-full bg-white/60 px-1.5 py-0.5 text-[10px] font-bold">{count}</span>
                    </span>
                  );
                })}
              {countMap.get('_sem-label') && (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-gray-300 bg-gray-50 px-2.5 py-1 text-xs font-semibold text-gray-600">
                  Sem classificação <span className="rounded-full bg-white/60 px-1.5 py-0.5 text-[10px] font-bold">{countMap.get('_sem-label')}</span>
                </span>
              )}
            </div>
          );
        })()}

        {/* Search */}
        <Card>
          <CardContent className="p-4">
            <div className="relative max-w-md">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por aluno, escola, código ou etiqueta..."
                className="pl-9"
              />
            </div>
          </CardContent>
        </Card>

        {/* Dialog */}
        <Dialog open={open} onOpenChange={(v) => { if (!v) resetForm(); setOpen(v); }}>
          <DialogContent className="w-full max-w-[95vw] sm:max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingId ? 'Editar' : 'Nova'} Dieta Especial</DialogTitle>
              <DialogDescription>
                Registre a necessidade alimentar individual para rastreio no planejamento e na produção.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <Label>Aluno</Label>
                  <Input value={form.studentName} onChange={(e) => setForm({ ...form, studentName: e.target.value })} className="mt-2" />
                </div>
                <div>
                  <Label>Escola</Label>
                  <Select value={form.schoolId} onValueChange={(value) => setForm({ ...form, schoolId: value })}>
                    <SelectTrigger className="mt-2 w-full">
                      <SelectValue placeholder="Selecione uma escola" />
                    </SelectTrigger>
                    <SelectContent>
                      {schools.map((school) => (
                        <SelectItem key={school.id} value={school.id}>{school.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <div>
                  <Label>Etapa de Ensino</Label>
                  <Select
                    value={form.category || '__none__'}
                    onValueChange={(value) => setForm({ ...form, category: value === '__none__' ? '' : value })}
                  >
                    <SelectTrigger className="mt-2 w-full"><SelectValue placeholder="Selecionar etapa" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Não informado</SelectItem>
                      {SCHOOL_STAGES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>CID ou Código</Label>
                  <Input value={form.restrictionCode} onChange={(e) => setForm({ ...form, restrictionCode: e.target.value })} className="mt-2" />
                </div>
                <div>
                  <Label>Status</Label>
                  <Select value={form.status} onValueChange={(value) => setForm({ ...form, status: value as SpecialDiet['status'] })}>
                    <SelectTrigger className="mt-2 w-full"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Ativa</SelectItem>
                      <SelectItem value="inactive">Inativa</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label>Diagnóstico</Label>
                <Input value={form.diagnosis} onChange={(e) => setForm({ ...form, diagnosis: e.target.value })} className="mt-2" />
              </div>

              {/* Labels / Etiquetas */}
              <div>
                <Label>Etiquetas de Restrição</Label>
                <p className="text-xs text-gray-500 mt-1 mb-2">Selecione todas que se aplicam ao aluno.</p>
                <div className="flex flex-wrap gap-2">
                  {DIET_LABELS.map((dl) => {
                    const active = form.labels.includes(dl.key);
                    return (
                      <button
                        key={dl.key}
                        type="button"
                        onClick={() => toggleLabel(dl.key)}
                        className={`rounded-full border px-2.5 py-1 text-xs font-medium transition-all ${
                          active
                            ? `${dl.color} ring-2 ring-offset-1 ring-current`
                            : 'bg-white border-gray-200 text-gray-500 hover:border-gray-400'
                        }`}
                      >
                        {active ? '✓ ' : ''}{dl.text}
                      </button>
                    );
                  })}
                </div>
              </div>

              <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                💡 <strong>PNAE exige laudo médico</strong> para cada restrição. Registre o CID-10 no campo diagnóstico e a prescrição abaixo. O cardápio substituto deve ter o mesmo valor nutricional.
              </p>

              <div>
                <Label>Prescrição Alimentar</Label>
                <Textarea value={form.prescription} onChange={(e) => setForm({ ...form, prescription: e.target.value })} className="mt-2 min-h-28" />
              </div>

              <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
                <Button onClick={handleSave} className="bg-blue-600 hover:bg-blue-700">Salvar</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Table */}
        {loading || filteredSpecialDiets.length === 0 ? (
          <Card>
            <CardContent className="py-16 text-center">
              <ShieldAlert className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-600 font-medium">Nenhuma dieta especial cadastrada.</p>
              <p className="text-sm text-gray-500 mt-2">
                Registre os alunos com restrição alimentar para apoiar cardápio e produção.
              </p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[180px]">Aluno</TableHead>
                    <TableHead className="min-w-[200px]">Escola</TableHead>
                    <TableHead className="min-w-[200px]">Restrições</TableHead>
                    <TableHead className="min-w-[200px]">Prescrição</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right w-[100px]">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredSpecialDiets.map((diet) => (
                    <TableRow key={diet.id}>
                      {/* Aluno + Etapa */}
                      <TableCell>
                        <div className="font-medium text-sm">{diet.studentName}</div>
                        {diet.category
                          ? <span className="mt-0.5 inline-block rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-semibold text-blue-800">{diet.category}</span>
                          : <span className="text-[10px] text-gray-400">Etapa não informada</span>
                        }
                      </TableCell>

                      {/* Escola */}
                      <TableCell className="text-sm text-gray-700 max-w-[200px]">
                        <span className="line-clamp-2">{diet.schoolName}</span>
                      </TableCell>

                      {/* Etiquetas de restrição */}
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {(diet.labels ?? []).length === 0 ? (
                            <span className="text-gray-400 text-xs">—</span>
                          ) : (
                            (diet.labels ?? []).map((key) => {
                              const info = labelMap.get(key);
                              if (!info) return null;
                              return (
                                <span
                                  key={key}
                                  className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap ${info.color}`}
                                >
                                  {info.text}
                                </span>
                              );
                            })
                          )}
                        </div>
                        {diet.restrictionCode && (
                          <div className="mt-1 text-[10px] text-gray-400">CID: {diet.restrictionCode}</div>
                        )}
                      </TableCell>

                      {/* Prescrição truncada */}
                      <TableCell className="text-xs text-gray-600 max-w-[200px]">
                        <span className="line-clamp-2">{diet.prescription || '—'}</span>
                      </TableCell>

                      {/* Status */}
                      <TableCell>
                        <span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${diet.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                          {diet.status === 'active' ? 'Ativa' : 'Inativa'}
                        </span>
                      </TableCell>

                      {/* Ações */}
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button onClick={() => printLabel(diet)} className="rounded p-1 text-green-700 hover:bg-green-50 hover:text-green-900" title="Imprimir etiqueta">
                            <Printer className="w-4 h-4" />
                          </button>
                          <button onClick={() => openEdit(diet)} className="rounded p-1 text-blue-600 hover:bg-blue-50 hover:text-blue-700" title="Editar">
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => { deleteSpecialDiet(diet.id); toast.success('Registro removido.'); }}
                            className="rounded p-1 text-red-500 hover:bg-red-50 hover:text-red-700"
                            title="Excluir"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
