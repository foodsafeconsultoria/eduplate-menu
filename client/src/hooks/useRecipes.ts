import { useEffect, useMemo, useState } from 'react';
import { loadHybridCollection, persistHybridSnapshot, removeHybridDocument, syncHybridDocument } from '@/lib/hybridStore';
import type { Recipe } from '@/types/nutrition';
import { useAuth } from '@/contexts/AuthContext';
import { useOrgId } from '@/hooks/useOrgId';

const STORAGE_KEY = 'pnae_nutrition_recipes';
const COLLECTION_NAME = 'nutrition_recipes';
const LEGACY_ORG_ID = 'pnae-default-org';

export interface CreateRecipeInput {
  name: string;
  displayName?: string;
  classification: Recipe['classification'];
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
  medidaCaseira?: string;
  costTotal: number;
  costPerServing: number;
  nutrientsPerServing: Recipe['nutrientsPerServing'];
  ingredients: Recipe['ingredients'];
}

/** Converts a value that may be a JS Date, a Firestore Timestamp, or a date
 *  string/number into a proper Date object. Falls back to now. */
function toDate(val: unknown): Date {
  if (!val) return new Date();
  // Firestore Timestamp has a toDate() method
  if (typeof (val as any).toDate === 'function') return (val as any).toDate();
  const d = new Date(val as string | number);
  return isNaN(d.getTime()) ? new Date() : d;
}

function normalizeRecipes(raw: unknown): Recipe[] {
  if (!Array.isArray(raw)) return [];

  return raw.map((item, index) => {
    const recipe = item as Partial<Recipe>;
    return {
      id: recipe.id || `recipe-imported-${index}`,
      name: recipe.name || 'Preparacao sem nome',
      displayName: recipe.displayName,
      classification: recipe.classification || 'principal',
      recommendedMeal: recipe.recommendedMeal || '',
      yieldTotal: Number(recipe.yieldTotal) || 0,
      servings: Number(recipe.servings) || 1,
      totalGrossWeight: Number(recipe.totalGrossWeight) || 0,
      totalNetWeight: Number(recipe.totalNetWeight) || 0,
      perCapita: Number(recipe.perCapita) || 0,
      yieldPercentage: Number(recipe.yieldPercentage) || 0,
      usesFamilyFarm: Boolean(recipe.usesFamilyFarm),
      allergens: Array.isArray(recipe.allergens) ? recipe.allergens.filter(Boolean) : [],
      prepTime: recipe.prepTime || '',
      preparationMethod: recipe.preparationMethod || '',
      operationalNotes: recipe.operationalNotes || '',
      medidaCaseira: recipe.medidaCaseira || '',
      costTotal: Number(recipe.costTotal) || 0,
      costPerServing: Number(recipe.costPerServing) || 0,
      nutrientsPerServing: {
        kcal: Number(recipe.nutrientsPerServing?.kcal) || 0,
        protein: Number(recipe.nutrientsPerServing?.protein) || 0,
        lipids: Number(recipe.nutrientsPerServing?.lipids) || 0,
        carbohydrates: Number(recipe.nutrientsPerServing?.carbohydrates) || 0,
        fiber: Number(recipe.nutrientsPerServing?.fiber) || 0,
        calcium: Number(recipe.nutrientsPerServing?.calcium) || 0,
        iron: Number(recipe.nutrientsPerServing?.iron) || 0,
        zinc: Number(recipe.nutrientsPerServing?.zinc) || 0,
        vitaminA: Number(recipe.nutrientsPerServing?.vitaminA) || 0,
        vitaminC: Number(recipe.nutrientsPerServing?.vitaminC) || 0,
      },
      ingredients: Array.isArray(recipe.ingredients) ? recipe.ingredients : [],
      createdAt: toDate(recipe.createdAt),
      updatedAt: toDate(recipe.updatedAt),
    };
  });
}

