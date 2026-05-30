import { useMemo, useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { addPdfHeader, addPdfFooter, brandColors } from '@/lib/pdfBranding';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useSchools } from '@/hooks/useFirestore';
import { useProductionLogs } from '@/hooks/useProductionLogs';
import { useRestoIngestaRecords } from '@/hooks/useRestoIngestaRecords';
import { BarChart3, Download, Plus, Search, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

const emptyForm = {
  schoolId: '',
  dishName: '',
  testDate: new Date().toISOString().split('T')[0],
  pesoProducido: '',
  sobraLimpa: '',
  resto: '',
};

export default function RestoIngestaPage() {
  const { schools } = useSchools();
  const { productionLogs } = useProductionLogs();
  const { records, loading, addRecord, deleteRecord } = useRestoIngestaRecords();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [search, setSearch] = useState('');
  const [dishSearch, setDishSearch] = useState('');
  const [form, setForm] = useState(emptyForm);

  const filteredRecords = useMemo(() => {
    const term = search.toLowerCase().trim();
    if (!term) return records;

    return records.filter(
      (record) =>
        record.schoolName.toLowerCase().includes(term) ||
        record.dishName.toLowerCase().includes(term)
    );
  }, [records, search]);

  const dishSuggestions = useMemo(() => {
    const school = schools.find((item) => item.id === form.schoolId);
    const unique = Array.from(
      new Set(
        productionLogs
          .filter((log) => !school || !log.schoolId || log.schoolId === school.id)
          .map((log) => log.dishName)
      )
    )
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b));

    const term = dishSearch.toLowerCase().trim();
    if (term.length < 2) return [];
    return unique.filter((item) => item.toLowerCase().includes(term)).slice(0, 8);
  }, [dishSearch, form.schoolId, productionLogs, schools]);

  const summary = useMemo(() => {
    const totalProduzido = records.reduce((sum, record) => sum + record.pesoProducido, 0);
    const totalSobra = records.reduce((sum, record) => sum + record.sobraLimpa, 0);
    const mediaDesperdicio = records.length > 0 ? records.reduce((sum, record) => sum + record.percentual, 0) / records.length : 0;

    return {
      totalProduzido,
      totalSobra,
      mediaDesperdicio,
    };
  }, [records]);

  const chartData = useMemo(
    () =>
      filteredRecords.map((record) => ({
        escola: record.schoolName.substring(0, 18),
        percentual: record.percentual,
      })),
    [filteredRecords]
  );

  const resetForm = () => {
    setForm(emptyForm);
    setDishSearch('');
  };

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();

    const school = schools.find((item) => item.id === form.schoolId);
    const pesoProducido = Number(form.pesoProducido);
    const sobraLimpa = Number(form.sobraLimpa);
    const resto = Number(form.resto);

    if (!school || !form.dishName.trim() || !pesoProducido || !sobraLimpa || resto < 0 || form.resto === '') {
      toast.error('Preencha todos os campos obrigatorios.');
      return;
    }

    try {
      setSubmitting(true);

      addRecord({
        schoolId: school.id,
        schoolName: school.name,
        dishName: form.dishName.trim(),
        testDate: new Date(form.testDate + 'T12:00:00'),
        pesoProducido,
        sobraLimpa,
        resto,
      });

      resetForm();
      setDialogOpen(false);
      toast.success('Registro de resto/ingesta salvo.');
    } catch (error) {
      console.error('Erro ao salvar resto/ingesta:', error);
      toast.error('Nao foi possivel salvar o registro.');
    } finally {
      setSubmitting(false);
    }
  };

  const generatePDF = async () => {
    const doc = new jsPDF('p', 'mm', 'a4');

    const startY = await addPdfHeader(doc, {
      title: 'RELATÓRIO DE RESTO/INGESTA',
      subtitle: 'PNAE — Controle de Desperdício Alimentar',
    });

    const tableData = filteredRecords.map((record) => [
      format(record.testDate, 'dd/MM/yyyy', { locale: ptBR }),
      record.schoolName,
      record.dishName,
      record.pesoProducido.toFixed(2),
      record.sobraLimpa.toFixed(2),
      record.resto.toFixed(2),
      `${record.percentual.toFixed(2)}%`,
    ]);

    autoTable(doc, {
      head: [['Data', 'Escola', 'Preparação', 'Produzido (kg)', 'Sobra Limpa (kg)', 'Resto (kg)', 'Percentual']],
      body: tableData,
      startY,
      theme: 'grid',
      headStyles: { fillColor: brandColors.green, textColor: 255, fontStyle: 'bold' },
    });

    addPdfFooter(doc);
    doc.save('resto-ingesta.pdf');
    toast.success('PDF gerado com sucesso.');
  };

  return (
    <div className="flex-1 p-4 md:p-8 bg-gray-50 min-h-screen">
      <div className="max-w-7xl mx-auto space-y-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Resto/Ingesta</h1>
          <p className="text-gray-600 mt-2">
            Monitoramento do desperdicio com apoio dos registros de producao das unidades.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-5">
              <p className="text-sm text-gray-500">Total de registros</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">{records.length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5">
              <p className="text-sm text-gray-500">Media de desperdicio</p>
              <p className={`text-3xl font-bold mt-1 ${summary.mediaDesperdicio > 10 ? 'text-red-600' : 'text-green-600'}`}>
                {summary.mediaDesperdicio.toFixed(2)}%
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5">
              <p className="text-sm text-gray-500">Total produzido</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">{summary.totalProduzido.toFixed(1)} kg</p>
            </CardContent>
          </Card>
        </div>

        {chartData.length > 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>Desperdicio por escola</CardTitle>
              <CardDescription>Percentual de resto/ingesta nos registros da base atual.</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="escola" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="percentual" fill="#3b82f6" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        ) : null}

        <Card>
          <CardHeader>
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <CardTitle>Registros</CardTitle>
                <CardDescription>Registre e acompanhe os percentuais de desperdício por escola e preparação.</CardDescription>
              </div>
              <div className="flex flex-col gap-2 md:flex-row">
                <Button onClick={generatePDF} variant="outline">
                  <Download className="w-4 h-4 mr-2" />
                  Exportar PDF
                </Button>
                <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                  <DialogTrigger asChild>
                    <Button className="bg-blue-600 hover:bg-blue-700">
                      <Plus className="w-4 h-4 mr-2" />
                      Novo Registro
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="w-full max-w-[95vw] sm:max-w-2xl">
                    <DialogHeader>
                      <DialogTitle>Novo Registro Resto/Ingesta</DialogTitle>
                      <DialogDescription>
                        Registre a preparação avaliada, quantidades e percentual de desperdício.
                      </DialogDescription>
                    </DialogHeader>

                    <form onSubmit={handleSave} className="space-y-4">
                      <div>
                        <Label>Escola</Label>
                        <Select value={form.schoolId} onValueChange={(value) => setForm({ ...form, schoolId: value })}>
                          <SelectTrigger className="mt-2 w-full">
                            <SelectValue placeholder="Selecione uma escola" />
                          </SelectTrigger>
                          <SelectContent>
                            {schools.map((school) => (
                              <SelectItem key={school.id} value={school.id}>
                                {school.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="grid gap-4 md:grid-cols-2">
                        <div>
                          <Label>Data</Label>
                          <Input
                            type="date"
                            value={form.testDate}
                            onChange={(e) => setForm({ ...form, testDate: e.target.value })}
                            className="mt-2"
                          />
                        </div>
                        <div>
                          <Label>Preparacao</Label>
                          <div className="relative mt-2">
                            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                            <Input
                              value={form.dishName}
                              onChange={(e) => {
                                setForm({ ...form, dishName: e.target.value });
                                setDishSearch(e.target.value);
                              }}
                              className="pl-9"
                            />
                          </div>
                          {dishSuggestions.length > 0 ? (
                            <div className="mt-2 border rounded-lg bg-white overflow-hidden">
                              {dishSuggestions.map((suggestion) => (
                                <button
                                  key={suggestion}
                                  type="button"
                                  onClick={() => {
                                    setForm({ ...form, dishName: suggestion });
                                    setDishSearch(suggestion);
                                  }}
                                  className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50 border-b last:border-b-0"
                                >
                                  {suggestion}
                                </button>
                              ))}
                            </div>
                          ) : null}
                        </div>
                      </div>

                      <div className="grid gap-4 md:grid-cols-3">
                        <div>
                          <Label>Peso produzido (kg)</Label>
                          <Input
                            type="number"
                            step="0.01"
                            value={form.pesoProducido}
                            onChange={(e) => setForm({ ...form, pesoProducido: e.target.value })}
                            className="mt-2"
                          />
                        </div>
                        <div>
                          <Label>Sobra limpa (kg)</Label>
                          <Input
                            type="number"
                            step="0.01"
                            value={form.sobraLimpa}
                            onChange={(e) => setForm({ ...form, sobraLimpa: e.target.value })}
                            className="mt-2"
                          />
                        </div>
                        <div>
                          <Label>Resto (kg)</Label>
                          <Input
                            type="number"
                            step="0.01"
                            value={form.resto}
                            onChange={(e) => setForm({ ...form, resto: e.target.value })}
                            className="mt-2"
                          />
                        </div>
                      </div>

                      <div className="flex justify-end gap-3">
                        <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                          Cancelar
                        </Button>
                        <Button type="submit" disabled={submitting} className="bg-blue-600 hover:bg-blue-700">
                          {submitting ? 'Salvando...' : 'Salvar Registro'}
                        </Button>
                      </div>
                    </form>
                  </DialogContent>
                </Dialog>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="relative max-w-md">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por escola ou preparação..."
                className="pl-9"
              />
            </div>

            {loading || filteredRecords.length === 0 ? (
              <div className="py-16 text-center text-gray-500">
                <BarChart3 className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                Nenhum registro de resto/ingesta encontrado.
              </div>
            ) : (
              <div className="space-y-3">
                {filteredRecords.map((record) => (
                  <div key={record.id} className="flex items-center justify-between p-4 border rounded-lg bg-white">
                    <div className="flex-1">
                      <h4 className="font-semibold text-gray-900">{record.schoolName}</h4>
                      <p className="text-sm text-gray-600">
                        {format(record.testDate, 'dd/MM/yyyy', { locale: ptBR })} · {record.dishName}
                      </p>
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mt-2 text-sm">
                        <div>
                          <span className="font-semibold">Produzido:</span> {record.pesoProducido.toFixed(2)} kg
                        </div>
                        <div>
                          <span className="font-semibold">Sobra:</span> {record.sobraLimpa.toFixed(2)} kg
                        </div>
                        <div>
                          <span className="font-semibold">Resto:</span> {record.resto.toFixed(2)} kg
                        </div>
                        <div>
                          <span className={`font-semibold ${record.percentual > 10 ? 'text-red-600' : 'text-green-600'}`}>
                            {record.percentual.toFixed(2)}%
                          </span>
                        </div>
                      </div>
                    </div>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => {
                        deleteRecord(record.id);
                        toast.success('Registro removido.');
                      }}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
