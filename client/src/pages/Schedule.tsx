import { useState } from 'react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, getDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CalendarDays, Check, ChevronLeft, ChevronRight, Download, Pencil, Plus, X } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { useSchedules, useSchools } from '@/hooks/useFirestore';
import { Schedule } from '@/types';
import { addPdfFooter, addPdfHeader, brandColors } from '@/lib/pdfBranding';
import { toast } from 'sonner';

export default function SchedulePage() {
  const { schools } = useSchools();
  const { schedules, loading, setSchedules } = useSchedules();
  const [activeTab, setActiveTab] = useState('calendar');
  const [selectedSchool, setSelectedSchool] = useState('');
  // Default to tomorrow so the user doesn't accidentally use today's date
  const [scheduledDate, setScheduledDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toLocaleDateString('en-CA'); // YYYY-MM-DD in local time
  });
  const [executor, setExecutor] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(new Date());

  // Inline date editing for existing visits
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingDate, setEditingDate] = useState('');

  const asValidDate = (value: unknown): Date => {
    if (!value) return new Date();
    // Firestore Timestamp
    if (typeof (value as any).toDate === 'function') return (value as any).toDate();
    if (value instanceof Date) return value;
    const d = new Date(value as string | number);
    return isNaN(d.getTime()) ? new Date() : d;
  };

  const startEditDate = (schedule: Schedule) => {
    setEditingId(schedule.id);
    setEditingDate(format(asValidDate(schedule.scheduledDate), 'yyyy-MM-dd'));
  };

  const confirmEditDate = () => {
    if (!editingId || !editingDate) return;
    const updated = schedules.map((s) =>
      s.id === editingId
        ? { ...s, scheduledDate: new Date(`${editingDate}T12:00:00`) }
        : s,
    );
    setSchedules(updated);
    setEditingId(null);
    setEditingDate('');
    toast.success('Data atualizada.');
  };

  const handleAddSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return; // guard against rapid double-submit
    if (!selectedSchool || !scheduledDate || !executor.trim()) {
      toast.error('Preencha os campos obrigatórios da visita.');
      return;
    }

    setSubmitting(true);
    try {
      const school = schools.find((item) => item.id === selectedSchool);

      const scheduleData: Schedule = {
        id: `schedule-${crypto.randomUUID()}`, // UUID avoids ID collision on rapid submit
        schoolId: selectedSchool,
        schoolName: school?.name || '',
        scheduledDate: new Date(`${scheduledDate}T12:00:00`),
        nutritionist: executor.trim(),
        type: 'inspection',
        description: description.trim(),
        status: 'pending',
        createdAt: new Date(),
        createdBy: executor.trim(),
      };

      setSchedules([...schedules, scheduleData]);
      setSelectedSchool('');
      // Keep the selected date so adding consecutive visits is faster
      setExecutor('');
      setDescription('');
      toast.success('Visita agendada com sucesso.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteSchedule = (id: string) => {
    setSchedules(schedules.filter((item) => item.id !== id));
    toast.success('Visita removida do cronograma.');
  };

  const generatePDF = async () => {
    try {
      const doc = new jsPDF('p', 'mm', 'a4');
      await addPdfHeader(doc, {
        title: 'Cronograma de Visitas Escolares',
        subtitle: 'Agenda institucional de fiscalização e acompanhamento das unidades',
      });

      autoTable(doc, {
        startY: 38,
        head: [['Data', 'Escola', 'Responsável', 'Status', 'Descrição']],
        body: schedules.map((schedule) => [
          format(asValidDate(schedule.scheduledDate), 'dd/MM/yyyy', { locale: ptBR }),
          schedule.schoolName,
          schedule.nutritionist,
          schedule.status === 'pending' ? 'Pendente' : schedule.status === 'completed' ? 'Concluída' : 'Cancelada',
          schedule.description || '—',
        ]),
        headStyles: { fillColor: brandColors.blue, textColor: 255 },
        alternateRowStyles: { fillColor: [245, 247, 250] },
      });

      addPdfFooter(doc, 'Cronograma de visitas escolares');
      doc.save('cronograma-visitas-escolares.pdf');
      toast.success('PDF do cronograma gerado com sucesso.');
    } catch (err) {
      console.error('Erro ao gerar PDF do cronograma:', err);
      toast.error('Erro ao gerar o PDF. Tente novamente.');
    }
  };

  const daysInMonth = eachDayOfInterval({
    start: startOfMonth(currentMonth),
    end: endOfMonth(currentMonth),
  });

  const getSchedulesForDate = (date: Date) => schedules.filter((item) => isSameDay(asValidDate(item.scheduledDate), date));

  // Separa visitas futuras (hoje em diante) das que já passaram.
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const sortedSchedules = [...schedules].sort(
    (a, b) => asValidDate(a.scheduledDate).getTime() - asValidDate(b.scheduledDate).getTime(),
  );
  const upcomingSchedules = sortedSchedules.filter((s) => asValidDate(s.scheduledDate) >= startOfToday);
  const pastSchedules = sortedSchedules.filter((s) => asValidDate(s.scheduledDate) < startOfToday).reverse();

  const renderScheduleCard = (schedule: Schedule, isPast = false) => (
    <Card key={schedule.id} className={isPast ? 'opacity-70' : ''}>
      <CardContent className="pt-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="space-y-2 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="text-lg font-semibold text-foreground">{schedule.schoolName}</h4>
              {isPast && (
                <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-500">
                  Já realizada / passou
                </span>
              )}
            </div>
            <div className="grid gap-2 text-sm text-muted-foreground md:grid-cols-2">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-foreground">Data:</span>
                {editingId === schedule.id ? (
                  <div className="flex items-center gap-1">
                    <Input
                      type="date"
                      value={editingDate}
                      onChange={(e) => setEditingDate(e.target.value)}
                      className="h-7 w-36 text-sm px-2"
                      autoFocus
                      onKeyDown={(e) => { if (e.key === 'Enter') confirmEditDate(); if (e.key === 'Escape') setEditingId(null); }}
                    />
                    <button onClick={confirmEditDate} className="text-green-600 hover:text-green-700"><Check className="h-4 w-4" /></button>
                    <button onClick={() => setEditingId(null)} className="text-gray-400 hover:text-gray-600"><X className="h-4 w-4" /></button>
                  </div>
                ) : (
                  <span className="flex items-center gap-1">
                    {format(asValidDate(schedule.scheduledDate), "dd/MM/yyyy (EEEE)", { locale: ptBR })}
                    <button
                      onClick={() => startEditDate(schedule)}
                      className="ml-1 text-blue-400 hover:text-blue-600"
                      title="Alterar data"
                    >
                      <Pencil className="h-3 w-3" />
                    </button>
                  </span>
                )}
              </div>
              <div><span className="font-semibold text-foreground">Responsável:</span> {schedule.nutritionist}</div>
            </div>
            {schedule.description ? <p className="text-sm text-muted-foreground">{schedule.description}</p> : null}
          </div>
          <Button variant="destructive" size="sm" onClick={() => handleDeleteSchedule(schedule.id)}>
            Remover
          </Button>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="min-h-screen flex-1 p-4 md:p-8">
      <div className="w-full space-y-8">
        <section className="brand-hero overflow-hidden rounded-[32px] p-6 text-white shadow-[0_30px_80px_-45px_rgba(27,42,74,0.8)] md:p-8">
          <div className="grid gap-6 lg:grid-cols-[1.25fr_0.75fr] lg:items-end">
            <div>
              <div className="brand-chip mb-4">
                <CalendarDays className="h-3.5 w-3.5 text-[#1A73E8]" />
                Agenda de visitas
              </div>
              <h1 className="text-3xl font-bold md:text-4xl">Calendário de fiscalização das escolas.</h1>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-white/80 md:text-base">
                Organize as visitas escolares, acompanhe os responsáveis e exporte o cronograma em PDF com identidade institucional.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-[24px] border border-white/12 bg-white/10 p-4 backdrop-blur">
                <p className="text-xs uppercase tracking-[0.24em] text-white/60">Visitas</p>
                <p className="mt-2 text-3xl font-semibold">{schedules.length}</p>
              </div>
              <div className="rounded-[24px] border border-white/12 bg-white/10 p-4 backdrop-blur">
                <p className="text-xs uppercase tracking-[0.24em] text-white/60">Escolas</p>
                <p className="mt-2 text-3xl font-semibold">{schools.length}</p>
              </div>
            </div>
          </div>
        </section>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-1 sm:grid-cols-3 rounded-2xl bg-white/80 p-1">
            <TabsTrigger value="calendar">Calendário</TabsTrigger>
            <TabsTrigger value="list">Lista</TabsTrigger>
            <TabsTrigger value="add">Agendar visita</TabsTrigger>
          </TabsList>

          <TabsContent value="calendar" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <div>
                    <CardTitle>Calendário de visitas</CardTitle>
                    <CardDescription>Visualização mensal das fiscalizações programadas.</CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="icon-sm" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <div className="rounded-2xl border border-border bg-white/80 px-4 py-2 text-sm font-semibold">
                      {format(currentMonth, 'MMMM yyyy', { locale: ptBR })}
                    </div>
                    <Button variant="outline" size="icon-sm" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="mb-4 grid grid-cols-7 gap-2">
                  {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab'].map((day) => (
                    <div key={day} className="py-2 text-center text-sm font-semibold text-muted-foreground">
                      {day}
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-7 gap-2">
                  {/* Empty offset cells so day 1 lands on the correct weekday column */}
                  {Array.from({ length: getDay(startOfMonth(currentMonth)) }).map((_, i) => (
                    <div key={`offset-${i}`} className="min-h-28 rounded-[20px] border border-border/30 bg-muted/20 p-2" />
                  ))}

                  {daysInMonth.map((day) => {
                    const daySchedules = getSchedulesForDate(day);
                    const isToday      = isSameDay(day, new Date());

                    return (
                      <div
                        key={day.toISOString()}
                        className={
                          isToday
                            ? 'min-h-28 rounded-[20px] border-2 border-[#1A73E8] bg-[#1A73E8]/5 p-2'
                            : 'min-h-28 rounded-[20px] border border-border bg-white/80 p-2'
                        }
                      >
                        <div className={`mb-2 text-sm font-semibold ${isToday ? 'text-[#1A73E8]' : 'text-foreground'}`}>
                          {format(day, 'd')}
                        </div>
                        <div className="space-y-1">
                          {daySchedules.map((schedule) => (
                            <div key={schedule.id} className="rounded-xl bg-[#1A73E8]/10 px-2 py-1 text-xs font-medium text-[#1A73E8]">
                              {schedule.schoolName}
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="list" className="space-y-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <h3 className="text-lg font-semibold text-foreground">Visitas agendadas</h3>
                <p className="text-sm text-muted-foreground">Lista operacional com exportação em PDF.</p>
              </div>
              <Button onClick={generatePDF} variant="secondary" disabled={loading || schedules.length === 0}>
                <Download className="mr-2 h-4 w-4" />
                Exportar PDF
              </Button>
            </div>

            {loading ? (
              <Card>
                <CardContent className="pt-6 text-center text-muted-foreground">Carregando visitas...</CardContent>
              </Card>
            ) : schedules.length === 0 ? (
              <Card>
                <CardContent className="pt-6 text-center text-muted-foreground">Nenhuma visita agendada.</CardContent>
              </Card>
            ) : (
              <div className="space-y-6">
                <div className="space-y-3">
                  <h4 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                    Próximas visitas ({upcomingSchedules.length})
                  </h4>
                  {upcomingSchedules.length === 0 ? (
                    <Card><CardContent className="pt-6 text-center text-muted-foreground">Nenhuma visita futura agendada.</CardContent></Card>
                  ) : (
                    upcomingSchedules.map((schedule) => renderScheduleCard(schedule, false))
                  )}
                </div>

                {pastSchedules.length > 0 && (
                  <div className="space-y-3">
                    <h4 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                      Histórico — visitas que já passaram ({pastSchedules.length})
                    </h4>
                    {pastSchedules.map((schedule) => renderScheduleCard(schedule, true))}
                  </div>
                )}
              </div>
            )}
          </TabsContent>

          <TabsContent value="add">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Plus className="h-4 w-4 text-[#4CAF50]" />
                  Agendar nova visita
                </CardTitle>
                <CardDescription>Preencha os dados principais para colocar a escola no cronograma.</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleAddSchedule} className="space-y-4">
                  <div>
                    <label className="mb-2 block text-sm font-medium text-foreground">Escola *</label>
                    <Select value={selectedSchool} onValueChange={setSelectedSchool}>
                      <SelectTrigger className="w-full">
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
                      <label className="mb-2 block text-sm font-medium text-foreground">Data da visita *</label>
                      <Input type="date" value={scheduledDate} onChange={(e) => setScheduledDate(e.target.value)} />
                    </div>
                    <div>
                      <label className="mb-2 block text-sm font-medium text-foreground">Responsável *</label>
                      <Input
                        placeholder="Quem fará a fiscalização"
                        value={executor}
                        onChange={(e) => setExecutor(e.target.value)}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium text-foreground">Descrição</label>
                    <Textarea
                      placeholder="Objetivo da visita, pontos de atenção e observações operacionais"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                    />
                  </div>

                  <Button type="submit" disabled={submitting} className="w-full md:w-auto">
                    {submitting ? 'Agendando...' : 'Agendar visita'}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
