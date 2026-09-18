import type { MenuSlot } from '../types/nutrition';
import type { School } from '../types';

export type AttendanceMode = 'partial' | 'integral';
const key = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
export function partialMeal(label: string): string {
  const value = key(label);
  if (['cafe da manha', 'cafe da tarde', 'cafe manha', 'cafe tarde', 'desjejum', 'cafe manha/tarde', 'cafe da manha/tarde'].includes(value)) return 'Café manhã/tarde';
  if (['almoco', 'jantar', 'janta', 'almoco/jantar', 'almoco/janta'].includes(value)) return 'Almoço/Jantar';
  return label;
}

/** Alternatives share one portion. Never combine different portions without a choice. */
export function partialSlots(slots: MenuSlot[], choices: Record<string, string> = {}) {
  const groups = new Map<string, MenuSlot[]>();
  for (const slot of slots) {
    const group = `${slot.dayLabel} — ${partialMeal(slot.mealLabel)}`;
    groups.set(group, [...(groups.get(group) || []), slot]);
  }
  const conflicts: { key: string; options: MenuSlot[] }[] = [];
  const result: MenuSlot[] = [];
  const signature = (s: MenuSlot) => JSON.stringify([s.nomeFantasia.trim(), s.consistency || '', s.composicao.map(({ id, ...i }) => JSON.stringify(i)).sort()]);
  for (const [group, entries] of Array.from(groups.entries())) {
    const filled = entries.filter(s => s.composicao.length || s.nomeFantasia.trim());
    const options = filled.length ? filled : entries;
    const chosen = options.find(s => s.id === choices[group]);
    if (!chosen && new Set(options.map(signature)).size > 1) conflicts.push({ key: group, options });
    result.push({ ...(chosen || options[0]), mealLabel: partialMeal(options[0].mealLabel) });
  }
  return { slots: result, conflicts };
}

export function mealScheduleText(meal: string, school: School | undefined, mode?: AttendanceMode): string {
  const rows = (school?.mealSchedules || []).filter(r => (mode === 'partial' ? partialMeal(r.mealLabel) : r.mealLabel) === meal);
  return rows.length ? rows.map(r => `${r.mealLabel}: ${r.time || 'Horário não informado'}`).join('\n') : 'Horário não informado';
}
