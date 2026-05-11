/**
 * OnboardingModal.tsx
 * Wizard de boas-vindas mostrado na primeira vez que o usuário entra na plataforma.
 * Aparece apenas se: (a) flag onboardingDone não estiver no Firestore da org e
 * (b) o usuário está na rota "/" (Dashboard).
 */
import { useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import {
  School, BookOpen, Settings, CheckCircle2,
  ArrowRight, X, Sparkles,
} from 'lucide-react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { useSubscription } from '@/hooks/useSubscription';
import EduPlateLogo from './EduPlateLogo';

const STEPS = [
  {
    icon: <School size={28} color="#1A73E8" />,
    iconBg: 'rgba(26,115,232,0.10)',
    step: '01',
    title: 'Cadastre suas escolas',
    desc: 'Adicione as unidades escolares do município — nome, endereço e e-mail de cada escola. Isso vai conectar todos os módulos.',
    action: 'Cadastrar escolas',
    route: '/schools',
    pill: 'Passo essencial',
    pillColor: '#1A73E8',
  },
  {
    icon: <BookOpen size={28} color="#4CAF50" />,
    iconBg: 'rgba(76,175,80,0.10)',
    step: '02',
    title: 'Crie seu primeiro cardápio',
    desc: 'Monte o cardápio semanal do município e envie por e-mail direto para as escolas com um clique.',
    action: 'Criar cardápio',
    route: '/nutrition/menus',
    pill: 'Funcionalidade principal',
    pillColor: '#4CAF50',
  },
  {
    icon: <Settings size={28} color="#FF9800" />,
    iconBg: 'rgba(255,152,0,0.10)',
    step: '03',
    title: 'Configure logo e assinatura',
    desc: 'Faça upload da logo do município e da sua assinatura digital — isso vai aparecer em todos os certificados e PDFs gerados.',
    action: 'Configurar perfil',
    route: '/training',
    pill: 'Para os PDFs ficarem certos',
    pillColor: '#FF9800',
  },
];

export default function OnboardingModal() {
  const { user } = useAuth();
  const { loading: subLoading } = useSubscription();
  const [, navigate] = useLocation();
  const [visible, setVisible] = useState(false);
  const [step, setStep] = useState(0);
  const [closing, setClosing] = useState(false);

  const orgId = user?.organizationId;

  // Check if we should show onboarding
  useEffect(() => {
    if (!orgId || subLoading) return;

    // Use localStorage as a lightweight flag (per browser/device)
    const key = `onboarding_done_${orgId}`;
    if (!localStorage.getItem(key)) {
      // Small delay so the dashboard renders first
      const t = setTimeout(() => setVisible(true), 800);
      return () => clearTimeout(t);
    }
  }, [orgId, subLoading]);

  const dismiss = async (markDone = true) => {
    setClosing(true);
    setTimeout(() => {
      setVisible(false);
      setClosing(false);
    }, 260);

    if (markDone && orgId) {
      localStorage.setItem(`onboarding_done_${orgId}`, '1');
      // Also mark in Firestore so it persists across devices
      try {
        await updateDoc(doc(db, 'organizations', orgId), { onboardingDone: true });
      } catch {
        // Non-critical — localStorage flag is enough
      }
    }
  };

  const handleAction = (route: string) => {
    dismiss(true);
    navigate(route);
  };

  const handleNext = () => {
    if (step < STEPS.length - 1) {
      setStep(s => s + 1);
    } else {
      dismiss(true);
    }
  };

  if (!visible) return null;

  const current = STEPS[step];

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'rgba(27,42,74,0.55)',
        backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 20,
        opacity: closing ? 0 : 1,
        transition: 'opacity 0.26s ease',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) dismiss(true); }}
    >
      <div style={{
        background: '#fff',
        borderRadius: 28,
        width: '100%',
        maxWidth: 520,
        boxShadow: '0 32px 80px rgba(27,42,74,0.22)',
        overflow: 'hidden',
        transform: closing ? 'scale(0.96)' : 'scale(1)',
        transition: 'transform 0.26s ease',
      }}>
        {/* Header */}
        <div style={{
          background: 'linear-gradient(135deg, #1B2A4A, #243A66)',
          padding: '28px 32px 24px',
          position: 'relative',
        }}>
          <button
            onClick={() => dismiss(true)}
            style={{
              position: 'absolute', top: 16, right: 16,
              background: 'rgba(255,255,255,0.1)', border: 'none',
              borderRadius: 8, width: 32, height: 32,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', color: 'rgba(255,255,255,0.7)',
              transition: 'background 0.15s',
            }}
          >
            <X size={16} />
          </button>

          <EduPlateLogo variant="dark" style={{ height: 32, marginBottom: 16 }} />

          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            background: 'rgba(76,175,80,0.18)', borderRadius: 99,
            padding: '6px 14px', marginBottom: 12,
          }}>
            <Sparkles size={13} color="#4CAF50" />
            <span style={{ fontSize: 12, fontWeight: 700, color: '#4CAF50' }}>
              Bem-vindo ao EduPlate Menu!
            </span>
          </div>

          <h2 style={{
            margin: 0, color: '#fff',
            fontFamily: "'Poppins', sans-serif",
            fontSize: '1.4rem', fontWeight: 800, lineHeight: 1.2,
          }}>
            Vamos configurar tudo em 3 passos rápidos
          </h2>
          <p style={{ margin: '8px 0 0', color: 'rgba(255,255,255,0.55)', fontSize: 13 }}>
            Siga as etapas abaixo para começar a usar o sistema no seu município.
          </p>

          {/* Progress dots */}
          <div style={{ display: 'flex', gap: 8, marginTop: 20 }}>
            {STEPS.map((_, i) => (
              <div
                key={i}
                onClick={() => setStep(i)}
                style={{
                  height: 4, flex: 1, borderRadius: 99, cursor: 'pointer',
                  background: i <= step ? '#4CAF50' : 'rgba(255,255,255,0.18)',
                  transition: 'background 0.2s',
                }}
              />
            ))}
          </div>
        </div>

        {/* Step content */}
        <div style={{ padding: '28px 32px 24px' }}>
          <div style={{ display: 'flex', gap: 18, alignItems: 'flex-start' }}>
            <div style={{
              width: 56, height: 56, borderRadius: 16, flexShrink: 0,
              background: current.iconBg,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              {current.icon}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <span style={{
                  fontSize: 11, fontWeight: 800, color: current.pillColor,
                  background: current.iconBg,
                  borderRadius: 99, padding: '3px 10px',
                }}>
                  {current.pill}
                </span>
              </div>
              <h3 style={{
                margin: 0, fontSize: '1.1rem', fontWeight: 800,
                color: '#1B2A4A', fontFamily: "'Poppins', sans-serif",
              }}>
                {current.title}
              </h3>
              <p style={{
                margin: '8px 0 0', fontSize: 14, color: '#64748B', lineHeight: 1.65,
              }}>
                {current.desc}
              </p>
            </div>
          </div>

          {/* All steps summary (small) */}
          <div style={{
            marginTop: 24, background: '#F8FAFD',
            borderRadius: 12, padding: '12px 14px',
            display: 'grid', gap: 8,
          }}>
            {STEPS.map((s, i) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer',
                opacity: i === step ? 1 : 0.45,
              }} onClick={() => setStep(i)}>
                <div style={{
                  width: 22, height: 22, borderRadius: 6, flexShrink: 0,
                  background: i < step ? '#4CAF50' : i === step ? '#1B2A4A' : '#E6EBF2',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {i < step
                    ? <CheckCircle2 size={13} color="#fff" />
                    : <span style={{ fontSize: 10, fontWeight: 800, color: i === step ? '#fff' : '#94A3B8' }}>{i + 1}</span>
                  }
                </div>
                <span style={{ fontSize: 13, fontWeight: i === step ? 700 : 500, color: '#1B2A4A' }}>
                  {s.title}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div style={{
          padding: '0 32px 28px',
          display: 'flex', gap: 12, justifyContent: 'space-between', alignItems: 'center',
        }}>
          <button
            onClick={() => dismiss(true)}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              fontSize: 13, color: '#94A3B8', fontWeight: 600, padding: '8px 0',
            }}
          >
            Pular por agora
          </button>

          <div style={{ display: 'flex', gap: 10 }}>
            {step < STEPS.length - 1 && (
              <button
                onClick={handleNext}
                style={{
                  background: '#F1F5F9', border: 'none', cursor: 'pointer',
                  borderRadius: 12, padding: '11px 20px',
                  fontSize: 13, fontWeight: 700, color: '#64748B',
                }}
              >
                Próximo
              </button>
            )}
            <button
              onClick={() => handleAction(current.route)}
              style={{
                background: 'linear-gradient(135deg, #4CAF50, #5DC661)',
                border: 'none', cursor: 'pointer',
                borderRadius: 12, padding: '11px 22px',
                fontSize: 14, fontWeight: 800, color: '#fff',
                display: 'flex', alignItems: 'center', gap: 8,
                boxShadow: '0 8px 20px rgba(76,175,80,0.25)',
              }}
            >
              {current.action}
              <ArrowRight size={16} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
