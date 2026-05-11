/**
 * TrialGate.tsx
 * Mostra uma tela de bloqueio quando o trial expirou ou a assinatura foi cancelada.
 * Envolve todo o conteúdo autenticado no App.tsx.
 * Permite acesso apenas a /planos e /billing para o usuário assinar.
 */
import { useLocation } from 'wouter';
import { useSubscription } from '@/hooks/useSubscription';
import EduPlateLogo from './EduPlateLogo';
import {
  LockKeyhole, CreditCard, ArrowRight, LogOut, Clock,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

// Rotas liberadas mesmo com trial expirado
const ALLOWED_PATHS = ['/planos', '/billing', '/login', '/privacidade', '/termos'];

interface Props {
  children: React.ReactNode;
}

export default function TrialGate({ children }: Props) {
  const { isTrialExpired, isPastDue, isCanceled, loading } = useSubscription();
  const [location, navigate] = useLocation();
  const { logout } = useAuth();

  // Não bloqueia rotas liberadas
  if (ALLOWED_PATHS.some(p => location.startsWith(p))) {
    return <>{children}</>;
  }

  // Enquanto carrega, mostra conteúdo normalmente
  if (loading) return <>{children}</>;

  const blocked = isTrialExpired || isPastDue || isCanceled;
  if (!blocked) return <>{children}</>;

  const isExpired = isTrialExpired;
  const isPast    = isPastDue;
  const isCancl   = isCanceled;

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #F5F7FA 0%, #EEF2FF 100%)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 20,
      fontFamily: "'Inter', system-ui, sans-serif",
    }}>
      <div style={{
        width: '100%', maxWidth: 520,
        background: '#fff',
        borderRadius: 28,
        boxShadow: '0 24px 70px rgba(27,42,74,0.12)',
        overflow: 'hidden',
      }}>
        {/* Top bar */}
        <div style={{
          background: 'linear-gradient(135deg, #1B2A4A, #243A66)',
          padding: '28px 36px 24px',
        }}>
          <EduPlateLogo variant="dark" style={{ height: 32, marginBottom: 20 }} />

          <div style={{
            width: 56, height: 56, borderRadius: 16,
            background: isExpired ? 'rgba(239,68,68,0.18)' : 'rgba(255,152,0,0.18)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            marginBottom: 16,
          }}>
            {isExpired
              ? <Clock size={26} color="#F87171" />
              : <LockKeyhole size={26} color="#FBB740" />
            }
          </div>

          <h2 style={{
            margin: 0, color: '#fff',
            fontFamily: "'Poppins', sans-serif",
            fontSize: '1.4rem', fontWeight: 800, lineHeight: 1.2,
          }}>
            {isExpired && 'Seu período de avaliação encerrou'}
            {isPast   && 'Pagamento pendente'}
            {isCancl  && 'Assinatura cancelada'}
          </h2>
          <p style={{ margin: '10px 0 0', color: 'rgba(255,255,255,0.55)', fontSize: 13, lineHeight: 1.6 }}>
            {isExpired && 'Os 14 dias de acesso gratuito chegaram ao fim. Para continuar usando o EduPlate Menu, escolha um plano e assine agora.'}
            {isPast    && 'Houve um problema com o seu pagamento. Acesse a área de cobrança para regularizar e continuar usando o sistema.'}
            {isCancl   && 'Sua assinatura foi cancelada. Para reativar o acesso, escolha um plano abaixo.'}
          </p>
        </div>

        {/* Content */}
        <div style={{ padding: '28px 36px' }}>
          {/* What they lose */}
          <div style={{ marginBottom: 24 }}>
            <p style={{ margin: '0 0 14px', fontSize: 13, fontWeight: 700, color: '#1B2A4A' }}>
              O que está bloqueado:
            </p>
            <div style={{ display: 'grid', gap: 8 }}>
              {[
                'Cardápios e fichas técnicas',
                'Fiscalização e histórico de visitas',
                'Treinamentos e certificados PDF',
                'Documentos e alertas de vencimento',
                'Dietas especiais e relatórios SIGPC',
              ].map(item => (
                <div key={item} style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '9px 12px',
                  background: '#FFF5F5', borderRadius: 10,
                  border: '1px solid #FECACA',
                }}>
                  <LockKeyhole size={13} color="#EF4444" />
                  <span style={{ fontSize: 13, color: '#64748B' }}>{item}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Planos resumo */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 24 }}>
            {[
              { name: 'Básico', price: 'R$ 197', sub: 'até 10 escolas', color: '#1A73E8' },
              { name: 'Profissional', price: 'R$ 347', sub: 'até 30 escolas', color: '#4CAF50', popular: true },
            ].map(p => (
              <div key={p.name} style={{
                border: `2px solid ${p.popular ? 'rgba(76,175,80,0.35)' : '#E6EBF2'}`,
                borderRadius: 16, padding: '14px 16px',
                background: p.popular ? 'rgba(76,175,80,0.04)' : '#fff',
                position: 'relative',
              }}>
                {p.popular && (
                  <div style={{
                    position: 'absolute', top: -10, left: '50%', transform: 'translateX(-50%)',
                    background: '#4CAF50', color: '#fff', fontSize: 10, fontWeight: 800,
                    borderRadius: 99, padding: '3px 10px', whiteSpace: 'nowrap',
                  }}>
                    Mais popular
                  </div>
                )}
                <div style={{ fontSize: 13, fontWeight: 700, color: '#1B2A4A', marginBottom: 4 }}>{p.name}</div>
                <div style={{ fontSize: 20, fontWeight: 800, color: p.color, fontFamily: "'Poppins', sans-serif", lineHeight: 1 }}>{p.price}</div>
                <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 3 }}>/mês · {p.sub}</div>
              </div>
            ))}
          </div>

          {/* CTAs */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <button
              onClick={() => navigate('/planos')}
              style={{
                background: 'linear-gradient(135deg, #4CAF50, #5DC661)',
                border: 'none', cursor: 'pointer', width: '100%',
                borderRadius: 14, padding: '14px 20px',
                fontSize: 15, fontWeight: 800, color: '#fff',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                boxShadow: '0 10px 28px rgba(76,175,80,0.22)',
              }}
            >
              <CreditCard size={18} />
              Escolher plano e assinar
              <ArrowRight size={18} />
            </button>

            {isPast && (
              <button
                onClick={() => navigate('/billing')}
                style={{
                  background: '#fff', border: '1px solid #E6EBF2', cursor: 'pointer', width: '100%',
                  borderRadius: 14, padding: '12px 20px',
                  fontSize: 14, fontWeight: 700, color: '#1B2A4A',
                }}
              >
                Regularizar cobrança
              </button>
            )}

            <button
              onClick={() => logout()}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                fontSize: 13, color: '#94A3B8', fontWeight: 600,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                padding: '8px 0',
              }}
            >
              <LogOut size={14} />
              Sair da conta
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
