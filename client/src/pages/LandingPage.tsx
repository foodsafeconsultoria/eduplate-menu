/**
 * LandingPage.tsx — EduPlate Menu
 * Design: institutional modern, sem emojis, Poppins + Inter
 * Mockups baseados no sistema real (dados reais do município de Itaí/SP)
 */
import { useState } from 'react';
import { useLocation } from 'wouter';
import EduPlateLogo from '@/components/EduPlateLogo';
import {
  BookOpen, ClipboardList, GraduationCap, FolderOpen,
  BarChart2, Users, QrCode, Mail, Menu, X,
  Check, Minus, ChevronDown, ChevronUp, ArrowRight,
  ShieldCheck, Wifi, Clock, Award, Bell, AlertTriangle,
} from 'lucide-react';
import './LandingPage.css';

// ─── Features ─────────────────────────────────────────────────────────────────
const FEATURES = [
  { icon: <BookOpen size={22} color="#fff" />, bg: 'linear-gradient(135deg,#4CAF50,#66BB6A)', title: 'Cardápios digitais', desc: 'Elabore, revise e publique cardápios com organização, padronização e visibilidade por escola, etapa e período.' },
  { icon: <ClipboardList size={22} color="#fff" />, bg: 'linear-gradient(135deg,#1A73E8,#3D8FFF)', title: 'Fiscalização de escolas', desc: 'Checklists digitais com fotos, observações e histórico por unidade escolar — com índice de conformidade por visita.' },
  { icon: <GraduationCap size={22} color="#fff" />, bg: 'linear-gradient(135deg,#FF9800,#FFB74D)', title: 'Treinamentos e certificados', desc: 'Registre presença por QR Code no telão e gere certificados PDF com assinatura digital em segundos.' },
  { icon: <FolderOpen size={22} color="#fff" />, bg: 'linear-gradient(135deg,#9C27B0,#BA68C8)', title: 'Documentos com validade', desc: 'Controle alvarás, RDC 216, PNAE e outros — alertas automáticos antes do vencimento.' },
  { icon: <BarChart2 size={22} color="#fff" />, bg: 'linear-gradient(135deg,#E91E63,#F06292)', title: 'Relatório SIGPC/FNDE', desc: 'Dados preenchidos automaticamente do sistema. Gere o PDF do SIGPC com um clique, por quadrimestre.' },
  { icon: <Users size={22} color="#fff" />, bg: 'linear-gradient(135deg,#00BCD4,#4DD0E1)', title: 'Dietas especiais', desc: 'Centralize restrições alimentares de alunos com etiquetas, prescrições e acompanhamento por escola.' },
  { icon: <BarChart2 size={22} color="#fff" />, bg: 'linear-gradient(135deg,#43A047,#1B5E20)', title: 'Banco de 600+ alimentos (TACO/UNICAMP)', desc: 'Banco de alimentos baseado na Tabela TACO/UNICAMP com cálculo automático dos nutrientes obrigatórios pelo PNAE — kcal, proteínas, ferro, zinco, vitaminas A e C e mais.' },
];

// ─── FAQ ──────────────────────────────────────────────────────────────────────
const FAQS = [
  { q: 'O EduPlate Menu funciona para escolas particulares também?', a: 'Sim. O sistema atende tanto redes públicas (PNAE) quanto escolas particulares. Nutricionistas de colégios privados usam para organizar cardápios, dietas especiais de alunos, documentação e treinamentos da equipe de cozinha — sem precisar da parte de SIGPC/FNDE.' },
  { q: 'O EduPlate Menu funciona para qualquer município?', a: 'Sim. A plataforma foi desenvolvida para municípios de diferentes portes, com planos adequados para redes menores, maiores e operações em consórcio.' },
  { q: 'Preciso instalar algum software?', a: 'Não. O EduPlate Menu é 100% online. Acesse pelo navegador em computador, tablet ou celular — sem instalação, sem configuração de servidor.' },
  { q: 'Como funciona o 1 mês grátis?', a: 'Você acessa todas as funcionalidades do plano escolhido por 30 dias sem custo. Solicitamos um cartão para garantir a continuidade após o trial — mas você não paga nada se cancelar antes do fim do período.' },
  { q: 'Quem pode usar o sistema além da nutricionista RT?', a: 'Cada organização conta com perfis de nutricionista RT e agente escolar. Os dados são isolados por organização, com segurança LGPD.' },
  { q: 'Os dados estão seguros? O sistema segue a LGPD?', a: 'Sim. O sistema opera em nuvem com autenticação segura, isolamento de dados por organização e práticas alinhadas à LGPD.' },
  { q: 'E se eu precisar cancelar?', a: 'Você pode cancelar a qualquer momento, sem burocracia e sem multa. Os dados ficam disponíveis para exportação conforme nossa política de retenção.' },
];

// ─── Mockup: TopNav real do sistema ──────────────────────────────────────────
function MockNav() {
  return (
    <div style={{ background:'#1B2A4A', display:'flex', alignItems:'center', gap:2, padding:'0 14px', height:36, borderRadius:'12px 12px 0 0' }}>
      <div style={{ width:22, height:22, borderRadius:6, background:'#4CAF50', marginRight:8, display:'flex', alignItems:'center', justifyContent:'center' }}>
        <div style={{ width:10, height:10, borderRadius:'50%', background:'rgba(255,255,255,0.9)' }} />
      </div>
      {['Dashboard','Alimentação','Fiscalização','Documentos','Treinamentos'].map((n,i) => (
        <div key={n} style={{ padding:'0 8px', fontSize:10, fontWeight:700, color: i===0 ? '#4CAF50' : 'rgba(255,255,255,0.55)', whiteSpace:'nowrap', position:'relative' }}>
          {n}
          {n==='Fiscalização' && <span style={{ marginLeft:3, background:'#FF9800', color:'#fff', borderRadius:8, padding:'0 4px', fontSize:8, fontWeight:800 }}>36</span>}
        </div>
      ))}
      <div style={{ marginLeft:'auto', display:'flex', alignItems:'center', gap:10 }}>
        <Bell size={12} color="rgba(255,255,255,0.5)" />
        <div style={{ fontSize:9, color:'rgba(255,255,255,0.45)', fontWeight:600 }}>Usuário</div>
      </div>
    </div>
  );
}

// ─── Mockup: Dashboard real ───────────────────────────────────────────────────
function MockDashboard() {
  return (
    <div style={{ background:'#F5F7FA', padding:14, display:'grid', gap:10 }}>
      {/* Title */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
        <div>
          <div style={{ fontSize:9, color:'#64748B', fontWeight:600, textTransform:'uppercase', letterSpacing:0.5 }}>VISÃO GERAL</div>
          <div style={{ fontSize:14, fontWeight:800, color:'#1B2A4A' }}>Dashboard</div>
        </div>
        <div style={{ background:'#FEF2F2', border:'1px solid #FECACA', borderRadius:8, padding:'4px 10px', fontSize:9, fontWeight:700, color:'#DC2626' }}>
          • 36 alertas
        </div>
      </div>
      {/* Stats row */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:8 }}>
        {[
          { label:'ESCOLAS', val:'13', sub:'Unidades cadastradas', color:'#1B2A4A' },
          { label:'CARDÁPIOS', val:'9', sub:'14 alertas', color:'#1B2A4A' },
          { label:'DIETAS ESPECIAIS', val:'58', sub:'Alunos ativos', color:'#4CAF50' },
          { label:'FICHAS TÉCNICAS', val:'15', sub:'Cadastradas', color:'#1A73E8' },
        ].map(s => (
          <div key={s.label} style={{ background:'#fff', border:'1px solid #E6EBF2', borderRadius:10, padding:'10px 10px 8px' }}>
            <div style={{ fontSize:8, fontWeight:700, color:'#64748B', textTransform:'uppercase', letterSpacing:0.5, marginBottom:4 }}>{s.label}</div>
            <div style={{ fontSize:18, fontWeight:800, color:s.color, lineHeight:1 }}>{s.val}</div>
            <div style={{ fontSize:8, color:'#94A3B8', marginTop:3 }}>{s.sub}</div>
          </div>
        ))}
      </div>
      {/* Bottom row */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8 }}>
        <div style={{ background:'#fff', border:'1px solid #E6EBF2', borderRadius:10, padding:10, gridColumn:'span 2' }}>
          <div style={{ fontSize:8, fontWeight:700, color:'#64748B', textTransform:'uppercase', marginBottom:8 }}>CONFORMIDADE DAS VISITAS</div>
          <div style={{ fontSize:20, fontWeight:800, color:'#FF9800' }}>59,5% <span style={{ fontSize:10, fontWeight:600, color:'#94A3B8' }}>média</span></div>
          <div style={{ background:'#F1F5F9', borderRadius:99, height:6, marginTop:8 }}>
            <div style={{ width:'59.5%', background:'linear-gradient(90deg,#FF9800,#FFB74D)', borderRadius:99, height:6 }} />
          </div>
          <div style={{ fontSize:8, color:'#94A3B8', marginTop:5 }}>12 escolas visitadas · Meta: 80%</div>
        </div>
        <div style={{ background:'#fff', border:'1px solid #E6EBF2', borderRadius:10, padding:10 }}>
          <div style={{ fontSize:8, fontWeight:700, color:'#64748B', textTransform:'uppercase', marginBottom:8 }}>AGRICULTURA FAMILIAR</div>
          <div style={{ fontSize:20, fontWeight:800, color:'#E91E63' }}>23% <span style={{ fontSize:10, fontWeight:600, color:'#94A3B8' }}>média</span></div>
          <div style={{ background:'#F1F5F9', borderRadius:99, height:6, marginTop:8 }}>
            <div style={{ width:'23%', background:'linear-gradient(90deg,#E91E63,#F06292)', borderRadius:99, height:6 }} />
          </div>
          <div style={{ fontSize:8, color:'#94A3B8', marginTop:5 }}>Meta mínima: 30% (Lei 11.947)</div>
        </div>
      </div>
    </div>
  );
}

