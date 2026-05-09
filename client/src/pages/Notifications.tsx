/**
 * Notifications page
 *
 * – Alertas em tempo real drivenados por dados do Firebase (cardápios,
 *   agendamentos, manutenção)
 * – Estado "visto/não visto" persistido no Firestore via useNotificationState
 * – Configurações de notificação salvas no Firestore (users/{uid})
 */
import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Bell, Mail, AlertCircle, Calendar, BookOpenCheck, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { useMenus } from '@/hooks/useMenus';
import { useSchedules } from '@/hooks/useFirestore';
import { useMaintenanceTickets } from '@/hooks/useMaintenanceTickets';
import { useNotificationState } from '@/hooks/useNotificationState';
import { db } from '@/lib/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { format } from 'date-fns';

// ── Types ─────────────────────────────────────────────────────────────────────

interface NotificationSettings {
  emailAddress: string;
  notifyUpcomingVisits: boolean;
  notifyMaintenanceIssues: boolean;
  notifyLowConformity: boolean;
  notifyMenuWorkflow: boolean;
  daysBeforeVisit: number;
  emailjsServiceId: string;
  emailjsTemplateId: string;
  emailjsPublicKey: string;
}

const DEFAULT_SETTINGS: NotificationSettings = {
  emailAddress: '',
  notifyUpcomingVisits: true,
  notifyMaintenanceIssues: true,
  notifyLowConformity: true,
  notifyMenuWorkflow: true,
  daysBeforeVisit: 3,
  emailjsServiceId: '',
  emailjsTemplateId: '',
  emailjsPublicKey: '',
};

// ── EmailJS sender ─────────────────────────────────────────────────────────────

