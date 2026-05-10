import { useState, useEffect } from 'react';
import EduPlateLogo from '@/components/EduPlateLogo';
import {
  Apple, BarChart3, Bell, BookOpen, CheckCircle2, ChevronDown,
  ClipboardCheck, FileText, GraduationCap, Mail, Menu,
  QrCode, Shield, Sparkles, Trophy, Utensils, Wrench, X, Zap,
} from 'lucide-react';

// ─── Data ─────────────────────────────────────────────────────────────────────

const FEATURES = [
  {
    icon: <Apple className="h-6 w-6" />,
    title: 'Cardápios Digitais',
    desc: 'Elabore, aprove e publique cardápios com controle nutricional e conformidade PNAE automatizada.',
    color: '#4CAF50',
  },
  {
    icon: <ClipboardCheck className="h-6 w-6" />,
    title: 'Fiscalização de Escolas',
    desc: 'Checklists digitais de inspeção com fotos, geração de relatórios e histórico por unidade escolar.',
    color: '#1A73E8',
  },
  {
    icon: <GraduationCap className="h-6 w-6" />,
    title: 'Treinamentos e Certificados',
    desc: 'QR Code para registro de presença em telão. Certificados PDF com assinatura digital em segundos.',
    color: '#FF9800',
  },
  {
    icon: <FileText className="h-6 w-6" />,
    title: 'Documentos com Validade',
    desc: 'Controle de alvarás, RDC 216, PNAE e outros — com alertas automáticos antes do vencimento.',
    color: '#9C27B0',
  },
  {
    icon: <BarChart3 className="h-6 w-6" />,
    title: 'Relatórios para o FNDE',
    desc: 'Exportação no formato SIGPC/FNDE com poucos cliques. Resto-ingesta, aceitabilidade e produção.',
    color: '#E91E63',
  },
  {
    icon: <Shield className="h-6 w-6" />,
    title: 'Dietas Especiais',
    desc: 'Cadastro de alunos com restrições alimentares visível para todas as escolas do município.',
    color: '#00BCD4',
  },
  {
    icon: <QrCode className="h-6 w-6" />,
    title: 'QR Code de Presença',
    desc: 'Projete no telão durante o treinamento. Participantes escaneiam e se registram pelo celular.',
    color: '#FF5722',
  },
  {
    icon: <Mail className="h-6 w-6" />,
    title: 'Cardápio por E-mail',
    desc: 'Envie o cardápio semanal direto para as escolas com um clique. Sem WhatsApp, sem papel.',
    color: '#4CAF50',
  },
];

const STEPS = [
  {
    n: '01',
    title: 'Assine o plano',
    desc: 'Escolha o plano ideal para o porte do seu município. Sem fidelidade, sem taxa de setup.',
  },
  {
    n: '02',
    title: 'Configure em minutos',
    desc: 'Cadastre suas escolas, faça upload da logo da secretaria e adicione sua equipe.',
  },
  {
    n: '03',
    title: 'Use de qualquer lugar',
    desc: 'Acesse pelo computador, tablet ou celular. Tudo salvo na nuvem, com segurança LGPD.',
  },
];

const FAQS = [
  {
    q: 'O EduPlate Menu funciona para qualquer município?',
    a: 'Sim. O sistema é multi-tenant — cada município tem seus dados completamente isolados. Funciona para prefeituras de qualquer porte.',
  },
  {
    q: 'Preciso instalar algum software?',
    a: 'Não. O EduPlate é 100% online. Acesse pelo navegador em qualquer dispositivo — sem instalação, sem manutenção.',
  },
  {
    q: 'Como funciona o período de 14 dias grátis?',
    a: 'Você tem acesso completo a todas as funcionalidades por 14 dias, sem precisar informar cartão de crédito. Só cobra se continuar.',
  },
  {
    q: 'Quem pode usar o sistema além da nutricionista?',
    a: 'Cada organização pode ter a Nutricionista RT (admin) e o Agente Escolar. Cada um com seu próprio acesso e permissões.',
  },
  {
    q: 'Os dados estão seguros? O sistema é LGPD?',
    a: 'Sim. Os dados ficam no Google Firebase (ISO 27001), com criptografia TLS e em repouso. Temos Política de Privacidade completa conforme a LGPD.',
  },
  {
    q: 'E se eu precisar cancelar?',
    a: 'Cancele a qualquer momento. Seus dados ficam disponíveis para exportação por 30 dias após o cancelamento.',
  },
];

