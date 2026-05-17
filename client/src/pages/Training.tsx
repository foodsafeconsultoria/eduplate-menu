import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  GraduationCap, QrCode, Award, Users, Plus, Download,
  Clock, Calendar, Trash2, Eye, CheckCircle, Upload, UserPlus,
  RefreshCw, X, ImagePlus,
} from 'lucide-react';
import { toast } from 'sonner';
import jsPDF from 'jspdf';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { db, storage } from '@/lib/firebase';
import { ref as storageRef, getBytes } from 'firebase/storage';
import {
  collection, doc, setDoc, onSnapshot, query, where, getDocs, deleteDoc,
} from 'firebase/firestore';
import { useAuth } from '@/contexts/AuthContext';
import { useOrgSettings } from '@/hooks/useOrgSettings';

const LEGACY_ORG_ID = 'pnae-default-org';

// ─── Types ───────────────────────────────────────────────────────────────────

interface Training {
  id: string;
  title: string;
  type: string;
  instructor: string;
  date: string;
  duration: number;
  location: string;
  description: string;
  status: 'scheduled' | 'open' | 'closed';
  presenceToken: string;
  createdAt: string;
}

interface Attendee {
  id: string;
  trainingId: string;
  name: string;
  cpf: string;
  email: string;
  phone: string;
  registeredAt: string;
}

// ─── Training types (ANVISA / PNAE) ──────────────────────────────────────────

const TRAINING_TYPES = [
  'Boas Práticas de Manipulação de Alimentos (RDC ANVISA 216/2004)',
  'Higiene e Saúde do Manipulador de Alimentos',
  'Controle de Qualidade e Segurança dos Alimentos',
  'Armazenamento e Conservação de Alimentos',
  'Nutrição Escolar e Programa PNAE (Res. FNDE 06/2020)',
  'Segurança Alimentar e Nutricional – SAN',
  'Gestão de Resíduos em Unidades de Alimentação e Nutrição',
  'Uso Seguro de Produtos de Limpeza e Sanificação',
  'Controle Integrado de Pragas e Vetores',
  'Temperaturas Seguras na Manipulação de Alimentos',
  'Rotulagem e Identificação de Alimentos Escolares',
  'Cardápio Escolar e Alimentação Saudável',
  'Introdução ao PNAE – Programa Nacional de Alimentação Escolar',
  'Prevenção de Contaminação Cruzada',
  'Uso e Cuidado de EPIs na Cozinha',
  'Outro',
];

// ─── Watermark via Canvas (marca d'água com alimentos) ───────────────────────

function buildWatermarkDataUrl(pdfWmm: number, pdfHmm: number): string {
  const scale = 3.78 * 2; // ~2x 96dpi para qualidade
  const W = Math.round(pdfWmm * scale);
  const H = Math.round(pdfHmm * scale);
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;

  // — Texto PNAE rotacionado ao centro —
  ctx.save();
  ctx.translate(W / 2, H / 2);
  ctx.rotate(-Math.PI / 4);
  ctx.globalAlpha = 0.055;
  ctx.fillStyle = '#22552f';
  ctx.font = `bold ${Math.round(W * 0.19)}px Arial`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('PNAE', 0, 0);
  ctx.restore();

  // — Maçãs —
  const apples: [number, number, number][] = [
    [0.08, 0.10, 0.04], [0.88, 0.08, 0.038], [0.06, 0.82, 0.040],
    [0.92, 0.80, 0.042], [0.50, 0.05, 0.032], [0.50, 0.92, 0.035],
    [0.22, 0.45, 0.028], [0.78, 0.45, 0.028],
  ];
  apples.forEach(([rx, ry, rs]) => drawAppleCanvas(ctx, rx * W, ry * H, rs * H));

  // — Cenouras —
  const carrots: [number, number, number, number][] = [
    [0.18, 0.12, 0.040, -20], [0.82, 0.15, 0.038, 15],
    [0.12, 0.72, 0.038, 10], [0.88, 0.70, 0.040, -15],
    [0.35, 0.90, 0.032, 5], [0.65, 0.88, 0.032, -5],
  ];
  carrots.forEach(([rx, ry, rs, rot]) => drawCarrotCanvas(ctx, rx * W, ry * H, rs * H, rot));

  // — Folhas —
  const leaves: [number, number, number, number][] = [
    [0.30, 0.10, 0.035, 30], [0.70, 0.08, 0.032, -40],
    [0.08, 0.48, 0.030, 15], [0.92, 0.48, 0.030, -15],
    [0.15, 0.30, 0.030, 50], [0.85, 0.28, 0.030, -50],
    [0.15, 0.65, 0.028, -30], [0.85, 0.65, 0.028, 30],
    [0.42, 0.94, 0.028, 10], [0.58, 0.94, 0.028, -10],
  ];
  leaves.forEach(([rx, ry, rs, rot]) => drawLeafCanvas(ctx, rx * W, ry * H, rs * H, rot));

  return canvas.toDataURL('image/png');
}