export function useRecipes() {
  const { user } = useAuth();
  const orgId = useOrgId();

  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!orgId) { setLoading(false); return; }
    let mounted = true;

    loadHybridCollection({
      orgId,
      collectionName: COLLECTION_NAME,
      storageKey: STORAGE_KEY,
      normalize: normalizeRecipes,
      fallbackData: [],
    })
      .then((items) => {
        if (mounted) setRecipes(items);
      })
      .catch((error) => {
        console.error('Erro ao carregar fichas tecnicas:', error);
        if (mounted) setRecipes([]);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [orgId]);

  const persistRecipes = (nextRecipes: Recipe[]) => {
    setRecipes(nextRecipes);
    persistHybridSnapshot(`${STORAGE_KEY}_${orgId}`, nextRecipes);
  };

  const actions = useMemo(
    () => ({
      addRecipe: (input: CreateRecipeInput) => {
        const timestamp = new Date();
        const recipe: Recipe = {
          id: `recipe-${crypto.randomUUID()}`,
          name: input.name.trim(),
          displayName: input.displayName?.trim() || '',
          classification: input.classification,
          recommendedMeal: input.recommendedMeal?.trim() || '',
          yieldTotal: input.yieldTotal,
          servings: input.servings,
          totalGrossWeight: input.totalGrossWeight,
          totalNetWeight: input.totalNetWeight,
          perCapita: input.perCapita,
          yieldPercentage: input.yieldPercentage,
          usesFamilyFarm: input.usesFamilyFarm,
          allergens: input.allergens,
          prepTime: input.prepTime || '',
          preparationMethod: input.preparationMethod || '',
          operationalNotes: input.operationalNotes?.trim() || '',
          medidaCaseira: input.medidaCaseira?.trim() || '',
          costTotal: input.costTotal,
          costPerServing: input.costPerServing,
          nutrientsPerServing: input.nutrientsPerServing,
          ingredients: input.ingredients,
          createdAt: timestamp,
          updatedAt: timestamp,
        };

        persistRecipes([recipe, ...recipes]);
        void syncHybridDocument(orgId, COLLECTION_NAME, recipe);
        return recipe;
      },

      updateRecipe: (id: string, input: Partial<CreateRecipeInput>) => {
        const target = recipes.find((r) => r.id === id);
        if (!target) return false;
        const updated: Recipe = {
          ...target,
          ...(input.name !== undefined && { name: input.name.trim() }),
          ...(input.displayName !== undefined && { displayName: input.displayName.trim() }),
          ...(input.classification !== undefined && { classification: input.classification }),
          ...(input.recommendedMeal !== undefined && { recommendedMeal: input.recommendedMeal }),
          ...(input.yieldTotal !== undefined && { yieldTotal: input.yieldTotal }),
          ...(input.servings !== undefined && { servings: input.servings }),
          ...(input.totalGrossWeight !== undefined && { totalGrossWeight: input.totalGrossWeight }),
          ...(input.totalNetWeight !== undefined && { totalNetWeight: input.totalNetWeight }),
          ...(input.perCapita !== undefined && { perCapita: input.perCapita }),
          ...(input.yieldPercentage !== undefined && { yieldPercentage: input.yieldPercentage }),
          ...(input.usesFamilyFarm !== undefined && { usesFamilyFarm: input.usesFamilyFarm }),
          ...(input.allergens !== undefined && { allergens: input.allergens }),
          ...(input.prepTime !== undefined && { prepTime: input.prepTime }),
          ...(input.preparationMethod !== undefined && { preparationMethod: input.preparationMethod }),
          ...(input.operationalNotes !== undefined && { operationalNotes: input.operationalNotes }),
          ...(input.medidaCaseira !== undefined && { medidaCaseira: input.medidaCaseira }),
          ...(input.costTotal !== undefined && { costTotal: input.costTotal }),
          ...(input.costPerServing !== undefined && { costPerServing: input.costPerServing }),
          ...(input.nutrientsPerServing !== undefined && { nutrientsPerServing: input.nutrientsPerServing }),
          ...(input.ingredients !== undefined && { ingredients: input.ingredients }),
          updatedAt: new Date(),
        };
        persistRecipes(recipes.map((r) => (r.id === id ? updated : r)));
        void syncHybridDocument(orgId, COLLECTION_NAME, updated);
        return true;
      },

      deleteRecipe: (id: string) => {
        if (!recipes.find((r) => r.id === id)) return false;
        persistRecipes(recipes.filter((r) => r.id !== id));
        void removeHybridDocument(orgId, COLLECTION_NAME, id);
        return true;
      },
    }),
    [recipes, orgId]
  );

  return {
    recipes,
    loading,
    ...actions,
  };
}
