import { useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useAcceptabilityRecords } from '@/hooks/useAcceptabilityRecords';
import { useMenus } from '@/hooks/useMenus';
import { useNotificationState } from '@/hooks/useNotificationState';
import { useProductionLogs } from '@/hooks/useProductionLogs';
import { useRecipes } from '@/hooks/useRecipes';
import { useRestoIngestaRecords } from '@/hooks/useRestoIngestaRecords';
import { useSchools, useInspections, useSchedules } from '@/hooks/useFirestore';
import { useMaintenanceTickets } from '@/hooks/useMaintenanceTickets';
import { useSpecialDiets } from '@/hooks/useSpecialDiets';

// ── KPI Card ──────────────────────────────────────────────────────────────────

function KpiCard({
  label,
  value,
  sub,
  tone = 'default',
}: {
  label: string;
  value: string | number;
  sub?: string;
  tone?: 'default' | 'green' | 'red' | 'amber';
}) {
  const valueColor =
    tone === 'green'
      ? 'text-green-600'
      : tone === 'red'
      ? 'text-red-600'
      : tone === 'amber'
      ? 'text-amber-600'
      : 'text-gray-900';

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
      <p className="text-xs text-gray-400 uppercase tracking-wider font-medium mb-2">{label}</p>
      <p className={`text-3xl font-semibold ${valueColor}`}>{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  );
}

// ── Alert Pill ────────────────────────────────────────────────────────────────

