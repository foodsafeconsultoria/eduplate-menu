import React, { useState } from 'react';
import { useLocation } from 'wouter';
import { useAuth } from '@/contexts/AuthContext';
import { useMenus } from '@/hooks/useMenus';
import { useNotificationState } from '@/hooks/useNotificationState';
import { useSchedules } from '@/hooks/useFirestore';
import { useMaintenanceTickets } from '@/hooks/useMaintenanceTickets';
import BrandLogo from '@/components/BrandLogo';
import {
  Apple,
  Bell,
  BookOpen,
  Calendar,
  CheckCircle,
  ChevronDown,
  ChevronRight,
  ClipboardCheck,
  ClipboardList,
  ClipboardMinus,
  Factory,
  FileBarChart2,
  GraduationCap,
  LayoutDashboard,
  LogOut,
  Menu,
  School,
  Shield,
  ShieldAlert,
  Trophy,
  User,
  Utensils,
  Wrench,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ── Types ────────────────────────────────────────────────────────────────────

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
  badge?: number;
}

interface NavGroup {
  label: string;
  /** Base path — used to auto-expand when current location starts with it. */
  basePath: string;
  icon: React.ReactNode;
  badge?: number;
  children: NavItem[];
}

type NavEntry = { kind: 'item'; item: NavItem } | { kind: 'group'; group: NavGroup };

// ── Static nav structure ─────────────────────────────────────────────────────

const alimentacaoChildren: NavItem[] = [
  { label: 'Alimentos',       href: '/nutrition/foods',         icon: <Apple className="h-4 w-4" /> },
  { label: 'Cardápios',       href: '/nutrition/menus',         icon: <ClipboardMinus className="h-4 w-4" /> },
  { label: 'Fichas Técnicas', href: '/nutrition/recipes',       icon: <BookOpen className="h-4 w-4" /> },
  { label: 'Dietas Especiais',href: '/nutrition/special-diets', icon: <ShieldAlert className="h-4 w-4" /> },
  { label: 'Produção',        href: '/nutrition/production',    icon: <Factory className="h-4 w-4" /> },
  { label: 'SIGPC',          href: '/nutrition/sigpc',          icon: <FileBarChart2 className="h-4 w-4" /> },
];

const fiscalizacaoChildren: NavItem[] = [
  { label: 'Inspeções',      href: '/inspection',     icon: <ClipboardCheck className="h-4 w-4" /> },
  { label: 'Gestão de EPIs', href: '/ppes',           icon: <Shield className="h-4 w-4" /> },
  { label: 'Cronograma',     href: '/schedule',       icon: <Calendar className="h-4 w-4" /> },
  { label: 'Escolas',        href: '/schools',        icon: <School className="h-4 w-4" /> },
  { label: 'Resto/Ingesta',  href: '/resto-ingesta',  icon: <Utensils className="h-4 w-4" /> },
  { label: 'Aceitabilidade', href: '/acceptability',  icon: <CheckCircle className="h-4 w-4" /> },
];

// ── Component ────────────────────────────────────────────────────────────────

