import jsPDF from 'jspdf';

export const brandColors = {
  navy:   [27, 42, 74]    as [number, number, number],
  green:  [22, 101, 52]   as [number, number, number],
  green2: [21, 128, 61]   as [number, number, number],
  blue:   [26, 115, 232]  as [number, number, number],
  orange: [255, 152, 0]   as [number, number, number],
  soft:   [245, 247, 250] as [number, number, number],
  text:   [74, 85, 104]   as [number, number, number],
};

/** Fetch a public asset and return a data-URL string. */
export async function assetToDataUrl(path: string): Promise<string> {
  const response = await fetch(path);
  const blob = await response.blob();
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/** Fetch a remote URL (Firebase Storage, etc.) and return a data-URL. */
export async function urlToDataUrl(url: string): Promise<string> {
  const response = await fetch(url);
  const blob = await response.blob();
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/** Cache loaded logos so we don't re-fetch on every PDF call. */
let _rightLogoUrl: string | null = null;
let _rightLogoTried = false;

async function tryLoadLogo(path: string): Promise<string | null> {
  try { return await assetToDataUrl(path); } catch { return null; }
}

async function loadRightLogo(): Promise<string | null> {
  if (!_rightLogoTried) { _rightLogoTried = true; _rightLogoUrl = await tryLoadLogo('/logo-nutricao.png'); }
  return _rightLogoUrl;
}

/**
 * Adds a standardised PNAE green header to any jsPDF document.
 *
 * Layout (header height = 32 mm):
 *   Left  (x=6..24)  : logo institucional esquerdo  18×18 mm  (opcional)
 *   Right (x=…-24)   : logo institucional direito   18×18 mm  (opcional)
 *   Centre            : bold title + subtitle
 *   Bottom band       : municipality + programme name (small)
 *
 * Returns the Y position (in mm) right below the header.
 */
export async function addPdfHeader(
  doc: jsPDF,
  {
    title,
    subtitle,
    municipality = '',
    color = brandColors.green,
    orgLogoUrl,   // URL from Firebase Storage (org-specific logo)
  }: {
    title: string;
    subtitle: string;
    municipality?: string;
    color?: [number, number, number];
    orgLogoUrl?: string;
  },
): Promise<number> {
  const pw = doc.internal.pageSize.getWidth();

  // Try to load org logo (left side) and default right logo
  const [orgLogo, nutricaoLogo] = await Promise.all([
    orgLogoUrl ? urlToDataUrl(orgLogoUrl).catch(() => null) : Promise.resolve(null),
    loadRightLogo(),
  ]);

  // ── white header band ─────────────────────────────────────────────────────
  doc.setFillColor(255, 255, 255);
  doc.rect(0, 0, pw, 32, 'F');

  // thin green separator at bottom of header
  doc.setFillColor(...color);
  doc.rect(0, 30, pw, 2, 'F');

  // ── logos (same size: 22×22 mm, centred vertically at y=5) ───────────────
  const logoSize = 22;
  const logoY    = 4;
  if (orgLogo)      doc.addImage(orgLogo,      'PNG', 6,                 logoY, logoSize, logoSize);
  if (nutricaoLogo) doc.addImage(nutricaoLogo, 'PNG', pw - 6 - logoSize, logoY, logoSize, logoSize);

  // ── title ─────────────────────────────────────────────────────────────────
  doc.setTextColor(...color);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text(title, pw / 2, 12, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(80, 80, 80);
  doc.text(subtitle, pw / 2, 18, { align: 'center' });

  doc.setFontSize(7.5);
  doc.setTextColor(120, 120, 120);
  if (municipality) doc.text(municipality, pw / 2, 24, { align: 'center' });

  return 38; // safe Y to start content below header
}

export function addPdfFooter(
  doc: jsPDF,
  note = 'Documento gerado pelo Sistema PNAE',
) {
  const pw = doc.internal.pageSize.getWidth();
  const ph = doc.internal.pageSize.getHeight();
  doc.setDrawColor(...brandColors.green);
  doc.line(12, ph - 12, pw - 12, ph - 12);
  doc.setTextColor(...brandColors.text);
  doc.setFontSize(7.5);
  doc.text(note, pw / 2, ph - 7, { align: 'center' });
}
