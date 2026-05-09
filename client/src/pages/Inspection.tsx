import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Download, Trash2, AlertCircle, Wrench, Trophy, Pencil, ClipboardCheck, CalendarDays, Loader2, CheckCircle2, BarChart3, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { Inspection, School, ChecklistItemData, MaintenanceTicket } from '@/types';
import { checklistSections, sectionLabels } from '@/data/checklist';
import { useSchools, useInspections } from '@/hooks/useFirestore';
import { useMaintenanceTickets } from '@/hooks/useMaintenanceTickets';
import { useAuth } from '@/contexts/AuthContext';

const LEGACY_ORG_ID_INSP = 'pnae-default-org';

function loadInspectionSigner(orgId: string): { name: string; crn: string; municipality: string } {
  try {
    const raw = localStorage.getItem(`pnae_sigpc_entity_config_${orgId}`)
      || localStorage.getItem('pnae_sigpc_entity_config');
    if (raw) {
      const cfg = JSON.parse(raw);
      return {
        name: cfg.nutricionista || '',
        crn:  cfg.crn           || '',
        municipality: cfg.municipio ? `${cfg.municipio} / ${cfg.uf || 'SP'}` : '',
      };
    }
  } catch (_) {}
  return { name: '', crn: '', municipality: '' };
}
import PhotoUploader from '@/components/PhotoUploader';
import { toast } from 'sonner';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { assetToDataUrl, brandColors as _bc } from '@/lib/pdfBranding';

type SectionKey = keyof typeof checklistSections;

// ── Canvas watermark helpers ────────────────────────────────────────────────
function drawAppleCanvas(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(185,28,28,0.18)';
  ctx.fill();
  ctx.beginPath();
  ctx.arc(x + r * 0.35, y, r * 0.6, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(220,38,38,0.13)';
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(x, y - r);
  ctx.bezierCurveTo(x + r * 0.3, y - r * 1.5, x + r * 0.6, y - r * 1.3, x + r * 0.2, y - r * 0.8);
  ctx.strokeStyle = 'rgba(21,128,61,0.25)';
  ctx.lineWidth = r * 0.2;
  ctx.stroke();
  ctx.restore();
}

function drawCarrotCanvas(ctx: CanvasRenderingContext2D, x: number, y: number, size: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(Math.PI / 6);
  ctx.beginPath();
  ctx.moveTo(0, -size);
  ctx.lineTo(size * 0.3, size * 0.6);
  ctx.lineTo(-size * 0.3, size * 0.6);
  ctx.closePath();
  ctx.fillStyle = 'rgba(234,88,12,0.2)';
  ctx.fill();
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    ctx.moveTo(0, -size - size * 0.1 * i);
    ctx.bezierCurveTo(size * 0.5, -size - size * 0.6 - i * size * 0.1, -size * 0.5, -size - size * 0.6 - i * size * 0.1, 0, -size - size * 0.1 * i);
    ctx.fillStyle = 'rgba(21,128,61,0.22)';
    ctx.fill();
  }
  ctx.restore();
}

function drawLeafCanvas(ctx: CanvasRenderingContext2D, x: number, y: number, size: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(Math.PI / 4);
  ctx.beginPath();
  ctx.moveTo(0, -size);
  ctx.bezierCurveTo(size * 0.8, -size * 0.5, size * 0.8, size * 0.5, 0, size);
  ctx.bezierCurveTo(-size * 0.8, size * 0.5, -size * 0.8, -size * 0.5, 0, -size);
  ctx.fillStyle = 'rgba(21,128,61,0.17)';
  ctx.fill();
  ctx.restore();
}

function buildWatermarkDataUrl(pdfWmm: number, pdfHmm: number): string {
  const scale = 3.7795;
  const cw = Math.round(pdfWmm * scale);
  const ch = Math.round(pdfHmm * scale);
  const canvas = document.createElement('canvas');
  canvas.width = cw;
  canvas.height = ch;
  const ctx = canvas.getContext('2d')!;
  const positions = [
    { x: 0.08, y: 0.1 }, { x: 0.25, y: 0.22 }, { x: 0.55, y: 0.08 }, { x: 0.75, y: 0.18 },
    { x: 0.92, y: 0.1 }, { x: 0.12, y: 0.45 }, { x: 0.38, y: 0.55 }, { x: 0.65, y: 0.42 },
    { x: 0.88, y: 0.48 }, { x: 0.18, y: 0.78 }, { x: 0.45, y: 0.88 }, { x: 0.7, y: 0.75 },
    { x: 0.92, y: 0.82 }, { x: 0.5, y: 0.35 },
  ];
  positions.forEach((p, i) => {
    const px = p.x * cw, py = p.y * ch;
    const s = 18 + (i % 3) * 6;
    if (i % 3 === 0) drawAppleCanvas(ctx, px, py, s);
    else if (i % 3 === 1) drawCarrotCanvas(ctx, px, py, s);
    else drawLeafCanvas(ctx, px, py, s);
  });
  ctx.save();
  ctx.translate(cw / 2, ch / 2);
  ctx.rotate(-Math.PI / 4);
  ctx.font = `bold ${Math.round(ch * 0.18)}px Arial`;
  ctx.fillStyle = 'rgba(22,101,52,0.07)';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('PNAE', 0, 0);
  ctx.restore();
  return canvas.toDataURL('image/png');
}

// ── Score helpers ────────────────────────────────────────────────────────────
function scoreColor(score: number): string {
  if (score >= 80) return 'text-green-600';
  if (score >= 60) return 'text-amber-500';
  return 'text-red-500';
}

function scoreBadgeVariant(score: number): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (score >= 80) return 'default';
  if (score >= 60) return 'secondary';
  return 'destructive';
}

function scoreBgClass(score: number): string {
  if (score >= 80) return 'bg-green-50 border-green-200';
  if (score >= 60) return 'bg-amber-50 border-amber-200';
  return 'bg-red-50 border-red-200';
}

// ── PDF helpers ──────────────────────────────────────────────────────────────
let _brasaoCache:    string | null = null;
let _nutricaoCache:  string | null = null;
let _brasaoTried    = false;
let _nutricaoTried  = false;
async function tryLoad(path: string): Promise<string | null> {
  try { return await assetToDataUrl(path); } catch { return null; }
}
async function pdfLoadLogos() {
  if (!_brasaoTried)   { _brasaoTried   = true; _brasaoCache   = await tryLoad('/brasao-itai.png'); }
  if (!_nutricaoTried) { _nutricaoTried = true; _nutricaoCache = await tryLoad('/logo-nutricao.png'); }
  return { brasao: _brasaoCache, nutricao: _nutricaoCache };
}

async function pdfAddGreenHeader(doc: jsPDF, title: string, subtitle: string): Promise<number> {
  const pw = doc.internal.pageSize.getWidth();
  doc.setFillColor(22, 101, 52);
  doc.rect(0, 0, pw, 32, 'F');
  doc.setFillColor(21, 128, 61);
  doc.rect(0, 29, pw, 3, 'F');

  const { brasao, nutricao } = await pdfLoadLogos();
  if (brasao)   doc.addImage(brasao,   'PNG', 6,       6, 20, 20);
  if (nutricao) doc.addImage(nutricao, 'PNG', pw - 26, 6, 20, 20);

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text(title, pw / 2, 13, { align: 'center' });
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text(subtitle, pw / 2, 20, { align: 'center' });
  // municipality line is now optional — passed by caller
  doc.setTextColor(31, 41, 55);
  return 38;
}

