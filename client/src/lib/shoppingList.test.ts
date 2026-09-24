import { describe, expect, it } from 'vitest';
import type { Menu, MenuInsumo } from '../types/nutrition';
import { buildShoppingList, formatShoppingAmount } from './shoppingList';

const food = { nome: 'Arroz', pesoAtual: 100, sourceUnit: 'g', familyFarm: true } as MenuInsumo;
const menu = {
  title: 'Semana de exemplo', studentCount: 100, items: [],
  slots: ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta'].map(dayLabel => ({ dayLabel, mealLabel: 'Almoço', composicao: [food] })),
} as Menu;

describe('Quantidades da lista de compras', () => {
  it('soma cinco porções de 100 g para 100 alunos como 50 kg, não 250 kg', () => {
    const [item] = buildShoppingList([menu]);
    expect(item.totalGrams).toBe(50000);
    expect(formatShoppingAmount(item)).toBe('50.0 kg');
  });
  it('conta cada refeição e cada cardápio com seus próprios alunos', () => {
    const monday = { ...menu.slots[0], composicao: [food, { ...food, pesoAtual: 50 }] };
    expect(buildShoppingList([{ ...menu, slots: [monday] }, { ...menu, title: 'Outra escola', studentCount: 20, slots: [menu.slots[0]] }])[0].totalGrams).toBe(17000);
  });
  it.each([undefined, 0, -1, NaN, Infinity])('não inventa alunos quando o número é %s', studentCount => {
    expect(() => buildShoppingList([{ ...menu, studentCount }])).toThrow('Informe o número de alunos');
  });
  it('preserva ml e não mistura volume e massa', () => {
    const result = buildShoppingList([{ ...menu, slots: [{ ...menu.slots[0], composicao: [food, { ...food, sourceUnit: 'ml' }] }] }]);
    expect(result).toHaveLength(2);
    expect(result.map(formatShoppingAmount)).toEqual(['10.0 kg', '10.0 L']);
  });
  it('calcula cardápios legados sem contar também os slots', () => {
    const legacy = [{ name: 'Arroz', displayName: 'Arroz', perCapita: 100, sourceUnit: 'g' }] as Menu['items'];
    expect(buildShoppingList([{ ...menu, slots: [], items: legacy }])[0].totalGrams).toBe(10000);
    expect(buildShoppingList([{ ...menu, items: legacy }])[0].totalGrams).toBe(50000);
  });
  it('não apresenta origens mistas como inteiramente agricultura familiar', () => {
    const [item] = buildShoppingList([{ ...menu, slots: [{ ...menu.slots[0], composicao: [food, { ...food, familyFarm: false }] }] }]);
    expect(item.familyFarm).toBe(false);
  });
});
