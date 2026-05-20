import { useMemo } from 'react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Download, FileText, Leaf, PieChart, UtensilsCrossed } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAcceptabilityRecords } from '@/hooks/useAcceptabilityRecords';
import { useFoods } from '@/hooks/useFoods';
import { useMenus } from '@/hooks/useMenus';
import { useProductionLogs } from '@/hooks/useProductionLogs';
import { useRecipes } from '@/hooks/useRecipes';
import { useRestoIngestaRecords } from '@/hooks/useRestoIngestaRecords';
import { useSchools, useInspections } from '@/hooks/useFirestore';
import { useSpecialDiets } from '@/hooks/useSpecialDiets';
import { addPdfFooter, addPdfHeader, brandColors } from '@/lib/pdfBranding';
import { toast } from 'sonner';

export default function Reports() {
  const { schools } = useSchools();
  const { inspections } = useInspections();
  const { foods } = useFoods();
  const { recipes } = useRecipes();
  const { menus } = useMenus();
  const { specialDiets } = useSpecialDiets();
  const { productionLogs } = useProductionLogs();
  const { records: acceptabilityRecords } = useAcceptabilityRecords();
  const { records: restoRecords } = useRestoIngestaRecords();

  const averageInspectionScore = useMemo(() => {
    if (inspections.length === 0) return 0;
    return inspections.reduce((sum, item) => sum + (item.overallScore || 0), 0) / inspections.length;
  }, [inspections]);

  const averageAcceptance = useMemo(() => {
    if (acceptabilityRecords.length === 0) return 0;
    return acceptabilityRecords.reduce((sum, item) => sum + item.percentualAprovacao, 0) / acceptabilityRecords.length;
  }, [acceptabilityRecords]);

  const averageWaste = useMemo(() => {
    if (restoRecords.length === 0) return 0;
    return restoRecords.reduce((sum, item) => sum + item.percentual, 0) / restoRecords.length;
  }, [restoRecords]);

  const menuIndicators = useMemo(() => {
    if (menus.length === 0) {
      return {
        averageKcal: 0,
        averageCost: 0,
        averageProtein: 0,
        averageFamilyFarmShare: 0,
        menusWithAlerts: 0,
        totalAlerts: 0,
      };
    }

    return {
      averageKcal: menus.reduce((sum, item) => sum + item.averageKcal, 0) / menus.length,
      averageCost: menus.reduce((sum, item) => sum + item.averageCost, 0) / menus.length,
      averageProtein: menus.reduce((sum, item) => sum + item.averageProtein, 0) / menus.length,
      averageFamilyFarmShare: menus.reduce((sum, item) => sum + item.familyFarmShare, 0) / menus.length,
      menusWithAlerts: menus.filter((item) => item.complianceAlerts.length > 0).length,
      totalAlerts: menus.reduce((sum, item) => sum + item.complianceAlerts.length, 0),
    };
  }, [menus]);

  const nutritionStructure = [
    { name: 'Alimentos', value: foods.length },
    { name: 'Fichas', value: recipes.length },
    { name: 'Cardápios', value: menus.length },
    { name: 'Dietas', value: specialDiets.length },
  ];

  const qualitySummary = [
    { label: 'Aceitação média', value: `${averageAcceptance.toFixed(1)}%` },
    { label: 'Desperdício médio', value: `${averageWaste.toFixed(2)}%` },
    { label: 'Produções registradas', value: `${productionLogs.length}` },
    { label: 'Fiscalizações', value: `${inspections.length}` },
  ];

  const inspectionRanking = useMemo(() => {
    const grouped: Record<string, { total: number; count: number }> = {};

    inspections.forEach((inspection) => {
      if (!grouped[inspection.schoolName]) grouped[inspection.schoolName] = { total: 0, count: 0 };
      grouped[inspection.schoolName].total += inspection.overallScore || 0;
      grouped[inspection.schoolName].count += 1;
    });

    return Object.entries(grouped)
      .map(([schoolName, values]) => ({
        schoolName,
        score: Number((values.total / values.count).toFixed(1)),
      }))
      .sort((a, b) => b.score - a.score);
  }, [inspections]);

  const exportExecutiveReport = async () => {
    const doc = new jsPDF();
    await addPdfHeader(doc, {
      title: 'Relatório Executivo Mensal',
      subtitle: 'Visão consolidada da alimentação escolar, qualidade e fiscalização',
    });

    autoTable(doc, {
      startY: 38,
      head: [['Indicador', 'Resultado']],
      body: [
        ['Escolas cadastradas', `${schools.length}`],
        ['Conformidade média das visitas', `${averageInspectionScore.toFixed(1)}%`],
        ['Aceitação média', `${averageAcceptance.toFixed(1)}%`],
        ['Desperdício médio', `${averageWaste.toFixed(2)}%`],
        ['Cardápios com alerta', `${menuIndicators.menusWithAlerts}`],
      ],
      headStyles: { fillColor: brandColors.navy, textColor: 255 },
      alternateRowStyles: { fillColor: [245, 247, 250] },
    });

    addPdfFooter(doc, 'Relatório executivo mensal');
    doc.save('relatorio-executivo-pnae.pdf');
    toast.success('Relatório executivo gerado em PDF.');
  };

  const exportMenusReport = async () => {
    const doc = new jsPDF();
    await addPdfHeader(doc, {
      title: 'Relatório de Cardápios',
      subtitle: 'Categorias, indicadores nutricionais e status de conformidade',
    });

    autoTable(doc, {
      startY: 38,
      head: [['Título', 'Categoria', 'Kcal média', 'Proteína', 'Alertas']],
      body: menus.map((menu) => [
        menu.title,
        menu.category,
        `${menu.averageKcal.toFixed(0)} kcal`,
        `${menu.averageProtein.toFixed(1)} g`,
        `${menu.complianceAlerts.length}`,
      ]),
      headStyles: { fillColor: brandColors.blue, textColor: 255 },
      alternateRowStyles: { fillColor: [245, 247, 250] },
    });

    addPdfFooter(doc, 'Relatório de cardápios');
    doc.save('relatorio-cardapios.pdf');
    toast.success('Relatório de cardápios gerado em PDF.');
  };

  const exportDietsReport = async () => {
    const doc = new jsPDF();
    await addPdfHeader(doc, {
      title: 'Relatório de Dietas Especiais',
      subtitle: 'Distribuição por unidade, status e observações operacionais',
    });

    autoTable(doc, {
      startY: 38,
      head: [['Aluno', 'Escola', 'Status', 'Condição', 'Substituições']],
      body: specialDiets.map((diet) => [
        diet.studentName,
        diet.schoolName,
        diet.status === 'active' ? 'Ativa' : 'Inativa',
        diet.diagnosis || diet.restrictionCode || 'Não informado',
        diet.prescription || 'Sem orientações',
      ]),
      headStyles: { fillColor: brandColors.green, textColor: 255 },
      alternateRowStyles: { fillColor: [245, 247, 250] },
    });

    addPdfFooter(doc, 'Relatório de dietas especiais');
    doc.save('relatorio-dietas-especiais.pdf');
    toast.success('Relatório de dietas especiais gerado em PDF.');
  };

  const exportProductionReport = async () => {
    const doc = new jsPDF();
    await addPdfHeader(doc, {
      title: 'Relatório de Produção e Desperdício',
      subtitle: 'Controle operacional da cozinha piloto e indicadores de sobra limpa',
    });

    autoTable(doc, {
      startY: 38,
      head: [['Data', 'Unidade', 'Preparação', 'Produzido', 'Sobra limpa', 'Destino']],
      body: productionLogs.map((log) => {
        const d = (log.date instanceof Date) ? log.date
          : typeof (log.date as any)?.toDate === 'function' ? (log.date as any).toDate()
          : new Date(log.date as any);
        return [
          d.toLocaleDateString('pt-BR'),
          log.schoolName || 'Cozinha Piloto',
          log.dishName,
          `${log.producedQuantity.toFixed(1)} kg`,
          `${log.cleanLeftover.toFixed(1)} kg`,
          log.destination || '—',
        ];
      }),
      headStyles: { fillColor: brandColors.orange, textColor: 255 },
      alternateRowStyles: { fillColor: [245, 247, 250] },
    });

    addPdfFooter(doc, 'Relatório de produção e desperdício');
    doc.save('relatorio-producao-desperdicio.pdf');
    toast.success('Relatório de produção gerado em PDF.');
  };

  const exportInspectionReport = async () => {
    const doc = new jsPDF();
    await addPdfHeader(doc, {
      title: 'Relatório de Fiscalização Escolar',
      subtitle: 'Conformidade média por unidade e histórico de visitas',
    });

    autoTable(doc, {
      startY: 38,
      head: [['Escola', 'Pontuação média', 'Visitas registradas']],
      body: inspectionRanking.map((item) => [
        item.schoolName,
        `${item.score.toFixed(1)}%`,
        `${inspections.filter((inspection) => inspection.schoolName === item.schoolName).length}`,
      ]),
      headStyles: { fillColor: brandColors.navy, textColor: 255 },
      alternateRowStyles: { fillColor: [245, 247, 250] },
    });

    addPdfFooter(doc, 'Relatório de fiscalização escolar');
    doc.save('relatorio-fiscalizacao-escolar.pdf');
    toast.success('Relatório de fiscalização gerado em PDF.');
  };

  return (
    <div className="min-h-screen flex-1 p-4 md:p-8">
      <div className="w-full space-y-8">
        <section className="brand-hero overflow-hidden rounded-[32px] p-6 text-white shadow-[0_30px_80px_-45px_rgba(27,42,74,0.8)] md:p-8">
          <div className="grid gap-6 lg:grid-cols-[1.3fr_0.7fr] lg:items-end">
            <div>
              <div className="brand-chip mb-4">
                <FileText className="h-3.5 w-3.5 text-[#1A73E8]" />
                Central de relatórios
              </div>
              <h1 className="text-3xl font-bold md:text-4xl">
                Relatórios gerenciais e imprimíveis da rede municipal.
              </h1>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-white/80 md:text-base">
                Aqui ficam os relatórios que precisam sair do sistema com aparência profissional, leitura rápida e pronta para impressão.
              </p>
            </div>

            <div className="grid gap-3">
              {[
                { label: 'Escolas', value: schools.length },
                { label: 'Cardápios', value: menus.length },
                { label: 'Fiscalizações', value: inspections.length },
              ].map((item) => (
                <div key={item.label} className="rounded-[24px] border border-white/12 bg-white/10 p-4 backdrop-blur">
                  <p className="text-xs uppercase tracking-[0.24em] text-white/60">{item.label}</p>
                  <p className="mt-2 text-3xl font-semibold">{item.value}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {qualitySummary.map((item) => (
            <Card key={item.label}>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">{item.label}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-foreground">{item.value}</div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <PieChart className="h-4 w-4 text-[#1A73E8]" />
                Tipos de relatório
              </CardTitle>
              <CardDescription>Todos os relatórios abaixo já saem em PDF com cabeçalho institucional.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-2">
              <Button onClick={exportExecutiveReport} variant="outline" className="justify-between">
                Relatório executivo mensal
                <Download className="h-4 w-4" />
              </Button>
              <Button onClick={exportMenusReport} variant="outline" className="justify-between">
                Relatório de cardápios
                <Download className="h-4 w-4" />
              </Button>
              <Button onClick={exportDietsReport} variant="outline" className="justify-between">
                Relatório de dietas especiais
                <Download className="h-4 w-4" />
              </Button>
              <Button onClick={exportProductionReport} variant="outline" className="justify-between">
                Relatório de produção e desperdício
                <Download className="h-4 w-4" />
              </Button>
              <Button onClick={exportInspectionReport} variant="outline" className="justify-between md:col-span-2">
                Relatório de fiscalização escolar
                <Download className="h-4 w-4" />
              </Button>
            </CardContent>
          </Card>

          <Card className="brand-hero text-white">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-white">
                <Leaf className="h-4 w-4 text-[#79d685]" />
                Linha institucional
              </CardTitle>
              <CardDescription className="text-white/70">
                O padrão visual e os cabeçalhos dos documentos agora seguem o EduPlate Menu.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm text-white/85">
                Cabeçalho institucional configurável nos PDFs.
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm text-white/85">
                Tipografia e paleta alinhadas com a identidade do EduPlate.
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm text-white/85">
                Base pronta para depois incluir filtros por escola, período e categoria.
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="nutrition" className="w-full">
          <TabsList className="grid w-full grid-cols-1 sm:grid-cols-3 rounded-2xl bg-white/80 p-1">
            <TabsTrigger value="nutrition">Alimentação</TabsTrigger>
            <TabsTrigger value="quality">Qualidade</TabsTrigger>
            <TabsTrigger value="inspection">Fiscalização</TabsTrigger>
          </TabsList>

          <TabsContent value="nutrition" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <UtensilsCrossed className="h-4 w-4 text-[#4CAF50]" />
                  Estrutura do módulo de alimentação
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={320}>
                  <BarChart data={nutritionStructure}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="value" fill="#1A73E8" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="quality" className="space-y-6">
            <div className="grid gap-4 md:grid-cols-3">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Aceitação média</CardTitle>
                </CardHeader>
                <CardContent className="text-3xl font-bold text-foreground">{averageAcceptance.toFixed(1)}%</CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Desperdício médio</CardTitle>
                </CardHeader>
                <CardContent className="text-3xl font-bold text-foreground">{averageWaste.toFixed(2)}%</CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Produção total</CardTitle>
                </CardHeader>
                <CardContent className="text-3xl font-bold text-foreground">{productionLogs.length}</CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="inspection" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Ranking de conformidade por escola</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {inspectionRanking.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-border p-6 text-sm text-muted-foreground">
                    Nenhuma fiscalização registrada ainda.
                  </div>
                ) : (
                  inspectionRanking.slice(0, 8).map((item) => (
                    <div key={item.schoolName} className="flex items-center justify-between rounded-2xl border border-border bg-white/70 px-4 py-3">
                      <span className="font-medium text-foreground">{item.schoolName}</span>
                      <span className="font-semibold text-[#1B2A4A]">{item.score.toFixed(1)}%</span>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