async function generateInspectionPDF(inspection: Inspection) {
  const doc = new jsPDF();
  const pw = doc.internal.pageSize.getWidth();
  const ph = doc.internal.pageSize.getHeight();
  const wmUrl = buildWatermarkDataUrl(210, 297);

  doc.addImage(wmUrl, 'PNG', 0, 0, 210, 297);
  let y = await pdfAddGreenHeader(doc, 'RELATÓRIO DE FISCALIZAÇÃO', 'PNAE — Gestão de Nutrição Escolar');

  // Info table
  const infoData = [
    ['Escola', inspection.schoolName],
    ['Diretor(a)', inspection.director],
    ['Nutricionista', inspection.nutritionist],
    ['Data', new Date(inspection.inspectionDate).toLocaleDateString('pt-BR')],
    ['Horário', inspection.inspectionTime || '—'],
    ['Alunos Regulares', String(inspection.regularStudents)],
    ['Alunos Integrais', String(inspection.integralStudents)],
    ['Conformidade Geral', `${inspection.overallScore}%`],
  ];

  autoTable(doc, {
    startY: y,
    head: [['Campo', 'Informação']],
    body: infoData,
    theme: 'grid',
    headStyles: { fillColor: [22, 101, 52], textColor: 255, fontStyle: 'bold', fontSize: 9 },
    bodyStyles: { fontSize: 9 },
    alternateRowStyles: { fillColor: [240, 253, 244] },
  });
  y = (doc as any).lastAutoTable.finalY + 10;

  if (inspection.visitObjective) {
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(22, 101, 52);
    doc.text('Objetivo da Visita:', 15, y);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(50, 50, 50);
    y += 5;
    const objLines = doc.splitTextToSize(inspection.visitObjective, pw - 30);
    doc.text(objLines, 15, y);
    y += objLines.length * 5 + 6;
  }

  if (inspection.guidelines) {
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(22, 101, 52);
    doc.text('Orientações / Providências:', 15, y);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(50, 50, 50);
    y += 5;
    const guidLines = doc.splitTextToSize(inspection.guidelines, pw - 30);
    doc.text(guidLines, 15, y);
    y += guidLines.length * 5 + 8;
  }

  // Checklist summary
  const sectionKeys: SectionKey[] = ['manipulationProcedures', 'uniformization', 'stockManagement', 'refrigerator', 'kitchen', 'distribution', 'pestControl', 'waterPotability', 'physicalStructure'];
  const checklistData = sectionKeys.map((k) => {
    const items = (inspection as any)[k] as ChecklistItemData[];
    if (!items) return null;
    const yes = items.filter(i => i.answer === 'yes').length;
    const total = items.length;
    const pct = total > 0 ? Math.round((yes / total) * 100) : 0;
    return [(sectionLabels as any)[k] || k, `${yes}/${total}`, `${pct}%`];
  }).filter(Boolean) as string[][];

  if (checklistData.length > 0) {
    autoTable(doc, {
      startY: y,
      head: [['Seção', 'Respostas SIM', '% Conformidade']],
      body: checklistData,
      theme: 'striped',
      headStyles: { fillColor: [22, 101, 52], textColor: 255, fontStyle: 'bold', fontSize: 9 },
      bodyStyles: { fontSize: 8 },
    });
    y = (doc as any).lastAutoTable.finalY + 10;
  }

  // Non-conformities
  const nonConf: string[][] = [];
  sectionKeys.forEach(k => {
    const items = (inspection as any)[k] as ChecklistItemData[];
    if (!items) return;
    items.forEach(item => {
      if (item.answer === 'no' && item.observation) {
        nonConf.push([(sectionLabels as any)[k], item.question, item.observation]);
      }
    });
  });
  if (nonConf.length > 0) {
    if (y > ph - 40) { doc.addPage(); doc.addImage(wmUrl, 'PNG', 0, 0, 210, 297); y = 15; }
    autoTable(doc, {
      startY: y,
      head: [['Seção', 'Pergunta', 'Não Conformidade']],
      body: nonConf,
      theme: 'grid',
      headStyles: { fillColor: [185, 28, 28], textColor: 255, fontStyle: 'bold', fontSize: 8 },
      bodyStyles: { fontSize: 7 },
    });
  }

  // Photos
  if (inspection.photos && inspection.photos.length > 0) {
    doc.addPage();
    doc.addImage(wmUrl, 'PNG', 0, 0, 210, 297);
    await pdfAddGreenHeader(doc, 'FOTOS DA INSPEÇÃO', inspection.schoolName);
    let px = 10, py = 38;
    const imgW = (pw - 20) / 2, imgH = 58;
    inspection.photos.forEach((photo, idx) => {
      if (py + imgH + 15 > ph - 10) { doc.addPage(); doc.addImage(wmUrl, 'PNG', 0, 0, 210, 297); py = 15; px = 10; }
      try {
        doc.addImage(photo, 'JPEG', px, py, imgW, imgH);
        doc.setFontSize(7);
        doc.setTextColor(80, 80, 80);
        doc.text(`Foto ${idx + 1}`, px + 2, py + imgH + 3);
      } catch {}
      if ((idx + 1) % 2 === 0) { py += imgH + 15; px = 10; } else { px += imgW + 10; }
    });
  }

  // Footer on all pages
  const totalPages = (doc as any).getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    doc.setDrawColor(22, 101, 52);
    doc.setLineWidth(0.3);
    doc.line(10, ph - 12, pw - 10, ph - 12);
    doc.setFontSize(7);
    doc.setTextColor(100, 100, 100);
    doc.text(`PNAE — Sistema de Gestão de Nutrição Escolar`, 15, ph - 7);
    doc.text(`Página ${p}/${totalPages}`, pw - 15, ph - 7, { align: 'right' });
  }

  doc.save(`Fiscalizacao_${inspection.schoolName}_${new Date().toISOString().split('T')[0]}.pdf`);
}

// ── Painel Geral PDF ─────────────────────────────────────────────────────────

interface PanelStats {
  total: number;
  avg: number;
  schoolCount: number;
  passRate: number;
  schoolStats: { name: string; avgScore: number; visits: number; trend: string }[];
  nutrStats:   { name: string; visits: number; avg: number }[];
  sectionPerf: { label: string; pct: number }[];
  sorted:      Inspection[];
}

