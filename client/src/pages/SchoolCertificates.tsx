import { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Download, Trophy, Award, TrendingUp, School2, AlertTriangle } from 'lucide-react';
import { useInspections, useSchools } from '@/hooks/useFirestore';
import { useAuth } from '@/contexts/AuthContext';
import { useOrgSettings } from '@/hooks/useOrgSettings';
import { toast } from 'sonner';
import { jsPDF } from 'jspdf';

interface SchoolCertificate {
  schoolId: string;
  schoolName: string;
  averageConformity: number;
  bestScore: number;
  lastInspectionDate: Date;
  lastInspectionDirector: string;
  totalInspections: number;
  isCompliant: boolean;
}

// ── Canvas watermark helpers (same as Training / Inspection) ─────────────────
function drawAppleCanvas(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  ctx.save();
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(185,28,28,0.18)'; ctx.fill();
  ctx.beginPath(); ctx.arc(x + r * 0.35, y, r * 0.6, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(220,38,38,0.13)'; ctx.fill();
  ctx.beginPath(); ctx.moveTo(x, y - r);
  ctx.bezierCurveTo(x + r * 0.3, y - r * 1.5, x + r * 0.6, y - r * 1.3, x + r * 0.2, y - r * 0.8);
  ctx.strokeStyle = 'rgba(21,128,61,0.25)'; ctx.lineWidth = r * 0.2; ctx.stroke();
  ctx.restore();
}

function drawCarrotCanvas(ctx: CanvasRenderingContext2D, x: number, y: number, size: number) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(Math.PI / 6);
  ctx.beginPath(); ctx.moveTo(0, -size); ctx.lineTo(size * 0.3, size * 0.6); ctx.lineTo(-size * 0.3, size * 0.6); ctx.closePath();
  ctx.fillStyle = 'rgba(234,88,12,0.2)'; ctx.fill();
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    ctx.moveTo(0, -size - size * 0.1 * i);
    ctx.bezierCurveTo(size * 0.5, -size - size * 0.6 - i * size * 0.1, -size * 0.5, -size - size * 0.6 - i * size * 0.1, 0, -size - size * 0.1 * i);
    ctx.fillStyle = 'rgba(21,128,61,0.22)'; ctx.fill();
  }
  ctx.restore();
}

function drawLeafCanvas(ctx: CanvasRenderingContext2D, x: number, y: number, size: number) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(Math.PI / 4);
  ctx.beginPath(); ctx.moveTo(0, -size);
  ctx.bezierCurveTo(size * 0.8, -size * 0.5, size * 0.8, size * 0.5, 0, size);
  ctx.bezierCurveTo(-size * 0.8, size * 0.5, -size * 0.8, -size * 0.5, 0, -size);
  ctx.fillStyle = 'rgba(21,128,61,0.17)'; ctx.fill();
  ctx.restore();
}

function buildWatermarkDataUrl(pdfWmm: number, pdfHmm: number): string {
  const scale = 3.7795;
  const cw = Math.round(pdfWmm * scale), ch = Math.round(pdfHmm * scale);
  const canvas = document.createElement('canvas');
  canvas.width = cw; canvas.height = ch;
  const ctx = canvas.getContext('2d')!;
  const positions = [
    { x: 0.08, y: 0.1 }, { x: 0.25, y: 0.22 }, { x: 0.55, y: 0.08 }, { x: 0.75, y: 0.18 },
    { x: 0.92, y: 0.1 }, { x: 0.12, y: 0.45 }, { x: 0.38, y: 0.55 }, { x: 0.65, y: 0.42 },
    { x: 0.88, y: 0.48 }, { x: 0.18, y: 0.78 }, { x: 0.45, y: 0.88 }, { x: 0.7, y: 0.75 },
    { x: 0.92, y: 0.82 }, { x: 0.5, y: 0.35 },
  ];
  positions.forEach((p, i) => {
    const px = p.x * cw, py = p.y * ch, s = 18 + (i % 3) * 6;
    if (i % 3 === 0) drawAppleCanvas(ctx, px, py, s);
    else if (i % 3 === 1) drawCarrotCanvas(ctx, px, py, s);
    else drawLeafCanvas(ctx, px, py, s);
  });
  ctx.save();
  ctx.translate(cw / 2, ch / 2); ctx.rotate(-Math.PI / 4);
  ctx.font = `bold ${Math.round(ch * 0.18)}px Arial`;
  ctx.fillStyle = 'rgba(22,101,52,0.07)';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('PNAE', 0, 0);
  ctx.restore();
  return canvas.toDataURL('image/png');
}

