import { useMemo, useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CartesianGrid, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis } from 'recharts';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useSchools } from '@/hooks/useFirestore';
import {
  type CreateNutritionalAssessmentInput,
  useNutritionalAssessments,
} from '@/hooks/useNutritionalAssessments';
import type { NutritionalAssessmentStatus, NutritionalAssessmentSex } from '@/types';
import { Download, Trash2, Upload } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { toast } from 'sonner';

const STATUS_COLORS: Record<NutritionalAssessmentStatus, string> = {
  'Magreza acentuada': '#b91c1c',
  Magreza: '#ea580c',
  Eutrofia: '#16a34a',
  Sobrepeso: '#d97706',
  Obesidade: '#dc2626',
  'Obesidade grave': '#7f1d1d',
};

function getAgeYears(ageMonths: number) {
  return Number((ageMonths / 12).toFixed(1));
}

function parseDate(value: string) {
  const date = new Date(`${value}T12:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function normalizeSex(value: string): NutritionalAssessmentSex | null {
  const upper = value.trim().toUpperCase();
  if (upper === 'F' || upper === 'FEMININO') return 'F';
  if (upper === 'M' || upper === 'MASCULINO') return 'M';
  return null;
}

function splitLine(line: string) {
  return line.includes('\t') ? line.split('\t') : line.split(';');
}

function buildCsv(records: Array<{
  studentName: string;
  schoolName: string;
  className?: string;
  sex: string;
  birthDate: Date;
  assessmentDate: Date;
  weightKg: number;
  heightCm: number;
  bmi: number;
  status: string;
}>) {
  const header = ['Aluno', 'Escola', 'Turma', 'Sexo', 'Nascimento', 'Avaliacao', 'Peso(kg)', 'Altura(cm)', 'IMC', 'Classificacao'];
  const rows = records.map((record) => [
    record.studentName,
    record.schoolName,
    record.className || '',
    record.sex,
    format(record.birthDate, 'dd/MM/yyyy'),
    format(record.assessmentDate, 'dd/MM/yyyy'),
    record.weightKg.toFixed(2),
    record.heightCm.toFixed(1),
    record.bmi.toFixed(2),
    record.status,
  ]);
  return [header, ...rows].map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(';')).join('\n');
}

function downloadTextFile(filename: string, content: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export default function NutritionalAssessmentPage() {
  const { schools } = useSchools();
  const { records, addBulkRecords, deleteRecord } = useNutritionalAssessments();

  const [schoolId, setSchoolId] = useState('all');
  const [search, setSearch] = useState('');
  const [batchText, setBatchText] = useState('');

  const selectedSchool = schoolId === 'all' ? null : schools.find((school) => school.id === schoolId) || null;

  const filteredRecords = useMemo(() => {
    const term = search.trim().toLowerCase();
    return records.filter((record) => {
      const matchesSchool = !selectedSchool || record.schoolId === selectedSchool.id;
      const matchesTerm =
        !term ||
        record.studentName.toLowerCase().includes(term) ||
        record.schoolName.toLowerCase().includes(term) ||
        record.className?.toLowerCase().includes(term);
      return matchesSchool && matchesTerm;
    });
  }, [records, search, selectedSchool]);

  const statusSummary = useMemo(() => {
    const counters = new Map<NutritionalAssessmentStatus, number>();
    filteredRecords.forEach((record) => {
      counters.set(record.status, (counters.get(record.status) || 0) + 1);
    });
    return Array.from(counters.entries());
  }, [filteredRecords]);

  const chartData = useMemo(
    () => filteredRecords.map((record) => ({
      x: getAgeYears(record.ageMonths),
      y: record.bmi,
      z: 100,
      studentName: record.studentName,
      status: record.status,
      schoolName: record.schoolName,
    })),
    [filteredRecords],
  );

  const handleBatchImport = () => {
    const rows = batchText
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

    if (rows.length === 0) {
      toast.error('Cole ao menos uma linha para importar.');
      return;
    }

    const schoolByName = new Map(schools.map((school) => [school.name.trim().toLowerCase(), school]));
    const inputs: CreateNutritionalAssessmentInput[] = [];
    const errors: string[] = [];

    rows.forEach((line, index) => {
      const cells = splitLine(line).map((cell) => cell.trim());
      if (cells.length < 7) {
        errors.push(`Linha ${index + 1}: campos insuficientes.`);
        return;
      }

      const [studentName, schoolName, sexRaw, birthDateRaw, assessmentDateRaw, weightRaw, heightRaw, className = '', notes = ''] = cells;
      const school = schoolByName.get(schoolName.toLowerCase());
      const sex = normalizeSex(sexRaw);
      const birthDate = parseDate(birthDateRaw);
      const assessmentDate = parseDate(assessmentDateRaw);
      const weightKg = Number(weightRaw.replace(',', '.'));
      const heightCm = Number(heightRaw.replace(',', '.'));

      if (!studentName || !school) {
        errors.push(`Linha ${index + 1}: aluno ou escola não encontrados.`);
        return;
      }
      if (!sex || !birthDate || !assessmentDate) {
        errors.push(`Linha ${index + 1}: sexo ou datas inválidas.`);
        return;
      }
      if (!(weightKg > 0) || !(heightCm > 0)) {
        errors.push(`Linha ${index + 1}: peso e altura precisam ser maiores que zero.`);
        return;
      }

      inputs.push({
        studentName,
        schoolId: school.id,
        schoolName: school.name,
        className,
        sex,
        birthDate,
        assessmentDate,
        weightKg,
        heightCm,
        notes,
      });
    });

    if (errors.length > 0) {
      toast.error(errors[0]);
      return;
    }

    addBulkRecords(inputs);
    setBatchText('');
    toast.success(`${inputs.length} avaliações importadas com sucesso.`);
  };

  const handleExportCsv = () => {
    if (filteredRecords.length === 0) {
      toast.error('Não há avaliações para exportar.');
      return;
    }
    downloadTextFile('avaliacao-nutricional.csv', buildCsv(filteredRecords), 'text/csv;charset=utf-8');
    toast.success('Planilha CSV gerada.');
  };

  const handleExportPdf = () => {
    if (filteredRecords.length === 0) {
      toast.error('Não há avaliações para exportar.');
      return;
    }

    try {
      const doc = new jsPDF('l', 'mm', 'a4');
      doc.setFontSize(18);
      doc.text('Avaliação Nutricional em Lote', 14, 18);
      doc.setFontSize(10);
      doc.text(`Gerado em ${format(new Date(), 'dd/MM/yyyy HH:mm', { locale: ptBR })}`, 14, 25);
      doc.text(selectedSchool?.name || 'Todas as unidades', 14, 31);

      autoTable(doc, {
        startY: 38,
        head: [['Aluno', 'Escola', 'Turma', 'Sexo', 'Idade', 'Peso', 'Altura', 'IMC', 'Classificação']],
        body: filteredRecords.map((record) => [
          record.studentName,
          record.schoolName,
          record.className || '—',
          record.sex,
          `${getAgeYears(record.ageMonths)} anos`,
          record.weightKg.toFixed(1),
          record.heightCm.toFixed(1),
          record.bmi.toFixed(2),
          record.status,
        ]),
        theme: 'grid',
        styles: { fontSize: 8 },
        headStyles: { fillColor: [22, 163, 74], textColor: 255 },
      });

      doc.save('avaliacao-nutricional-lote.pdf');
      toast.success('PDF gerado com sucesso.');
    } catch (error) {
      console.error('Erro ao exportar PDF:', error);
      toast.error('Não foi possível gerar o PDF.');
    }
  };

  return (
    <div className="flex-1 min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="mx-auto max-w-7xl space-y-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Avaliação Nutricional</h1>
          <p className="mt-2 max-w-3xl text-gray-600">
            Fluxo pensado para volume: cole a planilha da escola, calcule IMC automaticamente e visualize a curva operacional por idade em segundos.
          </p>
        </div>

        <Card className="border-emerald-200 bg-emerald-50">
          <CardHeader>
            <CardTitle>Importação em lote</CardTitle>
            <CardDescription>
              Formato aceito por linha: `Aluno; Escola; Sexo; Nascimento(AAAA-MM-DD); Avaliação(AAAA-MM-DD); Peso(kg); Altura(cm); Turma; Observações`.
              Também funciona colando direto do Excel com colunas separadas por tabulação.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <textarea
              className="min-h-44 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={batchText}
              onChange={(event) => setBatchText(event.target.value)}
              placeholder={'Maria Silva; Colégio Alfa; F; 2015-03-10; 2026-08-20; 38,2; 145; 6º A; Reavaliação\nJoão Souza; Colégio Alfa; M; 2014-11-02; 2026-08-20; 44,8; 149; 7º B;'}
            />
            <div className="flex flex-col gap-3 md:flex-row">
              <Button className="gap-2 bg-emerald-700 hover:bg-emerald-800" onClick={handleBatchImport}>
                <Upload className="h-4 w-4" />
                Importar avaliações
              </Button>
              <Button variant="outline" className="gap-2" onClick={handleExportCsv}>
                <Download className="h-4 w-4" />
                Exportar CSV
              </Button>
              <Button variant="outline" className="gap-2" onClick={handleExportPdf}>
                <Download className="h-4 w-4" />
                Exportar PDF
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardContent className="p-5">
              <p className="text-sm text-gray-500">Alunos avaliados</p>
              <p className="mt-2 text-3xl font-bold text-gray-900">{filteredRecords.length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5">
              <p className="text-sm text-gray-500">IMC médio</p>
              <p className="mt-2 text-3xl font-bold text-gray-900">
                {filteredRecords.length > 0
                  ? (filteredRecords.reduce((sum, record) => sum + record.bmi, 0) / filteredRecords.length).toFixed(2)
                  : '—'}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5">
              <p className="text-sm text-gray-500">Faixa predominante</p>
              <p className="mt-2 text-2xl font-bold text-gray-900">
                {statusSummary.sort((a, b) => b[1] - a[1])[0]?.[0] || '—'}
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 xl:grid-cols-[1.3fr_0.9fr]">
          <Card>
            <CardHeader>
              <CardTitle>Curva operacional IMC/idade</CardTitle>
              <CardDescription>
                Visualização rápida para triagem escolar em grande volume. Use como apoio operacional e valide casos limítrofes com o protocolo oficial da sua rede.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={340}>
                  <ScatterChart margin={{ top: 20, right: 20, bottom: 10, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" dataKey="x" name="idade" unit=" anos" domain={[5, 19]} />
                    <YAxis type="number" dataKey="y" name="imc" domain={['auto', 'auto']} />
                    <Tooltip cursor={{ strokeDasharray: '3 3' }} formatter={(value: number) => value.toFixed ? value.toFixed(2) : value} />
                    {Object.entries(STATUS_COLORS).map(([status, color]) => (
                      <Scatter
                        key={status}
                        name={status}
                        data={chartData.filter((point) => point.status === status)}
                        fill={color}
                      />
                    ))}
                  </ScatterChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-sm text-gray-500">Importe avaliações para visualizar a curva.</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Distribuição por classificação</CardTitle>
              <CardDescription>Resumo automático da base filtrada.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {statusSummary.length > 0 ? statusSummary.map(([status, count]) => (
                <div key={status} className="rounded-xl border bg-white p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <span className="h-3 w-3 rounded-full" style={{ backgroundColor: STATUS_COLORS[status] }} />
                      <span className="font-medium text-gray-800">{status}</span>
                    </div>
                    <span className="text-lg font-bold text-gray-900">{count}</span>
                  </div>
                </div>
              )) : (
                <p className="text-sm text-gray-500">Sem dados no filtro atual.</p>
              )}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <CardTitle>Base de avaliações</CardTitle>
                <CardDescription>Filtre, revise e remova lançamentos quando necessário.</CardDescription>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <Label>Unidade</Label>
                  <Select value={schoolId} onValueChange={setSchoolId}>
                    <SelectTrigger className="mt-2 w-full md:w-72">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas as unidades</SelectItem>
                      {schools.map((school) => (
                        <SelectItem key={school.id} value={school.id}>
                          {school.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Busca</Label>
                  <Input className="mt-2 md:w-72" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Aluno, escola ou turma" />
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full text-sm">
                <thead className="bg-emerald-50">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium text-gray-700">Aluno</th>
                    <th className="px-3 py-2 text-left font-medium text-gray-700">Escola</th>
                    <th className="px-3 py-2 text-left font-medium text-gray-700">Turma</th>
                    <th className="px-3 py-2 text-center font-medium text-gray-700">Sexo</th>
                    <th className="px-3 py-2 text-right font-medium text-gray-700">Idade</th>
                    <th className="px-3 py-2 text-right font-medium text-gray-700">Peso</th>
                    <th className="px-3 py-2 text-right font-medium text-gray-700">Altura</th>
                    <th className="px-3 py-2 text-right font-medium text-gray-700">IMC</th>
                    <th className="px-3 py-2 text-left font-medium text-gray-700">Classificação</th>
                    <th className="px-3 py-2 text-right font-medium text-gray-700">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRecords.length > 0 ? filteredRecords.map((record) => (
                    <tr key={record.id} className="border-t">
                      <td className="px-3 py-2 font-medium text-gray-900">{record.studentName}</td>
                      <td className="px-3 py-2 text-gray-600">{record.schoolName}</td>
                      <td className="px-3 py-2 text-gray-600">{record.className || '—'}</td>
                      <td className="px-3 py-2 text-center">{record.sex}</td>
                      <td className="px-3 py-2 text-right">{getAgeYears(record.ageMonths)} anos</td>
                      <td className="px-3 py-2 text-right">{record.weightKg.toFixed(1)} kg</td>
                      <td className="px-3 py-2 text-right">{record.heightCm.toFixed(1)} cm</td>
                      <td className="px-3 py-2 text-right font-semibold">{record.bmi.toFixed(2)}</td>
                      <td className="px-3 py-2">
                        <span
                          className="rounded-full px-2.5 py-1 text-xs font-semibold text-white"
                          style={{ backgroundColor: STATUS_COLORS[record.status] }}
                        >
                          {record.status}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right">
                        <Button variant="ghost" size="sm" onClick={() => deleteRecord(record.id)}>
                          <Trash2 className="h-4 w-4 text-red-600" />
                        </Button>
                      </td>
                    </tr>
                  )) : (
                    <tr>
                      <td className="px-3 py-4 text-gray-500" colSpan={10}>Nenhuma avaliação encontrada.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