async function generatePanelPDF(stats: PanelStats) {
  const doc = new jsPDF();
  const pw  = doc.internal.pageSize.getWidth();
  const ph  = doc.internal.pageSize.getHeight();
  const green: [number, number, number] = [22, 101, 52];
  const margin = 12;

  // ── Header ───────────────────────────────────────────────────────────────
  let y = await pdfAddGreenHeader(doc, 'PAINEL GERAL DE FISCALIZAÇÕES', 'Relatório Consolidado — PNAE');

  const today = new Date().toLocaleDateString('pt-BR');
  doc.setFontSize(8); doc.setTextColor(100,100,100);
  doc.text(`Gerado em ${today}`, pw - margin, y - 4, { align: 'right' });

  // ── Summary cards ────────────────────────────────────────────────────────
  const cards = [
    ['Total de visitas',     String(stats.total)],
    ['Conformidade média',   `${stats.avg}%`],
    ['Escolas visitadas',    String(stats.schoolCount)],
    ['Taxa aprovação ≥80%',  `${stats.passRate}%`],
  ];
  const cardW = (pw - margin * 2 - 9) / 4;
  cards.forEach(([label, value], i) => {
    const cx = margin + i * (cardW + 3);
    doc.setFillColor(240, 253, 244);
    doc.setDrawColor(...green);
    doc.setLineWidth(0.3);
    doc.roundedRect(cx, y, cardW, 18, 2, 2, 'FD');
    doc.setFontSize(7); doc.setTextColor(80,80,80);
    doc.text(label, cx + cardW / 2, y + 5, { align: 'center' });
    doc.setFontSize(13); doc.setFont('helvetica', 'bold'); doc.setTextColor(...green);
    doc.text(value, cx + cardW / 2, y + 14, { align: 'center' });
    doc.setFont('helvetica', 'normal');
  });
  y += 24;

  // ── Conformidade por escola ───────────────────────────────────────────────
  if (stats.schoolStats.length > 0) {
    doc.setFontSize(9); doc.setFont('helvetica', 'bold'); doc.setTextColor(...green);
    doc.text('Conformidade por Escola', margin, y); y += 5;

    const trendLabel = (t: string) => t === 'up' ? '↑' : t === 'down' ? '↓' : t === 'same' ? '=' : 'N';
    autoTable(doc, {
      startY: y,
      head: [['Escola', 'Visitas', 'Tendência', 'Média (%)']],
      body: stats.schoolStats.map(s => [s.name, String(s.visits), trendLabel(s.trend), `${s.avgScore}%`]),
      theme: 'striped',
      headStyles: { fillColor: green, textColor: 255, fontStyle: 'bold', fontSize: 8 },
      bodyStyles: { fontSize: 8 },
      columnStyles: { 0: { cellWidth: 'auto' }, 1: { cellWidth: 18, halign: 'center' }, 2: { cellWidth: 20, halign: 'center' }, 3: { cellWidth: 22, halign: 'center' } },
      margin: { left: margin, right: margin },
      didParseCell: (data) => {
        if (data.section === 'body' && data.column.index === 3) {
          const pct = parseInt((data.cell.raw as string));
          data.cell.styles.textColor = pct >= 80 ? [22,101,52] : pct >= 60 ? [180,120,0] : [185,28,28];
          data.cell.styles.fontStyle = 'bold';
        }
        if (data.section === 'body' && data.column.index === 2) {
          const t = data.cell.raw as string;
          data.cell.styles.textColor = t === '↑' ? [22,101,52] : t === '↓' ? [185,28,28] : [100,100,100];
          data.cell.styles.fontStyle = 'bold';
          data.cell.styles.fontSize = 11;
        }
      },
    });
    y = (doc as any).lastAutoTable.finalY + 8;
  }

  // ── New page if needed ────────────────────────────────────────────────────
  if (y > ph - 80) { doc.addPage(); y = 15; }

  // ── Linha do tempo ────────────────────────────────────────────────────────
  const recent = stats.sorted.slice(-12);
  if (recent.length > 0) {
    doc.setFontSize(9); doc.setFont('helvetica', 'bold'); doc.setTextColor(...green);
    doc.text('Linha do Tempo (últimas visitas)', margin, y); y += 5;
    autoTable(doc, {
      startY: y,
      head: [['Data', 'Escola', 'Nutricionista', 'Score (%)']],
      body: recent.map(i => [
        new Date(i.inspectionDate).toLocaleDateString('pt-BR'),
        i.schoolName, i.nutritionist, `${i.overallScore}%`,
      ]),
      theme: 'striped',
      headStyles: { fillColor: green, textColor: 255, fontStyle: 'bold', fontSize: 8 },
      bodyStyles: { fontSize: 8 },
      columnStyles: { 3: { halign: 'center' } },
      margin: { left: margin, right: margin },
      didParseCell: (data) => {
        if (data.section === 'body' && data.column.index === 3) {
          const pct = parseInt((data.cell.raw as string));
          data.cell.styles.textColor = pct >= 80 ? [22,101,52] : pct >= 60 ? [180,120,0] : [185,28,28];
          data.cell.styles.fontStyle = 'bold';
        }
      },
    });
    y = (doc as any).lastAutoTable.finalY + 8;
  }

  // ── New page if needed ────────────────────────────────────────────────────
  if (y > ph - 70) { doc.addPage(); y = 15; }

  // Side-by-side: Por nutricionista + Por seção
  const halfW = (pw - margin * 2 - 6) / 2;

  doc.setFontSize(9); doc.setFont('helvetica', 'bold'); doc.setTextColor(...green);
  doc.text('Por Nutricionista', margin, y);
  doc.text('Desempenho por Seção', margin + halfW + 6, y);
  y += 5;

  const yLeft  = y;
  autoTable(doc, {
    startY: yLeft,
    head: [['Nutricionista', 'Visitas', 'Média']],
    body: stats.nutrStats.map(n => [n.name, String(n.visits), `${n.avg}%`]),
    theme: 'striped',
    headStyles: { fillColor: green, textColor: 255, fontStyle: 'bold', fontSize: 8 },
    bodyStyles: { fontSize: 8 },
    columnStyles: { 1: { halign: 'center', cellWidth: 16 }, 2: { halign: 'center', cellWidth: 18 } },
    margin: { left: margin, right: pw - margin - halfW },
  });
  const yAfterLeft = (doc as any).lastAutoTable.finalY;

  autoTable(doc, {
    startY: yLeft,
    head: [['Seção do Checklist', '%']],
    body: stats.sectionPerf.map(s => [s.label, `${s.pct}%`]),
    theme: 'striped',
    headStyles: { fillColor: green, textColor: 255, fontStyle: 'bold', fontSize: 8 },
    bodyStyles: { fontSize: 8 },
    columnStyles: { 1: { halign: 'center', cellWidth: 16 } },
    margin: { left: margin + halfW + 6, right: margin },
    didParseCell: (data) => {
      if (data.section === 'body' && data.column.index === 1) {
        const pct = parseInt((data.cell.raw as string));
        data.cell.styles.textColor = pct >= 80 ? [22,101,52] : pct >= 60 ? [180,120,0] : [185,28,28];
        data.cell.styles.fontStyle = 'bold';
      }
    },
  });
  y = Math.max(yAfterLeft, (doc as any).lastAutoTable.finalY) + 8;

  // ── Footer all pages ─────────────────────────────────────────────────────
  const total = (doc as any).getNumberOfPages();
  for (let p = 1; p <= total; p++) {
    doc.setPage(p);
    doc.setDrawColor(...green); doc.setLineWidth(0.3);
    doc.line(margin, ph - 12, pw - margin, ph - 12);
    doc.setFontSize(7); doc.setTextColor(100,100,100);
    doc.text('PNAE — Sistema de Gestão de Nutrição Escolar · Relatório Consolidado', pw / 2, ph - 7, { align: 'center' });
    doc.text(`Pág. ${p}/${total}`, pw - margin, ph - 7, { align: 'right' });
  }

  doc.save(`Painel_Fiscalizacoes_${new Date().toISOString().split('T')[0]}.pdf`);
}

