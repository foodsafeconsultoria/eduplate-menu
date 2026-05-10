/**
 * LandingPage.tsx — EduPlate Menu
 * Design: institutional modern, sem emojis, Poppins + Inter
 */
import { useState } from 'react';
import { useLocation } from 'wouter';
import EduPlateLogo from '@/components/EduPlateLogo';
import {
  BookOpen,
  ClipboardList,
  GraduationCap,
  FolderOpen,
  BarChart2,
  Users,
  QrCode,
  Mail,
  Menu,
  X,
  Play,
  Check,
  Minus,
  ChevronDown,
  ChevronUp,
  ArrowRight,
  ShieldCheck,
  Wifi,
  Clock,
  Award,
} from 'lucide-react';
import './LandingPage.css';

// ─── Feature data (sem emojis) ────────────────────────────────────────────────

const FEATURES = [
  {
    icon: <BookOpen size={22} color="#fff" />,
    bg: 'linear-gradient(135deg, #4CAF50, #66BB6A)',
    title: 'Cardápios digitais',
    desc: 'Elabore, revise e publique cardápios com organização, padronização e visibilidade por escola, etapa e período.',
  },
  {
    icon: <ClipboardList size={22} color="#fff" />,
    bg: 'linear-gradient(135deg, #1A73E8, #3D8FFF)',
    title: 'Fiscalização de escolas',
    desc: 'Checklists digitais com fotos, observações e histórico por unidade escolar para acompanhar conformidade e pendências.',
  },
  {
    icon: <GraduationCap size={22} color="#fff" />,
    bg: 'linear-gradient(135deg, #FF9800, #FFB74D)',
    title: 'Treinamentos e certificados',
    desc: 'Registre presença por QR Code em telão e gere certificados em PDF com muito menos trabalho operacional.',
  },
  {
    icon: <FolderOpen size={22} color="#fff" />,
    bg: 'linear-gradient(135deg, #9C27B0, #BA68C8)',
    title: 'Documentos com validade',
    desc: 'Controle alvarás, RDC 216, PNAE e outros documentos com alertas automáticos antes do vencimento.',
  },
  {
    icon: <BarChart2 size={22} color="#fff" />,
    bg: 'linear-gradient(135deg, #E91E63, #F06292)',
    title: 'Relatórios e evidências',
    desc: 'Exportação no formato SIGPC/FNDE com poucos cliques. Resto-ingesta, aceitabilidade e produção.',
  },
  {
    icon: <Users size={22} color="#fff" />,
    bg: 'linear-gradient(135deg, #00BCD4, #4DD0E1)',
    title: 'Dietas especiais',
    desc: 'Centralize restrições alimentares e dados de alunos para que toda a rede trabalhe com mais segurança.',
  },
];

// ─── FAQ data ─────────────────────────────────────────────────────────────────

const FAQS = [
  {
    q: 'O EduPlate Menu funciona para qualquer município?',
    a: 'Sim. A plataforma foi desenvolvida para municípios de diferentes portes, com planos adequados para redes menores, maiores e operações regionais em consórcio.',
  },
  {
    q: 'Preciso instalar algum software?',
    a: 'Não. O EduPlate Menu é 100% online. Acesse pelo navegador em computador, tablet ou celular — sem instalação, sem configuração de servidor.',
  },
  {
    q: 'Como funciona o período de 14 dias grátis?',
    a: 'Você acessa todas as funcionalidades do plano escolhido por 14 dias sem custo. Não solicitamos cartão de crédito para iniciar o teste.',
  },
  {
    q: 'Quem pode usar o sistema além da nutricionista RT?',
    a: 'Cada organização conta com perfis de nutricionista e agente escolar. Os dados são isolados por município, com segurança e conformidade LGPD.',
  },
  {
    q: 'Os dados estão seguros? O sistema segue a LGPD?',
    a: 'Sim. O sistema opera em nuvem com autenticação segura, isolamento de dados por organização e práticas alinhadas à Lei Geral de Proteção de Dados.',
  },
  {
    q: 'E se eu precisar cancelar?',
    a: 'Você pode cancelar a qualquer momento, sem burocracia e sem multa. Os dados ficam disponíveis para exportação conforme nossa política de retenção.',
  },
];

// ─── Component ────────────────────────────────────────────────────────────────

