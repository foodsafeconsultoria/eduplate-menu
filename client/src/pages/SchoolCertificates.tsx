import { useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Download, Trophy, Award, TrendingUp, School2, AlertTriangle } from 'lucide-react';
import { useInspections, useSchools } from '@/hooks/useFirestore';
import { useAuth } from '@/contexts/AuthContext';
import { useOrgSettings, OrgSettings } from '@/hooks/useOrgSettings';
import { toast } from 'sonner';
import { jsPDF } from 'jspdf';
import { storage } from '@/lib/firebase';
import { ref as storageRef, getBytes } from 'firebase/storage';

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

// ── Certificate PDF (mesmo padrão visual do módulo de Treinamentos) ──────────

async function generateCertificatePDF(
  cert: SchoolCertificate,
  signer: { name: string; crn: string; municipio?: string; uf?: string },
  orgSettings: Pick<OrgSettings, 'logoUrl' | 'logoDataUrl' | 'signatureUrl' | 'signatureDataUrl'>,
) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pw = doc.internal.pageSize.getWidth();   // 297
  const ph = doc.internal.pageSize.getHeight();  // 210

  // ── Image loader (Firebase-safe, sem CORS) ───────────────────────────────────
  const toDataUrl = async (url?: string | null): Promise<string | null> => {
    if (!url) return null;
    if (url.startsWith('data:')) return url;
    const extractStoragePath = (u: string): string | null => {
      try {
        const match = u.match(/\/o\/([^?]+)/);
        return match ? decodeURIComponent(match[1]) : null;
      } catch { return null; }
    };
    const blobToDataUrl = (blob: Blob): Promise<string> =>
      new Promise((res, rej) => {
        const fr = new FileReader();
        fr.onloadend = () => res(fr.result as string);
        fr.onerror = rej;
        fr.readAsDataURL(blob);
      });
    if (url.includes('firebasestorage.googleapis.com')) {
      const path = extractStoragePath(url);
      if (path) {
        try {
          const bytes = await getBytes(storageRef(storage, path));
          return await blobToDataUrl(new Blob([bytes]));
        } catch { /* fallback */ }
      }
    }
    try {
      const r = await fetch(url, { mode: 'cors' });
      if (!r.ok) return null;
      return await blobToDataUrl(await r.blob());
    } catch { return null; }
  };

  const imgFmt = (data: string): string => {
    if (data.startsWith('data:image/jpeg') || data.startsWith('data:image/jpg')) return 'JPEG';
    if (data.startsWith('data:image/webp')) return 'WEBP';
    return 'PNG';
  };
  const addImg = (data: string | null, x: number, y: number, w: number, h: number) => {
    if (!data) return;
    try { doc.addImage(data, imgFmt(data), x, y, w, h); } catch (_) {}
  };

  // Prefer stored dataUrl (no CORS), fallback to URL fetch
  const [orgLogo, sigImg] = await Promise.all([
    orgSettings.logoDataUrl
      ? Promise.resolve(orgSettings.logoDataUrl)
      : toDataUrl(orgSettings.logoUrl),
    orgSettings.signatureDataUrl
      ? Promise.resolve(orgSettings.signatureDataUrl)
      : toDataUrl(orgSettings.signatureUrl),
  ]);

  // ── Palette ──────────────────────────────────────────────────────────────────
  const G_DARK: [number, number, number] = [15,  70,  40];
  const G_MED:  [number, number, number] = [22, 101,  52];
  const G_TINT: [number, number, number] = [220, 245, 230];
  const GOLD:   [number, number, number] = [180, 140,  10];
  const GRAY:   [number, number, number] = [100, 100, 100];
  const DARK:   [number, number, number] = [40,   40,  40];
  const WHITE:  [number, number, number] = [255, 255, 255];

  const scoreRgb: [number, number, number] = cert.averageConformity >= 80
    ? [21, 128, 61] : cert.averageConformity >= 60 ? [180, 120, 0] : [185, 28, 28];

  // ── Background ───────────────────────────────────────────────────────────────
  doc.setFillColor(252, 252, 250);
  doc.rect(0, 0, pw, ph, 'F');

  // ── LEFT sidebar ─────────────────────────────────────────────────────────────
  const SIDE = 54;
  doc.setFillColor(...G_DARK);
  doc.rect(0, 0, SIDE, ph, 'F');
  doc.setFillColor(22, 90, 50);
  doc.rect(SIDE - 7, 0, 7, ph, 'F');

  // ── RIGHT + TOP + BOTTOM gold accents ────────────────────────────────────────
  doc.setFillColor(...GOLD);
  doc.rect(pw - 4, 0, 4, ph, 'F');
  doc.rect(SIDE, 0, pw - SIDE - 4, 2, 'F');
  doc.rect(SIDE, ph - 2, pw - SIDE - 4, 2, 'F');

  // ── BRASÃO no sidebar ────────────────────────────────────────────────────────
  const LOGO_R = 22;
  const LOGO_CX = SIDE / 2;
  const LOGO_CY = 30;
  doc.setFillColor(...WHITE);
  doc.circle(LOGO_CX, LOGO_CY, LOGO_R + 2, 'F');
  if (orgLogo) {
    addImg(orgLogo, LOGO_CX - LOGO_R, LOGO_CY - LOGO_R, LOGO_R * 2, LOGO_R * 2);
  } else {
    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...G_MED);
    doc.text('BRASÃO', LOGO_CX, LOGO_CY + 1, { align: 'center' });
  }

  // "QUALIDADE" label abaixo do brasão
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(180, 220, 190);
  doc.setCharSpace(1.5);
  doc.text('QUALIDADE', SIDE / 2, LOGO_CY + LOGO_R + 14, { align: 'center' });
  doc.setCharSpace(0);

  // Score badge circular no centro do sidebar
  const scoreCY = ph / 2 + 8;
  doc.setFillColor(255, 255, 255);
  doc.circle(SIDE / 2, scoreCY, 17, 'F');
  doc.setDrawColor(...scoreRgb);
  doc.setLineWidth(1.5);
  doc.circle(SIDE / 2, scoreCY, 17, 'D');
  doc.setLineWidth(0.3);
  doc.setFontSize(15);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...scoreRgb);
  doc.text(`${cert.averageConformity}%`, SIDE / 2, scoreCY + 5, { align: 'center' });

  // PNAE label rodapé do sidebar
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(180, 220, 190);
  doc.text('PNAE', SIDE / 2, ph - 8, { align: 'center' });

  // ── CONTEÚDO PRINCIPAL ────────────────────────────────────────────────────────
  const CX = SIDE + 14;
  const CW = pw - SIDE - 4 - CX - 8;

  let Y = 18;

  // Subtítulo
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...GRAY);
  doc.setCharSpace(1.8);
  doc.text('CERTIFICADO DE QUALIDADE — BOAS PRÁTICAS', CX, Y);
  doc.setCharSpace(0);

  // Título
  Y += 16;
  doc.setFontSize(46);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...G_MED);
  doc.text('CERTIFICADO', CX, Y);

  // Sublinhado dourado
  Y += 3;
  doc.setFillColor(...GOLD);
  doc.rect(CX, Y, 110, 2.5, 'F');

  // "Certificamos que..."
  Y += 14;
  doc.setFontSize(13);
  doc.setFont('helvetica', 'italic');
  doc.setTextColor(...GRAY);
  doc.text('Certificamos que a unidade de alimentação escolar da instituição', CX, Y);

  // Nome da escola
  Y += 12;
  const nameFontSize = cert.schoolName.length > 50 ? 18 : 26;
  doc.setFontSize(nameFontSize);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...DARK);
  const nameLines = doc.splitTextToSize(cert.schoolName.toUpperCase(), CW);
  doc.text(nameLines, CX, Y);
  Y += nameLines.length * (nameFontSize === 18 ? 8 : 11);

  // Texto de conformidade
  Y += 4;
  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...GRAY);
  doc.text('atingiu a conformidade média de', CX, Y);

  // Score grande
  Y += 12;
  doc.setFontSize(36);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...scoreRgb);
  doc.text(`${cert.averageConformity}%`, CX, Y);

  // Barra de progresso ao lado do score
  const barW = 80;
  const barX = CX + 38;
  const barY = Y - 6;
  doc.setFillColor(225, 225, 225);
  doc.roundedRect(barX, barY, barW, 5, 2, 2, 'F');
  doc.setFillColor(...scoreRgb);
  doc.roundedRect(barX, barY, barW * (cert.averageConformity / 100), 5, 2, 2, 'F');
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...GRAY);
  doc.text('nas verificações de Boas Práticas de Manipulação de Alimentos.', barX, barY + 14);

  Y += 14;

  // Chips de informações
  const lastInspDate = cert.lastInspectionDate.toLocaleDateString('pt-BR');
  const emDateStr = new Date().toLocaleDateString('pt-BR');
  const chips: [string, string][] = [
    ['ÚLTIMA INSPEÇÃO', lastInspDate],
    ['TOTAL INSPEÇÕES', String(cert.totalInspections)],
    ['EMISSÃO', emDateStr],
  ];
  if (cert.lastInspectionDirector) chips.splice(1, 0, ['DIRETOR(A)', cert.lastInspectionDirector]);
  let chipX = CX;
  doc.setFontSize(10);
  for (const [label, value] of chips) {
    const lw = doc.getTextWidth(label + ': ');
    const vw = doc.getTextWidth(value);
    const chipW = Math.min(lw + vw + 10, 115);
    doc.setFillColor(245, 250, 247);
    doc.setDrawColor(180, 215, 190);
    doc.setLineWidth(0.3);
    doc.roundedRect(chipX, Y - 6.5, chipW, 10.5, 2, 2, 'FD');
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...G_MED);
    doc.text(label + ': ', chipX + 3, Y);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...DARK);
    doc.text(value, chipX + 3 + lw, Y);
    chipX += chipW + 6;
    if (chipX > CX + CW - 60) { chipX = CX; Y += 15; }
  }
  Y += 14;

  // Divisória
  doc.setDrawColor(210, 210, 210);
  doc.setLineWidth(0.3);
  doc.line(CX, Y, pw - 14, Y);
  Y += 6;

  // ── ÁREA DE ASSINATURAS ───────────────────────────────────────────────────────
  const signerName = signer.name || '';
  const signerCrn  = signer.crn  || '';
  const signerCity = signer.municipio || '';
  const emDateFull = `${signerCity ? signerCity + ', ' : ''}${emDateStr}`;

  // 2 blocos: Diretor da escola (esq) | Nutricionista RT (dir)
  const blkW = CW / 2;
  const dirX = CX + blkW * 0 + blkW / 2;
  const rtX  = CX + blkW * 1 + blkW / 2;
  const lineY = Y + 24;

  // Data acima do bloco esquerdo
  doc.setFontSize(9.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...GRAY);
  doc.text(emDateFull, dirX, lineY - 10, { align: 'center' });

  // Bloco DIRETOR (esq) — linha em branco para assinar
  doc.setDrawColor(...GRAY);
  doc.setLineWidth(0.4);
  doc.line(dirX - 38, lineY, dirX + 38, lineY);
  doc.setFontSize(10.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...G_MED);
  doc.text(cert.lastInspectionDirector || ' ', dirX, lineY + 7, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(...GRAY);
  doc.text('Diretor(a) da Unidade Escolar', dirX, lineY + 14, { align: 'center' });

  // Bloco NUTRICIONISTA RT (dir)
  if (signerName) {
    if (sigImg) {
      const SW = 66; const SH = 22;
      addImg(sigImg, rtX - SW / 2, lineY - SH - 2, SW, SH);
    }
    doc.setDrawColor(...GRAY);
    doc.setLineWidth(0.4);
    doc.line(rtX - 38, lineY, rtX + 38, lineY);
    doc.setFontSize(10.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...G_MED);
    doc.text(signerName, rtX, lineY + 7, { align: 'center' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(...GRAY);
    doc.text(
      signerCrn ? `Nutricionista RT PNAE — ${signerCrn}` : 'Nutricionista Responsável Técnica',
      rtX, lineY + 14, { align: 'center' }
    );
  } else {
    doc.setDrawColor(...GRAY);
    doc.setLineWidth(0.4);
    doc.line(rtX - 38, lineY, rtX + 38, lineY);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(...GRAY);
    doc.text('Nutricionista Responsável Técnica', rtX, lineY + 7, { align: 'center' });
  }

  // Rodapé
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(160, 160, 160);
  doc.text(
    `Emitido em ${emDateStr}  ·  ${cert.schoolName}  ·  Res. FNDE/CD nº 06/2020 · Lei 11.947/2009 · RDC ANVISA nº 216/2004`,
    CX, ph - 6,
  );

  doc.save(`Certificado_Qualidade_${cert.schoolName.replace(/\s+/g, '_').normalize('NFD').replace(/[̀-ͯ]/g, '')}_${new Date().toISOString().split('T')[0]}.pdf`);
  toast.success('Certificado de qualidade gerado!');
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

  // Signature URL para exibição no UI (não usada na geração do PDF — PDF usa orgSettings direto)
  const signatureUrl = orgSettings.signatureUrl || localStorage.getItem('pnae_signature') || undefined;


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
                        onClick={() => { generateCertificatePDF(cert, signer, orgSettings).catch(() => {}); }}
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
