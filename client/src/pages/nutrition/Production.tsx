import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useProductionLogs } from '@/hooks/useProductionLogs';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ClipboardList, Pencil, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
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
  reuse:    'Utilizado',
  discard:  'Descartado',
  donation: 'Doado',
};

const destinationColor: Record<ProductionLog['destination'], string> = {
  reuse:    'bg-blue-100 text-blue-800',
  discard:  'bg-red-100 text-red-700',
  donation: 'bg-green-100 text-green-800',
};

// ── form ──────────────────────────────────────────────────────────────────────

interface LogForm {
  date: string;
  dishName: string;
  producedQuantity: string;
  cleanLeftover: string;
  destination: ProductionLog['destination'];
  destinationEntity: string;
}

const emptyForm = (): LogForm => ({
  date: new Date().toISOString().slice(0, 10),
  dishName: '',
  producedQuantity: '',
  cleanLeftover: '',
  destination: 'discard',
  destinationEntity: '',
});

// ── component ─────────────────────────────────────────────────────────────────

export default function Production() {
  const { productionLogs, loading, addProductionLog, updateProductionLog, deleteProductionLog } =
    useProductionLogs();

  const [open, setOpen]       = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm]       = useState<LogForm>(emptyForm);

  // ── open/close ────────────────────────────────────────────────────────────

  const openNew = () => {
    setEditingId(null);
    setForm(emptyForm());
    setOpen(true);
  };

  const openEdit = (log: ProductionLog) => {
    setEditingId(log.id);
    setForm({
      date:              format(safeDate(log.date), 'yyyy-MM-dd'),
      dishName:          log.dishName,
      producedQuantity:  String(log.producedQuantity || ''),
      cleanLeftover:     String(log.cleanLeftover || ''),
      destination:       log.destination,
      destinationEntity: log.destinationEntity || '',
    });
    setOpen(true);
  };

  const closeDialog = () => { setOpen(false); setEditingId(null); };

  // ── save ──────────────────────────────────────────────────────────────────

  const handleSave = () => {
    if (!form.dishName.trim()) {
      toast.error('Informe o nome do prato.');
      return;
    }
    if (!form.producedQuantity || Number(form.producedQuantity) <= 0) {
      toast.error('Informe a quantidade produzida em kg.');
      return;
    }
    if (form.destination === 'donation' && !form.destinationEntity.trim()) {
      toast.error('Informe para onde foi a doação.');
      return;
    }

    const payload = {
      date:              new Date(form.date + 'T12:00:00'),
      shift:             'morning' as const, // kept for compatibility
      dishName:          form.dishName.trim(),
      producedQuantity:  Number(form.producedQuantity) || 0,
      cleanLeftover:     Number(form.cleanLeftover) || 0,
      destination:       form.destination,
      destinationEntity: form.destination === 'donation' ? form.destinationEntity.trim() : '',
    };

    if (editingId) {
      updateProductionLog(editingId, payload);
      toast.success('Registro atualizado.');
    } else {
      addProductionLog(payload);
      toast.success('Produção registrada.');
    }
    closeDialog();
  };

  // ── render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex-1 p-4 md:p-8 bg-gray-50 min-h-screen">
      <div className="max-w-4xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Registro de Produção</h1>
            <p className="text-gray-600 mt-1">
              Controle do que foi produzido, sobras em cubas e destinação final.
            </p>
          </div>
          <Button onClick={openNew} className="bg-blue-600 hover:bg-blue-700 shrink-0">
            <Plus className="w-4 h-4 mr-2" />
            Novo Registro
          </Button>
        </div>

        {/* List */}
        {loading || productionLogs.length === 0 ? (
          <Card>
            <CardContent className="py-16 text-center">
              <ClipboardList className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-600 font-medium">Nenhuma produção registrada.</p>
              <p className="text-sm text-gray-400 mt-1">
                Registre o que foi produzido, quanto sobrou e para onde foi.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {productionLogs.map((log) => {
              const used     = log.producedQuantity - log.cleanLeftover;
              const pctUsed  = log.producedQuantity > 0
                ? ((used / log.producedQuantity) * 100).toFixed(0)
                : '0';

              return (
                <Card key={log.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-4">

                      {/* Main info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 flex-wrap">
                          <span className="font-bold text-gray-900 text-lg leading-tight">
                            {log.dishName}
                          </span>
                          <span className="text-sm text-gray-500">
                            {format(safeDate(log.date), "dd/MM/yyyy", { locale: ptBR })}
                          </span>
                        </div>

                        {/* Metrics row */}
                        <div className="flex flex-wrap gap-3 mt-2 text-sm">
                          <span className="flex items-center gap-1">
                            <span className="text-gray-500">Produzido:</span>
                            <span className="font-semibold text-gray-900">
                              {log.producedQuantity.toFixed(3)} kg
                            </span>
                          </span>
                          <span className="text-gray-300">·</span>
                          <span className="flex items-center gap-1">
                            <span className="text-gray-500">Sobrou:</span>
                            <span className="font-semibold text-gray-900">
                              {log.cleanLeftover.toFixed(3)} kg
                            </span>
                            {log.cleanLeftover > 0 && log.producedQuantity > 0 && (
                              <span className="text-xs text-gray-400">
                                ({((log.cleanLeftover / log.producedQuantity) * 100).toFixed(0)}%)
                              </span>
                            )}
                          </span>
                          <span className="text-gray-300">·</span>
                          <span className="flex items-center gap-1">
                            <span className="text-gray-500">Servido:</span>
                            <span className="font-semibold text-gray-900">
                              {used > 0 ? used.toFixed(3) : '0.000'} kg
                              <span className="text-xs text-gray-400 ml-1">({pctUsed}%)</span>
                            </span>
                          </span>
                        </div>

                        {/* Destination badge */}
                        <div className="mt-2 flex items-center gap-2 flex-wrap">
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${destinationColor[log.destination]}`}
                          >
                            Sobra: {destinationLabel[log.destination]}
                          </span>
                          {log.destination === 'donation' && log.destinationEntity && (
                            <span className="text-xs text-gray-500">
                              → {log.destinationEntity}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex gap-2 shrink-0">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openEdit(log)}
                          title="Editar"
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => {
                            deleteProductionLog(log.id);
                            toast.success('Registro removido.');
                          }}
                          title="Excluir"
                        >
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
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>{editingId ? 'Editar Registro' : 'Novo Registro de Produção'}</DialogTitle>
              <DialogDescription>
                Registre o que foi produzido, quanto sobrou nas cubas e o destino da sobra.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">

              {/* Date + Dish */}
              <div className="grid gap-4 grid-cols-2">
                <div>
                  <Label>Data</Label>
                  <Input
                    type="date"
                    value={form.date}
                    onChange={(e) => setForm({ ...form, date: e.target.value })}
                    className="mt-1.5"
                  />
                </div>
                <div>
                  <Label>Prato / Preparação</Label>
                  <Input
                    value={form.dishName}
                    onChange={(e) => setForm({ ...form, dishName: e.target.value })}
                    placeholder="Ex.: Frango ao molho"
                    className="mt-1.5"
                  />
                </div>
              </div>

              {/* Quantities */}
              <div className="grid gap-4 grid-cols-2">
                <div>
                  <Label>Total produzido (kg)</Label>
                  <Input
                    type="number"
                    value={form.producedQuantity}
                    onChange={(e) => setForm({ ...form, producedQuantity: e.target.value })}
                    placeholder="Ex.: 12.500"
                    step="0.001"
                    min="0"
                    className="mt-1.5"
                  />
                </div>
                <div>
                  <Label>Sobra nas cubas (kg)</Label>
                  <Input
                    type="number"
                    value={form.cleanLeftover}
                    onChange={(e) => setForm({ ...form, cleanLeftover: e.target.value })}
                    placeholder="Ex.: 1.200"
                    step="0.001"
                    min="0"
                    className="mt-1.5"
                  />
                </div>
              </div>

              {/* Destination */}
              <div>
                <Label>Destino da sobra</Label>
                <Select
                  value={form.destination}
                  onValueChange={(v) =>
                    setForm({ ...form, destination: v as ProductionLog['destination'], destinationEntity: '' })
                  }
                >
                  <SelectTrigger className="mt-1.5">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="reuse">Utilizado (reaproveitado)</SelectItem>
                    <SelectItem value="discard">Descartado</SelectItem>
                    <SelectItem value="donation">Doado</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Donation target — only shown when "donation" selected */}
              {form.destination === 'donation' && (
                <div>
                  <Label>Doado para</Label>
                  <Input
                    value={form.destinationEntity}
                    onChange={(e) => setForm({ ...form, destinationEntity: e.target.value })}
                    placeholder="Ex.: CRAS Vila Nova, Abrigo São José..."
                    className="mt-1.5"
                  />
                </div>
              )}

              {/* Live summary */}
              {form.producedQuantity && Number(form.producedQuantity) > 0 && (
                <div className="rounded-lg bg-gray-50 border px-4 py-3 text-sm space-y-1">
                  <p className="text-gray-500 font-medium">Resumo</p>
                  <p>
                    Produzido:{' '}
                    <span className="font-semibold">{Number(form.producedQuantity).toFixed(3)} kg</span>
                  </p>
                  <p>
                    Sobrou:{' '}
                    <span className="font-semibold">{Number(form.cleanLeftover || 0).toFixed(3)} kg</span>
                  </p>
                  <p>
                    Servido:{' '}
                    <span className="font-semibold text-green-700">
                      {(Number(form.producedQuantity) - Number(form.cleanLeftover || 0)).toFixed(3)} kg
                      {' '}
                      ({(((Number(form.producedQuantity) - Number(form.cleanLeftover || 0)) / Number(form.producedQuantity)) * 100).toFixed(0)}%)
                    </span>
                  </p>
                </div>
              )}

              <div className="flex justify-end gap-3 pt-2">
                <Button variant="outline" onClick={closeDialog}>Cancelar</Button>
                <Button onClick={handleSave} className="bg-blue-600 hover:bg-blue-700">
                  {editingId ? 'Salvar Alterações' : 'Registrar Produção'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

      </div>
    </div>
  );
}
