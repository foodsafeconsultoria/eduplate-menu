import { describe, expect, it } from 'vitest';
import { editFoodRecord, foodDate } from './foodRecord';
import type { Food } from '../types/nutrition';

const food: Food = {
  id: 'food-1', name: 'Pão', unit: 'kg', price: 10, source: 'taco',
  allergens: ['Glúten'], familyFarm: true, createdAt: new Date('2026-01-01'), updatedAt: new Date('2026-01-01'),
  nutrients: { kcal: 300, protein: 8, carbohydrates: 50, lipids: 6, calcium: 1, iron: 1, zinc: 1, fiber: 2, vitaminA: 0, vitaminC: 0 },
};

describe('editing a food without breaking linked recipes', () => {
  it('preserves the ID, creation date and allergens when saving editable fields', () => {
    const date = new Date('2026-09-28');
    const edited = editFoodRecord(food, { name: ' Pão de leite ', unit: 'unit', price: 2,
      nutrients: { ...food.nutrients, kcal: 290 } }, date);
    expect(edited.id).toBe(food.id);
    expect(edited.createdAt).toBe(food.createdAt);
    expect(edited.allergens).toEqual(['Glúten']);
    expect(edited.name).toBe('Pão de leite');
    expect(edited.source).toBe('custom');
    expect(edited.nutrients.kcal).toBe(290);
    expect(edited.price).toBe(2);
    expect(edited.unit).toBe('unit');
    expect(edited.updatedAt).toBe(date);
    expect(food.nutrients.kcal).toBe(300);
  });
  it('reads both local JSON dates and Firestore timestamps for version comparison', () => {
    const remote = new Date('2026-09-27T12:00:00Z');
    const local = new Date('2026-09-28T12:00:00Z');
    expect(foodDate({ toDate: () => remote }).getTime()).toBe(remote.getTime());
    expect(foodDate(JSON.parse(JSON.stringify(local)))).toEqual(local);
    expect(foodDate(local) > foodDate({ toDate: () => remote })).toBe(true);
    expect(foodDate(undefined).getTime()).toBe(0);
  });
});
