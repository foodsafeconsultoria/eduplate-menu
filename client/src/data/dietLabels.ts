export interface DietLabel {
  key: string;
  text: string;
  color: string; // Tailwind classes for badge
}

export const DIET_LABELS: DietLabel[] = [
  { key: 'sem-gluten',       text: 'Sem Glúten',              color: 'bg-amber-100 text-amber-800 border-amber-300' },
  { key: 'sem-lactose',      text: 'Sem Lactose',             color: 'bg-blue-100 text-blue-800 border-blue-300' },
  { key: 'alergia-ovo',      text: 'Alergia a Ovo',           color: 'bg-yellow-100 text-yellow-800 border-yellow-300' },
  { key: 'alergia-amendoim', text: 'Alergia a Amendoim',      color: 'bg-red-100 text-red-800 border-red-300' },
  { key: 'alergia-nozes',    text: 'Alergia a Nozes',         color: 'bg-orange-100 text-orange-800 border-orange-300' },
  { key: 'alergia-soja',     text: 'Alergia a Soja',          color: 'bg-lime-100 text-lime-800 border-lime-300' },
  { key: 'alergia-frutos',   text: 'Alergia a Frutos do Mar', color: 'bg-cyan-100 text-cyan-800 border-cyan-300' },
  { key: 'celiaco',          text: 'Celíaco',                 color: 'bg-amber-200 text-amber-900 border-amber-400' },
  { key: 'diabetico',        text: 'Diabético',               color: 'bg-purple-100 text-purple-800 border-purple-300' },
  { key: 'hipertenso',       text: 'Hipertenso',              color: 'bg-pink-100 text-pink-800 border-pink-300' },
  { key: 'fenilcetonuria',   text: 'Fenilcetonúria (PKU)',    color: 'bg-indigo-100 text-indigo-800 border-indigo-300' },
  { key: 'vegetariano',      text: 'Vegetariano',             color: 'bg-green-100 text-green-800 border-green-300' },
  { key: 'vegano',           text: 'Vegano',                  color: 'bg-teal-100 text-teal-800 border-teal-300' },
  { key: 'religioso',        text: 'Preferência Religiosa',   color: 'bg-slate-100 text-slate-800 border-slate-300' },
];

export const DIET_LABEL_MAP = new Map(DIET_LABELS.map((l) => [l.key, l]));
