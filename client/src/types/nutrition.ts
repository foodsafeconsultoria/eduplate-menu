export interface NutritionNutrientSet {
  kcal: number;
  protein: number;
  lipids: number;
  carbohydrates: number;
  fiber: number;
  calcium: number;
  iron: number;
  zinc: number;
  vitaminA: number;
  vitaminC: number;
}

export interface Food {
  id: string;
  name: string;
  unit: 'kg' | 'unit' | 'liter';
  price: number;
  source?: 'taco' | 'custom';
  familyFarm?: boolean;
  allergens?: string[];
  nutrients: NutritionNutrientSet;
  createdAt: Date;
  updatedAt: Date;
}

export interface RecipeIngredient {
  id: string;
  foodId: string;
  foodName: string;
  grossWeight: number;
  netWeight: number;
  correctionFactor: number;
  estimatedCost: number;
}

export type RecipeClassification = 'principal' | 'guarnicao' | 'bebida' | 'sobremesa' | 'lanche';

export interface Recipe {
  id: string;
  name: string;
  displayName?: string;
  classification: RecipeClassification;
  recommendedMeal?: string;
  yieldTotal: number;
  servings: number;
  totalGrossWeight: number;
  totalNetWeight: number;
  perCapita: number;
  yieldPercentage: number;
  usesFamilyFarm: boolean;
  allergens: string[];
  prepTime?: string;
  preparationMethod?: string;
  operationalNotes?: string;
  costTotal: number;
  costPerServing: number;
  nutrientsPerServing: NutritionNutrientSet;
  ingredients: RecipeIngredient[];
  createdAt: Date;
  updatedAt: Date;
}

export interface MenuItem {
  id: string;
  dayLabel: string;
  mealLabel: string;
  type: 'food' | 'recipe';
  referenceId: string;
  name: string;
  displayName: string;
  perCapita: number;              // grams (or ml) per serving
  estimatedCost: number;
  nutrients: NutritionNutrientSet;        // effective nutrients (scaled to perCapita)
  sourceNutrients: NutritionNutrientSet;  // raw per-100g nutrients (for rescaling)
  sourceUnit?: string;            // 'g' | 'ml' — for display label
}

// ── Menu Slot / Insumo (new composition schema) ──────────────────────────────

/**
 * One ingredient (insumo) inside a MenuSlot.
 * valoresNutricionaisBase stores nutrients at pesoReferencia.
 * Effective nutrients = (valoresNutricionaisBase[key] / pesoReferencia) * pesoAtual
 */
export interface MenuInsumo {
  id: string;
  nome: string;
  type: 'food' | 'recipe';
  referenceId: string;
  /** Canonical reference weight in grams (100 for TACO foods, recipe.perCapita for recipes) */
  pesoReferencia: number;
  /** User-editable actual portion weight for this specific menu */
  pesoAtual: number;
  /** Nutrient values AT pesoReferencia (not yet scaled) */
  valoresNutricionaisBase: NutritionNutrientSet;
  /** Cost at pesoReferencia (R$) */
  custoBase: number;
  familyFarm?: boolean;
  sourceUnit?: string; // 'g' | 'ml'
}

/**
 * One day+meal slot in the menu (e.g. Segunda / Almoço).
 * nomeFantasia is the ONLY field rendered in the PDF.
 * composicao drives all nutritional calculations.
 */
export interface MenuSlot {
  id: string;
  dayLabel: string;
  mealLabel: string;
  /** Display name printed on the PDF (e.g. "Arroz, Feijão e Frango") */
  nomeFantasia: string;
  composicao: MenuInsumo[];
}

export type MenuStatus = 'draft' | 'under_review' | 'approved' | 'published';

export interface MenuWorkflowEntry {
  id: string;
  action: 'created' | 'submitted' | 'approved' | 'published' | 'reopened';
  actor: string;
  note?: string;
  createdAt: Date;
}

export interface Menu {
  id: string;
  title: string;
  /** Primary category — determines meal grid structure (e.g. 'Creche' vs 'Fundamental 1') */
  category: string;
  /** All student stages this menu covers (e.g. ['Fundamental 1','Fundamental 2','Médio']) */
  targetCategories: string[];
  referenceMonth: string;
  weekStartDate?: string;   // ISO date (YYYY-MM-DD) of the Monday of the reference week
  studentCount?: number;    // number of students served by this menu
  schoolIds?: string[];
  /** Legacy flat list — kept for backward-compat; new menus use slots instead */
  items: MenuItem[];
  /** New composition-based slots (replaces items for new menus) */
  slots: MenuSlot[];
  averageCost: number;
  averageKcal: number;
  averageProtein: number;
  familyFarmShare: number;
  missingTargets: string[];
  repeatedPreparations: string[];
  emptySlots: string[];
  complianceAlerts: string[];
  status: MenuStatus;
  responsibleName: string;
  reviewerName?: string;
  approverName?: string;
  publishedAt?: Date;
  workflowHistory: MenuWorkflowEntry[];
  createdAt: Date;
  updatedAt: Date;
}

export interface SpecialDiet {
  id: string;
  studentName: string;
  schoolId: string;
  schoolName: string;
  /** School stage: 'Creche' | 'Fundamental 1' | 'Fundamental 2' | 'Médio' | '' */
  category?: string;
  restrictionCode?: string;
  diagnosis?: string;
  prescription: string;
  labels?: string[];
  status: 'active' | 'inactive';
  createdAt: Date;
  updatedAt: Date;
}

// ── Marmita Distribution (Cozinha Piloto) ────────────────────────────────────

export interface MarmitaSchoolRow {
  schoolId: string;
  schoolName: string;
  G: number;
  M: number;
  P: number;
}

export interface MarmitaIngredient {
  name: string;
  quantity: number;
  unit: string;
}

export interface MarmitaRun {
  id: string;
  date: Date;
  dishName: string;
  preparations: string[];
  schoolRows: MarmitaSchoolRow[];
  ingredients: MarmitaIngredient[];
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProductionLog {
  id: string;
  schoolId?: string;
  schoolName?: string;
  date: Date;
  shift: 'morning' | 'afternoon' | 'night';
  dishName: string;
  producedQuantity: number;
  cleanLeftover: number;
  destination: 'donation' | 'discard' | 'reuse';
  destinationEntity?: string;
  // RDC ANVISA 216/2004
  foodType?: 'quente' | 'frio';
  temperature?: number;        // °C aferida no momento do registro
  temperatureTime?: string;    // HH:MM
  observations?: string;
  createdAt: Date;
  updatedAt: Date;
}