function AlertPill({
  count,
  label,
  tone,
}: {
  count: number;
  label: string;
  tone: 'amber' | 'blue' | 'red';
}) {
  const colors = {
    amber: 'bg-amber-50 text-amber-700 border-amber-100',
    blue:  'bg-blue-50  text-blue-700  border-blue-100',
    red:   'bg-red-50   text-red-700   border-red-100',
  }[tone];

  const dot = {
    amber: 'bg-amber-400',
    blue:  'bg-blue-400',
    red:   'bg-red-400',
  }[tone];

  return (
    <div className={`flex items-center gap-2.5 rounded-xl border px-4 py-3 ${colors}`}>
      <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${dot}`} />
      <p className="flex-1 text-sm font-medium">{label}</p>
      <span className={`text-xs font-bold tabular-nums ${colors.split(' ')[1]}`}>{count}</span>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function Dashboard() {
  const { user } = useAuth();
  const { isSeen } = useNotificationState(user?.uid);
  const { schools } = useSchools();
  const { inspections } = useInspections();
  const { schedules } = useSchedules();
  const { recipes } = useRecipes();
  const { menus } = useMenus();
  const { tickets } = useMaintenanceTickets();
  const { specialDiets } = useSpecialDiets();
  const { productionLogs } = useProductionLogs();
  const { records: acceptabilityRecords } = useAcceptabilityRecords();
  const { records: restoRecords } = useRestoIngestaRecords();

  const firstName = user?.displayName?.split(' ')[0] || '';

  const averageInspectionScore = useMemo(() => {
    if (inspections.length === 0) return 0;
    return inspections.reduce((sum, i) => sum + (i.overallScore || 0), 0) / inspections.length;
  }, [inspections]);

  const averageAcceptance = useMemo(() => {
    if (acceptabilityRecords.length === 0) return null;
    return acceptabilityRecords.reduce((sum, i) => sum + i.percentualAprovacao, 0) / acceptabilityRecords.length;
  }, [acceptabilityRecords]);

  const averageWaste = useMemo(() => {
    if (restoRecords.length === 0) return null;
    return restoRecords.reduce((sum, i) => sum + i.percentual, 0) / restoRecords.length;
  }, [restoRecords]);

  const familyFarmShare = useMemo(() => {
    if (menus.length === 0) return 0;
    return menus.reduce((sum, m) => sum + m.familyFarmShare, 0) / menus.length;
  }, [menus]);

  const menuAlertCount = useMemo(() => menus.reduce((s, m) => s + m.complianceAlerts.length, 0), [menus]);

  const currentUserName = user?.displayName?.trim() || '';
  const isAdmin = user?.role === 'admin';
  const canManageMenus = user?.role === 'admin' || user?.role === 'nutritionist' || user?.role === 'nutricionista';

  const workflowAlertCount = useMemo(
    () =>
      menus.filter((menu) => {
        if (menu.status === 'draft')
          return !isSeen(`menu:${menu.id}:draft`) && canManageMenus && menu.complianceAlerts.length > 0 && (isAdmin || menu.responsibleName === currentUserName);
        if (menu.status === 'under_review')
          return !isSeen(`menu:${menu.id}:under_review`) && (isAdmin || menu.reviewerName === currentUserName || menu.responsibleName === currentUserName);
        if (menu.status === 'approved')
          return !isSeen(`menu:${menu.id}:approved`) && isAdmin;
        return false;
      }).length,
    [menus, canManageMenus, currentUserName, isAdmin, isSeen],
  );

  const upcomingVisitsCount = useMemo(
    () => schedules.filter((s) => s.status === 'pending' && !isSeen(`schedule:${s.id}`)).length,
    [schedules, isSeen],
  );

  const maintenanceAlertCount = useMemo(
    () => tickets.filter((t) => t.status === 'open' && t.priority === 'high' && !isSeen(`ticket:${t.id}`)).length,
    [tickets, isSeen],
  );

  const totalAlerts = workflowAlertCount + upcomingVisitsCount + maintenanceAlertCount;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 md:px-10 py-6 md:py-10 space-y-8">

        {/* Header */}
        <div className="flex items-end justify-between">
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-widest mb-1">Visão geral</p>
            <h1 className="text-2xl font-semibold text-gray-900">
              {firstName ? `Olá, ${firstName}` : 'Dashboard'}
            </h1>
          </div>
          {totalAlerts > 0 && (
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold bg-red-50 text-red-600 border border-red-100 px-3 py-1.5 rounded-full">
              <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
              {totalAlerts} alerta{totalAlerts !== 1 ? 's' : ''}
            </span>
          )}
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KpiCard
            label="Escolas"
            value={schools.length}
            sub="Unidades cadastradas"
          />
          <KpiCard
            label="Cardápios"
            value={menus.length}
            sub={menuAlertCount > 0 ? `${menuAlertCount} alerta${menuAlertCount !== 1 ? 's' : ''}` : 'Sem alertas'}
            tone={menuAlertCount > 0 ? 'amber' : 'default'}
          />
          <KpiCard
            label="Aceitabilidade"
            value={averageAcceptance === null ? '—' : `${averageAcceptance.toFixed(1)}%`}
            sub={averageAcceptance === null ? 'Sem registros' : 'Meta FNDE: 85%'}
            tone={averageAcceptance === null ? 'default' : averageAcceptance >= 85 ? 'green' : 'red'}
          />
          <KpiCard
            label="Desperdício"
            value={averageWaste === null ? '—' : `${averageWaste.toFixed(1)}%`}
            sub={averageWaste === null ? 'Sem registros' : 'Resto-ingesta médio'}
            tone={averageWaste === null ? 'default' : averageWaste > 10 ? 'red' : 'green'}
          />
        </div>

        {/* Alerts */}
        {totalAlerts > 0 && (
          <div className="space-y-2">
            <p className="text-xs text-gray-400 uppercase tracking-widest">Pendências</p>
            <div className="grid gap-2 md:grid-cols-3">
              {workflowAlertCount > 0 && (
                <AlertPill count={workflowAlertCount} label="Cardápios aguardando ação" tone="amber" />
              )}
              {upcomingVisitsCount > 0 && (
                <AlertPill count={upcomingVisitsCount} label="Visitas pendentes" tone="blue" />
              )}
              {maintenanceAlertCount > 0 && (
                <AlertPill count={maintenanceAlertCount} label="Manutenção crítica" tone="red" />
              )}
            </div>
          </div>
        )}

        {/* Indicators */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">

          {/* Agricultura familiar */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <p className="text-xs text-gray-400 uppercase tracking-widest mb-3">Agricultura familiar</p>
            <div className="flex items-baseline gap-2 mb-3">
              <span className={`text-3xl font-semibold ${familyFarmShare >= 45 ? 'text-green-600' : 'text-amber-600'}`}>
                {familyFarmShare.toFixed(0)}%
              </span>
              <span className="text-sm text-gray-400">média</span>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-1 mb-2.5">
              <div
                className={`h-1 rounded-full ${familyFarmShare >= 45 ? 'bg-green-500' : 'bg-amber-400'}`}
                style={{ width: `${Math.min(familyFarmShare, 100)}%` }}
              />
            </div>
            <p className="text-xs text-gray-400">Meta mínima: 45% (Resolução FNDE nº 06/2020 — vigência 2026)</p>
          </div>

          {/* Conformidade das visitas */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <p className="text-xs text-gray-400 uppercase tracking-widest mb-3">Conformidade das visitas</p>
            <div className="flex items-baseline gap-2 mb-3">
              <span className={`text-3xl font-semibold ${averageInspectionScore >= 80 ? 'text-green-600' : 'text-orange-500'}`}>
                {inspections.length === 0 ? '—' : `${averageInspectionScore.toFixed(1)}%`}
              </span>
              {inspections.length > 0 && <span className="text-sm text-gray-400">média</span>}
            </div>
            {inspections.length > 0 && (
              <div className="w-full bg-gray-100 rounded-full h-1 mb-2.5">
                <div
                  className={`h-1 rounded-full ${averageInspectionScore >= 80 ? 'bg-green-500' : 'bg-orange-400'}`}
                  style={{ width: `${Math.min(averageInspectionScore, 100)}%` }}
                />
              </div>
            )}
            <p className="text-xs text-gray-400">
              {inspections.length === 0
                ? 'Nenhuma visita registrada'
                : `${new Set(inspections.map((i) => i.schoolId)).size} escola${new Set(inspections.map((i) => i.schoolId)).size !== 1 ? 's' : ''} visitada${new Set(inspections.map((i) => i.schoolId)).size !== 1 ? 's' : ''}`}
            </p>
          </div>

          {/* Cadastros */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <p className="text-xs text-gray-400 uppercase tracking-widest mb-3">Cadastros</p>
            <div className="space-y-3">
              {[
                { label: 'Fichas técnicas', value: recipes.length },
                { label: 'Dietas especiais ativas', value: specialDiets.filter((d) => d.status === 'active').length },
                { label: 'Registros de produção', value: productionLogs.length },
              ].map(({ label, value }) => (
                <div key={label} className="flex items-center justify-between">
                  <p className="text-sm text-gray-500">{label}</p>
                  <p className="text-sm font-semibold text-gray-900 tabular-nums">{value}</p>
                </div>
              ))}
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}
