import React, { useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Trash2, AlertCircle, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { School } from '@/types';
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
  const { schools, loading, setSchools } = useSchools();
  const { inspections } = useInspections();
  const [newSchoolName, setNewSchoolName] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [evolutionPhotos] = useState<EvolutionPhoto[]>([]);
  const [activeTab, setActiveTab] = useState('schools');
  const [highlightedSchool, setHighlightedSchool] = useState<string | null>(null);

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
      setSubmitting(true);
      await new Promise(resolve => setTimeout(resolve, 500));

      const newSchool: School = {
        id: `school-${crypto.randomUUID()}`,
        name: newSchoolName.trim(),
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const updatedSchools = [newSchool, ...schools];
      setSchools(updatedSchools);
      localStorage.setItem('pnae_schools', JSON.stringify(updatedSchools));

      setNewSchoolName('');
      setDialogOpen(false);
      toast.success('Escola adicionada com sucesso');
    } catch (error) {
      console.error('Erro ao adicionar escola:', error);
      toast.error('Erro ao adicionar escola');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteSchool = async (schoolId: string, schoolName: string) => {
    if (!confirm(`Tem certeza que deseja deletar "${schoolName}"?`)) {
      return;
    }

    try {
      const updatedSchools = schools.filter(s => s.id !== schoolId);
      setSchools(updatedSchools);
      localStorage.setItem('pnae_schools', JSON.stringify(updatedSchools));
      toast.success('Escola removida com sucesso');
    } catch (error) {
      console.error('Erro ao deletar escola:', error);
      toast.error('Erro ao deletar escola');
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
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button className="gap-2 bg-blue-600 hover:bg-blue-700">
                  <Plus className="w-4 h-4" />
                  Nova Escola
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Adicionar Nova Escola</DialogTitle>
                  <DialogDescription>
                    Digite o nome da escola para adicioná-la ao sistema
                  </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleAddSchool} className="space-y-4">
                  <Input
                    placeholder="Nome da escola"
                    value={newSchoolName}
                    onChange={(e) => setNewSchoolName(e.target.value)}
                    autoFocus
                  />
                  <div className="flex gap-3 justify-end">
                    <Button variant="outline" onClick={() => setDialogOpen(false)}>
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

            {schools.length === 0 ? (
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
                      <CardDescription>
                        Criado em {new Date(school.createdAt).toLocaleDateString('pt-BR')}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
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
                          onClick={() => handleDeleteSchool(school.id, school.name)}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
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
