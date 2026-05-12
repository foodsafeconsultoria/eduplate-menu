import React, { useState } from 'react';
import { useLocation } from 'wouter';
import { Check, Zap, Building2, Network, X, Mail, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { useSubscription } from '@/hooks/useSubscription';
import { Input } from '@/components/ui/input';

type PlanKey = 'essencial' | 'pro' | 'enterprise';

interface Plan {
  key: PlanKey;
  name: string;
  price: number;
  priceLabel: string;
  description: string;
  icon: React.ReactNode;
  color: string;
  features: string[];
  highlight: boolean;
}

const PLANS: Plan[] = [
  {
    key: 'essencial',
    name: 'Básico',
    price: 49.9,
    priceLabel: 'R$ 49,90',
    description: 'Para municípios em início de implantação',
    icon: <Zap className="w-5 h-5" />,
    color: 'border-gray-200',
    highlight: false,
    features: [
      '1 município / organização',
      'Até 2 usuários',
      'Cardápios e fichas técnicas',
      'Controle de dietas especiais',
      'Registro de produção e sobras',
      'Testes de aceitabilidade',
      'Suporte por e-mail (72h)',
    ],
  },
  {
    key: 'pro',
    name: 'Essencial',
    price: 99,
    priceLabel: 'R$ 99',
    description: 'Para secretarias com operação ativa',
    icon: <Building2 className="w-5 h-5" />,
    color: 'border-green-600 ring-2 ring-green-600',
    highlight: true,
    features: [
      '1 município / organização',
      'Usuários ilimitados',
      'Tudo do plano Básico',
      'Fiscalização de escolas',
      'Treinamentos com certificado (QR)',
      'Relatórios e exportação SIGPC',
      'Suporte prioritário (48h)',
    ],
  },
  {
    key: 'enterprise',
    name: 'Consórcio',
    price: 399,
    priceLabel: 'R$ 399',
    description: 'Para consórcios intermunicipais',
    icon: <Network className="w-5 h-5" />,
    color: 'border-gray-200',
    highlight: false,
    features: [
      'Municípios ilimitados',
      'Usuários ilimitados',
      'Tudo do plano Profissional',
      'Painel multi-município consolidado',
      'SLA 99,9% garantido',
      'Suporte dedicado (WhatsApp)',
      'Onboarding e treinamento incluso',
    ],
  },
];

const FAQS = [
  {
    q: 'Preciso de cartão de crédito para começar o período grátis?',
    a: 'Não. Os 14 dias de avaliação são totalmente gratuitos e sem necessidade de cadastrar cartão ou dados de pagamento. Você só escolhe um plano se quiser continuar após o período.',
  },
  {
    q: 'A prefeitura pode pagar com empenho ou nota de empenho?',
    a: 'Sim. Atendemos prefeituras e secretarias municipais com emissão de nota fiscal e documentação para processo de compra via empenho. Entre em contato pelo e-mail contato@eduplate.com.br para iniciarmos.',
  },
  {
    q: 'O sistema atende à legislação do PNAE (Lei 11.947/2009)?',
    a: 'Sim. O EduPlate Menu foi desenvolvido especificamente para as exigências do PNAE: controle dos 30% da agricultura familiar, relatórios compatíveis com o SIGPC/FNDE, fichas técnicas com valor nutricional e registros de aceitabilidade conforme as normas do CFN.',
  },
  {
    q: 'Quantos usuários posso cadastrar?',
    a: 'No plano Básico, até 2 usuários (ideal para nutricionistas RT e um agente). No plano Profissional e Consórcio, usuários ilimitados — toda a equipe da secretaria pode ter acesso com perfis e permissões diferentes.',
  },
  {
    q: 'Os dados de cada município ficam separados e seguros?',
    a: 'Sim. Cada prefeitura tem um ambiente completamente isolado — nenhum município acessa dados de outro. Toda a informação é criptografada e armazenada no Google Cloud (certificação ISO 27001), com backups automáticos diários.',
  },
  {
    q: 'Posso cancelar quando quiser?',
    a: 'Sim, sem multa e sem burocracia. Você cancela diretamente pelo painel em qualquer momento. Após o cancelamento, seus dados ficam disponíveis para exportação por 30 dias.',
  },
  {
    q: 'Há desconto para pagamento anual?',
    a: 'Sim — assinatura anual tem 2 meses grátis (equivalente a ~17% de desconto). Entre em contato para contratar o plano anual e receber a proposta.',
  },
];

export default function Pricing() {
  const { user, loading: authLoading } = useAuth();
  const { status, plan: currentPlan } = useSubscription();
  const [, navigate] = useLocation();
  const [loading, setLoading] = useState<PlanKey | null>(null);
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  // Email modal for non-logged-in visitors
  const [emailModal, setEmailModal] = useState<{ open: boolean; planKey: PlanKey | null }>({ open: false, planKey: null });
  const [emailInput, setEmailInput] = useState('');

  const handleSubscribe = async (planKey: PlanKey) => {
    if (authLoading) return;

    // Logged-in user: upgrade / change plan
    if (user) {
      if (currentPlan === planKey && status === 'active') {
        toast.info('Você já está neste plano.');
        return;
      }
      try {
        setLoading(planKey);
        const res = await fetch('/api/stripe/checkout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            orgId: user.organizationId,
            plan: planKey,
            userId: user.uid,
            userEmail: user.email,
            orgName: user.organizationId,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Erro ao criar sessão de pagamento.');
        if (data.url) window.location.href = data.url;
      } catch (err: any) {
        toast.error(err.message || 'Erro ao processar. Tente novamente.');
      } finally {
        setLoading(null);
      }
      return;
    }

    // Not logged in: ask for email first
    setEmailModal({ open: true, planKey });
    setEmailInput('');
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const planKey = emailModal.planKey;
    if (!planKey || !emailInput.trim()) return;
    try {
      setLoading(planKey);
      const res = await fetch('/api/stripe/checkout-new', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: emailInput.trim(), plan: planKey }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao criar sessão de pagamento.');
      if (data.url) window.location.href = data.url;
    } catch (err: any) {
      toast.error(err.message || 'Erro ao processar. Tente novamente.');
      setLoading(null);
    }
  };

  return (
    <>
    <div className="min-h-screen bg-gray-50">

      {/* Hero header */}
      <div style={{ background: '#1B2A4A' }} className="py-16 px-4 text-center">
        <span className="inline-block text-xs font-semibold uppercase tracking-widest px-3 py-1 rounded-full mb-4"
          style={{ background: 'rgba(76,175,80,0.15)', color: '#4CAF50', border: '1px solid rgba(76,175,80,0.3)' }}>
          14 dias grátis · Sem cartão
        </span>
        <h1 className="text-4xl font-extrabold text-white mt-2">Planos para cada etapa</h1>
        <p className="mt-3 text-base" style={{ color: 'rgba(255,255,255,0.5)' }}>
          Do primeiro cardápio ao consórcio intermunicipal — sem complicação.
        </p>
        <div className="flex items-center justify-center gap-5 mt-6 text-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>
          {['Pix', 'Boleto', 'Cartão de crédito', 'Empenho municipal'].map(m => (
            <span key={m} className="flex items-center gap-1.5">
              <Check className="w-3.5 h-3.5" style={{ color: '#4CAF50' }} />{m}
            </span>
          ))}
        </div>
        <div className="mt-4">
          <a href="/login" className="text-sm underline" style={{ color: 'rgba(255,255,255,0.35)' }}>
            ← Voltar ao login
          </a>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 -mt-6 pb-20">

        {/* Plan cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12 mt-8">
          {PLANS.map((plan) => {
            const isCurrent = currentPlan === plan.key && status === 'active';
            return (
              <div
                key={plan.key}
                className={`relative bg-white rounded-2xl border-2 p-6 flex flex-col ${plan.color} ${plan.highlight ? 'shadow-xl' : 'shadow-sm'}`}
              >
                {plan.highlight && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-green-600 text-white text-xs font-bold px-4 py-1 rounded-full">
                    Mais popular
                  </div>
                )}

                <div className={`inline-flex items-center gap-2 mb-4 ${plan.highlight ? 'text-green-700' : 'text-gray-700'}`}>
                  {plan.icon}
                  <span className="font-bold text-lg">{plan.name}</span>
                </div>

                <div className="mb-1">
                  <span className="text-4xl font-extrabold text-gray-900">{plan.priceLabel}</span>
                  <span className="text-gray-400 text-sm">/mês</span>
                </div>
                <p className="text-gray-500 text-sm mb-6">{plan.description}</p>

                <ul className="space-y-2 mb-8 flex-1">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm text-gray-600">
                      <Check className="w-4 h-4 text-green-600 mt-0.5 shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>

                <button
                  onClick={() => handleSubscribe(plan.key)}
                  disabled={loading !== null || isCurrent || authLoading}
                  className={`w-full py-3 rounded-xl font-semibold text-sm transition-all ${
                    isCurrent
                      ? 'bg-gray-100 text-gray-500 cursor-default'
                      : plan.highlight
                      ? 'bg-green-600 text-white hover:bg-green-700 shadow-md'
                      : 'bg-gray-900 text-white hover:bg-gray-800'
                  }`}
                >
                  {loading === plan.key
                    ? 'Aguarde…'
                    : isCurrent
                    ? 'Plano atual'
                    : status === 'trial'
                    ? 'Assinar agora'
                    : 'Mudar para este plano'}
                </button>
              </div>
            );
          })}
        </div>

        {/* Payment methods callout */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-12 text-center">
          <p className="text-gray-600 text-sm">
            Pagamento processado com segurança pelo{' '}
            <span className="font-semibold text-gray-900">Stripe</span>.
            {' '}Aceitamos{' '}
            <span className="font-medium">Pix</span>,{' '}
            <span className="font-medium">Boleto Bancário</span> e{' '}
            <span className="font-medium">Cartão de Crédito</span>.
            {' '}Para pagamento via empenho municipal, entre em contato: {' '}
            <a href="mailto:contato@sistema-pnae.com.br" className="text-green-700 underline">
              contato@sistema-pnae.com.br
            </a>
          </p>
        </div>

        {/* FAQ */}
        <div className="max-w-2xl mx-auto mt-4">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold text-gray-900">Perguntas frequentes</h2>
            <p className="text-gray-400 text-sm mt-1">Tudo o que você precisa saber antes de começar</p>
          </div>
          <div className="space-y-2">
            {FAQS.map((faq, i) => (
              <div key={i} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full px-6 py-4 text-left flex items-center justify-between gap-4 hover:bg-gray-50 transition-colors"
                >
                  <span className="text-sm font-semibold text-gray-800">{faq.q}</span>
                  <span
                    className="shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-sm font-bold transition-all"
                    style={{
                      background: openFaq === i ? '#4CAF50' : '#f3f4f6',
                      color: openFaq === i ? 'white' : '#9ca3af',
                    }}
                  >
                    {openFaq === i ? '−' : '+'}
                  </span>
                </button>
                {openFaq === i && (
                  <div className="px-6 pb-5 text-sm text-gray-500 leading-relaxed border-t border-gray-50">
                    <p className="mt-4">{faq.a}</p>
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="mt-10 text-center rounded-2xl border border-gray-100 bg-white shadow-sm p-6">
            <p className="text-sm text-gray-500">
              Ainda tem dúvidas? Fale com a gente:{' '}
              <a href="mailto:contato@eduplate.com.br" className="font-semibold underline" style={{ color: '#4CAF50' }}>
                contato@eduplate.com.br
              </a>
            </p>
          </div>
        </div>

      </div>
    </div>

    {/* ── Email modal ── */}

    {emailModal.open && (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        style={{ background: 'rgba(0,0,0,0.45)' }}
        onClick={() => setEmailModal({ open: false, planKey: null })}
      >
        <div
          className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 relative"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={() => setEmailModal({ open: false, planKey: null })}
            className="absolute top-4 right-4 text-gray-300 hover:text-gray-500"
          >
            <X className="w-5 h-5" />
          </button>

          <div
            className="w-10 h-10 rounded-full flex items-center justify-center mb-4"
            style={{ background: 'rgba(76,175,80,0.1)' }}
          >
            <Mail className="w-5 h-5" style={{ color: '#4CAF50' }} />
          </div>

          <h3 className="text-lg font-bold text-gray-800 mb-1">Qual é o seu e-mail?</h3>
          <p className="text-sm text-gray-400 mb-5">
            Você será redirecionado ao Stripe para finalizar o pagamento. Depois cria sua senha.
          </p>

          <form onSubmit={handleEmailSubmit} className="space-y-4">
            <div className="relative">
              <Mail className="w-4 h-4 text-gray-300 absolute left-3 top-1/2 -translate-y-1/2" />
              <Input
                type="email"
                placeholder="seu@email.com"
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                required
                autoFocus
                disabled={loading !== null}
                className="pl-9 border-gray-200"
              />
            </div>
            <button
              type="submit"
              disabled={loading !== null}
              className="w-full py-2.5 rounded-xl font-semibold text-white flex items-center justify-center gap-2 transition-opacity"
              style={{ background: '#4CAF50', opacity: loading !== null ? 0.7 : 1 }}
            >
              {loading !== null
                ? <><Loader2 className="w-4 h-4 animate-spin" />Aguarde…</>
                : 'Ir para o pagamento →'}
            </button>
          </form>

          <p className="text-center text-xs text-gray-300 mt-4">
            Pagamento seguro via Stripe · Sem compromisso
          </p>
        </div>
      </div>
    )}
    </>
  );
}
