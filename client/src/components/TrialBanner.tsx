import { useLocation } from 'wouter';
import { AlertTriangle, Rocket, CreditCard, X } from 'lucide-react';
import { useState } from 'react';
import { useSubscription } from '@/hooks/useSubscription';
import { useAuth } from '@/contexts/AuthContext';
import { apiUrl, authHeaders } from '@/lib/apiUrl';

/**
 * Shows a persistent banner when the org is on trial or has payment issues.
 * Renders nothing for active subscriptions.
 */
export default function TrialBanner() {
  const { status, trialDaysLeft, isTrialExpired, isPastDue, loading } = useSubscription();
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const [dismissed, setDismissed] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState(false);

  if (loading || dismissed) return null;
  if (status === 'active') return null;

  const handleSubscribe = async () => {
    if (!user?.organizationId) { navigate('/planos'); return; }
    setCheckoutLoading(true);
    try {
      const res = await fetch(apiUrl('/api/stripe/checkout-subscribe'), {
        method: 'POST',
        headers: await authHeaders(),
        body: JSON.stringify({ orgId: user.organizationId, plan: 'essencial' }),
      });
      const data = await res.json();
      if (data.url) { window.location.href = data.url; }
      else { navigate('/planos'); }
    } catch {
      navigate('/planos');
    } finally {
      setCheckoutLoading(false);
    }
  };

  // ── Trial expirado ou pagamento pendente — urgente, não dispensável ──────────
  if (isTrialExpired || isPastDue) {
    return (
      <div className="bg-red-600 text-white px-4 py-3 flex items-center justify-between gap-4 text-sm">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>
            {isPastDue
              ? 'Pagamento pendente — o acesso será suspenso em breve.'
              : 'Período de avaliação encerrado.'}
            {' '}Assine para continuar usando o sistema.
          </span>
        </div>
        <button
          onClick={handleSubscribe}
          disabled={checkoutLoading}
          className="shrink-0 bg-white text-red-600 font-semibold text-xs px-4 py-1.5 rounded-full hover:bg-red-50 transition-colors disabled:opacity-60"
        >
          {checkoutLoading ? 'Aguarde...' : 'Assinar agora'}
        </button>
      </div>
    );
  }

  // ── Trial ativo ──────────────────────────────────────────────────────────────
  if (status === 'trial') {
    const urgent = trialDaysLeft <= 7;
    const critical = trialDaysLeft <= 3;

    if (urgent) {
      return (
        <div className={`${critical ? 'bg-red-500' : 'bg-amber-500'} text-white px-4 py-2.5 flex items-center justify-between gap-4 text-sm`}>
          <div className="flex items-center gap-2">
            <CreditCard className="w-4 h-4 shrink-0" />
            <span>
              <strong>
                {trialDaysLeft > 0
                  ? `${trialDaysLeft} dia${trialDaysLeft !== 1 ? 's' : ''} para o fim do trial`
                  : 'Último dia de avaliação'}
              </strong>
              {' '}— adicione seu cartão para não perder o acesso.
            </span>
          </div>
          <button
            onClick={handleSubscribe}
            disabled={checkoutLoading}
            className="shrink-0 bg-white text-amber-700 font-semibold text-xs px-4 py-1.5 rounded-full hover:bg-amber-50 transition-colors disabled:opacity-60"
          >
            {checkoutLoading ? 'Aguarde...' : 'Adicionar cartão'}
          </button>
        </div>
      );
    }

    return (
      <div className="bg-green-700 text-white px-4 py-2.5 flex items-center justify-between gap-4 text-sm">
        <div className="flex items-center gap-2">
          <Rocket className="w-4 h-4 shrink-0" />
          <span>
            {trialDaysLeft > 0
              ? `Trial gratuito: ${trialDaysLeft} dia${trialDaysLeft !== 1 ? 's' : ''} restante${trialDaysLeft !== 1 ? 's' : ''}.`
              : 'Último dia de avaliação.'}
            {' '}Explore à vontade — sem cartão agora.
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => navigate('/planos')}
            className="bg-white text-green-800 font-semibold text-xs px-4 py-1.5 rounded-full hover:bg-green-50 transition-colors"
          >
            Ver planos
          </button>
          <button onClick={() => setDismissed(true)} className="opacity-60 hover:opacity-100 transition-opacity">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  return null;
}
