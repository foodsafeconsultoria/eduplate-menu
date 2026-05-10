import React, { useState, useRef, useEffect } from 'react';
import { useLocation } from 'wouter';
import { useAuth } from '@/contexts/AuthContext';
import { useMenus } from '@/hooks/useMenus';
import { useNotificationState } from '@/hooks/useNotificationState';
import { useSchedules } from '@/hooks/useFirestore';
import { useMaintenanceTickets } from '@/hooks/useMaintenanceTickets';
import { useDocuments } from '@/hooks/useDocuments';
import EduPlateLogo from '@/components/EduPlateLogo';
import {
  Apple, BarChart3, Bell, BookOpen, Calendar, CheckCircle,
  ClipboardCheck, ClipboardList, ClipboardMinus, Factory,
  FileBarChart2, FileText, GraduationCap, LayoutDashboard,
  LogOut, Menu, School, Shield, ShieldAlert, Trophy,
  User, Utensils, Wrench, X, ChevronDown,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ── Dropdown menu ─────────────────────────────────────────────────────────────

interface DropdownItem { label: string; href: string; icon: React.ReactNode; badge?: number }

function Dropdown({
  label, icon, items, badge, onNavigate,
}: {
  label: string;
  icon: React.ReactNode;
  items: DropdownItem[];
  badge?: number;
  onNavigate: () => void;
}) {
  const [location] = useLocation();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const isActive = items.some((i) => location === i.href);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className={cn(
          'flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium transition-all',
          isActive || open
            ? 'bg-white/12 text-white'
            : 'text-white/75 hover:bg-white/8 hover:text-white',
        )}
      >
        <span className="text-[#4caf50]">{icon}</span>
        <span>{label}</span>
        {badge ? (
          <span className="rounded-full bg-[#ff9800]/25 px-1.5 py-0.5 text-xs font-bold text-[#ffd08a]">
            {badge}
          </span>
        ) : null}
        <ChevronDown className={cn('h-3.5 w-3.5 text-white/40 transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1 w-52 rounded-2xl border border-white/10 bg-[#1b2a4a] shadow-2xl z-50 py-1.5 overflow-hidden">
          {items.map((item) => {
            const active = location === item.href;
            return (
              <a
                key={item.href}
                href={item.href}
                onClick={() => { setOpen(false); onNavigate(); }}
                className={cn(
                  'flex items-center gap-3 px-4 py-2.5 text-sm transition-colors',
                  active
                    ? 'bg-white/10 text-white font-semibold'
                    : 'text-white/70 hover:bg-white/8 hover:text-white',
                )}
              >
                <span className="text-[#4caf50]">{item.icon}</span>
                <span className="flex-1">{item.label}</span>
                {item.badge ? (
                  <span className="rounded-full bg-[#ff9800]/25 px-1.5 text-xs font-bold text-[#ffd08a]">
                    {item.badge}
                  </span>
                ) : null}
              </a>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── User menu ─────────────────────────────────────────────────────────────────

function UserMenu({ name, onLogout }: { name: string; onLogout: () => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-white/75 hover:bg-white/8 hover:text-white transition-all"
      >
        <div className="w-7 h-7 rounded-full bg-[#4caf50]/20 flex items-center justify-center">
          <User className="h-3.5 w-3.5 text-[#4caf50]" />
        </div>
        <span className="hidden lg:block max-w-28 truncate">{name.split(' ')[0]}</span>
        <ChevronDown className="h-3.5 w-3.5 text-white/40" />
      </button>

      {open && (
        <div className="absolute top-full right-0 mt-1 w-48 rounded-2xl border border-white/10 bg-[#1b2a4a] shadow-2xl z-50 py-1.5 overflow-hidden">
          <a
            href="/profile"
            onClick={() => setOpen(false)}
            className="flex items-center gap-3 px-4 py-2.5 text-sm text-white/70 hover:bg-white/8 hover:text-white transition-colors"
          >
            <User className="h-4 w-4 text-[#4caf50]" />
            Meu Perfil
          </a>
          <a
            href="/billing"
            onClick={() => setOpen(false)}
            className="flex items-center gap-3 px-4 py-2.5 text-sm text-white/70 hover:bg-white/8 hover:text-white transition-colors"
          >
            <FileText className="h-4 w-4 text-[#4caf50]" />
            Assinatura
          </a>
          <div className="my-1 border-t border-white/10" />
          <button
            onClick={() => { setOpen(false); onLogout(); }}
            className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-red-300 hover:bg-red-500/10 hover:text-red-200 transition-colors"
          >
            <LogOut className="h-4 w-4" />
            Sair
          </button>
        </div>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function TopNav() {
  const [location] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { user, logout } = useAuth();
  const { menus } = useMenus();
  const { schedules } = useSchedules();
  const { tickets } = useMaintenanceTickets();
  const { getExpiringDocuments } = useDocuments();
  const { isSeen } = useNotificationState(user?.uid);

  const currentUserName = user?.displayName?.trim() || '';
  const isAdmin = user?.role === 'admin';
  const canManageMenus = user?.role === 'admin' || user?.role === 'nutritionist';

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
  const expiringDocCount = getExpiringDocuments(30).filter(
    (d) => !isSeen(`doc:${d.id}:expiry`),
  ).length;
  const notificationsCount = workflowAlertCount + upcomingVisitsCount + maintenanceAlertCount + expiringDocCount;
  const fiscalizacaoBadge = upcomingVisitsCount + maintenanceAlertCount;

  const alimentacaoItems: DropdownItem[] = [
    { label: 'Alimentos',        href: '/nutrition/foods',         icon: <Apple className="h-4 w-4" /> },
    { label: 'Cardápios',        href: '/nutrition/menus',         icon: <ClipboardMinus className="h-4 w-4" />, badge: workflowAlertCount },
    { label: 'Fichas Técnicas',  href: '/nutrition/recipes',       icon: <BookOpen className="h-4 w-4" /> },
    { label: 'Dietas Especiais', href: '/nutrition/special-diets', icon: <ShieldAlert className="h-4 w-4" /> },
    { label: 'Produção',         href: '/nutrition/production',    icon: <Factory className="h-4 w-4" /> },
    { label: 'SIGPC',            href: '/nutrition/sigpc',         icon: <FileBarChart2 className="h-4 w-4" /> },
  ];

  const fiscalizacaoItems: DropdownItem[] = [
    { label: 'Inspeções',      href: '/inspection',    icon: <ClipboardCheck className="h-4 w-4" /> },
    { label: 'Gestão de EPIs', href: '/ppes',          icon: <Shield className="h-4 w-4" /> },
    { label: 'Cronograma',     href: '/schedule',      icon: <Calendar className="h-4 w-4" />, badge: upcomingVisitsCount },
    { label: 'Relatórios',     href: '/reports',       icon: <BarChart3 className="h-4 w-4" /> },
    { label: 'Escolas',        href: '/schools',       icon: <School className="h-4 w-4" /> },
    { label: 'Resto/Ingesta',  href: '/resto-ingesta', icon: <Utensils className="h-4 w-4" /> },
    { label: 'Aceitabilidade', href: '/acceptability', icon: <CheckCircle className="h-4 w-4" /> },
  ];

  const isTopActive = (href: string) => location === href;

  const topItem = (label: string, href: string, icon: React.ReactNode, badge?: number) => (
    <a
      key={href}
      href={href}
      onClick={() => setMobileOpen(false)}
      className={cn(
        'flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium transition-all',
        isTopActive(href)
          ? 'bg-white/12 text-white'
          : 'text-white/75 hover:bg-white/8 hover:text-white',
      )}
    >
      <span className="text-[#4caf50]">{icon}</span>
      <span>{label}</span>
      {badge ? (
        <span className="rounded-full bg-[#ff9800]/25 px-1.5 py-0.5 text-xs font-bold text-[#ffd08a]">{badge}</span>
      ) : null}
    </a>
  );

  return (
    <>
      {/* ── Desktop top nav ── */}
      <nav
        className="sticky top-0 z-40 hidden md:flex items-center gap-1 px-4 h-14 border-b border-white/10 shadow-lg overflow-visible"
        style={{ background: '#1B2A4A' }}
      >
        {/* Logo */}
        <a href="/" className="mr-4 shrink-0">
          <EduPlateLogo className="h-8 w-auto" markOnly />
        </a>

        {/* Nav items */}
        <div className="flex items-center gap-0.5 flex-1">
          {topItem('Dashboard', '/', <LayoutDashboard className="h-4 w-4" />)}

          <Dropdown
            label="Alimentação"
            icon={<Apple className="h-4 w-4" />}
            items={alimentacaoItems}
            badge={workflowAlertCount || undefined}
            onNavigate={() => setMobileOpen(false)}
          />

          <Dropdown
            label="Fiscalização"
            icon={<ClipboardList className="h-4 w-4" />}
            items={fiscalizacaoItems}
            badge={fiscalizacaoBadge || undefined}
            onNavigate={() => setMobileOpen(false)}
          />

          {topItem('Documentos',   '/documents',   <FileText className="h-4 w-4" />, expiringDocCount || undefined)}
          {topItem('Treinamentos', '/training',     <GraduationCap className="h-4 w-4" />)}
          {topItem('Certificados', '/certificates', <Trophy className="h-4 w-4" />)}
          {topItem('Manutenção',   '/maintenance',  <Wrench className="h-4 w-4" />, maintenanceAlertCount || undefined)}
        </div>

        {/* Right actions */}
        <div className="flex items-center gap-1 shrink-0 ml-2">
          <a
            href="/notifications"
            className={cn(
              'relative flex items-center justify-center w-9 h-9 rounded-xl transition-all',
              isTopActive('/notifications') ? 'bg-white/12 text-white' : 'text-white/70 hover:bg-white/8 hover:text-white',
            )}
          >
            <Bell className="h-4.5 w-4.5" />
            {notificationsCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-[#ff9800] text-white text-[10px] font-bold flex items-center justify-center">
                {notificationsCount}
              </span>
            )}
          </a>

          <UserMenu
            name={currentUserName || 'Usuário'}
            onLogout={logout}
          />
        </div>
      </nav>

      {/* ── Mobile top bar ── */}
      <div
        className="md:hidden fixed top-0 left-0 right-0 z-40 flex items-center justify-between px-4 h-14 border-b border-white/10"
        style={{ background: '#1B2A4A' }}
      >
        <a href="/">
          <EduPlateLogo className="h-7 w-auto" markOnly />
        </a>
        <div className="flex items-center gap-2">
          {notificationsCount > 0 && (
            <a href="/notifications" className="relative w-9 h-9 flex items-center justify-center text-white/70">
              <Bell className="h-5 w-5" />
              <span className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-[#ff9800] text-white text-[10px] font-bold flex items-center justify-center">
                {notificationsCount}
              </span>
            </a>
          )}
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="rounded-xl bg-white/8 p-2 text-white"
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* ── Mobile drawer ── */}
      {mobileOpen && (
        <div className="fixed inset-0 z-30 md:hidden" onClick={() => setMobileOpen(false)}>
          <div
            className="absolute top-14 left-0 right-0 bottom-0 overflow-y-auto py-3 px-3 space-y-1"
            style={{ background: '#1B2A4A' }}
            onClick={(e) => e.stopPropagation()}
          >
            {topItem('Dashboard',    '/',             <LayoutDashboard className="h-5 w-5" />)}
            <div className="py-1 px-4 text-xs font-semibold text-white/30 uppercase tracking-widest">Alimentação</div>
            {alimentacaoItems.map(i => topItem(i.label, i.href, i.icon, i.badge))}
            <div className="py-1 px-4 text-xs font-semibold text-white/30 uppercase tracking-widest">Fiscalização</div>
            {fiscalizacaoItems.map(i => topItem(i.label, i.href, i.icon, i.badge))}
            <div className="py-1 px-4 text-xs font-semibold text-white/30 uppercase tracking-widest">Outros</div>
            {topItem('Documentos',   '/documents',   <FileText className="h-5 w-5" />, expiringDocCount || undefined)}
            {topItem('Treinamentos', '/training',     <GraduationCap className="h-5 w-5" />)}
            {topItem('Certificados', '/certificates', <Trophy className="h-5 w-5" />)}
            {topItem('Manutenção',   '/maintenance',  <Wrench className="h-5 w-5" />, maintenanceAlertCount || undefined)}
            {topItem('Notificações', '/notifications',<Bell className="h-5 w-5" />, notificationsCount || undefined)}
            {topItem('Meu Perfil',   '/profile',      <User className="h-5 w-5" />)}
            <div className="border-t border-white/10 pt-2 mt-2">
              <button
                onClick={() => { setMobileOpen(false); logout(); }}
                className="flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium text-red-300 hover:bg-red-500/10"
              >
                <LogOut className="h-5 w-5" />
                Sair do Sistema
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mobile spacer */}
      <div className="h-14 md:hidden" />
    </>
  );
}
