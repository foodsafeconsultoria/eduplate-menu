import { useMemo, useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useMenus } from '@/hooks/useMenus';
import { useSchools } from '@/hooks/useFirestore';
import { useSpecialDiets } from '@/hooks/useSpecialDiets';
import { useAcceptabilityRecords } from '@/hooks/useAcceptabilityRecords';
import { useRestoIngestaRecords } from '@/hooks/useRestoIngestaRecords';
import { useProductionLogs } from '@/hooks/useProductionLogs';
import { useOrgSettings } from '@/hooks/useOrgSettings';
import { addPdfHeader, addPdfFooter, brandColors } from '@/lib/pdfBranding';
import { BarChart3, Download, FileSpreadsheet } from 'lucide-react';
import { toast } from 'sonner';

type NetworkProfile = 'publica' | 'particular' | 'mista';

function toInputDate(date: Date) {
  return date.toISOString().split('T')[0];
}

function inRange(date: Date, start: Date, end: Date) {
  return date >= start && date <= end;
}

function avg(values: number[]) {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function fmtPercent(value: number) {
  return `${value.toFixed(1)}%`;
}

async function generateGeneralReportPdf(params: {
  title: string;
  periodLabel: string;
  organizationName: string;
  networkProfile: NetworkProfile;
  coordinator: string;
  schoolName: string;
  menuRows: string[][];
  qualityRows: string[][];
  summaryRows: string[][];
  notes: string;
}) {
  const doc = new jsPDF();
  const green = brandColors.green as [number, number, number];
  let y = await addPdfHeader(doc, {
    title: params.title,
    subtitle: `${params.organizationName} · ${params.periodLabel}`,
  });

  autoTable(doc, {
    startY: y,
    body: [
      ['Instituição / rede', params.organizationName],
      ['Perfil de atendimento', params.networkProfile],
      ['Responsável técnico', params.coordinator || 'Não informado'],
      ['Escopo', params.schoolName],
      ['Período', params.periodLabel],
    ],
    theme: 'grid',
    styles: { fontSize: 9, cellPadding: 2.5 },
    columnStyles: {
      0: { fontStyle: 'bold', fillColor: [240, 253, 244], cellWidth: 50 },
      1: { cellWidth: 135 },
    },
  });

  y = (doc as any).lastAutoTable.finalY + 8;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...green);
  doc.text('Resumo executivo', 14, y);

  autoTable(doc, {
    startY: y + 3,
    head: [['Indicador', 'Valor']],
    body: params.summaryRows,
    theme: 'striped',
    headStyles: { fillColor: green, textColor: 255 },
    styles: { fontSize: 8.5 },
  });

  y = (doc as any).lastAutoTable.finalY + 8;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...green);
  doc.text('Cardápios no período', 14, y);

  autoTable(doc, {
    startY: y + 3,
    head: [['Cardápio', 'Referência', 'Categorias', 'Escolas']],
    body: params.menuRows.length > 0 ? params.menuRows : [['Nenhum cardápio no período', '—', '—', '—']],
    theme: 'grid',
    headStyles: { fillColor: green, textColor: 255 },
    styles: { fontSize: 8 },
  });

  y = (doc as any).lastAutoTable.finalY + 8;
  if (y > doc.internal.pageSize.getHeight() - 70) {
    doc.addPage();
    y = 18;
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...green);
  doc.text('Qualidade e atendimento', 14, y);

  autoTable(doc, {
    startY: y + 3,
    head: [['Indicador', 'Resultado']],
    body: params.qualityRows,
    theme: 'grid',
    headStyles: { fillColor: green, textColor: 255 },
    styles: { fontSize: 8.5 },
  });

  if (params.notes.trim()) {
    y = (doc as any).lastAutoTable.finalY + 10;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(...green);
    doc.text('Observações gerenciais', 14, y);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(60, 60, 60);
    const wrapped = doc.splitTextToSize(params.notes.trim(), 180);
    doc.text(wrapped, 14, y + 6);
  }

  addPdfFooter(doc);
  doc.save('relatorio-gerencial-alimentacao-escolar.pdf');
}

