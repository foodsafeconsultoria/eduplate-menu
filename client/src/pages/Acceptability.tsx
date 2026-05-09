import { useMemo, useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useSchools } from '@/hooks/useFirestore';
import { useAcceptabilityRecords } from '@/hooks/useAcceptabilityRecords';
import { useMenus } from '@/hooks/useMenus';
import { useProductionLogs } from '@/hooks/useProductionLogs';
import { useRecipes } from '@/hooks/useRecipes';
import { Download, Plus, Search, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

const MEAL_TYPES = ['Cafe da Manha', 'Almoco', 'Cafe da Tarde', 'Lanche', 'Jantar'];
const COLORS = ['#10b981', '#ef4444', '#3b82f6', '#f59e0b'];

const emptyForm = {
  schoolId: '',
  testDate: new Date().toISOString().split('T')[0],
  mealType: '',
  dishName: '',
  totalStudents: '',
  approvedStudents: '',
};

export default function AcceptabilityPage() {
  const { schools } = useSchools();
  const { records, loading, addRecord, deleteRecord } = useAcceptabilityRecords();
  const { productionLogs } = useProductionLogs();
  const { menus } = useMenus();
  const { recipes } = useRecipes();

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
        record.mealType.toLowerCase().includes(term) ||
        record.dishName?.toLowerCase().includes(term)
    );
  }, [records, search]);

  const dishSuggestions = useMemo(() => {
    const school = schools.find((item) => item.id === form.schoolId);
    const productionSuggestions = productionLogs
      .filter((log) => !school || !log.schoolId || log.schoolId === school.id)
      .map((log) => log.dishName);
    const menuSuggestions = menus.flatMap((menu) => menu.items.map((item) => item.displayName));
    const recipeSuggestions = recipes.map((recipe) => recipe.displayName || recipe.name);

    const unique = Array.from(new Set([...productionSuggestions, ...menuSuggestions, ...recipeSuggestions]))
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b));

    const term = dishSearch.toLowerCase().trim();
    if (term.length < 2) return [];
    return unique.filter((item) => item.toLowerCase().includes(term)).slice(0, 8);
  }, [dishSearch, form.schoolId, menus, productionLogs, recipes, schools]);

  const averageAcceptance = useMemo(() => {
    if (records.length === 0) return 0;
    return records.reduce((sum, record) => sum + record.percentualAprovacao, 0) / records.length;
  }, [records]);

  const chartData = useMemo(
    () =>
      filteredRecords.map((record) => ({
        escola: record.schoolName.substring(0, 18),
        aceitacao: record.percentualAprovacao,
      })),
    [filteredRecords]
  );

  const pieData = useMemo(
    () => [
      { name: 'Aprovados', value: filteredRecords.reduce((sum, record) => sum + record.approvedStudents, 0) },
      {
        name: 'Não aprovados',
        value: filteredRecords.reduce((sum, record) => sum + (record.totalStudents - record.approvedStudents), 0),
      },
    ],
    [filteredRecords]
  );

  const resetForm = () => {
    setForm(emptyForm);
    setDishSearch('');
  };

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();

    const school = schools.find((item) => item.id === form.schoolId);
    const totalStudents = Number(form.totalStudents);
    const approvedStudents = Number(form.approvedStudents);

    if (!school || !form.mealType || !form.dishName.trim()) {
      toast.error('Preencha todos os campos obrigatórios.');
      return;
    }
    if (isNaN(totalStudents) || totalStudents <= 0) {
      toast.error('Total de alunos deve ser maior que zero.');
      return;
    }
    if (isNaN(approvedStudents) || approvedStudents < 0) {
      toast.error('Número de aprovados não pode ser negativo.');
      return;
    }
    if (approvedStudents > totalStudents) {
      toast.error('Aprovados não pode ser maior que o total.');
      return;
    }

    try {
      setSubmitting(true);

      addRecord({
        schoolId: school.id,
        schoolName: school.name,
        testDate: new Date(form.testDate + 'T12:00:00'),
        mealType: form.mealType,
        dishName: form.dishName.trim(),
        totalStudents,
        approvedStudents,
      });

      resetForm();
      setDialogOpen(false);
      toast.success('Teste de aceitabilidade registrado.');
    } catch (error) {
      console.error('Erro ao salvar aceitabilidade:', error);
      toast.error('Nao foi possivel salvar o registro.');
    } finally {
      setSubmitting(false);
    }
  };

  const generatePDF = () => { try {
    const doc = new jsPDF('p', 'mm', 'a4');
    doc.setFontSize(20);
    doc.text('Relatorio Teste de Aceitabilidade', 20, 20);
    doc.setFontSize(11);
    doc.text(`Gerado em: ${format(new Date(), 'dd/MM/yyyy HH:mm', { locale: ptBR })}`, 20, 30);

    const tableData = filteredRecords.map((record) => [
      format(record.testDate, 'dd/MM/yyyy', { locale: ptBR }),
      record.schoolName,
      record.mealType,
      record.dishName || '—',
      record.totalStudents.toString(),
      record.approvedStudents.toString(),
      `${record.percentualAprovacao.toFixed(2)}%`,
    ]);

    autoTable(doc, {
      head: [['Data', 'Escola', 'Refeicao', 'Preparacao', 'Total', 'Aprovados', 'Aceitacao']],
      body: tableData,
      startY: 40,
      theme: 'grid',
      headStyles: {
        fillColor: [59, 130, 246],
        textColor: 255,
        fontStyle: 'bold',
      },
    });

    doc.save('teste-aceitabilidade.pdf');
    toast.success('PDF gerado com sucesso.');
  } catch (err) {
    console.error('Erro ao gerar PDF de aceitabilidade:', err);
    toast.error('Erro ao gerar o PDF. Tente novamente.');
  } };

  return (
    <div className="flex-1 p-4 md:p-8 bg-gray-50 min-h-screen">
      <div className="max-w-7xl mx-auto space-y-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Teste de Aceitabilidade</h1>
          <p className="text-gray-600 mt-2">
            Registro da aceitacao das preparacoes com apoio das informacoes de cardapio, fichas e producao.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-5">
              <p className="text-sm text-gray-500">Total de testes</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">{records.length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5">
              <p className="text-sm text-gray-500">Media de aceitacao</p>
              <p className={`text-3xl font-bold mt-1 ${averageAcceptance >= 85 ? 'text-green-600' : 'text-red-600'}`}>
                {averageAcceptance.toFixed(1)}%
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5">
              <p className="text-sm text-gray-500">Alunos avaliados</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">
                {records.reduce((sum, record) => sum + record.totalStudents, 0)}
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {chartData.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle>Taxa por escola</CardTitle>
                <CardDescription>Comparativo dos testes registrados na base atual.</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="escola" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="aceitacao" fill="#10b981" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          ) : null}

          {pieData[0].value + pieData[1].value > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle>Distribuicao geral</CardTitle>
                <CardDescription>Consolidado de aprovacao nos testes registrados.</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, value }) => `${name}: ${value}`}
                      outerRadius={80}
                      dataKey="value"
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={`${entry.name}-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          ) : null}
        </div>

        <Card>
          <CardHeader>
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <CardTitle>Registros</CardTitle>
                <CardDescription>Busque, acompanhe e exporte os testes de aceitabilidade.</CardDescription>
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
                      Novo Teste
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-2xl">
                    <DialogHeader>
                      <DialogTitle>Novo Teste de Aceitabilidade</DialogTitle>
                      <DialogDescription>
                        Registre um novo teste usando a escola e a preparacao observada no atendimento.
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
                          <Label>Data do teste</Label>
                          <Input
                            type="date"
                            value={form.testDate}
                            onChange={(e) => setForm({ ...form, testDate: e.target.value })}
                            className="mt-2"
                          />
                        </div>
                        <div>
                          <Label>Tipo de refeicao</Label>
                          <Select value={form.mealType} onValueChange={(value) => setForm({ ...form, mealType: value })}>
                            <SelectTrigger className="mt-2 w-full">
                              <SelectValue placeholder="Selecione a refeicao" />
                            </SelectTrigger>
                            <SelectContent>
                              {MEAL_TYPES.map((meal) => (
                                <SelectItem key={meal} value={meal}>
                                  {meal}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <div>
                        <Label>Nome da preparacao</Label>
                        <div className="relative mt-2">
                          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                          <Input
                            value={form.dishName}
                            onChange={(e) => {
                              setForm({ ...form, dishName: e.target.value });
                              setDishSearch(e.target.value);
                            }}
                            placeholder="Ex: Arroz com feijao"
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

                      <div className="grid gap-4 md:grid-cols-2">
                        <div>
                          <Label>Total de alunos</Label>
                          <Input
                            type="number"
                            value={form.totalStudents}
                            onChange={(e) => setForm({ ...form, totalStudents: e.target.value })}
                            className="mt-2"
                          />
                        </div>
                        <div>
                          <Label>Alunos aprovados</Label>
                          <Input
                            type="number"
                            value={form.approvedStudents}
                            onChange={(e) => setForm({ ...form, approvedStudents: e.target.value })}
                            className="mt-2"
                          />
                        </div>
                      </div>

                      <div className="flex justify-end gap-3">
                        <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                          Cancelar
                        </Button>
                        <Button type="submit" disabled={submitting} className="bg-blue-600 hover:bg-blue-700">
                          {submitting ? 'Salvando...' : 'Salvar Teste'}
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
                placeholder="Buscar por escola, refeicao ou preparacao..."
                className="pl-9"
              />
            </div>

            {loading || filteredRecords.length === 0 ? (
              <p className="text-center text-gray-500 py-8">Nenhum teste registrado.</p>
            ) : (
              <div className="space-y-3">
                {filteredRecords.map((record) => (
                  <div key={record.id} className="flex items-center justify-between p-4 border rounded-lg bg-white">
                    <div className="flex-1">
                      <h4 className="font-semibold text-gray-900">{record.schoolName}</h4>
                      <p className="text-sm text-gray-600">
                        {format(record.testDate, 'dd/MM/yyyy', { locale: ptBR })} · {record.mealType} · {record.dishName || 'Sem preparacao'}
                      </p>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-2 text-sm">
                        <div>
                          <span className="font-semibold">Total:</span> {record.totalStudents} alunos
                        </div>
                        <div>
                          <span className="font-semibold">Aprovados:</span> {record.approvedStudents} alunos
                        </div>
                        <div>
                          <span className={`font-semibold ${record.percentualAprovacao >= 85 ? 'text-green-600' : 'text-red-600'}`}>
                            {record.percentualAprovacao.toFixed(2)}%
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
