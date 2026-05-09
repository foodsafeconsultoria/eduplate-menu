import { useEffect, useState } from 'react';
import { useLocation, useSearch } from 'wouter';
import { CreditCard, CheckCircle2, AlertCircle, Clock, XCircle, ExternalLink, Zap } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { useSubscription } from '@/hooks/useSubscription';

const PLAN_LABELS: Record<string, string> = {
  essencial: 'Básico',
  pro: 'Profissional',
  enterprise: 'Consórcio',
};

const PLAN_PRICES: Record<string, string> = {
  essencial: 'R$ 49,90/mês',
  pro: 'R$ 99/mês',
  enterprise: 'R$ 399/mês',
};

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
    active:    { label: 'Ativa',             color: 'bg-green-100 text-green-800',  icon: <CheckCircle2 className="w-3.5 h-3.5" /> },
    trial:     { label: 'Avaliação',         color: 'bg-blue-100 text-blue-800',    icon: <Clock className="w-3.5 h-3.5" /> },
    past_due:  { label: 'Pagamento pendente', color: 'bg-amber-100 text-amber-800', icon: <AlertCircle className="w-3.5 h-3.5" /> },
    canceled:  { label: 'Cancelada',         color: 'bg-red-100 text-red-700',      icon: <XCircle className="w-3.5 h-3.5" /> },
    unknown:   { label: 'Desconhecido',      color: 'bg-gray-100 text-gray-600',    icon: null },
  };
  const s = map[status] || map.unknown;
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full ${s.color}`}>
      {s.icon}{s.label}
    </span>
  );
}

export default function Billing() {
  const { user } = useAuth();
  const { status, plan, trialEndsAt, trialDaysLeft, isTrialExpired, loading } = useSubscription();
  const [, navigate] = useLocation();
  const search = useSearch();
  const [portalLoading, setPortalLoading] = useState(false);

  // Show success toast when returning from Stripe Checkout
  useEffect(() => {
    if (search.includes('status=success')) {
      toast.success('Assinatura ativada! Bem-vindo(a) ao Sistema PNAE.');
    }
  }, [search]);

  const openPortal = async () => {
    if (!user?.organizationId) return;
    try {
      setPortalLoading(true);
      const res = await fetch('/api/stripe/portal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orgId: user.organizationId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      if (data.url) window.location.href = data.url;
    } catch (err: any) {
      toast.error(err.message || 'Erro ao abrir portal de faturamento.');
    } finally {
      setPortalLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-10 px-4">
      <div className="max-w-2xl mx-auto space-y-6">

        <div>
          <h1 className="text-2xl font-bold text-gray-900">Assinatura e faturamento</h1>
          <p className="text-gray-500 text-sm mt-1">Gerencie seu plano, método de pagamento e histórico de faturas.</p>
        </div>

        {/* Current plan card */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Plano atual</p>
              <div className="flex items-center gap-3">
                <h2 className="text-xl font-bold text-gray-900">
                  {plan ? PLAN_LABELS[plan] : 'Avaliação Gratuita'}
                </h2>
                <StatusBadge status={status} />
              </div>
              {plan && (
                <p className="text-gray-500 text-sm mt-1">{PLAN_PRICES[plan]}</p>
              )}
              {status === 'trial' && (
                <p className="text-sm mt-2">
                  {isTrialExpired ? (
                    <span className="text-red-600 font-medium">Período de avaliação encerrado.</span>
                  ) : (
                    <span className="text-gray-600">
                      <span className="font-semibold text-blue-700">{trialDaysLeft} dia{trialDaysLeft !== 1 ? 's' : ''}</span>{' '}
                      restante{trialDaysLeft !== 1 ? 's' : ''} de avaliação
                      {trialEndsAt && (
                        <span className="text-gray-400">
                          {' '}(até {trialEndsAt.toLocaleDateString('pt-BR')})
                        </span>
                      )}
                    </span>
                  )}
                </p>
              )}
              {status === 'past_due' && (
                <p className="text-sm text-amber-700 mt-2 font-medium">
                  Há uma fatura em aberto. Regularize para evitar interrupção do serviço.
                </p>
              )}
            </div>
            <CreditCard className="w-8 h-8 text-gray-300 shrink-0 mt-1" />
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            {status !== 'active' && (
              <button
                onClick={() => navigate('/planos')}
                className="flex items-center gap-2 bg-green-600 text-white px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-green-700 transition-colors"
              >
                <Zap className="w-4 h-4" />
                {status === 'trial' ? 'Assinar agora' : 'Ver planos'}
              </button>
            )}
            {status === 'active' && (
              <button
                onClick={openPortal}
                disabled={portalLoading}
                className="flex items-center gap-2 bg-gray-900 text-white px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-gray-800 transition-colors disabled:opacity-60"
              >
                <ExternalLink className="w-4 h-4" />
                {portalLoading ? 'Aguarde…' : 'Gerenciar assinatura'}
              </button>
            )}
            {status === 'past_due' && (
              <button
                onClick={openPortal}
                disabled={portalLoading}
                className="flex items-center gap-2 bg-amber-600 text-white px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-amber-700 transition-colors disabled:opacity-60"
              >
                <ExternalLink className="w-4 h-4" />
                {portalLoading ? 'Aguarde…' : 'Regularizar pagamento'}
              </button>
            )}
          </div>
        </div>

        {/* What's included */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <h3 className="font-semibold text-gray-900 mb-4">O que está incluso</h3>
          <div className="grid grid-cols-2 gap-2 text-sm text-gray-600">
            {[
              'Cardápios e fichas técnicas',
              'Controle de dietas especiais',
              'Registro de produção',
              'Aceitabilidade e restos-ingestão',
              'Fiscalização de escolas',
              'Treinamentos com certificado',
              'Relatórios SIGPC/FNDE',
              'Backups automáticos diários',
            ].map((item) => (
              <div key={item} className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 bg-green-500 rounded-full shrink-0" />
                {item}
              </div>
            ))}
          </div>
        </div>

        {/* Help */}
        <p className="text-center text-xs text-gray-400">
          Dúvidas sobre faturamento?{' '}
          <a href="mailto:contato@sistema-pnae.com.br" className="text-green-700 underline">
            contato@sistema-pnae.com.br
          </a>
        </p>

      </div>
    </div>
  );
}
