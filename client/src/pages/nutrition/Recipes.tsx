import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { useFoods } from '@/hooks/useFoods';
import { useRecipes } from '@/hooks/useRecipes';
import { useAuth } from '@/contexts/AuthContext';
import type { Food, RecipeClassification, RecipeIngredient } from '@/types/nutrition';
import { Copy, FileText, LayoutGrid, List, Pencil, Plus, Printer, PrinterCheck, Search, SlidersHorizontal, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { Recipe } from '@/types/nutrition';
import { addPdfHeader } from '@/lib/pdfBranding';
import { getDefaultCorrectionFactor } from '@/data/correctionFactors';
import { detectAllergens } from '@/data/allergenMapping';
import { DEFAULT_RECIPES } from '@/data/defaultRecipes';
import { SUGGESTED_FACTORS } from '@/lib/replicateMenu';
import { FNDE_MEAL_REFERENCE, FNDE_REFERENCE_NOTE, adequacyPercent } from '@/data/fndeReference';

const emptyNutrients = {
  kcal: 0,
  protein: 0,
  lipids: 0,
  carbohydrates: 0,
  fiber: 0,
  calcium: 0,
  iron: 0,
  zinc: 0,
  vitaminA: 0,
  vitaminC: 0,
};

const recipeClassifications: { value: RecipeClassification; label: string }[] = [
  { value: 'principal', label: 'Prato principal' },
  { value: 'guarnicao', label: 'Guarnicao' },
  { value: 'bebida', label: 'Bebida' },
  { value: 'sobremesa', label: 'Sobremesa' },
  { value: 'lanche', label: 'Lanche' },
];

const suggestedMeals = ['Cafe da manha', 'Almoco', 'Lanche', 'Jantar', 'Ceia'];

// Ícone visual por alérgeno (correspondência por palavra-chave; fallback ⚠️)
function allergenIcon(name: string): string {
  const n = name.toLowerCase();
  if (n.includes('glúten') || n.includes('gluten') || n.includes('trigo') || n.includes('centeio') || n.includes('cevada')) return '🌾';
  if (n.includes('leite') || n.includes('lácteo') || n.includes('lacteo')) return '🥛';
  if (n.includes('ovo')) return '🥚';
  if (n.includes('soja')) return '🫘';
  if (n.includes('peixe') || n.includes('pescado')) return '🐟';
  if (n.includes('crustáceo') || n.includes('crustaceo') || n.includes('camarão')) return '🦐';
  if (n.includes('amendoim')) return '🥜';
  if (n.includes('castanha') || n.includes('noz') || n.includes('amêndoa') || n.includes('amendoa')) return '🌰';
  if (n.includes('gergelim')) return '◦';
  return '⚠️';
}

// Etapas de ensino para porção de referência (mesmos fatores da replicação de cardápio)
const ETAPA_ORDER: (keyof typeof SUGGESTED_FACTORS)[] = ['Creche', 'Ensino Infantil', 'Fundamental 1', 'Fundamental 2', 'Médio', 'EJA'];

// ── helper: footer em todas as páginas do doc ────────────────────────────────
function addFooterAllPages(doc: jsPDF, signerLabel = 'Nutricionista RT — PNAE'): void {
  const pw = doc.internal.pageSize.getWidth();
  const ph = doc.internal.pageSize.getHeight();
  const totalPages = (doc as any).getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    doc.setDrawColor(22, 101, 52);
    doc.setLineWidth(0.3);
    doc.line(10, ph - 12, pw - 10, ph - 12);
    doc.setFontSize(7);
    doc.setTextColor(100, 100, 100);
    doc.text(signerLabel, 15, ph - 7);
    doc.text(`Pág. ${p}/${totalPages}`, pw - 15, ph - 7, { align: 'right' });
  }
}

// ── helper: escreve o conteúdo de UMA receita na página ativa do doc ─────────
async function addRecipeToDoc(doc: jsPDF, recipe: Recipe): Promise<void> {
  const pw = doc.internal.pageSize.getWidth();
  const ph = doc.internal.pageSize.getHeight();

  let y = await addPdfHeader(doc, {
    title: 'FICHA TÉCNICA DE PREPARO',
    subtitle: 'PNAE — Gestão de Nutrição Escolar',
  });

  // Recipe name + classification
  doc.setTextColor(22, 101, 52);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text(recipe.displayName || recipe.name, pw / 2, y, { align: 'center' });
  y += 7;
  if (recipe.displayName && recipe.displayName !== recipe.name) {
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(80, 80, 80);
    doc.text(recipe.name, pw / 2, y, { align: 'center' });
    y += 6;
  }

  // Meta info table
  const metaRows = [
    ['Classificação', recipe.classification, 'Refeição', recipe.recommendedMeal || '—'],
    ['Nº de Porções', String(recipe.servings), 'Tempo de Preparo', recipe.prepTime || '—'],
    ['Rendimento Total', `${recipe.yieldTotal?.toFixed(3) || '—'} kg`, 'Rendimento Líquido', `${recipe.yieldPercentage.toFixed(1)}%`],
    ['Peso Bruto Total', `${recipe.totalGrossWeight.toFixed(3)} kg`, 'Peso Líquido Total', `${recipe.totalNetWeight.toFixed(3)} kg`],
    ['Per Capita', `${recipe.perCapita.toFixed(3)} kg`, 'Custo por Porção', `R$ ${recipe.costPerServing.toFixed(2)}`],
    ['Medida Caseira', recipe.medidaCaseira || '—', 'Agricultura Familiar', recipe.usesFamilyFarm ? 'Sim' : 'Não'],
    ['Alérgenos', recipe.allergens.length > 0 ? recipe.allergens.join(', ') : 'Nenhum', '', ''],
  ];

  autoTable(doc, {
    startY: y + 4,
    body: metaRows,
    theme: 'grid',
    styles: { fontSize: 8, cellPadding: 2.5 },
    columnStyles: {
      0: { fontStyle: 'bold', fillColor: [240, 253, 244], cellWidth: 40 },
      1: { cellWidth: 55 },
      2: { fontStyle: 'bold', fillColor: [240, 253, 244], cellWidth: 40 },
      3: { cellWidth: 55 },
    },
  });
  y = (doc as any).lastAutoTable.finalY + 8;

  // Ingredients
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(22, 101, 52);
  doc.text('INGREDIENTES', 15, y);
  y += 3;

  const ingRows = recipe.ingredients.map(ing => [
    ing.foodName,
    `${ing.grossWeight.toFixed(3)} kg`,
    `${ing.netWeight.toFixed(3)} kg`,
    ing.correctionFactor > 0 ? ing.correctionFactor.toFixed(2) : '—',
    `R$ ${ing.estimatedCost.toFixed(2)}`,
  ]);

  autoTable(doc, {
    startY: y,
    head: [['Ingrediente', 'Peso Bruto (kg)', 'Peso Líquido (kg)', 'F.C.', 'Custo']],
    body: ingRows,
    theme: 'striped',
    headStyles: { fillColor: [22, 101, 52], textColor: 255, fontSize: 8, fontStyle: 'bold' },
    bodyStyles: { fontSize: 8 },
    foot: [['Total', `${recipe.totalGrossWeight.toFixed(3)} kg`, `${recipe.totalNetWeight.toFixed(3)} kg`, '', `R$ ${recipe.costTotal.toFixed(2)}`]],
    footStyles: { fillColor: [240, 253, 244], fontStyle: 'bold', fontSize: 8 },
  });
  y = (doc as any).lastAutoTable.finalY + 8;

  // Nutrients
  if (y > ph - 60) { doc.addPage(); y = 15; }
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(22, 101, 52);
  doc.text('INFORMAÇÃO NUTRICIONAL (por porção)', 15, y);
  y += 3;

  const n = recipe.nutrientsPerServing;
  const nutRows = [
    ['Energia', `${n.kcal.toFixed(0)} kcal`, 'Proteínas', `${n.protein.toFixed(1)} g`],
    ['Lipídeos', `${n.lipids.toFixed(1)} g`, 'Carboidratos', `${n.carbohydrates.toFixed(1)} g`],
    ['Fibras', `${n.fiber.toFixed(1)} g`, 'Cálcio', `${n.calcium.toFixed(1)} mg`],
    ['Ferro', `${n.iron.toFixed(1)} mg`, 'Zinco', `${n.zinc.toFixed(1)} mg`],
    ['Vitamina A', `${n.vitaminA.toFixed(0)} µg`, 'Vitamina C', `${n.vitaminC.toFixed(1)} mg`],
  ];

  autoTable(doc, {
    startY: y,
    body: nutRows,
    theme: 'grid',
    styles: { fontSize: 8, cellPadding: 2.5 },
    columnStyles: {
      0: { fontStyle: 'bold', fillColor: [240, 253, 244], cellWidth: 40 },
      1: { cellWidth: 55 },
      2: { fontStyle: 'bold', fillColor: [240, 253, 244], cellWidth: 40 },
      3: { cellWidth: 55 },
    },
  });
  y = (doc as any).lastAutoTable.finalY + 8;

  // Adequação à referência PNAE (por porção)
  if (y > ph - 50) { doc.addPage(); y = 15; }
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(22, 101, 52);
  doc.text('ADEQUAÇÃO NUTRICIONAL (% da referência por refeição)', 15, y);
  y += 3;
  const adqRows = FNDE_MEAL_REFERENCE.map((it) => {
    const perServ = (n as any)[it.key] as number;
    const pct = adequacyPercent(perServ ?? 0, it.ref);
    return [
      it.label,
      `${(perServ ?? 0).toFixed(it.dec)} ${it.unit}`,
      `${it.ref} ${it.unit}`,
      `${pct}%`,
    ];
  });
  autoTable(doc, {
    startY: y,
    head: [['Nutriente', 'Por porção', 'Referência', 'Adequação']],
    body: adqRows,
    theme: 'striped',
    headStyles: { fillColor: [22, 101, 52], textColor: 255, fontSize: 8, fontStyle: 'bold' },
    bodyStyles: { fontSize: 8 },
    columnStyles: { 3: { fontStyle: 'bold', halign: 'right' } },
  });
  y = (doc as any).lastAutoTable.finalY + 4;
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(6.5);
  doc.setTextColor(120, 120, 120);
  const refNote = doc.splitTextToSize(FNDE_REFERENCE_NOTE, pw - 30);
  doc.text(refNote, 15, y);
  y += refNote.length * 3 + 5;

  // Helper: renders wrapped text line-by-line, adding new pages as needed.
  // Returns the final Y after the last line.
  const lineH    = 5;           // line height in mm for fontSize 9
  const marginB  = 20;          // bottom margin — keep above footer
  const renderTextBlock = (lines: string[]): void => {
    for (const line of lines) {
      if (y > ph - marginB) {
        doc.addPage();
        y = 15;
      }
      doc.text(line, 15, y);
      y += lineH;
    }
  };

  // Preparation method
  if (recipe.preparationMethod) {
    if (y > ph - marginB) { doc.addPage(); y = 15; }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(22, 101, 52);
    doc.text('MODO DE PREPARO', 15, y);
    y += 7;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(40, 40, 40);
    const prepLines = doc.splitTextToSize(recipe.preparationMethod, pw - 30);
    renderTextBlock(prepLines);
    y += 4;
  }

  // Operational notes
  if (recipe.operationalNotes) {
    if (y > ph - marginB) { doc.addPage(); y = 15; }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(22, 101, 52);
    doc.text('OBSERVAÇÕES OPERACIONAIS', 15, y);
    y += 6;
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(80, 80, 80);
    const noteLines = doc.splitTextToSize(recipe.operationalNotes, pw - 30);
    renderTextBlock(noteLines);
  }

}  // end addRecipeToDoc