// ─── Mockup: Cardápios ────────────────────────────────────────────────────────
function MockMenus() {
  return (
    <div style={{ background:'#F5F7FA', padding:14 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:10 }}>
        <div>
          <div style={{ fontSize:14, fontWeight:800, color:'#1B2A4A' }}>Cardápios</div>
          <div style={{ fontSize:9, color:'#64748B' }}>Planejamento semanal por categoria e escola.</div>
        </div>
        <div style={{ background:'#4CAF50', color:'#fff', borderRadius:8, padding:'5px 10px', fontSize:9, fontWeight:700 }}>+ Novo Cardápio</div>
      </div>
      {/* Sugestões de safra */}
      <div style={{ background:'rgba(76,175,80,0.07)', border:'1px solid rgba(76,175,80,0.2)', borderRadius:10, padding:'8px 10px', marginBottom:10 }}>
        <div style={{ fontSize:8, fontWeight:700, color:'#2E7D32', marginBottom:6 }}>Sugestões de Safra para Maio</div>
        <div style={{ display:'flex', gap:5, flexWrap:'wrap' }}>
          {['Sopa de Abóbora','Caldo Verde','Salada de Beterraba','Creme de Cenoura','Suco de Laranja'].map(t => (
            <span key={t} style={{ background:'#fff', border:'1px solid #E6EBF2', borderRadius:99, padding:'2px 7px', fontSize:8, fontWeight:600, color:'#1B2A4A' }}>{t}</span>
          ))}
        </div>
      </div>
      {/* Cards */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:8 }}>
        {[
          { title:'Semana 2 — Creche', sub:'Maio 2026', tags:['Creche','Fundamental 1'], insumos:58 },
          { title:'Semana 1 — Fundamental', sub:'Maio 2026', tags:['Fundamental 2','Médio'], insumos:40 },
          { title:'Semana 1 — Creche', sub:'Maio 2026', tags:['Creche'], insumos:55 },
        ].map(c => (
          <div key={c.title} style={{ background:'#fff', border:'1px solid #E6EBF2', borderRadius:10, padding:10 }}>
            <div style={{ fontSize:10, fontWeight:700, color:'#1B2A4A', lineHeight:1.3 }}>{c.title}</div>
            <div style={{ fontSize:8, color:'#94A3B8', marginTop:2 }}>{c.sub}</div>
            <div style={{ display:'flex', gap:4, marginTop:6, flexWrap:'wrap' }}>
              {c.tags.map(t => <span key={t} style={{ background:'rgba(26,115,232,0.1)', color:'#1A73E8', borderRadius:99, padding:'2px 6px', fontSize:8, fontWeight:700 }}>{t}</span>)}
            </div>
            <div style={{ marginTop:6, fontSize:8, fontWeight:700, color:'#4CAF50' }}>{c.insumos} insumos</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Mockup: Fiscalização ─────────────────────────────────────────────────────
function MockFiscalizacao() {
  return (
    <div style={{ background:'#F5F7FA', padding:14 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:10 }}>
        <div>
          <div style={{ fontSize:8, color:'#64748B', textTransform:'uppercase', fontWeight:600, marginBottom:2 }}>PNAE · Controle de Qualidade</div>
          <div style={{ fontSize:14, fontWeight:800, color:'#1B2A4A' }}>Fiscalização</div>
        </div>
        <div style={{ fontSize:10, fontWeight:800, color:'#1B2A4A' }}>Score atual: <span style={{ color:'#4CAF50' }}>72%</span></div>
      </div>
      <div style={{ display:'grid', gap:8 }}>
        {[
          { escola:'EMEI Profa. Angelina Maria de Almeida Tannus', data:'09/02/2026', perc:85, color:'#4CAF50', bg:'rgba(76,175,80,0.05)', border:'rgba(76,175,80,0.2)' },
          { escola:'EMEF Prof. Antonio de Freitas Filho', data:'07/02/2026', perc:78, color:'#FF9800', bg:'rgba(255,152,0,0.05)', border:'rgba(255,152,0,0.2)' },
          { escola:'CEI Prof. Carmen Silvia Beltrame', data:'05/02/2026', perc:91, color:'#4CAF50', bg:'rgba(76,175,80,0.05)', border:'rgba(76,175,80,0.2)' },
        ].map(v => (
          <div key={v.escola} style={{ background:v.bg, border:`1px solid ${v.border}`, borderRadius:10, padding:'10px 12px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <div>
              <div style={{ fontSize:10, fontWeight:700, color:'#1B2A4A' }}>{v.escola}</div>
              <div style={{ fontSize:8, color:'#94A3B8', marginTop:2 }}>{v.data}</div>
            </div>
            <div style={{ fontSize:18, fontWeight:800, color:v.color, textAlign:'right' }}>
              {v.perc}%
              <div style={{ fontSize:8, fontWeight:600, color:'#94A3B8' }}>Conformidade</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Mockup: Dietas Especiais ─────────────────────────────────────────────────
function MockDietas() {
  return (
    <div style={{ background:'#F5F7FA', padding:14 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:10 }}>
        <div>
          <div style={{ fontSize:14, fontWeight:800, color:'#1B2A4A' }}>Dietas Especiais</div>
          <div style={{ fontSize:9, color:'#64748B' }}>Controle de restrições alimentares por aluno e escola.</div>
        </div>
        <div style={{ display:'flex', gap:6 }}>
          <div style={{ background:'#fff', border:'1px solid #E6EBF2', borderRadius:8, padding:'5px 8px', fontSize:8, fontWeight:700, color:'#1B2A4A' }}>Imprimir Etiquetas (58)</div>
          <div style={{ background:'#1A73E8', color:'#fff', borderRadius:8, padding:'5px 8px', fontSize:8, fontWeight:700 }}>+ Incluir Aluno</div>
        </div>
      </div>
      {/* Table header */}
      <div style={{ display:'grid', gridTemplateColumns:'2fr 2fr 1.5fr 1fr', gap:8, padding:'6px 8px', background:'#F1F5F9', borderRadius:8, marginBottom:6 }}>
        {['Aluno','Escola','Restrições','Status'].map(h => (
          <div key={h} style={{ fontSize:8, fontWeight:700, color:'#64748B', textTransform:'uppercase' }}>{h}</div>
        ))}
      </div>
      {[
        { aluno:'Chloe Almeida Farias', escola:'CEI Prof. Carmen Silvia Beltrame', rest:'Sem Lactose', status:'Ativa' },
        { aluno:'Maria Cecília Alvez', escola:'CEI Prof. Carmen Silvia Beltrame', rest:'Sem Lactose', status:'Ativa' },
        { aluno:'Vicente Palmeira de Oliveira', escola:'EMEF Prof. Antonio de Freitas', rest:'Sem Glúten', status:'Ativa' },
        { aluno:'Ana Beatriz Souza Lima', escola:'EMEI Profa. Angelina Tannus', rest:'Sem Lactose', status:'Ativa' },
      ].map((d, i) => (
        <div key={i} style={{ display:'grid', gridTemplateColumns:'2fr 2fr 1.5fr 1fr', gap:8, padding:'7px 8px', background:'#fff', borderRadius:8, border:'1px solid #F1F5F9', marginBottom:4, alignItems:'center' }}>
          <div style={{ fontSize:9, fontWeight:600, color:'#1B2A4A' }}>{d.aluno}</div>
          <div style={{ fontSize:8, color:'#64748B' }}>{d.escola}</div>
          <span style={{ background:'rgba(26,115,232,0.1)', color:'#1A73E8', borderRadius:99, padding:'2px 7px', fontSize:8, fontWeight:700, display:'inline-block' }}>{d.rest}</span>
          <span style={{ background:'rgba(76,175,80,0.12)', color:'#2E7D32', borderRadius:99, padding:'2px 7px', fontSize:8, fontWeight:700, display:'inline-block' }}>{d.status}</span>
        </div>
      ))}
      <div style={{ textAlign:'center', fontSize:8, color:'#94A3B8', marginTop:6 }}>+ 54 outros alunos</div>
    </div>
  );
}

// ─── Mockup: Treinamentos ─────────────────────────────────────────────────────
function MockTreinamentos() {
  return (
    <div style={{ background:'#F5F7FA', padding:14 }}>
      <div style={{ background:'linear-gradient(135deg,#1B2A4A,#243A66)', borderRadius:12, padding:'14px 16px', marginBottom:10, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
        <div>
          <div style={{ fontSize:8, color:'rgba(255,255,255,0.5)', textTransform:'uppercase', fontWeight:600, marginBottom:4 }}>Capacitação de Pessoal</div>
          <div style={{ fontSize:13, fontWeight:800, color:'#fff' }}>Módulo de Treinamentos.</div>
          <div style={{ fontSize:8, color:'rgba(255,255,255,0.55)', marginTop:3 }}>QR Code · PDF com assinatura digital</div>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          {[{l:'TREINAMENTOS',v:'3'},{l:'ABERTOS',v:'1'},{l:'PRESENÇAS',v:'47'}].map(s => (
            <div key={s.l} style={{ background:'rgba(255,255,255,0.1)', borderRadius:8, padding:'6px 10px', textAlign:'center' }}>
              <div style={{ fontSize:8, color:'rgba(255,255,255,0.5)', fontWeight:600 }}>{s.l}</div>
              <div style={{ fontSize:16, fontWeight:800, color:'#fff' }}>{s.v}</div>
            </div>
          ))}
        </div>
      </div>
      {/* QR Code card */}
      <div style={{ background:'#fff', border:'1px solid #E6EBF2', borderRadius:10, padding:'12px 14px', display:'flex', gap:12, alignItems:'center' }}>
        <div style={{ width:56, height:56, border:'2px solid #1B2A4A', borderRadius:8, display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:2, padding:4, flexShrink:0 }}>
          {Array.from({length:9}).map((_,i) => (
            <div key={i} style={{ background: [0,2,6,8].includes(i) ? '#1B2A4A' : [4].includes(i) ? '#4CAF50' : 'transparent', borderRadius:2 }} />
          ))}
        </div>
        <div>
          <div style={{ fontSize:10, fontWeight:700, color:'#1B2A4A' }}>Boas Práticas de Manipulação — Maio/2026</div>
          <div style={{ fontSize:8, color:'#64748B', marginTop:3 }}>Projete o QR Code no telão · Participantes se registram pelo celular</div>
          <div style={{ display:'flex', gap:6, marginTop:6 }}>
            <span style={{ background:'rgba(76,175,80,0.1)', color:'#2E7D32', borderRadius:99, padding:'2px 8px', fontSize:8, fontWeight:700 }}>47 presenças</span>
            <span style={{ background:'rgba(255,152,0,0.1)', color:'#D97706', borderRadius:99, padding:'2px 8px', fontSize:8, fontWeight:700 }}>Aberto</span>
          </div>
        </div>
        <div style={{ marginLeft:'auto' }}>
          <div style={{ background:'#4CAF50', color:'#fff', borderRadius:8, padding:'5px 10px', fontSize:8, fontWeight:700 }}>Gerar Certificados</div>
        </div>
      </div>
    </div>
  );
}

// ─── Mockup: Documentos ───────────────────────────────────────────────────────
function MockDocumentos() {
  return (
    <div style={{ background:'#F5F7FA', padding:14 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
        <div>
          <div style={{ fontSize:14, fontWeight:800, color:'#1B2A4A' }}>Documentos Obrigatórios</div>
          <div style={{ fontSize:9, color:'#64748B' }}>Clique em Anexar para subir o arquivo · Clique na data para editar</div>
        </div>
        <div style={{ background:'#FEF3C7', border:'1px solid #FDE68A', borderRadius:8, padding:'4px 10px', fontSize:8, fontWeight:700, color:'#92400E', display:'flex', alignItems:'center', gap:4 }}>
          <AlertTriangle size={10} color="#92400E" /> 3 vencendo em breve
        </div>
      </div>
      <div style={{ background:'#fff', border:'1px solid #E6EBF2', borderRadius:10, overflow:'hidden' }}>
        <div style={{ display:'grid', gridTemplateColumns:'3fr 1fr 1fr 1fr', gap:0, background:'#F8FAFD', padding:'6px 12px', borderBottom:'1px solid #E6EBF2' }}>
          {['Documento','Categoria','Arquivo','Validade'].map(h => <div key={h} style={{ fontSize:8, fontWeight:700, color:'#64748B', textTransform:'uppercase' }}>{h}</div>)}
        </div>
        {[
          { name:'Manual de Boas Práticas (MBP)', cat:'RDC 216', file:true, val:'12/2026', ok:true },
          { name:'POP — Higienização de Instalações', cat:'RDC 216', file:true, val:'08/2026', warn:true },
          { name:'POP — Controle de Pragas e Vetores', cat:'RDC 216', file:true, val:'06/2026', warn:true },
          { name:'Alvará Sanitário', cat:'CVS', file:false, val:'—', ok:false },
          { name:'RT/ART no CFN', cat:'PNAE', file:true, val:'12/2026', ok:true },
        ].map((d,i) => (
          <div key={i} style={{ display:'grid', gridTemplateColumns:'3fr 1fr 1fr 1fr', gap:0, padding:'8px 12px', borderBottom:'1px solid #F1F5F9', alignItems:'center', background: d.warn ? 'rgba(251,191,36,0.04)' : '#fff' }}>
            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
              <div style={{ width:8, height:8, borderRadius:'50%', background: d.ok ? '#4CAF50' : d.warn ? '#FF9800' : '#E5E7EB', flexShrink:0 }} />
              <span style={{ fontSize:9, color:'#1B2A4A', fontWeight:600 }}>{d.name}</span>
            </div>
            <span style={{ fontSize:8, background:'rgba(26,115,232,0.1)', color:'#1A73E8', borderRadius:99, padding:'2px 6px', fontWeight:700, display:'inline-block' }}>{d.cat}</span>
            <span style={{ fontSize:8, color: d.file ? '#4CAF50' : '#94A3B8', fontWeight:600 }}>{d.file ? 'Anexado' : 'Anexar'}</span>
            <span style={{ fontSize:8, color: d.warn ? '#FF9800' : '#64748B', fontWeight: d.warn ? 700 : 400 }}>{d.val}</span>
          </div>
        ))}
      </div>
      <div style={{ textAlign:'right', fontSize:8, color:'#94A3B8', marginTop:6 }}>+ 10 outros documentos</div>
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function LandingPage() {
  const [, navigate] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState(0);
  const [billingPeriod, setBillingPeriod] = useState<'mensal' | 'semestral' | 'anual'>('semestral');

  const goToPlans = () => navigate('/planos');
  const goToRegister = () => navigate('/registro');
  const goToLogin = () => navigate('/login');

  const SCREENS = [
    { label: 'Dashboard', component: <MockDashboard /> },
    { label: 'Cardápios', component: <MockMenus /> },
    { label: 'Fiscalização', component: <MockFiscalizacao /> },
    { label: 'Dietas Especiais', component: <MockDietas /> },
    { label: 'Treinamentos', component: <MockTreinamentos /> },
    { label: 'Documentos', component: <MockDocumentos /> },
  ];

  return (
    <div className="lp-root">

      {/* ── Header ─────────────────────────────────────────────── */}
      <header className="lp-header">
        <div className="lp-container">
          <nav className="lp-nav">
            <a className="lp-brand" href="#inicio" aria-label="EduPlate Menu">
              <EduPlateLogo variant="light" style={{ height: 44 }} />
            </a>
            <div className="lp-nav-links">
              <a href="#funcionalidades">Funcionalidades</a>
              <a href="#sistema">O sistema</a>
              <a href="#como-funciona">Como funciona</a>
              <a href="#planos">Planos</a>
              <a href="#faq">FAQ</a>
            </div>
            <div className="lp-nav-actions">
              <button className="lp-link-plain" onClick={goToLogin}>Entrar</button>
              <button className="lp-btn lp-btn-primary" onClick={goToRegister} style={{ padding:'10px 20px', fontSize:14 }}>
                Teste grátis
              </button>
              <button className="lp-hamburger" onClick={() => setMobileOpen(v => !v)} aria-label="Menu">
                {mobileOpen ? <X size={24} /> : <Menu size={24} />}
              </button>
            </div>
          </nav>
          <div className={`lp-mobile-menu ${mobileOpen ? 'open' : ''}`}>
            <a href="#funcionalidades" onClick={() => setMobileOpen(false)}>Funcionalidades</a>
            <a href="#sistema" onClick={() => setMobileOpen(false)}>O sistema</a>
            <a href="#como-funciona" onClick={() => setMobileOpen(false)}>Como funciona</a>
            <a href="#planos" onClick={() => setMobileOpen(false)}>Planos</a>
            <a href="#faq" onClick={() => setMobileOpen(false)}>FAQ</a>
            <button onClick={goToLogin} style={{ textAlign:'left', padding:'10px 16px', fontWeight:700, color:'#1B2A4A', background:'none', border:'none', cursor:'pointer' }}>Entrar</button>
          </div>
        </div>
      </header>

      <main id="inicio">

        {/* ── Hero ───────────────────────────────────────────────── */}
        <section className="lp-hero">
          <div className="lp-container lp-hero-grid">
            {/* Copy */}
            <div className="lp-hero-copy">
              <span className="lp-eyebrow">Nutrição escolar · PNAE e escolas particulares</span>
              <h1 style={{ marginTop:20 }}>
                A plataforma de{' '}
                <span style={{ color:'var(--lp-green)' }}>nutrição escolar</span>{' '}
                para redes públicas e particulares
              </h1>
              <p className="lp-lead" style={{ marginTop:22 }}>
                O EduPlate Menu organiza cardápios, fiscalização, treinamentos,
                certificados, dietas especiais e documentos — para nutricionistas
                responsáveis técnicas de municípios, consórcios e escolas particulares.
              </p>
              <div className="lp-btn-row">
                <button className="lp-btn lp-btn-primary" onClick={goToRegister}>
                  Começar 1 mês grátis <ArrowRight size={18} />
                </button>
                <a className="lp-btn lp-btn-secondary" href="#sistema">Ver o sistema</a>
              </div>
              <div className="lp-hero-meta">
                <span className="lp-pill">Sem cobranças por 1 mês</span>
                <span className="lp-pill">Cancele a qualquer momento</span>
                <span className="lp-pill">Dados seguros na nuvem</span>
              </div>
            </div>

            {/* Hero mockup — Dashboard real */}
            <div className="lp-hero-card" aria-label="Prévia do sistema">
              <div className="lp-mock-browser">
                <div className="lp-browser-top">
                  <span className="lp-dot lp-dot-red" />
                  <span className="lp-dot lp-dot-yellow" />
                  <span className="lp-dot lp-dot-green" />
                  <div className="lp-url-bar">www.eduplate.com.br</div>
                </div>
                <MockNav />
                <MockDashboard />
              </div>
            </div>
          </div>

          {/* Stats */}
          <div className="lp-container lp-stats">
            {[
              { icon: <Clock size={20} color="#4CAF50" />, big:'1 mês', label:'de acesso grátis para testar' },
              { icon: <Wifi size={20} color="#1A73E8" />, big:'100%', label:'online e na nuvem' },
              { icon: <ShieldCheck size={20} color="#4CAF50" />, big:'600+', label:'alimentos TACO com nutrientes calculados automaticamente' },
              { icon: <Award size={20} color="#FF9800" />, big:'1 dia', label:'para começar a operar' },
            ].map(s => (
              <div key={s.big} className="lp-stat">
                <div style={{ marginBottom:8 }}>{s.icon}</div>
                <div className="lp-stat-big">{s.big}</div>
                <div className="lp-stat-label">{s.label}</div>
              </div>
            ))}
          </div>
        </section>

        {/* ── Para quem é (com fotos) ─────────────────────────────── */}
        <section className="lp-section lp-band">
          <div className="lp-container">
            <span className="lp-eyebrow">Para quem é o EduPlate Menu</span>
            <h2 style={{ marginTop:18, maxWidth:780 }}>
              Para quem cuida da alimentação de crianças nas escolas
            </h2>
            <p className="lp-lead" style={{ marginTop:14 }}>
              Redes públicas, particulares ou consórcios — onde há nutrição escolar, há lugar para o EduPlate Menu.
            </p>

            <div className="lp-who-grid" style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:20, marginTop:32 }}>

              {/* Card 1 — PNAE */}
              <div style={{ borderRadius:24, overflow:'hidden', boxShadow:'0 12px 36px rgba(27,42,74,0.10)', border:'1px solid #E6EBF2', background:'#fff' }}>
                <div style={{ height:200, overflow:'hidden', position:'relative' }}>
                  <img
                    src="/foto-consorcio.png"
                    alt="Pratos saudáveis para crianças"
                    style={{ width:'100%', height:'100%', objectFit:'cover' }}
                  />
                  <div style={{ position:'absolute', inset:0, background:'linear-gradient(to bottom, transparent 40%, rgba(27,42,74,0.55))' }} />
                  <span style={{ position:'absolute', bottom:14, left:16, fontSize:11, fontWeight:800, color:'#fff', background:'rgba(76,175,80,0.85)', borderRadius:99, padding:'3px 10px' }}>PNAE · Rede Pública</span>
                </div>
                <div style={{ padding:'20px 22px' }}>
                  <h3 style={{ fontSize:'1rem', color:'#1B2A4A' }}>Municípios e consórcios</h3>
                  <p style={{ fontSize:13, color:'#64748B', marginTop:8, lineHeight:1.65 }}>
                    Secretarias de educação e nutricionistas RT que gerenciam o PNAE com múltiplas escolas e precisam de rastreabilidade, SIGPC e conformidade.
                  </p>
                </div>
              </div>

              {/* Card 2 — Escolas particulares */}
              <div style={{ borderRadius:24, overflow:'hidden', boxShadow:'0 12px 36px rgba(27,42,74,0.10)', border:'1px solid #E6EBF2', background:'#fff' }}>
                <div style={{ height:200, overflow:'hidden', position:'relative' }}>
                  <img
                    src="/foto-escolas.png"
                    alt="Crianças almoçando na escola"
                    style={{ width:'100%', height:'100%', objectFit:'cover' }}
                  />
                  <div style={{ position:'absolute', inset:0, background:'linear-gradient(to bottom, transparent 40%, rgba(27,42,74,0.55))' }} />
                  <span style={{ position:'absolute', bottom:14, left:16, fontSize:11, fontWeight:800, color:'#fff', background:'rgba(26,115,232,0.85)', borderRadius:99, padding:'3px 10px' }}>Escola Particular</span>
                </div>
                <div style={{ padding:'20px 22px' }}>
                  <h3 style={{ fontSize:'1rem', color:'#1B2A4A' }}>Escolas particulares</h3>
                  <p style={{ fontSize:13, color:'#64748B', marginTop:8, lineHeight:1.65 }}>
                    Nutricionistas de escolas privadas que precisam organizar cardápios, controlar dietas especiais dos alunos e documentar tudo de forma profissional.
                  </p>
                </div>
              </div>

              {/* Card 3 — Nutricionista RT */}
              <div style={{ borderRadius:24, overflow:'hidden', boxShadow:'0 12px 36px rgba(27,42,74,0.10)', border:'1px solid #E6EBF2', background:'#fff' }}>
                <div style={{ height:200, overflow:'hidden', position:'relative' }}>
                  <img
                    src="/foto-nutricionista.png"
                    alt="Nutricionista RT no consultório"
                    style={{ width:'100%', height:'100%', objectFit:'cover' }}
                  />
                  <div style={{ position:'absolute', inset:0, background:'linear-gradient(to bottom, transparent 40%, rgba(27,42,74,0.55))' }} />
                  <span style={{ position:'absolute', bottom:14, left:16, fontSize:11, fontWeight:800, color:'#fff', background:'rgba(255,152,0,0.9)', borderRadius:99, padding:'3px 10px' }}>Nutricionista RT</span>
                </div>
                <div style={{ padding:'20px 22px' }}>
                  <h3 style={{ fontSize:'1rem', color:'#1B2A4A' }}>Nutricionista responsável técnica</h3>
                  <p style={{ fontSize:13, color:'#64748B', marginTop:8, lineHeight:1.65 }}>
                    Profissional autônoma ou vinculada a uma rede que atende múltiplas unidades e precisa centralizar toda a gestão da alimentação escolar em um único sistema.
                  </p>
                </div>
              </div>

            </div>
          </div>
        </section>

        {/* ── Features ───────────────────────────────────────────── */}
        <section className="lp-section" id="funcionalidades">
          <div className="lp-container">
            <span className="lp-eyebrow">Tudo em um só lugar</span>
            <h2 style={{ marginTop:18, maxWidth:700 }}>
              Funcionalidades pensadas para a rotina real da nutrição escolar
            </h2>
            <p className="lp-lead" style={{ marginTop:18 }}>
              O EduPlate Menu foi desenhado para nutricionistas que precisam organizar cardápios, fiscalização e documentação com clareza, padronização e rapidez — em redes públicas ou particulares.
            </p>
            <div className="lp-grid-3" style={{ marginTop:34 }}>
              {FEATURES.map(f => (
                <article key={f.title} className="lp-card">
                  <div className="lp-icon" style={{ background:f.bg }}>{f.icon}</div>
                  <h3>{f.title}</h3>
                  <p>{f.desc}</p>
                </article>
              ))}
            </div>
            <div className="lp-grid-2" style={{ marginTop:18 }}>
              <article className="lp-card" style={{ display:'flex', gap:18, alignItems:'flex-start' }}>
                <div className="lp-icon" style={{ background:'linear-gradient(135deg,#FF5722,#FF8A65)', flexShrink:0 }}><QrCode size={22} color="#fff" /></div>
                <div>
                  <h3>QR Code de presença</h3>
                  <p>Projete no telão durante o treinamento. Participantes escaneiam e se registram diretamente pelo celular — sem papel, sem lista manual.</p>
                </div>
              </article>
              <article className="lp-card" style={{ display:'flex', gap:18, alignItems:'flex-start' }}>
                <div className="lp-icon" style={{ background:'linear-gradient(135deg,#4CAF50,#66BB6A)', flexShrink:0 }}><Mail size={22} color="#fff" /></div>
                <div>
                  <h3>Cardápio por e-mail</h3>
                  <p>Envie o cardápio semanal direto para as escolas com um clique. Sem WhatsApp, sem papel, sem retrabalho — rastreável e organizado.</p>
                </div>
              </article>
            </div>

            {/* ── Destaque banco TACO ──────────────────────────────── */}
            <div style={{
              marginTop: 28,
              background: 'linear-gradient(135deg, #1B2A4A 0%, #243A66 100%)',
              borderRadius: 24,
              padding: '28px 32px',
              display: 'flex',
              alignItems: 'center',
              gap: 32,
              flexWrap: 'wrap',
            }}>
              <div style={{ flex: 1, minWidth: 260 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                  <div style={{ width: 40, height: 40, borderRadius: 12, background: 'linear-gradient(135deg,#43A047,#1B5E20)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <BarChart2 size={20} color="#fff" />
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: 1 }}>Diferencial exclusivo</span>
                </div>
                <h3 style={{ color: '#fff', fontSize: '1.25rem' }}>Banco de 200+ alimentos com cálculo nutricional automático</h3>
                <p style={{ color: 'rgba(255,255,255,0.65)', fontSize: 14, marginTop: 10, lineHeight: 1.65 }}>
                  O EduPlate Menu inclui banco de alimentos baseado na <strong style={{ color: '#81C784' }}>Tabela TACO (UNICAMP)</strong> — o padrão de referência do PNAE. Monte receitas e o sistema calcula automaticamente kcal, proteínas, carboidratos, ferro, vitaminas e muito mais, por porção.
                </p>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12, width: '100%' }}>
                {[
                  { n: '600+', l: 'alimentos cadastrados' },
                  { n: 'TACO', l: 'Tabela UNICAMP' },
                  { n: 'PNAE', l: 'nutrientes PNAE calculados' },
                  { n: '1 clique', l: 'para gerar ficha técnica' },
                ].map(s => (
                  <div key={s.n} style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 14, padding: '14px 10px', textAlign: 'center', minWidth: 0 }}>
                    <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#4CAF50', fontFamily: 'Poppins, sans-serif' }}>{s.n}</div>
                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', marginTop: 4, fontWeight: 600, wordBreak: 'break-word' }}>{s.l}</div>
                  </div>
                ))}
              </div>
            </div>

          </div>
        </section>

        {/* ── Sistema em ação (tab switcher com mockups reais) ──── */}
        <section className="lp-section lp-band" id="sistema">
          <div className="lp-container">
            <span className="lp-eyebrow">O sistema por dentro</span>
            <h2 style={{ marginTop:18 }}>Cada módulo pensado para a sua rotina</h2>
            <p className="lp-lead" style={{ marginTop:18 }}>
              Navegue pelos módulos e veja como o EduPlate Menu funciona na prática,
              com dados reais de municípios que já usam a plataforma.
            </p>

            {/* Tab bar */}
            <div style={{ display:'flex', gap:8, marginTop:28, flexWrap:'wrap' }}>
              {SCREENS.map((s, i) => (
                <button
                  key={s.label}
                  onClick={() => setActiveTab(i)}
                  style={{
                    padding:'9px 18px', borderRadius:99, fontSize:13, fontWeight:700,
                    border:'1px solid', cursor:'pointer', transition:'all 0.18s',
                    background: activeTab === i ? '#1B2A4A' : '#fff',
                    color: activeTab === i ? '#fff' : '#64748B',
                    borderColor: activeTab === i ? '#1B2A4A' : '#E6EBF2',
                  }}
                >
                  {s.label}
                </button>
              ))}
            </div>

            {/* Screen */}
            <div style={{ marginTop:16, borderRadius:20, overflow:'hidden', border:'1px solid #E6EBF2', boxShadow:'0 20px 60px rgba(27,42,74,0.12)' }}>
              {/* Browser chrome */}
              <div style={{ background:'#F8FAFD', borderBottom:'1px solid #E6EBF2', padding:'10px 14px', display:'flex', alignItems:'center', gap:7 }}>
                <span style={{ width:10, height:10, borderRadius:'50%', background:'#FF6057', display:'inline-block' }} />
                <span style={{ width:10, height:10, borderRadius:'50%', background:'#FEBC2E', display:'inline-block' }} />
                <span style={{ width:10, height:10, borderRadius:'50%', background:'#2BC840', display:'inline-block' }} />
                <div style={{ flex:1, background:'#EDF2FA', borderRadius:6, height:22, margin:'0 12px', display:'flex', alignItems:'center', padding:'0 12px', fontSize:11, color:'#8896AA', fontWeight:500 }}>
                  www.eduplate.com.br/{SCREENS[activeTab].label.toLowerCase().replace(' ','-')}
                </div>
              </div>
              <MockNav />
              {SCREENS[activeTab].component}
            </div>
          </div>
        </section>

        {/* ── Vídeo Demo ─────────────────────────────────────────── */}
        {/* ── Faixa de fotos ──────────────────────────────────────── */}
        <div className="lp-photo-strip" style={{ display:'flex', gap:6, height:220, overflow:'hidden' }}>
          {[
            { src:'https://images.unsplash.com/photo-1590779033100-9f60a05a013d?w=500&q=75&auto=format&fit=crop', alt:'Criança sorrindo com merenda' },
            { src:'https://images.unsplash.com/photo-1568702846914-96b305d2aaeb?w=500&q=75&auto=format&fit=crop', alt:'Alimentos saudáveis coloridos' },
            { src:'https://images.unsplash.com/photo-1544025162-d76694265947?w=500&q=75&auto=format&fit=crop', alt:'Refeição nutritiva escolar' },
            { src:'https://images.unsplash.com/photo-1471193945509-9ad0617afabf?w=500&q=75&auto=format&fit=crop', alt:'Criança comendo fruta' },
            { src:'https://images.unsplash.com/photo-1606787366850-de6330128bfc?w=500&q=75&auto=format&fit=crop', alt:'Mesa com refeição saudável' },
          ].map((img, i) => (
            <div key={i} style={{ flex:1, overflow:'hidden', borderRadius: i===0 ? '0 0 0 0' : '0' }}>
              <img src={img.src} alt={img.alt} style={{ width:'100%', height:'100%', objectFit:'cover', display:'block', transition:'transform 0.4s', cursor:'default' }}
                onMouseEnter={e => (e.currentTarget.style.transform='scale(1.06)')}
                onMouseLeave={e => (e.currentTarget.style.transform='scale(1)')}
              />
            </div>
          ))}
        </div>

        <section className="lp-section" style={{ background:'linear-gradient(180deg,#F5F7FA 0%,#EEF2FF 100%)' }}>
          <div className="lp-container" style={{ textAlign:'center' }}>
            <span className="lp-eyebrow">Veja o sistema em ação</span>
            <h2 style={{ marginTop:18 }}>Uma demonstração vale mais do que mil palavras</h2>
            <p className="lp-lead" style={{ margin:'16px auto 32px', textAlign:'center' }}>
              Veja como montar e publicar cardápios para todas as escolas em poucos cliques —
              diretamente no EduPlate Menu.
            </p>

            {/* Video player */}
            <div style={{
              position:'relative',
              maxWidth:860,
              margin:'0 auto',
              borderRadius:20,
              overflow:'hidden',
              boxShadow:'0 32px 80px rgba(27,42,74,0.18)',
              background:'#000',
              border:'1px solid rgba(27,42,74,0.10)',
            }}>
              {/* Browser chrome bar */}
              <div style={{
                background:'#F8FAFD',
                borderBottom:'1px solid #E6EBF2',
                padding:'10px 14px',
                display:'flex',
                alignItems:'center',
                gap:7,
              }}>
                <span style={{ width:10, height:10, borderRadius:'50%', background:'#FF6057', display:'inline-block' }} />
                <span style={{ width:10, height:10, borderRadius:'50%', background:'#FEBC2E', display:'inline-block' }} />
                <span style={{ width:10, height:10, borderRadius:'50%', background:'#2BC840', display:'inline-block' }} />
                <div style={{ flex:1, background:'#EDF2FA', borderRadius:6, height:22, margin:'0 12px', display:'flex', alignItems:'center', padding:'0 12px', fontSize:11, color:'#8896AA', fontWeight:500 }}>
                  app.eduplate.com.br/nutrition/menus
                </div>
              </div>
              <video
                controls
                preload="metadata"
                style={{ width:'100%', display:'block', maxHeight:480, background:'#000' }}
              >
                <source src="/demo-cardapio.mp4" type="video/mp4" />
                Seu navegador não suporta vídeo HTML5.
              </video>
            </div>

            {/* Caption + CTA */}
            <div style={{
              marginTop:32,
              display:'flex',
              flexDirection:'column',
              alignItems:'center',
              gap:16,
            }}>
              <p style={{ fontSize:14, color:'#64748B', maxWidth:540 }}>
                Neste vídeo: montagem de cardápio semanal, seleção de refeições por faixa etária e publicação para todas as escolas com um clique.
              </p>
              <a
                href="mailto:contato@eduplate.com.br?subject=Quero agendar uma demonstração do EduPlate Menu"
                style={{
                  display:'inline-flex',
                  alignItems:'center',
                  gap:10,
                  background:'linear-gradient(135deg,#1B2A4A,#243A66)',
                  color:'#fff',
                  textDecoration:'none',
                  borderRadius:14,
                  padding:'14px 28px',
                  fontSize:15,
                  fontWeight:800,
                  boxShadow:'0 10px 30px rgba(27,42,74,0.22)',
                  fontFamily:"'Poppins', sans-serif",
                  transition:'transform 0.15s',
                }}
                onMouseEnter={e => (e.currentTarget.style.transform='translateY(-2px)')}
                onMouseLeave={e => (e.currentTarget.style.transform='translateY(0)')}
              >
                <ArrowRight size={18} />
                Agendar demonstração ao vivo
              </a>
              <p style={{ fontSize:12, color:'#94A3B8' }}>Sem compromisso · Resposta em até 24h</p>
            </div>
          </div>
        </section>

        {/* ── Credibilidade: Feita por RT ──────────────────────────── */}
        <section style={{ background:'linear-gradient(135deg,#1B2A4A,#243A66)', padding:'52px 0' }}>
          <div className="lp-container" style={{ display:'flex', flexDirection:'column', alignItems:'center', textAlign:'center', gap:24 }}>
            <span style={{ fontSize:11, fontWeight:800, color:'rgba(76,175,80,0.9)', textTransform:'uppercase', letterSpacing:2 }}>
              Desenvolvida por quem entende a sua rotina
            </span>
            <h2 style={{ color:'#fff', fontSize:'clamp(1.6rem,3.5vw,2.4rem)', maxWidth:720, lineHeight:1.25, margin:0 }}>
              Feita por uma Nutricionista RT ativa no PNAE — que conhece cada formulário, cada prazo e cada dor da rotina.
            </h2>
            <p style={{ color:'rgba(255,255,255,0.65)', fontSize:15, maxWidth:620, lineHeight:1.7, margin:0 }}>
              O EduPlate Menu não foi criado por desenvolvedores que nunca viram um cardápio escolar. Cada funcionalidade nasceu de uma necessidade real vivida no município — de quem sabe o que é preencher SIGPC, fiscalizar 20 escolas por mês e ainda gerar relatórios para o FNDE.
            </p>
            <div style={{ display:'flex', flexWrap:'wrap', gap:12, justifyContent:'center', marginTop:8 }}>
              {[
                'Banco TACO/UNICAMP integrado',
                'Relatório SIGPC com 1 clique',
                'Certificados com assinatura digital',
                'Checklist de fiscalização completo',
                'Fichas técnicas com cálculo nutricional',
              ].map(tag => (
                <span key={tag} style={{
                  background:'rgba(255,255,255,0.09)', border:'1px solid rgba(255,255,255,0.15)',
                  borderRadius:99, padding:'7px 16px', fontSize:13, fontWeight:600, color:'rgba(255,255,255,0.85)'
                }}>{tag}</span>
              ))}
            </div>
          </div>
        </section>

        {/* ── Problema / Dores ────────────────────────────────────── */}
        <section className="lp-section lp-band">
          <div className="lp-container lp-problem-wrap">
            <div className="lp-problem-panel">
              <span className="lp-eyebrow">O problema que a gente resolve</span>
              <h2 style={{ marginTop:18 }}>
                Se a nutrição escolar ainda depende de planilha, papel e WhatsApp, você perde tempo e controle
              </h2>
              <p className="lp-lead" style={{ marginTop:18, maxWidth:'100%' }}>
                Em redes públicas ou particulares, a nutricionista responsável técnica acaba absorvendo
                retrabalho que poderia estar automatizado: documentação manual, checklists em papel,
                certificados demorados e informações espalhadas por escola.
              </p>
            </div>
            <div className="lp-pain-list">
              {[
                { t:'Cardápios soltos em conversas e anexos', s:'Sem histórico, sem rastreabilidade e sem controle de versão.' },
                { t:'Fiscalização com papel e caneta', s:'Relatórios demorados e pouca evidência para acompanhamento por unidade.' },
                { t:'Documentos vencendo sem alerta', s:'Risco de pendências em inspeções e perda de prazo por falta de visibilidade.' },
                { t:'Treinamentos sem presença padronizada', s:'Registro manual, certificados demorados e pouca organização do histórico.' },
                { t:'Relatórios refeitos todo mês', s:'Muito esforço operacional para consolidar dados do município.' },
              ].map(item => (
                <div key={item.t} className="lp-pain-item">
                  <span className="lp-pain-bullet" />
                  <div><strong>{item.t}</strong><span>{item.s}</span></div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Antes / Depois ─────────────────────────────────────── */}
        <section className="lp-section">
          <div className="lp-container">
            <span className="lp-eyebrow">Por que escolher o EduPlate Menu</span>
            <h2 style={{ marginTop:18 }}>Menos retrabalho para a equipe. Mais controle para o município.</h2>
            <div className="lp-compare">
              <div className="lp-compare-col" style={{ borderColor:'#FECACA', background:'#FFFAFA' }}>
                <h3 style={{ color:'#DC2626' }}>Antes</h3>
                <ul className="lp-compare-list">
                  {['Processos espalhados em planilhas, papel e mensagens.','Pouca padronização entre escolas e equipes.','Documentos e evidências difíceis de localizar.','Mais risco de esquecimento e retrabalho constante.'].map(t => (
                    <li key={t}><Minus size={16} style={{ color:'#EF4444', flexShrink:0, marginTop:2 }} />{t}</li>
                  ))}
                </ul>
              </div>
              <div className="lp-compare-col" style={{ borderColor:'rgba(76,175,80,0.28)', background:'#F7FBF7' }}>
                <h3 style={{ color:'#2E7D32' }}>Com o EduPlate Menu</h3>
                <ul className="lp-compare-list">
                  {['Operação centralizada em uma plataforma especialista em PNAE.','Fluxos digitais para cardápios, fiscalização e treinamentos.','Histórico organizado por unidade escolar e rotina.','Mais clareza para acompanhar o município e agir com antecedência.'].map(t => (
                    <li key={t}><Check size={16} style={{ color:'#4CAF50', flexShrink:0, marginTop:2 }} />{t}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* ── Como funciona ───────────────────────────────────────── */}
        <section className="lp-section lp-band" id="como-funciona">
          <div className="lp-container">
            <span className="lp-eyebrow">Simples e rápido</span>
            <h2 style={{ marginTop:18 }}>Comece a funcionar em um dia</h2>
            <p className="lp-lead" style={{ marginTop:18 }}>
              Sem implantação longa, sem instalação complexa, com acesso em computador, tablet ou celular.
            </p>
            <div className="lp-steps">
              {[
                { n:'01', title:'Assine o plano', desc:'Escolha o plano ideal para o porte do município e ative o período de teste grátis — nenhuma cobrança no primeiro mês.' },
                { n:'02', title:'Configure em minutos', desc:'Cadastre escolas, equipe e identidade visual do município para começar com a estrutura organizada.' },
                { n:'03', title:'Use de qualquer lugar', desc:'Acesse a plataforma pela web e trabalhe com tudo salvo na nuvem, com praticidade e segurança.' },
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

        {/* ── Planos ─────────────────────────────────────────────── */}
        <section className="lp-section" id="planos">
          <div className="lp-container">
            <span className="lp-eyebrow">Planos e preços</span>
            <h2 style={{ marginTop:18 }}>Planos pensados para o porte da sua rede</h2>
            <p className="lp-lead" style={{ marginTop:18 }}>
              1 mês grátis em qualquer plano. Sem taxa de setup.
            </p>

            {/* ── Toggle de período ─────────────────────────────────── */}
            <div style={{ display:'flex', justifyContent:'center', marginTop:28 }}>
              <div style={{ display:'flex', gap:4, background:'#F1F5F9', borderRadius:99, padding:4 }}>
                {(['mensal','semestral','anual'] as const).map(p => (
                  <button
                    key={p}
                    onClick={() => setBillingPeriod(p)}
                    style={{
                      padding:'9px 22px', borderRadius:99, fontSize:13, fontWeight:700,
                      border:'none', cursor:'pointer', position:'relative',
                      background: billingPeriod === p ? '#fff' : 'transparent',
                      color: billingPeriod === p ? '#1B2A4A' : '#64748B',
                      boxShadow: billingPeriod === p ? '0 2px 8px rgba(27,42,74,0.12)' : 'none',
                      transition:'all 0.18s',
                    }}
                  >
                    {p === 'mensal' ? 'Mensal' : p === 'semestral' ? 'Semestral' : 'Anual'}
                    {p === 'semestral' && (
                      <span style={{
                        position:'absolute', top:-9, right:-2,
                        background: billingPeriod === 'semestral' ? '#4CAF50' : '#4CAF50',
                        color:'#fff', fontSize:9, fontWeight:800,
                        borderRadius:99, padding:'2px 6px', whiteSpace:'nowrap',
                      }}>Recomendado</span>
                    )}
                    {p === 'anual' && billingPeriod !== 'anual' && (
                      <span style={{
                        position:'absolute', top:-9, right:-2,
                        background:'#1A73E8', color:'#fff', fontSize:9,
                        fontWeight:800, borderRadius:99, padding:'2px 6px',
                      }}>−30%</span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* ── Banner oferta — só para períodos com desconto ─────── */}
            {billingPeriod !== 'mensal' && (
              <div style={{
                background:'linear-gradient(135deg,#FF5722,#FF7043)',
                borderRadius:16, padding:'14px 22px',
                display:'flex', alignItems:'center', gap:12,
                marginTop:20, marginBottom:4,
                boxShadow:'0 8px 24px rgba(255,87,34,0.25)',
              }}>
                <span style={{ fontSize:22 }}>⏳</span>
                <div>
                  <div style={{ fontSize:14, fontWeight:800, color:'#fff' }}>Oferta de lançamento — vagas limitadas</div>
                  <div style={{ fontSize:12, color:'rgba(255,255,255,0.85)', marginTop:2 }}>
                    Preços especiais para os primeiros municípios que assinarem. Garanta agora.
                  </div>
                </div>
              </div>
            )}

            <div className="lp-pricing" style={{ marginTop: billingPeriod !== 'mensal' ? 16 : 28 }}>

              {/* Básico */}
              <article className="lp-price-card">
                <h3>Básico</h3>
                <p style={{ color:'var(--lp-muted)', fontSize:14, marginTop:8 }}>Ideal para municípios com até 10 escolas.</p>
                {billingPeriod !== 'mensal' && (
                  <>
                    <span className="lp-price-badge">🔥 {billingPeriod === 'semestral' ? '15% OFF' : '30% OFF'}</span>
                    <span className="lp-price-original">{billingPeriod === 'semestral' ? 'De R$ 294' : 'De R$ 588'}</span>
                  </>
                )}
                <div className="lp-price">
                  {billingPeriod === 'mensal' && <>R$ 49 <small>/mês</small></>}
                  {billingPeriod === 'semestral' && <>R$ 250 <small>/semestre</small></>}
                  {billingPeriod === 'anual' && <>R$ 412 <small>/ano</small></>}
                </div>
                {billingPeriod !== 'mensal' && (
                  <p style={{ fontSize:12, color:'var(--lp-muted)', marginTop:-4, marginBottom:8 }}>
                    {billingPeriod === 'semestral' ? '≈ R$ 41,67/mês' : '≈ R$ 34,33/mês'}
                  </p>
                )}
                <ul className="lp-price-list">
                  {['Cardápios e fichas técnicas','Fiscalização de escolas','Treinamentos + QR Code','Certificados em PDF','Documentos com validade','Relatório SIGPC/FNDE','Suporte por e-mail'].map(i => (
                    <li key={i}><Check size={14} style={{ color:'#4CAF50', flexShrink:0, marginTop:2 }} />{i}</li>
                  ))}
                </ul>
                <div className="lp-spacer" />
                <div className="lp-btn-row" style={{ marginTop:22 }}>
                  <button className="lp-btn lp-btn-secondary" style={{ width:'100%' }} onClick={goToRegister}>Começar 1 mês grátis</button>
                </div>
              </article>

              {/* Essencial */}
              <article className="lp-price-card popular">
                <span className="lp-popular-badge">Mais popular</span>
                <h3>Essencial</h3>
                <p style={{ color:'var(--lp-muted)', fontSize:14, marginTop:8 }}>Para municípios com até 30 escolas.</p>
                {billingPeriod !== 'mensal' && (
                  <>
                    <span className="lp-price-badge">🔥 {billingPeriod === 'semestral' ? '15% OFF' : '30% OFF'}</span>
                    <span className="lp-price-original">{billingPeriod === 'semestral' ? 'De R$ 594' : 'De R$ 1.188'}</span>
                  </>
                )}
                <div className="lp-price">
                  {billingPeriod === 'mensal' && <>R$ 99 <small>/mês</small></>}
                  {billingPeriod === 'semestral' && <>R$ 505 <small>/semestre</small></>}
                  {billingPeriod === 'anual' && <>R$ 832 <small>/ano</small></>}
                </div>
                {billingPeriod !== 'mensal' && (
                  <p style={{ fontSize:12, color:'var(--lp-muted)', marginTop:-4, marginBottom:8 }}>
                    {billingPeriod === 'semestral' ? '≈ R$ 84,17/mês' : '≈ R$ 69,33/mês'}
                  </p>
                )}
                <ul className="lp-price-list">
                  {['Tudo do plano Básico','Usuários ilimitados','Dietas especiais de alunos','Envio de cardápio por e-mail','Controle de EPIs','Suporte prioritário'].map(i => (
                    <li key={i}><Check size={14} style={{ color:'#4CAF50', flexShrink:0, marginTop:2 }} />{i}</li>
                  ))}
                </ul>
                <div className="lp-spacer" />
                <div className="lp-btn-row" style={{ marginTop:22 }}>
                  <button className="lp-btn lp-btn-primary" style={{ width:'100%' }} onClick={goToRegister}>Começar 1 mês grátis</button>
                </div>
              </article>

              {/* Consórcio */}
              <article className="lp-price-card">
                <h3>Consórcio</h3>
                <p style={{ color:'var(--lp-muted)', fontSize:14, marginTop:8 }}>Para redes regionais com múltiplos municípios.</p>
                {billingPeriod !== 'mensal' && (
                  <>
                    <span className="lp-price-badge">🔥 {billingPeriod === 'semestral' ? '15% OFF' : '30% OFF'}</span>
                    <span className="lp-price-original">{billingPeriod === 'semestral' ? 'De R$ 2.394' : 'De R$ 4.788'}</span>
                  </>
                )}
                <div className="lp-price" style={{ fontSize:'1.5rem' }}>
                  {billingPeriod === 'mensal' && <>a partir de <strong>R$ 399</strong><small>/mês</small></>}
                  {billingPeriod === 'semestral' && <>R$ 2.035 <small>/semestre</small></>}
                  {billingPeriod === 'anual' && <>R$ 3.352 <small>/ano</small></>}
                </div>
                {billingPeriod !== 'mensal' && (
                  <p style={{ fontSize:12, color:'var(--lp-muted)', marginTop:-4, marginBottom:8 }}>
                    {billingPeriod === 'semestral' ? '≈ R$ 339,17/mês' : '≈ R$ 279,33/mês'}
                  </p>
                )}
                <ul className="lp-price-list">
                  {['Tudo do plano Essencial','Múltiplos municípios','Logo personalizada','Treinamento presencial','SLA garantido','Suporte dedicado'].map(i => (
                    <li key={i}><Check size={14} style={{ color:'#4CAF50', flexShrink:0, marginTop:2 }} />{i}</li>
                  ))}
                </ul>
                <div className="lp-spacer" />
                <div className="lp-btn-row" style={{ marginTop:22 }}>
                  <a className="lp-btn lp-btn-outline" style={{ width:'100%', justifyContent:'center' }} href="mailto:contato@eduplate.com.br">
                    Falar com especialista
                  </a>
                </div>
              </article>

            </div>
          </div>
        </section>

        {/* ── FAQ ─────────────────────────────────────────────────── */}
        <section className="lp-section lp-band" id="faq">
          <div className="lp-container">
            <span className="lp-eyebrow">Dúvidas frequentes</span>
            <h2 style={{ marginTop:18 }}>Perguntas e respostas</h2>
            <div className="lp-faq">
              {FAQS.map((f, i) => (
                <div key={i} className="lp-faq-item">
                  <button className="lp-faq-q" onClick={() => setOpenFaq(openFaq === i ? null : i)} aria-expanded={openFaq === i}>
                    {f.q}
                    <span className="lp-faq-icon">{openFaq === i ? <ChevronUp size={20} /> : <ChevronDown size={20} />}</span>
                  </button>
                  {openFaq === i && <div className="lp-faq-a">{f.a}</div>}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── CTA ─────────────────────────────────────────────────── */}
        <section className="lp-section-sm">
          <div className="lp-container">
            <div className="lp-cta-box">
              <div className="lp-cta-content">
                <span className="lp-cta-eyebrow">Pronto para profissionalizar a gestão do PNAE</span>
                <h2>Seu município merece uma gestão do PNAE mais organizada, segura e profissional</h2>
                <p>
                  Experimente o EduPlate Menu por 30 dias gratuitamente e veja como a rotina da alimentação
                  escolar pode funcionar com mais controle, visibilidade e padronização.
                </p>
                <div className="lp-btn-row" style={{ marginTop:30 }}>
                  <button className="lp-btn lp-btn-primary" onClick={goToRegister}>
                    Começar grátis agora <ArrowRight size={18} />
                  </button>
                  <a className="lp-btn" href="mailto:contato@eduplate.com.br"
                    style={{ background:'rgba(255,255,255,0.12)', color:'#fff', border:'1px solid rgba(255,255,255,0.22)' }}>
                    Solicitar demonstração
                  </a>
                </div>
              </div>
            </div>
          </div>
        </section>

      </main>

      {/* ── WhatsApp flutuante ─────────────────────────────────── */}
      <a
        href="https://wa.me/5514998762234?text=Olá!%20Tenho%20interesse%20no%20EduPlate%20Menu%20e%20gostaria%20de%20saber%20mais."
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Falar no WhatsApp"
        style={{
          position: 'fixed',
          bottom: 28,
          right: 28,
          zIndex: 9999,
          width: 60,
          height: 60,
          borderRadius: '50%',
          background: '#25D366',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 8px 28px rgba(37,211,102,0.45)',
          transition: 'transform 0.2s, box-shadow 0.2s',
          textDecoration: 'none',
        }}
        onMouseEnter={e => {
          (e.currentTarget as HTMLElement).style.transform = 'scale(1.1)';
          (e.currentTarget as HTMLElement).style.boxShadow = '0 12px 36px rgba(37,211,102,0.55)';
        }}
        onMouseLeave={e => {
          (e.currentTarget as HTMLElement).style.transform = 'scale(1)';
          (e.currentTarget as HTMLElement).style.boxShadow = '0 8px 28px rgba(37,211,102,0.45)';
        }}
      >
        {/* Pulse ring */}
        <span style={{
          position: 'absolute',
          width: '100%',
          height: '100%',
          borderRadius: '50%',
          background: 'rgba(37,211,102,0.35)',
          animation: 'lp-wpp-pulse 2s ease-out infinite',
        }} />
        {/* WhatsApp SVG icon */}
        <svg width="30" height="30" viewBox="0 0 24 24" fill="white" style={{ position: 'relative', zIndex: 1 }}>
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
          <path d="M12 0C5.373 0 0 5.373 0 12c0 2.123.554 4.11 1.523 5.835L.057 23.75l6.064-1.432A11.96 11.96 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818a9.818 9.818 0 01-5.008-1.374l-.36-.213-3.6.851.898-3.499-.233-.373A9.818 9.818 0 0112 2.182c5.42 0 9.818 4.399 9.818 9.818 0 5.42-4.398 9.818-9.818 9.818z"/>
        </svg>
      </a>

      {/* ── Footer ─────────────────────────────────────────────── */}
      <footer className="lp-footer">
        <div className="lp-container">
          <div className="lp-footer-inner">
            <div>
              <EduPlateLogo variant="light" style={{ height:32, marginBottom:8 }} />
              <p className="lp-footer-copy" style={{ marginTop:8 }}>
                Plataforma especialista em PNAE · 100% online<br />
                Rua João Colella, 46 · São Judas II · CEP 18705-489 · Avaré — SP<br />
                contato@eduplate.com.br
              </p>
            </div>
            <div className="lp-footer-links">
              <a href="#funcionalidades">Funcionalidades</a>
              <a href="#sistema">O sistema</a>
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