async function generateCertificatePDF(
  cert: SchoolCertificate,
  signatureUrl?: string,
  signer?: { name: string; crn: string; municipio?: string; uf?: string },
  orgLogoUrl?: string,
) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pw = doc.internal.pageSize.getWidth();
  const ph = doc.internal.pageSize.getHeight();

  // ── Helpers ──
  const green: [number, number, number]  = [22, 101, 52];
  const navy:  [number, number, number]  = [27, 42, 74];
  const ivory: [number, number, number]  = [255, 253, 244];
  const loadImg = (src: string) =>
    fetch(src).then(r => r.blob()).then(b => new Promise<string>((res, rej) => {
      const fr = new FileReader(); fr.onloadend = () => res(fr.result as string); fr.onerror = rej; fr.readAsDataURL(b);
    }));
  const toDataUrl = async (url?: string) => {
    if (!url) return undefined;
    if (url.startsWith('data:')) return url;
    return loadImg(url).catch(() => undefined);
  };

  // Pre-load images in parallel
  const [resolvedSig, resolvedLogo] = await Promise.all([
    toDataUrl(signatureUrl),
    toDataUrl(orgLogoUrl),
  ]);

  // ── Marca d'água ──
  const wmUrl = buildWatermarkDataUrl(pw, ph);
  doc.setFillColor(...ivory);
  doc.rect(0, 0, pw, ph, 'F');
  doc.addImage(wmUrl, 'PNG', 0, 0, pw, ph);

  // ── Moldura dupla ──
  doc.setDrawColor(...green);
  doc.setLineWidth(4);
  doc.rect(7, 7, pw - 14, ph - 14);
  doc.setLineWidth(0.8);
  doc.setDrawColor(21, 128, 61);
  doc.rect(11, 11, pw - 22, ph - 22);

  // ── Faixa de cabeçalho ──
  doc.setFillColor(...navy);
  doc.rect(11, 11, pw - 22, 36, 'F');

  // Logo org (esquerda)
  if (resolvedLogo) {
    try { doc.addImage(resolvedLogo, 'PNG', 15, 14, 28, 28); } catch (_) {}
  }
  // Logo padrão nutricao (direita)
  try {
    const nutData = await loadImg('/logo-nutricao.png').catch(() => null);
    if (nutData) doc.addImage(nutData, 'PNG', pw - 43, 14, 28, 28);
  } catch (_) {}

  // Texto cabeçalho
  const municipioLabel = signer?.municipio
    ? `SECRETARIA DE EDUCAÇÃO — ${signer.municipio.toUpperCase()}${signer.uf ? `/${signer.uf.toUpperCase()}` : ''}`
    : 'SECRETARIA DE EDUCAÇÃO — PROGRAMA PNAE';
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text(municipioLabel, pw / 2, 22, { align: 'center' });
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(180, 220, 180);
  doc.text('PROGRAMA NACIONAL DE ALIMENTAÇÃO ESCOLAR — PNAE', pw / 2, 30, { align: 'center' });
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.text('RDC ANVISA nº 216/2004  ·  Resolução FNDE/CD nº 06/2020  ·  Lei nº 11.947/2009', pw / 2, 40, { align: 'center' });

  // ── Título principal ──
  doc.setTextColor(...green);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(32);
  doc.text('CERTIFICADO DE QUALIDADE', pw / 2, 62, { align: 'center' });

  // Linha decorativa
  const lineY = 67;
  doc.setDrawColor(...green);
  doc.setLineWidth(0.4);
  doc.line(pw * 0.18, lineY, pw * 0.82, lineY);
  // ponto central
  doc.setFillColor(...green);
  doc.circle(pw / 2, lineY, 1.5, 'F');

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(90, 90, 90);
  doc.text('Boas Práticas de Manipulação de Alimentos em Unidade de Alimentação Escolar', pw / 2, 73, { align: 'center' });

  // ── Corpo ──
  doc.setFontSize(11.5);
  doc.setTextColor(60, 60, 60);
  doc.text('Certificamos que a unidade de alimentação escolar da instituição', pw / 2, 83, { align: 'center' });

  // Nome da escola
  doc.setFontSize(cert.schoolName.length > 50 ? 16 : 20);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...green);
  const nameLines = doc.splitTextToSize(cert.schoolName, pw - 60);
  doc.text(nameLines, pw / 2, 94, { align: 'center' });
  const nameEnd = 94 + (nameLines.length - 1) * (cert.schoolName.length > 50 ? 8 : 10);

  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(70, 70, 70);
  doc.text('atingiu a conformidade média de', pw / 2, nameEnd + 10, { align: 'center' });

  // Score — grande destaque
  const scoreColor: [number, number, number] = cert.averageConformity >= 80
    ? [21, 128, 61] : cert.averageConformity >= 60 ? [180, 120, 0] : [185, 28, 28];
  doc.setFontSize(42);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...scoreColor);
  doc.text(`${cert.averageConformity}%`, pw / 2, nameEnd + 26, { align: 'center' });

  // Barra de conformidade
  const barW = 100, barX = (pw - barW) / 2, barY = nameEnd + 31;
  doc.setFillColor(230, 230, 230);
  doc.roundedRect(barX, barY, barW, 4, 2, 2, 'F');
  doc.setFillColor(...scoreColor);
  doc.roundedRect(barX, barY, barW * (cert.averageConformity / 100), 4, 2, 2, 'F');

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(80, 80, 80);
  doc.text(
    'nas verificações de Boas Práticas de Manipulação de Alimentos realizadas pela equipe de nutrição.',
    pw / 2, nameEnd + 42, { align: 'center' }
  );

  // ── Info row (4 colunas) ──
  const infoY = nameEnd + 52;
  doc.setFillColor(243, 250, 244);
  doc.roundedRect(14, infoY - 5, pw - 28, 14, 2, 2, 'F');
  doc.setDrawColor(200, 235, 210);
  doc.setLineWidth(0.2);
  doc.roundedRect(14, infoY - 5, pw - 28, 14, 2, 2, 'D');

  const infoCols: [string, string][] = [
    ['Última inspeção', cert.lastInspectionDate.toLocaleDateString('pt-BR')],
    ['Diretor(a)', cert.lastInspectionDirector || '—'],
    ['Total de inspeções', String(cert.totalInspections)],
    ['Emissão', new Date().toLocaleDateString('pt-BR')],
  ];
  infoCols.forEach(([label, value], i) => {
    const x = pw * (0.15 + i * 0.23);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(120, 120, 120);
    doc.text(label.toUpperCase(), x, infoY + 0.5, { align: 'center' });
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(40, 40, 40);
    doc.text(value, x, infoY + 6, { align: 'center' });
  });

  // ── Área de assinatura ──
  const sigY = ph - 34;

  // Selo (esquerda)
  doc.setFillColor(240, 253, 244);
  doc.setDrawColor(...green);
  doc.setLineWidth(0.8);
  doc.circle(pw * 0.14, sigY - 2, 15, 'FD');
  doc.setLineWidth(0.3);
  doc.circle(pw * 0.14, sigY - 2, 13, 'D');
  doc.setFontSize(6.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...green);
  doc.text('BOAS', pw * 0.14, sigY - 7, { align: 'center' });
  doc.text('PRÁTICAS', pw * 0.14, sigY - 2, { align: 'center' });
  doc.text('✓ PNAE', pw * 0.14, sigY + 3, { align: 'center' });

  // Linha de pontuação (direita)
  const scoreBoxX = pw * 0.72;
  doc.setFillColor(cert.averageConformity >= 80 ? 240 : 255, cert.averageConformity >= 80 ? 253 : 243, cert.averageConformity >= 80 ? 244 : 220);
  doc.roundedRect(scoreBoxX - 18, sigY - 16, 36, 22, 3, 3, 'F');
  doc.setDrawColor(...scoreColor);
  doc.setLineWidth(0.5);
  doc.roundedRect(scoreBoxX - 18, sigY - 16, 36, 22, 3, 3, 'D');
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...scoreColor);
  doc.text(`${cert.averageConformity}%`, scoreBoxX, sigY - 4, { align: 'center' });
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...scoreColor);
  doc.text(cert.averageConformity >= 80 ? 'CONFORMIDADE PLENA' : cert.averageConformity >= 60 ? 'EM DESENVOLVIMENTO' : 'NECESSITA ATENÇÃO', scoreBoxX, sigY + 3, { align: 'center' });

  // Bloco assinatura (centro)
  const rtX = pw * 0.45;
  if (resolvedSig) {
    try { doc.addImage(resolvedSig, 'PNG', rtX - 30, sigY - 18, 60, 16, '', 'NONE'); } catch (_) {}
  }
  doc.setDrawColor(100, 100, 100);
  doc.setLineWidth(0.4);
  doc.line(rtX - 34, sigY - 1, rtX + 34, sigY - 1);
  const signerName = signer?.name || '';
  const signerCrn  = signer?.crn  || '';
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(40, 40, 40);
  doc.text(signerName || 'Nutricionista Responsável Técnica', rtX, sigY + 5, { align: 'center' });
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(80, 80, 80);
  doc.text(
    signerCrn ? `Nutricionista RT PNAE — ${signerCrn}` : 'Responsável Técnica — PNAE',
    rtX, sigY + 11, { align: 'center' }
  );

  // ── Rodapé ──
  doc.setFontSize(7);
  doc.setTextColor(150, 150, 150);
  doc.text(
    `Certificado válido por 12 meses a partir da data de emissão. Gerado em ${new Date().toLocaleDateString('pt-BR')} — EduPlate Menu`,
    pw / 2, ph - 14, { align: 'center' }
  );

  doc.save(`Certificado_${cert.schoolName.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`);
  toast.success('Certificado gerado!');
}