function drawAppleCanvas(ctx: CanvasRenderingContext2D, x: number, y: number, s: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.globalAlpha = 0.10;
  ctx.fillStyle = '#dc2626';
  ctx.beginPath(); ctx.arc(0, s * 0.1, s, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#16a34a';
  ctx.beginPath(); ctx.ellipse(-s * 0.3, -s * 0.7, s * 0.35, s * 0.18, Math.PI * 0.6, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(s * 0.25, -s * 0.75, s * 0.30, s * 0.15, -Math.PI * 0.5, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#92400e'; ctx.lineWidth = s * 0.08; ctx.lineCap = 'round'; ctx.globalAlpha = 0.10;
  ctx.beginPath(); ctx.moveTo(0, -s * 0.85); ctx.lineTo(s * 0.08, -s * 1.3); ctx.stroke();
  ctx.restore();
}

function drawCarrotCanvas(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, angleDeg: number) {
  ctx.save();
  ctx.translate(x, y); ctx.rotate(angleDeg * Math.PI / 180); ctx.globalAlpha = 0.10;
  ctx.fillStyle = '#ea580c';
  ctx.beginPath(); ctx.moveTo(0, s * 1.2); ctx.lineTo(-s * 0.35, -s * 0.2); ctx.lineTo(s * 0.35, -s * 0.2); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = '#16a34a'; ctx.lineWidth = s * 0.09; ctx.lineCap = 'round'; ctx.globalAlpha = 0.10;
  [[-s * 0.3, -s * 0.9], [0, -s * 1.1], [s * 0.3, -s * 0.9]].forEach(([tx, ty]) => {
    ctx.beginPath(); ctx.moveTo(0, -s * 0.2); ctx.quadraticCurveTo(tx * 0.5, -s * 0.6, tx, ty); ctx.stroke();
  });
  ctx.restore();
}

function drawLeafCanvas(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, angleDeg: number) {
  ctx.save();
  ctx.translate(x, y); ctx.rotate(angleDeg * Math.PI / 180); ctx.globalAlpha = 0.10;
  ctx.fillStyle = '#16a34a';
  ctx.beginPath();
  ctx.moveTo(0, -s);
  ctx.bezierCurveTo(s * 0.8, -s * 0.6, s * 0.8, s * 0.6, 0, s);
  ctx.bezierCurveTo(-s * 0.8, s * 0.6, -s * 0.8, -s * 0.6, 0, -s);
  ctx.fill();
  ctx.strokeStyle = '#14532d'; ctx.lineWidth = s * 0.06; ctx.globalAlpha = 0.08;
  ctx.beginPath(); ctx.moveTo(0, -s); ctx.lineTo(0, s); ctx.stroke();
  ctx.restore();
}

// ─── Certificate PDF ──────────────────────────────────────────────────────────

interface CertSigner {
  name: string;
  crn: string;
  city: string;
}

interface CertOptions {
  signatureDataUrl?: string;  // RT nutritionist signature
  instructorSignatureDataUrl?: string; // instructor signature (optional separate)
  signer?: CertSigner;        // RT nutritionist info
  orgLogoUrl?: string;        // org/municipality logo from Firebase Storage
}

async function generateCertificatePDF(
  attendee: Attendee,
  training: Training,
  options: CertOptions = {},
) {
  const { signatureDataUrl, signer, orgLogoUrl } = options;

  const doc = new jsPDF('landscape', 'mm', 'a4');
  const pw = doc.internal.pageSize.getWidth();   // 297
  const ph = doc.internal.pageSize.getHeight();  // 210
  // ── VERSÃO 3 ─ maçã removida, assinatura ao lado do instrutor, fontes maiores

  // ── Image loader: URL → data URL ─────────────────────────────────────────────
  // Para URLs do Firebase Storage usa getBytes() (sem CORS); para outras usa fetch
  const toDataUrl = async (url?: string | null): Promise<string | null> => {
    if (!url) return null;
    if (url.startsWith('data:')) return url;

    // Extrai o path do Storage a partir da download URL do Firebase
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

    // Tenta via Firebase SDK (contorna CORS)
    if (url.includes('firebasestorage.googleapis.com')) {
      const path = extractStoragePath(url);
      if (path) {
        try {
          const bytes = await getBytes(storageRef(storage, path));
          return await blobToDataUrl(new Blob([bytes]));
        } catch { /* cai no fetch abaixo */ }
      }
    }

    // Fallback: fetch normal (para imagens locais ou outros CDNs)
    try {
      const r = await fetch(url, { mode: 'cors' });
      if (!r.ok) return null;
      return await blobToDataUrl(await r.blob());
    } catch { return null; }
  };

  // Detecta formato real a partir do data URL (evita falha silenciosa no jsPDF)
  const imgFmt = (data: string): string => {
    if (data.startsWith('data:image/jpeg') || data.startsWith('data:image/jpg')) return 'JPEG';
    if (data.startsWith('data:image/webp')) return 'WEBP';
    return 'PNG';
  };

  const addImg = (data: string | null, x: number, y: number, w: number, h: number) => {
    if (!data) return;
    try { doc.addImage(data, imgFmt(data), x, y, w, h); } catch (_) {}
  };

  // Carregar brasão + assinatura em paralelo
  const [orgLogo, sigImg] = await Promise.all([
    toDataUrl(orgLogoUrl),
    toDataUrl(signatureDataUrl),
  ]);

  // ── Palette ──────────────────────────────────────────────────────────────────
  const G_DARK : [number,number,number] = [15,  70, 40];
  const G_MED  : [number,number,number] = [22, 101, 52];
  const G_TINT : [number,number,number] = [220, 245, 230];
  const GOLD   : [number,number,number] = [180, 140, 10];
  const GRAY   : [number,number,number] = [100, 100, 100];
  const DARK   : [number,number,number] = [40,  40,  40];
  const WHITE  : [number,number,number] = [255, 255, 255];

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

  // ── BRASÃO no sidebar (centro-topo) ──────────────────────────────────────────
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

  // ── PNAE no rodapé do sidebar (só texto, sem imagem) ─────────────────────────
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
  doc.text('CERTIFICADO DE PARTICIPAÇÃO E CONCLUSÃO', CX, Y);
  doc.setCharSpace(0);

  // Título
  Y += 14;
  doc.setFontSize(40);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...G_MED);
  doc.text('CERTIFICADO', CX, Y);

  // Sublinhado dourado
  Y += 3;
  doc.setFillColor(...GOLD);
  doc.rect(CX, Y, 100, 2.5, 'F');

  // "Certificamos que"
  Y += 12;
  doc.setFontSize(11.5);
  doc.setFont('helvetica', 'italic');
  doc.setTextColor(...GRAY);
  doc.text('Certificamos que', CX, Y);

  // Nome
  Y += 11;
  doc.setFontSize(24);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...DARK);
  const nameLines = doc.splitTextToSize(attendee.name.toUpperCase(), CW);
  doc.text(nameLines, CX, Y);
  Y += nameLines.length * 10;

  // CPF pill
  doc.setFillColor(...G_TINT);
  doc.setDrawColor(...G_MED);
  doc.setLineWidth(0.3);
  doc.roundedRect(CX, Y - 2, 76, 10, 2, 2, 'FD');
  doc.setFontSize(10.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...G_MED);
  doc.text('CPF:', CX + 3, Y + 6);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...DARK);
  doc.text(attendee.cpf, CX + 17, Y + 6);
  Y += 17;

  // Texto de participação
  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...GRAY);
  doc.text('participou e concluiu com aproveitamento o treinamento:', CX, Y);

  // Título do treinamento
  Y += 11;
  const trainingLines = doc.splitTextToSize(training.title, CW);
  doc.setFontSize(15);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...G_MED);
  doc.text(trainingLines, CX, Y);
  Y += trainingLines.length * 9 + 10;

  // Chips de info
  const dateFormatted = format(new Date(training.date + 'T12:00:00'), "dd 'de' MMMM 'de' yyyy", { locale: ptBR });
  const chips: [string, string][] = [
    ['DATA', dateFormatted],
    ['CARGA HORÁRIA', `${training.duration}h`],
    ['LOCAL', training.location],
  ];
  let chipX = CX;
  doc.setFontSize(10);
  for (const [label, value] of chips) {
    const lw = doc.getTextWidth(label + ': ');
    const vw = doc.getTextWidth(value);
    const chipW = Math.min(lw + vw + 10, 100);
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
    if (chipX > CX + CW - 55) { chipX = CX; Y += 15; }
  }
  Y += 14;

  // Divisória
  doc.setDrawColor(210, 210, 210);
  doc.setLineWidth(0.3);
  doc.line(CX, Y, pw - 14, Y);
  Y += 6;

  // ── ÁREA DE ASSINATURAS — 2 blocos: Participante (esq) | Nutricionista RT (dir) ──
  const signerName = signer?.name || '';
  const signerCrn  = signer?.crn  || '';
  const signerCity = signer?.city || '';
  const emDate = `${signerCity ? signerCity + ', ' : ''}${format(new Date(), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}`;

  const blkW  = CW / 2;
  const alunoX = CX + blkW * 0 + blkW / 2;
  const rtX    = CX + blkW * 1 + blkW / 2;
  const lineY  = Y + 24;

  // Data acima do bloco do aluno
  doc.setFontSize(9.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...GRAY);
  doc.text(emDate, alunoX, lineY - 10, { align: 'center' });

  // ── Bloco PARTICIPANTE (esquerda) ──
  doc.setDrawColor(...GRAY);
  doc.setLineWidth(0.4);
  doc.line(alunoX - 45, lineY, alunoX + 45, lineY);
  doc.setFontSize(10.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...G_MED);
  doc.text(attendee.name, alunoX, lineY + 7, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(...GRAY);
  doc.text('Participante', alunoX, lineY + 14, { align: 'center' });

  // ── Bloco NUTRICIONISTA RT (direita) — com assinatura digital ──
  if (sigImg) {
    const SW = 72; const SH = 24;
    addImg(sigImg, rtX - SW / 2, lineY - SH - 2, SW, SH);
  }
  doc.setDrawColor(...GRAY);
  doc.setLineWidth(0.4);
  doc.line(rtX - 45, lineY, rtX + 45, lineY);
  doc.setFontSize(10.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...G_MED);
  doc.text(signerName || 'Nutricionista RT', rtX, lineY + 7, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(...GRAY);
  doc.text(
    signerCrn ? `Nutricionista RT — ${signerCrn}` : 'Nutricionista Responsável Técnica',
    rtX, lineY + 14, { align: 'center' }
  );

  // Rodapé
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(160, 160, 160);
  doc.text(
    `Emitido em ${format(new Date(), 'dd/MM/yyyy HH:mm')}  ·  ID: ${attendee.id}  ·  Res. FNDE/CD nº 06/2020 · Lei 11.947/2009`,
    CX, ph - 6,
  );

  doc.save(`Certificado_${attendee.name.replace(/\s+/g, '_').normalize('NFD').replace(/[̀-ͯ]/g, '')}_${training.date}.pdf`);
}
// ─── QR Code Display (Telão) ──────────────────────────────────────────────────

function QRDisplay({
  training,
  orgId,
  onClose,
}: {
  training: Training;
  orgId: string;
  onClose: () => void;
}) {
  const presenceUrl = `${window.location.origin}/training/attend/${training.presenceToken}`;
  const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=280x280&data=${encodeURIComponent(presenceUrl)}&color=166534&bgcolor=f0fdf4&margin=1`;
  const [liveCount, setLiveCount] = useState(0);

  // Contador ao vivo via Firestore (org-scoped)
  useEffect(() => {
    const attendeesKey = `pnae_training_attendees_${orgId}`;
    try {
      const q = query(
        collection(db, 'organizations', orgId, 'training_attendees'),
        where('trainingId', '==', training.id),
      );
      const unsub = onSnapshot(q, (snap) => {
        setLiveCount(snap.size);
      }, () => {
        // Fallback: contar do localStorage
        try {
          const stored = JSON.parse(localStorage.getItem(attendeesKey) || '[]') as Attendee[];
          setLiveCount(stored.filter(a => a.trainingId === training.id).length);
        } catch (_) {}
      });
      return () => unsub();
    } catch (_) {
      // Sem Firebase: conta localStorage
      try {
        const stored = JSON.parse(localStorage.getItem(attendeesKey) || '[]') as Attendee[];
        setLiveCount(stored.filter(a => a.trainingId === training.id).length);
      } catch (_e) {}
    }
  }, [training.id, orgId]);

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center"
      style={{ background: 'linear-gradient(135deg, #052e16 0%, #14532d 60%, #166534 100%)' }}
    >
      <div className="absolute top-0 left-0 right-0 h-1.5 bg-green-400 opacity-60" />

      {/* Botão sair */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 text-white/50 hover:text-white flex items-center gap-1.5 text-sm bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-full transition"
      >
        <X className="w-4 h-4" /> Sair do telão
      </button>

      <div className="text-center text-white px-8 max-w-2xl">
        {/* Chip */}
        <div className="inline-block bg-white/10 rounded-2xl px-4 py-1.5 mb-3">
          <span className="text-green-300 text-xs tracking-widest uppercase font-medium">
            PNAE · Registro de Presença · Ao Vivo
          </span>
        </div>

        {/* Título */}
        <h1 className="text-2xl md:text-3xl font-bold text-white leading-snug mb-1">
          {training.title}
        </h1>
        <p className="text-green-300 text-sm mb-6">
          {format(new Date(training.date + 'T12:00:00'), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
          &nbsp;·&nbsp;{training.duration}h
          &nbsp;·&nbsp;{training.location}
        </p>

        {/* QR Code */}
        <div className="relative inline-block">
          <div className="bg-green-50 rounded-3xl p-5 shadow-[0_0_60px_rgba(74,222,128,0.3)]">
            <img
              src={qrSrc}
              alt="QR Code de presença"
              width={260}
              height={260}
              className="rounded-xl"
              onError={(e) => {
                // Fallback: mostrar URL
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
          </div>
          <div className="absolute -top-3 -left-3 bg-green-400 text-green-900 text-xs font-bold rounded-full w-8 h-8 flex items-center justify-center shadow">
            ↗
          </div>
          <div className="absolute -bottom-3 -right-3 bg-green-400 text-green-900 text-xs font-bold rounded-full w-8 h-8 flex items-center justify-center shadow">
            ↗
          </div>
        </div>

        <p className="mt-6 text-green-200 text-sm">
          Escaneie com o celular para registrar sua presença
        </p>
        <p className="mt-1 text-green-400/60 text-xs font-mono break-all max-w-md mx-auto">
          {presenceUrl}
        </p>

        {/* Contador ao vivo */}
        <div className="mt-8 inline-flex items-center gap-3 bg-white/10 rounded-full px-6 py-3">
          <span className="w-2.5 h-2.5 rounded-full bg-green-400 animate-pulse" />
          <span className="text-4xl font-black text-white">{liveCount}</span>
          <span className="text-green-300 text-sm">presença(s) registrada(s)</span>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function TrainingPage() {
  const { user } = useAuth();
  const orgId = user?.organizationId || LEGACY_ORG_ID;
  const { settings: orgSettings, saving: orgSaving, saveSettings, uploadImage } = useOrgSettings();

  const trainingsKey = `pnae_trainings_${orgId}`;
  const attendeesKey = `pnae_training_attendees_${orgId}`;

  const [trainings, setTrainings] = useState<Training[]>([]);
  const [attendees, setAttendees] = useState<Attendee[]>([]);

  // Load org-scoped data: localStorage first (instant), then Firestore sync (authoritative)
  useEffect(() => {
    let mounted = true;

    // 1. Immediate render from localStorage cache
    try {
      const raw = localStorage.getItem(trainingsKey);
      if (raw) setTrainings(JSON.parse(raw));
    } catch {}
    try {
      const raw = localStorage.getItem(attendeesKey);
      if (raw) setAttendees(JSON.parse(raw));
    } catch {}

    // 2. Background sync from Firestore (authoritative — survives browser clearing)
    const syncFirestore = async () => {
      try {
        const [tSnap, aSnap] = await Promise.all([
          getDocs(collection(db, 'organizations', orgId, 'trainings')),
          getDocs(collection(db, 'organizations', orgId, 'training_attendees')),
        ]);
        if (!mounted) return;
        if (!tSnap.empty) {
          const remote = tSnap.docs.map(d => ({ id: d.id, ...d.data() }) as Training);
          setTrainings(remote);
          localStorage.setItem(trainingsKey, JSON.stringify(remote));

          // Filtrar presenças órfãs (treinamento deletado mas presença ainda no Firestore)
          if (!aSnap.empty) {
            const validIds = new Set(remote.map(t => t.id));
            const allAttendees = aSnap.docs.map(d => ({ id: d.id, ...d.data() }) as Attendee);
            const validAttendees = allAttendees.filter(a => validIds.has(a.trainingId));
            const orphans = allAttendees.filter(a => !validIds.has(a.trainingId));
            // Deletar órfãs do Firestore em background
            if (orphans.length > 0) {
              Promise.all(
                orphans.map(a => deleteDoc(doc(db, 'organizations', orgId, 'training_attendees', a.id)))
              ).catch(() => {});
            }
            setAttendees(validAttendees);
            localStorage.setItem(attendeesKey, JSON.stringify(validAttendees));
          }
        } else if (!aSnap.empty) {
          const remote = aSnap.docs.map(d => ({ id: d.id, ...d.data() }) as Attendee);
          setAttendees(remote);
          localStorage.setItem(attendeesKey, JSON.stringify(remote));
        }
      } catch (err) {
        console.warn('[Training] Firestore sync failed, using localStorage cache:', err);
      }
    };
    syncFirestore();

    return () => { mounted = false; };
  }, [orgId]);

  const [activeTab, setActiveTab] = useState('list');
  const [qrTraining, setQrTraining] = useState<Training | null>(null);
  const [viewTraining, setViewTraining] = useState<Training | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [logoUploading, setLogoUploading] = useState(false);
  const [sigUploading, setSigUploading] = useState(false);

  // Signer info — from org settings (Firebase), fallback to SIGPC config
  const signer = useMemo<CertSigner>(() => {
    if (orgSettings.nutritionistName) {
      return {
        name: orgSettings.nutritionistName,
        crn:  orgSettings.nutritionistCrn  || '',
        city: orgSettings.municipio ? `${orgSettings.municipio}/${orgSettings.uf || 'SP'}` : '',
      };
    }
    try {
      const raw = localStorage.getItem(`pnae_sigpc_entity_config_${orgId}`)
        || localStorage.getItem('pnae_sigpc_entity_config');
      if (raw) {
        const cfg = JSON.parse(raw);
        return {
          name: cfg.nutricionista || '',
          crn:  cfg.crn           || '',
          city: cfg.municipio ? `${cfg.municipio}/${cfg.uf || 'SP'}` : '',
        };
      }
    } catch (_) {}
    return { name: '', crn: '', city: '' };
  }, [orgSettings, orgId]);

  // ── Pré-cachear imagens do Firebase Storage no localStorage ──────────────────
  // Usa getBytes() do SDK para evitar CORS; popula o cache para uso offline e PDF
  useEffect(() => {
    const cacheViaSDK = async (url: string | undefined, lsKey: string) => {
      if (!url || url.startsWith('data:') || localStorage.getItem(lsKey)) return;
      try {
        const match = url.match(/\/o\/([^?]+)/);
        if (!match) return;
        const path = decodeURIComponent(match[1]);
        const bytes = await getBytes(storageRef(storage, path));
        const blob = new Blob([bytes]);
        const reader = new FileReader();
        reader.onloadend = () => {
          if (reader.result) localStorage.setItem(lsKey, reader.result as string);
        };
        reader.readAsDataURL(blob);
      } catch (_) {}
    };
    cacheViaSDK(orgSettings.logoUrl, `pnae_logo_${orgId}`);
    cacheViaSDK(orgSettings.signatureUrl, 'pnae_signature');
  }, [orgSettings.logoUrl, orgSettings.signatureUrl, orgId]);

  // Modal de adição manual de participante
  const [manualDialog, setManualDialog] = useState(false);
  const [manualForm, setManualForm] = useState({ name: '', cpf: '', email: '', phone: '' });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    type: TRAINING_TYPES[0],
    customTitle: '',
    instructor: '',
    date: new Date().toISOString().split('T')[0],
    duration: 8,
    location: 'Cozinha Piloto',
    description: '',
  });

  // ── Sincronizar presenças do Firestore (remove órfãos de eventos deletados) ──
  const syncFromFirestore = useCallback(async () => {
    setSyncing(true);
    try {
      const snap = await getDocs(collection(db, 'organizations', orgId, 'training_attendees'));
      if (!snap.empty) {
        const remote = snap.docs.map(d => ({ id: d.id, ...d.data() }) as Attendee);

        // IDs dos treinamentos que ainda existem
        const validTrainingIds = new Set(trainings.map(t => t.id));

        // Separar presenças válidas de órfãs
        const valid   = remote.filter(a => validTrainingIds.has(a.trainingId));
        const orphans = remote.filter(a => !validTrainingIds.has(a.trainingId));

        // Deletar órfãs do Firestore silenciosamente
        if (orphans.length > 0) {
          await Promise.all(
            orphans.map(a => deleteDoc(doc(db, 'organizations', orgId, 'training_attendees', a.id)))
          );
        }

        setAttendees(valid);
        localStorage.setItem(attendeesKey, JSON.stringify(valid));
        const msg = orphans.length > 0
          ? `${valid.length} presença(s) sincronizadas · ${orphans.length} órfã(s) removida(s).`
          : `${valid.length} presença(s) sincronizadas do Firebase!`;
        toast.success(msg);
      } else {
        toast.info('Nenhuma presença no Firebase ainda.');
      }
    } catch (e) {
      toast.error('Erro ao sincronizar. Verifique a conexão.');
    } finally {
      setSyncing(false);
    }
  }, [orgId, trainings]);

  const save = (t: Training[], a: Attendee[]) => {
    localStorage.setItem(trainingsKey, JSON.stringify(t));
    localStorage.setItem(attendeesKey, JSON.stringify(a));
  };

  const formatCpf = (v: string) => {
    const n = v.replace(/\D/g, '').slice(0, 11);
    return n
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
  };

  const formatPhone = (v: string) => {
    const n = v.replace(/\D/g, '').slice(0, 11);
    return n
      .replace(/(\d{2})(\d)/, '($1) $2')
      .replace(/(\d{5})(\d{4})$/, '$1-$2');
  };

  // ── Criar treinamento ──
  const handleCreate = async () => {
    const title = form.type === 'Outro' ? form.customTitle.trim() : form.type;
    if (!title || !form.instructor.trim()) {
      toast.error('Preencha tipo/título e instrutor.');
      return;
    }
    const token = crypto.randomUUID().replace(/-/g, '').slice(0, 10).toUpperCase();
    const newT: Training = {
      id: `training-${crypto.randomUUID()}`,
      title,
      type: form.type,
      instructor: form.instructor.trim(),
      date: form.date,
      duration: form.duration,
      location: form.location.trim(),
      description: form.description.trim(),
      status: 'scheduled',
      presenceToken: token,
      createdAt: new Date().toISOString(),
    };
    const updated = [newT, ...trainings];
    setTrainings(updated);
    save(updated, attendees);
    setActiveTab('list');
    toast.success('Treinamento criado!');
    setForm(f => ({ ...f, customTitle: '', instructor: '', description: '' }));

    // Sincronizar com Firestore em background (org-scoped + token lookup)
    try {
      await setDoc(doc(db, 'organizations', orgId, 'trainings', newT.id), newT);
      // Global token lookup so TrainingAttend page can find the training by token
      await setDoc(doc(db, 'training_tokens', token), { orgId, trainingId: newT.id, status: newT.status });
    } catch (_) {}
  };

  // ── Alterar status ──
  const toggleStatus = async (id: string) => {
    const updated = trainings.map(t => {
      if (t.id !== id) return t;
      const next: Training['status'] = t.status === 'scheduled' ? 'open' : t.status === 'open' ? 'closed' : 'scheduled';
      return { ...t, status: next };
    });
    setTrainings(updated);
    save(updated, attendees);

    const tr = updated.find(t => t.id === id);
    if (tr) {
      try {
        await setDoc(doc(db, 'organizations', orgId, 'trainings', id), tr);
        // Update token lookup status too
        await setDoc(doc(db, 'training_tokens', tr.presenceToken), { orgId, trainingId: id, status: tr.status }, { merge: true });
      } catch (_) {}
    }
  };

  // ── Deletar treinamento ──
  const deleteTraining = async (id: string) => {
    if (!confirm('Remover este treinamento e todas as presenças?')) return;
    const target = trainings.find(t => t.id === id);
    const updatedT = trainings.filter(t => t.id !== id);
    const updatedA = attendees.filter(a => a.trainingId !== id);
    setTrainings(updatedT);
    setAttendees(updatedA);
    save(updatedT, updatedA);
    toast.success('Treinamento removido.');
    try {
      // Deletar treinamento e token
      await deleteDoc(doc(db, 'organizations', orgId, 'trainings', id));
      if (target) {
        await deleteDoc(doc(db, 'training_tokens', target.presenceToken));
      }
      // Deletar TODAS as presenças deste treinamento do Firestore
      const attendeesSnap = await getDocs(
        query(
          collection(db, 'organizations', orgId, 'training_attendees'),
          where('trainingId', '==', id),
        )
      );
      await Promise.all(attendeesSnap.docs.map(d => deleteDoc(d.ref)));
    } catch (_) {}
  };

  // ── Registrar participante (admin manual ou mesmo dispositivo) ──
  const registerAttendee = async (
    trainingId: string,
    data: Omit<Attendee, 'id' | 'trainingId' | 'registeredAt'>
  ) => {
    const already = attendees.find(
      a => a.trainingId === trainingId && a.cpf.replace(/\D/g, '') === data.cpf.replace(/\D/g, '')
    );
    if (already) { toast.error('Este CPF já está registrado neste treinamento.'); return; }

    const newA: Attendee = {
      id: `attendee-${crypto.randomUUID()}`,
      trainingId,
      registeredAt: new Date().toISOString(),
      ...data,
    };
    const updatedA = [...attendees, newA];
    setAttendees(updatedA);
    save(trainings, updatedA);
    toast.success(`✅ ${newA.name} registrado(a)!`);

    // Sync para Firestore (org-scoped)
    try { await setDoc(doc(db, 'organizations', orgId, 'training_attendees', newA.id), newA); } catch (_) {}
  };

  // ── Upload de logo da organização ──
  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoUploading(true);
    try {
      const url = await uploadImage(file, 'logo');
      await saveSettings({ logoUrl: url });
      // Cachear dataURL localmente para uso offline e geração de PDF sem CORS
      const reader = new FileReader();
      reader.onload = ev => localStorage.setItem(`pnae_logo_${orgId}`, ev.target?.result as string);
      reader.readAsDataURL(file);
      toast.success('Logo salva! Será usada em todos os PDFs.');
    } catch (err) {
      toast.error('Erro ao salvar a logo.');
    } finally {
      setLogoUploading(false);
    }
  };

  // ── Upload de assinatura ──
  const handleSignatureUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSigUploading(true);
    try {
      const url = await uploadImage(file, 'signature');
      await saveSettings({ signatureUrl: url });
      // Also keep localStorage as cache for offline
      const reader = new FileReader();
      reader.onload = ev => localStorage.setItem('pnae_signature', ev.target?.result as string);
      reader.readAsDataURL(file);
      toast.success('Assinatura salva!');
    } catch (err) {
      toast.error('Erro ao salvar a assinatura.');
    } finally {
      setSigUploading(false);
    }
  };

  const getAttendees = (trainingId: string) =>
    attendees.filter(a => a.trainingId === trainingId);

  const statusLabel = (s: Training['status']) => ({ scheduled: 'Agendado', open: 'Aberto', closed: 'Encerrado' }[s]);
  const statusColor = (s: Training['status']): 'secondary' | 'default' | 'outline' =>
    ({ scheduled: 'secondary', open: 'default', closed: 'outline' }[s] as any);

  // ── Modo telão ──
  if (qrTraining) {
    return (
      <QRDisplay
        training={qrTraining}
        orgId={orgId}
        onClose={() => setQrTraining(null)}
      />
    );
  }

  const viewAttendees = viewTraining ? getAttendees(viewTraining.id) : [];

  return (
    <div className="flex-1 p-4 md:p-8 min-h-screen">
      <div className="max-w-6xl mx-auto space-y-8">

        {/* ── Hero ── */}
        <section className="brand-hero overflow-hidden rounded-[32px] p-6 text-white shadow-[0_30px_80px_-45px_rgba(27,42,74,0.8)] md:p-8">
          <div className="grid gap-6 lg:grid-cols-[1.25fr_0.75fr] lg:items-end">
            <div>
              <div className="brand-chip mb-4">
                <GraduationCap className="h-3.5 w-3.5 text-[#1A73E8]" />
                Capacitação de pessoal
              </div>
              <h1 className="text-3xl font-bold md:text-4xl">Módulo de Treinamentos.</h1>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-white/80 md:text-base">
                Gerencie cursos, exiba QR Code para registro de presença e emita certificados PDF com marca d'água PNAE e assinatura digital.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              {[
                ['Treinamentos', trainings.length],
                ['Abertos', trainings.filter(t => t.status === 'open').length],
                ['Presenças', attendees.length],
              ].map(([label, value]) => (
                <div key={label as string} className="rounded-[24px] border border-white/12 bg-white/10 p-4 backdrop-blur">
                  <p className="text-xs uppercase tracking-[0.24em] text-white/60">{label}</p>
                  <p className="mt-2 text-3xl font-semibold">{value}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Configurações do certificado ── */}
        <Card className="border-dashed">
          <CardContent className="pt-5 pb-5 space-y-4">
            <p className="text-sm font-semibold text-gray-800">Configurações do Certificado</p>

            <div className="grid gap-4 sm:grid-cols-2">
              {/* Logo da prefeitura/secretaria */}
              <div className="flex items-center gap-3 rounded-xl border border-gray-200 p-3">
                <div className="w-12 h-12 rounded-lg border border-dashed border-gray-300 bg-gray-50 flex items-center justify-center shrink-0 overflow-hidden">
                  {orgSettings.logoUrl
                    ? <img src={orgSettings.logoUrl} alt="Logo" className="w-full h-full object-contain p-0.5" />
                    : <ImagePlus className="h-5 w-5 text-gray-400" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-700">Logo da Secretaria/Município</p>
                  <p className="text-xs text-muted-foreground">Aparece no canto esquerdo de todos os PDFs</p>
                </div>
                <Button variant="outline" size="sm" disabled={logoUploading} onClick={() => logoInputRef.current?.click()}>
                  {logoUploading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                </Button>
                <input ref={logoInputRef} type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
              </div>

              {/* Assinatura */}
              <div className="flex items-center gap-3 rounded-xl border border-gray-200 p-3">
                <div className="w-12 h-12 rounded-lg border border-dashed border-gray-300 bg-white flex items-center justify-center shrink-0 overflow-hidden">
                  {orgSettings.signatureUrl
                    ? <img src={orgSettings.signatureUrl} alt="Assinatura" className="w-full h-full object-contain" />
                    : <Upload className="h-5 w-5 text-gray-400" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-700">Assinatura — Nutricionista RT</p>
                  <p className="text-xs text-muted-foreground">PNG com fundo transparente</p>
                </div>
                <Button variant="outline" size="sm" disabled={sigUploading} onClick={() => fileInputRef.current?.click()}>
                  {sigUploading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                </Button>
                <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleSignatureUpload} />
              </div>
            </div>

            <div className="flex justify-end">
              <Button variant="outline" size="sm" onClick={syncFromFirestore} disabled={syncing}>
                <RefreshCw className={`w-4 h-4 mr-2 ${syncing ? 'animate-spin' : ''}`} />
                Sincronizar presenças
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* ── Tabs ── */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2 rounded-2xl bg-white/80 p-1">
            <TabsTrigger value="list">Treinamentos</TabsTrigger>
            <TabsTrigger value="new">Novo treinamento</TabsTrigger>
          </TabsList>

          {/* ── Lista ── */}
          <TabsContent value="list" className="space-y-4 mt-4">
            {trainings.length === 0 ? (
              <Card>
                <CardContent className="pt-10 pb-10 text-center text-muted-foreground">
                  <GraduationCap className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p>Nenhum treinamento cadastrado ainda.</p>
                  <Button className="mt-4" onClick={() => setActiveTab('new')}>
                    <Plus className="w-4 h-4 mr-2" />Criar treinamento
                  </Button>
                </CardContent>
              </Card>
            ) : (
              trainings.map(training => {
                const att = getAttendees(training.id);
                return (
                  <Card key={training.id} className="hover:shadow-md transition-shadow">
                    <CardContent className="pt-5 pb-5">
                      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                        <div className="flex-1 space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge variant={statusColor(training.status)}>{statusLabel(training.status)}</Badge>
                            <h3 className="font-semibold text-foreground">{training.title}</h3>
                          </div>
                          <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3.5 h-3.5" />
                              {format(new Date(training.date + 'T12:00:00'), 'dd/MM/yyyy', { locale: ptBR })}
                            </span>
                            <span className="flex items-center gap-1">
                              <Clock className="w-3.5 h-3.5" />
                              {training.duration}h
                            </span>
                            <span className="flex items-center gap-1">
                              <Users className="w-3.5 h-3.5" />
                              {att.length} presença(s)
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Instrutor: {training.instructor} · Local: {training.location}
                          </p>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          <Button
                            variant="outline" size="sm"
                            onClick={() => toggleStatus(training.id)}
                            disabled={training.status === 'closed'}
                          >
                            {training.status === 'scheduled' ? 'Abrir inscrições' : training.status === 'open' ? 'Encerrar' : 'Encerrado'}
                          </Button>

                          {training.status === 'open' && (
                            <Button
                              size="sm"
                              className="bg-green-600 hover:bg-green-700 gap-1"
                              onClick={() => setQrTraining(training)}
                            >
                              <QrCode className="w-4 h-4" /> Exibir QR
                            </Button>
                          )}

                          <Button variant="outline" size="sm" onClick={() => setViewTraining(training)}>
                            <Eye className="w-4 h-4" />
                          </Button>

                          <Button
                            variant="ghost" size="sm"
                            className="text-red-600 hover:bg-red-50"
                            onClick={() => deleteTraining(training.id)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </TabsContent>

          {/* ── Novo treinamento ── */}
          <TabsContent value="new" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Plus className="w-4 h-4 text-green-600" />Novo treinamento
                </CardTitle>
                <CardDescription>
                  Após criar, abra as inscrições e exiba o QR Code no telão para os participantes registrarem presença.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Tipo de treinamento *</label>
                  <Select value={form.type} onValueChange={v => setForm(f => ({ ...f, type: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {TRAINING_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

                {form.type === 'Outro' && (
                  <div>
                    <label className="block text-sm font-medium mb-1">Título personalizado *</label>
                    <Input
                      placeholder="Nome do treinamento"
                      value={form.customTitle}
                      onChange={e => setForm(f => ({ ...f, customTitle: e.target.value }))}
                    />
                  </div>
                )}

                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="block text-sm font-medium mb-1">Instrutor / Responsável *</label>
                    <Input
                      placeholder="Nome do instrutor"
                      value={form.instructor}
                      onChange={e => setForm(f => ({ ...f, instructor: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Data *</label>
                    <Input
                      type="date"
                      value={form.date}
                      onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Carga horária (horas) *</label>
                    <Input
                      type="number" min={1} max={200}
                      value={form.duration}
                      onChange={e => setForm(f => ({ ...f, duration: Number(e.target.value) }))}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Local *</label>
                    <Input
                      placeholder="Local do treinamento"
                      value={form.location}
                      onChange={e => setForm(f => ({ ...f, location: e.target.value }))}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Ementa / Conteúdo programático</label>
                  <Textarea
                    placeholder="Objetivos, metodologia, materiais utilizados..."
                    value={form.description}
                    onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                    rows={3}
                  />
                </div>

                <Button className="w-full md:w-auto bg-green-600 hover:bg-green-700" onClick={handleCreate}>
                  <Plus className="w-4 h-4 mr-2" />Criar treinamento
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* ── Dialog: lista de presenças ── */}
      <Dialog open={!!viewTraining} onOpenChange={open => !open && setViewTraining(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="w-5 h-5 text-green-600" />
              Presenças — {viewTraining?.title}
            </DialogTitle>
          </DialogHeader>

          {/* Adicionar manualmente */}
          {viewTraining?.status !== 'closed' && (
            <div className="mb-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => { setManualForm({ name: '', cpf: '', email: '', phone: '' }); setManualDialog(true); }}
              >
                <UserPlus className="w-4 h-4 mr-2" />Adicionar participante manualmente
              </Button>
            </div>
          )}

          {viewAttendees.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              Nenhuma presença registrada.
              {viewTraining?.status === 'open' && (
                <span className="block mt-1 text-xs">
                  Exiba o QR Code no telão ou clique em "Adicionar manualmente".
                </span>
              )}
            </p>
          ) : (
            <div className="space-y-3">
              {viewAttendees.map((att, i) => (
                <Card key={att.id}>
                  <CardContent className="pt-4 pb-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="space-y-0.5">
                        <p className="font-medium text-foreground flex items-center gap-2">
                          <span className="text-xs text-muted-foreground w-5">{i + 1}.</span>
                          {att.name}
                        </p>
                        <p className="text-xs text-muted-foreground">CPF: {att.cpf}</p>
                        <p className="text-xs text-muted-foreground">{att.email} · {att.phone}</p>
                        <p className="text-xs text-muted-foreground">
                          {att.registeredAt ? format(new Date(att.registeredAt), 'dd/MM/yyyy HH:mm', { locale: ptBR }) : '—'}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        className="bg-green-600 hover:bg-green-700 shrink-0"
                        onClick={() => viewTraining && generateCertificatePDF(att, viewTraining, {
                                          signatureDataUrl: orgSettings.signatureDataUrl || orgSettings.signatureUrl,
                                          signer,
                                          orgLogoUrl: orgSettings.logoDataUrl || orgSettings.logoUrl,
                                        })}
                      >
                        <Award className="w-4 h-4 mr-1" />Certificado
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}

              <div className="pt-2 flex justify-end">
                <Button
                  variant="outline"
                  onClick={async () => {
                    if (!viewTraining) return;
                    toast.info('Gerando certificados...');
                    for (const att of viewAttendees) {
                      await generateCertificatePDF(att, viewTraining, {
                          signatureDataUrl: orgSettings.signatureDataUrl || orgSettings.signatureUrl,
                          signer,
                          orgLogoUrl: orgSettings.logoDataUrl || orgSettings.logoUrl,
                        });
                      await new Promise(r => setTimeout(r, 400));
                    }
                    toast.success(`${viewAttendees.length} certificado(s) gerados!`);
                  }}
                >
                  <Download className="w-4 h-4 mr-2" />
                  Emitir todos os certificados ({viewAttendees.length})
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Dialog: adicionar participante manualmente ── */}
      <Dialog open={manualDialog} onOpenChange={setManualDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-green-600" />
              Adicionar participante
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <label className="block text-sm font-medium mb-1">Nome completo *</label>
              <Input
                placeholder="Nome do participante"
                value={manualForm.name}
                onChange={e => setManualForm(f => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium mb-1">CPF *</label>
                <Input
                  placeholder="000.000.000-00"
                  value={manualForm.cpf}
                  onChange={e => setManualForm(f => ({ ...f, cpf: formatCpf(e.target.value) }))}
                  inputMode="numeric"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Celular</label>
                <Input
                  placeholder="(00) 00000-0000"
                  value={manualForm.phone}
                  onChange={e => setManualForm(f => ({ ...f, phone: formatPhone(e.target.value) }))}
                  inputMode="numeric"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">E-mail</label>
              <Input
                type="email"
                placeholder="email@exemplo.com"
                value={manualForm.email}
                onChange={e => setManualForm(f => ({ ...f, email: e.target.value }))}
              />
            </div>
            <div className="flex gap-3 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => setManualDialog(false)}>
                Cancelar
              </Button>
              <Button
                className="flex-1 bg-green-600 hover:bg-green-700"
                onClick={async () => {
                  if (!viewTraining) return;
                  if (!manualForm.name.trim() || manualForm.cpf.replace(/\D/g, '').length < 11) {
                    toast.error('Preencha nome e CPF válido.');
                    return;
                  }
                  await registerAttendee(viewTraining.id, manualForm);
                  setManualDialog(false);
                }}
              >
                <CheckCircle className="w-4 h-4 mr-2" />Confirmar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
