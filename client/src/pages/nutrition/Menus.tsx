import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { useAuth } from '@/contexts/AuthContext';
import { useFoods } from '@/hooks/useFoods';
import { useSchools } from '@/hooks/useFirestore';
import { useMenus } from '@/hooks/useMenus';
import { useRecipes } from '@/hooks/useRecipes';
import { useSpecialDiets } from '@/hooks/useSpecialDiets';
import { assetToDataUrl } from '@/lib/pdfBranding';
import { useOrgSettings } from '@/hooks/useOrgSettings';
import { DIET_LABEL_MAP } from '@/data/dietLabels';
import type { Food, Menu, MenuInsumo, MenuSlot, NutritionNutrientSet, Recipe } from '@/types/nutrition';
import {
  AlertTriangle, BookOpen, ChevronDown, ClipboardList, ClipboardPaste, Copy,
  LayoutGrid, LayoutList, Mail, Pencil, Printer, School, Search, ShieldAlert, SlidersHorizontal, Trash2, X,
} from 'lucide-react';
import { toast } from 'sonner';
import { format, isValid } from 'date-fns';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { getFoodSeasonality, seasonLabels } from '@/data/seasonality';
import { apiUrl } from '@/lib/apiUrl';

// ── Constants ──────────────────────────────────────────────────────────────────

const weekdays = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta'];

const categories = ['Creche', 'Ensino Infantil', 'Fundamental 1', 'Fundamental 2', 'Médio'] as const;

const mealMap: Record<(typeof categories)[number], string[]> = {
  Creche:            ['Café da manhã', 'Almoço', 'Café da tarde', 'Jantar'],
  'Ensino Infantil': ['Almoço', 'Lanche'],
  'Fundamental 1':   ['Almoço/Jantar', 'Lanche'],
  'Fundamental 2':   ['Almoço/Jantar', 'Lanche'],
  Médio:             ['Almoço/Jantar', 'Lanche'],
};

const fndeTargets = [
  { key: 'kcal'     as const, label: 'Kcal',     min: 300  },
  { key: 'protein'  as const, label: 'Proteína',  min: 9.4  },
  { key: 'calcium'  as const, label: 'Cálcio',    min: 210  },
  { key: 'iron'     as const, label: 'Ferro',     min: 1.8  },
  { key: 'zinc'     as const, label: 'Zinco',     min: 1.4  },
  { key: 'vitaminA' as const, label: 'Vit A',     min: 100  },
  { key: 'vitaminC' as const, label: 'Vit C',     min: 7    },
] as const;

type SourceType = 'recipe' | 'food';

// ── Helpers ────────────────────────────────────────────────────────────────────

const ZERO_NUTRIENTS: NutritionNutrientSet = {
  kcal:0, protein:0, lipids:0, carbohydrates:0, fiber:0, calcium:0, iron:0, zinc:0, vitaminA:0, vitaminC:0,
};

/** Scale a nutrient set: (base / pesoReferencia) * pesoAtual */
function scaleNutrients(
  base: NutritionNutrientSet | null | undefined,
  pesoReferencia: number,
  pesoAtual: number,
): NutritionNutrientSet {
  if (!base) return { ...ZERO_NUTRIENTS };
  const scale = pesoReferencia > 0 ? pesoAtual / pesoReferencia : 0;
  return {
    kcal:          (base.kcal          ?? 0) * scale,
    protein:       (base.protein       ?? 0) * scale,
    lipids:        (base.lipids        ?? 0) * scale,
    carbohydrates: (base.carbohydrates ?? 0) * scale,
    fiber:         (base.fiber         ?? 0) * scale,
    calcium:       (base.calcium       ?? 0) * scale,
    iron:          (base.iron          ?? 0) * scale,
    zinc:          (base.zinc          ?? 0) * scale,
    vitaminA:      (base.vitaminA      ?? 0) * scale,
    vitaminC:      (base.vitaminC      ?? 0) * scale,
  };
}

/** Sum an array of NutritionNutrientSet objects. */
function sumNutrients(sets: NutritionNutrientSet[]): NutritionNutrientSet {
  return sets.reduce(
    (acc, n) => ({
      kcal:          acc.kcal          + n.kcal,
      protein:       acc.protein       + n.protein,
      lipids:        acc.lipids        + n.lipids,
      carbohydrates: acc.carbohydrates + n.carbohydrates,
      fiber:         acc.fiber         + n.fiber,
      calcium:       acc.calcium       + n.calcium,
      iron:          acc.iron          + n.iron,
      zinc:          acc.zinc          + n.zinc,
      vitaminA:      acc.vitaminA      + n.vitaminA,
      vitaminC:      acc.vitaminC      + n.vitaminC,
    }),
    { kcal:0, protein:0, lipids:0, carbohydrates:0, fiber:0, calcium:0, iron:0, zinc:0, vitaminA:0, vitaminC:0 },
  );
}

/** Get effective nutrients for one MenuInsumo. */
function insumoNutrients(ins: MenuInsumo): NutritionNutrientSet {
  return scaleNutrients(ins.valoresNutricionaisBase, ins.pesoReferencia, ins.pesoAtual);
}

/** Get effective kcal for one MenuInsumo (convenience). */
function insumoKcal(ins: MenuInsumo): number {
  if (!ins?.valoresNutricionaisBase) return 0;
  return ins.pesoReferencia > 0
    ? ((ins.valoresNutricionaisBase.kcal ?? 0) / ins.pesoReferencia) * ins.pesoAtual
    : 0;
}

/** Safely format a Date / Firestore Timestamp / ISO string. */
function safeFormat(value: unknown, fmt: string): string {
  if (!value) return '—';
  try {
    const d = (value as any).toDate ? (value as any).toDate() : new Date(value as any);
    return isValid(d) ? format(d, fmt) : '—';
  } catch {
    return '—';
  }
}

/**
 * Migrate old MenuItem[] → MenuSlot[] when editing a legacy menu.
 * Groups items by day+meal and uses displayName as nomeFantasia for the slot.
 */
function migrateItemsToSlots(items: Menu['items']): MenuSlot[] {
  const slotMap = new Map<string, MenuSlot>();
  for (const item of items) {
    const key = `${item.dayLabel}__${item.mealLabel}`;
    if (!slotMap.has(key)) {
      slotMap.set(key, {
        id:           `slot-migrated-${key}`,
        dayLabel:     item.dayLabel,
        mealLabel:    item.mealLabel,
        nomeFantasia: item.displayName,
        composicao:   [],
      });
    }
    slotMap.get(key)!.composicao.push({
      id:            `ins-migrated-${item.id}`,
      nome:          item.displayName,
      type:          item.type,
      referenceId:   item.referenceId,
      pesoReferencia: 100,
      pesoAtual:      item.perCapita,
      valoresNutricionaisBase: item.sourceNutrients ?? item.nutrients,
      custoBase:      item.estimatedCost,
      familyFarm:     false,
      sourceUnit:     item.sourceUnit || 'g',
    });
  }
  return Array.from(slotMap.values());
}

// ── PDF Generator ──────────────────────────────────────────────────────────────

/**
 * Generates the A4 landscape cardápio PDF.
 * The meal grid renders ONLY nomeFantasia (not individual ingredients).
 * The nutritional summary is computed from slots[].composicao[].
 */