async function generateSchoolCertificatePDF(inspection: Inspection, signatureUrl?: string) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pw = doc.internal.pageSize.getWidth();
  const ph = doc.internal.pageSize.getHeight();
  const wmUrl = buildWatermarkDataUrl(pw, ph);

  // Ivory background
  doc.setFillColor(255, 253, 244);
  doc.rect(0, 0, pw, ph, 'F');
  doc.addImage(wmUrl, 'PNG', 0, 0, pw, ph);

  // Outer green border
  doc.setDrawColor(22, 101, 52);
  doc.setLineWidth(3.5);
  doc.rect(8, 8, pw - 16, ph - 16);
  // Inner border
  doc.setLineWidth(1);
  doc.setDrawColor(21, 128, 61);
  doc.rect(12, 12, pw - 24, ph - 24);

  // Header band (taller to fit logos)
  doc.setFillColor(22, 101, 52);
  doc.rect(12, 12, pw - 24, 30, 'F');

  // Logos inside header band
  const { brasao: b2, nutricao: n2 } = await pdfLoadLogos();
  if (b2) doc.addImage(b2, 'PNG', 16,      14, 22, 22);
  if (n2) doc.addImage(n2, 'PNG', pw - 38, 14, 22, 22);

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('PREFEITURA MUNICIPAL | SECRETARIA DE EDUCAÇÃO', pw / 2, 22, { align: 'center' });
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text('PROGRAMA NACIONAL DE ALIMENTAÇÃO ESCOLAR — PNAE', pw / 2, 30, { align: 'center' });

  // Certificate title
  doc.setTextColor(22, 101, 52);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(28);
  doc.text('CERTIFICADO DE BOAS PRÁTICAS', pw / 2, 62, { align: 'center' });
  doc.setFontSize(11);
  doc.setTextColor(80, 80, 80);
  doc.setFont('helvetica', 'normal');
  doc.text('Conformidade com as Normas de Manipulação de Alimentos', pw / 2, 72, { align: 'center' });

  // Divider
  doc.setDrawColor(21, 128, 61);
  doc.setLineWidth(0.5);
  doc.line(30, 77, pw - 30, 77);

  // Body text
  doc.setFontSize(12);
  doc.setTextColor(50, 50, 50);
  doc.setFont('helvetica', 'normal');
  doc.text('Certificamos que a unidade escolar', pw / 2, 90, { align: 'center' });

  // School name
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(22, 101, 52);
  const nameLines = doc.splitTextToSize(inspection.schoolName, pw - 60);
  doc.text(nameLines, pw / 2, 103, { align: 'center' });
  let y = 103 + nameLines.length * 10;

  // Achievement
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(50, 50, 50);
  doc.text('atingiu conformidade de', pw / 2, y + 6, { align: 'center' });

  doc.setFontSize(32);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(21, 128, 61);
  doc.text(`${inspection.overallScore}%`, pw / 2, y + 20, { align: 'center' });

  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(50, 50, 50);
  doc.text('nas Boas Práticas de Manipulação de Alimentos — PNAE/RDC 216/2004', pw / 2, y + 32, { align: 'center' });

  // Info row
  const infoY = y + 43;
  doc.setFontSize(9);
  doc.setTextColor(80, 80, 80);
  doc.text(`Data da Inspeção: ${new Date(inspection.inspectionDate).toLocaleDateString('pt-BR')}`, pw * 0.25, infoY, { align: 'center' });
  doc.text(`Diretor(a): ${inspection.director}`, pw * 0.5, infoY, { align: 'center' });
  doc.text(`Emitido em: ${new Date().toLocaleDateString('pt-BR')}`, pw * 0.75, infoY, { align: 'center' });

  // Divider
  doc.setDrawColor(200, 230, 200);
  doc.setLineWidth(0.3);
  doc.line(30, infoY + 6, pw - 30, infoY + 6);

  // Signature
  const sigY = ph - 38;
  if (signatureUrl) {
    try {
      doc.addImage(signatureUrl, 'PNG', pw * 0.65, sigY - 16, 40, 14);
    } catch {}
  }
  doc.setDrawColor(100, 100, 100);
  doc.setLineWidth(0.4);
  doc.line(pw * 0.55, sigY, pw * 0.85, sigY);
  doc.setFontSize(9);
  doc.setTextColor(40, 40, 40);
  doc.setFont('helvetica', 'bold');
  doc.text(inspection.nutritionist || 'Nutricionista Responsável Técnica', pw * 0.7, sigY + 6, { align: 'center' });
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(80, 80, 80);
  doc.text('Nutricionista RT PNAE', pw * 0.7, sigY + 12, { align: 'center' });

  // Left seal area
  doc.setFillColor(240, 253, 244);
  doc.setDrawColor(22, 101, 52);
  doc.setLineWidth(0.5);
  doc.circle(pw * 0.15, sigY - 2, 14, 'FD');
  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(22, 101, 52);
  doc.text('BOAS', pw * 0.15, sigY - 6, { align: 'center' });
  doc.text('PRÁTICAS', pw * 0.15, sigY - 1, { align: 'center' });
  doc.text('PNAE', pw * 0.15, sigY + 4, { align: 'center' });

  // Footer
  doc.setFontSize(7);
  doc.setTextColor(130, 130, 130);
  doc.text('Este certificado comprova conformidade com as normas do PNAE — válido por 12 meses a partir da data de emissão.', pw / 2, ph - 16, { align: 'center' });

  doc.save(`Certificado_${inspection.schoolName}_${new Date().toISOString().split('T')[0]}.pdf`);
}

