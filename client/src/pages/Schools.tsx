import React, { useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Trash2, AlertCircle, TrendingUp, TrendingDown, Minus, Mail, Pencil, MapPin } from 'lucide-react';
import { School, SchoolDocumentation } from '@/types';
import { SchoolDocumentationFields, SchoolStudentFields } from '@/components/SchoolManagementFields';
import { emptySchoolDocumentation, SCHOOL_PERIODS, schoolRestrictionSummary, validStudentCounts } from '@/lib/schoolDetails';
import { useSpecialDiets } from '@/hooks/useSpecialDiets';
import { SchoolMealSchedules, validMealSchedules } from '@/components/SchoolMealSchedules';
import { SchoolEducationFields } from '@/components/SchoolEducationFields';
import { useSchools, useInspections } from '@/hooks/useFirestore';
import { toast } from 'sonner';

interface EvolutionPhoto {
  id: string;
  schoolId: string;
  before: {
    url: string;
    date: Date;
    description: string;
  };
  after: {
    url: string;
    date: Date;
    description: string;
  };
  title: string;
  createdAt: Date;
}

export default function Schools() {
  const { schools, loading, deleteSchool, saveSchool, schoolSyncStatus, schoolsError, reloadSchools } = useSchools();
  const { specialDiets, loading: dietsLoading } = useSpecialDiets();
  const { inspections } = useInspections();
  const [newSchoolName, setNewSchoolName] = useState('');
  const [newSchoolEmail, setNewSchoolEmail] = useState('');
  const [newSchoolAddress, setNewSchoolAddress] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [evolutionPhotos] = useState<EvolutionPhoto[]>([]);
  const [activeTab, setActiveTab] = useState('schools');
  const [highlightedSchool, setHighlightedSchool] = useState<string | null>(null);

  // Edit state
  const [editSchool, setEditSchool] = useState<School | null>(null);
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editAddress, setEditAddress] = useState('');
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [newMeals, setNewMeals] = useState<NonNullable<School['mealSchedules']>>([]);
  const [editMeals, setEditMeals] = useState<NonNullable<School['mealSchedules']>>([]);
  const [newNetwork, setNewNetwork] = useState<School['educationNetwork'] | ''>('');
  const [editNetwork, setEditNetwork] = useState<School['educationNetwork'] | ''>('');
  const [newStages, setNewStages] = useState<string[]>([]);
  const [editStages, setEditStages] = useState<string[]>([]);
  const [newDocumentation, setNewDocumentation] = useState<SchoolDocumentation>({ ...emptySchoolDocumentation });
  const [editDocumentation, setEditDocumentation] = useState<SchoolDocumentation>({ ...emptySchoolDocumentation });
  const [newStudents, setNewStudents] = useState<NonNullable<School['studentCounts']>>({});
  const [editStudents, setEditStudents] = useState<NonNullable<School['studentCounts']>>({});
  const restrictionCounts = useMemo(() => new Map(schools.map(school => [school.id, schoolRestrictionSummary(school.id, specialDiets)])), [schools, specialDiets]);

  const reportSchoolSave = (synced: boolean, message: string) => {
    if (synced) toast.success(message);
    else toast.error('Não foi possível confirmar o salvamento no servidor.');
  };
  const updateDocumentation = async (school: School, key: 'mbp' | 'pops' | 'technicalRecipes', checked: boolean) => {
    try {
      const synced = await saveSchool({ ...school, documentation: { ...emptySchoolDocumentation, ...school.documentation, [key]: checked }, updatedAt: new Date() });
      reportSchoolSave(synced, 'Documentos da escola atualizados.');
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Não foi possível salvar a alteração.'); }
  };

  // ── Per-school inspection evolution (real data from visits) ────────────────
  const schoolEvolution = useMemo(() => {
    const map = new Map<string, { name: string; visits: { date: Date; score: number; nutritionist: string }[] }>();
    inspections.forEach(insp => {
      if (!map.has(insp.schoolId)) map.set(insp.schoolId, { name: insp.schoolName, visits: [] });
      map.get(insp.schoolId)!.visits.push({
        date: new Date(insp.inspectionDate),
        score: insp.overallScore,
        nutritionist: insp.nutritionist,
      });
    });
    return Array.from(map.entries())
      .map(([id, data]) => {
        const sorted = data.visits.sort((a, b) => a.date.getTime() - b.date.getTime());
        const last  = sorted[sorted.length - 1]?.score ?? 0;
        const prev  = sorted.length > 1 ? sorted[sorted.length - 2].score : null;
        const trend = prev === null ? 'new' : last > prev ? 'up' : last < prev ? 'down' : 'same';
        const avg   = Math.round(sorted.reduce((s, v) => s + v.score, 0) / sorted.length);
        return { id, ...data, visits: sorted, last, prev, trend, avg };
      })
      .filter(s => s.visits.length > 0)
      .sort((a, b) => b.visits.length - a.visits.length);
  }, [inspections]);

  const handleAddSchool = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSchoolName.trim()) {
      toast.error('Digite o nome da escola');
      return;
    }

    try {
      if (!validMealSchedules(newMeals)) { toast.error('Preencha o nome e o horário de cada refeição. Evite repetir o mesmo nome no mesmo horário.'); return; }
      if (!validStudentCounts(newStudents)) { toast.error('Informe quantidades inteiras de alunos, maiores ou iguais a zero.'); return; }
      setSubmitting(true);

      const newSchool: School = {
        id: `school-${crypto.randomUUID()}`,
        name: newSchoolName.trim(),
        email: newSchoolEmail.trim() || undefined,
        address: newSchoolAddress.trim() || undefined,
        mealSchedules: newMeals.map(r => ({ ...r, mealLabel: r.mealLabel.trim() })),
        educationNetwork: newNetwork || undefined,
        educationStages: newStages,
        documentation: { ...newDocumentation, popList: newDocumentation.popList.trim() },
        studentCounts: newStudents,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const synced = await saveSchool(newSchool);

      setNewSchoolName('');
      setNewSchoolEmail('');
      setNewSchoolAddress('');
      setNewMeals([]);
      setNewNetwork('');
      setNewStages([]);
      setNewDocumentation({ ...emptySchoolDocumentation });
      setNewStudents({});
      setDialogOpen(false);
      reportSchoolSave(synced, 'Escola adicionada com sucesso');
    } catch (error) {
      console.error('Erro ao adicionar escola:', error);
      toast.error(error instanceof Error ? error.message : 'Erro ao adicionar escola');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteSchool = async (schoolId: string, schoolName: string) => {
    if (!confirm(`Tem certeza que deseja deletar "${schoolName}"?`)) {
      return;
    }

    try {
      await deleteSchool(schoolId);
      toast.success('Escola removida com sucesso');
    } catch (error) {
      console.error('Erro ao deletar escola:', error);
      toast.error('Erro ao deletar escola');
    }
  };

  const openEditDialog = (school: School) => {
    setEditSchool(school);
    setEditName(school.name);
    setEditEmail(school.email || '');
    setEditAddress(school.address || '');
    setEditMeals(school.mealSchedules || []);
    setEditNetwork(school.educationNetwork || '');
    setEditStages(school.educationStages || []);
    setEditDocumentation({ ...emptySchoolDocumentation, ...school.documentation });
    setEditStudents({ ...school.studentCounts });
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editSchool || !editName.trim()) {
      toast.error('O nome da escola é obrigatório');
      return;
    }
    try {
      if (!validMealSchedules(editMeals)) { toast.error('Preencha o nome e o horário de cada refeição. Evite repetir o mesmo nome no mesmo horário.'); return; }
      if (!validStudentCounts(editStudents)) { toast.error('Informe quantidades inteiras de alunos, maiores ou iguais a zero.'); return; }
      setEditSubmitting(true);
      const updated: School = {
        ...editSchool,
        name: editName.trim(),
        email: editEmail.trim() || undefined,
        address: editAddress.trim() || undefined,
        mealSchedules: editMeals.map(r => ({ ...r, mealLabel: r.mealLabel.trim() })),
        educationNetwork: editNetwork || undefined,
        educationStages: editStages,
        documentation: { ...editDocumentation, popList: editDocumentation.popList.trim() },
        studentCounts: editStudents,
        updatedAt: new Date(),
      };
      const synced = await saveSchool(updated);
      setEditSchool(null);
      reportSchoolSave(synced, 'Escola atualizada com sucesso');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao atualizar escola');
    } finally {
      setEditSubmitting(false);
    }
  };

  const getSchoolEvolution = (schoolId: string) => {
    return evolutionPhotos.filter(p => p.schoolId === schoolId);
  };

  const handleViewEvolution = (schoolId: string) => {
    setHighlightedSchool(schoolId);
    setActiveTab('evolution');
    // Scroll to the card after tab renders, then clear highlight
    setTimeout(() => {
      document.getElementById(`evo-${schoolId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 100);
    setTimeout(() => setHighlightedSchool(null), 3000);
  };

  if (loading) {
    return (
      <div className="flex-1 p-4 md:p-8 bg-gray-50 min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Carregando escolas...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 p-4 md:p-8 bg-gray-50 min-h-screen">
      <div className="max-w-6xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Cadastro de Escolas</h1>
          <p className="text-gray-600 mt-2">Gerenciar escolas e visualizar evolução das melhorias</p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList>
            <TabsTrigger value="schools">Escolas</TabsTrigger>
            <TabsTrigger value="evolution">Evolução</TabsTrigger>
          </TabsList>

          {/* Escolas */}
          <TabsContent value="schools" className="space-y-6">
            <Dialog open={dialogOpen} onOpenChange={open => { if (!submitting) setDialogOpen(open); }}>
              <DialogTrigger asChild>
                <Button className="gap-2 bg-blue-600 hover:bg-blue-700">
                  <Plus className="w-4 h-4" />
                  Nova Escola
                </Button>
              </DialogTrigger>
              <DialogContent className="max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Adicionar Nova Escola</DialogTitle>
                  <DialogDescription>
                    Digite o nome da escola para adicioná-la ao sistema
                  </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleAddSchool} className="space-y-4">
                  <SchoolDocumentationFields value={newDocumentation} onChange={setNewDocumentation} />
                  <SchoolStudentFields value={newStudents} onChange={setNewStudents} />
                  <SchoolMealSchedules value={newMeals} onChange={setNewMeals} />
                  <SchoolEducationFields network={newNetwork} stages={newStages} onNetwork={setNewNetwork} onStages={setNewStages} />
                  <div>
                    <label className="text-sm font-medium text-gray-700 block mb-1">Nome da escola *</label>
                    <Input
                      placeholder="Ex: EMEF Prof. João Silva"
                      value={newSchoolName}
                      onChange={(e) => setNewSchoolName(e.target.value)}
                      autoFocus
                      required
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700 block mb-1">E-mail da escola</label>
                    <Input
                      type="email"
                      placeholder="escola@municipio.sp.gov.br"
                      value={newSchoolEmail}
                      onChange={(e) => setNewSchoolEmail(e.target.value)}
                    />
                    <p className="text-xs text-gray-400 mt-1">Usado para envio de cardápios por e-mail</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700 block mb-1">Endereço</label>
                    <Input
                      placeholder="Rua das Flores, 123 — Centro"
                      value={newSchoolAddress}
                      onChange={(e) => setNewSchoolAddress(e.target.value)}
                    />
                  </div>
                  <div className="flex gap-3 justify-end">
                    <Button variant="outline" type="button" disabled={submitting} onClick={() => setDialogOpen(false)}>
                      Cancelar
                    </Button>
                    <Button
                      type="submit"
                      disabled={submitting}
                      className="bg-blue-600 hover:bg-blue-700"
                    >
                      {submitting ? 'Adicionando...' : 'Adicionar'}
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>

            {/* Edit School Dialog */}
            <Dialog open={!!editSchool} onOpenChange={(open) => { if (!open && !editSubmitting) setEditSchool(null); }}>
              <DialogContent className="max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Editar Escola</DialogTitle>
                  <DialogDescription>Atualize os dados da escola</DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSaveEdit} className="space-y-4">
                  <SchoolDocumentationFields value={editDocumentation} onChange={setEditDocumentation} />
                  <SchoolStudentFields value={editStudents} onChange={setEditStudents} />
                  <SchoolMealSchedules value={editMeals} onChange={setEditMeals} />
                  <SchoolEducationFields network={editNetwork} stages={editStages} onNetwork={setEditNetwork} onStages={setEditStages} />
                  <div>
                    <label className="text-sm font-medium text-gray-700 block mb-1">Nome da escola *</label>
                    <Input
                      placeholder="Ex: EMEF Prof. João Silva"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      autoFocus
                      required
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700 block mb-1">E-mail da escola</label>
                    <Input
                      type="email"
                      placeholder="escola@municipio.sp.gov.br"
                      value={editEmail}
                      onChange={(e) => setEditEmail(e.target.value)}
                    />
                    <p className="text-xs text-gray-400 mt-1">Usado para envio de cardápios por e-mail</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700 block mb-1">Endereço</label>
                    <Input
                      placeholder="Rua das Flores, 123 — Centro"
                      value={editAddress}
                      onChange={(e) => setEditAddress(e.target.value)}
                    />
                  </div>
                  <div className="flex gap-3 justify-end">
                    <Button variant="outline" type="button" disabled={editSubmitting} onClick={() => setEditSchool(null)}>
                      Cancelar
                    </Button>
                    <Button
                      type="submit"
                      disabled={editSubmitting}
                      className="bg-blue-600 hover:bg-blue-700"
                    >
                      {editSubmitting ? 'Salvando...' : 'Salvar alterações'}
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>

            {schoolsError && <Card className="border-red-200"><CardContent className="space-y-3 pt-6">
              <p role="alert" className="text-sm text-red-700">{schoolsError}</p>
              <Button type="button" variant="outline" onClick={reloadSchools}>Tentar novamente</Button>
            </CardContent></Card>}
            {schools.length === 0 && !schoolsError ? (
              <Card>
                <CardContent className="pt-6 text-center">
                  <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600">Nenhuma escola cadastrada</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {schools.map(school => (
                  <Card key={school.id} className="hover:shadow-lg transition-shadow">
                    <CardHeader>
                      <CardTitle className="text-lg">{school.name}</CardTitle>
                      <CardDescription className="space-y-0.5">
                        <span>Criado em {new Date(school.createdAt).toLocaleDateString('pt-BR')}</span>
                        {school.email && (
                          <span className="flex items-center gap-1 text-xs text-green-600 font-medium">
                            <Mail className="w-3 h-3" />{school.email}
                          </span>
                        )}
                        {!school.email && (
                          <span className="text-xs text-amber-500">⚠ Sem e-mail cadastrado</span>
                        )}
                        {school.address && (
                          <span className="flex items-center gap-1 text-xs text-gray-500">
                            <MapPin className="w-3 h-3" />{school.address}
                          </span>
                        )}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <fieldset disabled={schoolSyncStatus[school.id] === 'syncing'} className="rounded-lg border p-3">
                        <legend className="px-1 text-xs font-medium">Documentos disponíveis</legend>
                        <div className="flex flex-wrap gap-3">
                          {([{ key: 'mbp', label: 'MBP' }, { key: 'pops', label: "POP's" }, { key: 'technicalRecipes', label: 'Fichas técnicas' }] as const).map(item =>
                            <label key={item.key} className="flex items-center gap-1.5 text-xs">
                              <input type="checkbox" checked={school.documentation?.[item.key] ?? false} onChange={e => void updateDocumentation(school, item.key, e.target.checked)} />{item.label}
                            </label>)}
                        </div>
                        <p className="mt-2 whitespace-pre-wrap break-words text-xs text-gray-600"><strong>POPs criados:</strong> {school.documentation?.popList || 'Não informados. Use Editar escola para listar.'}</p>
                      </fieldset>
                      <div className="rounded-lg bg-blue-50 p-3 text-xs">
                        <table className="w-full">
                          <caption className="mb-2 text-left font-semibold">Alunos e restrições por período</caption>
                          <thead><tr><th className="text-left">Período</th><th className="text-right">Alunos</th><th className="text-right">Restrições ativas</th></tr></thead>
                          <tbody>{SCHOOL_PERIODS.map(period => <tr key={period.key}>
                            <td className="py-1">{period.label}</td><td className="text-right">{school.studentCounts?.[period.key] ?? '—'}</td>
                            <td className="text-right">{dietsLoading ? '…' : restrictionCounts.get(school.id)?.byPeriod[period.key] ?? 0}</td>
                          </tr>)}</tbody>
                        </table>
                        <p className="mt-2">Total de alunos informado: <strong>{Object.keys(school.studentCounts || {}).length ? Object.values(school.studentCounts || {}).reduce((total, count) => total + (count ?? 0), 0) : 'Não informado'}</strong></p>
                        <p>Restrições ativas na escola: <strong>{dietsLoading ? 'Carregando…' : restrictionCounts.get(school.id)?.total ?? 0}</strong></p>
                        {!dietsLoading && Boolean(restrictionCounts.get(school.id)?.unassigned) && <p>Sem período informado: <strong>{restrictionCounts.get(school.id)?.unassigned}</strong></p>}
                        <p className="mt-1 text-gray-500">Contagem automática de registros ativos em Dietas e restrições; cada cadastro conta uma vez, mesmo com várias restrições.</p>
                      </div>
                      <div className="text-xs text-gray-600">
                        <p className="font-medium">Horários das refeições</p>
                        {school.mealSchedules?.length ? school.mealSchedules.map((meal, index) => <p key={index}>{meal.mealLabel}: <strong>{meal.time}</strong></p>) : <p>Não informados</p>}
                      </div>
                      {schoolSyncStatus[school.id] === 'syncing' && <p role="status" className="text-xs text-blue-700">Salvando no servidor…</p>}
                      {schoolSyncStatus[school.id] === 'synced' && <p role="status" className="text-xs text-green-700">Salvo no servidor</p>}
                      {schoolSyncStatus[school.id] === 'error' && <p role="alert" className="text-xs text-red-700">Salvamento no servidor não confirmado. Confira a conexão e tente salvar novamente.</p>}
                      <div className="text-sm text-gray-600">
                        {(() => {
                          const evo = schoolEvolution.find(s => s.id === school.id);
                          const visitCount = evo ? evo.visits.length : 0;
                          const lastScore = evo ? evo.last : null;
                          return (
                            <>
                              <p>Visitas registradas: <span className="font-semibold text-blue-600">{visitCount}</span></p>
                              {lastScore !== null && (
                                <p>Última pontuação: <span className={`font-semibold ${lastScore >= 80 ? 'text-green-600' : lastScore >= 60 ? 'text-amber-500' : 'text-red-500'}`}>{lastScore}%</span></p>
                              )}
                            </>
                          );
                        })()}
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1 gap-2"
                          onClick={() => handleViewEvolution(school.id)}
                        >
                          <TrendingUp className="w-4 h-4" />
                          Ver Evolução
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEditDialog(school)}
                          className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                          disabled={schoolSyncStatus[school.id] === 'syncing'}
                          title="Editar escola"
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteSchool(school.id, school.name)}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          disabled={schoolSyncStatus[school.id] === 'syncing'}
                          title="Excluir escola"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Evolução */}
          <TabsContent value="evolution" className="space-y-6">
            <Card className="bg-blue-50 border-blue-200">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-blue-600" />
                  Evolução de Conformidade por Escola
                </CardTitle>
                <CardDescription>
                  Histórico real de visitas e tendência de conformidade — baseado nas fiscalizações registradas
                </CardDescription>
              </CardHeader>
            </Card>

            {schoolEvolution.length === 0 ? (
              <Card>
                <CardContent className="pt-8 pb-8 text-center text-muted-foreground">
                  <TrendingUp className="w-12 h-12 mx-auto mb-4 opacity-30" />
                  <p className="font-medium">Nenhuma visita registrada ainda</p>
                  <p className="text-sm mt-1">Registre fiscalizações para ver a evolução de cada escola</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-5 md:grid-cols-2">
                {schoolEvolution.map(school => {
                  const scoreColor = (s: number) => s >= 80 ? 'text-green-600' : s >= 60 ? 'text-amber-500' : 'text-red-500';
                  const barColor  = (s: number) => s >= 80 ? 'bg-green-500' : s >= 60 ? 'bg-amber-400' : 'bg-red-500';
                  const isHighlighted = highlightedSchool === school.id;
                  return (
                    <Card
                      key={school.id}
                      id={`evo-${school.id}`}
                      className={`overflow-hidden transition-all duration-500 ${isHighlighted ? 'ring-2 ring-blue-500 shadow-lg scale-[1.02]' : ''}`}
                    >
                      <CardHeader className="pb-2">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <CardTitle className="text-sm leading-tight">{school.name}</CardTitle>
                            <CardDescription>{school.visits.length} visita{school.visits.length > 1 ? 's' : ''} · média {school.avg}%</CardDescription>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            {school.trend === 'up'   && <><TrendingUp   className="h-4 w-4 text-green-600" /><span className="text-xs text-green-600 font-semibold">Melhorando</span></>}
                            {school.trend === 'down' && <><TrendingDown className="h-4 w-4 text-red-500"   /><span className="text-xs text-red-500   font-semibold">Atenção</span></>}
                            {school.trend === 'same' && <><Minus        className="h-4 w-4 text-gray-400"  /><span className="text-xs text-gray-400  font-semibold">Estável</span></>}
                            {school.trend === 'new'  && <span className="text-xs text-blue-600 font-semibold">1ª visita</span>}
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        {/* Visit timeline */}
                        <div className="space-y-2">
                          {school.visits.map((v, idx) => (
                            <div key={idx} className="flex items-center gap-2">
                              <span className="text-xs text-muted-foreground w-20 shrink-0">
                                {v.date.toLocaleDateString('pt-BR', { day:'2-digit', month:'short', year:'2-digit' })}
                              </span>
                              <div className="flex-1 h-2 rounded-full bg-gray-100">
                                <div className={`h-2 rounded-full transition-all ${barColor(v.score)}`} style={{ width: `${v.score}%` }} />
                              </div>
                              <span className={`text-xs font-bold w-9 text-right shrink-0 ${scoreColor(v.score)}`}>{v.score}%</span>
                            </div>
                          ))}
                        </div>
                        {/* Delta */}
                        {school.prev !== null && (
                          <p className="mt-3 text-xs text-muted-foreground">
                            Última visita: <span className={`font-semibold ${scoreColor(school.last)}`}>{school.last}%</span>
                            {' '}·{' '}
                            {school.last >= school.prev
                              ? <span className="text-green-600">+{school.last - school.prev} pts desde visita anterior</span>
                              : <span className="text-red-500">{school.last - school.prev} pts desde visita anterior</span>
                            }
                          </p>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
