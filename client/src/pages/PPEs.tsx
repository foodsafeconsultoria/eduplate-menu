import { useRef, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Download, Trash2 } from 'lucide-react';
import { EPI } from '@/types';
import { toast } from 'sonner';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format, isValid } from 'date-fns';
import { ptBR } from 'date-fns/locale';

/** Safely converts Firestore Timestamp OR string/Date to JS Date */
function safeDate(v: unknown): Date {
  if (!v) return new Date();
  if (typeof (v as any).toDate === 'function') return (v as any).toDate();
  const d = new Date(v as string | number);
  return isValid(d) ? d : new Date();
}
function safeFmt(v: unknown, fmt: string, opts?: object): string {
  try { return format(safeDate(v), fmt, opts || {}); } catch { return '—'; }
}
import { useEPIs, useSchools } from '@/hooks/useFirestore';
import { addPdfHeader, addPdfFooter, brandColors } from '@/lib/pdfBranding';

const EPI_ITEMS = [
  { key: 'luvaMalhaAco', label: 'Luva de Malha de Aco' },
  { key: 'luvaNitrilo', label: 'Luva Nitrilico' },
  { key: 'botaPvcBranca', label: 'Bota PVC Branca' },
  { key: 'calcadoSeguranca', label: 'Calcado de Seguranca' },
  { key: 'aventalPvc', label: 'Avental PVC' },
  { key: 'aventalTermico', label: 'Avental Termico' },
  { key: 'proterorAuricular', label: 'Protetor Auricular' },
  { key: 'respiradorPff', label: 'Respirador PFF' },
  { key: 'luvaTermica', label: 'Luva Termica' },
  { key: 'touca', label: 'Touca' },
  { key: 'oculosSeguranca', label: 'Oculos de Seguranca' },
] as const;

interface EPIRecord extends EPI {
  quantities?: Record<string, number>;
  caNumbers?: Record<string, string>;
}