// ── Component ────────────────────────────────────────────────────────────────
export default function InspectionPage() {
  const { user } = useAuth();
  const orgId = user?.organizationId || LEGACY_ORG_ID_INSP;
  const { schools } = useSchools();
  const { inspections, setInspections } = useInspections();
  const { addTicket: addMaintenanceTicket } = useMaintenanceTickets();
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('form');
  const [maintenanceDialogOpen, setMaintenanceDialogOpen] = useState(false);
  const [certificateDialogOpen, setCertificateDialogOpen] = useState(false);
  const [selectedInspectionForMaintenance, setSelectedInspectionForMaintenance] = useState<Inspection | null>(null);
  const [selectedInspectionForCertificate, setSelectedInspectionForCertificate] = useState<Inspection | null>(null);

  // Editing state — when set, save updates the existing record instead of creating new
  const [editingInspectionId, setEditingInspectionId] = useState<string | null>(null);

  // Form state
  const [selectedSchool, setSelectedSchool] = useState('');
  const [director, setDirector] = useState('');
  const [regularStudents, setRegularStudents] = useState('');
  const [integralStudents, setIntegralStudents] = useState('');
  const [inspectionDate, setInspectionDate] = useState(new Date().toISOString().split('T')[0]);
  const [inspectionTime, setInspectionTime] = useState('');
  const [nutritionist, setNutritionist] = useState(() => loadInspectionSigner(orgId).name);

  // Checklist state
  const [checklist, setChecklist] = useState<Record<SectionKey, ChecklistItemData[]>>({
    manipulationProcedures: [],
    uniformization: [],
    visitors: [],
    stockManagement: [],
    refrigerator: [],
    freezer: [],
    kitchen: [],
    menu: [],
    distribution: [],
    pestControl: [],
    waterPotability: [],
    physicalStructure: [],
    executors: []
  });

  const [visitObjective, setVisitObjective] = useState('');
  const [guidelines, setGuidelines] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Maintenance form state
  const [maintenanceEquipment, setMaintenanceEquipment] = useState('');
  const [maintenanceDescription, setMaintenanceDescription] = useState('');
  const [maintenancePriority, setMaintenancePriority] = useState<'low' | 'high'>('low');

  // Filtros do histórico
  const [filterSchoolHistory, setFilterSchoolHistory] = useState('all');
  const [filterDateStart, setFilterDateStart] = useState('');
  const [filterDateEnd, setFilterDateEnd] = useState('');

  // Photos state
  const [photos, setPhotos] = useState<string[]>([]);

  // Signature
  const [signatureUrl] = useState<string | undefined>(() => localStorage.getItem('pnae_signature') || undefined);

  // Inicializar checklist
  useEffect(() => {
    const initialChecklist: Record<SectionKey, ChecklistItemData[]> = {} as Record<SectionKey, ChecklistItemData[]>;
    (Object.keys(checklistSections) as SectionKey[]).forEach(section => {
      initialChecklist[section] = checklistSections[section].map(question => ({
        question,
        answer: null,
        observation: '',
        photoUrl: ''
      }));
    });
    setChecklist(initialChecklist);
  }, []);

  const calculateScore = () => {
    let total = 0, yes = 0;
    (Object.keys(checklist) as SectionKey[]).forEach(section => {
      checklist[section].forEach(item => {
        // N/A answers are excluded from the score entirely (neither yes nor no)
        if (item.answer !== null && item.answer !== 'na') {
          total++;
          if (item.answer === 'yes') yes++;
        }
      });
    });
    return total > 0 ? Math.round((yes / total) * 100) : 0;
  };

  const currentScore = calculateScore();

  const handleSaveInspection = async () => {
    if (!selectedSchool || !director || !nutritionist) {
      toast.error('Preencha todos os campos obrigatórios');
      return;
    }

    const parsedRegular = parseInt(regularStudents);
    const parsedIntegral = parseInt(integralStudents);
    if (isNaN(parsedRegular) || parsedRegular < 0) {
      toast.error('Número de alunos regulares inválido');
      return;
    }
    if (isNaN(parsedIntegral) || parsedIntegral < 0) {
      toast.error('Número de alunos integrais inválido');
      return;
    }

    try {
      setSubmitting(true);
      await new Promise(resolve => setTimeout(resolve, 300));
      const score = calculateScore();

      const inspectionData = {
        schoolId: selectedSchool,
        schoolName: schools.find(s => s.id === selectedSchool)?.name || selectedSchool,
        director,
        regularStudents: parsedRegular,
        integralStudents: parsedIntegral,
        inspectionDate: new Date(inspectionDate),
        inspectionTime,
        nutritionist,
        employees: [],
        manipulationProcedures: checklist.manipulationProcedures,
        uniformization: checklist.uniformization,
        visitors: checklist.visitors,
        stockManagement: checklist.stockManagement,
        refrigerator: checklist.refrigerator,
        freezer: checklist.freezer,
        kitchen: checklist.kitchen,
        menu: checklist.menu,
        distribution: checklist.distribution,
        pestControl: checklist.pestControl,
        waterPotability: checklist.waterPotability,
        physicalStructure: checklist.physicalStructure,
        executors: checklist.executors,
        meals: [],
        visitObjective,
        guidelines,
        photos: photos.length > 0 ? photos : undefined,
        overallScore: score,
        createdBy: 'Sistema',
      };

      let savedInspection: Inspection;
      let updated: Inspection[];

      if (editingInspectionId) {
        // UPDATE existing — preserve original createdAt and id
        const original = inspections.find(i => i.id === editingInspectionId);
        savedInspection = {
          ...inspectionData,
          id: editingInspectionId,
          createdAt: original?.createdAt ?? new Date(),
        };
        updated = inspections.map(i => i.id === editingInspectionId ? savedInspection : i);
      } else {
        // CREATE new
        savedInspection = {
          ...inspectionData,
          id: `inspection-${crypto.randomUUID()}`,
          createdAt: new Date(),
        };
        updated = [savedInspection, ...inspections];
      }

      setInspections(updated);
      localStorage.setItem('pnae_inspections', JSON.stringify(updated));

      // Reset form
      setEditingInspectionId(null);
      setSelectedSchool(''); setDirector(''); setRegularStudents(''); setIntegralStudents('');
      setInspectionDate(new Date().toISOString().split('T')[0]);
      setInspectionTime(''); setVisitObjective(''); setGuidelines(''); setPhotos([]);

      const action = editingInspectionId ? 'atualizada' : 'salva';
      generateInspectionPDF(savedInspection).catch((err) => {
        console.error('Erro ao gerar PDF:', err);
        toast.error('Fiscalização salva, mas houve erro ao gerar o PDF.');
      });
      toast.success(`Fiscalização ${action}! Conformidade: ${score}%`);

      if (score >= 80) {
        setSelectedInspectionForCertificate(savedInspection);
        setCertificateDialogOpen(true);
      }
    } catch (error) {
      console.error(error);
      toast.error('Erro ao salvar fiscalização');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveMaintenance = async () => {
    if (!maintenanceEquipment || !maintenanceDescription || !selectedInspectionForMaintenance) {
      toast.error('Preencha todos os campos');
      return;
    }
    try {
      const newTicket: Omit<MaintenanceTicket, 'id'> = {
        schoolId: selectedInspectionForMaintenance.schoolId,
        schoolName: selectedInspectionForMaintenance.schoolName,
        inspectionId: selectedInspectionForMaintenance.id,
        equipment: maintenanceEquipment,
        description: maintenanceDescription,
        priority: maintenancePriority,
        status: 'open',
        createdAt: new Date(),
        createdBy: 'Sistema'
      };
      addMaintenanceTicket(newTicket);
      setMaintenanceEquipment(''); setMaintenanceDescription(''); setMaintenancePriority('low');
      setMaintenanceDialogOpen(false);
      toast.success('Ticket de manutenção criado com sucesso');
    } catch (error) {
      console.error(error);
      toast.error('Erro ao criar ticket');
    }
  };

  const handleDeleteInspection = (id: string) => {
    if (!window.confirm('Confirma a exclusão desta fiscalização?')) return;
    const updated = inspections.filter(item => item.id !== id);
    setInspections(updated);
    localStorage.setItem('pnae_inspections', JSON.stringify(updated));
    toast.success('Fiscalização excluída');
  };

  const handleEditInspection = (inspection: Inspection) => {
    setEditingInspectionId(inspection.id);
    setSelectedSchool(inspection.schoolId);
    setDirector(inspection.director);
    setNutritionist(inspection.nutritionist);
    setRegularStudents(String(inspection.regularStudents));
    setIntegralStudents(String(inspection.integralStudents));
    setInspectionDate(new Date(inspection.inspectionDate).toISOString().split('T')[0]);
    setInspectionTime(inspection.inspectionTime || '');
    setVisitObjective(inspection.visitObjective || '');
    setGuidelines(inspection.guidelines || '');
    setPhotos(inspection.photos ?? []);
    // Restore checklist from saved inspection
    const restored: Record<SectionKey, ChecklistItemData[]> = {} as Record<SectionKey, ChecklistItemData[]>;
    (Object.keys(checklistSections) as SectionKey[]).forEach(section => {
      const saved = (inspection as any)[section] as ChecklistItemData[] | undefined;
      restored[section] = saved && saved.length > 0
        ? saved
        : checklistSections[section].map(q => ({ question: q, answer: null, observation: '', photoUrl: '' }));
    });
    setChecklist(restored);
    setActiveTab('form');
    toast.info('Fiscalização carregada para edição. Salve para atualizar.');
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const filteredInspections = inspections.filter(i => {
    if (filterSchoolHistory !== 'all' && i.schoolId !== filterSchoolHistory) return false;
    if (filterDateStart && new Date(i.inspectionDate) < new Date(filterDateStart)) return false;
    if (filterDateEnd && new Date(i.inspectionDate) > new Date(filterDateEnd)) return false;
    return true;
  });

  return (
    <div className="flex-1 p-4 md:p-8 space-y-6 max-w-6xl mx-auto">
      {/* Page Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="brand-chip text-xs font-semibold">PNAE · Controle de Qualidade</span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <ClipboardCheck className="h-7 w-7 text-accent" />
            Fiscalização
          </h1>
          <p className="text-muted-foreground mt-1">Registro de visitas e checklist de conformidade</p>
        </div>
        {activeTab === 'form' && (
          <div className="hidden md:flex flex-col items-end">
            <p className="text-sm text-muted-foreground">Score atual</p>
            <span className={`text-3xl font-bold ${scoreColor(currentScore)}`}>{currentScore}%</span>
          </div>
        )}
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid grid-cols-3 w-full max-w-lg">
          <TabsTrigger value="form" className="gap-2">
            <ClipboardCheck className="h-4 w-4" /> Nova Fiscalização
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-2">
            <CalendarDays className="h-4 w-4" /> Histórico ({inspections.length})
          </TabsTrigger>
          <TabsTrigger value="panel" className="gap-2">
            <BarChart3 className="h-4 w-4" /> Painel Geral
          </TabsTrigger>
        </TabsList>

        {/* ── Formulário ────────────────────────────────────────────────── */}
        <TabsContent value="form" className="space-y-5">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Dados da Visita</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Escola *</label>
                  <Select value={selectedSchool} onValueChange={setSelectedSchool}>
                    <SelectTrigger><SelectValue placeholder="Selecione uma escola" /></SelectTrigger>
                    <SelectContent>
                      {schools.map(school => (
                        <SelectItem key={school.id} value={school.id}>{school.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Diretor(a) Responsável *</label>
                  <Input placeholder="Nome do diretor(a)" value={director} onChange={e => setDirector(e.target.value)} />
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Nutricionista *</label>
                  <Input placeholder="Nome do nutricionista" value={nutritionist} onChange={e => setNutritionist(e.target.value)} />
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Data da Inspeção</label>
                  <Input type="date" value={inspectionDate} onChange={e => setInspectionDate(e.target.value)} />
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Horário</label>
                  <Input type="time" value={inspectionTime} onChange={e => setInspectionTime(e.target.value)} />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">Alunos Regulares</label>
                    <Input type="number" placeholder="0" value={regularStudents} onChange={e => setRegularStudents(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">Alunos Integrais</label>
                    <Input type="number" placeholder="0" value={integralStudents} onChange={e => setIntegralStudents(e.target.value)} />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Checklist */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Checklist de Conformidade</CardTitle>
              <CardDescription>Responda SIM, NÃO ou N/A. Não conformidades exigem observação.</CardDescription>
            </CardHeader>
            <CardContent>
              <Accordion type="single" collapsible className="space-y-3">
                {(Object.keys(checklist) as SectionKey[]).map(section => {
                  const items = checklist[section];
                  const answered = items.filter(i => i.answer !== null).length;
                  const yesCount = items.filter(i => i.answer === 'yes').length;
                  const pct = answered > 0 ? Math.round((yesCount / answered) * 100) : null;

                  return (
                    <AccordionItem key={section} value={section} className="border rounded-xl px-1">
                      <AccordionTrigger className="hover:no-underline px-3 py-3">
                        <div className="flex items-center justify-between w-full pr-4">
                          <span className="font-medium text-sm">{(sectionLabels as any)[section]}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground">{answered}/{items.length}</span>
                            {pct !== null && (
                              <Badge variant="outline" className={`text-xs ${pct >= 80 ? 'border-green-400 text-green-700' : pct >= 60 ? 'border-amber-400 text-amber-700' : 'border-red-400 text-red-700'}`}>
                                {pct}%
                              </Badge>
                            )}
                          </div>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="space-y-5 px-3 pb-4 pt-2">
                        {items.map((item, itemIdx) => (
                          <div key={itemIdx} className={`space-y-2 pb-4 border-b last:border-b-0 ${item.answer === 'no' ? 'bg-red-50/50 -mx-2 px-2 rounded-lg' : ''}`}>
                            <p className="text-sm font-medium leading-snug">{item.question}</p>
                            <RadioGroup
                              value={item.answer || ''}
                              onValueChange={value => {
                                const updated = [...checklist[section]];
                                updated[itemIdx] = { ...item, answer: value as 'yes' | 'no' | 'na' };
                                setChecklist({ ...checklist, [section]: updated });
                              }}
                            >
                              <div className="flex gap-6">
                                {[['yes', 'SIM', 'text-green-700'], ['no', 'NÃO', 'text-red-600'], ['na', 'N/A', 'text-muted-foreground']].map(([v, label, cls]) => (
                                  <div key={v} className="flex items-center gap-1.5">
                                    <RadioGroupItem value={v} id={`${section}-${itemIdx}-${v}`} />
                                    <label htmlFor={`${section}-${itemIdx}-${v}`} className={`text-sm cursor-pointer font-medium ${cls}`}>{label}</label>
                                  </div>
                                ))}
                              </div>
                            </RadioGroup>
                            {item.answer === 'no' && (
                              <Textarea
                                placeholder="Descreva a não conformidade encontrada (obrigatório)"
                                value={item.observation || ''}
                                onChange={e => {
                                  const updated = [...checklist[section]];
                                  updated[itemIdx] = { ...item, observation: e.target.value };
                                  setChecklist({ ...checklist, [section]: updated });
                                }}
                                className="text-sm mt-1"
                              />
                            )}
                          </div>
                        ))}
                      </AccordionContent>
                    </AccordionItem>
                  );
                })}
              </Accordion>
            </CardContent>
          </Card>

          {/* Relatório */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Relatório da Visita</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Objetivo da Visita</label>
                <Textarea
                  placeholder="Descreva o objetivo da visita — situação encontrada, motivo da visita, contexto geral..."
                  value={visitObjective}
                  onChange={e => setVisitObjective(e.target.value)}
                  className="min-h-[160px] resize-y"
                />
                <p className="text-xs text-muted-foreground text-right">{visitObjective.length} caracteres</p>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Orientações / Providências</label>
                <Textarea
                  placeholder="Descreva as orientações passadas, providências determinadas, prazos e responsáveis..."
                  value={guidelines}
                  onChange={e => setGuidelines(e.target.value)}
                  className="min-h-[200px] resize-y"
                />
                <p className="text-xs text-muted-foreground text-right">{guidelines.length} caracteres</p>
              </div>
            </CardContent>
          </Card>

          {/* Fotos */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Fotos da Inspeção</CardTitle>
              <CardDescription>Registre não conformidades e situações relevantes (máx. 20 fotos, 5MB cada)</CardDescription>
            </CardHeader>
            <CardContent>
              <PhotoUploader photos={photos} onPhotosChange={setPhotos} maxFiles={20} maxSizeMB={5} />
            </CardContent>
          </Card>

          {/* Edit mode banner */}
          {editingInspectionId && (
            <div className="flex items-center justify-between rounded-lg border border-amber-300 bg-amber-50 px-4 py-2 text-sm text-amber-800">
              <span>✏️ Modo edição — você está atualizando uma fiscalização existente.</span>
              <button
                className="ml-4 text-xs underline hover:text-amber-900"
                onClick={() => {
                  setEditingInspectionId(null);
                  setSelectedSchool(''); setDirector(''); setRegularStudents(''); setIntegralStudents('');
                  setInspectionDate(new Date().toISOString().split('T')[0]);
                  setInspectionTime(''); setVisitObjective(''); setGuidelines(''); setPhotos([]);
                  const blank: Record<SectionKey, ChecklistItemData[]> = {} as Record<SectionKey, ChecklistItemData[]>;
                  (Object.keys(checklistSections) as SectionKey[]).forEach(s => {
                    blank[s] = checklistSections[s].map(q => ({ question: q, answer: null, observation: '', photoUrl: '' }));
                  });
                  setChecklist(blank);
                  toast.info('Formulário limpo. Nova fiscalização.');
                }}
              >
                Cancelar edição
              </button>
            </div>
          )}

          {/* Score preview + Save */}
          <div className="flex items-center justify-between rounded-xl border bg-card p-4">
            <div>
              <p className="text-sm text-muted-foreground">Conformidade estimada</p>
              <span className={`text-2xl font-bold ${scoreColor(currentScore)}`}>{currentScore}%</span>
            </div>
            <Button
              onClick={handleSaveInspection}
              disabled={submitting}
              className="gap-2 bg-accent hover:bg-accent/90 text-accent-foreground"
              size="lg"
            >
              {submitting
                ? <><Loader2 className="h-4 w-4 animate-spin" /> Salvando…</>
                : editingInspectionId
                  ? <><ClipboardCheck className="h-4 w-4" /> Atualizar Fiscalização</>
                  : <><ClipboardCheck className="h-4 w-4" /> Salvar Fiscalização</>
              }
            </Button>
          </div>
        </TabsContent>

        {/* ── Histórico ─────────────────────────────────────────────────── */}
        <TabsContent value="history" className="space-y-5">
          {/* Filtros */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Filtrar Histórico</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Escola</label>
                  <Select value={filterSchoolHistory} onValueChange={setFilterSchoolHistory}>
                    <SelectTrigger><SelectValue placeholder="Todas" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas as escolas</SelectItem>
                      {schools.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">De</label>
                  <Input type="date" value={filterDateStart} onChange={e => setFilterDateStart(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Até</label>
                  <Input type="date" value={filterDateEnd} onChange={e => setFilterDateEnd(e.target.value)} />
                </div>
              </div>
            </CardContent>
          </Card>

          {filteredInspections.length === 0 ? (
            <Card>
              <CardContent className="pt-8 pb-8 text-center text-muted-foreground">
                <ClipboardCheck className="h-10 w-10 mx-auto mb-3 opacity-30" />
                <p>Nenhuma fiscalização registrada</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {filteredInspections.map(inspection => (
                <Card key={inspection.id} className={`transition-shadow hover:shadow-md ${scoreBgClass(inspection.overallScore)}`}>
                  <CardHeader className="pb-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle className="text-base">{inspection.schoolName}</CardTitle>
                        <CardDescription>{inspection.nutritionist} · {new Date(inspection.inspectionDate).toLocaleDateString('pt-BR')}</CardDescription>
                      </div>
                      <div className="text-right">
                        <div className={`text-3xl font-bold ${scoreColor(inspection.overallScore)}`}>{inspection.overallScore}%</div>
                        <div className="text-xs text-muted-foreground">Conformidade</div>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4 pt-0">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                      <div><p className="text-muted-foreground text-xs">Diretor(a)</p><p className="font-medium">{inspection.director}</p></div>
                      <div><p className="text-muted-foreground text-xs">Horário</p><p className="font-medium">{inspection.inspectionTime || '—'}</p></div>
                      <div><p className="text-muted-foreground text-xs">Al. Regulares</p><p className="font-medium">{inspection.regularStudents}</p></div>
                      <div><p className="text-muted-foreground text-xs">Al. Integrais</p><p className="font-medium">{inspection.integralStudents}</p></div>
                    </div>

                    {inspection.photos && inspection.photos.length > 0 && (
                      <div>
                        <p className="text-xs font-medium text-muted-foreground mb-2">Fotos ({inspection.photos.length})</p>
                        <div className="grid grid-cols-4 md:grid-cols-8 gap-1.5">
                          {inspection.photos.map((photo, idx) => (
                            <img key={idx} src={photo} alt={`Foto ${idx + 1}`}
                              className="w-full h-14 object-cover rounded-md border hover:border-accent cursor-pointer transition"
                            />
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="flex gap-2 flex-wrap pt-1">
                      <Button variant="outline" size="sm" className="gap-1.5" onClick={() => { generateInspectionPDF(inspection).catch(() => {}); }}>
                        <Download className="h-3.5 w-3.5" /> Baixar PDF
                      </Button>

                      {/* Maintenance Dialog */}
                      <Dialog open={maintenanceDialogOpen && selectedInspectionForMaintenance?.id === inspection.id}
                        onOpenChange={open => { if (!open) setMaintenanceDialogOpen(false); }}>
                        <DialogTrigger asChild>
                          <Button variant="outline" size="sm" className="gap-1.5"
                            onClick={() => { setSelectedInspectionForMaintenance(inspection); setMaintenanceDialogOpen(true); }}>
                            <Wrench className="h-3.5 w-3.5" /> Manutenção
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Relatar Problema Estrutural</DialogTitle>
                            <DialogDescription>Ticket de manutenção para {inspection.schoolName}</DialogDescription>
                          </DialogHeader>
                          <div className="space-y-4">
                            <div className="space-y-1.5">
                              <label className="text-sm font-medium">Equipamento *</label>
                              <Input placeholder="Ex: Fogão, Geladeira, Freezer" value={maintenanceEquipment} onChange={e => setMaintenanceEquipment(e.target.value)} />
                            </div>
                            <div className="space-y-1.5">
                              <label className="text-sm font-medium">Descrição do Defeito *</label>
                              <Textarea placeholder="Descreva o problema" value={maintenanceDescription} onChange={e => setMaintenanceDescription(e.target.value)} />
                            </div>
                            <div className="space-y-1.5">
                              <label className="text-sm font-medium">Prioridade</label>
                              <Select value={maintenancePriority} onValueChange={(v: any) => setMaintenancePriority(v)}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="low">Baixa</SelectItem>
                                  <SelectItem value="high">Alta</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="flex gap-3 justify-end">
                              <Button variant="outline" onClick={() => setMaintenanceDialogOpen(false)}>Cancelar</Button>
                              <Button onClick={handleSaveMaintenance} className="bg-accent hover:bg-accent/90 text-accent-foreground">Criar Ticket</Button>
                            </div>
                          </div>
                        </DialogContent>
                      </Dialog>

                      {/* Edit & Delete - correctly outside Dialog */}
                      <Button variant="ghost" size="sm" className="gap-1.5 text-primary hover:bg-primary/10"
                        onClick={() => handleEditInspection(inspection)}>
                        <Pencil className="h-3.5 w-3.5" /> Editar
                      </Button>
                      <Button variant="ghost" size="sm" className="gap-1.5 text-destructive hover:bg-destructive/10"
                        onClick={() => handleDeleteInspection(inspection.id)}>
                        <Trash2 className="h-3.5 w-3.5" /> Excluir
                      </Button>

                      {/* Certificate - shown when ≥80% */}
                      {inspection.overallScore >= 80 && (
                        <Dialog open={certificateDialogOpen && selectedInspectionForCertificate?.id === inspection.id}
                          onOpenChange={open => { if (!open) setCertificateDialogOpen(false); }}>
                          <DialogTrigger asChild>
                            <Button size="sm" className="gap-1.5 bg-accent hover:bg-accent/90 text-accent-foreground"
                              onClick={() => { setSelectedInspectionForCertificate(inspection); setCertificateDialogOpen(true); }}>
                              <Trophy className="h-3.5 w-3.5" /> Certificado
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle className="flex items-center gap-2">
                                <Trophy className="h-5 w-5 text-yellow-500" /> Emitir Certificado
                              </DialogTitle>
                              <DialogDescription>
                                {inspection.schoolName} atingiu {inspection.overallScore}% de conformidade.
                              </DialogDescription>
                            </DialogHeader>
                            <Alert className="bg-green-50 border-green-200">
                              <CheckCircle2 className="h-4 w-4 text-green-600" />
                              <AlertDescription className="text-green-800">
                                Esta unidade cumpre as Boas Práticas de Manipulação — PNAE/RDC 216/2004
                              </AlertDescription>
                            </Alert>
                            <div className="flex gap-3 justify-end">
                              <Button variant="outline" onClick={() => setCertificateDialogOpen(false)}>Cancelar</Button>
                              <Button
                                className="gap-2 bg-accent hover:bg-accent/90 text-accent-foreground"
                                onClick={() => {
                                  if (selectedInspectionForCertificate) {
                                    generateSchoolCertificatePDF(selectedInspectionForCertificate, signatureUrl).catch(() => {});
                                    setCertificateDialogOpen(false);
                                    toast.success('Certificado gerado!');
                                  }
                                }}>
                                <Download className="h-4 w-4" /> Gerar Certificado PDF
                              </Button>
                            </div>
                          </DialogContent>
                        </Dialog>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
        {/* ── Painel Geral ──────────────────────────────────────────────── */}
        <TabsContent value="panel" className="space-y-6">
          {inspections.length === 0 ? (
            <Card><CardContent className="py-12 text-center text-muted-foreground">
              <BarChart3 className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p>Nenhuma fiscalização registrada ainda.</p>
            </CardContent></Card>
          ) : (() => {
            // ── Aggregate calculations ───────────────────────────────────
            const sorted = [...inspections].sort((a, b) =>
              new Date(a.inspectionDate).getTime() - new Date(b.inspectionDate).getTime()
            );
            const avg = Math.round(inspections.reduce((s, i) => s + i.overallScore, 0) / inspections.length);
            const passed = inspections.filter(i => i.overallScore >= 80).length;
            const passRate = Math.round((passed / inspections.length) * 100);

            // Per-school stats
            const schoolMap2 = new Map<string, { name: string; scores: number[]; dates: Date[] }>();
            inspections.forEach(i => {
              if (!schoolMap2.has(i.schoolId)) schoolMap2.set(i.schoolId, { name: i.schoolName, scores: [], dates: [] });
              const s = schoolMap2.get(i.schoolId)!;
              s.scores.push(i.overallScore);
              s.dates.push(new Date(i.inspectionDate));
            });
            const schoolStats = Array.from(schoolMap2.values()).map(s => {
              const avgScore = Math.round(s.scores.reduce((a, b) => a + b, 0) / s.scores.length);
              const last = s.scores[s.scores.length - 1];
              const prev = s.scores.length > 1 ? s.scores[s.scores.length - 2] : null;
              const trend = prev === null ? 'new' : last > prev ? 'up' : last < prev ? 'down' : 'same';
              return { name: s.name, avgScore, visits: s.scores.length, trend, last };
            }).sort((a, b) => b.avgScore - a.avgScore);

            // Per-nutritionist stats
            const nutrMap = new Map<string, number[]>();
            inspections.forEach(i => {
              if (!nutrMap.has(i.nutritionist)) nutrMap.set(i.nutritionist, []);
              nutrMap.get(i.nutritionist)!.push(i.overallScore);
            });
            const nutrStats = Array.from(nutrMap.entries()).map(([name, scores]) => ({
              name, visits: scores.length,
              avg: Math.round(scores.reduce((a, b) => a + b, 0) / scores.length),
            })).sort((a, b) => b.visits - a.visits);

            // Section performance across all inspections
            const sectionKeys2: SectionKey[] = ['manipulationProcedures','uniformization','stockManagement','refrigerator','kitchen','distribution','pestControl','waterPotability','physicalStructure'];
            const sectionPerf = sectionKeys2.map(k => {
              let totalYes = 0, totalItems = 0;
              inspections.forEach(insp => {
                const items = (insp as any)[k] as ChecklistItemData[] | undefined;
                if (!items) return;
                items.forEach(item => { if (item.answer !== null) { totalItems++; if (item.answer === 'yes') totalYes++; } });
              });
              const pct = totalItems > 0 ? Math.round((totalYes / totalItems) * 100) : 0;
              return { label: (sectionLabels as any)[k] || k, pct };
            }).sort((a, b) => a.pct - b.pct); // worst first

            return (
              <>
                {/* Print button */}
                <div className="flex justify-end">
                  <Button
                    variant="outline"
                    className="gap-2 border-green-600 text-green-700 hover:bg-green-50"
                    onClick={() =>
                      generatePanelPDF({ total: inspections.length, avg, schoolCount: schoolMap2.size, passRate, schoolStats, nutrStats, sectionPerf, sorted })
                        .catch(() => toast.error('Erro ao gerar PDF.'))
                    }
                  >
                    <Download className="h-4 w-4" />
                    Imprimir Painel
                  </Button>
                </div>

                {/* Summary cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {[
                    { label: 'Total de visitas', value: String(inspections.length), color: 'text-gray-900' },
                    { label: 'Conformidade média', value: `${avg}%`, color: scoreColor(avg) },
                    { label: 'Escolas visitadas', value: String(schoolMap2.size), color: 'text-blue-700' },
                    { label: 'Taxa de aprovação (≥80%)', value: `${passRate}%`, color: passRate >= 70 ? 'text-green-600' : 'text-amber-600' },
                  ].map(c => (
                    <Card key={c.label}>
                      <CardContent className="p-4">
                        <p className="text-xs text-muted-foreground">{c.label}</p>
                        <p className={`text-3xl font-bold mt-1 ${c.color}`}>{c.value}</p>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                {/* Score by school */}
                <Card>
                  <CardHeader><CardTitle className="text-base">Conformidade por Escola</CardTitle></CardHeader>
                  <CardContent className="space-y-3">
                    {schoolStats.map(s => (
                      <div key={s.name}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm truncate max-w-[55%]" title={s.name}>{s.name}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground">{s.visits} visita{s.visits > 1 ? 's' : ''}</span>
                            {s.trend === 'up'   && <TrendingUp   className="h-3.5 w-3.5 text-green-600" aria-label="Melhorando" />}
                            {s.trend === 'down' && <TrendingDown className="h-3.5 w-3.5 text-red-500"   aria-label="Piorando" />}
                            {s.trend === 'same' && <Minus        className="h-3.5 w-3.5 text-gray-400"  aria-label="Estável" />}
                            <span className={`font-bold text-sm w-10 text-right ${scoreColor(s.avgScore)}`}>{s.avgScore}%</span>
                          </div>
                        </div>
                        <div className="h-2 w-full rounded-full bg-gray-100">
                          <div
                            className={`h-2 rounded-full transition-all ${s.avgScore >= 80 ? 'bg-green-500' : s.avgScore >= 60 ? 'bg-amber-400' : 'bg-red-500'}`}
                            style={{ width: `${s.avgScore}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>

                {/* Timeline + Per-nutritionist side by side */}
                <div className="grid md:grid-cols-2 gap-4">
                  <Card>
                    <CardHeader><CardTitle className="text-base">Tendência ao Longo do Tempo</CardTitle></CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {sorted.slice(-12).map((insp, idx) => (
                          <div key={insp.id} className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground w-20 shrink-0">
                              {new Date(insp.inspectionDate).toLocaleDateString('pt-BR', { day:'2-digit', month:'short' })}
                            </span>
                            <div className="flex-1 h-2 rounded-full bg-gray-100">
                              <div
                                className={`h-2 rounded-full ${insp.overallScore >= 80 ? 'bg-green-500' : insp.overallScore >= 60 ? 'bg-amber-400' : 'bg-red-500'}`}
                                style={{ width: `${insp.overallScore}%` }}
                              />
                            </div>
                            <span className={`text-xs font-bold w-9 text-right ${scoreColor(insp.overallScore)}`}>{insp.overallScore}%</span>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader><CardTitle className="text-base">Por Nutricionista</CardTitle></CardHeader>
                    <CardContent className="space-y-3">
                      {nutrStats.map(n => (
                        <div key={n.name} className="rounded-lg border p-3">
                          <div className="flex items-center justify-between">
                            <span className="font-medium text-sm">{n.name}</span>
                            <span className={`font-bold ${scoreColor(n.avg)}`}>{n.avg}%</span>
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">{n.visits} visita{n.visits > 1 ? 's' : ''} realizadas</p>
                          <div className="h-1.5 w-full rounded-full bg-gray-100 mt-2">
                            <div className={`h-1.5 rounded-full ${n.avg >= 80 ? 'bg-green-500' : n.avg >= 60 ? 'bg-amber-400' : 'bg-red-500'}`} style={{ width: `${n.avg}%` }} />
                          </div>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                </div>

                {/* Section performance */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Desempenho por Seção do Checklist</CardTitle>
                    <CardDescription>Seções com menor conformidade aparecem primeiro</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {sectionPerf.map(s => (
                      <div key={s.label}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm">{s.label}</span>
                          <span className={`font-bold text-sm ${scoreColor(s.pct)}`}>{s.pct}%</span>
                        </div>
                        <div className="h-2 w-full rounded-full bg-gray-100">
                          <div
                            className={`h-2 rounded-full ${s.pct >= 80 ? 'bg-green-500' : s.pct >= 60 ? 'bg-amber-400' : 'bg-red-500'}`}
                            style={{ width: `${s.pct}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </>
            );
          })()}
        </TabsContent>
      </Tabs>
    </div>
  );
}
