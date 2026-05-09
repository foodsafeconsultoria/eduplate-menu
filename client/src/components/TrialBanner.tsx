import { useLocation } from 'wouter';
import { AlertTriangle, Rocket, X } from 'lucide-react';
import { useState } from 'react';
import { useSubscription } from '@/hooks/useSubscription';

/**
 * Shows a persistent banner when the org is on trial or has payment issues.
 * Renders nothing for active subscriptions.
 */
export default function TrialBanner() {
  const { status, trialDaysLeft, isTrialExpired, isPastDue, loading } = useSubscription();
  const [, navigate] = useLocation();
  const [dismissed, setDismissed] = useState(false);

  if (loading || dismissed) return null;

  // Active subscription — no banner needed
  if (status === 'active') return null;

  // ── Trial expired or payment failed → urgent, non-dismissible ──────────────
  if (isTrialExpired || isPastDue) {
    return (
      <div className="bg-red-600 text-white px-4 py-3 flex items-center justify-between gap-4 text-sm">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>
            {isPastDue
              ? 'Pagamento pendente — o acesso será suspenso em breve.'
              : 'Período de avaliação encerrado.'}
            {' '}Regularize para continuar usando o sistema.
          </span>
        </div>
        <button
          onClick={() => navigate('/planos')}
          className="shrink-0 bg-white text-red-600 font-semibold text-xs px-4 py-1.5 rounded-full hover:bg-red-50 transition-colors"
        >
          Assinar agora
        </button>
      </div>
    );
  }

  // ── Trial active ───────────────────────────────────────────────────────────
  if (status === 'trial') {
    const urgent = trialDaysLeft <= 3;
    return (
      <div className={`${urgent ? 'bg-amber-500' : 'bg-green-700'} text-white px-4 py-2.5 flex items-center justify-between gap-4 text-sm`}>
        <div className="flex items-center gap-2">
          <Rocket className="w-4 h-4 shrink-0" />
          <span>
            {trialDaysLeft > 0
              ? `Período de avaliação: ${trialDaysLeft} dia${trialDaysLeft !== 1 ? 's' : ''} restante${trialDaysLeft !== 1 ? 's' : ''}.`
              : 'Último dia de avaliação.'}
            {' '}Nenhum cartão necessário para começar.
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => navigate('/planos')}
            className="bg-white text-green-800 font-semibold text-xs px-4 py-1.5 rounded-full hover:bg-green-50 transition-colors"
          >
            Ver planos
          </button>
          {!urgent && (
            <button onClick={() => setDismissed(true)} className="opacity-60 hover:opacity-100 transition-opacity">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    );
  }

  return null;
}
