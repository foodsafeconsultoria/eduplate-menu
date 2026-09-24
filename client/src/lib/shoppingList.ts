import type { Menu } from '../types/nutrition';

export interface ShoppingItem {
  nome: string;
  totalGrams: number;
  unit: 'g' | 'ml';
  familyFarm: boolean;
  menus: string[];
}

export function hasStudentCount(menu: Menu): boolean {
  return Number.isFinite(menu.studentCount) && Number(menu.studentCount) > 0;
}

export function buildShoppingList(menus: Menu[]): ShoppingItem[] {
  const map = new Map<string, ShoppingItem>();
  for (const menu of menus) {
    if (!hasStudentCount(menu)) throw new Error(`Informe o número de alunos de "${menu.title}".`);
    // Each slot already represents a single day and meal. Count it once.
    const portions = menu.slots?.length
      ? menu.slots.flatMap(slot => slot.composicao)
      : (menu.items || []).map(item => ({ nome: item.displayName || item.name, pesoAtual: item.perCapita, sourceUnit: item.sourceUnit, familyFarm: false }));
    for (const insumo of portions) {
      const unit = insumo.sourceUnit === 'ml' ? 'ml' : 'g';
      const key = `${insumo.nome.trim().toLocaleLowerCase('pt-BR')}|${unit}`;
      const amount = insumo.pesoAtual * Number(menu.studentCount);
      const existing = map.get(key);
      if (existing) {
        existing.totalGrams += amount;
        // A mixed source must not be presented as entirely family farming.
        existing.familyFarm = existing.familyFarm && Boolean(insumo.familyFarm);
        if (!existing.menus.includes(menu.title)) existing.menus.push(menu.title);
      } else {
        map.set(key, { nome: insumo.nome, totalGrams: amount, unit, familyFarm: Boolean(insumo.familyFarm), menus: [menu.title] });
      }
    }
  }
  return Array.from(map.values()).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
}

export function formatShoppingAmount(item: ShoppingItem): string {
  const { totalGrams: amount, unit } = item;
  return amount >= 1000
    ? `${(amount / 1000).toFixed(1)} ${unit === 'ml' ? 'L' : 'kg'}`
    : `${Math.round(amount)} ${unit}`;
}