const PLANS = [
  {
    id: 'essencial',
    name: 'Básico',
    price: 'R$ 197',
    period: '/mês',
    desc: 'Ideal para municípios de até 10 escolas',
    color: '#4CAF50',
    highlight: false,
    features: [
      'Cardápios e fichas técnicas',
      'Fiscalização de escolas',
      'Treinamentos + QR Code',
      'Certificados PDF',
      'Documentos com validade',
      'Suporte por e-mail',
    ],
  },
  {
    id: 'pro',
    name: 'Profissional',
    price: 'R$ 347',
    period: '/mês',
    desc: 'Para municípios com até 30 escolas',
    color: '#1A73E8',
    highlight: true,
    features: [
      'Tudo do Básico',
      'Relatórios SIGPC/FNDE',
      'Envio de cardápio por e-mail',
      'Controle de EPIs',
      'Dietas especiais de alunos',
      'Suporte prioritário',
    ],
  },
  {
    id: 'enterprise',
    name: 'Consórcio',
    price: 'Sob consulta',
    period: '',
    desc: 'Para consórcios e redes regionais',
    color: '#FF9800',
    highlight: false,
    features: [
      'Tudo do Profissional',
      'Múltiplos municípios',
      'Logo personalizada',
      'Treinamento presencial',
      'SLA garantido',
      'Suporte dedicado',
    ],
  },
];