async function sendEmailJS(
  serviceId: string,
  templateId: string,
  publicKey: string,
  params: Record<string, string>,
): Promise<void> {
  let res: Response;
  try {
    res = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        service_id: serviceId,
        template_id: templateId,
        user_id: publicKey,
        template_params: params,
      }),
    });
  } catch (networkErr) {
    throw new Error('Sem conexão com a internet ou o serviço EmailJS está inacessível.');
  }
  if (!res.ok) {
    let detail = '';
    try { detail = await res.text(); } catch { /* ignore */ }
    throw new Error(`EmailJS respondeu com erro ${res.status}${detail ? `: ${detail}` : ''}.`);
  }
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function Notifications() {
  const { user } = useAuth();
  const { menus, loading: menusLoading } = useMenus();
  const { schedules, loading: schedulesLoading } = useSchedules();
  const { tickets, loading: ticketsLoading } = useMaintenanceTickets();
  const { isSeen, markAsSeen, markManyAsSeen } = useNotificationState(user?.uid);

  const [settings, setSettings] = useState<NotificationSettings>(DEFAULT_SETTINGS);
  const [settingsLoading, setSettingsLoading] = useState(true);
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [isSendingEmail, setIsSendingEmail] = useState(false);

  // ── Load settings from Firestore ────────────────────────────────────────────
  useEffect(() => {
    if (!user?.uid) {
      setSettingsLoading(false);
      return;
    }

    const loadSettings = async () => {
      try {
        const ref = doc(db, 'notificationSettings', user.uid);
        const snap = await getDoc(ref);
        if (snap.exists()) {
          setSettings({ ...DEFAULT_SETTINGS, ...(snap.data() as Partial<NotificationSettings>) });
        }
      } catch (err) {
        console.warn('[Notifications] Failed to load settings from Firestore:', err);
      } finally {
        setSettingsLoading(false);
      }
    };

    loadSettings();
  }, [user?.uid]);

  // ── Derived values ──────────────────────────────────────────────────────────
  const currentUserName = user?.displayName?.trim() || '';
  const isAdmin = user?.role === 'admin';
  const canManageMenus = user?.role === 'admin' || user?.role === 'nutritionist';

  const upcomingVisits = useMemo(() => {
    const today = new Date();
    const futureDate = new Date(today.getTime() + settings.daysBeforeVisit * 24 * 60 * 60 * 1000);
    return schedules.filter((schedule) => {
      const d = new Date(schedule.scheduledDate);
      return d >= today && d <= futureDate && schedule.status === 'pending';
    });
  }, [schedules, settings.daysBeforeVisit]);

  const openTickets = useMemo(
    () => tickets.filter((t) => t.status === 'open' && t.priority === 'high'),
    [tickets],
  );

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
  const visibleOpenTickets = useMemo(
    () => openTickets.filter((t) => !isSeen(`ticket:${t.id}`)),
    [isSeen, openTickets],
  );

  const loading = menusLoading || schedulesLoading || ticketsLoading || settingsLoading;

  // ── Handlers ────────────────────────────────────────────────────────────────

  const handleSaveSettings = async () => {
    if (!settings.emailAddress) {
      toast.error('Preencha o e-mail de notificações');
      return;
    }
    if (!user?.uid) {
      toast.error('Sessão expirada. Recarregue a página.');
      return;
    }

    setIsSavingSettings(true);
    try {
      await setDoc(
        doc(db, 'notificationSettings', user.uid),
        { ...settings, updatedAt: new Date().toISOString() },
        { merge: true },
      );
      toast.success('Configurações salvas no servidor!');
    } catch (err) {
      console.error(err);
      toast.error('Erro ao salvar configurações. Tente novamente.');
    } finally {
      setIsSavingSettings(false);
    }
  };

  const emailjsConfigured =
    settings.emailjsServiceId.trim() !== '' &&
    settings.emailjsTemplateId.trim() !== '' &&
    settings.emailjsPublicKey.trim() !== '';

  const handleSendTestEmail = async () => {
    if (!settings.emailAddress) {
      toast.error('Preencha o e-mail de notificações antes de enviar o teste.');
      return;
    }
    if (!emailjsConfigured) {
      toast.error('Preencha as credenciais do EmailJS (Service ID, Template ID e Public Key) para habilitar o envio.');
      return;
    }

    setIsSendingEmail(true);
    try {
      // Build summary lines for the test email
      const visitLines = upcomingVisits.length > 0
        ? upcomingVisits.map(v => `• ${v.schoolName} — ${format(new Date(v.scheduledDate), 'dd/MM/yyyy')}`).join('\n')
        : 'Nenhuma visita nos próximos dias.';

      const ticketLines = openTickets.length > 0
        ? openTickets.map(t => `• ${t.schoolName}: ${t.equipment}`).join('\n')
        : 'Nenhum ticket de alta prioridade em aberto.';

      const menuLines = menuWorkflowAlerts.length > 0
        ? menuWorkflowAlerts.map(a => `• ${a.title}`).join('\n')
        : 'Nenhum cardápio aguardando ação.';

      await sendEmailJS(
        settings.emailjsServiceId.trim(),
        settings.emailjsTemplateId.trim(),
        settings.emailjsPublicKey.trim(),
        {
          to_email: settings.emailAddress,
          to_name: user?.displayName || 'Usuário',
          subject: 'PNAE — Resumo de Alertas',
          visits_summary: visitLines,
          tickets_summary: ticketLines,
          menus_summary: menuLines,
          sent_at: format(new Date(), 'dd/MM/yyyy HH:mm'),
        },
      );
      toast.success('E-mail de teste enviado com sucesso!');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(`Falha ao enviar e-mail: ${msg}`);
      console.error('[Notifications] EmailJS error:', err);
    } finally {
      setIsSendingEmail(false);
    }
  };

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
    <div className="flex-1 p-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8">
          <h1 className="mb-2 text-4xl font-bold text-foreground">Notificações</h1>
          <p className="text-muted-foreground">
            Central de alertas em tempo real — visitas, manutenção e fluxo de cardápios
          </p>
        </div>

        <Tabs defaultValue="workflow" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
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
            <TabsTrigger value="maintenance" className="relative">
              Manutenção
              {visibleOpenTickets.length > 0 && (
                <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-red-500" />
              )}
            </TabsTrigger>
            <TabsTrigger value="settings">Configurações</TabsTrigger>
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
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <h4 className="font-semibold text-gray-900">{alert.title}</h4>
                            <p className="mt-1 text-sm text-gray-700">{alert.message}</p>
                          </div>
                          <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-gray-700">
                            {alert.actionLabel}
                          </span>
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
                <CardDescription>Próximos {settings.daysBeforeVisit} dias</CardDescription>
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
                    Nenhuma visita agendada para os próximos {settings.daysBeforeVisit} dias.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {visibleUpcomingVisits.map((visit) => (
                      <div key={visit.id} className="rounded-lg border border-blue-200 bg-blue-50 p-4">
                        <div className="flex items-start justify-between">
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

          {/* ── Manutenção ──────────────────────────────────────────────────── */}
          <TabsContent value="maintenance" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Problemas de Manutenção</CardTitle>
                <CardDescription>Tickets com alta prioridade em aberto</CardDescription>
              </CardHeader>
              <CardContent>
                {visibleOpenTickets.length > 0 && (
                  <div className="mb-4 flex justify-end">
                    <Button variant="outline" size="sm" onClick={() => markManyAsSeen(visibleOpenTickets.map((t) => `ticket:${t.id}`))}>
                      Marcar tudo como visto
                    </Button>
                  </div>
                )}
                {visibleOpenTickets.length === 0 ? (
                  <p className="py-8 text-center text-muted-foreground">
                    Nenhum problema de manutenção com alta prioridade.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {visibleOpenTickets.map((ticket) => (
                      <div key={ticket.id} className="rounded-lg border border-red-200 bg-red-50 p-4">
                        <div className="flex items-start justify-between">
                          <div>
                            <h4 className="font-semibold text-gray-900">{ticket.schoolName}</h4>
                            <p className="mt-1 text-sm text-gray-600">
                              <strong>Equipamento:</strong> {ticket.equipment}
                            </p>
                            <p className="text-sm text-gray-600">
                              <strong>Descrição:</strong> {ticket.description}
                            </p>
                            <p className="text-sm text-gray-600">
                              Reportado em: {format(new Date(ticket.createdAt), 'dd/MM/yyyy')}
                            </p>
                          </div>
                          <span className="rounded-full bg-red-200 px-3 py-1 text-xs font-semibold text-red-800">
                            Alta prioridade
                          </span>
                        </div>
                        <div className="mt-3 flex justify-end">
                          <Button variant="ghost" size="sm" onClick={() => markAsSeen(`ticket:${ticket.id}`)}>
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

          {/* ── Configurações ───────────────────────────────────────────────── */}
          <TabsContent value="settings" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Configurações de Notificação</CardTitle>
                <CardDescription>
                  Salvas no Firebase — sincronizadas entre dispositivos
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">

                {/* ── EmailJS credentials ───────────────────────────────── */}
                <div className="space-y-3 rounded-lg border border-gray-200 bg-gray-50 p-4">
                  <h3 className="font-semibold text-gray-800">Credenciais EmailJS</h3>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <div>
                      <label className="mb-1 block text-xs font-medium text-gray-600">Service ID</label>
                      <Input
                        placeholder="service_xxxxxxx"
                        value={settings.emailjsServiceId}
                        onChange={(e) => setSettings({ ...settings, emailjsServiceId: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-gray-600">Template ID</label>
                      <Input
                        placeholder="template_xxxxxxx"
                        value={settings.emailjsTemplateId}
                        onChange={(e) => setSettings({ ...settings, emailjsTemplateId: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-gray-600">Public Key</label>
                      <Input
                        placeholder="sua_public_key"
                        value={settings.emailjsPublicKey}
                        onChange={(e) => setSettings({ ...settings, emailjsPublicKey: e.target.value })}
                      />
                    </div>
                  </div>
                  {emailjsConfigured && (
                    <p className="flex items-center gap-1 text-xs text-green-700">
                      <CheckCircle2 className="h-3 w-3" />
                      Credenciais preenchidas — envio habilitado.
                    </p>
                  )}
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium">E-mail para notificações *</label>
                  <Input
                    type="email"
                    placeholder="seu-email@exemplo.com"
                    value={settings.emailAddress}
                    onChange={(e) => setSettings({ ...settings, emailAddress: e.target.value })}
                  />
                </div>

                <div className="space-y-4">
                  <h3 className="font-semibold">Tipos de notificação</h3>

                  {[
                    {
                      key: 'notifyUpcomingVisits' as const,
                      label: 'Alertas de visitas próximas',
                      icon: <Calendar className="mr-2 inline h-4 w-4 text-blue-500" />,
                      bg: 'bg-blue-50',
                    },
                    {
                      key: 'notifyMaintenanceIssues' as const,
                      label: 'Alertas de manutenção',
                      icon: <AlertCircle className="mr-2 inline h-4 w-4 text-red-500" />,
                      bg: 'bg-red-50',
                    },
                    {
                      key: 'notifyMenuWorkflow' as const,
                      label: 'Alertas do fluxo de cardápios',
                      icon: <BookOpenCheck className="mr-2 inline h-4 w-4 text-amber-500" />,
                      bg: 'bg-amber-50',
                    },
                    {
                      key: 'notifyLowConformity' as const,
                      label: 'Alertas de baixa conformidade',
                      icon: <Bell className="mr-2 inline h-4 w-4 text-yellow-500" />,
                      bg: 'bg-yellow-50',
                    },
                  ].map(({ key, label, icon, bg }) => (
                    <div key={key} className={`flex items-start gap-3 rounded-lg ${bg} p-3`}>
                      <Checkbox
                        id={key}
                        checked={settings[key]}
                        onCheckedChange={(checked) =>
                          setSettings({ ...settings, [key]: checked as boolean })
                        }
                      />
                      <label htmlFor={key} className="cursor-pointer text-sm font-medium">
                        {icon}
                        {label}
                      </label>
                    </div>
                  ))}
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium">
                    Notificar visitas com antecedência (dias)
                  </label>
                  <Input
                    type="number"
                    min="1"
                    max="30"
                    value={settings.daysBeforeVisit}
                    onChange={(e) =>
                      setSettings({ ...settings, daysBeforeVisit: parseInt(e.target.value, 10) || 1 })
                    }
                    className="w-32"
                  />
                </div>

                <div className="flex gap-3">
                  <Button onClick={handleSaveSettings} disabled={isSavingSettings} className="gap-2">
                    {isSavingSettings ? 'Salvando…' : 'Salvar no Firebase'}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={handleSendTestEmail}
                    disabled={isSendingEmail || !emailjsConfigured || !settings.emailAddress}
                    title={
                      !emailjsConfigured
                        ? 'Preencha as credenciais EmailJS acima para habilitar'
                        : !settings.emailAddress
                          ? 'Preencha o e-mail de destino'
                          : 'Enviar resumo de alertas agora'
                    }
                    className="gap-2"
                  >
                    <Mail className="h-4 w-4" />
                    {isSendingEmail ? 'Enviando…' : 'Enviar e-mail de teste'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