export default function PPEs() {
  const { schools } = useSchools();
  const { epis, loading, setEpis } = useEPIs();
  const epiRecords = epis as EPIRecord[];

  const [dialogOpen, setDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [selectedSchool, setSelectedSchool] = useState('');
  const [employeeName, setEmployeeName] = useState('');
  const [caNumbers, setCaNumbers] = useState<Record<string, string>>({});
  const [selectedItems, setSelectedItems] = useState<Record<string, boolean>>({});
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [filterSchool, setFilterSchool] = useState('all');
  const [filterDateStart, setFilterDateStart] = useState('');
  const [filterDateEnd, setFilterDateEnd] = useState('');
  const signatureCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [hasSignature, setHasSignature] = useState(false);
  const [agreedTerms, setAgreedTerms] = useState(false);

  const handleItemToggle = (key: string) => {
    setSelectedItems((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const handleQuantityChange = (key: string, value: string) => {
    setQuantities((prev) => ({
      ...prev,
      [key]: Number.parseInt(value, 10) || 0,
    }));
  };

  const generatePDF = async (epi: EPIRecord) => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();

    let yPosition = await addPdfHeader(doc, {
      title: 'RELATÓRIO DE ENTREGA DE EPIs',
      subtitle: 'PNAE — Gestão de Nutrição Escolar',
    });

    const infoData = [
      ['Funcionária', epi.employeeName],
      ['Escola', epi.schoolName],
      ['Data da Entrega', safeFmt(epi.deliveryDate, 'dd/MM/yyyy', { locale: ptBR })],
    ];

    autoTable(doc, {
      startY: yPosition,
      head: [['Campo', 'Informação']],
      body: infoData,
      theme: 'grid',
      headStyles: { fillColor: brandColors.green, textColor: 255, fontStyle: 'bold' },
      columnStyles: { 0: { cellWidth: 40 }, 1: { cellWidth: 130 } },
    });

    yPosition = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 12;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(31, 41, 55);
    doc.text('EPIs Entregues:', 15, yPosition);
    yPosition += 8;

    const epiData = EPI_ITEMS
      .filter((item) => Boolean(epi.items[item.key]))
      .map((item) => {
        const qty = epi.quantities?.[item.key] || 1;
        const ca = epi.caNumbers?.[item.key] || '-';
        return [item.label, qty.toString(), ca];
      });

    if (epiData.length > 0) {
      autoTable(doc, {
        startY: yPosition,
        head: [['EPI', 'Quantidade', 'Nº do C.A.']],
        body: epiData,
        theme: 'grid',
        headStyles: { fillColor: brandColors.green, textColor: 255, fontStyle: 'bold' },
        columnStyles: { 0: { cellWidth: 100 }, 1: { cellWidth: 30 }, 2: { cellWidth: 40 } },
      });
      yPosition = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 15;
    }

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(74, 85, 104);
    doc.text(
      'Declaro que recebi todos os EPIs listados acima e me comprometo a utilizá-los conforme as normas de segurança.',
      15,
      yPosition,
      { maxWidth: 170 },
    );

    if (epi.signature) {
      yPosition += 20;
      doc.addImage(epi.signature, 'PNG', 15, yPosition, 50, 20);
    }

    addPdfFooter(doc);
    doc.save(`EPI_${epi.schoolName}_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
    toast.success('PDF gerado com sucesso!');
  };

  const handleAddEPI = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedSchool || !employeeName.trim()) {
      toast.error('Preencha todos os campos obrigatorios');
      return;
    }

    if (Object.values(selectedItems).every((value) => !value)) {
      toast.error('Selecione pelo menos um EPI');
      return;
    }

    if (!hasSignature) {
      toast.error('Assinatura digital e obrigatoria');
      return;
    }

    if (!agreedTerms) {
      toast.error('Voce deve aceitar a declaracao de recebimento');
      return;
    }

    try {
      setSubmitting(true);
      const school = schools.find((item) => item.id === selectedSchool);
      const signatureData = signatureCanvasRef.current?.toDataURL() || '';

      const newEPI: EPIRecord = {
        id: `epi-${crypto.randomUUID()}`,
        schoolId: selectedSchool,
        schoolName: school?.name || '',
        employeeName: employeeName.trim(),
        caNumbers,
        deliveryDate: new Date(),
        items: {
          luvaMalhaAco: Boolean(selectedItems.luvaMalhaAco),
          luvaNitrilo: Boolean(selectedItems.luvaNitrilo),
          botaPvcBranca: Boolean(selectedItems.botaPvcBranca),
          calcadoSeguranca: Boolean(selectedItems.calcadoSeguranca),
          aventalPvc: Boolean(selectedItems.aventalPvc),
          aventalTermico: Boolean(selectedItems.aventalTermico),
          proterorAuricular: Boolean(selectedItems.proterorAuricular),
          respiradorPff: Boolean(selectedItems.respiradorPff),
          luvaTermica: Boolean(selectedItems.luvaTermica),
          touca: Boolean(selectedItems.touca),
          oculosSeguranca: Boolean(selectedItems.oculosSeguranca),
        },
        quantities,
        signature: signatureData,
        createdAt: new Date(),
        createdBy: 'Sistema',
      };

      setEpis([...epiRecords, newEPI]);
      setSelectedSchool('');
      setEmployeeName('');
      setSelectedItems({});
      setQuantities({});
      setCaNumbers({});
      setHasSignature(false);
      setAgreedTerms(false);

      if (signatureCanvasRef.current) {
        const ctx = signatureCanvasRef.current.getContext('2d');
        if (ctx) ctx.clearRect(0, 0, signatureCanvasRef.current.width, signatureCanvasRef.current.height);
      }

      setDialogOpen(false);
      toast.success('EPI registrado com sucesso!');
    } catch (error) {
      console.error('Erro ao registrar EPI:', error);
      toast.error('Erro ao registrar EPI');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteEPI = (id: string) => {
    setEpis(epiRecords.filter((item) => item.id !== id));
    toast.success('EPI removido');
  };

  const filteredEPIs = epiRecords.filter((epi) => {
    if (filterSchool !== 'all' && epi.schoolId !== filterSchool) return false;
    if (filterDateStart && safeDate(epi.deliveryDate) < new Date(filterDateStart)) return false;
    if (filterDateEnd && safeDate(epi.deliveryDate) > new Date(filterDateEnd)) return false;
    return true;
  });

  const deliveredCount = epiRecords.length;
  const totalItems = epiRecords.reduce(
    (sum, epi) => sum + Object.values(epi.items).filter(Boolean).length,
    0,
  );

  return (
    <div className="flex-1 p-3 md:p-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8">
          <h1 className="mb-2 text-4xl font-bold text-gray-900">Gestao de EPIs</h1>
          <p className="text-gray-600">Controle de entrega de Equipamentos de Protecao Individual</p>
        </div>

        <Tabs defaultValue="delivery" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="delivery">Entregas</TabsTrigger>
            <TabsTrigger value="history">Historico</TabsTrigger>
          </TabsList>

          <TabsContent value="delivery" className="space-y-6">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-gray-600">Total de Entregas</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">{deliveredCount}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-gray-600">Total de EPIs Entregues</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">{totalItems}</div>
                </CardContent>
              </Card>
            </div>

            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  Registrar Entrega
                </Button>
              </DialogTrigger>
              <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Registrar Entrega de EPIs</DialogTitle>
                  <DialogDescription>Selecione os EPIs entregues e as quantidades</DialogDescription>
                </DialogHeader>
                <form onSubmit={handleAddEPI} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="mb-2 block text-sm font-medium">Escola *</label>
                      <Select value={selectedSchool} onValueChange={setSelectedSchool}>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione" />
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
                    <div>
                      <label className="mb-2 block text-sm font-medium">Funcionaria *</label>
                      <Input
                        placeholder="Nome da funcionaria"
                        value={employeeName}
                        onChange={(e) => setEmployeeName(e.target.value)}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="mb-3 block text-sm font-medium">EPIs a Entregar *</label>
                    <div className="max-h-64 space-y-3 overflow-y-auto rounded-lg border p-4">
                      {EPI_ITEMS.map((item) => (
                        <div key={item.key} className="flex items-center gap-3">
                          <Checkbox
                            checked={selectedItems[item.key] || false}
                            onCheckedChange={() => handleItemToggle(item.key)}
                          />
                          <label className="flex-1 cursor-pointer text-sm">{item.label}</label>
                          {selectedItems[item.key] ? (
                            <div className="flex gap-2">
                              <Input
                                type="number"
                                min="1"
                                value={quantities[item.key] || 1}
                                onChange={(e) => handleQuantityChange(item.key, e.target.value)}
                                className="w-16"
                                title="Quantidade"
                              />
                              <Input
                                type="text"
                                placeholder="No do C.A."
                                value={caNumbers[item.key] || ''}
                                onChange={(e) => setCaNumbers({ ...caNumbers, [item.key]: e.target.value })}
                                className="w-32"
                                title="Numero do C.A."
                              />
                            </div>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium">Assinatura Digital *</label>
                    <canvas
                      ref={signatureCanvasRef}
                      width={600}
                      height={150}
                      className="w-full cursor-crosshair rounded-lg border-2 border-dashed border-gray-300 bg-white touch-none"
                      onPointerDown={(e) => {
                        const canvas = signatureCanvasRef.current;
                        if (!canvas) return;
                        canvas.setPointerCapture(e.pointerId);
                        const ctx = canvas.getContext('2d');
                        if (!ctx) return;
                        const rect = canvas.getBoundingClientRect();
                        const scaleX = canvas.width / rect.width;
                        const scaleY = canvas.height / rect.height;
                        ctx.beginPath();
                        ctx.moveTo((e.clientX - rect.left) * scaleX, (e.clientY - rect.top) * scaleY);
                        setHasSignature(true);
                      }}
                      onPointerMove={(e) => {
                        if (e.buttons !== 1 && e.pointerType !== 'touch') return;
                        if (e.buttons === 0 && e.pointerType === 'mouse') return;
                        const canvas = signatureCanvasRef.current;
                        if (!canvas) return;
                        const ctx = canvas.getContext('2d');
                        if (!ctx) return;
                        const rect = canvas.getBoundingClientRect();
                        const scaleX = canvas.width / rect.width;
                        const scaleY = canvas.height / rect.height;
                        ctx.lineWidth = 2.5;
                        ctx.lineCap = 'round';
                        ctx.lineJoin = 'round';
                        ctx.strokeStyle = '#1e293b';
                        ctx.lineTo((e.clientX - rect.left) * scaleX, (e.clientY - rect.top) * scaleY);
                        ctx.stroke();
                      }}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const c = signatureCanvasRef.current;
                        if (!c) return;
                        const ctx = c.getContext('2d');
                        if (ctx) ctx.clearRect(0, 0, c.width, c.height);
                        setHasSignature(false);
                      }}
                      className="mt-2 w-full"
                    >
                      Limpar Assinatura
                    </Button>
                  </div>

                  <div className="flex items-start gap-3 rounded-lg bg-blue-50 p-3">
                    <Checkbox checked={agreedTerms} onCheckedChange={(checked) => setAgreedTerms(Boolean(checked))} />
                    <label className="cursor-pointer text-sm text-gray-700">
                      Declaro que recebi todos os EPIs listados acima e me comprometo a utiliza-los conforme as normas
                      de seguranca.
                    </label>
                  </div>

                  <Button type="submit" disabled={submitting} className="w-full">
                    {submitting ? 'Registrando...' : 'Registrar Entrega'}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>

            {loading ? (
              <Card>
                <CardContent className="pt-6 text-center text-gray-500">Carregando entregas...</CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {epiRecords.map((epi) => (
                  <Card key={epi.id}>
                    <CardContent className="pt-6">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <h4 className="font-semibold">{epi.schoolName}</h4>
                          <p className="mb-2 text-sm text-gray-600">{epi.employeeName}</p>
                          <p className="text-xs text-gray-500">
                            {safeFmt(epi.deliveryDate, 'dd/MM/yyyy HH:mm', { locale: ptBR })}
                          </p>
                          <div className="mt-2 text-sm">
                            <span className="font-semibold">EPIs:</span> {Object.values(epi.items).filter(Boolean).length}
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button variant="outline" size="sm" onClick={() => generatePDF(epi)}>
                            <Download className="h-4 w-4" />
                          </Button>
                          <Button variant="destructive" size="sm" onClick={() => handleDeleteEPI(epi.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="history" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Filtrar Historico</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                  <div>
                    <label className="mb-2 block text-sm font-medium">Escola</label>
                    <Select value={filterSchool} onValueChange={setFilterSchool}>
                      <SelectTrigger>
                        <SelectValue placeholder="Todas" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todas</SelectItem>
                        {schools.map((school) => (
                          <SelectItem key={school.id} value={school.id}>
                            {school.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-medium">Data Inicial</label>
                    <Input type="date" value={filterDateStart} onChange={(e) => setFilterDateStart(e.target.value)} />
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-medium">Data Final</label>
                    <Input type="date" value={filterDateEnd} onChange={(e) => setFilterDateEnd(e.target.value)} />
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="space-y-3">
              {filteredEPIs.length === 0 ? (
                <Card>
                  <CardContent className="pt-6 text-center text-gray-500">Nenhum registro encontrado</CardContent>
                </Card>
              ) : (
                filteredEPIs.map((epi) => (
                  <Card key={epi.id}>
                    <CardContent className="pt-6">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <h4 className="font-semibold">{epi.schoolName}</h4>
                          <p className="mb-2 text-sm text-gray-600">{epi.employeeName}</p>
                          <p className="text-xs text-gray-500">
                            {safeFmt(epi.deliveryDate, 'dd/MM/yyyy HH:mm', { locale: ptBR })}
                          </p>
                          <div className="mt-2 text-sm">
                            <span className="font-semibold">EPIs:</span> {Object.values(epi.items).filter(Boolean).length}
                          </div>
                        </div>
                        <Button variant="outline" size="sm" onClick={() => generatePDF(epi)}>
                          <Download className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