async function generateMenuPDF(
  menu: Menu,
  schoolNames: string[],
  meals: string[],
  returnBase64 = false,
  orgLogoDataUrl?: string,
): Promise<string | void> {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pw = doc.internal.pageSize.getWidth();
  const ph = doc.internal.pageSize.getHeight();
  const green: [number, number, number] = [22, 101, 52];
  const margin = 10;

  // ── Header ───────────────────────────────────────────────────────────────
  doc.setFillColor(255, 255, 255);
  doc.rect(0, 0, pw, 38, 'F');
  doc.setFillColor(...green);
  doc.rect(0, 36, pw, 2, 'F');

  // Logo esquerdo: logo personalizado do assinante
  if (orgLogoDataUrl) {
    try { doc.addImage(orgLogoDataUrl, 'PNG', margin, 3, 30, 30); } catch { /* skip */ }
  }
  doc.setTextColor(20, 20, 20);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.text('CARDÁPIO DE ALIMENTAÇÃO ESCOLAR - PNAE', pw / 2, 13, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(60, 60, 60);
  const schoolLabel = schoolNames.length > 0 ? schoolNames.join(', ') : 'Toda a rede';
  doc.text(`Escola: ${schoolLabel}  |  Etapa: ${menu.category}`, pw / 2, 22, { align: 'center' });
  doc.text(`Referência: ${menu.referenceMonth || '—'}`, pw / 2, 29, { align: 'center' });

  // ── Meal grid — only nomeFantasia ────────────────────────────────────────
  const startY = 40;
  const weekStart = (menu as any).weekStartDate;
  const head = [[
    'REFEIÇÃO',
    ...weekdays.map((d, i) => {
      if (!weekStart) return d.toUpperCase();
      const dt = new Date(weekStart + 'T12:00:00');
      dt.setDate(dt.getDate() + i);
      return `${d.toUpperCase()}\n${format(dt, 'dd/MM')}`;
    }),
  ]];

  const slots = menu.slots || [];

  const body = meals.map((meal) => {
    const row: string[] = [meal.toUpperCase()];
    weekdays.forEach((day) => {
      const slot = slots.find((s) => s.dayLabel === day && s.mealLabel === meal);
      if (slot) {
        // Use nomeFantasia if filled; otherwise auto-build from composicao names
        const label = slot.nomeFantasia.trim()
          || slot.composicao.map((ins) => ins.nome).join(', ')
          || '—';
        row.push(label);
      } else {
        // backward compat: fall back to legacy items
        const legacyItems = (menu.items || []).filter(
          (i) => i.dayLabel === day && i.mealLabel === meal,
        );
        row.push(legacyItems.length > 0 ? legacyItems.map((i) => i.displayName).join(', ') : '—');
      }
    });
    return row;
  });

  const colW = (pw - margin * 2 - 32) / 5;
  autoTable(doc, {
    head,
    body,
    startY,
    theme: 'grid',
    styles: {
      fontSize: 8,
      cellPadding: { top: 2.5, bottom: 2.5, left: 3, right: 3 },
      overflow: 'linebreak',
      valign: 'middle',
      lineColor: [210, 210, 210],
      lineWidth: 0.25,
      textColor: [30, 30, 30],
    },
    headStyles: {
      fillColor: green,
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8,
      halign: 'center',
    },
    columnStyles: {
      0: { cellWidth: 32, fontStyle: 'bold', halign: 'center', fillColor: [240, 253, 244], textColor: green },
      1: { cellWidth: colW, halign: 'center' },
      2: { cellWidth: colW, halign: 'center' },
      3: { cellWidth: colW, halign: 'center' },
      4: { cellWidth: colW, halign: 'center' },
      5: { cellWidth: colW, halign: 'center' },
    },
    alternateRowStyles: { fillColor: [250, 255, 250] },
    margin: { left: margin, right: margin },
    tableWidth: pw - margin * 2,
  });

  // ── Nutritional summary ──────────────────────────────────────────────────
  const tableEndY = (doc as any).lastAutoTable?.finalY ?? (ph - 35);

  // Compute from slots
  const allInsumos = slots.flatMap((s) => s.composicao);
  const daysWithContent = new Set(
    slots.filter((s) => s.composicao.length > 0).map((s) => s.dayLabel),
  );
  const daysCount = daysWithContent.size || 1;

  let totalNutrients: NutritionNutrientSet;
  if (allInsumos.length > 0) {
    totalNutrients = sumNutrients(allInsumos.map(insumoNutrients));
  } else {
    // legacy fallback
    totalNutrients = sumNutrients((menu.items || []).map((i) => i.nutrients));
  }

  const avg: Record<string, number> = Object.fromEntries(
    Object.entries(totalNutrients).map(([k, v]) => [k, v / daysCount]),
  );

  if (tableEndY + 22 < ph - 8) {
    autoTable(doc, {
      head: [['KCAL', 'CHO (g)', 'PTN (g)', 'LIP (g)', 'Ca (mg)', 'Fe (mg)', 'Vit A (µg)', 'Vit C (mg)', 'Fibra (g)']],
      body: [[
        avg.kcal.toFixed(2),
        avg.carbohydrates.toFixed(2),
        avg.protein.toFixed(2),
        avg.lipids.toFixed(2),
        avg.calcium.toFixed(2),
        avg.iron.toFixed(2),
        avg.vitaminA.toFixed(2),
        avg.vitaminC.toFixed(2),
        avg.fiber.toFixed(2),
      ]],
      startY: tableEndY + 4,
      theme: 'grid',
      styles: {
        fontSize: 8,
        cellPadding: { top: 2, bottom: 2, left: 2, right: 2 },
        halign: 'center',
        valign: 'middle',
        lineColor: [210, 210, 210],
        lineWidth: 0.25,
      },
      headStyles: { fillColor: green, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8, halign: 'center' },
      margin: { left: margin, right: margin },
      tableWidth: pw - margin * 2,
    });
  }

  // ── Footer ───────────────────────────────────────────────────────────────
  doc.setDrawColor(...green);
  doc.setLineWidth(0.3);
  doc.line(margin, ph - 10, pw - margin, ph - 10);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(60, 60, 60);
  const sc = (menu as any).studentCount;
  const totalCostForPdf = allInsumos.reduce((sum, ins) => {
    const scale = ins.pesoReferencia > 0 ? ins.pesoAtual / ins.pesoReferencia : 0;
    return sum + ins.custoBase * scale;
  }, 0);
  const avgCostPerDay = daysCount > 0 ? totalCostForPdf / daysCount : 0;
  const footerParts = [
    `${menu.responsibleName} — Nutricionista Responsável Técnica — PNAE`,
    sc ? `Nº de alunos: ${sc} · Custo/aluno/dia: R$ ${avgCostPerDay.toFixed(2)}` : '',
  ].filter(Boolean);
  doc.text(footerParts.join('  ·  '), pw / 2, ph - 5, { align: 'center' });

  if (returnBase64) {
    // Use arraybuffer → btoa for reliable base64 without relying on datauristring
    const ab = doc.output('arraybuffer');
    const bytes = new Uint8Array(ab);
    let binary = '';
    const chunkSize = 8192;
    for (let i = 0; i < bytes.length; i += chunkSize) {
      binary += String.fromCharCode(...Array.from(bytes.slice(i, i + chunkSize)));
    }
    return btoa(binary);
  }
  doc.save(`Cardapio_${menu.title.replace(/\s+/g, '_')}.pdf`);
}

// ── Multi-school Selector ──────────────────────────────────────────────────────

interface MultiSchoolSelectorProps {
  schools: { id: string; name: string }[];
  selected: string[];
  onChange: (ids: string[]) => void;
}

function MultiSchoolSelector({ schools, selected, onChange }: MultiSchoolSelectorProps) {
  const [open, setOpen] = useState(false);

  const toggle = (id: string) => {
    onChange(selected.includes(id) ? selected.filter((s) => s !== id) : [...selected, id]);
  };

  const label =
    selected.length === 0
      ? 'Toda a rede'
      : selected.length === 1
        ? schools.find((s) => s.id === selected[0])?.name ?? '1 escola'
        : `${selected.length} escolas selecionadas`;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring"
      >
        <span className="flex items-center gap-2">
          <School className="h-4 w-4 text-muted-foreground" />
          {label}
        </span>
        <ChevronDown className="h-4 w-4 text-muted-foreground" />
      </button>

      {open && (
        <div className="absolute z-50 mt-1 max-h-64 w-full overflow-y-auto rounded-md border bg-white shadow-lg">
          <div
            className="flex cursor-pointer items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50"
            onClick={() => { onChange([]); setOpen(false); }}
          >
            <Checkbox checked={selected.length === 0} onCheckedChange={() => {}} />
            <span className="font-medium text-green-700">Toda a rede</span>
          </div>
          <div className="my-1 border-t" />
          {schools.map((school) => (
            <label
              key={school.id}
              className="flex cursor-pointer items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50"
            >
              <Checkbox
                checked={selected.includes(school.id)}
                onCheckedChange={() => toggle(school.id)}
              />
              <span className="truncate">{school.name}</span>
            </label>
          ))}
          {schools.length > 0 && (
            <div className="border-t px-3 py-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="w-full rounded-md bg-green-600 py-1.5 text-xs font-semibold text-white hover:bg-green-700"
              >
                Confirmar ({selected.length === 0 ? 'toda a rede' : `${selected.length} escola(s)`})
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────

export default function Menus() {
  const { user } = useAuth();
  const { schools } = useSchools();
  const { foods } = useFoods();
  const { recipes } = useRecipes();
  const { menus, loading, addMenu, updateMenu, deleteMenu } = useMenus();
  const { specialDiets } = useSpecialDiets();
  const { settings: orgSettings } = useOrgSettings();

  // ── Form meta ────────────────────────────────────────────────────────────────
  const [open, setOpen] = useState(false);
  const [editingMenuId, setEditingMenuId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  /**
   * targetCategories: which student stages this menu serves.
   * The meal grid structure is derived from these (Creche vs Fundamental).
   */
  const [targetCategories, setTargetCategories] = useState<string[]>(['Fundamental 1']);
  const [referenceMonth, setReferenceMonth] = useState('');
  const [weekStartDate, setWeekStartDate] = useState('');  // "YYYY-MM-DD" of the Monday
  const [studentCount, setStudentCount] = useState<number | ''>('');
  const [targetSchoolIds, setTargetSchoolIds] = useState<string[]>([]);

  // ── Slot state (replaces items + customTitles) ───────────────────────────────
  const [slots, setSlots] = useState<MenuSlot[]>([]);

  // ── Picker state ─────────────────────────────────────────────────────────────
  const [targetDay, setTargetDay] = useState('Segunda');
  const [targetMeal, setTargetMeal] = useState(mealMap['Fundamental 1'][0]);
  const [sourceType, setSourceType] = useState<SourceType>('recipe');
  const [search, setSearch] = useState('');

  // Staging area: food needs gramagem before confirming
  const [pendingFood, setPendingFood] = useState<{ food: Food; grams: string } | null>(null);

  // ── Per-meal/day clipboard ────────────────────────────────────────────────────
  const [clipboard, setClipboard] = useState<{ slots: MenuSlot[]; desc: string } | null>(null);

  // ── Menu clipboard — stores either a full menu or just one meal type ──────────
  const [menuClipboard, setMenuClipboard] = useState<{
    slots: MenuSlot[];          // the slots being copied
    fromTitle: string;
    fromCategory: (typeof categories)[number];
    sourceMealLabel: string | null; // null = full menu, string = specific meal
  } | null>(null);

  // Which card has the meal-picker popover open
  const [copyPickerMenuId, setCopyPickerMenuId] = useState<string | null>(null);

  // ── Email sending state ───────────────────────────────────────────────────────
  const [emailModal, setEmailModal] = useState<{ open: boolean; menu: Menu | null }>({ open: false, menu: null });
  const [emailSelectedSchools, setEmailSelectedSchools] = useState<string[]>([]);
  const [emailSending, setEmailSending] = useState(false);

  const handleSendMenuEmail = async () => {
    if (!emailModal.menu || emailSelectedSchools.length === 0) return;
    const menu = emailModal.menu;
    const selectedSchoolObjects = schools.filter(s => emailSelectedSchools.includes(s.id) && s.email);
    const noEmail = schools.filter(s => emailSelectedSchools.includes(s.id) && !s.email);
    if (noEmail.length > 0 && selectedSchoolObjects.length === 0) {
      toast.error('Nenhuma escola selecionada tem e-mail cadastrado.');
      return;
    }
    if (noEmail.length > 0) {
      toast.warning(`${noEmail.length} escola(s) sem e-mail serão ignoradas.`);
    }
    setEmailSending(true);
    try {
      const menuHtml = buildMenuEmailHtml(menu);

      // Generate PDF as base64 to attach to the email
      let pdfBase64: string | undefined;
      let pdfFilename: string | undefined;
      try {
        const schoolNamesForPdf = selectedSchoolObjects.map(s => s.name);
        // Use the same mealMap as the UI so slot labels match exactly
        const mealsForPdf = mealMap[menu.category as keyof typeof mealMap] ?? ['Almoço/Jantar', 'Lanche'];
        const b64 = await generateMenuPDF(menu, schoolNamesForPdf, mealsForPdf, true, orgSettings?.logoDataUrl);
        if (b64) {
          pdfBase64 = b64;
          // Sanitize filename: remove accents + special chars (comma breaks MIME headers)
          const safeTitle = menu.title
            .normalize('NFD').replace(/[̀-ͯ]/g, '') // strip accents
            .replace(/[^a-zA-Z0-9_\-]/g, '_')                // replace anything else with _
            .replace(/_+/g, '_')                              // collapse repeated underscores
            .replace(/^_|_$/g, '');                           // trim leading/trailing _
          pdfFilename = `Cardapio_${safeTitle}.pdf`;
        }
      } catch (pdfErr) {
        console.warn('[Email] PDF generation failed, sending without attachment:', pdfErr);
      }

      const res = await fetch(apiUrl('/api/email/send-menu'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          schools: selectedSchoolObjects.map(s => ({ name: s.name, email: s.email })),
          menuTitle: menu.title,
          menuHtml,
          senderName: user?.displayName || 'Nutricionista',
          pdfBase64,
          pdfFilename,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success(`✅ Cardápio enviado para ${data.sent} escola(s)!`);
      setEmailModal({ open: false, menu: null });
      setEmailSelectedSchools([]);
    } catch (err: any) {
      toast.error(err.message || 'Erro ao enviar e-mails.');
    } finally {
      setEmailSending(false);
    }
  };

  const buildMenuEmailHtml = (menu: Menu): string => {
    const slots = menu.slots?.length ? menu.slots : migrateItemsToSlots(menu.items);
    const rows = weekdays.map(day => {
      const daySlots = slots.filter(s => s.day === day && s.composicao.length > 0);
      if (daySlots.length === 0) return '';
      const meals = daySlots.map(s =>
        `<tr><td style="padding:4px 8px;color:#6b7280;font-size:13px;">${s.mealLabel}</td><td style="padding:4px 8px;font-size:13px;">${s.composicao.map(c => c.label).join(', ')}</td></tr>`
      ).join('');
      return `<tr><td colspan="2" style="padding:8px 8px 2px;font-weight:700;font-size:13px;color:#1B2A4A;border-top:1px solid #e5e7eb;">${day}</td></tr>${meals}`;
    }).filter(Boolean).join('');
    return `<table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">${rows}</table>`;
  };

  // Target meal label for meal-based paste (set by the user in the editor)
  const [pasteMealTarget, setPasteMealTarget] = useState('');

  /**
   * The meal grid structure is determined by whether Creche is selected.
   * Fundamental 1, 2, and Médio all share the same meals.
   * Ensino Infantil has its own 2-meal structure (Almoço + Lanche — not integral).
   */
  const effectiveCategory = useMemo((): (typeof categories)[number] => {
    if (targetCategories.includes('Creche')) return 'Creche';
    if (targetCategories.includes('Ensino Infantil') && !targetCategories.some(c => c !== 'Ensino Infantil' && c !== 'Creche')) return 'Ensino Infantil';
    for (const cat of categories) {
      if (targetCategories.includes(cat)) return cat;
    }
    return 'Fundamental 1';
  }, [targetCategories]);

  const meals = mealMap[effectiveCategory];

  const currentUserName = user?.displayName?.trim() || 'Nutricionista';
  const currentMonth    = new Date().getMonth();

  const schoolMap = useMemo(() => new Map(schools.map((s) => [s.id, s.name])), [schools]);

  /** Maps weekday name → "dd/MM" string when weekStartDate is set */
  const weekDayDates = useMemo(() => {
    if (!weekStartDate) return {} as Record<string, string>;
    const start = new Date(weekStartDate + 'T12:00:00');
    return Object.fromEntries(
      weekdays.map((day, i) => {
        const d = new Date(start);
        d.setDate(d.getDate() + i);
        return [day, format(d, 'dd/MM')];
      }),
    );
  }, [weekStartDate]);

  // ── Search results ───────────────────────────────────────────────────────────
  const searchResults = useMemo(() => {
    const term = search.toLowerCase().trim();
    if (term.length < 2) return [];
    if (sourceType === 'recipe') {
      return recipes
        .filter((r) => r.name.toLowerCase().includes(term) || r.displayName?.toLowerCase().includes(term))
        .slice(0, 8);
    }
    return foods.filter((f) => f.name.toLowerCase().includes(term)).slice(0, 8);
  }, [foods, recipes, search, sourceType]);

  // ── Slot helpers ─────────────────────────────────────────────────────────────

  /** Immutably update a slot, creating it if it doesn't exist yet. */
  const mutateSlot = (day: string, meal: string, updater: (s: MenuSlot) => MenuSlot) => {
    setSlots((prev) => {
      const idx = prev.findIndex((s) => s.dayLabel === day && s.mealLabel === meal);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = updater(next[idx]);
        return next;
      }
      // Create new slot
      const newSlot: MenuSlot = {
        id:           `slot-${crypto.randomUUID()}`,
        dayLabel:     day,
        mealLabel:    meal,
        nomeFantasia: '',
        composicao:   [],
      };
      return [...prev, updater(newSlot)];
    });
  };

  const updateNomeFantasia = (day: string, meal: string, value: string) =>
    mutateSlot(day, meal, (s) => ({ ...s, nomeFantasia: value }));

  const addInsumo = (day: string, meal: string, insumo: MenuInsumo) =>
    mutateSlot(day, meal, (s) => ({ ...s, composicao: [...s.composicao, insumo] }));

  const updateInsumoPeso = (day: string, meal: string, insumoId: string, peso: number) =>
    mutateSlot(day, meal, (s) => ({
      ...s,
      composicao: s.composicao.map((ins) => ins.id === insumoId ? { ...ins, pesoAtual: peso } : ins),
    }));

  const removeInsumo = (day: string, meal: string, insumoId: string) => {
    setSlots((prev) => prev.map((s) => {
      if (s.dayLabel !== day || s.mealLabel !== meal) return s;
      return { ...s, composicao: s.composicao.filter((ins) => ins.id !== insumoId) };
    }));
  };

  // ── Add insumos ──────────────────────────────────────────────────────────────

  const addRecipeInsumo = (recipe: Recipe) => {
    const insumo: MenuInsumo = {
      id:            `ins-${crypto.randomUUID()}`,
      nome:          recipe.displayName || recipe.name,
      type:          'recipe',
      referenceId:   recipe.id,
      pesoReferencia: recipe.perCapita || 100,
      pesoAtual:      recipe.perCapita || 100,
      valoresNutricionaisBase: recipe.nutrientsPerServing,
      custoBase:      recipe.costPerServing,
      familyFarm:     recipe.usesFamilyFarm,
      sourceUnit:     'g',
    };
    addInsumo(targetDay, targetMeal, insumo);
    setSearch('');
    setPendingFood(null);
    toast.success(`"${insumo.nome}" adicionado.`);
  };

  const stageFoodInsumo = (food: Food) => {
    // NOTE: do NOT clear search here — the staging panel must remain visible
    setPendingFood({ food, grams: '100' });
  };

  const confirmFoodInsumo = () => {
    if (!pendingFood) return;
    const { food } = pendingFood;
    const grams = Math.max(1, parseFloat(pendingFood.grams) || 100);
    const insumo: MenuInsumo = {
      id:             `ins-${crypto.randomUUID()}`,
      nome:           food.name,
      type:           'food',
      referenceId:    food.id,
      pesoReferencia: 100,
      pesoAtual:      grams,
      valoresNutricionaisBase: food.nutrients,
      custoBase:      food.price / 10, // food.price is R$/kg; /10 converts to R$/100g (matches pesoReferencia=100g)
      familyFarm:     food.familyFarm ?? false,
      sourceUnit:     food.unit === 'liter' ? 'ml' : 'g',
    };
    addInsumo(targetDay, targetMeal, insumo);
    setPendingFood(null);
    setSearch('');  // clear search AFTER confirming
    toast.success(`"${food.name}" adicionado em ${targetDay} / ${targetMeal}.`);
  };

  // ── Clipboard ────────────────────────────────────────────────────────────────

  const copyMeal = (day: string, meal: string) => {
    const slot = slots.find((s) => s.dayLabel === day && s.mealLabel === meal);
    if (!slot || slot.composicao.length === 0) { toast.error('Refeição vazia, nada a copiar.'); return; }
    setClipboard({ slots: [slot], desc: `${meal} / ${day}` });
    toast.success(`"${meal} / ${day}" copiado!`);
  };

  const pasteMeal = (day: string, meal: string) => {
    if (!clipboard || clipboard.slots.length === 0) { toast.error('Nada copiado ainda.'); return; }
    const src = clipboard.slots[0];
    const pasted: MenuSlot = {
      ...src,
      id:        `slot-${crypto.randomUUID()}`,
      dayLabel:  day,
      mealLabel: meal,
      composicao: src.composicao.map((ins, i) => ({ ...ins, id: `ins-paste-${crypto.randomUUID()}` })),
    };
    setSlots((prev) => [
      ...prev.filter((s) => !(s.dayLabel === day && s.mealLabel === meal)),
      pasted,
    ]);
    toast.success(`Colado em "${meal} / ${day}"`);
  };

  // ── Menu-level copy/paste ────────────────────────────────────────────────────

  /**
   * Copy from a menu card: mealLabel=null copies all meals, string copies one meal type.
   */
  const copyFromMenu = (menu: Menu, mealLabel: string | null) => {
    const srcSlots = menu.slots?.length ? menu.slots : migrateItemsToSlots(menu.items);
    const filtered = mealLabel
      ? srcSlots.filter((s) => s.mealLabel === mealLabel && s.composicao.length > 0)
      : srcSlots.filter((s) => s.composicao.length > 0);

    if (filtered.length === 0) {
      toast.error('Sem ingredientes para copiar nessa refeição.');
      return;
    }
    const cat = (categories.includes(menu.category as (typeof categories)[number])
      ? menu.category
      : 'Fundamental 1') as (typeof categories)[number];

    setMenuClipboard({ slots: filtered, fromTitle: menu.title, fromCategory: cat, sourceMealLabel: mealLabel });
    setCopyPickerMenuId(null);
    const total = filtered.reduce((a, s) => a + s.composicao.length, 0);
    const label = mealLabel ? `"${mealLabel}" de` : 'Cardápio completo de';
    toast.success(`${label} "${menu.title}" copiado (${total} ingredientes).`);
  };

  /**
   * Paste into the editor.
   * - Full menu (sourceMealLabel=null): replaces all slots, syncs category.
   * - Meal-based (sourceMealLabel=string): remaps mealLabel to pasteMealTarget
   *   and merges, keeping other meals intact.
   */
  const pasteMenuClipboard = () => {
    if (!menuClipboard) { toast.error('Nenhum cardápio copiado ainda.'); return; }
    if (menuClipboard.slots.length === 0) { toast.error('O cardápio copiado está vazio.'); return; }

    const ts = crypto.randomUUID();

    if (menuClipboard.sourceMealLabel === null) {
      // ── Full menu paste ──
      const cloned = menuClipboard.slots.map((s, si) => ({
        ...s,
        id: `slot-paste-full-${ts}-${si}`,
        composicao: s.composicao.map((ins, ii) => ({
          ...ins, id: `ins-paste-full-${ts}-${si}-${ii}`,
        })),
      }));
      setTargetCategories([menuClipboard.fromCategory]);
      setTargetMeal(mealMap[menuClipboard.fromCategory][0]);
      setSlots(cloned);
    } else {
      // ── Meal-based paste ──
      const target = pasteMealTarget || meals[0];
      const cloned = menuClipboard.slots.map((s, si) => ({
        ...s,
        id: `slot-paste-meal-${ts}-${si}`,
        mealLabel: target,           // remap to the chosen target meal
        composicao: s.composicao.map((ins, ii) => ({
          ...ins, id: `ins-paste-meal-${ts}-${si}-${ii}`,
        })),
      }));
      // Merge: remove existing slots for the target meal, add the pasted ones
      setSlots((prev) => [
        ...prev.filter((s) => s.mealLabel !== target),
        ...cloned,
      ]);
    }

    const total = menuClipboard.slots.reduce((a, s) => a + s.composicao.length, 0);
    toast.success(`${total} ingredientes colados. Ajuste escola e título antes de salvar.`);
  };

  const copyDay = (day: string) => {
    const daySlots = slots.filter((s) => s.dayLabel === day && s.composicao.length > 0);
    if (daySlots.length === 0) { toast.error('Dia vazio.'); return; }
    setClipboard({ slots: daySlots, desc: `dia ${day} completo` });
    toast.success(`Dia ${day} copiado (${daySlots.length} refeições).`);
  };

  const pasteDay = (day: string) => {
    if (!clipboard || clipboard.slots.length === 0) { toast.error('Nada copiado ainda.'); return; }
    const pasted = clipboard.slots.map((s, si) => ({
      ...s,
      id:        `slot-paste-${crypto.randomUUID()}`,
      dayLabel:  day,
      composicao: s.composicao.map((ins, i) => ({ ...ins, id: `ins-paste-${crypto.randomUUID()}` })),
    }));
    setSlots((prev) => [
      ...prev.filter((s) => s.dayLabel !== day),
      ...pasted,
    ]);
    toast.success(`Dia ${day} preenchido.`);
  };

  // ── Summary (computed real-time from slots) ───────────────────────────────────
  const summary = useMemo(() => {
    const allInsumos = slots.flatMap((s) => s.composicao);
    if (allInsumos.length === 0) return null;

    let totalCost   = 0;
    let afCount     = 0;
    const totalNutr = { kcal:0, protein:0, lipids:0, carbohydrates:0, fiber:0, calcium:0, iron:0, zinc:0, vitaminA:0, vitaminC:0 };

    for (const ins of allInsumos) {
      const scale = ins.pesoReferencia > 0 ? ins.pesoAtual / ins.pesoReferencia : 0;
      totalCost += ins.custoBase * scale;
      if (ins.familyFarm) afCount++;
      const n = insumoNutrients(ins);
      for (const k of Object.keys(totalNutr) as (keyof typeof totalNutr)[]) {
        totalNutr[k] += n[k];
      }
    }

    const daysCount = new Set(
      slots.filter((s) => s.composicao.length > 0).map((s) => s.dayLabel),
    ).size || 1;

    const avg = Object.fromEntries(
      Object.entries(totalNutr).map(([k, v]) => [k, v / daysCount]),
    ) as typeof totalNutr;

    const missingTargets = fndeTargets.filter((t) => avg[t.key] < t.min).map((t) => t.label);
    const familyFarmShare = allInsumos.length > 0 ? (afCount / allInsumos.length) * 100 : 0;

    const nameCount = new Map<string, number>();
    for (const s of slots) {
      const k = s.nomeFantasia.trim().toLowerCase();
      if (k) nameCount.set(k, (nameCount.get(k) || 0) + 1);
    }
    const repeatedPreparations = Array.from(nameCount.entries()).filter(([, c]) => c > 1).map(([n]) => n);

    const emptySlots = weekdays.flatMap((day) =>
      meals.filter((meal) => {
        const s = slots.find((sl) => sl.dayLabel === day && sl.mealLabel === meal);
        return !s || s.composicao.length === 0;
      }).map((meal) => `${day} - ${meal}`),
    );

    const complianceAlerts: string[] = [];
    if (missingTargets.length > 0)       complianceAlerts.push(`Metas abaixo: ${missingTargets.join(', ')}`);
    if (repeatedPreparations.length > 0) complianceAlerts.push(`Repetições: ${repeatedPreparations.join(', ')}`);
    if (familyFarmShare < 30)            complianceAlerts.push('Agricultura familiar abaixo de 30%.');

    return {
      averageCost: totalCost / daysCount,
      averageNutrients: avg,
      averageProtein: avg.protein,
      familyFarmShare,
      missingTargets,
      repeatedPreparations,
      emptySlots,
      complianceAlerts,
    };
  }, [slots, meals]);

  // ── Form open / reset ─────────────────────────────────────────────────────────

  const resetForm = () => {
    setTitle(''); setTargetCategories(['Fundamental 1']); setReferenceMonth('');
    setTargetSchoolIds([]); setWeekStartDate(''); setStudentCount(''); setTargetDay('Segunda');
    setTargetMeal(mealMap['Fundamental 1'][0]); setSourceType('recipe');
    setSearch(''); setSlots([]); setPendingFood(null);
    setClipboard(null); setEditingMenuId(null);
  };

  const openEditMenu = (menu: Menu) => {
    setEditingMenuId(menu.id);
    setTitle(menu.title);
    // Load targetCategories — backward compat for old menus that only have category
    const tc = Array.isArray(menu.targetCategories) && menu.targetCategories.length > 0
      ? menu.targetCategories
      : [menu.category || 'Fundamental 1'];
    setTargetCategories(tc);
    setReferenceMonth(menu.referenceMonth || '');
    setWeekStartDate(menu.weekStartDate || '');
    setStudentCount(menu.studentCount ?? '');
    setTargetSchoolIds(menu.schoolIds || []);

    // Load slots — migrate from legacy items if necessary
    if (menu.slots && menu.slots.length > 0) {
      setSlots(menu.slots);
    } else if (menu.items && menu.items.length > 0) {
      setSlots(migrateItemsToSlots(menu.items));
    } else {
      setSlots([]);
    }

    const effCat = tc.includes('Creche') ? 'Creche' : (tc[0] as (typeof categories)[number]) || 'Fundamental 1';
    setTargetDay('Segunda');
    setTargetMeal((mealMap[effCat] ?? ['Refeição'])[0]);
    setSourceType('recipe');
    setSearch('');
    setPendingFood(null);
    setClipboard(null);
    setOpen(true);
  };

  // ── Save ──────────────────────────────────────────────────────────────────────

  const handleSave = () => {
    if (!title.trim()) { toast.error('Informe o título do cardápio.'); return; }
    const hasContent = slots.some((s) => s.composicao.length > 0);
    if (!hasContent) { toast.error('Adicione pelo menos um ingrediente ao cardápio.'); return; }

    const payload = {
      title,
      category:             effectiveCategory,
      targetCategories,
      referenceMonth,
      weekStartDate:        weekStartDate || undefined,
      studentCount:         studentCount !== '' ? Number(studentCount) : undefined,
      schoolIds:            targetSchoolIds,
      slots,
      items:                [],
      averageCost:          summary?.averageCost          ?? 0,
      averageKcal:          summary?.averageNutrients.kcal ?? 0,
      averageProtein:       summary?.averageProtein        ?? 0,
      familyFarmShare:      summary?.familyFarmShare       ?? 0,
      missingTargets:       summary?.missingTargets        ?? [],
      repeatedPreparations: summary?.repeatedPreparations  ?? [],
      emptySlots:           summary?.emptySlots            ?? [],
      complianceAlerts:     summary?.complianceAlerts      ?? [],
      responsibleName:      currentUserName,
    };

    if (editingMenuId) {
      updateMenu(editingMenuId, payload);
      toast.success('Cardápio atualizado com sucesso!');
    } else {
      addMenu(payload);
      toast.success('Cardápio salvo com sucesso!');
    }

    resetForm();
    setOpen(false);
  };

  // ── Diet alerts (active special diets in the targeted schools + categories) ──

  // Meals for which diet alerts are relevant (lunch/dinner only — breakfast goes separately)
  const LUNCH_DINNER_MEALS = ['almoço', 'jantar', 'refeição'];

  const dietAlerts = useMemo(() => {
    // Only show alerts when the menu has content
    if (!slots.some((s) => s.composicao.length > 0)) return [];

    // Only show for lunch/dinner — not for Desjejum, Café da Manhã, Lanche, etc.
    const mealLower = targetMeal.toLowerCase();
    const isLunchOrDinner = LUNCH_DINNER_MEALS.some((m) => mealLower.includes(m));
    if (!isLunchOrDinner) return [];

    return specialDiets.filter((diet) => {
      if (diet.status !== 'active') return false;
      // School filter: if specific schools selected, student must belong to one
      const schoolMatch =
        targetSchoolIds.length === 0 || targetSchoolIds.includes(diet.schoolId);
      // Category filter: if student has a category assigned, it must be in targetCategories
      const categoryMatch =
        !diet.category || targetCategories.length === 0 || targetCategories.includes(diet.category);
      return schoolMatch && categoryMatch;
    });
  }, [specialDiets, targetSchoolIds, targetCategories, slots, targetMeal]);

  // ── Gallery filters ───────────────────────────────────────────────────────────

  const [gallerySearch,   setGallerySearch]   = useState('');
  const [galleryCategory, setGalleryCategory] = useState('');   // '' = todas
  const [galleryMonth,    setGalleryMonth]    = useState('');   // '' = todos
  const [gallerySort,     setGallerySort]     = useState<'newest' | 'oldest' | 'alpha' | 'edited'>('newest');
  const [galleryView, setGalleryView] = useState<'grid' | 'list'>('grid');

  /** All distinct referenceMonth values for the filter dropdown */
  const allReferenceMonths = useMemo(() =>
    Array.from(new Set(menus.map((m) => m.referenceMonth).filter(Boolean))).sort(),
    [menus],
  );

  /** Parse a free-text referenceMonth like "Semana 1/Maio" or "Abril 2026" into a timestamp for sorting */
  const parseReferenceDate = (ref: string): number => {
    if (!ref) return 0;
    const lower = ref.toLowerCase();
    const PT_MONTHS: Record<string, number> = {
      janeiro: 0, jan: 0, fevereiro: 1, fev: 1, março: 2, mar: 2,
      abril: 3, abr: 3, maio: 4, mai: 4, junho: 5, jun: 5,
      julho: 6, jul: 6, agosto: 7, ago: 7, setembro: 8, set: 8,
      outubro: 9, out: 9, novembro: 10, nov: 10, dezembro: 11, dez: 11,
    };
    // ISO: 2026-04 or 2026/04
    const isoMatch = lower.match(/(\d{4})[-\/](\d{1,2})/);
    if (isoMatch) return new Date(Number(isoMatch[1]), Number(isoMatch[2]) - 1).getTime();
    // Month name + optional year
    let month = -1;
    for (const [name, num] of Object.entries(PT_MONTHS)) {
      if (lower.includes(name)) { month = num; break; }
    }
    const yearMatch = lower.match(/\b(20\d{2})\b/);
    const year = yearMatch ? Number(yearMatch[1]) : new Date().getFullYear();
    const weekMatch = lower.match(/semana\s*(\d)/i);
    const week = weekMatch ? Number(weekMatch[1]) : 0;
    if (month >= 0) return new Date(year, month).getTime() + week * 7 * 24 * 3600 * 1000;
    return 0;
  };

  const filteredMenus = useMemo(() => {
    const term = gallerySearch.toLowerCase().trim();
    let list = menus.filter((m) => {
      if (term) {
        const names = (m.schoolIds ?? []).map((id) => schoolMap.get(id) ?? '').join(' ').toLowerCase();
        const haystack = `${m.title} ${m.referenceMonth} ${names} ${(m.targetCategories ?? [m.category]).join(' ')}`.toLowerCase();
        if (!haystack.includes(term)) return false;
      }
      if (galleryCategory && !(m.targetCategories ?? [m.category]).includes(galleryCategory)) return false;
      if (galleryMonth && m.referenceMonth !== galleryMonth) return false;
      return true;
    });

    list = [...list].sort((a, b) => {
      if (gallerySort === 'alpha') return a.title.localeCompare(b.title, 'pt-BR');
      // 'edited' = sort by last-save date (old behavior)
      if (gallerySort === 'edited') {
        const tA = a.updatedAt ? new Date(typeof (a.updatedAt as any).toDate === 'function' ? (a.updatedAt as any).toDate() : a.updatedAt).getTime() : 0;
        const tB = b.updatedAt ? new Date(typeof (b.updatedAt as any).toDate === 'function' ? (b.updatedAt as any).toDate() : b.updatedAt).getTime() : 0;
        return tB - tA;
      }
      // 'newest' / 'oldest' = sort by createdAt (when the menu was actually created)
      const toMs = (v: any): number => {
        if (!v) return 0;
        if (typeof v?.toDate === 'function') return v.toDate().getTime();
        const d = new Date(v);
        return isNaN(d.getTime()) ? 0 : d.getTime();
      };
      const cA = toMs(a.createdAt) || toMs(a.updatedAt);
      const cB = toMs(b.createdAt) || toMs(b.updatedAt);
      return gallerySort === 'newest' ? cB - cA : cA - cB;
    });

    return list;
  }, [menus, gallerySearch, galleryCategory, galleryMonth, gallerySort, schoolMap]);

  // ── JSX ───────────────────────────────────────────────────────────────────────

  return (
    <>
    <div className="min-h-screen flex-1 p-4 md:p-8">
      <div className="w-full space-y-6">

        {/* Page header */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Cardápios</h1>
            <p className="mt-1 text-gray-500">Planejamento semanal por categoria e escola.</p>
          </div>

          <Dialog open={open} onOpenChange={(v) => { if (!v) resetForm(); setOpen(v); }}>
            <DialogTrigger asChild>
              <Button className="bg-green-600 hover:bg-green-700">
                <BookOpen className="mr-2 h-4 w-4" />
                Novo Cardápio
              </Button>
            </DialogTrigger>

            {/* ── Dialog ──────────────────────────────────────────────────────── */}
            <DialogContent className="max-h-[95vh] overflow-y-auto sm:max-w-[96vw]">
              <DialogHeader>
                <DialogTitle>{editingMenuId ? 'Editar Cardápio' : 'Montar Cardápio'}</DialogTitle>
                <DialogDescription className="sr-only">
                  Formulário de montagem de cardápio semanal por categoria e escola.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-5">

                {/* Meta fields */}
                <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
                  <div>
                    <Label>Título *</Label>
                    <Input
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="Ex: Semana 1 – Creche"
                      className="mt-1"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <Label>Atende quais etapas</Label>
                    <div className="mt-1.5 flex flex-wrap gap-2">
                      {categories.map((cat) => {
                        const checked = targetCategories.includes(cat);
                        return (
                          <button
                            key={cat}
                            type="button"
                            onClick={() => {
                              const next = checked
                                ? targetCategories.filter((c) => c !== cat)
                                : [...targetCategories, cat];
                              if (next.length === 0) return; // keep at least one
                              // Clear slots when meal structure changes (Creche / Ensino Infantil / Fundamental)
                              const getEff = (cats: string[]) =>
                                cats.includes('Creche') ? 'Creche'
                                : cats.includes('Ensino Infantil') && cats.every(c => c === 'Ensino Infantil') ? 'Ensino Infantil'
                                : 'Fundamental 1';
                              const prevEff = getEff(targetCategories);
                              const nextEff = getEff(next);
                              if (prevEff !== nextEff) setSlots([]);
                              setTargetCategories(next);
                              const newEff = next.includes('Creche') ? 'Creche' : next.includes('Ensino Infantil') && next.every(c => c === 'Ensino Infantil') ? 'Ensino Infantil' : (next[0] as (typeof categories)[number]);
                              setTargetMeal(mealMap[newEff][0]);
                            }}
                            className={`rounded-full border px-3 py-1 text-xs font-semibold transition-all ${
                              checked
                                ? 'bg-green-600 border-green-600 text-white'
                                : 'bg-white border-gray-300 text-gray-600 hover:border-green-400'
                            }`}
                          >
                            {checked ? '✓ ' : ''}{cat}
                          </button>
                        );
                      })}
                    </div>
                    <p className="mt-1 text-[10px] text-gray-400">
                      Estrutura de refeições: <strong>{effectiveCategory}</strong>
                      {targetCategories.length > 1 && ` (e mais ${targetCategories.length - 1} etapa${targetCategories.length > 2 ? 's' : ''})`}
                    </p>
                  </div>
                  <div>
                    <Label>Mês de referência</Label>
                    <Input
                      value={referenceMonth}
                      onChange={(e) => setReferenceMonth(e.target.value)}
                      placeholder="Ex: Maio 2026"
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label>Semana (segunda-feira)</Label>
                    <Input
                      type="date"
                      value={weekStartDate}
                      onChange={(e) => {
                        const v = e.target.value;
                        setWeekStartDate(v);
                        // auto-fill referenceMonth from date if empty
                        if (v && !referenceMonth) {
                          const d = new Date(v + 'T12:00:00');
                          const months = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
                          setReferenceMonth(`${months[d.getMonth()]} ${d.getFullYear()}`);
                        }
                      }}
                      className="mt-1"
                    />
                    {weekStartDate && (
                      <p className="mt-0.5 text-[10px] text-green-700">
                        {weekdays.map((d, i) => {
                          const dt = new Date(weekStartDate + 'T12:00:00');
                          dt.setDate(dt.getDate() + i);
                          return `${d} ${format(dt, 'dd/MM')}`;
                        }).join(' · ')}
                      </p>
                    )}
                  </div>
                  <div>
                    <Label>Nº de alunos</Label>
                    <Input
                      type="number"
                      min="0"
                      value={studentCount}
                      onChange={(e) => setStudentCount(e.target.value === '' ? '' : Number(e.target.value))}
                      placeholder="Ex: 120"
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label>Escolas</Label>
                    <div className="mt-1">
                      <MultiSchoolSelector
                        schools={schools}
                        selected={targetSchoolIds}
                        onChange={setTargetSchoolIds}
                      />
                    </div>
                  </div>
                </div>

                {/* ── Ingredient / recipe picker ──────────────────────────────── */}
                <Card className="border-green-200 bg-green-50/30">
                  <CardContent className="p-4 space-y-3">
                    <p className="text-xs font-semibold text-green-800 uppercase tracking-wide">
                      Adicionar ingrediente ou ficha técnica
                    </p>
                    <div className="grid gap-3 md:grid-cols-4">
                      <div>
                        <Label>Dia</Label>
                        <Select value={targetDay} onValueChange={setTargetDay}>
                          <SelectTrigger className="mt-1 w-full"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {weekdays.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Refeição</Label>
                        <Select value={targetMeal} onValueChange={setTargetMeal}>
                          <SelectTrigger className="mt-1 w-full"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {meals.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Fonte</Label>
                        <Select value={sourceType} onValueChange={(v) => { setSourceType(v as SourceType); setSearch(''); setPendingFood(null); }}>
                          <SelectTrigger className="mt-1 w-full"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="recipe">Ficha técnica</SelectItem>
                            <SelectItem value="food">Alimento (TACO)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Pesquisar</Label>
                        <div className="relative mt-1">
                          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                          <Input
                            value={search}
                            onChange={(e) => { setSearch(e.target.value); setPendingFood(null); }}
                            placeholder="Digite para buscar…"
                            className="pl-9"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Search results dropdown */}
                    {searchResults.length > 0 && (
                      <div className="max-w-2xl overflow-hidden rounded-lg border bg-white shadow-sm">
                        {sourceType === 'recipe'
                          ? (searchResults as Recipe[]).map((r) => (
                              <button
                                key={r.id}
                                type="button"
                                onClick={() => addRecipeInsumo(r)}
                                className="w-full border-b px-3 py-2.5 text-left text-sm hover:bg-green-50 last:border-b-0"
                              >
                                <span className="font-medium">{r.displayName || r.name}</span>
                                <span className="ml-2 text-[11px] text-gray-400">
                                  {r.nutrientsPerServing.kcal.toFixed(0)} kcal · {r.perCapita}g · R$ {r.costPerServing.toFixed(2)}
                                </span>
                              </button>
                            ))
                          : (searchResults as Food[]).map((f) => {
                              const sf   = getFoodSeasonality(f.name, currentMonth);
                              const sfInfo = sf ? seasonLabels[sf.season] : null;
                              const isPending = pendingFood?.food.id === f.id;
                              return (
                                <div key={f.id} className="border-b last:border-b-0">
                                  <button
                                    type="button"
                                    onClick={() => stageFoodInsumo(f)}
                                    className="w-full px-3 py-2.5 text-left text-sm hover:bg-green-50"
                                  >
                                    <span className="font-medium">{f.name}</span>
                                    <span className="ml-2 text-[11px] text-gray-400">{f.nutrients.kcal} kcal/100g</span>
                                    {f.familyFarm && <span className="ml-2 text-[10px] text-green-700 font-semibold">🌱 AF</span>}
                                    {sfInfo && (
                                      <span className={`ml-2 inline-flex items-center gap-0.5 rounded-full border px-1.5 py-0.5 text-[10px] font-semibold ${sfInfo.color}`}>
                                        {sfInfo.emoji} Safra
                                      </span>
                                    )}
                                  </button>

                                  {/* Per-capita staging panel */}
                                  {isPending && (
                                    <div className="flex items-center gap-2 bg-green-50 px-3 py-2 border-t">
                                      <span className="text-xs text-gray-600 shrink-0">Gramagem (g):</span>
                                      <Input
                                        type="number"
                                        min="1"
                                        value={pendingFood.grams}
                                        onChange={(e) => setPendingFood({ ...pendingFood, grams: e.target.value })}
                                        className="h-7 w-24 text-sm text-center"
                                        autoFocus
                                        onKeyDown={(e) => { if (e.key === 'Enter') confirmFoodInsumo(); }}
                                      />
                                      <span className="text-xs text-gray-400">
                                        = {((f.nutrients.kcal * (parseFloat(pendingFood.grams) || 100)) / 100).toFixed(0)} kcal
                                      </span>
                                      <Button
                                        size="sm"
                                        className="h-7 bg-green-700 hover:bg-green-800 text-xs px-3"
                                        onClick={confirmFoodInsumo}
                                      >
                                        Adicionar
                                      </Button>
                                      <button
                                        type="button"
                                        onClick={() => setPendingFood(null)}
                                        className="text-gray-400 hover:text-gray-600 text-xs"
                                      >✕</button>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                      </div>
                    )}

                        {clipboard && (
                      <p className="text-xs text-green-700">
                        📋 Copiado: <strong>{clipboard.desc}</strong> ({clipboard.slots.reduce((a, s) => a + s.composicao.length, 0)} insumos)
                      </p>
                    )}

                    {/* Menu clipboard paste banner */}
                    {menuClipboard && (
                      <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2.5 space-y-2">
                        <div className="flex items-center gap-2 text-xs text-blue-800">
                          <ClipboardList className="h-3.5 w-3.5 shrink-0" />
                          <span>
                            {menuClipboard.sourceMealLabel
                              ? <>Refeição copiada: <strong>"{menuClipboard.sourceMealLabel}"</strong></>
                              : <>Cardápio completo copiado:</>
                            }
                            {' '}<span className="text-blue-600">de "{menuClipboard.fromTitle}"</span>
                            {' '}· {menuClipboard.slots.reduce((a, s) => a + s.composicao.length, 0)} ingredientes
                          </span>
                        </div>

                        {menuClipboard.sourceMealLabel !== null ? (
                          // Meal-based paste: user picks target meal label
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-xs text-blue-700 font-medium shrink-0">Colar como refeição:</span>
                            <Select
                              value={pasteMealTarget || meals[0]}
                              onValueChange={setPasteMealTarget}
                            >
                              <SelectTrigger className="h-7 w-44 text-xs bg-white">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {meals.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                              </SelectContent>
                            </Select>
                            <Button
                              type="button"
                              size="sm"
                              className="h-7 bg-blue-600 hover:bg-blue-700 text-xs px-3"
                              onClick={pasteMenuClipboard}
                            >
                              <ClipboardPaste className="mr-1 h-3.5 w-3.5" />
                              Colar
                            </Button>
                            <button
                              type="button"
                              onClick={() => setMenuClipboard(null)}
                              className="text-xs text-gray-400 hover:text-gray-600"
                            >✕ Limpar</button>
                          </div>
                        ) : (
                          // Full menu paste
                          <div className="flex items-center gap-2">
                            <Button
                              type="button"
                              size="sm"
                              className="h-7 bg-blue-600 hover:bg-blue-700 text-xs px-3"
                              onClick={pasteMenuClipboard}
                            >
                              <ClipboardPaste className="mr-1 h-3.5 w-3.5" />
                              Colar cardápio inteiro
                            </Button>
                            <span className="text-xs text-blue-600">
                              (categoria "{menuClipboard.fromCategory}" será aplicada)
                            </span>
                            <button
                              type="button"
                              onClick={() => setMenuClipboard(null)}
                              className="text-xs text-gray-400 hover:text-gray-600"
                            >✕ Limpar</button>
                          </div>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* ── Weekly grid ─────────────────────────────────────────────── */}
                <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
                  {weekdays.map((day) => (
                    <Card key={day} className="overflow-hidden">
                      <CardHeader className="border-b bg-green-700 py-2 px-3">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-bold text-white">
                            {day}{weekDayDates[day] ? ` (${weekDayDates[day]})` : ''}
                          </span>
                          <div className="flex gap-1.5">
                            <button type="button" title="Copiar dia" onClick={() => copyDay(day)}
                              className="rounded p-0.5 text-green-200 hover:bg-green-600 hover:text-white">
                              <Copy className="h-3.5 w-3.5" />
                            </button>
                            <button type="button" title="Colar dia" onClick={() => pasteDay(day)}
                              className="rounded p-0.5 text-green-200 hover:bg-green-600 hover:text-white">
                              <ClipboardPaste className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      </CardHeader>

                      <CardContent className="space-y-2 p-2">
                        {meals.map((meal) => {
                          const slot        = slots.find((s) => s.dayLabel === day && s.mealLabel === meal);
                          const composicao  = slot?.composicao ?? [];
                          const totalKcal   = composicao.reduce((sum, ins) => sum + insumoKcal(ins), 0);

                          return (
                            <div key={`${day}-${meal}`} className="rounded-lg border bg-white p-2">

                              {/* Meal label + clipboard */}
                              <div className="flex items-center justify-between">
                                <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">
                                  {meal}
                                </span>
                                <div className="flex gap-1">
                                  <button type="button" title={`Copiar ${meal}`} onClick={() => copyMeal(day, meal)}
                                    className="rounded p-0.5 text-gray-400 hover:bg-green-100 hover:text-green-700">
                                    <Copy className="h-3 w-3" />
                                  </button>
                                  <button type="button" title={`Colar em ${meal}`} onClick={() => pasteMeal(day, meal)}
                                    className="rounded p-0.5 text-gray-400 hover:bg-green-100 hover:text-green-700">
                                    <ClipboardPaste className="h-3 w-3" />
                                  </button>
                                </div>
                              </div>

                              {/* Nome Fantasia — único campo visível no PDF */}
                              <Input
                                value={slot?.nomeFantasia ?? ''}
                                onChange={(e) => updateNomeFantasia(day, meal, e.target.value)}
                                placeholder="Nome do prato (só aparece no PDF)"
                                className="mt-1 h-7 text-[11px] px-2 font-semibold border-green-300 focus:border-green-500"
                              />

                              {/* ── Composição — ingredientes com gramagem editável ── */}
                              <div className="mt-1.5 space-y-1">
                                {composicao.map((ins) => {
                                  const kcal = insumoKcal(ins);
                                  return (
                                    <div key={ins.id} className="rounded border border-green-100 bg-green-50 px-2 py-1.5">
                                      {/* Nome do insumo */}
                                      <div className="flex items-center justify-between gap-1 mb-1">
                                        <span className="truncate text-[11px] font-medium text-gray-800 flex-1">
                                          {ins.nome}
                                          {ins.familyFarm && <span className="ml-1 text-[9px] text-green-700">🌱</span>}
                                        </span>
                                        <button
                                          type="button"
                                          onClick={() => removeInsumo(day, meal, ins.id)}
                                          className="shrink-0 text-red-300 hover:text-red-500"
                                        >
                                          <Trash2 className="h-3 w-3" />
                                        </button>
                                      </div>

                                      {/* Peso atual (editável) + kcal calculado */}
                                      <div className="flex items-center gap-1.5">
                                        <Input
                                          type="number"
                                          min="1"
                                          value={ins.pesoAtual}
                                          onChange={(e) =>
                                            updateInsumoPeso(day, meal, ins.id, Math.max(1, parseFloat(e.target.value) || 1))
                                          }
                                          className="h-6 w-16 text-[10px] text-center px-1 py-0 border-green-300"
                                        />
                                        <span className="text-[10px] text-gray-400">{ins.sourceUnit || 'g'}</span>
                                        <span className="ml-auto text-[10px] font-semibold text-green-700">
                                          {kcal.toFixed(0)} kcal
                                        </span>
                                      </div>
                                    </div>
                                  );
                                })}

                                {/* Add trigger — clicking sets picker to this slot */}
                                <div
                                  className="cursor-pointer rounded border-2 border-dashed border-gray-200 py-1.5 text-center text-[10px] text-gray-400 hover:border-green-300 hover:text-green-600"
                                  onClick={() => { setTargetDay(day); setTargetMeal(meal); }}
                                >
                                  + adicionar ingrediente / ficha técnica
                                </div>

                                {/* Slot total kcal */}
                                {composicao.length > 0 && (
                                  <div className="flex justify-end pr-1 pt-0.5">
                                    <span className="text-[10px] font-bold text-green-800">
                                      Total: {totalKcal.toFixed(0)} kcal
                                    </span>
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </CardContent>
                    </Card>
                  ))}
                </div>

                {/* ── Weekly summary ───────────────────────────────────────────── */}
                {summary && (
                  <Card className="border-green-200 bg-green-50">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base">Resumo semanal</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="grid gap-3 md:grid-cols-4">
                        {[
                          { label: 'Custo médio/dia', value: `R$ ${summary.averageCost.toFixed(2)}` },
                          { label: 'Kcal média',      value: summary.averageNutrients.kcal.toFixed(0) },
                          { label: studentCount ? `Custo/aluno (${studentCount} alunos)` : 'Proteína média',
                            value: studentCount ? `R$ ${summary.averageCost.toFixed(2)}` : `${summary.averageNutrients.protein.toFixed(1)} g` },
                          { label: studentCount ? 'Custo total semana' : 'Ag. Familiar',
                            value: studentCount ? `R$ ${(summary.averageCost * 5 * Number(studentCount)).toFixed(2)}` : `${summary.familyFarmShare.toFixed(0)}%`,
                            ok: studentCount ? undefined : summary.familyFarmShare >= (new Date().getFullYear() >= 2026 ? 45 : 30) },
                        ].map(({ label, value, ok }) => (
                          <div key={label} className="rounded-lg border bg-white p-3">
                            <p className="text-xs text-gray-500">{label}</p>
                            <p className={`mt-1 text-xl font-bold ${ok === false ? 'text-amber-600' : ok === true ? 'text-green-700' : 'text-gray-900'}`}>
                              {value}
                            </p>
                          </div>
                        ))}
                      </div>

                      <div className="grid gap-2 md:grid-cols-7">
                        {fndeTargets.map((t) => {
                          const val = summary.averageNutrients[t.key];
                          const ok  = val >= t.min;
                          return (
                            <div key={t.key} className="rounded-lg border bg-white p-2 text-center">
                              <p className="text-[10px] uppercase text-gray-400">{t.label}</p>
                              <p className={`text-base font-bold ${ok ? 'text-green-600' : 'text-red-500'}`}>
                                {val.toFixed(1)}
                              </p>
                              <p className="text-[10px] text-gray-300">≥{t.min}</p>
                            </div>
                          );
                        })}
                      </div>

                      {summary.complianceAlerts.length > 0 && (
                        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                          <div className="mb-1 flex items-center gap-2 text-amber-800">
                            <AlertTriangle className="h-4 w-4" />
                            <span className="text-sm font-semibold">Alertas de conformidade</span>
                          </div>
                          {summary.complianceAlerts.map((a) => (
                            <p key={a} className="text-sm text-amber-800">{a}</p>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}

                {/* ── Diet alerts panel ─────────────────────────────────────── */}
                {dietAlerts.length > 0 && (
                  <div className="rounded-xl border border-orange-200 bg-orange-50 p-4">
                    <div className="mb-2 flex items-center gap-2 text-orange-800">
                      <ShieldAlert className="h-4 w-4 shrink-0" />
                      <span className="text-sm font-semibold">
                        {dietAlerts.length} aluno{dietAlerts.length > 1 ? 's' : ''} com dieta especial
                        {targetSchoolIds.length > 0 ? ' nas escolas selecionadas' : ' na rede'}
                      </span>
                    </div>
                    <div className="space-y-2">
                      {dietAlerts.map((diet) => (
                        <div
                          key={diet.id}
                          className="flex flex-wrap items-start gap-x-2 gap-y-1 rounded-lg border border-orange-100 bg-white px-3 py-2 text-xs"
                        >
                          <span className="font-semibold text-orange-900">{diet.studentName}</span>
                          <span className="text-orange-600">— {diet.schoolName}</span>
                          {diet.category && (
                            <span className="rounded-full bg-blue-100 px-1.5 py-0.5 text-[10px] font-semibold text-blue-700">
                              {diet.category}
                            </span>
                          )}
                          <div className="flex flex-wrap gap-1">
                            {(diet.labels ?? []).map((key) => {
                              const info = DIET_LABEL_MAP.get(key);
                              return info ? (
                                <span
                                  key={key}
                                  className={`inline-flex rounded-full border px-1.5 py-0.5 text-[10px] font-semibold ${info.color}`}
                                >
                                  {info.text}
                                </span>
                              ) : null;
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                    <p className="mt-2 text-xs text-orange-700">
                      ⚠️ Verifique os ingredientes e prepare marmitas individuais conforme as prescrições.
                    </p>
                  </div>
                )}

                <div className="flex justify-end gap-3 pt-2">
                  <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
                  <Button onClick={handleSave} className="bg-green-600 hover:bg-green-700">
                    Salvar Cardápio
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* ── Gallery filter bar ───────────────────────────────────────────────── */}
        {!loading && menus.length > 0 && (
          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <SlidersHorizontal className="h-4 w-4 text-gray-500" />
              <span className="text-sm font-semibold text-gray-700">Filtrar galeria</span>
              <div className="ml-auto flex items-center gap-1">
                <button
                  type="button"
                  title="Grade"
                  onClick={() => setGalleryView('grid')}
                  className={`rounded p-1.5 transition-colors ${galleryView === 'grid' ? 'bg-green-100 text-green-700' : 'text-gray-400 hover:text-gray-600'}`}
                >
                  <LayoutGrid className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  title="Lista"
                  onClick={() => setGalleryView('list')}
                  className={`rounded p-1.5 transition-colors ${galleryView === 'list' ? 'bg-green-100 text-green-700' : 'text-gray-400 hover:text-gray-600'}`}
                >
                  <LayoutList className="h-4 w-4" />
                </button>
              </div>
              {(gallerySearch || galleryCategory || galleryMonth) && (
                <button
                  type="button"
                  onClick={() => { setGallerySearch(''); setGalleryCategory(''); setGalleryMonth(''); }}
                  className="flex items-center gap-1 rounded-full border border-gray-200 px-2 py-0.5 text-xs text-gray-500 hover:bg-gray-50"
                >
                  <X className="h-3 w-3" /> Limpar filtros
                </button>
              )}
            </div>
            <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-4">
              {/* Text search */}
              <div className="relative sm:col-span-2 md:col-span-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={gallerySearch}
                  onChange={(e) => setGallerySearch(e.target.value)}
                  placeholder="Buscar por título, escola…"
                  className="h-9 w-full rounded-md border border-input bg-background pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>
              {/* Category filter */}
              <select
                value={galleryCategory}
                onChange={(e) => setGalleryCategory(e.target.value)}
                className="h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              >
                <option value="">Todas as etapas</option>
                {categories.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
              {/* Month filter */}
              <select
                value={galleryMonth}
                onChange={(e) => setGalleryMonth(e.target.value)}
                className="h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              >
                <option value="">Todos os meses</option>
                {allReferenceMonths.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
              {/* Sort */}
              <select
                value={gallerySort}
                onChange={(e) => setGallerySort(e.target.value as typeof gallerySort)}
                className="h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              >
                <option value="newest">Mais recente (criação)</option>
                <option value="oldest">Mais antigo (criação)</option>
                <option value="edited">Última edição</option>
                <option value="alpha">A → Z</option>
              </select>
            </div>
            <p className="mt-2 text-xs text-gray-400">
              {filteredMenus.length} de {menus.length} cardápio{menus.length !== 1 ? 's' : ''}
              {(gallerySearch || galleryCategory || galleryMonth) ? ' encontrado(s)' : ' no total'}
            </p>
          </div>
        )}

        {/* ── Menu cards list ──────────────────────────────────────────────────── */}
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-green-600" />
          </div>
        ) : menus.length === 0 ? (
          <Card>
            <CardContent className="py-16 text-center">
              <BookOpen className="mx-auto mb-4 h-12 w-12 text-gray-300" />
              <p className="font-medium text-gray-600">Nenhum cardápio salvo ainda.</p>
              <p className="mt-1 text-sm text-gray-400">Clique em "Novo Cardápio" para começar.</p>
            </CardContent>
          </Card>
        ) : filteredMenus.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Search className="mx-auto mb-3 h-10 w-10 text-gray-300" />
              <p className="font-medium text-gray-600">Nenhum cardápio encontrado com esses filtros.</p>
              <button
                type="button"
                onClick={() => { setGallerySearch(''); setGalleryCategory(''); setGalleryMonth(''); }}
                className="mt-2 text-sm text-green-600 hover:underline"
              >
                Limpar filtros
              </button>
            </CardContent>
          </Card>
        ) : galleryView === 'list' ? (
          /* ── List view ───────────────────────────────────────────────────── */
          <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b">
                  <th className="px-4 py-2.5 text-left font-semibold text-gray-700">Título</th>
                  <th className="px-3 py-2.5 text-left font-semibold text-gray-700 hidden md:table-cell">Etapa</th>
                  <th className="px-3 py-2.5 text-left font-semibold text-gray-700 hidden md:table-cell">Referência</th>
                  <th className="px-3 py-2.5 text-right font-semibold text-gray-700">Kcal</th>
                  <th className="px-3 py-2.5 text-right font-semibold text-gray-700 hidden sm:table-cell">Custo/dia</th>
                  <th className="px-3 py-2.5 text-right font-semibold text-gray-700 hidden lg:table-cell">Ag.Fam.</th>
                  <th className="px-3 py-2.5 text-right font-semibold text-gray-700 hidden lg:table-cell">Alunos</th>
                  <th className="px-4 py-2.5 text-left font-semibold text-gray-700 hidden xl:table-cell">Status</th>
                  <th className="px-4 py-2.5 text-right font-semibold text-gray-700">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredMenus.map((menu) => {
                  const schoolNames = (menu.schoolIds ?? []).map((id) => schoolMap.get(id) ?? id);
                  const cat = menu.category as (typeof categories)[number];
                  const ml  = mealMap[cat] ?? ['Refeição'];
                  const afOk = menu.familyFarmShare >= (new Date().getFullYear() >= 2026 ? 45 : 30);
                  return (
                    <tr key={menu.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-900 truncate max-w-[200px]">{menu.title}</p>
                        <p className="text-xs text-gray-400 truncate max-w-[200px]">
                          {schoolNames.length > 0 ? schoolNames.join(', ') : 'Toda a rede'}
                        </p>
                      </td>
                      <td className="px-3 py-3 hidden md:table-cell">
                        <div className="flex flex-wrap gap-1">
                          {(menu.targetCategories?.length ? menu.targetCategories : [menu.category]).map((c) => (
                            <span key={c} className="rounded-full bg-green-100 px-1.5 py-0.5 text-[10px] font-semibold text-green-800">{c}</span>
                          ))}
                        </div>
                      </td>
                      <td className="px-3 py-3 text-gray-600 hidden md:table-cell">
                        {menu.referenceMonth || '—'}
                        {menu.weekStartDate && (
                          <p className="text-[10px] text-gray-400">
                            {format(new Date(menu.weekStartDate + 'T12:00:00'), 'dd/MM')} – {format(new Date(new Date(menu.weekStartDate + 'T12:00:00').setDate(new Date(menu.weekStartDate + 'T12:00:00').getDate() + 4)), 'dd/MM')}
                          </p>
                        )}
                      </td>
                      <td className="px-3 py-3 text-right font-semibold">{menu.averageKcal.toFixed(0)}</td>
                      <td className="px-3 py-3 text-right hidden sm:table-cell">R$ {menu.averageCost.toFixed(2)}</td>
                      <td className={`px-3 py-3 text-right font-semibold hidden lg:table-cell ${afOk ? 'text-green-700' : 'text-amber-600'}`}>
                        {menu.familyFarmShare.toFixed(0)}%
                      </td>
                      <td className="px-3 py-3 text-right text-gray-600 hidden lg:table-cell">
                        {menu.studentCount ? menu.studentCount : '—'}
                      </td>
                      <td className="px-4 py-3 hidden xl:table-cell">
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                          menu.status === 'published' ? 'bg-green-100 text-green-800' :
                          menu.status === 'approved'  ? 'bg-blue-100 text-blue-800' :
                          menu.status === 'under_review' ? 'bg-amber-100 text-amber-800' :
                          'bg-gray-100 text-gray-600'
                        }`}>{menu.status}</span>
                        {menu.complianceAlerts.length > 0 && (
                          <span className="ml-1 rounded-full bg-amber-50 px-1.5 py-0.5 text-[10px] text-amber-700">
                            {menu.complianceAlerts.length} alerta(s)
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-green-700 hover:bg-green-50"
                            title="Imprimir PDF"
                            onClick={() => generateMenuPDF(menu, schoolNames, ml, false, orgSettings?.logoDataUrl).catch(() => toast.error('Erro ao gerar PDF.'))}>
                            <Printer className="h-3.5 w-3.5" />
                          </Button>
                          <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-blue-600 hover:bg-blue-50"
                            title="Editar" onClick={() => openEditMenu(menu)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-red-500 hover:bg-red-50"
                            title="Excluir" onClick={() => { deleteMenu(menu.id); toast.success('Cardápio excluído.'); }}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
            {filteredMenus.map((menu) => {
              const schoolNames  = (menu.schoolIds ?? []).map((id) => schoolMap.get(id) ?? id);
              const insumoCount  = (menu.slots || []).reduce((acc, s) => acc + s.composicao.length, 0)
                                   || menu.items.length;

              return (
                <Card key={menu.id} className="transition-shadow hover:shadow-md">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <CardTitle className="text-base">{menu.title}</CardTitle>
                        <CardDescription>
                          <span className="inline-flex flex-wrap gap-1 mr-1">
                            {(menu.targetCategories?.length ? menu.targetCategories : [menu.category]).map((cat) => (
                              <span key={cat} className="rounded-full bg-green-100 px-1.5 py-0.5 text-[10px] font-semibold text-green-800">{cat}</span>
                            ))}
                          </span>
                          · {menu.referenceMonth || 'Sem referência'}
                        </CardDescription>
                      </div>
                      <span className="shrink-0 rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800">
                        {insumoCount} insumos
                      </span>
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-3 text-sm">
                    <div className="grid grid-cols-2 gap-2">
                      <div className="rounded-lg bg-gray-50 p-2">
                        <p className="text-xs text-gray-400">Kcal média</p>
                        <p className="font-bold">{menu.averageKcal.toFixed(0)}</p>
                      </div>
                      <div className="rounded-lg bg-gray-50 p-2">
                        <p className="text-xs text-gray-400">Custo médio/dia</p>
                        <p className="font-bold">R$ {menu.averageCost.toFixed(2)}</p>
                      </div>
                      <div className="rounded-lg bg-gray-50 p-2">
                        <p className="text-xs text-gray-400">Proteína média</p>
                        <p className="font-bold">{menu.averageProtein.toFixed(1)} g</p>
                      </div>
                      <div className={`rounded-lg p-2 ${menu.familyFarmShare >= (new Date().getFullYear() >= 2026 ? 45 : 30) ? 'bg-green-50' : 'bg-amber-50'}`}>
                        <p className="text-xs text-gray-400">Ag. Familiar</p>
                        <p className={`font-bold ${menu.familyFarmShare >= (new Date().getFullYear() >= 2026 ? 45 : 30) ? 'text-green-700' : 'text-amber-600'}`}>
                          {menu.familyFarmShare.toFixed(0)}%
                        </p>
                      </div>
                    </div>

                    <div className="rounded-lg border bg-gray-50 px-3 py-2 text-xs text-gray-600">
                      <span className="font-semibold">Escolas: </span>
                      {schoolNames.length > 0 ? schoolNames.join(', ') : 'Toda a rede'}
                    </div>

                    {menu.complianceAlerts.length > 0 ? (
                      <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
                        {menu.complianceAlerts.slice(0, 2).map((a) => (
                          <p key={a} className="text-xs text-amber-800">{a}</p>
                        ))}
                      </div>
                    ) : (
                      <div className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-xs text-green-800">
                        ✓ Sem alertas principais
                      </div>
                    )}

                    {(menu.studentCount || menu.weekStartDate) && (
                      <div className="rounded-lg bg-blue-50 border border-blue-100 px-3 py-2 text-xs text-blue-800 flex flex-wrap gap-x-3 gap-y-1">
                        {menu.weekStartDate && (
                          <span>📅 {format(new Date(menu.weekStartDate + 'T12:00:00'), 'dd/MM')} – {format(new Date(new Date(menu.weekStartDate + 'T12:00:00').setDate(new Date(menu.weekStartDate + 'T12:00:00').getDate() + 4)), 'dd/MM/yyyy')}</span>
                        )}
                        {menu.studentCount && (
                          <span>👨‍🎓 {menu.studentCount} alunos · R$ {(menu.averageCost).toFixed(2)}/aluno/dia · semana: R$ {(menu.averageCost * 5 * menu.studentCount).toFixed(2)}</span>
                        )}
                      </div>
                    )}
                    <p className="text-xs text-gray-400">
                      Salvo em {safeFormat(menu.updatedAt, 'dd/MM/yyyy HH:mm')} · {menu.responsibleName}
                    </p>

                    <div className="flex gap-2 pt-1">
                      <Button
                        className="flex-1 bg-green-600 hover:bg-green-700 gap-1.5"
                        size="sm"
                        onClick={() => {
                          const names = (menu.schoolIds ?? []).map((id) => schoolMap.get(id) ?? id);
                          const cat   = menu.category as (typeof categories)[number];
                          const ml    = mealMap[cat] ?? ['Refeição'];
                          generateMenuPDF(menu, names, ml, false, orgSettings?.logoDataUrl).catch(() => toast.error('Erro ao gerar PDF.'));
                        }}
                      >
                        <Printer className="h-4 w-4" />
                        Imprimir A4
                      </Button>
                      <Button
                        variant="outline" size="sm"
                        className="border-green-200 text-green-700 hover:bg-green-50 gap-1"
                        title="Enviar cardápio por e-mail para as escolas"
                        onClick={() => {
                          setEmailModal({ open: true, menu });
                          setEmailSelectedSchools(menu.schoolIds ?? []);
                        }}
                      >
                        <Mail className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline" size="sm"
                        className={`border-blue-200 text-blue-600 hover:bg-blue-50 ${copyPickerMenuId === menu.id ? 'bg-blue-50' : ''}`}
                        title="Copiar refeições deste cardápio"
                        onClick={() => setCopyPickerMenuId(copyPickerMenuId === menu.id ? null : menu.id)}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline" size="sm"
                        className="border-blue-200 text-blue-600 hover:bg-blue-50"
                        onClick={() => openEditMenu(menu)}
                        title="Editar cardápio"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline" size="sm"
                        className="border-red-200 text-red-600 hover:bg-red-50"
                        onClick={() => { deleteMenu(menu.id); toast.success('Cardápio excluído.'); }}
                        title="Excluir cardápio"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>

                    {/* Meal-copy picker — shows when copy button is clicked */}
                    {copyPickerMenuId === menu.id && (() => {
                      const srcSlots = menu.slots?.length
                        ? menu.slots
                        : migrateItemsToSlots(menu.items);
                      const uniqueMeals = Array.from(
                        new Set(
                          srcSlots
                            .filter((s) => s.composicao.length > 0)
                            .map((s) => s.mealLabel),
                        ),
                      );
                      return (
                        <div className="mt-3 rounded-lg border border-blue-200 bg-blue-50 p-3">
                          <p className="mb-2 text-xs font-semibold text-blue-800">
                            O que quer copiar deste cardápio?
                          </p>
                          <div className="flex flex-wrap gap-1.5">
                            {uniqueMeals.map((meal) => (
                              <button
                                key={meal}
                                type="button"
                                onClick={() => copyFromMenu(menu, meal)}
                                className="rounded-full border border-blue-300 bg-white px-3 py-1 text-xs text-blue-700 hover:bg-blue-100 font-medium"
                              >
                                Só os {meal}s
                              </button>
                            ))}
                            <button
                              type="button"
                              onClick={() => copyFromMenu(menu, null)}
                              className="rounded-full border border-green-300 bg-white px-3 py-1 text-xs text-green-700 hover:bg-green-100 font-semibold"
                            >
                              Cardápio completo
                            </button>
                            <button
                              type="button"
                              onClick={() => setCopyPickerMenuId(null)}
                              className="rounded-full border border-gray-200 bg-white px-3 py-1 text-xs text-gray-400 hover:bg-gray-50"
                            >
                              Cancelar
                            </button>
                          </div>
                        </div>
                      );
                    })()}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>

    {/* ── Email modal ── */}

    {emailModal.open && emailModal.menu && (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        style={{ background: 'rgba(0,0,0,0.45)' }}
        onClick={() => setEmailModal({ open: false, menu: null })}
      >
        <div
          className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 relative max-h-[90vh] overflow-y-auto"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={() => setEmailModal({ open: false, menu: null })}
            className="absolute top-4 right-4 text-gray-300 hover:text-gray-500"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-3 mb-4">
            <div className="w-9 h-9 rounded-full bg-green-100 flex items-center justify-center">
              <Mail className="w-4 h-4 text-green-600" />
            </div>
            <div>
              <h3 className="font-bold text-gray-800">Enviar cardápio por e-mail</h3>
              <p className="text-xs text-gray-400">{emailModal.menu.title}</p>
            </div>
          </div>

          <p className="text-sm text-gray-600 mb-3">Selecione as escolas que receberão este cardápio:</p>

          <div className="space-y-2 mb-4 max-h-60 overflow-y-auto">
            {schools.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-4">Nenhuma escola cadastrada.</p>
            ) : (
              schools.map(school => (
                <label
                  key={school.id}
                  className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                    emailSelectedSchools.includes(school.id)
                      ? 'border-green-300 bg-green-50'
                      : 'border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  <input
                    type="checkbox"
                    className="rounded"
                    checked={emailSelectedSchools.includes(school.id)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setEmailSelectedSchools(prev => [...prev, school.id]);
                      } else {
                        setEmailSelectedSchools(prev => prev.filter(id => id !== school.id));
                      }
                    }}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{school.name}</p>
                    {school.email
                      ? <p className="text-xs text-green-600">{school.email}</p>
                      : <p className="text-xs text-amber-500">⚠ Sem e-mail cadastrado</p>
                    }
                  </div>
                </label>
              ))
            )}
          </div>

          <div className="flex items-center justify-between text-xs text-gray-400 mb-4">
            <button
              type="button"
              onClick={() => setEmailSelectedSchools(schools.map(s => s.id))}
              className="underline hover:text-gray-600"
            >
              Selecionar todas
            </button>
            <button
              type="button"
              onClick={() => setEmailSelectedSchools([])}
              className="underline hover:text-gray-600"
            >
              Limpar seleção
            </button>
          </div>

          <button
            onClick={handleSendMenuEmail}
            disabled={emailSending || emailSelectedSchools.length === 0}
            className="w-full py-2.5 rounded-xl font-semibold text-white flex items-center justify-center gap-2 transition-opacity"
            style={{ background: '#4CAF50', opacity: (emailSending || emailSelectedSchools.length === 0) ? 0.5 : 1 }}
          >
            {emailSending ? (
              <><span className="animate-spin">⏳</span> Enviando…</>
            ) : (
              <><Mail className="w-4 h-4" /> Enviar para {emailSelectedSchools.length} escola(s)</>
            )}
          </button>
        </div>
      </div>
    )}
    </>
  );
}
