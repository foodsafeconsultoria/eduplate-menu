import { describe, expect, it } from 'vitest';
import type { Menu, MenuInsumo } from '../types/nutrition';
import { menuProductionCost, productionAmount, slotMealCount } from './menuProduction';
import { buildShoppingList, hasStudentCount } from './shoppingList';
import { partialSlots } from './menuAttendance';

const item = { id: 'food', nome: 'Arroz', pesoAtual: 150, sourceUnit: 'g' } as MenuInsumo;
const menu = { title: 'Semana', studentCount: 120, items: [], slots: [
  { id: 'lunch', dayLabel: 'Segunda', mealLabel: 'Almoço', nomeFantasia: 'Arroz', composicao: [item] },
  { id: 'dinner', dayLabel: 'Segunda', mealLabel: 'Jantar', nomeFantasia: 'Arroz', composicao: [item] },
] } as Menu;

describe('Planejamento da produção por cardápio', () => {
  it('recalcula o custo com a porção e as quantidades por refeição', () => {
    const costItem = { ...item, pesoReferencia: 100, custoBase: 2 };
    const costMenu = { ...menu, mealCount: 80, slots: [
      { ...menu.slots[0], composicao: [costItem] },
      { ...menu.slots[1], mealCount: 30, composicao: [costItem] },
    ] };
    expect(menuProductionCost(costMenu)).toBe(330);
    expect(menuProductionCost({ ...costMenu, slots: [{ ...costMenu.slots[0], mealCount: 0 }] })).toBe(0);
    expect(menuProductionCost({ ...costMenu, mealCount: undefined, studentCount: undefined })).toBeUndefined();
  });
  it('calcula 150 g para 120 refeições como 18 kg e recalcula alterações', () => {
    expect(productionAmount(150, 120)).toBe(18);
    expect(productionAmount(200, 120)).toBe(24);
    expect(productionAmount(150, 80)).toBe(12);
    expect(productionAmount(150, 0)).toBe(0);
    expect(productionAmount(200, 30)).toBe(6); // ml -> L uses the same conversion
  });
  it('prioriza a refeição, depois o padrão do cardápio, depois alunos legados', () => {
    expect(slotMealCount(menu, menu.slots[0])).toBe(120);
    expect(slotMealCount({ ...menu, mealCount: 80 }, menu.slots[0])).toBe(80);
    expect(slotMealCount({ ...menu, mealCount: 80 }, { mealCount: 30 })).toBe(30);
    expect(slotMealCount(menu, { mealCount: 0 })).toBe(0);
  });
  it('usa as mesmas quantidades na lista de compras', () => {
    const custom = { ...menu, mealCount: 80, slots: [menu.slots[0], { ...menu.slots[1], mealCount: 30 }] };
    expect(buildShoppingList([custom])[0].totalGrams).toBe(16500);
    expect(buildShoppingList([{ ...custom, slots: [{ ...custom.slots[0], mealCount: 0 }] }])).toEqual([]);
    expect(buildShoppingList([{ ...custom, studentCount: undefined }])[0].totalGrams).toBe(16500);
  });
  it('permite quantidades por refeição sem inventar um número de alunos', () => {
    const custom = { ...menu, studentCount: undefined, slots: menu.slots.map(s => ({ ...s, mealCount: 20 })) };
    expect(hasStudentCount(custom)).toBe(true);
    expect(buildShoppingList([custom])[0].totalGrams).toBe(6000);
    expect(hasStudentCount({ ...custom, slots: [custom.slots[0], menu.slots[1]] })).toBe(false);
  });
  it.each([-1, 1.5, NaN, Infinity])('recusa quantidades inválidas (%s)', mealCount => {
    expect(slotMealCount({ ...menu, mealCount })).toBeUndefined();
    expect(() => buildShoppingList([{ ...menu, mealCount }])).toThrow();
  });
  it('exige escolha ao combinar refeições com produções diferentes', () => {
    expect(partialSlots([menu.slots[0], { ...menu.slots[1], mealCount: 30 }]).conflicts).toHaveLength(1);
  });
});