export default function Sidebar() {
  const [location] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  // Groups are auto-expanded when location is inside them; user can also toggle manually
  const isInsideAlimentacao = location.startsWith('/nutrition');
  const isInsideFiscalizacao =
    location === '/inspection' ||
    location === '/ppes' ||
    location === '/schedule' ||
    location === '/schools' ||
    location === '/resto-ingesta' ||
    location === '/acceptability';

  const [alimentacaoOpen, setAlimentacaoOpen] = useState(isInsideAlimentacao);
  const [fiscalizacaoOpen, setFiscalizacaoOpen] = useState(isInsideFiscalizacao);

  const { user, logout } = useAuth();
  const { menus } = useMenus();
  const { schedules } = useSchedules();
  const { tickets } = useMaintenanceTickets();
  const { isSeen } = useNotificationState(user?.uid);

  const currentUserName = user?.displayName?.trim() || '';
  const isAdmin = user?.role === 'admin';
  const canManageMenus = user?.role === 'admin' || user?.role === 'nutritionist';

  // ── Badge counts ─────────────────────────────────────────────────────────

  const workflowAlertCount = menus.filter((menu) => {
    let alertId = '';
    if (menu.status === 'draft') {
      alertId = `menu:${menu.id}:draft`;
      return !isSeen(alertId) && canManageMenus && menu.complianceAlerts.length > 0 && (isAdmin || menu.responsibleName === currentUserName);
    }
    if (menu.status === 'under_review') {
      alertId = `menu:${menu.id}:under_review`;
      return !isSeen(alertId) && (isAdmin || menu.reviewerName === currentUserName || menu.responsibleName === currentUserName);
    }
    if (menu.status === 'approved') {
      alertId = `menu:${menu.id}:approved`;
      return !isSeen(alertId) && isAdmin;
    }
    return false;
  }).length;

  const upcomingVisitsCount = schedules.filter(
    (s) => s.status === 'pending' && !isSeen(`schedule:${s.id}`),
  ).length;

  const maintenanceAlertCount = tickets.filter(
    (t) => t.status === 'open' && t.priority === 'high' && !isSeen(`ticket:${t.id}`),
  ).length;

  const notificationsCount = workflowAlertCount + upcomingVisitsCount + maintenanceAlertCount;

  const fiscalizacaoBadge = upcomingVisitsCount + maintenanceAlertCount;

  // ── Render helpers ────────────────────────────────────────────────────────

  const Badge = ({ count }: { count: number }) =>
    count > 0 ? (
      <span className="min-w-6 rounded-full bg-[#ff9800]/20 px-2 py-0.5 text-center text-xs font-semibold text-[#ffd08a]">
        {count}
      </span>
    ) : null;

  const ActiveBadge = ({ count }: { count: number }) =>
    count > 0 ? (
      <span className="min-w-6 rounded-full bg-white/16 px-2 py-0.5 text-center text-xs font-semibold text-white">
        {count}
      </span>
    ) : null;

  const renderItem = (item: NavItem) => {
    const isActive = location === item.href;
    return (
      <a
        key={item.href}
        href={item.href}
        onClick={() => setMobileOpen(false)}
        className={cn(
          'group flex items-center gap-3 rounded-2xl px-4 py-2.5 font-medium transition-all',
          isActive
            ? 'bg-white/10 text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]'
            : 'text-white/75 hover:bg-white/8 hover:text-white',
        )}
      >
        <span className="text-[#4caf50] transition-transform group-hover:scale-105">{item.icon}</span>
        <span className="flex-1 text-sm">{item.label}</span>
        {isActive ? <ActiveBadge count={item.badge ?? 0} /> : <Badge count={item.badge ?? 0} />}
      </a>
    );
  };

  const renderGroup = (
    label: string,
    icon: React.ReactNode,
    children: NavItem[],
    isOpen: boolean,
    toggle: () => void,
    badge: number,
  ) => {
    const anyChildActive = children.some((c) => location === c.href);
    return (
      <div>
        <button
          onClick={toggle}
          className={cn(
            'group flex w-full items-center gap-3 rounded-2xl px-4 py-3 font-medium transition-all',
            anyChildActive
              ? 'bg-white/10 text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]'
              : 'text-white/80 hover:bg-white/8 hover:text-white',
          )}
        >
          <span className="text-[#4caf50] transition-transform group-hover:scale-105">{icon}</span>
          <span className="flex-1 text-left">{label}</span>
          {badge > 0 && !isOpen && <Badge count={badge} />}
          {isOpen ? (
            <ChevronDown className="h-4 w-4 text-white/50" />
          ) : (
            <ChevronRight className="h-4 w-4 text-white/50" />
          )}
        </button>
        {isOpen && (
          <div className="mt-0.5 ml-4 space-y-0.5 border-l border-white/10 pl-3">
            {children.map(renderItem)}
          </div>
        )}
      </div>
    );
  };

  const renderTopLevelItem = (label: string, href: string, icon: React.ReactNode, badge: number) => {
    const isActive = location === href;
    return (
      <a
        key={href}
        href={href}
        onClick={() => setMobileOpen(false)}
        className={cn(
          'group flex items-center gap-3 rounded-2xl px-4 py-3 font-medium transition-all',
          isActive
            ? 'bg-white/10 text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]'
            : 'text-white/80 hover:bg-white/8 hover:text-white',
        )}
      >
        <span className="text-[#4caf50] transition-transform group-hover:scale-105">{icon}</span>
        <span className="flex-1">{label}</span>
        {isActive ? <ActiveBadge count={badge} /> : <Badge count={badge} />}
      </a>
    );
  };

  const NavContent = () => (
    <>
      <div className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        {/* Dashboard */}
        {renderTopLevelItem('Dashboard', '/', <LayoutDashboard className="h-5 w-5" />, 0)}

        {/* Alimentação Escolar (group) */}
        {renderGroup(
          'Alimentação Escolar',
          <Apple className="h-5 w-5" />,
          alimentacaoChildren.map((c) =>
            c.href === '/nutrition/menus' ? { ...c, badge: workflowAlertCount } : c,
          ),
          alimentacaoOpen,
          () => setAlimentacaoOpen((o) => !o),
          workflowAlertCount,
        )}

        {/* Fiscalização (group) */}
        {renderGroup(
          'Fiscalização',
          <ClipboardList className="h-5 w-5" />,
          fiscalizacaoChildren.map((c) => {
            if (c.href === '/schedule') return { ...c, badge: upcomingVisitsCount };
            if (c.href === '/maintenance') return { ...c, badge: maintenanceAlertCount };
            return c;
          }),
          fiscalizacaoOpen,
          () => setFiscalizacaoOpen((o) => !o),
          fiscalizacaoBadge,
        )}

        {/* Remaining top-level items */}
        {renderTopLevelItem('Manutenção',   '/maintenance',  <Wrench className="h-5 w-5" />,       maintenanceAlertCount)}
        {renderTopLevelItem('Certificados', '/certificates', <Trophy className="h-5 w-5" />,       0)}
        {renderTopLevelItem('Treinamentos', '/training',     <GraduationCap className="h-5 w-5" />, 0)}
        {renderTopLevelItem('Notificações', '/notifications',<Bell className="h-5 w-5" />,         notificationsCount)}
        {renderTopLevelItem('Meu Perfil',   '/profile',      <User className="h-5 w-5" />,          0)}
      </div>

      <div className="border-t border-white/10 p-4">
        <div className="mb-4 rounded-2xl border border-white/10 bg-white/6 px-4 py-3 text-center">
          <p className="text-sm font-semibold text-white">Gestão integrada do PNAE</p>
          <p className="mt-1 text-xs text-white/65">Cardápio, fiscalização, visitas e qualidade em um sistema único.</p>
        </div>
        <button
          onClick={() => logout()}
          className="flex w-full items-center gap-3 rounded-2xl px-4 py-3 font-medium text-red-200 transition-colors hover:bg-red-500/10 hover:text-red-100"
        >
          <LogOut className="h-5 w-5" />
          <span>Sair do Sistema</span>
        </button>
      </div>
    </>
  );

  return (
    <>
      <aside className="brand-hero hidden h-screen w-72 flex-col border-r border-white/8 shadow-[25px_0_60px_-45px_rgba(27,42,74,0.75)] md:flex sticky top-0 shrink-0 overflow-y-auto">
        <div className="border-b border-white/10 px-6 py-6">
          <BrandLogo />
        </div>
        <NavContent />
      </aside>

      {/* Mobile top bar */}
      <div className="brand-hero fixed left-0 top-0 right-0 z-40 flex items-center justify-between border-b border-white/10 px-4 py-3 md:hidden">
        <BrandLogo compact />
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="rounded-2xl bg-white/8 p-2 text-white transition-colors hover:bg-white/12"
        >
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-30 bg-black/50 md:hidden">
          <div className="brand-hero fixed left-0 top-0 bottom-0 flex w-72 flex-col pt-16">
            <NavContent />
          </div>
        </div>
      )}

      <div className="h-16 md:hidden" />
    </>
  );
}