export default function LandingPage() {
  const [, navigate] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const goToPlans = () => navigate('/planos');
  const goToLogin = () => navigate('/login');

  return (
    <div className="lp-root">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <header className="lp-header">
        <div className="lp-container">
          <nav className="lp-nav">
            <a className="lp-brand" href="#inicio" aria-label="EduPlate Menu">
              <EduPlateLogo variant="light" style={{ height: 44 }} />
            </a>

            <div className="lp-nav-links">
              <a href="#funcionalidades">Funcionalidades</a>
              <a href="#como-funciona">Como funciona</a>
              <a href="#planos">Planos</a>
              <a href="#faq">FAQ</a>
            </div>

            <div className="lp-nav-actions">
              <button className="lp-link-plain" onClick={goToLogin}>Entrar</button>
              <button className="lp-btn lp-btn-primary" onClick={goToPlans}
                style={{ padding: '10px 20px', fontSize: 14 }}>
                Teste grátis
              </button>
              <button
                className="lp-hamburger"
                onClick={() => setMobileOpen(v => !v)}
                aria-label="Menu"
              >
                {mobileOpen ? <X size={24} /> : <Menu size={24} />}
              </button>
            </div>
          </nav>

          {/* Mobile menu */}
          <div className={`lp-mobile-menu ${mobileOpen ? 'open' : ''}`}>
            <a href="#funcionalidades" onClick={() => setMobileOpen(false)}>Funcionalidades</a>
            <a href="#como-funciona" onClick={() => setMobileOpen(false)}>Como funciona</a>
            <a href="#planos" onClick={() => setMobileOpen(false)}>Planos</a>
            <a href="#faq" onClick={() => setMobileOpen(false)}>FAQ</a>
            <a href="/login" style={{ color: '#1B2A4A', fontWeight: 700 }}>Entrar</a>
          </div>
        </div>
      </header>

      <main id="inicio">
        {/* ── Hero ─────────────────────────────────────────────────────── */}
        <section className="lp-hero">
          <div className="lp-container lp-hero-grid">
            {/* Copy */}
            <div className="lp-hero-copy">
              <span className="lp-eyebrow">Plataforma especialista em PNAE · 100% online</span>
              <h1 style={{ marginTop: 20 }}>
                Gestão do PNAE em{' '}
                <span style={{ color: 'var(--lp-green)' }}>uma plataforma só</span>
              </h1>
              <p className="lp-lead" style={{ marginTop: 22 }}>
                O EduPlate Menu centraliza cardápios, fiscalização, treinamentos,
                certificados, dietas especiais e documentos da alimentação escolar
                do município — com mais controle, rastreabilidade e menos retrabalho.
              </p>

              <div className="lp-btn-row">
                <button className="lp-btn lp-btn-primary" onClick={goToPlans}>
                  Começar 14 dias grátis
                  <ArrowRight size={18} />
                </button>
                <a className="lp-btn lp-btn-secondary" href="#funcionalidades">
                  Ver funcionalidades
                </a>
              </div>

              <div className="lp-hero-meta">
                <span className="lp-pill">Sem cartão de crédito</span>
                <span className="lp-pill">Cancele a qualquer momento</span>
                <span className="lp-pill">Dados seguros na nuvem</span>
              </div>
            </div>

            {/* Dashboard mockup */}
            <div className="lp-hero-card" aria-label="Prévia da plataforma">
              <div className="lp-mock-browser">
                <div className="lp-browser-top">
                  <span className="lp-dot lp-dot-red" />
                  <span className="lp-dot lp-dot-yellow" />
                  <span className="lp-dot lp-dot-green" />
                  <div className="lp-url-bar">app.eduplate.com.br</div>
                </div>
                <div className="lp-dashboard">
                  {/* Weekly menu calendar */}
                  <div className="lp-panel">
                    <h4>Cardápio semanal</h4>
                    <div className="lp-calendar">
                      {[
                        { d: 'Seg', a: 'Arroz + Feijão', b: 'Fruta', ca: 'green', cb: 'blue' },
                        { d: 'Ter', a: 'Macarrão', b: 'Salada', ca: 'green', cb: 'orange' },
                        { d: 'Qua', a: 'Sopa nutritiva', b: 'Suco', ca: 'green', cb: 'blue' },
                        { d: 'Qui', a: 'Carne + Legumes', b: 'Sobremesa', ca: 'green', cb: 'orange' },
                        { d: 'Sex', a: 'Merenda regional', b: 'Leite', ca: 'green', cb: 'blue' },
                      ].map(item => (
                        <div key={item.d} className="lp-day">
                          <span className="lp-day-label">{item.d}</span>
                          <div className={`lp-tag lp-tag-${item.ca}`}>{item.a}</div>
                          <div className={`lp-tag lp-tag-${item.cb}`}>{item.b}</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Side cards */}
                  <div className="lp-stack">
                    <div className="lp-mini-card">
                      <h4>Alertas do dia</h4>
                      <div className="lp-metric"><span>Documento vencendo</span><strong>3</strong></div>
                      <div className="lp-metric"><span>Fiscalizações pendentes</span><strong>12</strong></div>
                      <div className="lp-metric"><span>Dietas especiais</span><strong>8</strong></div>
                    </div>
                    <div className="lp-mini-card">
                      <h4>Treinamentos</h4>
                      <div className="lp-metric"><span>QR Code de presença</span><span className="lp-badge-num">QR</span></div>
                      <div className="lp-metric"><span>Certificados gerados</span><strong>124</strong></div>
                    </div>
                    <div className="lp-mini-card">
                      <h4>Relatórios SIGPC</h4>
                      <div className="lp-metric"><span>Histórico por escola</span><strong style={{ color: '#4CAF50' }}>OK</strong></div>
                      <div className="lp-metric"><span>Exportação FNDE</span><strong style={{ color: '#4CAF50' }}>Pronto</strong></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Stats */}
          <div className="lp-container lp-stats">
            {[
              { icon: <Clock size={20} color="#4CAF50" />, big: '14 dias', label: 'de acesso grátis' },
              { icon: <Wifi size={20} color="#1A73E8" />, big: '100%', label: 'online e na nuvem' },
              { icon: <ShieldCheck size={20} color="#9C27B0" />, big: 'LGPD', label: 'dados com mais segurança' },
              { icon: <Award size={20} color="#FF9800" />, big: '1 dia', label: 'para começar a operar' },
            ].map(s => (
              <div key={s.big} className="lp-stat">
                <div style={{ marginBottom: 8 }}>{s.icon}</div>
                <div className="lp-stat-big">{s.big}</div>
                <div className="lp-stat-label">{s.label}</div>
              </div>
            ))}
          </div>
        </section>

        {/* ── Features ─────────────────────────────────────────────────── */}
        <section className="lp-section" id="funcionalidades">
          <div className="lp-container">
            <span className="lp-eyebrow">Tudo em um só lugar</span>
            <h2 style={{ marginTop: 18, maxWidth: 700 }}>
              Funcionalidades pensadas para a rotina real da alimentação escolar
            </h2>
            <p className="lp-lead" style={{ marginTop: 18 }}>
              O EduPlate Menu foi desenhado para nutricionistas e secretarias de educação
              que precisam organizar a operação do PNAE com clareza, padronização e rapidez.
            </p>

            <div className="lp-grid-3" style={{ marginTop: 34 }}>
              {FEATURES.map(f => (
                <article key={f.title} className="lp-card">
                  <div className="lp-icon" style={{ background: f.bg }}>
                    {f.icon}
                  </div>
                  <h3>{f.title}</h3>
                  <p>{f.desc}</p>
                </article>
              ))}
            </div>

            {/* Extra two features inline */}
            <div className="lp-grid-2" style={{ marginTop: 18 }}>
              <article className="lp-card" style={{ display: 'flex', gap: 18, alignItems: 'flex-start' }}>
                <div className="lp-icon" style={{ background: 'linear-gradient(135deg, #FF5722, #FF8A65)', flexShrink: 0 }}>
                  <QrCode size={22} color="#fff" />
                </div>
                <div>
                  <h3>QR Code de presença</h3>
                  <p>Projete no telão durante o treinamento. Participantes escaneiam e se registram diretamente pelo celular.</p>
                </div>
              </article>
              <article className="lp-card" style={{ display: 'flex', gap: 18, alignItems: 'flex-start' }}>
                <div className="lp-icon" style={{ background: 'linear-gradient(135deg, #4CAF50, #66BB6A)', flexShrink: 0 }}>
                  <Mail size={22} color="#fff" />
                </div>
                <div>
                  <h3>Cardápio por e-mail</h3>
                  <p>Envie o cardápio semanal direto para as escolas com um clique. Sem WhatsApp, sem papel, sem retrabalho.</p>
                </div>
              </article>
            </div>
          </div>
        </section>

        {/* ── Problem / Pain ──────────────────────────────────────────── */}
        <section className="lp-section lp-band">
          <div className="lp-container lp-problem-wrap">
            <div className="lp-problem-panel">
              <span className="lp-eyebrow">O problema que a gente resolve</span>
              <h2 style={{ marginTop: 18 }}>
                Se o PNAE ainda depende de planilha, papel e WhatsApp, o município perde tempo e controle
              </h2>
              <p className="lp-lead" style={{ marginTop: 18, maxWidth: '100%' }}>
                A nutricionista responsável técnica acaba absorvendo retrabalho que poderia estar
                automatizado: documentação manual, checklists em papel, certificados demorados,
                documentos vencendo sem aviso e informações espalhadas por escola.
              </p>
            </div>

            <div className="lp-pain-list">
              {[
                { title: 'Cardápios soltos em conversas e anexos', sub: 'Sem histórico, sem rastreabilidade e sem controle de versão.' },
                { title: 'Fiscalização com papel e caneta', sub: 'Relatórios demorados e pouca evidência para acompanhamento por unidade.' },
                { title: 'Documentos vencendo sem alerta', sub: 'Risco de pendências em inspeções e perda de prazo por falta de visibilidade.' },
                { title: 'Treinamentos sem presença padronizada', sub: 'Registro manual, certificados demorados e pouca organização do histórico.' },
                { title: 'Relatórios refeitos todo mês', sub: 'Muito esforço operacional para consolidar dados do município.' },
              ].map(item => (
                <div key={item.title} className="lp-pain-item">
                  <span className="lp-pain-bullet" />
                  <div>
                    <strong>{item.title}</strong>
                    <span>{item.sub}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Before / After ──────────────────────────────────────────── */}
        <section className="lp-section">
          <div className="lp-container">
            <span className="lp-eyebrow">Por que escolher o EduPlate Menu</span>
            <h2 style={{ marginTop: 18 }}>
              Menos retrabalho para a equipe. Mais controle para o município.
            </h2>

            <div className="lp-compare">
              <div className="lp-compare-col" style={{ borderColor: '#FECACA', background: '#FFFAFA' }}>
                <h3 style={{ color: '#DC2626' }}>Antes</h3>
                <ul className="lp-compare-list">
                  {[
                    'Processos espalhados em planilhas, papel e mensagens.',
                    'Pouca padronização entre escolas e equipes.',
                    'Documentos e evidências difíceis de localizar.',
                    'Mais risco de esquecimento e retrabalho constante.',
                  ].map(t => (
                    <li key={t}>
                      <Minus size={16} className="lp-x" style={{ color: '#EF4444', flexShrink: 0, marginTop: 2 }} />
                      {t}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="lp-compare-col" style={{ borderColor: 'rgba(76,175,80,0.28)', background: '#F7FBF7' }}>
                <h3 style={{ color: '#2E7D32' }}>Com o EduPlate Menu</h3>
                <ul className="lp-compare-list">
                  {[
                    'Operação centralizada em uma plataforma especialista em PNAE.',
                    'Fluxos digitais para cardápios, fiscalização e treinamentos.',
                    'Histórico organizado por unidade escolar e rotina.',
                    'Mais clareza para acompanhar o município e agir com antecedência.',
                  ].map(t => (
                    <li key={t}>
                      <Check size={16} className="lp-check" style={{ color: '#4CAF50', flexShrink: 0, marginTop: 2 }} />
                      {t}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* ── Video section ───────────────────────────────────────────── */}
        <section className="lp-section lp-band">
          <div className="lp-container" style={{ textAlign: 'center' }}>
            <span className="lp-eyebrow">Veja o sistema em ação</span>
            <h2 style={{ marginTop: 18, textAlign: 'center' }}>
              Uma demonstração vale mais do que mil palavras
            </h2>
            <p className="lp-lead" style={{ margin: '16px auto 0', textAlign: 'center' }}>
              Acompanhe como um município de qualquer porte pode profissionalizar a gestão
              do PNAE em poucos passos.
            </p>

            {/* Video placeholder */}
            <div className="lp-video-wrap">
              <div className="lp-video-bg-dots" />
              {/* Central content */}
              <div style={{ position: 'relative', zIndex: 2, textAlign: 'center' }}>
                <div className="lp-play-btn" style={{ margin: '0 auto 16px' }}>
                  <Play size={28} color="#fff" fill="#fff" />
                </div>
                <p style={{ color: 'rgba(255,255,255,0.75)', fontSize: 14, fontWeight: 600 }}>
                  Demonstração do EduPlate Menu
                </p>
                <p style={{ color: 'rgba(255,255,255,0.40)', fontSize: 12, marginTop: 4 }}>
                  Vídeo em breve · Disponível no YouTube
                </p>
              </div>
              {/* Decorative glows */}
              <div style={{
                position: 'absolute', width: 200, height: 200,
                borderRadius: '50%', background: 'rgba(76,175,80,0.12)',
                filter: 'blur(40px)', bottom: -60, right: -40, pointerEvents: 'none',
              }} />
              <div style={{
                position: 'absolute', width: 160, height: 160,
                borderRadius: '50%', background: 'rgba(26,115,232,0.10)',
                filter: 'blur(40px)', top: -40, left: -40, pointerEvents: 'none',
              }} />
            </div>
          </div>
        </section>

        {/* ── How it works ────────────────────────────────────────────── */}
        <section className="lp-section" id="como-funciona">
          <div className="lp-container">
            <span className="lp-eyebrow">Simples e rápido</span>
            <h2 style={{ marginTop: 18 }}>Comece a funcionar em um dia</h2>
            <p className="lp-lead" style={{ marginTop: 18 }}>
              Sem implantação longa, sem instalação complexa, com acesso em computador, tablet ou celular.
            </p>

            <div className="lp-steps">
              {[
                {
                  n: '01',
                  title: 'Assine o plano',
                  desc: 'Escolha o plano ideal para o porte do município e ative o período de teste grátis sem cartão de crédito.',
                },
                {
                  n: '02',
                  title: 'Configure em minutos',
                  desc: 'Cadastre escolas, equipe e identidade visual do município para começar com a estrutura organizada.',
                },
                {
                  n: '03',
                  title: 'Use de qualquer lugar',
                  desc: 'Acesse a plataforma pela web e trabalhe com tudo salvo na nuvem, com praticidade e segurança.',
                },
              ].map(s => (
                <article key={s.n} className="lp-step">
                  <div className="lp-step-num">{s.n}</div>
                  <h3>{s.title}</h3>
                  <p>{s.desc}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* ── Pricing ─────────────────────────────────────────────────── */}
        <section className="lp-section lp-band" id="planos">
          <div className="lp-container">
            <span className="lp-eyebrow">Planos e preços</span>
            <h2 style={{ marginTop: 18 }}>Planos pensados para o porte da sua rede</h2>
            <p className="lp-lead" style={{ marginTop: 18 }}>
              14 dias grátis em qualquer plano. Sem cartão de crédito. Sem taxa de setup.
            </p>

            <div className="lp-pricing">
              {/* Básico */}
              <article className="lp-price-card">
                <h3>Básico</h3>
                <p style={{ color: 'var(--lp-muted)', fontSize: 14, marginTop: 8 }}>
                  Ideal para municípios com até 10 escolas.
                </p>
                <div className="lp-price">R$ 197 <small>/mês</small></div>
                <ul className="lp-price-list">
                  {[
                    'Cardápios e fichas técnicas',
                    'Fiscalização de escolas',
                    'Treinamentos + QR Code',
                    'Certificados em PDF',
                    'Documentos com validade',
                    'Suporte por e-mail',
                  ].map(i => (
                    <li key={i}><Check size={14} style={{ color: '#4CAF50', flexShrink: 0, marginTop: 2 }} />{i}</li>
                  ))}
                </ul>
                <div className="lp-spacer" />
                <div className="lp-btn-row" style={{ marginTop: 22 }}>
                  <button className="lp-btn lp-btn-secondary" style={{ width: '100%' }} onClick={goToPlans}>
                    Começar 14 dias grátis
                  </button>
                </div>
              </article>

              {/* Profissional */}
              <article className="lp-price-card popular">
                <span className="lp-popular-badge">Mais popular</span>
                <h3>Profissional</h3>
                <p style={{ color: 'var(--lp-muted)', fontSize: 14, marginTop: 8 }}>
                  Para municípios com até 30 escolas e mais demanda operacional.
                </p>
                <div className="lp-price">R$ 347 <small>/mês</small></div>
                <ul className="lp-price-list">
                  {[
                    'Tudo do plano Básico',
                    'Relatórios SIGPC/FNDE',
                    'Dietas especiais de alunos',
                    'Envio de cardápio por e-mail',
                    'Controle de EPIs',
                    'Suporte prioritário',
                  ].map(i => (
                    <li key={i}><Check size={14} style={{ color: '#4CAF50', flexShrink: 0, marginTop: 2 }} />{i}</li>
                  ))}
                </ul>
                <div className="lp-spacer" />
                <div className="lp-btn-row" style={{ marginTop: 22 }}>
                  <button className="lp-btn lp-btn-primary" style={{ width: '100%' }} onClick={goToPlans}>
                    Começar 14 dias grátis
                  </button>
                </div>
              </article>

              {/* Consórcio */}
              <article className="lp-price-card">
                <h3>Consórcio</h3>
                <p style={{ color: 'var(--lp-muted)', fontSize: 14, marginTop: 8 }}>
                  Para consórcios e redes regionais com múltiplos municípios.
                </p>
                <div className="lp-price" style={{ fontSize: '1.6rem' }}>Sob consulta</div>
                <ul className="lp-price-list">
                  {[
                    'Tudo do plano Profissional',
                    'Múltiplos municípios',
                    'Logo personalizada',
                    'Treinamento presencial',
                    'SLA garantido',
                    'Suporte dedicado',
                  ].map(i => (
                    <li key={i}><Check size={14} style={{ color: '#4CAF50', flexShrink: 0, marginTop: 2 }} />{i}</li>
                  ))}
                </ul>
                <div className="lp-spacer" />
                <div className="lp-btn-row" style={{ marginTop: 22 }}>
                  <a
                    className="lp-btn lp-btn-outline"
                    style={{ width: '100%', justifyContent: 'center' }}
                    href="mailto:contato@eduplate.com.br"
                  >
                    Falar com especialista
                  </a>
                </div>
              </article>
            </div>
          </div>
        </section>

        {/* ── FAQ ─────────────────────────────────────────────────────── */}
        <section className="lp-section" id="faq">
          <div className="lp-container">
            <span className="lp-eyebrow">Dúvidas frequentes</span>
            <h2 style={{ marginTop: 18 }}>Perguntas e respostas</h2>

            <div className="lp-faq">
              {FAQS.map((f, i) => (
                <div key={i} className="lp-faq-item">
                  <button
                    className="lp-faq-q"
                    onClick={() => setOpenFaq(openFaq === i ? null : i)}
                    aria-expanded={openFaq === i}
                  >
                    {f.q}
                    <span className="lp-faq-icon">
                      {openFaq === i ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                    </span>
                  </button>
                  {openFaq === i && (
                    <div className="lp-faq-a">{f.a}</div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── CTA ─────────────────────────────────────────────────────── */}
        <section className="lp-section-sm">
          <div className="lp-container">
            <div className="lp-cta-box">
              <div className="lp-cta-content">
                <span className="lp-cta-eyebrow">
                  Pronto para profissionalizar a gestão do PNAE
                </span>
                <h2>
                  Seu município merece uma gestão do PNAE mais organizada, segura e profissional
                </h2>
                <p>
                  Experimente o EduPlate Menu por 14 dias e veja como a rotina da alimentação
                  escolar pode funcionar com mais controle, visibilidade e padronização.
                </p>
                <div className="lp-btn-row" style={{ marginTop: 30 }}>
                  <button className="lp-btn lp-btn-primary" onClick={goToPlans}>
                    Começar grátis agora
                    <ArrowRight size={18} />
                  </button>
                  <a
                    className="lp-btn"
                    href="mailto:contato@eduplate.com.br"
                    style={{
                      background: 'rgba(255,255,255,0.12)',
                      color: '#fff',
                      border: '1px solid rgba(255,255,255,0.22)',
                    }}
                  >
                    Falar com especialista
                  </a>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* ── Footer ──────────────────────────────────────────────────── */}
      <footer className="lp-footer">
        <div className="lp-container">
          <div className="lp-footer-inner">
            <div>
              <EduPlateLogo variant="light" style={{ height: 32, marginBottom: 8 }} />
              <p className="lp-footer-copy" style={{ marginTop: 8 }}>
                Plataforma especialista em PNAE · 100% online<br />
                CNPJ: — · Avaré — SP · contato@eduplate.com.br
              </p>
            </div>
            <div className="lp-footer-links">
              <a href="#funcionalidades">Funcionalidades</a>
              <a href="#como-funciona">Como funciona</a>
              <a href="#planos">Planos</a>
              <a href="#faq">FAQ</a>
              <a href="/privacidade">Privacidade</a>
              <a href="/termos">Termos de uso</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
