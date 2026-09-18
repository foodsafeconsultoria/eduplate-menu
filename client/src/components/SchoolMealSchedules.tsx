import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { School } from '@/types';

export function SchoolMealSchedules({ value, onChange }: {
  value: NonNullable<School['mealSchedules']>;
  onChange: (value: NonNullable<School['mealSchedules']>) => void;
}) {
  return <fieldset className="space-y-2 rounded-lg border p-3">
    <legend className="px-1 text-sm font-medium">Refeições e horários</legend>
    <p className="text-xs text-muted-foreground">Definidos pela RT. Use nomes distintos para turnos diferentes, como Lanche da manhã e Lanche da tarde.</p>
    {value.map((row, index) => <div key={index} className="flex gap-2">
      <Input aria-label={`Nome da refeição ${index + 1}`} placeholder="Ex.: Almoço" required maxLength={60}
        value={row.mealLabel} onChange={e => onChange(value.map((r, i) => i === index ? { ...r, mealLabel: e.target.value } : r))} />
      <Input aria-label={`Horário da refeição ${index + 1}`} type="time" required className="w-28 shrink-0"
        value={row.time} onChange={e => onChange(value.map((r, i) => i === index ? { ...r, time: e.target.value } : r))} />
      <Button type="button" variant="ghost" aria-label={`Remover refeição ${index + 1}`} onClick={() => onChange(value.filter((_, i) => i !== index))}>×</Button>
    </div>)}
    <Button type="button" variant="outline" size="sm" onClick={() => onChange([...value, { mealLabel: '', time: '' }])}>Adicionar refeição</Button>
  </fieldset>;
}

export function validMealSchedules(rows: NonNullable<School['mealSchedules']>): boolean {
  return rows.every(r => r.mealLabel.trim() && /^([01]\d|2[0-3]):[0-5]\d$/.test(r.time))
    && new Set(rows.map(r => r.mealLabel.trim().toLocaleLowerCase('pt-BR'))).size === rows.length;
}
