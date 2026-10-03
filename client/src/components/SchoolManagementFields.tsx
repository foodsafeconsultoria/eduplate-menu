import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import type { School, SchoolDocumentation } from '@/types';
import { SCHOOL_PERIODS } from '@/lib/schoolDetails';

export function SchoolDocumentationFields({ value, onChange, disabled = false }: {
  value: SchoolDocumentation; onChange: (value: SchoolDocumentation) => void; disabled?: boolean;
}) {
  return <fieldset disabled={disabled} className="space-y-3 rounded-lg border p-3">
    <legend className="px-1 text-sm font-medium">Documentos da escola</legend>
    <div className="flex flex-wrap gap-4">
      {([{ key: 'mbp', label: 'MBP' }, { key: 'pops', label: "POP's" }, { key: 'technicalRecipes', label: 'Fichas técnicas' }] as const).map(item =>
        <label key={item.key} className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={value[item.key]} onChange={e => onChange({ ...value, [item.key]: e.target.checked })} />{item.label}
        </label>)}
    </div>
    <p className="text-xs text-muted-foreground">Marque os documentos que a escola já possui.</p>
    <label className="block text-sm">POPs criados para esta escola
      <Textarea className="mt-1 min-h-20" value={value.popList} onChange={e => onChange({ ...value, popList: e.target.value })}
        placeholder="Ex.: Higienização das instalações; controle de pragas; higienização das mãos…" />
    </label>
  </fieldset>;
}
export function SchoolStudentFields({ value, onChange }: {
  value: NonNullable<School['studentCounts']>; onChange: (value: NonNullable<School['studentCounts']>) => void;
}) {
  return <fieldset className="space-y-3 rounded-lg border p-3">
    <legend className="px-1 text-sm font-medium">Alunos por período</legend>
    <div className="grid grid-cols-2 gap-3">
      {SCHOOL_PERIODS.map(period => <label key={period.key} className="text-sm">{period.label}
        <Input className="mt-1" type="number" min="0" step="1" placeholder="Não informado" value={value[period.key] ?? ''}
          onChange={e => { const next = { ...value }; if (e.target.value === '') delete next[period.key]; else next[period.key] = Number(e.target.value); onChange(next); }} />
      </label>)}
    </div>
    <p className="text-xs text-muted-foreground">Informe alunos do período integral apenas em Integral. Deixe em branco os períodos ainda não informados.</p>
  </fieldset>;
}
