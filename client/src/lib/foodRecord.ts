import type { Food } from '../types/nutrition';

export function foodDate(value: unknown): Date {
  if (value && typeof (value as { toDate?: unknown }).toDate === 'function') {
    return (value as { toDate: () => Date }).toDate();
  }
  const date = value instanceof Date ? value : new Date(value as string);
  return Number.isFinite(date.getTime()) ? date : new Date(0);
}

export type FoodEditInput = Pick<Food, 'name' | 'unit' | 'price' | 'nutrients'> & Partial<Pick<Food, 'familyFarm' | 'allergens'>>;

export function editFoodRecord(food: Food, input: FoodEditInput, updatedAt = new Date()): Food {
  return { ...food, ...input, name: input.name.trim(), source: 'custom', updatedAt };
}
