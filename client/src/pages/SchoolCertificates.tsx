import { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Download, Trophy, Award, TrendingUp, School2, AlertTriangle, Upload, X } from 'lucide-react';
import { useInspections, useSchools } from '@/hooks/useFirestore';
import { useAuth } from '@/contexts/AuthContext';
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

async function generateCertificatePDF(cert: SchoolCertificate, signatureUrl?: string, signer?: { name: string; crn: string }) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pw = doc.internal.pageSize.getWidth();
  const ph = doc.internal.pageSize.getHeight();
  const wmUrl = buildWatermarkDataUrl(pw, ph);

  // Ivory background + watermark
  doc.setFillColor(255, 253, 244);
  doc.rect(0, 0, pw, ph, 'F');
  doc.addImage(wmUrl, 'PNG', 0, 0, pw, ph);

  // Outer border (thick green)
  doc.setDrawColor(22, 101, 52);
  doc.setLineWidth(3.5);
  doc.rect(8, 8, pw - 16, ph - 16);
  // Inner border (thin)
  doc.setLineWidth(1);
  doc.setDrawColor(21, 128, 61);
  doc.rect(12, 12, pw - 24, ph - 24);

  // Header band — white background so logos are visible
  doc.setFillColor(255, 255, 255);
  doc.rect(12, 12, pw - 24, 32, 'F');
  // thin green bottom line for the header
  doc.setFillColor(22, 101, 52);
  doc.rect(12, 43, pw - 24, 1.5, 'F');

  // Logos
  try {
    const loadImg = (src: string) => fetch(src).then(r => r.blob()).then(b => new Promise<string>((res, rej) => { const fr = new FileReader(); fr.onloadend = () => res(fr.result as string); fr.onerror = rej; fr.readAsDataURL(b); }));
    const [brasaoUrl, nutricaoUrl] = await Promise.all([loadImg('/brasao-itai.png'), loadImg('/logo-nutricao.png')]);
    doc.addImage(brasaoUrl,   'PNG', 16,       14, 26, 26);
    doc.addImage(nutricaoUrl, 'PNG', pw - 42,  14, 26, 26);
  } catch (_) { /* logos optional */ }

  doc.setTextColor(22, 101, 52);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('PREFEITURA MUNICIPAL | SECRETARIA DE EDUCAÇÃO', pw / 2, 24, { align: 'center' });
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(60, 60, 60);
  doc.text('PROGRAMA NACIONAL DE ALIMENTAÇÃO ESCOLAR — PNAE', pw / 2, 33, { align: 'center' });

  // Title
  doc.setTextColor(22, 101, 52);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(28);
  doc.text('CERTIFICADO DE QUALIDADE', pw / 2, 62, { align: 'center' });

  doc.setFontSize(11);
  doc.setTextColor(80, 80, 80);
  doc.setFont('helvetica', 'normal');
  doc.text('Boas Práticas de Manipulação de Alimentos em Unidade de Alimentação Escolar', pw / 2, 72, { align: 'center' });

  // Decorative line
  doc.setDrawColor(21, 128, 61);
  doc.setLineWidth(0.5);
  doc.line(30, 77, pw - 30, 77);

  // Body
  doc.setFontSize(12);
  doc.setTextColor(50, 50, 50);
  doc.setFont('helvetica', 'normal');
  doc.text('Certificamos que a unidade de alimentação escolar da', pw / 2, 83, { align: 'center' });

  // School name (highlighted)
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(22, 101, 52);
  const nameLines = doc.splitTextToSize(cert.schoolName, pw - 60);
  doc.text(nameLines, pw / 2, 95, { align: 'center' });
  const nameEnd = 95 + (nameLines.length - 1) * 10;

  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(50, 50, 50);
  doc.text('alcançou conformidade média de', pw / 2, nameEnd + 12, { align: 'center' });

  // Score
  doc.setFontSize(34);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(21, 128, 61);
  doc.text(`${cert.averageConformity}%`, pw / 2, nameEnd + 28, { align: 'center' });

  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(50, 50, 50);
  doc.text('nas Boas Práticas de Manipulação de Alimentos — conforme RDC ANVISA nº 216/2004 e Resolução FNDE/CD nº 38/2009', pw / 2, nameEnd + 40, { align: 'center' });

  // Info row
  const infoY = nameEnd + 52;
  doc.setFontSize(9);
  doc.setTextColor(80, 80, 80);
  [
    [`Última inspeção: ${cert.lastInspectionDate.toLocaleDateString('pt-BR')}`, 0.2],
    [`Diretor(a): ${cert.lastInspectionDirector || '—'}`, 0.5],
    [`Total de inspeções: ${cert.totalInspections}`, 0.72],
    [`Emitido em: ${new Date().toLocaleDateString('pt-BR')}`, 0.88],
  ].forEach(([text, xRatio]) => {
    doc.text(String(text), pw * Number(xRatio), infoY, { align: 'center' });
  });

  // Divider
  doc.setDrawColor(200, 230, 200);
  doc.setLineWidth(0.3);
  doc.line(30, infoY + 6, pw - 30, infoY + 6);

  // Signature area
  const sigY = ph - 38;
  if (signatureUrl) {
    try { doc.addImage(signatureUrl, 'PNG', pw * 0.65, sigY - 16, 40, 14); } catch {}
  }
  doc.setDrawColor(100, 100, 100);
  doc.setLineWidth(0.4);
  doc.line(pw * 0.55, sigY, pw * 0.85, sigY);
  doc.setFontSize(9); doc.setFont('helvetica', 'bold'); doc.setTextColor(40, 40, 40);
  const signerName = signer?.name || '';
  const signerCrn  = signer?.crn  || '';
  if (signerName) {
    doc.text(signerName, pw * 0.7, sigY + 6, { align: 'center' });
    doc.setFontSize(8); doc.setFont('helvetica', 'normal'); doc.setTextColor(80, 80, 80);
    doc.text(signerCrn ? `Nutricionista RT PNAE — ${signerCrn}` : 'Nutricionista Responsável Técnica — PNAE', pw * 0.7, sigY + 12, { align: 'center' });
  } else {
    doc.setFontSize(8); doc.setFont('helvetica', 'normal'); doc.setTextColor(80, 80, 80);
    doc.text('Nutricionista Responsável Técnica — PNAE', pw * 0.7, sigY + 12, { align: 'center' });
  }

  // Seal
  doc.setFillColor(240, 253, 244); doc.setDrawColor(22, 101, 52); doc.setLineWidth(0.5);
  doc.circle(pw * 0.15, sigY - 2, 14, 'FD');
  doc.setFontSize(7); doc.setFont('helvetica', 'bold'); doc.setTextColor(22, 101, 52);
  doc.text('BOAS', pw * 0.15, sigY - 6, { align: 'center' });
  doc.text('PRÁTICAS', pw * 0.15, sigY - 1, { align: 'center' });
  doc.text('PNAE', pw * 0.15, sigY + 4, { align: 'center' });

  // Footer
  doc.setFontSize(7); doc.setTextColor(130, 130, 130);
  doc.text('Este certificado é válido como comprovante de conformidade com as normas do PNAE — válido por 12 meses a partir da data de emissão.', pw / 2, ph - 16, { align: 'center' });

  doc.save(`Certificado_${cert.schoolName}_${new Date().toISOString().split('T')[0]}.pdf`);
  toast.success('Certificado gerado com sucesso!');
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

  const signer = useMemo(() => {
    try {
      const raw = localStorage.getItem(`pnae_sigpc_entity_config_${orgId}`)
        || localStorage.getItem('pnae_sigpc_entity_config');
      if (raw) {
        const cfg = JSON.parse(raw);
        return { name: cfg.nutricionista || '', crn: cfg.crn || '' };
      }
    } catch (_) {}
    return { name: '', crn: '' };
  }, [orgId]);

  const [signatureUrl, setSignatureUrl] = useState<string | undefined>(
    () => localStorage.getItem('pnae_signature') || undefined
  );
  const [sigDialogOpen, setSigDialogOpen] = useState(false);

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

  function handleSignatureUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { toast.error('Selecione uma imagem'); return; }
    if (file.size > 2 * 1024 * 1024) { toast.error('Imagem máxima: 2MB'); return; }
    const reader = new FileReader();
    reader.onload = ev => {
      const dataUrl = ev.target?.result as string;
      setSignatureUrl(dataUrl);
      localStorage.setItem('pnae_signature', dataUrl);
      toast.success('Assinatura salva!');
      setSigDialogOpen(false);
    };
    reader.readAsDataURL(file);
  }

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

        <div className="flex gap-2 flex-wrap">
          <Dialog open={sigDialogOpen} onOpenChange={setSigDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2">
                <Upload className="h-4 w-4" />
                {signatureUrl ? 'Trocar Assinatura' : 'Carregar Assinatura'}
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Assinatura Digital</DialogTitle>
                <DialogDescription>
                  Carregue sua assinatura digitalizada (PNG/JPG transparente, máx. 2MB). Ela aparecerá em todos os certificados.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                {signatureUrl && (
                  <div className="relative w-48 h-16 border rounded-lg overflow-hidden mx-auto bg-gray-50">
                    <img src={signatureUrl} alt="Assinatura atual" className="w-full h-full object-contain" />
                    <button onClick={() => { setSignatureUrl(undefined); localStorage.removeItem('pnae_signature'); }}
                      className="absolute top-1 right-1 bg-white rounded-full p-0.5 shadow hover:bg-red-50">
                      <X className="h-3 w-3 text-red-500" />
                    </button>
                  </div>
                )}
                <Input type="file" accept="image/*" onChange={handleSignatureUpload} />
                <p className="text-xs text-muted-foreground">Recomendado: PNG com fundo transparente, resolução ≥ 300×100px</p>
              </div>
            </DialogContent>
          </Dialog>
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
                        onClick={() => { generateCertificatePDF(cert, signatureUrl, signer).catch(() => {}); }}
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