export default function GeneralReportPage() {
  const { menus } = useMenus();
  const { schools } = useSchools();
  const { specialDiets } = useSpecialDiets();
  const { records: acceptabilityRecords } = useAcceptabilityRecords();
  const { records: restoRecords } = useRestoIngestaRecords();
  const { productionLogs } = useProductionLogs();
  const { settings } = useOrgSettings();

  const [startDate, setStartDate] = useState('2026-01-01');
  const [endDate, setEndDate] = useState('2026-12-31');
  const [schoolId, setSchoolId] = useState('all');
  const [networkProfile, setNetworkProfile] = useState<NetworkProfile>('mista');
  const [organizationName, setOrganizationName] = useState(settings.municipio || 'Instituição de ensino');
  const [coordinator, setCoordinator] = useState(settings.nutritionistName || '');
  const [notes, setNotes] = useState('');

  const start = useMemo(() => new Date(`${startDate}T00:00:00`), [startDate]);
  const end = useMemo(() => new Date(`${endDate}T23:59:59`), [endDate]);
  const selectedSchool = schoolId === 'all' ? null : schools.find((school) => school.id === schoolId) || null;
  const selectedSchoolIds = selectedSchool ? new Set([selectedSchool.id]) : null;

  const filteredMenus = useMemo(() => {
    return menus.filter((menu) => {
      const menuDate = menu.weekStartDate ? new Date(`${menu.weekStartDate}T12:00:00`) : menu.updatedAt;
      const matchesDate = inRange(menuDate, start, end);
      const matchesSchool = !selectedSchoolIds || (menu.schoolIds || []).length === 0 || (menu.schoolIds || []).some((id) => selectedSchoolIds.has(id));
      return matchesDate && matchesSchool;
    });
  }, [menus, selectedSchoolIds, start, end]);

  const filteredAcceptability = useMemo(
    () => acceptabilityRecords.filter((record) => inRange(record.testDate, start, end) && (!selectedSchool || record.schoolId === selectedSchool.id)),
    [acceptabilityRecords, selectedSchool, start, end],
  );

  const filteredResto = useMemo(
    () => restoRecords.filter((record) => inRange(record.testDate, start, end) && (!selectedSchool || record.schoolId === selectedSchool.id)),
    [restoRecords, selectedSchool, start, end],
  );

  const filteredProduction = useMemo(
    () => productionLogs.filter((record) => inRange(record.date, start, end) && (!selectedSchool || record.schoolId === selectedSchool.id)),
    [productionLogs, selectedSchool, start, end],
  );

  const activeSpecialDiets = useMemo(
    () => specialDiets.filter((diet) => diet.status === 'active' && (!selectedSchool || diet.schoolId === selectedSchool.id)),
    [selectedSchool, specialDiets],
  );

  const schoolsCovered = useMemo(() => {
    const ids = new Set<string>();
    filteredMenus.forEach((menu) => {
      (menu.schoolIds || []).forEach((id) => ids.add(id));
    });
    return ids.size > 0 ? ids.size : (selectedSchool ? 1 : schools.length);
  }, [filteredMenus, schools.length, selectedSchool]);

  const averageAcceptance = avg(filteredAcceptability.map((record) => record.percentualAprovacao));
  const averageWaste = avg(filteredResto.map((record) => record.percentual));
  const totalProducedKg = filteredProduction.reduce((sum, record) => sum + (record.producedQuantity || 0), 0);

  const summaryRows = [
    ['Cardápios no período', String(filteredMenus.length)],
    ['Escolas/unidades atendidas', String(schoolsCovered)],
    ['Dietas especiais ativas', String(activeSpecialDiets.length)],
    ['Média de aceitabilidade', filteredAcceptability.length > 0 ? fmtPercent(averageAcceptance) : 'Sem registros'],
    ['Média de resto/ingesta', filteredResto.length > 0 ? fmtPercent(averageWaste) : 'Sem registros'],
    ['Produção registrada', `${totalProducedKg.toFixed(1)} kg`],
  ];

  const menuRows = filteredMenus.slice(0, 15).map((menu) => [
    menu.title,
    menu.referenceMonth || (menu.weekStartDate ? format(new Date(`${menu.weekStartDate}T12:00:00`), 'MM/yyyy', { locale: ptBR }) : '—'),
    (menu.targetCategories || [menu.category]).join(', '),
    menu.schoolIds?.length ? String(menu.schoolIds.length) : 'Geral',
  ]);

  const qualityRows = [
    ['Testes de aceitabilidade', filteredAcceptability.length > 0 ? `${filteredAcceptability.length} registros` : 'Sem registros no período'],
    ['Resto/ingesta', filteredResto.length > 0 ? `${filteredResto.length} registros` : 'Sem registros no período'],
    ['Produção lançada', filteredProduction.length > 0 ? `${filteredProduction.length} lançamentos` : 'Sem registros no período'],
    ['Dietas especiais ativas', activeSpecialDiets.length > 0 ? `${activeSpecialDiets.length} alunos` : 'Sem dietas ativas'],
  ];

  const handleGeneratePdf = async () => {
    try {
      await generateGeneralReportPdf({
        title: 'Relatório Gerencial de Alimentação Escolar',
        periodLabel: `${format(start, 'dd/MM/yyyy')} a ${format(end, 'dd/MM/yyyy')}`,
        organizationName,
        networkProfile,
        coordinator,
        schoolName: selectedSchool?.name || 'Todas as unidades',
        menuRows,
        qualityRows,
        summaryRows,
        notes,
      });
      toast.success('Relatório gerencial gerado com sucesso.');
    } catch (error) {
      console.error('Erro ao gerar relatório gerencial:', error);
      toast.error('Não foi possível gerar o relatório.');
    }
  };

  return (
    <div className="flex-1 min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="mx-auto max-w-7xl space-y-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Relatório Gerencial</h1>
            <p className="mt-2 max-w-3xl text-gray-600">
              Visão consolidada da operação alimentar para redes públicas, particulares ou mistas, sem depender do formato SIGPC.
            </p>
          </div>
          <Button className="gap-2 bg-green-700 hover:bg-green-800" onClick={handleGeneratePdf}>
            <Download className="h-4 w-4" />
            Gerar PDF
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Parâmetros do relatório</CardTitle>
            <CardDescription>Defina o recorte gerencial e o perfil da rede atendida.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div>
              <Label>Data inicial</Label>
              <Input className="mt-2" type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
            </div>
            <div>
              <Label>Data final</Label>
              <Input className="mt-2" type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} />
            </div>
            <div>
              <Label>Unidade</Label>
              <Select value={schoolId} onValueChange={setSchoolId}>
                <SelectTrigger className="mt-2">
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
              <Label>Perfil da rede</Label>
              <Select value={networkProfile} onValueChange={(value) => setNetworkProfile(value as NetworkProfile)}>
                <SelectTrigger className="mt-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="publica">Pública</SelectItem>
                  <SelectItem value="particular">Particular</SelectItem>
                  <SelectItem value="mista">Mista</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="xl:col-span-2">
              <Label>Nome da instituição / rede</Label>
              <Input className="mt-2" value={organizationName} onChange={(event) => setOrganizationName(event.target.value)} placeholder="Ex.: Rede Alfa de Educação" />
            </div>
            <div className="xl:col-span-2">
              <Label>Responsável técnico</Label>
              <Input className="mt-2" value={coordinator} onChange={(event) => setCoordinator(event.target.value)} placeholder="Nutricionista responsável" />
            </div>
            <div className="md:col-span-2 xl:col-span-4">
              <Label>Observações gerenciais</Label>
              <textarea
                className="mt-2 min-h-28 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Use este espaço para registrar decisões, pontos críticos e próximos passos."
              />
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Card>
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <p className="text-sm text-gray-500">Cardápios</p>
                <FileSpreadsheet className="h-4 w-4 text-green-700" />
              </div>
              <p className="mt-2 text-3xl font-bold text-gray-900">{filteredMenus.length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <p className="text-sm text-gray-500">Dietas especiais</p>
                <BarChart3 className="h-4 w-4 text-amber-600" />
              </div>
              <p className="mt-2 text-3xl font-bold text-gray-900">{activeSpecialDiets.length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5">
              <p className="text-sm text-gray-500">Aceitabilidade média</p>
              <p className={`mt-2 text-3xl font-bold ${averageAcceptance >= 85 ? 'text-green-700' : 'text-amber-700'}`}>
                {filteredAcceptability.length > 0 ? fmtPercent(averageAcceptance) : '—'}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5">
              <p className="text-sm text-gray-500">Resto/ingesta médio</p>
              <p className={`mt-2 text-3xl font-bold ${averageWaste <= 10 && filteredResto.length > 0 ? 'text-green-700' : 'text-red-700'}`}>
                {filteredResto.length > 0 ? fmtPercent(averageWaste) : '—'}
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
          <Card>
            <CardHeader>
              <CardTitle>Cardápios localizados</CardTitle>
              <CardDescription>Recorte resumido dos cardápios dentro do período filtrado.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto rounded-lg border">
                <table className="w-full text-sm">
                  <thead className="bg-green-50">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium text-gray-700">Título</th>
                      <th className="px-3 py-2 text-left font-medium text-gray-700">Referência</th>
                      <th className="px-3 py-2 text-left font-medium text-gray-700">Categorias</th>
                      <th className="px-3 py-2 text-right font-medium text-gray-700">Escolas</th>
                    </tr>
                  </thead>
                  <tbody>
                    {menuRows.length > 0 ? menuRows.map((row, index) => (
                      <tr key={`${row[0]}-${index}`} className="border-t">
                        <td className="px-3 py-2">{row[0]}</td>
                        <td className="px-3 py-2 text-gray-600">{row[1]}</td>
                        <td className="px-3 py-2 text-gray-600">{row[2]}</td>
                        <td className="px-3 py-2 text-right text-gray-800">{row[3]}</td>
                      </tr>
                    )) : (
                      <tr>
                        <td className="px-3 py-4 text-gray-500" colSpan={4}>Nenhum cardápio encontrado para este recorte.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Resumo executivo</CardTitle>
              <CardDescription>Indicadores rápidos para gestão e apresentação institucional.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {summaryRows.map(([label, value]) => (
                <div key={label} className="rounded-xl border bg-white p-4">
                  <p className="text-sm text-gray-500">{label}</p>
                  <p className="mt-1 text-xl font-semibold text-gray-900">{value}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