// ── Score helpers ─────────────────────────────────────────────────────────────
function scoreColor(score: number) {
  if (score >= 80) return 'text-green-600';
  if (score >= 60) return 'text-amber-500';
  return 'text-red-500';
}

function scoreBarClass(score: number) {
  if (score >= 80) return 'bg-green-500';
  if (score >= 60) return 'bg-amber-400';
  return 'bg-red-500';
}

// ── Component ────────────────────────────────────────────────────────────────
export default function SchoolCertificates() {
  const { user } = useAuth();
  const orgId = user?.organizationId || 'pnae-default-org';
  const { inspections } = useInspections();
  const { schools } = useSchools();
  const { settings: orgSettings } = useOrgSettings();

  // Signer from orgSettings (Firestore), fallback to localStorage SIGPC config
  const signer = useMemo(() => {
    if (orgSettings.nutritionistName) {
      return {
        name: orgSettings.nutritionistName,
        crn:  orgSettings.nutritionistCrn  || '',
        municipio: orgSettings.municipio || '',
        uf:   orgSettings.uf || 'SP',
      };
    }
    try {
      const raw = localStorage.getItem(`pnae_sigpc_entity_config_${orgId}`)
        || localStorage.getItem('pnae_sigpc_entity_config');
      if (raw) {
        const cfg = JSON.parse(raw);
        return { name: cfg.nutricionista || '', crn: cfg.crn || '', municipio: cfg.municipio || '', uf: cfg.uf || 'SP' };
      }
    } catch (_) {}
    return { name: '', crn: '', municipio: '', uf: 'SP' };
  }, [orgSettings, orgId]);

  // Signature: prefer orgSettings (Firestore Storage), fallback to localStorage
  const signatureUrl = orgSettings.signatureUrl || localStorage.getItem('pnae_signature') || undefined;
  const orgLogoUrl   = orgSettings.logoUrl || undefined;


  const certificates = useMemo<SchoolCertificate[]>(() => {
    const map: Record<string, {
      scores: number[]; dates: Date[]; directors: string[]; count: number; schoolId: string;
    }> = {};

    inspections.forEach(ins => {
      if (!map[ins.schoolId]) {
        map[ins.schoolId] = { scores: [], dates: [], directors: [], count: 0, schoolId: ins.schoolId };
      }
      map[ins.schoolId].scores.push(ins.overallScore || 0);
      map[ins.schoolId].dates.push(new Date(ins.inspectionDate));
      map[ins.schoolId].directors.push(ins.director || '');
      map[ins.schoolId].count++;
    });

    return Object.entries(map).map(([schoolId, data]) => {
      const avg = Math.round(data.scores.reduce((a, b) => a + b, 0) / data.scores.length);
      const best = Math.max(...data.scores);
      const lastIdx = data.dates.reduce((maxI, d, i, arr) => d > arr[maxI] ? i : maxI, 0);
      const schoolName = schools.find(s => s.id === schoolId)?.name
        || inspections.find(i => i.schoolId === schoolId)?.schoolName
        || schoolId;
      return {
        schoolId,
        schoolName,
        averageConformity: avg,
        bestScore: best,
        lastInspectionDate: data.dates[lastIdx],
        lastInspectionDirector: data.directors[lastIdx],
        totalInspections: data.count,
        isCompliant: avg >= 80,
      };
    }).sort((a, b) => b.averageConformity - a.averageConformity);
  }, [inspections, schools]);

  const compliant = certificates.filter(c => c.isCompliant);
  const developing = certificates.filter(c => !c.isCompliant);

  return (
    <div className="flex-1 p-4 md:p-8 space-y-6 max-w-6xl mx-auto">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="brand-chip text-xs font-semibold">PNAE · Qualidade</span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Award className="h-7 w-7 text-accent" />
            Certificados de Qualidade
          </h1>
          <p className="text-muted-foreground mt-1">Escolas que atingiram conformidade nas normas PNAE</p>
        </div>

        {/* Info about signature source */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground rounded-lg border border-dashed px-3 py-2">
          {signatureUrl
            ? <><span className="text-green-600 font-semibold">✓ Assinatura configurada</span> — gerenciada em Treinamentos → Configurações</>
            : <><span className="text-amber-600 font-semibold">⚠ Sem assinatura</span> — configure em Treinamentos → Configurações</>
          }
        </div>
      </div>

      {/* Summary stats */}
      {certificates.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Total de escolas', value: certificates.length, icon: School2, color: 'text-primary' },
            { label: 'Conformes (≥80%)', value: compliant.length, icon: Trophy, color: 'text-green-600' },
            { label: 'Em desenvolvimento', value: developing.length, icon: TrendingUp, color: 'text-amber-500' },
            { label: 'Média geral', value: certificates.length > 0 ? `${Math.round(certificates.reduce((a, c) => a + c.averageConformity, 0) / certificates.length)}%` : '—', icon: Award, color: 'text-accent' },
          ].map(({ label, value, icon: Icon, color }) => (
            <Card key={label} className="brand-surface">
              <CardContent className="pt-4 pb-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground">{label}</p>
                    <p className={`text-2xl font-bold mt-0.5 ${color}`}>{value}</p>
                  </div>
                  <Icon className={`h-5 w-5 ${color} opacity-60 mt-1`} />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {certificates.length === 0 ? (
        <Card>
          <CardContent className="pt-12 pb-12 text-center">
            <Award className="h-12 w-12 mx-auto mb-3 text-muted-foreground opacity-30" />
            <p className="text-muted-foreground font-medium">Nenhuma inspeção registrada ainda</p>
            <p className="text-sm text-muted-foreground mt-1">Realize fiscalizações para gerar certificados</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-8">
          {/* Conformes */}
          {compliant.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold text-green-700 flex items-center gap-2 mb-4">
                <Trophy className="h-5 w-5 text-yellow-500" />
                Escolas Conformes (≥ 80%)
                <Badge className="bg-green-100 text-green-800 border-green-300 ml-1">{compliant.length}</Badge>
              </h2>
              <div className="grid gap-4 sm:grid-cols-2">
                {compliant.map(cert => (
                  <Card key={cert.schoolId} className="brand-surface border-green-200 hover:shadow-lg transition-shadow">
                    <CardHeader className="pb-2">
                      <div className="flex justify-between items-start">
                        <div className="flex-1 min-w-0 pr-3">
                          <CardTitle className="text-sm leading-tight">{cert.schoolName}</CardTitle>
                          <CardDescription className="text-xs mt-0.5">
                            {cert.totalInspections} inspeção(ões) · Última: {cert.lastInspectionDate.toLocaleDateString('pt-BR')}
                          </CardDescription>
                        </div>
                        <div className="text-right shrink-0">
                          <div className={`text-3xl font-bold ${scoreColor(cert.averageConformity)}`}>{cert.averageConformity}%</div>
                          <div className="text-xs text-muted-foreground">média</div>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-2 space-y-3">
                      {/* Progress bar */}
                      <div className="space-y-1">
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>Conformidade média</span>
                          <span>Melhor: {cert.bestScore}%</span>
                        </div>
                        <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                          <div className={`h-full rounded-full transition-all ${scoreBarClass(cert.averageConformity)}`}
                            style={{ width: `${cert.averageConformity}%` }} />
                        </div>
                      </div>

                      <Button
                        size="sm"
                        className="w-full gap-2 bg-accent hover:bg-accent/90 text-accent-foreground"
                        onClick={() => { generateCertificatePDF(cert, signatureUrl, signer, orgLogoUrl).catch(() => {}); }}
                      >
                        <Download className="h-4 w-4" />
                        Gerar Certificado PDF
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* Em desenvolvimento */}
          {developing.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold text-amber-700 flex items-center gap-2 mb-4">
                <AlertTriangle className="h-5 w-5" />
                Em Desenvolvimento ({'<'} 80%)
                <Badge className="bg-amber-100 text-amber-800 border-amber-300 ml-1">{developing.length}</Badge>
              </h2>
              <div className="grid gap-4 sm:grid-cols-2">
                {developing.map(cert => (
                  <Card key={cert.schoolId} className="brand-surface border-amber-200 hover:shadow-md transition-shadow">
                    <CardHeader className="pb-2">
                      <div className="flex justify-between items-start">
                        <div className="flex-1 min-w-0 pr-3">
                          <CardTitle className="text-sm leading-tight">{cert.schoolName}</CardTitle>
                          <CardDescription className="text-xs mt-0.5">
                            {cert.totalInspections} inspeção(ões) · Última: {cert.lastInspectionDate.toLocaleDateString('pt-BR')}
                          </CardDescription>
                        </div>
                        <div className="text-right shrink-0">
                          <div className={`text-3xl font-bold ${scoreColor(cert.averageConformity)}`}>{cert.averageConformity}%</div>
                          <div className="text-xs text-muted-foreground">média</div>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-2 space-y-3">
                      <div className="space-y-1">
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>Precisa de {80 - cert.averageConformity}% para certificado</span>
                          <span>Melhor: {cert.bestScore}%</span>
                        </div>
                        <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                          <div className={`h-full rounded-full transition-all ${scoreBarClass(cert.averageConformity)}`}
                            style={{ width: `${cert.averageConformity}%` }} />
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Realize novas visitas e implemente as orientações para atingir ≥80%.
                      </p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
