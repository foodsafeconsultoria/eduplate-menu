import { useEffect, useMemo, useState } from 'react';
import { initialFoods } from '@/data/nutritionFoods';
import { loadHybridCollection, persistHybridSnapshot, removeHybridDocument, syncHybridDocument } from '@/lib/hybridStore';
import type { Food } from '@/types/nutrition';
import { useAuth } from '@/contexts/AuthContext';

const STORAGE_KEY = 'pnae_nutrition_foods';
const COLLECTION_NAME = 'nutrition_foods';
const LEGACY_ORG_ID = 'pnae-default-org';

export interface CreateFoodInput {
  name: string;
  unit: Food['unit'];
  price: number;
  familyFarm?: boolean;
  allergens?: string[];
  nutrients: Food['nutrients'];
}

function normalizeFoods(raw: unknown): Food[] {
  if (!Array.isArray(raw)) return initialFoods;

  return raw.map((item, index) => {
    const food = item as Partial<Food>;
    return {
      id: food.id || `food-imported-${index}`,
      name: food.name || 'Alimento sem nome',
      unit: food.unit || 'kg',
      price: Number(food.price) || 0,
      source: food.source || 'custom',
      familyFarm: Boolean(food.familyFarm),
      allergens: Array.isArray(food.allergens) ? food.allergens : [],
      nutrients: {
        kcal: Number(food.nutrients?.kcal) || 0,
        protein: Number(food.nutrients?.protein) || 0,
        lipids: Number(food.nutrients?.lipids) || 0,
        carbohydrates: Number(food.nutrients?.carbohydrates) || 0,
        fiber: Number(food.nutrients?.fiber) || 0,
        calcium: Number(food.nutrients?.calcium) || 0,
        iron: Number(food.nutrients?.iron) || 0,
        zinc: Number(food.nutrients?.zinc) || 0,
        vitaminA: Number(food.nutrients?.vitaminA) || 0,
        vitaminC: Number(food.nutrients?.vitaminC) || 0,
      },
      createdAt: food.createdAt ? new Date(food.createdAt) : new Date(),
      updatedAt: food.updatedAt ? new Date(food.updatedAt) : new Date(),
    };
  });
}

export function useFoods() {
  const { user } = useAuth();
  const orgId = user?.organizationId || LEGACY_ORG_ID;

  const [foods, setFoods] = useState<Food[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;


    loadHybridCollection({
      orgId,
      collectionName: COLLECTION_NAME,
      storageKey: STORAGE_KEY,
      normalize: normalizeFoods,
      fallbackData: initialFoods,
    })
      .then((items) => {
        if (!mounted) return;
        // Merge: any initialFood not yet in Firebase/localStorage is added
        // (ensures new TACO entries from code updates appear immediately)
        const loadedIds = new Set(items.map((f) => f.id));
        const missing = initialFoods.filter((f) => !loadedIds.has(f.id));
        const merged = missing.length > 0 ? [...items, ...missing] : items;
        setFoods(merged);
      })
      .catch((error) => {
        console.error('Erro ao carregar alimentos:', error);
        if (mounted) setFoods(initialFoods);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [orgId]);

  const persistFoods = (nextFoods: Food[]) => {
    setFoods(nextFoods);
    persistHybridSnapshot(`${STORAGE_KEY}_${orgId}`, nextFoods);
  };

  const actions = useMemo(
    () => ({
      addFood: (input: CreateFoodInput) => {
        const timestamp = new Date();
        const newFood: Food = {
          id: `food-${crypto.randomUUID()}`,
          name: input.name.trim(),
          unit: input.unit,
          price: input.price,
          source: 'custom',
          familyFarm: input.familyFarm,
          allergens: input.allergens || [],
          nutrients: input.nutrients,
          createdAt: timestamp,
          updatedAt: timestamp,
        };

        persistFoods([newFood, ...foods]);
        void syncHybridDocument(orgId, COLLECTION_NAME, newFood);
        return newFood;
      },
      updateFoodPrice: (id: string, price: number) => {
        const nextFoods = foods.map((food) =>
          food.id === id ? { ...food, price, updatedAt: new Date() } : food
        );
        const updated = nextFoods.find((f) => f.id === id) || null;
        persistFoods(nextFoods);
        if (updated) void syncHybridDocument(orgId, COLLECTION_NAME, updated);
      },
      toggleFamilyFarm: (id: string) => {
        const nextFoods = foods.map((food) =>
          food.id === id ? { ...food, familyFarm: !food.familyFarm, updatedAt: new Date() } : food
        );
        const updated = nextFoods.find((f) => f.id === id) || null;
        persistFoods(nextFoods);
        if (updated) void syncHybridDocument(orgId, COLLECTION_NAME, updated);
      },
    }),
    [foods, orgId]
  );

  return {
    foods,
    loading,
    ...actions,
  };
}
