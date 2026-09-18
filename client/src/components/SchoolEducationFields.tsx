import type { School } from '@/types';

export const educationStages = ['Creche', 'Ensino Infantil', 'Fundamental 1', 'Fundamental 2', 'Médio', 'EJA'];
export const educationNetworks = { municipal: 'Municipal', estadual: 'Estadual', federal: 'Federal', outra: 'Outra' };

export function SchoolEducationFields({ network, stages, onNetwork, onStages }: {
  network: School['educationNetwork'] | ''; stages: string[];
  onNetwork: (value: School['educationNetwork'] | '') => void;
  onStages: (value: string[]) => void;
}) {
  return <fieldset className="space-y-3 rounded-lg border p-3">
    <legend className="px-1 text-sm font-medium">Grupos para distribuição de cardápios</legend>
    <label className="block text-sm">Rede de ensino
      <select className="mt-1 w-full rounded border bg-background p-2" value={network} onChange={e => onNetwork(e.target.value as typeof network)}>
        <option value="">Não informada</option>
        {Object.entries(educationNetworks).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
      </select>
    </label>
    <p className="text-sm">Etapas atendidas</p>
    <div className="grid grid-cols-2 gap-2">
      {educationStages.map(stage => <label className="flex items-center gap-2 text-sm" key={stage}>
        <input type="checkbox" checked={stages.includes(stage)} onChange={e => onStages(e.target.checked ? [...stages, stage] : stages.filter(s => s !== stage))} />{stage}
      </label>)}
    </div>
  </fieldset>;
}