// ─── Components ───────────────────────────────────────────────────────────────

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-gray-100 last:border-0">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between gap-4 py-5 text-left"
      >
        <span className="text-sm font-semibold text-gray-800">{q}</span>
        <ChevronDown className={`h-4 w-4 text-gray-400 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <p className="pb-5 text-sm text-gray-500 leading-relaxed">{a}</p>
      )}
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function LandingPage() {
  const [mobileMenu, setMobileMenu] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handler);
    return () => window.removeEventListener('scroll', handler);
  }, []);

  return (
    <div className="min-h-screen bg-white font-sans antialiased">

      {/* ── Navbar ── */}
      <header className={`fixed top-0 inset-x-0 z-50 transition-all duration-300 ${scrolled ? 'bg-white/95 backdrop-blur shadow-sm border-b border-gray-100' : 'bg-transparent'}`}>
        <div className="max-w-6xl mx-auto px-5 h-16 flex items-center justify-between">
          <a href="/">
            <EduPlateLogo className="h-8 w-auto" />
          </a>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-7">
            {[['#funcionalidades', 'Funcionalidades'], ['#como-funciona', 'Como funciona'], ['#planos', 'Planos'], ['#faq', 'FAQ']].map(([href, label]) => (
              <a key={href} href={href} className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors">{label}</a>
            ))}
          </nav>

          <div className="hidden md:flex items-center gap-3">
            <a href="/login" className="text-sm font-semibold text-gray-600 hover:text-gray-900 transition-colors px-4 py-2">
              Entrar
            </a>
            <a
              href="/planos"
              className="text-sm font-bold text-white rounded-xl px-5 py-2.5 transition-all hover:opacity-90 shadow-sm"
              style={{ background: '#4CAF50' }}
            >
              Teste grátis por 14 dias
            </a>
          </div>

          {/* Mobile */}
          <button className="md:hidden p-2 rounded-lg text-gray-600" onClick={() => setMobileMenu(o => !o)}>
            {mobileMenu ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>

        {/* Mobile dropdown */}
        {mobileMenu && (
          <div className="md:hidden bg-white border-t border-gray-100 px-5 py-4 space-y-3">
            {[['#funcionalidades', 'Funcionalidades'], ['#como-funciona', 'Como funciona'], ['#planos', 'Planos'], ['#faq', 'FAQ']].map(([href, label]) => (
              <a key={href} href={href} onClick={() => setMobileMenu(false)} className="block text-sm font-medium text-gray-700 py-1">{label}</a>
            ))}
            <div className="pt-2 flex flex-col gap-2">
              <a href="/login" className="text-center text-sm font-semibold text-gray-700 border border-gray-200 rounded-xl py-2.5">Entrar</a>
              <a href="/planos" className="text-center text-sm font-bold text-white rounded-xl py-2.5" style={{ background: '#4CAF50' }}>Teste grátis 14 dias</a>
            </div>
          </div>
        )}
      </header>

      {/* ── Hero ── */}
      <section className="relative overflow-hidden pt-28 pb-20 md:pt-36 md:pb-28" style={{ background: '#1B2A4A' }}>
        {/* Background circles */}
        <div className="absolute -top-32 -right-32 w-96 h-96 rounded-full opacity-10" style={{ background: '#4CAF50' }} />
        <div className="absolute -bottom-20 -left-20 w-72 h-72 rounded-full opacity-5" style={{ background: '#1A73E8' }} />

        <div className="relative max-w-5xl mx-auto px-5 text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 mb-8 text-xs font-semibold" style={{ background: 'rgba(76,175,80,0.15)', color: '#7ee08a', border: '1px solid rgba(76,175,80,0.3)' }}>
            <Sparkles className="h-3.5 w-3.5" />
            Plataforma especialista em PNAE · 100% online
          </div>

          <h1 className="text-4xl md:text-6xl font-black text-white leading-tight tracking-tight">
            Gestão do PNAE<br />
            <span style={{ color: '#4CAF50' }}>sem planilha,</span><br />
            sem papel.
          </h1>

          <p className="mt-6 text-lg md:text-xl max-w-2xl mx-auto leading-relaxed" style={{ color: 'rgba(255,255,255,0.6)' }}>
            O <strong className="text-white">EduPlate Menu</strong> digitaliza toda a alimentação escolar do seu município —
            cardápios, fiscalização, treinamentos, certificados e documentos — em um só lugar.
          </p>

          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <a
              href="/planos"
              className="w-full sm:w-auto font-bold text-white rounded-2xl px-8 py-4 text-base shadow-xl transition-all hover:scale-105"
              style={{ background: '#4CAF50', boxShadow: '0 8px 32px rgba(76,175,80,0.4)' }}
            >
              Começar 14 dias grátis →
            </a>
            <a
              href="#funcionalidades"
              className="w-full sm:w-auto font-semibold rounded-2xl px-8 py-4 text-base transition-all"
              style={{ color: 'rgba(255,255,255,0.7)', border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.06)' }}
            >
              Ver funcionalidades
            </a>
          </div>

          {/* Trust line */}
          <p className="mt-8 text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>
            Sem cartão de crédito · Cancele a qualquer momento · Dados seguros (LGPD + Firebase)
          </p>
        </div>

        {/* Hero stats */}
        <div className="relative max-w-3xl mx-auto px-5 mt-16 grid grid-cols-3 gap-4">
          {[
            ['14 dias', 'de acesso grátis'],
            ['100%', 'na nuvem'],
            ['LGPD', 'em conformidade'],
          ].map(([val, label]) => (
            <div key={val} className="text-center rounded-2xl py-5 px-3" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <p className="text-2xl md:text-3xl font-black" style={{ color: '#4CAF50' }}>{val}</p>
              <p className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.4)' }}>{label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Problema ── */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-4xl mx-auto px-5 text-center">
          <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-4">O problema que a gente resolve</p>
          <h2 className="text-3xl md:text-4xl font-black text-gray-900 leading-tight">
            A gestão do PNAE ainda é feita em planilha, papel e WhatsApp?
          </h2>
          <p className="mt-5 text-lg text-gray-500 leading-relaxed max-w-2xl mx-auto">
            Nutricionistas perdem horas com documentação manual, certificados impressos, checklists em papel e relatórios que têm que ser refeitos todo mês para o FNDE.
          </p>

          <div className="mt-10 grid gap-4 sm:grid-cols-3 text-left">
            {[
              ['😤', 'Cardápios aprovados no WhatsApp', 'Sem controle de versão, sem assinatura, sem histórico.'],
              ['📋', 'Fiscalização com papel e caneta', 'Relatórios perdidos, sem foto, sem rastreabilidade.'],
              ['🗂️', 'Documentos vencendo sem aviso', 'Alvará vencido, Dedetização esquecida, multa na inspeção.'],
            ].map(([emoji, title, desc]) => (
              <div key={title} className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
                <span className="text-3xl">{emoji}</span>
                <p className="mt-3 font-bold text-gray-800 text-sm">{title}</p>
                <p className="mt-1 text-xs text-gray-400 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features ── */}
      <section id="funcionalidades" className="py-20 bg-white">
        <div className="max-w-6xl mx-auto px-5">
          <div className="text-center mb-14">
            <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: '#4CAF50' }}>Tudo em um só lugar</p>
            <h2 className="text-3xl md:text-4xl font-black text-gray-900">Funcionalidades do EduPlate Menu</h2>
            <p className="mt-3 text-gray-500 max-w-xl mx-auto">Desenvolvido especificamente para nutricionistas e secretarias de educação que gerenciam o PNAE.</p>
          </div>

          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map((f) => (
              <div key={f.title} className="group rounded-2xl border border-gray-100 bg-white p-5 hover:shadow-lg hover:-translate-y-1 transition-all duration-200">
                <div className="w-11 h-11 rounded-xl flex items-center justify-center mb-4" style={{ background: f.color + '18', color: f.color }}>
                  {f.icon}
                </div>
                <p className="font-bold text-gray-900 text-sm mb-1.5">{f.title}</p>
                <p className="text-xs text-gray-500 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Como funciona ── */}
      <section id="como-funciona" className="py-20" style={{ background: '#1B2A4A' }}>
        <div className="max-w-4xl mx-auto px-5 text-center">
          <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: '#4CAF50' }}>Simples e rápido</p>
          <h2 className="text-3xl md:text-4xl font-black text-white">Começa a funcionar em um dia</h2>
          <p className="mt-3 max-w-xl mx-auto" style={{ color: 'rgba(255,255,255,0.5)' }}>Sem implantação demorada, sem treinamento presencial obrigatório.</p>

          <div className="mt-14 grid gap-8 md:grid-cols-3 text-left">
            {STEPS.map((s, i) => (
              <div key={s.n} className="relative">
                {i < STEPS.length - 1 && (
                  <div className="hidden md:block absolute top-6 left-[calc(100%+8px)] w-[calc(100%-40px)] h-px" style={{ background: 'rgba(76,175,80,0.2)' }} />
                )}
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-black" style={{ background: '#4CAF50', color: 'white' }}>
                    {s.n}
                  </div>
                </div>
                <p className="font-bold text-white mb-2">{s.title}</p>
                <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.5)' }}>{s.desc}</p>
              </div>
            ))}
          </div>

          <div className="mt-14">
            <a
              href="/planos"
              className="inline-block font-bold text-white rounded-2xl px-8 py-4 text-base transition-all hover:scale-105"
              style={{ background: '#4CAF50', boxShadow: '0 8px 32px rgba(76,175,80,0.3)' }}
            >
              Quero começar agora →
            </a>
          </div>
        </div>
      </section>

      {/* ── Planos ── */}
      <section id="planos" className="py-20 bg-gray-50">
        <div className="max-w-5xl mx-auto px-5">
          <div className="text-center mb-14">
            <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: '#4CAF50' }}>Planos e preços</p>
            <h2 className="text-3xl md:text-4xl font-black text-gray-900">Simples e transparente</h2>
            <p className="mt-3 text-gray-500">14 dias grátis em qualquer plano. Sem cartão de crédito.</p>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            {PLANS.map((p) => (
              <div
                key={p.id}
                className={`rounded-2xl p-6 flex flex-col transition-all ${p.highlight ? 'shadow-2xl scale-105' : 'shadow-sm hover:shadow-md'}`}
                style={{
                  background: p.highlight ? '#1B2A4A' : 'white',
                  border: p.highlight ? '2px solid #4CAF50' : '1px solid #f3f4f6',
                }}
              >
                {p.highlight && (
                  <div className="mb-4 inline-block self-start rounded-full px-3 py-1 text-xs font-bold" style={{ background: '#4CAF50', color: 'white' }}>
                    Mais popular
                  </div>
                )}
                <p className={`font-bold text-lg ${p.highlight ? 'text-white' : 'text-gray-900'}`}>{p.name}</p>
                <p className={`text-xs mt-1 mb-5 ${p.highlight ? 'text-white/50' : 'text-gray-400'}`}>{p.desc}</p>
                <div className="flex items-end gap-1 mb-6">
                  <span className={`text-4xl font-black ${p.highlight ? 'text-white' : 'text-gray-900'}`}>{p.price}</span>
                  {p.period && <span className={`text-sm mb-1 ${p.highlight ? 'text-white/50' : 'text-gray-400'}`}>{p.period}</span>}
                </div>
                <ul className="space-y-2.5 flex-1 mb-6">
                  {p.features.map(f => (
                    <li key={f} className="flex items-start gap-2 text-sm">
                      <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" style={{ color: p.highlight ? '#4CAF50' : p.color }} />
                      <span className={p.highlight ? 'text-white/80' : 'text-gray-600'}>{f}</span>
                    </li>
                  ))}
                </ul>
                <a
                  href={p.id === 'enterprise' ? 'mailto:contato@eduplate.com.br' : '/planos'}
                  className="block text-center font-bold rounded-xl py-3 text-sm transition-all hover:opacity-90"
                  style={
                    p.highlight
                      ? { background: '#4CAF50', color: 'white' }
                      : { background: p.color + '12', color: p.color }
                  }
                >
                  {p.id === 'enterprise' ? 'Falar com especialista' : 'Começar 14 dias grátis'}
                </a>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section id="faq" className="py-20 bg-white">
        <div className="max-w-2xl mx-auto px-5">
          <div className="text-center mb-12">
            <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: '#4CAF50' }}>Dúvidas frequentes</p>
            <h2 className="text-3xl font-black text-gray-900">Perguntas e respostas</h2>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-6">
            {FAQS.map((faq) => <FaqItem key={faq.q} {...faq} />)}
          </div>
        </div>
      </section>

      {/* ── CTA Final ── */}
      <section className="py-20" style={{ background: 'linear-gradient(135deg, #1B2A4A 0%, #0f1e36 100%)' }}>
        <div className="max-w-3xl mx-auto px-5 text-center">
          <div className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 mb-8 text-xs font-semibold mb-6" style={{ background: 'rgba(76,175,80,0.15)', color: '#7ee08a', border: '1px solid rgba(76,175,80,0.3)' }}>
            <Zap className="h-3.5 w-3.5" />
            Sem burocracia para começar
          </div>
          <h2 className="text-3xl md:text-5xl font-black text-white leading-tight">
            Seu município merece uma gestão do PNAE à altura.
          </h2>
          <p className="mt-5 text-lg max-w-xl mx-auto" style={{ color: 'rgba(255,255,255,0.5)' }}>
            14 dias grátis. Sem cartão. Sem burocracia. Se não gostar, cancela sem perguntas.
          </p>
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <a
              href="/planos"
              className="w-full sm:w-auto font-bold text-white rounded-2xl px-10 py-4 text-base transition-all hover:scale-105"
              style={{ background: '#4CAF50', boxShadow: '0 8px 32px rgba(76,175,80,0.4)' }}
            >
              Começar grátis agora →
            </a>
            <a
              href="mailto:contato@eduplate.com.br"
              className="w-full sm:w-auto font-semibold rounded-2xl px-10 py-4 text-base transition-all"
              style={{ color: 'rgba(255,255,255,0.6)', border: '1px solid rgba(255,255,255,0.1)' }}
            >
              Falar com a Simone
            </a>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="bg-gray-50 border-t border-gray-100 py-10">
        <div className="max-w-5xl mx-auto px-5 flex flex-col md:flex-row items-center justify-between gap-6">
          <EduPlateLogo className="h-7 w-auto" />
          <div className="flex flex-wrap items-center justify-center gap-6 text-sm text-gray-400">
            <a href="/planos" className="hover:text-gray-600 transition-colors">Planos</a>
            <a href="/privacidade" className="hover:text-gray-600 transition-colors">Privacidade</a>
            <a href="/termos" className="hover:text-gray-600 transition-colors">Termos de Uso</a>
            <a href="mailto:contato@eduplate.com.br" className="hover:text-gray-600 transition-colors">contato@eduplate.com.br</a>
          </div>
          <p className="text-xs text-gray-300">
            © {new Date().getFullYear()} EduPlate Menu · Avaré — SP
          </p>
        </div>
      </footer>

    </div>
  );
}
