/**
 * Módulo: Relatório SIGPC Automático
 * Gera o relatório de prestação de contas ao FNDE (PNAE) com dados já inseridos no sistema.
 */

import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useMenus } from '@/hooks/useMenus';
import { useSchools } from '@/hooks/useFirestore';
import { useAuth } from '@/contexts/AuthContext';
import { CheckCircle2, XCircle, FileText, AlertTriangle, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { addPdfHeader, addPdfFooter, brandColors } from '@/lib/pdfBranding';
import type { Menu } from '@/types/nutrition';

// ── constants ─────────────────────────────────────────────────────────────────

const MONTHS_PT: Record<number, string> = {
  1: 'Janeiro', 2: 'Fevereiro', 3: 'Março',    4: 'Abril',
  5: 'Maio',    6: 'Junho',    7: 'Julho',     8: 'Agosto',
  9: 'Setembro',10: 'Outubro', 11: 'Novembro', 12: 'Dezembro',
};

const QUADRIMESTRES: { label: string; months: number[] }[] = [
  { label: '1º Quadrimestre (Jan–Abr)', months: [1, 2, 3, 4] },
  { label: '2º Quadrimestre (Mai–Ago)', months: [5, 6, 7, 8] },
  { label: '3º Quadrimestre (Set–Dez)', months: [9, 10, 11, 12] },
];

/**
 * Per capita diário FNDE por categoria (R$/aluno/dia).
 * Reajuste de ~14,35% publicado em fevereiro/2026 (Resolução CD/FNDE).
 */
const PERCAPITA_2025: Record<string, number> = {
  'Creche / Integral': 1.37,
  'Pré-escola':        0.72,
  'Ensino Infantil':   0.72,  // mesmo per capita que Pré-escola (não integral)
  'Fundamental 1':     0.50,
  'Fundamental 2':     0.50,
  'Médio':             0.50,
  'EJA':               0.41,
  'Indígena/Quilombola': 0.86,
  'AEE':               0.67,
};

const PERCAPITA_2026: Record<string, number> = {
  'Creche / Integral': 1.57,
  'Pré-escola':        0.82,
  'Ensino Infantil':   0.82,  // mesmo per capita que Pré-escola (não integral)
  'Fundamental 1':     0.57,
  'Fundamental 2':     0.57,
  'Médio':             0.57,
  'EJA':               0.57,  // equiparado ao ensino regular
  'Indígena/Quilombola': 0.98,
  'AEE':               0.77,
};

function getPercapitaTable(year: number): Record<string, number> {
  return year >= 2026 ? PERCAPITA_2026 : PERCAPITA_2025;
}

const CATEGORY_OPTIONS = Object.keys(PERCAPITA_2026);

// ── helpers ───────────────────────────────────────────────────────────────────

/** Tries to extract a month number (1-12) from a free-text referenceMonth string. */
function monthFromString(ref: string): number | null {
  const lower = ref.toLowerCase();
  for (const [num, name] of Object.entries(MONTHS_PT)) {
    if (lower.includes(name.toLowerCase())) return Number(num);
  }
  // Try YYYY-MM format
  const m = ref.match(/(\d{4})[.\-/](\d{1,2})/);
  if (m) return Number(m[2]);
  return null;
}

function yearFromString(ref: string): number | null {
  const m = ref.match(/\b(20\d{2})\b/);
  return m ? Number(m[1]) : null;
}

const fmt2 = (n: number) => n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtPct = (n: number) => `${n.toFixed(1)}%`;

// ── entity config (saved to localStorage, org-scoped) ────────────────────────

const LEGACY_ORG_ID = 'pnae-default-org';

function configKey(orgId: string): string {
  return `pnae_sigpc_entity_config_${orgId}`;
}

interface EntityConfig {
  municipio: string;
  uf: string;
  cnpj: string;
  responsavel: string;
  numeroProcesso: string;
  nutricionista: string;
  crn: string;
}

function loadEntityConfig(orgId: string): EntityConfig {
  try {
    const raw = localStorage.getItem(configKey(orgId));
    if (raw) return { ...defaultEntity(), ...JSON.parse(raw) };
    // Backward-compat: try old flat key once
    const legacy = localStorage.getItem('pnae_sigpc_entity_config');
    if (legacy) return { ...defaultEntity(), ...JSON.parse(legacy) };
  } catch { /* ignore */ }
  return defaultEntity();
}

function defaultEntity(): EntityConfig {
  return {
    municipio: '',
    uf: 'SP',
    cnpj: '',
    responsavel: '',
    numeroProcesso: '',
    nutricionista: '',
    crn: '',
  };
}

// ── execution segment row ─────────────────────────────────────────────────────

type TurnoPeriodo = 'Manhã' | 'Tarde' | 'Integral' | 'Único';

interface SegmentRow {
  category: string;
  period: TurnoPeriodo;
  students: string;
  schoolDays: string;
  mealsPerDay: string;
}

const PERIODO_OPTIONS: TurnoPeriodo[] = ['Manhã', 'Tarde', 'Integral', 'Único'];

const emptySegment = (category: string, period: TurnoPeriodo = 'Manhã'): SegmentRow => ({
  category,
  period,
  students:    '',
  schoolDays:  '',
  // Integral = more meals; partial = 1
  mealsPerDay: period === 'Integral' ? '3' : '1',
});

// ── PDF ────────────────────────────────────────────────────────────────────────

async function generateSigpcPDF(params: {
  entity: EntityConfig;
  year: string;
  quadrimestre: typeof QUADRIMESTRES[number];
  menusByPeriod: Menu[];
  schools: { id: string; name: string }[];
  segments: SegmentRow[];
  totalReceived: string;
  totalSpent: string;
  totalFamilyFarm: string;
  avgFamilyFarmPct: number;
}) {
  const {
    entity, year, quadrimestre, menusByPeriod,
    schools, segments, totalReceived, totalSpent,
    totalFamilyFarm, avgFamilyFarmPct,
  } = params;

  const doc = new jsPDF();
  const pw  = doc.internal.pageSize.getWidth();
  const ph  = doc.internal.pageSize.getHeight();
  const green = brandColors.green as [number, number, number];

  const percapitaTable = getPercapitaTable(Number(params.year));

  let y = await addPdfHeader(doc, {
    title: 'RELATÓRIO SIGPC — PRESTAÇÃO DE CONTAS PNAE',
    subtitle: `${entity.municipio}/${entity.uf}  ·  ${quadrimestre.label}  ·  Exercício ${year}`,
  });

  // ── 1. Identificação ──────────────────────────────────────────────────────
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...green);
  doc.text('1. IDENTIFICAÇÃO DA ENTIDADE EXECUTORA', 15, y);
  y += 4;

  autoTable(doc, {
    startY: y,
    body: [
      ['Município / UF', `${entity.municipio} / ${entity.uf}`, 'CNPJ', entity.cnpj],
      ['Responsável legal', entity.responsavel, 'Nº Processo', entity.numeroProcesso],
      ['Nutricionista RT', entity.nutricionista, 'CRN', entity.crn],
    ],
    theme: 'grid',
    styles: { fontSize: 8, cellPadding: 2.5 },
    columnStyles: {
      0: { fontStyle: 'bold', fillColor: [240, 253, 244], cellWidth: 42 },
      1: { cellWidth: 58 },
      2: { fontStyle: 'bold', fillColor: [240, 253, 244], cellWidth: 32 },
      3: { cellWidth: 58 },
    },
  });
  y = (doc as any).lastAutoTable.finalY + 8;

  // ── 2. Cardápios elaborados ───────────────────────────────────────────────
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...green);
  doc.text(`2. CARDÁPIOS ELABORADOS NO PERÍODO (${menusByPeriod.length} cardápios)`, 15, y);
  y += 4;

  if (menusByPeriod.length === 0) {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(8);
    doc.setTextColor(120, 120, 120);
    doc.text('Nenhum cardápio encontrado para o período selecionado.', 15, y + 4);
    y += 12;
  } else {
    autoTable(doc, {
      startY: y,
      head: [['Cardápio', 'Referência', 'Categorias', 'Kcal/porção', '% Ag. Familiar', 'Custo/porção']],
      body: menusByPeriod.map((m) => [
        m.title,
        m.referenceMonth || '—',
        (m.targetCategories || [m.category]).join(', '),
        m.averageKcal.toFixed(0),
        fmtPct(m.familyFarmShare),
        `R$ ${fmt2(m.averageCost)}`,
      ]),
      theme: 'striped',
      headStyles: { fillColor: green, textColor: 255, fontSize: 8, fontStyle: 'bold' },
      bodyStyles: { fontSize: 7.5 },
    });
    y = (doc as any).lastAutoTable.finalY + 8;
  }

  // ── 3. Escolas atendidas ──────────────────────────────────────────────────
  if (y > ph - 50) { doc.addPage(); y = 15; }
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...green);
  doc.text(`3. ESCOLAS ATENDIDAS (${schools.length} unidades)`, 15, y);
  y += 4;

  const schoolCols = 3;
  const schoolRows: string[][] = [];
  for (let i = 0; i < schools.length; i += schoolCols) {
    schoolRows.push(schools.slice(i, i + schoolCols).map((s) => s.name));
    // pad last row
    while (schoolRows[schoolRows.length - 1].length < schoolCols)
      schoolRows[schoolRows.length - 1].push('');
  }

  autoTable(doc, {
    startY: y,
    body: schoolRows.length > 0 ? schoolRows : [['—', '', '']],
    theme: 'grid',
    styles: { fontSize: 7.5, cellPadding: 2 },
    columnStyles: { 0: { cellWidth: 60 }, 1: { cellWidth: 60 }, 2: { cellWidth: 60 } },
  });
  y = (doc as any).lastAutoTable.finalY + 8;

  // ── 4. Execução por segmento ──────────────────────────────────────────────
  const activeSegs = segments.filter((s) => Number(s.students) > 0 && Number(s.schoolDays) > 0);

  if (activeSegs.length > 0) {
    if (y > ph - 60) { doc.addPage(); y = 15; }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(...green);
    doc.text('4. EXECUÇÃO POR SEGMENTO', 15, y);
    y += 4;

    let totalRefeicoes = 0;
    let totalValorSeg = 0;
    const segBody = activeSegs.map((s) => {
      const alunos     = Number(s.students) || 0;
      const dias       = Number(s.schoolDays) || 0;
      const refeicoes  = alunos * dias * (Number(s.mealsPerDay) || 1);
      const perCapita  = percapitaTable[s.category] ?? 0.57;
      const valor      = alunos * dias * perCapita;
      totalRefeicoes  += refeicoes;
      totalValorSeg   += valor;
      return [
        s.category,
        s.period,
        alunos.toLocaleString('pt-BR'),
        dias.toString(),
        s.mealsPerDay,
        refeicoes.toLocaleString('pt-BR'),
        `R$ ${fmt2(perCapita)}`,
        `R$ ${fmt2(valor)}`,
      ];
    });

    // Subtotal F2 + Médio
    const f2MedioActiveSegs = activeSegs.filter(
      (s) => s.category === 'Fundamental 2' || s.category === 'Médio',
    );
    if (f2MedioActiveSegs.length > 0) {
      const f2Students = f2MedioActiveSegs.reduce((s, r) => s + (Number(r.students) || 0), 0);
      const f2Ref = f2MedioActiveSegs.reduce((s, r) => {
        return s + (Number(r.students) || 0) * (Number(r.schoolDays) || 0) * (Number(r.mealsPerDay) || 1);
      }, 0);
      const f2Val = f2MedioActiveSegs.reduce((s, r) => {
        return s + (Number(r.students) || 0) * (Number(r.schoolDays) || 0) * (percapitaTable[r.category] ?? 0.57);
      }, 0);
      segBody.push([
        'Fund. 2 + Médio (total)', '—',
        f2Students.toLocaleString('pt-BR'),
        '—', '—',
        f2Ref.toLocaleString('pt-BR'),
        '—',
        `R$ ${fmt2(f2Val)}`,
      ]);
    }

    segBody.push([
      'TOTAL GERAL', '—', '—', '—', '—',
      totalRefeicoes.toLocaleString('pt-BR'),
      '—',
      `R$ ${fmt2(totalValorSeg)}`,
    ]);

    autoTable(doc, {
      startY: y,
      head: [['Segmento', 'Período', 'Alunos', 'Dias', 'Ref./dia', 'Total Ref.', 'Per capita', 'Valor FNDE']],
      body: segBody,
      theme: 'grid',
      headStyles: { fillColor: green, textColor: 255, fontSize: 8, fontStyle: 'bold' },
      bodyStyles: { fontSize: 8 },
      willDrawCell: (d) => {
        if (d.section !== 'body') return;
        const lastIdx = segBody.length - 1;
        const subtotalIdx = lastIdx - 1; // F2+Médio row (only present when f2MedioActiveSegs.length > 0)
        if (d.row.index === lastIdx) {
          // TOTAL GERAL row
          d.cell.styles.fontStyle = 'bold';
          d.cell.styles.fillColor = [240, 253, 244];
        } else if (f2MedioActiveSegs.length > 0 && d.row.index === subtotalIdx) {
          // Subtotal F2+Médio row
          d.cell.styles.fontStyle = 'bold';
          d.cell.styles.fillColor = [238, 242, 255]; // indigo-50
          d.cell.styles.textColor = [55, 48, 163];   // indigo-700
        }
      },
    });
    y = (doc as any).lastAutoTable.finalY + 8;
  }

  // ── 5. Recursos financeiros ───────────────────────────────────────────────
  if (y > ph - 60) { doc.addPage(); y = 15; }
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...green);
  doc.text('5. EXECUÇÃO FINANCEIRA', 15, y);
  y += 4;

  const rec    = Number(totalReceived.replace(',', '.')) || 0;
  const spent  = Number(totalSpent.replace(',', '.'))    || 0;
  const af     = Number(totalFamilyFarm.replace(',', '.')) || 0;
  const afPct  = spent > 0 ? (af / spent) * 100 : 0;
  const saldo  = rec - spent;
  const minAf  = Number(params.year) >= 2026 ? 45 : 30;

  autoTable(doc, {
    startY: y,
    body: [
      ['Total de recursos recebidos (FNDE)',  `R$ ${fmt2(rec)}`],
      ['Total aplicado em gêneros alimentícios', `R$ ${fmt2(spent)}`],
      ['Saldo do período',                    `R$ ${fmt2(saldo)}`],
      ['Valor destinado à Agricultura Familiar', `R$ ${fmt2(af)}`],
      ['% Agricultura Familiar (calculado)',  fmtPct(afPct)],
      ['% Agricultura Familiar (média cardápios)', fmtPct(avgFamilyFarmPct)],
    ],
    theme: 'grid',
    styles: { fontSize: 8.5, cellPadding: 3 },
    columnStyles: {
      0: { fontStyle: 'bold', fillColor: [240, 253, 244], cellWidth: 110 },
      1: { cellWidth: 80 },
    },
    willDrawCell: (d) => {
      // Highlight AF row if below minimum
      if (d.row.index === 4 && d.section === 'body' && afPct < minAf && afPct > 0) {
        d.cell.styles.textColor = [185, 28, 28];
        d.cell.styles.fontStyle = 'bold';
      }
    },
  });
  y = (doc as any).lastAutoTable.finalY + 8;

  // ── 6. Indicadores de conformidade ───────────────────────────────────────
  if (y > ph - 50) { doc.addPage(); y = 15; }
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...green);
  doc.text('6. INDICADORES DE CONFORMIDADE PNAE', 15, y);
  y += 4;

  const checks: [string, boolean, string][] = [
    [`Percentual de Agricultura Familiar >= ${minAf}%`, afPct >= minAf || avgFamilyFarmPct >= minAf, afPct > 0 ? fmtPct(afPct) : fmtPct(avgFamilyFarmPct)],
    ['Cardápios elaborados por nutricionista RT', true, entity.crn || '—'],
    ['Cardápios registrados no período', menusByPeriod.length > 0, `${menusByPeriod.length} cardápio(s)`],
    ['Escolas atendidas registradas', schools.length > 0, `${schools.length} escola(s)`],
    ['Nutricionista RT identificada', !!entity.nutricionista && !!entity.crn, `${entity.nutricionista} — ${entity.crn}`],
  ];

  autoTable(doc, {
    startY: y,
    head: [['Indicador', 'Status', 'Valor']],
    body: checks.map(([label, ok, val]) => [label, ok ? '✓ Conforme' : '✗ Pendente', val]),
    theme: 'grid',
    headStyles: { fillColor: green, textColor: 255, fontSize: 8, fontStyle: 'bold' },
    bodyStyles: { fontSize: 8 },
    willDrawCell: (d) => {
      if (d.column.index === 1 && d.section === 'body') {
        const ok = checks[d.row.index]?.[1];
        d.cell.styles.textColor = ok ? [22, 101, 52] : [185, 28, 28];
        d.cell.styles.fontStyle = 'bold';
      }
    },
  });
  y = (doc as any).lastAutoTable.finalY + 10;

  // Signature area
  if (y > ph - 35) { doc.addPage(); y = 15; }
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(80, 80, 80);
  doc.text(
    `${entity.municipio}, _______ de _________________ de ${year}.`,
    pw / 2, y, { align: 'center' },
  );
  y += 14;
  doc.line(pw / 2 - 50, y, pw / 2 + 50, y);
  y += 4;
  doc.text(`${entity.nutricionista}  —  ${entity.crn}`, pw / 2, y, { align: 'center' });
  y += 4;
  doc.text('Nutricionista Responsável Técnica — PNAE', pw / 2, y, { align: 'center' });

  addPdfFooter(doc);
  const filename = `SIGPC_${entity.municipio.replace(/\s+/g, '_')}_${quadrimestre.months[0]}a${quadrimestre.months.slice(-1)[0]}_${year}.pdf`;
  doc.save(filename);
  toast.success('Relatório SIGPC gerado com sucesso!');
}