// ── exporta UMA ficha técnica ─────────────────────────────────────────────────
async function generateRecipePDF(recipe: Recipe, signerLabel?: string) {
  const doc = new jsPDF();
  await addRecipeToDoc(doc, recipe);
  addFooterAllPages(doc, signerLabel);
  doc.save(`FichaTecnica_${(recipe.displayName || recipe.name).replace(/\s+/g, '_')}.pdf`);
  toast.success('Ficha técnica exportada!');
}

// ── exporta TODAS as fichas em um único PDF ───────────────────────────────────
async function generateAllRecipesPDF(recipes: Recipe[], signerLabel?: string) {
  if (!recipes.length) { toast.error('Nenhuma ficha técnica cadastrada.'); return; }
  const doc = new jsPDF();
  for (let i = 0; i < recipes.length; i++) {
    if (i > 0) doc.addPage();
    await addRecipeToDoc(doc, recipes[i]);
  }
  addFooterAllPages(doc, signerLabel);
  doc.save('FichasTecnicas_Todas.pdf');
  toast.success(`${recipes.length} fichas técnicas exportadas em um único PDF!`);
}

export default function Recipes() {
  const { user } = useAuth();
  const orgId = user?.organizationId || 'pnae-default-org';
  const signerLabel = useMemo(() => {
    try {
      const raw = localStorage.getItem(`pnae_sigpc_entity_config_${orgId}`)
        || localStorage.getItem('pnae_sigpc_entity_config');
      if (raw) {
        const cfg = JSON.parse(raw);
        if (cfg.nutricionista) return `${cfg.nutricionista}${cfg.crn ? ` — ${cfg.crn}` : ''} — Nutricionista RT PNAE`;
      }
    } catch (_) {}
    return 'Nutricionista RT — PNAE';
  }, [orgId]);
  const { foods, loading: foodsLoading } = useFoods();
  const { recipes, loading, addRecipe, updateRecipe, deleteRecipe } = useRecipes();
  const [open, setOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'cards' | 'list'>('list');
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  // ── Match a default recipe ingredient to a real food by name ────────────────
  const enrichWithRealFoods = useMemo(() => (recipe: typeof DEFAULT_RECIPES[0]) => {
    if (!foods.length) return recipe;
    const enrichedIngredients = recipe.ingredients.map((ing) => {
      const n = ing.foodName.toLowerCase().trim();
      // Try exact → starts-with → contains match
      const matched =
        foods.find((f) => f.name.toLowerCase() === n) ||
        foods.find((f) => f.name.toLowerCase().startsWith(n) || n.startsWith(f.name.toLowerCase().split(',')[0].trim())) ||
        foods.find((f) => f.name.toLowerCase().includes(n) || n.split(' ').every((w) => f.name.toLowerCase().includes(w)));
      if (!matched) return ing;
      return {
        ...ing,
        foodId: matched.id,
        estimatedCost:
          matched.unit === 'unit'
            ? matched.price * (ing.grossWeight / 0.1)
            : matched.price * ing.grossWeight,
      };
    });
    return { ...recipe, ingredients: enrichedIngredients };
  }, [foods]);

  // Auto-seed removido — fichas são criadas manualmente pela nutricionista.
  // ── One-time cleanup: remove all seeded default recipes ──────────────────────
  const CLEANUP_FLAG = `pnae_defaults_removed_${orgId}`;
  useEffect(() => {
    if (loading) return;
    if (!orgId || orgId === 'pnae-default-org') return;
    if (localStorage.getItem(CLEANUP_FLAG)) return;
    if (!recipes.length) return;

    const defaultNameSet = new Set(DEFAULT_RECIPES.map((r) => r.name.toLowerCase()));
    const toDelete = recipes.filter((r) => defaultNameSet.has(r.name.toLowerCase()));
    if (toDelete.length === 0) {
      localStorage.setItem(CLEANUP_FLAG, '1');
      return;
    }
    (async () => {
      for (const r of toDelete) {
        deleteRecipe(r.id);
        await new Promise((res) => setTimeout(res, 20));
      }
      localStorage.setItem(CLEANUP_FLAG, '1');
      if (toDelete.length > 0) {
        toast.info(`${toDelete.length} ficha${toDelete.length !== 1 ? 's' : ''} padrão removida${toDelete.length !== 1 ? 's' : ''}.`);
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, orgId, recipes.length]);

  const [recalculating, setRecalculating] = useState(false);

  // ── Recalculate nutrients for ALL existing recipes from their ingredients ────
  const recipesWithZeroNutrients = useMemo(
    () => recipes.filter((r) => r.ingredients.length > 0 && r.nutrientsPerServing.kcal === 0),
    [recipes],
  );

  const recalcAllRecipes = async () => {
    if (!foods.length || !recipesWithZeroNutrients.length) return;
    setRecalculating(true);
    let updated = 0;
    for (const recipe of recipesWithZeroNutrients) {
      const t = recipe.ingredients.reduce(
        (acc, ing) => {
          const food =
            foods.find((f) => f.id === ing.foodId) ||
            foods.find((f) => f.name.toLowerCase().trim() === ing.foodName.toLowerCase().trim()) ||
            foods.find((f) => f.name.toLowerCase().includes(ing.foodName.toLowerCase().split(',')[0].trim()));
          if (!food) return acc;
          const factor = ing.netWeight > 0 ? ing.netWeight * 10 : ing.grossWeight * 10;
          const cost =
            food.price > 0
              ? food.unit === 'unit'
                ? food.price * (ing.grossWeight / 0.1)
                : food.price * ing.grossWeight
              : ing.estimatedCost;
          return {
            costTotal: acc.costTotal + cost,
            kcal: acc.kcal + food.nutrients.kcal * factor,
            protein: acc.protein + food.nutrients.protein * factor,
            lipids: acc.lipids + food.nutrients.lipids * factor,
            carbohydrates: acc.carbohydrates + food.nutrients.carbohydrates * factor,
            fiber: acc.fiber + food.nutrients.fiber * factor,
            calcium: acc.calcium + food.nutrients.calcium * factor,
            iron: acc.iron + food.nutrients.iron * factor,
            zinc: acc.zinc + food.nutrients.zinc * factor,
            vitaminA: acc.vitaminA + food.nutrients.vitaminA * factor,
            vitaminC: acc.vitaminC + food.nutrients.vitaminC * factor,
          };
        },
        { costTotal: 0, kcal: 0, protein: 0, lipids: 0, carbohydrates: 0, fiber: 0, calcium: 0, iron: 0, zinc: 0, vitaminA: 0, vitaminC: 0 },
      );
      const s = recipe.servings || 1;
      updateRecipe(recipe.id, {
        costTotal: t.costTotal,
        costPerServing: t.costTotal / s,
        nutrientsPerServing: {
          kcal: t.kcal / s,
          protein: t.protein / s,
          lipids: t.lipids / s,
          carbohydrates: t.carbohydrates / s,
          fiber: t.fiber / s,
          calcium: t.calcium / s,
          iron: t.iron / s,
          zinc: t.zinc / s,
          vitaminA: t.vitaminA / s,
          vitaminC: t.vitaminC / s,
        },
      });
      updated++;
      await new Promise((res) => setTimeout(res, 30));
    }
    toast.success(`${updated} ficha${updated !== 1 ? 's' : ''} atualizada${updated !== 1 ? 's' : ''} com dados nutricionais!`);
    setRecalculating(false);
  };

  const [editingRecipeId, setEditingRecipeId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [classification, setClassification] = useState<RecipeClassification>('principal');
  const [recommendedMeal, setRecommendedMeal] = useState('Almoco');
  const [servings, setServings] = useState('');
  const [prepTime, setPrepTime] = useState('');
  const [operationalNotes, setOperationalNotes] = useState('');
  const [preparationMethod, setPreparationMethod] = useState('');
  const [medidaCaseira, setMedidaCaseira] = useState('');
  const [ingredientSearch, setIngredientSearch] = useState('');
  const [ingredients, setIngredients] = useState<RecipeIngredient[]>([]);
  const [perCapitaTarget, setPerCapitaTarget] = useState('');

  // ── Gallery filters ───────────────────────────────────────────────────────────
  const [gallerySearch,         setGallerySearch]         = useState('');
  const [galleryClassification, setGalleryClassification] = useState('');
  const [galleryMeal,           setGalleryMeal]           = useState('');
  const [gallerySort,           setGallerySort]           = useState<'alpha' | 'newest' | 'oldest'>('alpha');

  const filteredRecipes = useMemo(() => {
    const term = gallerySearch.toLowerCase().trim();
    let list = recipes.filter((r) => {
      if (term) {
        const hay = `${r.name} ${r.displayName ?? ''} ${r.allergens.join(' ')} ${r.classification}`.toLowerCase();
        if (!hay.includes(term)) return false;
      }
      if (galleryClassification && r.classification !== galleryClassification) return false;
      if (galleryMeal && r.recommendedMeal !== galleryMeal) return false;
      return true;
    });

    list = [...list].sort((a, b) => {
      if (gallerySort === 'alpha')  return (a.displayName || a.name).localeCompare(b.displayName || b.name, 'pt-BR');
      const tA = a.updatedAt instanceof Date ? a.updatedAt.getTime() : 0;
      const tB = b.updatedAt instanceof Date ? b.updatedAt.getTime() : 0;
      return gallerySort === 'newest' ? tB - tA : tA - tB;
    });

    return list;
  }, [recipes, gallerySearch, galleryClassification, galleryMeal, gallerySort]);

  const searchResults = useMemo(() => {
    const term = ingredientSearch.toLowerCase().trim();
    if (term.length < 2) return [];
    return foods.filter((food) => food.name.toLowerCase().includes(term)).slice(0, 8);
  }, [foods, ingredientSearch]);

  const addIngredient = (food: Food) => {
    const fc = getDefaultCorrectionFactor(food.id);
    setIngredients((prev) => [
      ...prev,
      {
        id: `ingredient-${crypto.randomUUID()}`,
        foodId: food.id,
        foodName: food.name,
        grossWeight: 0,
        netWeight: 0,
        // Pre-fill FC from TACO lookup so net weight auto-calculates on first gross entry
        correctionFactor: fc,
        estimatedCost: 0,
      },
    ]);
    setIngredientSearch('');
  };

  // All weights stored in kg (not grams). FC = grossWeight / netWeight.
  // When grossWeight changes: if FC is known, auto-compute netWeight = gross / FC.
  // When FC changes: if gross is set, auto-compute netWeight.
  // When netWeight is edited manually: recalculate FC from gross/net.
  const updateIngredient = (
    ingredientId: string,
    field: 'grossWeight' | 'netWeight' | 'correctionFactor',
    value: number,
  ) => {
    setIngredients((prev) =>
      prev.map((ingredient) => {
        if (ingredient.id !== ingredientId) return ingredient;

        const updated = { ...ingredient, [field]: value };
        let { grossWeight, netWeight, correctionFactor } = updated;

        if (field === 'grossWeight' && grossWeight > 0) {
          if (correctionFactor > 0) {
            // FC known → auto-compute net weight
            netWeight = Number((grossWeight / correctionFactor).toFixed(4));
          } else if (netWeight > 0) {
            // Net was already set → update FC
            correctionFactor = Number((grossWeight / netWeight).toFixed(2));
          }
        } else if (field === 'netWeight') {
          // Manual net edit → recalculate FC
          if (netWeight > 0 && grossWeight > 0) {
            correctionFactor = Number((grossWeight / netWeight).toFixed(2));
          }
        } else if (field === 'correctionFactor' && correctionFactor > 0 && grossWeight > 0) {
          // FC changed → auto-compute net weight
          netWeight = Number((grossWeight / correctionFactor).toFixed(4));
        }

        const food = foods.find((item) => item.id === ingredient.foodId)
          || foods.find((item) => item.name.toLowerCase().trim() === ingredient.foodName.toLowerCase().trim());
        // Auto-calc cost from food price; preserve manual cost if food not found
        let estimatedCost = ingredient.estimatedCost;
        if (food && food.price > 0) {
          estimatedCost =
            food.unit === 'unit'
              ? food.price * (grossWeight / 0.1)
              : food.price * grossWeight;
        }

        return { ...updated, grossWeight, netWeight, correctionFactor, estimatedCost };
      }),
    );
  };

  const updateIngredientCost = (ingredientId: string, value: number) => {
    setIngredients((prev) =>
      prev.map((ing) => ing.id === ingredientId ? { ...ing, estimatedCost: value } : ing),
    );
  };

  const removeIngredient = (ingredientId: string) => {
    setIngredients((prev) => prev.filter((ingredient) => ingredient.id !== ingredientId));
  };

  const totals = useMemo(() => {
    return ingredients.reduce(
      (acc, ingredient) => {
        // Primary lookup by ID; fallback to name match for default/seeded recipes
        const food = foods.find((item) => item.id === ingredient.foodId)
          || foods.find((item) => item.name.toLowerCase().trim() === ingredient.foodName.toLowerCase().trim());
        if (!food) return acc;

        // netWeight is in kg; nutrients are per 100g (= 0.1 kg) → multiply by 10
        const factor = ingredient.netWeight > 0 ? ingredient.netWeight * 10 : 0;
        // Detect allergens from food name (TACO has no allergen data)
        const allergens = detectAllergens(ingredient.foodName);

        return {
          costTotal: acc.costTotal + ingredient.estimatedCost,
          totalGrossWeight: acc.totalGrossWeight + ingredient.grossWeight,
          totalNetWeight: acc.totalNetWeight + ingredient.netWeight,
          familyFarmCount: acc.familyFarmCount + (food.familyFarm ? 1 : 0),
          allergens: new Set([...Array.from(acc.allergens), ...allergens]),
          nutrients: {
            kcal: acc.nutrients.kcal + food.nutrients.kcal * factor,
            protein: acc.nutrients.protein + food.nutrients.protein * factor,
            lipids: acc.nutrients.lipids + food.nutrients.lipids * factor,
            carbohydrates: acc.nutrients.carbohydrates + food.nutrients.carbohydrates * factor,
            fiber: acc.nutrients.fiber + food.nutrients.fiber * factor,
            calcium: acc.nutrients.calcium + food.nutrients.calcium * factor,
            iron: acc.nutrients.iron + food.nutrients.iron * factor,
            zinc: acc.nutrients.zinc + food.nutrients.zinc * factor,
            vitaminA: acc.nutrients.vitaminA + food.nutrients.vitaminA * factor,
            vitaminC: acc.nutrients.vitaminC + food.nutrients.vitaminC * factor,
          },
        };
      },
      {
        costTotal: 0,
        totalGrossWeight: 0,
        totalNetWeight: 0,
        familyFarmCount: 0,
        allergens: new Set<string>(),
        nutrients: { ...emptyNutrients },
      },
    );
  }, [foods, ingredients]);

  const servingsCount = Number(servings) || 1;
  const perCapita = totals.totalNetWeight > 0 ? totals.totalNetWeight / servingsCount : 0;
  const yieldPercentage = totals.totalGrossWeight > 0 ? (totals.totalNetWeight / totals.totalGrossWeight) * 100 : 0;
  const usesFamilyFarm = totals.familyFarmCount > 0;
  const allergenSummary = Array.from(totals.allergens).sort();

  const resetForm = () => {
    setName('');
    setDisplayName('');
    setClassification('principal');
    setRecommendedMeal('Almoco');
    setServings('');
    setPerCapitaTarget('');
    setPrepTime('');
    setOperationalNotes('');
    setPreparationMethod('');
    setMedidaCaseira('');
    setIngredientSearch('');
    setIngredients([]);
    setEditingRecipeId(null);
  };

  const openEditRecipe = (recipe: Recipe) => {
    setEditingRecipeId(recipe.id);
    setName(recipe.name);
    setDisplayName(recipe.displayName || '');
    setClassification(recipe.classification);
    setRecommendedMeal(recipe.recommendedMeal || 'Almoco');
    setPrepTime(recipe.prepTime || '');
    setOperationalNotes(recipe.operationalNotes || '');
    setPreparationMethod(recipe.preparationMethod || '');
    setMedidaCaseira(recipe.medidaCaseira || '');
    setIngredientSearch('');

    // Migrate ingredients that may have been saved with gram-scale values
    // (old system stored weights in grams; new system uses kg).
    // Heuristic: if any ingredient's grossWeight > 500, it's almost certainly grams.
    const ings = recipe.ingredients ?? [];
    const maxGross = Math.max(...ings.map((i) => i.grossWeight ?? 0), 0);
    const needsMigration = maxGross > 500;
    const migratedIngs = needsMigration
      ? ings.map((ing) => ({
          ...ing,
          grossWeight: Number((ing.grossWeight / 1000).toFixed(4)),
          netWeight:   Number((ing.netWeight   / 1000).toFixed(4)),
        }))
      : ings;
    setIngredients(migratedIngs);

    // Per capita: if the stored value looks like it was in grams (> 10), convert
    const storedPc = recipe.perCapita ?? 0;
    const pc = storedPc > 10 ? storedPc / 1000 : storedPc;
    setPerCapitaTarget(pc > 0 ? String(pc) : '');

    // Servings: recalculate from net weight ÷ per capita to avoid corrupted stored values
    // (totalNetWeight after migration, not before)
    const netTotal = migratedIngs.reduce((s, i) => s + (i.netWeight ?? 0), 0);
    const safePc = pc > 0 ? pc : storedPc > 0 ? storedPc : 0;
    if (safePc > 0 && netTotal > 0) {
      setServings(String(Math.round(netTotal / safePc)));
    } else {
      setServings(String(recipe.servings));
    }

    setOpen(true);
  };

  const handleSave = () => {
    if (!name.trim()) {
      toast.error('Informe o nome da preparação.');
      return;
    }

    if (ingredients.length === 0) {
      toast.error('Adicione pelo menos um ingrediente.');
      return;
    }

    if (servingsCount <= 0) {
      toast.error('Informe o numero de porcoes.');
      return;
    }

    // Warn but don't block if net weight is missing (may happen with older recipes)
    if (totals.totalNetWeight <= 0) {
      toast.warning('Atenção: peso líquido zerado. Preencha o peso bruto dos ingredientes.');
    }

    if (!preparationMethod.trim() && !editingRecipeId) {
      toast.error('Descreva o modo de preparo.');
      return;
    }

    const payload = {
      name,
      displayName,
      classification,
      recommendedMeal,
      yieldTotal: totals.totalNetWeight,
      servings: servingsCount,
      totalGrossWeight: totals.totalGrossWeight,
      totalNetWeight: totals.totalNetWeight,
      perCapita,
      yieldPercentage,
      usesFamilyFarm,
      allergens: allergenSummary,
      prepTime,
      preparationMethod,
      operationalNotes,
      medidaCaseira,
      costTotal: totals.costTotal,
      costPerServing: totals.costTotal / servingsCount,
      nutrientsPerServing: {
        kcal: totals.nutrients.kcal / servingsCount,
        protein: totals.nutrients.protein / servingsCount,
        lipids: totals.nutrients.lipids / servingsCount,
        carbohydrates: totals.nutrients.carbohydrates / servingsCount,
        fiber: totals.nutrients.fiber / servingsCount,
        calcium: totals.nutrients.calcium / servingsCount,
        iron: totals.nutrients.iron / servingsCount,
        zinc: totals.nutrients.zinc / servingsCount,
        vitaminA: totals.nutrients.vitaminA / servingsCount,
        vitaminC: totals.nutrients.vitaminC / servingsCount,
      },
      ingredients,
    };

    if (editingRecipeId) {
      updateRecipe(editingRecipeId, payload);
      toast.success('Ficha técnica atualizada com sucesso.');
    } else {
      addRecipe(payload);
      toast.success('Ficha técnica salva com sucesso.');
    }

    resetForm();
    setOpen(false);
  };

  const handleDuplicate = (recipe: Recipe) => {
    const { id, createdAt, updatedAt, ...rest } = recipe;
    void id; void createdAt; void updatedAt;
    addRecipe({
      ...rest,
      name: `${recipe.name} (cópia)`,
      displayName: recipe.displayName ? `${recipe.displayName} (cópia)` : '',
    });
    toast.success('Ficha duplicada — edite a cópia conforme necessário.');
  };

  return (
    <div className="min-h-screen flex-1 p-4 md:p-8">
      <div className="w-full space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Fichas Tecnicas</h1>
            <p className="mt-2 text-gray-600">
              Padronizacao de preparos com rendimento, per capita, alergenicos e indicadores operacionais.
            </p>
          </div>

          <div className="flex gap-2 flex-wrap items-center">
            {/* View mode toggle */}
            <div className="flex rounded-md border border-gray-200 overflow-hidden">
              <button
                type="button"
                onClick={() => setViewMode('cards')}
                className={`px-2.5 py-1.5 text-sm flex items-center gap-1 transition-colors ${viewMode === 'cards' ? 'bg-gray-900 text-white' : 'bg-white text-gray-500 hover:bg-gray-50'}`}
                title="Visualização em cards"
              >
                <LayoutGrid className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setViewMode('list')}
                className={`px-2.5 py-1.5 text-sm flex items-center gap-1 transition-colors border-l border-gray-200 ${viewMode === 'list' ? 'bg-gray-900 text-white' : 'bg-white text-gray-500 hover:bg-gray-50'}`}
                title="Visualização em lista"
              >
                <List className="h-4 w-4" />
              </button>
            </div>
            {recipes.length > 0 && (
              <Button
                variant="outline"
                onClick={() =>
                  generateAllRecipesPDF(recipes, signerLabel).catch(() => toast.error('Erro ao gerar PDF.'))
                }
                className="border-blue-300 text-blue-700 hover:bg-blue-50"
              >
                <PrinterCheck className="mr-2 h-4 w-4" />
                Imprimir Todas ({recipes.length})
              </Button>
            )}
          <Dialog open={open} onOpenChange={(v) => { if (!v) resetForm(); setOpen(v); }}>
            <DialogTrigger asChild>
              <Button className="bg-blue-600 hover:bg-blue-700">
                <Plus className="mr-2 h-4 w-4" />
                Nova Ficha
              </Button>
            </DialogTrigger>
            <DialogContent className="w-full max-w-[95vw] sm:max-w-5xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingRecipeId ? 'Editar Ficha Técnica' : 'Nova Ficha Técnica'}</DialogTitle>
                <DialogDescription>
                  Monte a preparação com base nos alimentos cadastrados e acompanhe indicadores úteis para o PNAE.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-6">
                <div>
                  <Label>Nome da preparação</Label>
                  <Input value={name} onChange={(e) => setName(e.target.value)} className="mt-2 max-w-xl" />
                </div>

                <div className="grid gap-4 md:grid-cols-4">
                  <div>
                    <Label>Classificacao</Label>
                    <Select value={classification} onValueChange={(value) => setClassification(value as RecipeClassification)}>
                      <SelectTrigger className="mt-2">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {recipeClassifications.map((item) => (
                          <SelectItem key={item.value} value={item.value}>
                            {item.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Refeicao recomendada</Label>
                    <Select value={recommendedMeal} onValueChange={setRecommendedMeal}>
                      <SelectTrigger className="mt-2">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {suggestedMeals.map((meal) => (
                          <SelectItem key={meal} value={meal}>
                            {meal}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Per capita desejado (kg)</Label>
                    <Input
                      type="number"
                      value={perCapitaTarget}
                      onChange={(e) => {
                        setPerCapitaTarget(e.target.value);
                        const pc = Number(e.target.value);
                        if (pc > 0 && totals.totalNetWeight > 0) {
                          setServings(String(Math.round(totals.totalNetWeight / pc)));
                        }
                      }}
                      className="mt-2"
                      step="0.001"
                      placeholder="Ex.: 0.100"
                    />
                  </div>
                  <div>
                    <Label>Numero de porcoes</Label>
                    <Input
                      type="number"
                      value={servings}
                      onChange={(e) => setServings(e.target.value)}
                      className="mt-2"
                    />
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <Label>Tempo de preparo</Label>
                    <Input value={prepTime} onChange={(e) => setPrepTime(e.target.value)} className="mt-2" />
                  </div>
                  <div>
                    <Label>Observacoes operacionais</Label>
                    <Input
                      value={operationalNotes}
                      onChange={(e) => setOperationalNotes(e.target.value)}
                      className="mt-2"
                      placeholder="Ex.: servir quente, usar cuba GN, bater no liquidificador..."
                    />
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <Label>Medida caseira da porção</Label>
                    <Input
                      value={medidaCaseira}
                      onChange={(e) => setMedidaCaseira(e.target.value)}
                      className="mt-2"
                      placeholder="Ex.: 1 concha média, 2 colheres de servir"
                    />
                  </div>
                </div>

                <div>
                  <Label>Buscar ingrediente</Label>
                  <div className="relative mt-2 max-w-xl">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                    <Input
                      value={ingredientSearch}
                      onChange={(e) => setIngredientSearch(e.target.value)}
                      placeholder="Digite pelo menos 2 letras do alimento..."
                      className="pl-9"
                    />
                  </div>

                  {searchResults.length > 0 ? (
                    <div className="mt-2 max-w-xl overflow-hidden rounded-lg border bg-white">
                      {searchResults.map((food) => (
                        <button
                          key={food.id}
                          type="button"
                          onClick={() => addIngredient(food)}
                          className="w-full border-b px-3 py-2 text-left text-sm hover:bg-blue-50 last:border-b-0"
                        >
                          {food.name}
                          <span className="text-gray-500"> - {food.nutrients.kcal} kcal/100g</span>
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>

                {ingredients.length > 0 ? (
                  <Card>
                    <CardHeader>
                      <CardTitle>Ingredientes</CardTitle>
                      <CardDescription>
                        Insira o peso bruto (kg). O fator de correção é pré-preenchido da TACO — ajuste se necessário. O peso líquido é calculado automaticamente.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="p-0">
                      <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Ingrediente</TableHead>
                            <TableHead className="text-right">Peso bruto (kg)</TableHead>
                            <TableHead className="text-right">FC</TableHead>
                            <TableHead className="text-right">Peso líquido (kg)</TableHead>
                            <TableHead className="text-right">Custo</TableHead>
                            <TableHead className="text-right">Ação</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {ingredients.map((ingredient) => (
                            <TableRow key={ingredient.id}>
                              <TableCell className="font-medium text-sm">{ingredient.foodName}</TableCell>
                              <TableCell className="text-right">
                                <Input
                                  type="number"
                                  value={ingredient.grossWeight || ''}
                                  onChange={(e) => updateIngredient(ingredient.id, 'grossWeight', Number(e.target.value))}
                                  className="ml-auto w-28 text-right"
                                  step="0.001"
                                  min="0"
                                  placeholder="0.000"
                                />
                              </TableCell>
                              <TableCell className="text-right">
                                <Input
                                  type="number"
                                  value={ingredient.correctionFactor || ''}
                                  onChange={(e) => updateIngredient(ingredient.id, 'correctionFactor', Number(e.target.value))}
                                  className="ml-auto w-20 text-right"
                                  step="0.01"
                                  min="1"
                                  placeholder="1.00"
                                  title="Fator de Correção — pré-preenchido da TACO. Edite se necessário."
                                />
                              </TableCell>
                              <TableCell className="text-right">
                                <Input
                                  type="number"
                                  value={ingredient.netWeight || ''}
                                  onChange={(e) => updateIngredient(ingredient.id, 'netWeight', Number(e.target.value))}
                                  className="ml-auto w-28 text-right"
                                  step="0.001"
                                  min="0"
                                  placeholder="auto"
                                  title="Preenchido automaticamente (bruto ÷ FC). Edite para ajuste manual."
                                />
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="flex items-center justify-end gap-1">
                                  <span className="text-xs text-gray-500">R$</span>
                                  <Input
                                    type="number"
                                    value={ingredient.estimatedCost || ''}
                                    onChange={(e) => updateIngredientCost(ingredient.id, Number(e.target.value))}
                                    className="ml-auto w-24 text-right"
                                    step="0.01"
                                    min="0"
                                    placeholder="0.00"
                                    title="Custo total deste ingrediente (R$). Preenchido automaticamente se o alimento tiver preço cadastrado."
                                  />
                                </div>
                              </TableCell>
                              <TableCell className="text-right">
                                <button onClick={() => removeIngredient(ingredient.id)} className="text-red-600 hover:text-red-700">
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                      </div>
                    </CardContent>
                  </Card>
                ) : null}

                {ingredients.length > 0 ? (
                  <div className="grid gap-4 md:grid-cols-3 md:grid-rows-[auto] grid-rows-1">
                    <Card>
                      <CardHeader>
                        <CardTitle>Resumo de custo</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        <p className="text-sm text-gray-600">Custo total</p>
                        <p className="text-2xl font-bold text-gray-900">R$ {totals.costTotal.toFixed(2)}</p>
                        <p className="text-sm text-gray-600">
                          Custo por porcao: <span className="font-semibold">R$ {(totals.costTotal / servingsCount).toFixed(2)}</span>
                        </p>
                      </CardContent>
                    </Card>

                    <Card className="md:col-span-2">
                      <CardHeader>
                        <CardTitle>Tabela Nutricional por Porção</CardTitle>
                        <CardDescription>Porção: {(perCapita * 1000).toFixed(0)} g ({servingsCount} porções)</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="border-b border-gray-200 bg-gray-50">
                                <th className="py-1.5 px-2 text-left font-semibold text-gray-700">Nutriente</th>
                                <th className="py-1.5 px-2 text-right font-semibold text-gray-700">Por porção</th>
                                <th className="py-1.5 px-2 text-right font-semibold text-gray-700">Total receita</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                              {[
                                { label: 'Energia (kcal)', key: 'kcal', unit: 'kcal', dec: 0 },
                                { label: 'Carboidratos', key: 'carbohydrates', unit: 'g', dec: 1 },
                                { label: 'Proteínas', key: 'protein', unit: 'g', dec: 1 },
                                { label: 'Lipídeos', key: 'lipids', unit: 'g', dec: 1 },
                                { label: 'Fibra alimentar', key: 'fiber', unit: 'g', dec: 1 },
                                { label: 'Cálcio', key: 'calcium', unit: 'mg', dec: 1 },
                                { label: 'Ferro', key: 'iron', unit: 'mg', dec: 2 },
                                { label: 'Zinco', key: 'zinc', unit: 'mg', dec: 2 },
                                { label: 'Vitamina A', key: 'vitaminA', unit: 'µg', dec: 1 },
                                { label: 'Vitamina C', key: 'vitaminC', unit: 'mg', dec: 1 },
                              ].map(({ label, key, unit, dec }) => {
                                const total = totals.nutrients[key as keyof typeof totals.nutrients];
                                const perServ = servingsCount > 0 ? total / servingsCount : 0;
                                return (
                                  <tr key={key} className="hover:bg-gray-50">
                                    <td className="py-1 px-2 text-gray-700">{label}</td>
                                    <td className="py-1 px-2 text-right font-semibold text-gray-900">{perServ.toFixed(dec)} {unit}</td>
                                    <td className="py-1 px-2 text-right text-gray-500">{total.toFixed(dec)} {unit}</td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="border-blue-200 bg-blue-50">
                      <CardHeader>
                        <CardTitle>Painel PNAE</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2 text-sm text-gray-700">
                        <p>Per capita estimado: <span className="font-semibold text-gray-900">{perCapita.toFixed(3)} kg</span></p>
                        <p>Rendimento liquido: <span className="font-semibold text-gray-900">{yieldPercentage.toFixed(1)}%</span></p>
                        <p>
                          Agricultura familiar:{' '}
                          <span className={`font-semibold ${usesFamilyFarm ? 'text-green-700' : 'text-amber-700'}`}>
                            {usesFamilyFarm ? 'presente' : 'nao identificada'}
                          </span>
                        </p>
                        <p>
                          Alergenicos:{' '}
                          <span className="font-semibold text-gray-900">
                            {allergenSummary.length > 0 ? allergenSummary.join(', ') : 'nenhum informado'}
                          </span>
                        </p>
                      </CardContent>
                    </Card>
                  </div>
                ) : null}

                {ingredients.length > 0 ? (
                  <div className="grid gap-4 md:grid-cols-2">
                    {/* Adequação à referência PNAE */}
                    <Card className="border-green-200">
                      <CardHeader>
                        <CardTitle>Adequação nutricional (por porção)</CardTitle>
                        <CardDescription>{FNDE_REFERENCE_NOTE}</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-1.5">
                          {FNDE_MEAL_REFERENCE.map(({ key, label, unit, ref, dec }) => {
                            const perServ = servingsCount > 0 ? totals.nutrients[key as keyof typeof totals.nutrients] / servingsCount : 0;
                            const pct = adequacyPercent(perServ, ref);
                            const color = pct >= 100 ? 'text-green-700' : pct >= 70 ? 'text-amber-600' : 'text-red-600';
                            const barColor = pct >= 100 ? 'bg-green-500' : pct >= 70 ? 'bg-amber-400' : 'bg-red-400';
                            return (
                              <div key={key} className="text-xs">
                                <div className="flex justify-between mb-0.5">
                                  <span className="text-gray-600">{label} <span className="text-gray-400">({perServ.toFixed(dec)} {unit} / ref. {ref} {unit})</span></span>
                                  <span className={`font-semibold ${color}`}>{pct}%</span>
                                </div>
                                <div className="h-1.5 w-full rounded-full bg-gray-100 overflow-hidden">
                                  <div className={`h-full ${barColor}`} style={{ width: `${Math.min(pct, 100)}%` }} />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </CardContent>
                    </Card>

                    {/* Porções de referência por etapa */}
                    <Card className="border-blue-200">
                      <CardHeader>
                        <CardTitle>Porção de referência por etapa</CardTitle>
                        <CardDescription>Estimativa a partir do per capita base (tratado como Fundamental I). Ajuste conforme avaliação técnica.</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-1">
                          {ETAPA_ORDER.map((etapa) => {
                            const fator = SUGGESTED_FACTORS[etapa] / SUGGESTED_FACTORS['Fundamental 1'];
                            const gramas = perCapita * 1000 * fator;
                            return (
                              <div key={etapa} className="flex justify-between text-xs border-b border-gray-100 py-1">
                                <span className="text-gray-600">{etapa}</span>
                                <span className="font-medium text-gray-900">{gramas.toFixed(0)} g</span>
                              </div>
                            );
                          })}
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                ) : null}

                <div>
                  <Label>Modo de preparo</Label>
                  <Textarea
                    value={preparationMethod}
                    onChange={(e) => setPreparationMethod(e.target.value)}
                    className="mt-2 min-h-32"
                    placeholder="Descreva o passo a passo do preparo..."
                  />
                </div>

                <div className="flex justify-end gap-3">
                  <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
                  <Button onClick={handleSave} className="bg-blue-600 hover:bg-blue-700">Salvar Ficha Tecnica</Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
          </div>
        </div>

        {/* ── Banner: fichas com nutrientes zerados ────────────────────────── */}
        {!loading && recipesWithZeroNutrients.length > 0 && !foodsLoading && foods.length > 0 && (
          <div className="flex flex-wrap items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
            <span className="text-amber-700 text-sm flex-1">
              ⚠️ <strong>{recipesWithZeroNutrients.length} ficha{recipesWithZeroNutrients.length !== 1 ? 's' : ''}</strong> sem dados nutricionais — os ingredientes não foram vinculados à lista de alimentos.
            </span>
            <Button
              size="sm"
              onClick={recalcAllRecipes}
              disabled={recalculating}
              className="bg-amber-600 hover:bg-amber-700 text-white shrink-0"
            >
              {recalculating ? 'Calculando…' : '⚡ Recalcular Nutrientes'}
            </Button>
          </div>
        )}

        {/* ── Filter bar ─────────────────────────────────────────────────────── */}
        {!loading && recipes.length > 0 && (
          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <SlidersHorizontal className="h-4 w-4 text-gray-500" />
              <span className="text-sm font-semibold text-gray-700">Filtrar fichas técnicas</span>
              {(gallerySearch || galleryClassification || galleryMeal) && (
                <button
                  type="button"
                  onClick={() => { setGallerySearch(''); setGalleryClassification(''); setGalleryMeal(''); }}
                  className="ml-auto flex items-center gap-1 rounded-full border border-gray-200 px-2 py-0.5 text-xs text-gray-500 hover:bg-gray-50"
                >
                  <X className="h-3 w-3" /> Limpar
                </button>
              )}
            </div>
            <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-4">
              <div className="relative sm:col-span-2 md:col-span-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={gallerySearch}
                  onChange={(e) => setGallerySearch(e.target.value)}
                  placeholder="Buscar por nome, alérgeno…"
                  className="h-9 w-full rounded-md border border-input bg-background pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <select
                value={galleryClassification}
                onChange={(e) => setGalleryClassification(e.target.value)}
                className="h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Todas as classificações</option>
                {recipeClassifications.map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
              <select
                value={galleryMeal}
                onChange={(e) => setGalleryMeal(e.target.value)}
                className="h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Todas as refeições</option>
                {suggestedMeals.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
              <select
                value={gallerySort}
                onChange={(e) => setGallerySort(e.target.value as typeof gallerySort)}
                className="h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="alpha">A → Z</option>
                <option value="newest">Mais recentes</option>
                <option value="oldest">Mais antigas</option>
              </select>
            </div>
            <p className="mt-2 text-xs text-gray-400">
              {filteredRecipes.length} de {recipes.length} ficha{recipes.length !== 1 ? 's' : ''}
              {(gallerySearch || galleryClassification || galleryMeal) ? ' encontrada(s)' : ' no total'}
            </p>
          </div>
        )}

        {loading || recipes.length === 0 ? (
          <Card>
            <CardContent className="py-16 text-center">
              <FileText className="mx-auto mb-4 h-12 w-12 text-gray-300" />
              <p className="font-medium text-gray-600">Nenhuma ficha tecnica cadastrada.</p>
              <p className="mt-2 text-sm text-gray-500">Crie a primeira ficha para alimentar o planejamento de cardápios.</p>
            </CardContent>
          </Card>
        ) : filteredRecipes.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Search className="mx-auto mb-3 h-10 w-10 text-gray-300" />
              <p className="font-medium text-gray-600">Nenhuma ficha encontrada com esses filtros.</p>
              <button
                type="button"
                onClick={() => { setGallerySearch(''); setGalleryClassification(''); setGalleryMeal(''); }}
                className="mt-2 text-sm text-blue-600 hover:underline"
              >
                Limpar filtros
              </button>
            </CardContent>
          </Card>
        ) : viewMode === 'list' ? (
          /* ── LIST VIEW ──────────────────────────────────────────────────────── */
          <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50 text-left">
                  <th className="px-4 py-3 font-semibold text-gray-700">Preparação</th>
                  <th className="px-3 py-3 font-semibold text-gray-700 text-center hidden sm:table-cell">Porções</th>
                  <th className="px-3 py-3 font-semibold text-gray-700 text-right hidden md:table-cell">Per capita</th>
                  <th className="px-3 py-3 font-semibold text-gray-700 text-right hidden md:table-cell">Kcal/porção</th>
                  <th className="px-3 py-3 font-semibold text-gray-700 text-right hidden lg:table-cell">Ptn</th>
                  <th className="px-3 py-3 font-semibold text-gray-700 text-right hidden lg:table-cell">CHO</th>
                  <th className="px-3 py-3 font-semibold text-gray-700 text-right hidden xl:table-cell">Lip</th>
                  <th className="px-3 py-3 font-semibold text-gray-700 text-right hidden xl:table-cell">Fibra</th>
                  <th className="px-3 py-3 font-semibold text-gray-700 text-right hidden lg:table-cell">Custo/porção</th>
                  <th className="px-3 py-3 font-semibold text-gray-700 text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filteredRecipes.map((recipe, idx) => (
                  <>
                    <tr
                      key={recipe.id}
                      className={`border-b transition-colors cursor-pointer hover:bg-green-50/40 ${expandedRow === recipe.id ? 'bg-green-50/60' : idx % 2 === 0 ? '' : 'bg-gray-50/40'}`}
                      onClick={() => setExpandedRow(expandedRow === recipe.id ? null : recipe.id)}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <span className={`text-gray-400 text-xs transition-transform ${expandedRow === recipe.id ? 'rotate-90' : ''}`}>▶</span>
                          <div>
                            <p className="font-medium text-gray-900 leading-tight">{recipe.displayName || recipe.name}</p>
                            <p className="text-xs text-gray-400 mt-0.5">
                              {recipe.classification}{recipe.recommendedMeal ? ` · ${recipe.recommendedMeal}` : ''}
                              {recipe.allergens.length > 0 && <span className="ml-2 text-amber-600">⚠ {recipe.allergens.slice(0,2).join(', ')}</span>}
                              {recipe.usesFamilyFarm && <span className="ml-2 text-green-600">🌱 AF</span>}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3 text-center text-gray-700 hidden sm:table-cell">{recipe.servings}</td>
                      <td className="px-3 py-3 text-right text-gray-700 hidden md:table-cell">{recipe.perCapita.toFixed(3)} kg</td>
                      <td className="px-3 py-3 text-right font-medium text-orange-600 hidden md:table-cell">{recipe.nutrientsPerServing.kcal.toFixed(0)}</td>
                      <td className="px-3 py-3 text-right text-gray-700 hidden lg:table-cell">{recipe.nutrientsPerServing.protein.toFixed(1)} g</td>
                      <td className="px-3 py-3 text-right text-gray-700 hidden lg:table-cell">{recipe.nutrientsPerServing.carbohydrates.toFixed(1)} g</td>
                      <td className="px-3 py-3 text-right text-gray-700 hidden xl:table-cell">{recipe.nutrientsPerServing.lipids.toFixed(1)} g</td>
                      <td className="px-3 py-3 text-right text-gray-700 hidden xl:table-cell">{recipe.nutrientsPerServing.fiber.toFixed(1)} g</td>
                      <td className="px-3 py-3 text-right text-gray-700 hidden lg:table-cell">R$ {recipe.costPerServing.toFixed(2)}</td>
                      <td className="px-3 py-3" onClick={e => e.stopPropagation()}>
                        <div className="flex gap-1.5 justify-end">
                          <button onClick={() => generateRecipePDF(recipe, signerLabel).catch(() => {})} title="Imprimir" className="rounded p-1.5 text-blue-600 hover:bg-blue-50 transition-colors"><Printer className="h-4 w-4" /></button>
                          <button onClick={() => openEditRecipe(recipe)} title="Editar" className="rounded p-1.5 text-slate-600 hover:bg-slate-100 transition-colors"><Pencil className="h-4 w-4" /></button>
                          <button onClick={() => handleDuplicate(recipe)} title="Duplicar" className="rounded p-1.5 text-violet-600 hover:bg-violet-50 transition-colors"><Copy className="h-4 w-4" /></button>
                          <button onClick={() => { deleteRecipe(recipe.id); toast.success('Ficha excluída.'); }} title="Excluir" className="rounded p-1.5 text-red-500 hover:bg-red-50 transition-colors"><Trash2 className="h-4 w-4" /></button>
                        </div>
                      </td>
                    </tr>
                    {expandedRow === recipe.id && (
                      <tr key={`${recipe.id}-expanded`} className="bg-green-50/30 border-b">
                        <td colSpan={10} className="px-6 py-4">
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            {/* Tabela nutricional completa */}
                            <div>
                              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Tabela Nutricional / porção</p>
                              <div className="space-y-1">
                                {[
                                  { label: 'Energia', value: `${recipe.nutrientsPerServing.kcal.toFixed(0)} kcal` },
                                  { label: 'Proteínas', value: `${recipe.nutrientsPerServing.protein.toFixed(1)} g` },
                                  { label: 'Carboidratos', value: `${recipe.nutrientsPerServing.carbohydrates.toFixed(1)} g` },
                                  { label: 'Lipídeos', value: `${recipe.nutrientsPerServing.lipids.toFixed(1)} g` },
                                  { label: 'Fibras', value: `${recipe.nutrientsPerServing.fiber.toFixed(1)} g` },
                                ].map(({ label, value }) => (
                                  <div key={label} className="flex justify-between text-xs border-b border-gray-100 py-0.5">
                                    <span className="text-gray-500">{label}</span>
                                    <span className="font-medium text-gray-800">{value}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                            <div>
                              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Minerais / porção</p>
                              <div className="space-y-1">
                                {[
                                  { label: 'Cálcio', value: `${recipe.nutrientsPerServing.calcium.toFixed(1)} mg` },
                                  { label: 'Ferro', value: `${recipe.nutrientsPerServing.iron.toFixed(2)} mg` },
                                  { label: 'Zinco', value: `${recipe.nutrientsPerServing.zinc.toFixed(2)} mg` },
                                  { label: 'Vitamina A', value: `${recipe.nutrientsPerServing.vitaminA.toFixed(0)} µg` },
                                  { label: 'Vitamina C', value: `${recipe.nutrientsPerServing.vitaminC.toFixed(1)} mg` },
                                ].map(({ label, value }) => (
                                  <div key={label} className="flex justify-between text-xs border-b border-gray-100 py-0.5">
                                    <span className="text-gray-500">{label}</span>
                                    <span className="font-medium text-gray-800">{value}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                            <div>
                              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Dados da Preparação</p>
                              <div className="space-y-1">
                                {[
                                  { label: 'Rendimento', value: `${recipe.yieldPercentage.toFixed(1)}%` },
                                  { label: 'Peso bruto total', value: `${recipe.totalGrossWeight.toFixed(3)} kg` },
                                  { label: 'Peso líquido total', value: `${recipe.totalNetWeight.toFixed(3)} kg` },
                                  { label: 'Custo total', value: `R$ ${recipe.costTotal.toFixed(2)}` },
                                  { label: 'Agr. Familiar', value: recipe.usesFamilyFarm ? '✓ Sim' : 'Não' },
                                ].map(({ label, value }) => (
                                  <div key={label} className="flex justify-between text-xs border-b border-gray-100 py-0.5">
                                    <span className="text-gray-500">{label}</span>
                                    <span className={`font-medium ${label === 'Agr. Familiar' && recipe.usesFamilyFarm ? 'text-green-600' : 'text-gray-800'}`}>{value}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                            <div>
                              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Ingredientes ({recipe.ingredients.length})</p>
                              <div className="space-y-0.5 max-h-32 overflow-y-auto">
                                {recipe.ingredients.map((ing) => (
                                  <div key={ing.id} className="flex justify-between text-xs border-b border-gray-100 py-0.5">
                                    <span className="text-gray-600 truncate mr-2">{ing.foodName}</span>
                                    <span className="text-gray-500 whitespace-nowrap">{ing.grossWeight.toFixed(3)} kg</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                          {recipe.preparationMethod && (
                            <div className="mt-3 pt-3 border-t border-green-100">
                              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Modo de Preparo</p>
                              <p className="text-xs text-gray-600 whitespace-pre-line leading-relaxed">{recipe.preparationMethod}</p>
                            </div>
                          )}
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          /* ── CARDS VIEW ─────────────────────────────────────────────────────── */
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
            {filteredRecipes.map((recipe) => (
              <Card key={recipe.id} className="transition-shadow hover:shadow-md flex flex-col">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <CardTitle className="text-base leading-tight">{recipe.displayName || recipe.name}</CardTitle>
                      <CardDescription className="mt-0.5">
                        {recipe.displayName ? recipe.name : recipe.classification}{recipe.recommendedMeal ? ` · ${recipe.recommendedMeal}` : ''}
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2 text-sm flex-1">
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                    <div><span className="text-muted-foreground">Ingredientes</span><p className="font-medium">{recipe.ingredients.length}</p></div>
                    <div><span className="text-muted-foreground">Porções</span><p className="font-medium">{recipe.servings}</p></div>
                    <div><span className="text-muted-foreground">Custo/porção</span><p className="font-medium">R$ {recipe.costPerServing.toFixed(2)}</p></div>
                    <div><span className="text-muted-foreground">Per capita</span><p className="font-medium">{recipe.perCapita.toFixed(3)} kg</p></div>
                    <div><span className="text-muted-foreground">Energia</span><p className="font-medium">{recipe.nutrientsPerServing.kcal.toFixed(0)} kcal</p></div>
                    <div><span className="text-muted-foreground">Proteína</span><p className="font-medium">{recipe.nutrientsPerServing.protein.toFixed(1)} g</p></div>
                  </div>
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {recipe.usesFamilyFarm && (
                      <span className="rounded-full bg-green-100 px-2 py-0.5 text-[11px] font-medium text-green-700">Agric. Familiar</span>
                    )}
                    {recipe.allergens.map((al) => (
                      <span key={al} className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-700" title={`Contém ${al}`}>
                        {allergenIcon(al)} {al}
                      </span>
                    ))}
                    {recipe.prepTime && (
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600">{recipe.prepTime}</span>
                    )}
                  </div>
                  <div className="flex gap-2 pt-2 border-t">
                    <button onClick={() => { generateRecipePDF(recipe, signerLabel).catch(() => toast.error('Erro ao gerar PDF.')); }} title="Imprimir ficha técnica" className="flex-1 flex items-center justify-center gap-1.5 rounded-md bg-blue-600 px-2 py-1.5 text-xs font-medium text-white hover:bg-blue-700 transition-colors">
                      <Printer className="h-3.5 w-3.5" /> Imprimir
                    </button>
                    <button onClick={() => openEditRecipe(recipe)} title="Editar ficha técnica" className="flex items-center justify-center gap-1 rounded-md border border-slate-200 px-2 py-1.5 text-xs text-slate-600 hover:bg-slate-50 transition-colors">
                      <Pencil className="h-3.5 w-3.5" /> Editar
                    </button>
                    <button onClick={() => handleDuplicate(recipe)} title="Duplicar ficha técnica" className="flex items-center justify-center gap-1 rounded-md border border-violet-200 px-2 py-1.5 text-xs text-violet-600 hover:bg-violet-50 transition-colors">
                      <Copy className="h-3.5 w-3.5" />
                    </button>
                    <button onClick={() => { deleteRecipe(recipe.id); toast.success('Ficha técnica excluída.'); }} title="Excluir ficha técnica" className="flex items-center justify-center gap-1 rounded-md border border-red-200 px-2 py-1.5 text-xs text-red-600 hover:bg-red-50 transition-colors">
                      <Trash2 className="h-3.5 w-3.5" /> Excluir
                    </button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
