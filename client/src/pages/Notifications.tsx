/**
 * Notifications page
 *
 * – Alertas em tempo real drivenados por dados do Firebase (cardápios,
 *   agendamentos, documentos)
 * – Estado "visto/não visto" persistido no Firestore via useNotificationState
 */
import { useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/contexts/AuthContext';
import { useMenus } from '@/hooks/useMenus';
import { useSchedules } from '@/hooks/useFirestore';
import { useNotificationState } from '@/hooks/useNotificationState';
import { format } from 'date-fns';
import { Link } from 'wouter';
import { useDocuments } from '@/hooks/useDocuments';

// ── Component ─────────────────────────────────────────────────────────────────

export default function Notifications() {
  const { user } = useAuth();
  const { menus, loading: menusLoading } = useMenus();
  const { schedules, loading: schedulesLoading } = useSchedules();
  const { isSeen, markAsSeen, markManyAsSeen } = useNotificationState(user?.uid);

  // ── Derived values ──────────────────────────────────────────────────────────
  const currentUserName = user?.displayName?.trim() || '';
  const isAdmin = user?.role === 'admin';
  const canManageMenus = user?.role === 'admin' || user?.role === 'nutritionist' || user?.role === 'nutricionista';

  // Apenas visitas pendentes de HOJE em diante — visitas que já passaram não
  // devem mais notificar (mesma regra do badge do TopNav).
  const upcomingVisits = useMemo(() => {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    return schedules.filter(
      (schedule) =>
        schedule.status === 'pending' &&
        new Date(schedule.scheduledDate) >= startOfToday,
    );
  }, [schedules]);


  const menuWorkflowAlerts = useMemo(() => {
    return menus
      .filter((menu) => {
        if (menu.status === 'draft') {
          return canManageMenus && menu.complianceAlerts.length > 0 && (isAdmin || menu.responsibleName === currentUserName);
        }
        if (menu.status === 'under_review') {
          return isAdmin || menu.reviewerName === currentUserName || menu.responsibleName === currentUserName;
        }
        if (menu.status === 'approved') return isAdmin;
        return false;
      })
      .map((menu) => {
        if (menu.status === 'draft') {
          return {
            id: `menu:${menu.id}:draft`,
            tone: 'amber',
            title: `Cardápio em rascunho com pendências: ${menu.title}`,
            message: `${menu.complianceAlerts.length} alerta(s) antes do envio para revisão.`,
            actionLabel: 'Ajustar e enviar',
          };
        }
        if (menu.status === 'under_review') {
          return {
            id: `menu:${menu.id}:under_review`,
            tone: 'blue',
            title: `Cardápio aguardando revisão: ${menu.title}`,
            message: `Responsável: ${menu.responsibleName}. Revisor: ${menu.reviewerName || 'não definido'}.`,
            actionLabel: isAdmin ? 'Aprovar fluxo' : 'Revisar cardápio',
          };
        }
        return {
          id: `menu:${menu.id}:approved`,
          tone: 'green',
          title: `Cardápio pronto para publicar: ${menu.title}`,
          message: `Aprovado por ${menu.approverName || 'responsável técnico'}.`,
          actionLabel: 'Publicar',
        };
      });
  }, [menus, canManageMenus, currentUserName, isAdmin]);

  const visibleWorkflowAlerts = useMemo(
    () => menuWorkflowAlerts.filter((a) => !isSeen(a.id)),
    [isSeen, menuWorkflowAlerts],
  );
  const visibleUpcomingVisits = useMemo(
    () => upcomingVisits.filter((v) => !isSeen(`schedule:${v.id}`)),
    [isSeen, upcomingVisits],
  );
  const { getExpiringDocuments, loading: documentsLoading } = useDocuments();
  const expiringDocuments = getExpiringDocuments(30).filter(d => !isSeen(`doc:${d.id}:expiry`));
  const loading = menusLoading || schedulesLoading || documentsLoading;

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center p-8">
        <div className="text-center">
          <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-4 border-green-200 border-t-green-600" />
          <p className="text-muted-foreground">Carregando notificações...</p>
        </div>
      </div>
    );
  }

  // ── JSX ─────────────────────────────────────────────────────────────────────

  return (
    <div className="flex-1 p-3 md:p-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6">
          <h1 className="mb-2 text-2xl md:text-4xl font-bold text-foreground">Notificações</h1>
          <p className="text-muted-foreground">
            Central de alertas em tempo real — visitas, documentos e fluxo de cardápios
          </p>
        </div>

        <Tabs defaultValue="workflow" className="w-full">
          <TabsList className="grid h-auto w-full grid-cols-1 sm:grid-cols-3">
            <TabsTrigger value="workflow" className="relative">
              Fluxo de Cardápios
              {visibleWorkflowAlerts.length > 0 && (
                <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-amber-500" />
              )}
            </TabsTrigger>
            <TabsTrigger value="visits" className="relative">
              Visitas Próximas
              {visibleUpcomingVisits.length > 0 && (
                <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-blue-500" />
              )}
            </TabsTrigger>
            <TabsTrigger value="documents">Documentos a vencer ({expiringDocuments.length})</TabsTrigger>
          </TabsList>

          {/* ── Fluxo de Cardápios ──────────────────────────────────────────── */}
          <TabsContent value="workflow" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Alertas do Fluxo de Cardápios</CardTitle>
                <CardDescription>
                  Itens que dependem de ação no processo de revisão, aprovação ou publicação.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {visibleWorkflowAlerts.length > 0 && (
                  <div className="mb-4 flex justify-end">
                    <Button variant="outline" size="sm" onClick={() => markManyAsSeen(visibleWorkflowAlerts.map((a) => a.id))}>
                      Marcar tudo como visto
                    </Button>
                  </div>
                )}
                {visibleWorkflowAlerts.length === 0 ? (
                  <p className="py-8 text-center text-muted-foreground">
                    Nenhum cardápio aguardando ação para o seu perfil.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {visibleWorkflowAlerts.map((alert) => (
                      <div
                        key={alert.id}
                        className={`rounded-lg border p-4 ${
                          alert.tone === 'amber'
                            ? 'border-amber-200 bg-amber-50'
                            : alert.tone === 'blue'
                              ? 'border-blue-200 bg-blue-50'
                              : 'border-green-200 bg-green-50'
                        }`}
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <h4 className="font-semibold text-gray-900">{alert.title}</h4>
                            <p className="mt-1 text-sm text-gray-700">{alert.message}</p>
                          </div>
                          <Button variant="outline" size="sm" asChild>
                            <Link href="/nutrition/menus">{alert.actionLabel}</Link>
                          </Button>
                        </div>
                        <div className="mt-3 flex justify-end">
                          <Button variant="ghost" size="sm" onClick={() => markAsSeen(alert.id)}>
                            Marcar como visto
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── Visitas Próximas ────────────────────────────────────────────── */}
          <TabsContent value="visits" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Visitas Agendadas</CardTitle>
                <CardDescription>Todas as visitas pendentes</CardDescription>
              </CardHeader>
              <CardContent>
                {visibleUpcomingVisits.length > 0 && (
                  <div className="mb-4 flex justify-end">
                    <Button variant="outline" size="sm" onClick={() => markManyAsSeen(visibleUpcomingVisits.map((v) => `schedule:${v.id}`))}>
                      Marcar tudo como visto
                    </Button>
                  </div>
                )}
                {visibleUpcomingVisits.length === 0 ? (
                  <p className="py-8 text-center text-muted-foreground">
                    Nenhuma visita pendente.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {visibleUpcomingVisits.map((visit) => (
                      <div key={visit.id} className="rounded-lg border border-blue-200 bg-blue-50 p-4">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <h4 className="font-semibold text-gray-900">{visit.schoolName}</h4>
                            <p className="mt-1 text-sm text-gray-600">
                              {format(new Date(visit.scheduledDate), 'dd/MM/yyyy')}
                            </p>
                            <p className="text-sm text-gray-600">Executor: {visit.nutritionist}</p>
                          </div>
                          <span className="rounded-full bg-blue-200 px-3 py-1 text-xs font-semibold text-blue-800">
                            Pendente
                          </span>
                        </div>
                        <div className="mt-3 flex justify-end">
                          <Button variant="outline" size="sm" asChild><Link href="/schedule">Abrir agenda</Link></Button>
                          <Button variant="ghost" size="sm" onClick={() => markAsSeen(`schedule:${visit.id}`)}>
                            Marcar como visto
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="documents" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Documentos a vencer</CardTitle>
                <CardDescription>Documentos vencidos ou com vencimento nos próximos 30 dias.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {expiringDocuments.length === 0 && <p className="py-8 text-center text-muted-foreground">Nenhum documento pendente de leitura.</p>}
                {expiringDocuments.map(document => (
                  <div key={document.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-4">
                    <div><p className="font-semibold">{document.name}</p><p className="text-sm text-muted-foreground">Vencimento: {document.expiryDate ? format(new Date(document.expiryDate + 'T12:00:00'), 'dd/MM/yyyy') : 'Não informado'}</p></div>
                    <div className="flex gap-2">
                      <Button variant="outline" asChild><Link href="/documents">Abrir documentos</Link></Button>
                      <Button variant="ghost" onClick={() => markAsSeen(`doc:${document.id}:expiry`)}>Marcar como visto</Button>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