// ── component ─────────────────────────────────────────────────────────────────

export default function SigpcReport() {
  const { user }   = useAuth();
  const orgId      = user?.organizationId || LEGACY_ORG_ID;
  const { menus }   = useMenus();
  const { schools } = useSchools();

  // Period selection
  const currentYear = new Date().getFullYear();
  const [year,           setYear]           = useState(String(currentYear));
  const [quadIndex,      setQuadIndex]      = useState(0);

  // Entity config (lazy init so orgId is available)
  const [entity, setEntity] = useState<EntityConfig>(() => loadEntityConfig(orgId));
  const [entityOpen, setEntityOpen] = useState(false);

  // Financial data
  const [totalReceived,   setTotalReceived]   = useState('');
  const [totalSpent,      setTotalSpent]      = useState('');
  const [totalFamilyFarm, setTotalFamilyFarm] = useState('');

  // Segments — two periods for regular teaching; Creche as integral
  const [segments, setSegments] = useState<SegmentRow[]>([
    emptySegment('Ensino Infantil', 'Manhã'),
    emptySegment('Ensino Infantil', 'Tarde'),
    emptySegment('Fundamental 1', 'Manhã'),
    emptySegment('Fundamental 1', 'Tarde'),
    emptySegment('Fundamental 2', 'Manhã'),
    emptySegment('Fundamental 2', 'Tarde'),
    emptySegment('Médio', 'Manhã'),
    emptySegment('Médio', 'Tarde'),
    emptySegment('Creche / Integral', 'Integral'),
  ]);

  const saveEntity = (next: EntityConfig) => {
    setEntity(next);
    localStorage.setItem(configKey(orgId), JSON.stringify(next));
    toast.success('Dados da entidade salvos.');
    setEntityOpen(false);
  };

  // ── derived ────────────────────────────────────────────────────────────────

  const quadrimestre = QUADRIMESTRES[quadIndex];

  const menusByPeriod = useMemo(() => {
    const selectedMonths = quadrimestre.months;
    const selectedYear   = Number(year);
    return menus.filter((m) => {
      if (!m.referenceMonth) return false;
      const monthNum = monthFromString(m.referenceMonth);
      const yearNum  = yearFromString(m.referenceMonth);
      if (monthNum === null) return false;
      if (yearNum !== null && yearNum !== selectedYear) return false;
      return selectedMonths.includes(monthNum);
    });
  }, [menus, year, quadrimestre]);

  const avgFamilyFarmPct = useMemo(() => {
    if (menusByPeriod.length === 0) return 0;
    return menusByPeriod.reduce((s, m) => s + (m.familyFarmShare || 0), 0) / menusByPeriod.length;
  }, [menusByPeriod]);

  const avgKcal = useMemo(() => {
    if (menusByPeriod.length === 0) return 0;
    return menusByPeriod.reduce((s, m) => s + (m.averageKcal || 0), 0) / menusByPeriod.length;
  }, [menusByPeriod]);

  // Per capita table — switches automatically by year
  const percapitaTable = useMemo(() => getPercapitaTable(Number(year)), [year]);

  const rec   = Number(totalReceived.replace(',', '.'))   || 0;
  const spent = Number(totalSpent.replace(',', '.'))      || 0;
  const af    = Number(totalFamilyFarm.replace(',', '.')) || 0;
  const afPct = spent > 0 ? (af / spent) * 100 : 0;

  // Exigência mínima de AF: 30% até 2025; 45% a partir de 2026 (Resolução CD/FNDE)
  const minAfPct = Number(year) >= 2026 ? 45 : 30;

  const afOk = afPct >= minAfPct || avgFamilyFarmPct >= minAfPct;

  // ── segment helpers ────────────────────────────────────────────────────────

  const updateSegment = (idx: number, field: keyof SegmentRow, value: string) => {
    setSegments((prev) => prev.map((s, i) => {
      if (i !== idx) return s;
      const updated = { ...s, [field]: value };
      // When changing period, auto-adjust mealsPerDay default
      if (field === 'period') {
        updated.mealsPerDay = value === 'Integral' ? '3' : '1';
      }
      return updated;
    }));
  };

  const addSegment = () => setSegments((prev) => [...prev, emptySegment('Fundamental 1', 'Manhã')]);
  const removeSegment = (idx: number) => setSegments((prev) => prev.filter((_, i) => i !== idx));

  // ── totals preview ─────────────────────────────────────────────────────────

  const totalRefeicoes = useMemo(() =>
    segments.reduce((sum, s) => {
      const a = Number(s.students) || 0;
      const d = Number(s.schoolDays) || 0;
      const r = Number(s.mealsPerDay) || 1;
      return sum + a * d * r;
    }, 0), [segments]);

  const totalValorFnde = useMemo(() =>
    segments.reduce((sum, s) => {
      const a = Number(s.students) || 0;
      const d = Number(s.schoolDays) || 0;
      const pc = percapitaTable[s.category] ?? 0.57;
      return sum + a * d * pc;
    }, 0), [segments, percapitaTable]);

  // ── Fundamental 2 + Médio subtotals ──────────────────────────────────────
  const f2MedioSegs = useMemo(
    () => segments.filter((s) => s.category === 'Fundamental 2' || s.category === 'Médio'),
    [segments],
  );
  const f2MedioStudents = useMemo(
    () => f2MedioSegs.reduce((sum, s) => sum + (Number(s.students) || 0), 0),
    [f2MedioSegs],
  );
  const f2MedioRefeicoes = useMemo(
    () => f2MedioSegs.reduce((sum, s) => {
      const a = Number(s.students) || 0;
      const d = Number(s.schoolDays) || 0;
      const r = Number(s.mealsPerDay) || 1;
      return sum + a * d * r;
    }, 0),
    [f2MedioSegs],
  );
  const f2MedioValor = useMemo(
    () => f2MedioSegs.reduce((sum, s) => {
      const a = Number(s.students) || 0;
      const d = Number(s.schoolDays) || 0;
      const pc = percapitaTable[s.category] ?? 0.57;
      return sum + a * d * pc;
    }, 0),
    [f2MedioSegs, percapitaTable],
  );

  // ── render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex-1 p-4 md:p-8 bg-gray-50 min-h-screen">
      <div className="max-w-5xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Relatório SIGPC</h1>
            <p className="text-gray-600 mt-1">
              Prestação de contas ao FNDE — dados preenchidos automaticamente do sistema.
            </p>
          </div>
          <Button
            onClick={() =>
              generateSigpcPDF({
                entity, year, quadrimestre,
                menusByPeriod, schools,
                segments, totalReceived, totalSpent,
                totalFamilyFarm, avgFamilyFarmPct,
              }).catch(() => toast.error('Erro ao gerar PDF.'))
            }
            className="bg-green-700 hover:bg-green-800 shrink-0 gap-2"
          >
            <FileText className="w-4 h-4" />
            Gerar PDF SIGPC
          </Button>
        </div>

        {/* ── Período ── */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Período de Referência</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-4 items-end">
              <div>
                <Label>Exercício (ano)</Label>
                <Input
                  type="number"
                  value={year}
                  onChange={(e) => setYear(e.target.value)}
                  className="mt-1.5 w-28"
                  min="2020"
                  max="2099"
                />
              </div>
              <div className="flex-1 min-w-48">
                <Label>Quadrimestre</Label>
                <Select value={String(quadIndex)} onValueChange={(v) => setQuadIndex(Number(v))}>
                  <SelectTrigger className="mt-1.5">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {QUADRIMESTRES.map((q, i) => (
                      <SelectItem key={i} value={String(i)}>{q.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="text-sm text-gray-500 pb-1">
                Meses:{' '}
                <span className="font-medium text-gray-700">
                  {quadrimestre.months.map((m) => MONTHS_PT[m]).join(', ')}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ── Dados da entidade ── */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Dados da Entidade Executora</CardTitle>
              <Button variant="outline" size="sm" onClick={() => setEntityOpen((o) => !o)}>
                {entityOpen ? 'Fechar' : 'Editar'}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {!entityOpen ? (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-x-8 gap-y-1 text-sm">
                <div><span className="text-gray-500">Município/UF:</span> <span className="font-medium">{entity.municipio || '—'}/{entity.uf}</span></div>
                <div><span className="text-gray-500">CNPJ:</span> <span className="font-medium">{entity.cnpj || '—'}</span></div>
                <div><span className="text-gray-500">Nº Processo:</span> <span className="font-medium">{entity.numeroProcesso || '—'}</span></div>
                <div><span className="text-gray-500">Responsável:</span> <span className="font-medium">{entity.responsavel || '—'}</span></div>
                <div><span className="text-gray-500">Nutricionista RT:</span> <span className="font-medium">{entity.nutricionista}</span></div>
                <div><span className="text-gray-500">CRN:</span> <span className="font-medium">{entity.crn}</span></div>
              </div>
            ) : (
              <EntityForm initial={entity} onSave={saveEntity} onCancel={() => setEntityOpen(false)} />
            )}
          </CardContent>
        </Card>

        {/* ── Cardápios do período (auto) ── */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              Cardápios Elaborados no Período
              <span className="text-xs font-normal text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                {menusByPeriod.length} encontrado{menusByPeriod.length !== 1 ? 's' : ''}
              </span>
              <span className="ml-auto text-xs font-normal text-gray-400 flex items-center gap-1">
                <RefreshCw className="w-3 h-3" /> Preenchido automaticamente
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {menusByPeriod.length === 0 ? (
              <p className="text-sm text-gray-400 italic">
                Nenhum cardápio encontrado para {quadrimestre.label} de {year}.
                Verifique se o campo "Mês de referência" dos cardápios está preenchido corretamente (ex.: "Maio 2026").
              </p>
            ) : (
              <div className="space-y-2">
                {/* Summary pills */}
                <div className="flex flex-wrap gap-3 text-sm pb-2">
                  <Pill color="green">% AF médio: {fmtPct(avgFamilyFarmPct)}</Pill>
                  <Pill color="blue">Kcal médio/porção: {avgKcal.toFixed(0)}</Pill>
                  <Pill color="gray">Cardápios: {menusByPeriod.length}</Pill>
                </div>

                <div className="rounded-lg border overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-green-50">
                      <tr>
                        <th className="text-left px-3 py-2 font-medium text-gray-700">Cardápio</th>
                        <th className="text-left px-3 py-2 font-medium text-gray-700">Referência</th>
                        <th className="text-left px-3 py-2 font-medium text-gray-700">Categorias</th>
                        <th className="text-right px-3 py-2 font-medium text-gray-700">% AF</th>
                        <th className="text-right px-3 py-2 font-medium text-gray-700">Kcal/porção</th>
                      </tr>
                    </thead>
                    <tbody>
                      {menusByPeriod.map((m) => (
                        <tr key={m.id} className="border-t">
                          <td className="px-3 py-2">{m.title}</td>
                          <td className="px-3 py-2 text-gray-600">{m.referenceMonth}</td>
                          <td className="px-3 py-2 text-gray-600 text-xs">
                            {(m.targetCategories || [m.category]).join(', ')}
                          </td>
                          <td className="px-3 py-2 text-right">
                            <span className={m.familyFarmShare >= minAfPct ? 'text-green-700 font-semibold' : 'text-amber-600 font-semibold'}>
                              {fmtPct(m.familyFarmShare)}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-right text-gray-700">{m.averageKcal.toFixed(0)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── Execução por segmento ── */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Execução por Segmento</CardTitle>
              <Button variant="outline" size="sm" onClick={addSegment}>+ Segmento</Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg border overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-green-50">
                  <tr>
                    <th className="text-left px-3 py-2 font-medium text-gray-700">Segmento</th>
                    <th className="text-left px-3 py-2 font-medium text-gray-700">Período</th>
                    <th className="text-center px-3 py-2 font-medium text-gray-700">Alunos</th>
                    <th className="text-center px-3 py-2 font-medium text-gray-700">Dias</th>
                    <th className="text-center px-3 py-2 font-medium text-gray-700">Ref./dia</th>
                    <th className="text-right px-3 py-2 font-medium text-gray-700">Total ref.</th>
                    <th className="text-right px-3 py-2 font-medium text-gray-700">Per capita</th>
                    <th className="text-right px-3 py-2 font-medium text-gray-700">Valor FNDE</th>
                    <th className="w-8"></th>
                  </tr>
                </thead>
                <tbody>
                  {segments.map((s, i) => {
                    const a  = Number(s.students) || 0;
                    const d  = Number(s.schoolDays) || 0;
                    const r  = Number(s.mealsPerDay) || 1;
                    const pc = percapitaTable[s.category] ?? 0.57;
                    return (
                      <tr key={i} className={`border-t ${s.period === 'Integral' ? 'bg-blue-50/40' : ''}`}>
                        <td className="px-2 py-1.5">
                          <Select value={s.category} onValueChange={(v) => updateSegment(i, 'category', v)}>
                            <SelectTrigger className="h-8 text-xs w-36">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {CATEGORY_OPTIONS.map((c) => (
                                <SelectItem key={c} value={c}>{c}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="px-2 py-1.5">
                          <Select value={s.period} onValueChange={(v) => updateSegment(i, 'period', v)}>
                            <SelectTrigger className="h-8 text-xs w-28">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {PERIODO_OPTIONS.map((p) => (
                                <SelectItem key={p} value={p}>{p}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="px-2 py-1.5">
                          <Input type="number" value={s.students} onChange={(e) => updateSegment(i, 'students', e.target.value)}
                            className="h-8 text-center text-sm w-24 mx-auto" min="0" placeholder="0" />
                        </td>
                        <td className="px-2 py-1.5">
                          <Input type="number" value={s.schoolDays} onChange={(e) => updateSegment(i, 'schoolDays', e.target.value)}
                            className="h-8 text-center text-sm w-16 mx-auto" min="0" placeholder="0" />
                        </td>
                        <td className="px-2 py-1.5">
                          <Input type="number" value={s.mealsPerDay} onChange={(e) => updateSegment(i, 'mealsPerDay', e.target.value)}
                            className="h-8 text-center text-sm w-16 mx-auto" min="1" max="5" />
                        </td>
                        <td className="px-3 py-1.5 text-right text-gray-700 font-medium">
                          {(a * d * r).toLocaleString('pt-BR')}
                        </td>
                        <td className="px-3 py-1.5 text-right text-gray-500">
                          R$ {fmt2(pc)}
                        </td>
                        <td className="px-3 py-1.5 text-right font-semibold text-gray-900">
                          R$ {fmt2(a * d * pc)}
                        </td>
                        <td className="px-2">
                          {segments.length > 1 && (
                            <button onClick={() => removeSegment(i)} className="text-gray-300 hover:text-red-500">✕</button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot className="bg-gray-50">
                  {f2MedioStudents > 0 && (
                    <tr className="border-t bg-indigo-50/60 text-xs">
                      <td colSpan={2} className="px-3 py-1.5 font-semibold text-indigo-700">
                        Fundamental 2 + Médio (total)
                      </td>
                      <td className="px-3 py-1.5 text-center font-semibold text-indigo-800">
                        {f2MedioStudents.toLocaleString('pt-BR')}
                      </td>
                      <td className="px-3 py-1.5 text-center text-gray-400">—</td>
                      <td className="px-3 py-1.5 text-right font-medium text-indigo-700">
                        {f2MedioRefeicoes.toLocaleString('pt-BR')}
                      </td>
                      <td className="px-3 py-1.5 text-right text-gray-400">—</td>
                      <td className="px-3 py-1.5 text-right font-semibold text-indigo-700">
                        R$ {fmt2(f2MedioValor)}
                      </td>
                      <td></td>
                    </tr>
                  )}
                  <tr className="border-t-2">
                    <td className="px-3 py-2 font-bold text-gray-900" colSpan={4}>TOTAL GERAL</td>
                    <td className="px-3 py-2 text-right font-bold">{totalRefeicoes.toLocaleString('pt-BR')}</td>
                    <td className="px-3 py-2 text-right text-gray-400">—</td>
                    <td className="px-3 py-2 text-right font-bold text-green-800">R$ {fmt2(totalValorFnde)}</td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* ── Recursos financeiros ── */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Execução Financeira</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <Label>Recursos recebidos do FNDE (R$)</Label>
                <Input value={totalReceived} onChange={(e) => setTotalReceived(e.target.value)}
                  placeholder="Ex.: 45000.00" className="mt-1.5" />
              </div>
              <div>
                <Label>Total aplicado em gêneros (R$)</Label>
                <Input value={totalSpent} onChange={(e) => setTotalSpent(e.target.value)}
                  placeholder="Ex.: 42000.00" className="mt-1.5" />
              </div>
              <div>
                <Label>Valor destinado à Agricultura Familiar (R$)</Label>
                <Input value={totalFamilyFarm} onChange={(e) => setTotalFamilyFarm(e.target.value)}
                  placeholder="Ex.: 13000.00" className="mt-1.5" />
              </div>
            </div>

            {spent > 0 && (
              <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
                <div className="rounded-lg bg-gray-50 border p-3 text-center">
                  <p className="text-gray-500">Saldo</p>
                  <p className={`text-lg font-bold mt-0.5 ${rec - spent >= 0 ? 'text-gray-900' : 'text-red-700'}`}>
                    R$ {fmt2(rec - spent)}
                  </p>
                </div>
                <div className={`rounded-lg border p-3 text-center ${afPct >= minAfPct ? 'bg-green-50 border-green-200' : 'bg-amber-50 border-amber-200'}`}>
                  <p className="text-gray-500">% Agricultura Familiar <span className="text-xs">(mín. {minAfPct}%)</span></p>
                  <p className={`text-lg font-bold mt-0.5 ${afPct >= minAfPct ? 'text-green-800' : 'text-amber-700'}`}>
                    {af > 0 ? fmtPct(afPct) : '—'}
                  </p>
                </div>
                <div className="rounded-lg bg-gray-50 border p-3 text-center">
                  <p className="text-gray-500">% Executado</p>
                  <p className="text-lg font-bold mt-0.5 text-gray-900">
                    {rec > 0 ? fmtPct((spent / rec) * 100) : '—'}
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── Indicadores ── */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Indicadores de Conformidade PNAE</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Indicator
                ok={afOk}
                label={`Percentual de Agricultura Familiar >= ${minAfPct}%`}
                value={af > 0 ? fmtPct(afPct) : `(média cardápios) ${fmtPct(avgFamilyFarmPct)}`}
                warn={!afOk && (af > 0 || avgFamilyFarmPct > 0)}
              />
              <Indicator
                ok={menusByPeriod.length > 0}
                label="Cardápios elaborados no período"
                value={`${menusByPeriod.length} cardápio(s)`}
              />
              <Indicator
                ok={totalRefeicoes > 0}
                label="Número de refeições informado"
                value={totalRefeicoes > 0 ? totalRefeicoes.toLocaleString('pt-BR') : 'Preencha os segmentos acima'}
              />
              <Indicator
                ok={!!entity.nutricionista && !!entity.crn}
                label="Nutricionista RT identificada"
                value={entity.nutricionista ? `${entity.nutricionista} — ${entity.crn}` : 'Preencha os dados da entidade'}
              />
              <Indicator
                ok={!!entity.municipio && !!entity.cnpj}
                label="Dados da entidade preenchidos"
                value={entity.municipio ? `${entity.municipio} — ${entity.cnpj}` : 'Clique em "Editar" acima'}
              />
            </div>
          </CardContent>
        </Card>

      </div>
    </div>
  );
}

// ── sub-components ────────────────────────────────────────────────────────────

function Pill({ children, color }: { children: React.ReactNode; color: 'green' | 'blue' | 'gray' }) {
  const cls = {
    green: 'bg-green-100 text-green-800',
    blue:  'bg-blue-100 text-blue-800',
    gray:  'bg-gray-100 text-gray-700',
  }[color];
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${cls}`}>
      {children}
    </span>
  );
}

function Indicator({ ok, label, value, warn }: { ok: boolean; label: string; value: string; warn?: boolean }) {
  return (
    <div className="flex items-start gap-3 text-sm">
      {warn ? (
        <AlertTriangle className="w-4 h-4 mt-0.5 text-amber-500 shrink-0" />
      ) : ok ? (
        <CheckCircle2 className="w-4 h-4 mt-0.5 text-green-600 shrink-0" />
      ) : (
        <XCircle className="w-4 h-4 mt-0.5 text-gray-300 shrink-0" />
      )}
      <div>
        <span className={ok ? 'text-gray-900' : 'text-gray-500'}>{label}</span>
        <span className="ml-2 text-xs text-gray-400">{value}</span>
      </div>
    </div>
  );
}

function EntityForm({
  initial,
  onSave,
  onCancel,
}: {
  initial: EntityConfig;
  onSave: (c: EntityConfig) => void;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState<EntityConfig>(initial);
  const set = (key: keyof EntityConfig) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setDraft((prev) => ({ ...prev, [key]: e.target.value }));

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-3">
        <div>
          <Label>Município</Label>
          <Input value={draft.municipio} onChange={set('municipio')} className="mt-1.5" placeholder="Ex.: Itapetininga" />
        </div>
        <div>
          <Label>UF</Label>
          <Input value={draft.uf} onChange={set('uf')} className="mt-1.5 w-20" maxLength={2} placeholder="SP" />
        </div>
        <div>
          <Label>CNPJ</Label>
          <Input value={draft.cnpj} onChange={set('cnpj')} className="mt-1.5" placeholder="00.000.000/0000-00" />
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <div>
          <Label>Responsável legal</Label>
          <Input value={draft.responsavel} onChange={set('responsavel')} className="mt-1.5" />
        </div>
        <div>
          <Label>Nº do Processo FNDE</Label>
          <Input value={draft.numeroProcesso} onChange={set('numeroProcesso')} className="mt-1.5" />
        </div>
        <div>
          <Label>Nutricionista RT</Label>
          <Input value={draft.nutricionista} onChange={set('nutricionista')} className="mt-1.5" />
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <div>
          <Label>CRN</Label>
          <Input value={draft.crn} onChange={set('crn')} className="mt-1.5" placeholder="CRN3-00000" />
        </div>
      </div>
      <div className="flex justify-end gap-3">
        <Button variant="outline" size="sm" onClick={onCancel}>Cancelar</Button>
        <Button size="sm" onClick={() => onSave(draft)} className="bg-green-700 hover:bg-green-800">
          Salvar dados da entidade
        </Button>
      </div>
    </div>
  );
}
