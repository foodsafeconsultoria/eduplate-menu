/**
 * Sazonalidade de alimentos — Sudeste Brasil
 * months: índices 0–11 (Jan=0 … Dez=11)
 * Dados baseados na Ceagesp e CONAB para o Vale do Paranapanema/SP
 */

export type Season = 'verao' | 'outono' | 'inverno' | 'primavera';

export interface SeasonalFood {
  /** Termos parciais para matching com nome do alimento (lowercase) */
  keywords: string[];
  /** Meses em safra (0=Jan … 11=Dez) */
  months: number[];
  season: Season;
  tip?: string; // dica de substituição ou preparo
}

export const seasonalFoods: SeasonalFood[] = [
  // ── Verão (Dez–Mar) ────────────────────────────────────────────────────────
  { keywords: ['manga'],         months: [11, 0, 1, 2],    season: 'verao',    tip: 'Safra principal em Jan/Fev. Excelente fonte de vitamina A.' },
  { keywords: ['melancia'],      months: [11, 0, 1, 2],    season: 'verao',    tip: 'Alta disponibilidade em Jan. Hidratante e econômica.' },
  { keywords: ['abacaxi'],       months: [11, 0, 1, 2, 3], season: 'verao',    tip: 'Preço cai bastante no verão.' },
  { keywords: ['mamão', 'papaia'], months: [0, 1, 2, 3],   season: 'verao',    tip: 'Disponível quase o ano todo, pico no verão.' },
  { keywords: ['jiló', 'jilo'],  months: [0, 1, 2],        season: 'verao',    tip: 'Muito barato em Jan/Fev.' },
  { keywords: ['quiabo'],        months: [11, 0, 1, 2, 3], season: 'verao',    tip: 'Safra em Dez–Mar, rico em fibras.' },
  { keywords: ['milho'],         months: [11, 0, 1, 2],    season: 'verao',    tip: 'Milho verde em safra: bom para pamonha, canjica e cozidos.' },
  { keywords: ['abobrinha', 'abóbrinha', 'abobrinha'], months: [11, 0, 1, 2], season: 'verao', tip: 'Colheita abundante no verão, preço baixo.' },
  { keywords: ['abóbora', 'abobora'], months: [1, 2, 3, 4], season: 'verao',  tip: 'Safra entre fev/mai, ótima para sopas e purês.' },
  { keywords: ['pepino'],        months: [10, 11, 0, 1],   season: 'verao',    tip: 'Pico em nov/jan.' },

  // ── Outono (Mar–Mai) ───────────────────────────────────────────────────────
  { keywords: ['laranja'],       months: [3, 4, 5, 6, 7],  season: 'outono',   tip: 'Safra de Abr a Jul. São Paulo é o maior produtor do Brasil.' },
  { keywords: ['tangerina', 'mexerica'], months: [4, 5, 6, 7], season: 'outono', tip: 'Pico em mai/jun. Ótima fonte de vitamina C.' },
  { keywords: ['limão'],         months: [3, 4, 5, 6],     season: 'outono',   tip: 'Safra mai/jun.' },
  { keywords: ['caqui'],         months: [3, 4, 5],        season: 'outono',   tip: 'Safra mar–mai. Rico em vitaminas A e C.' },
  { keywords: ['uva'],           months: [0, 1, 2, 3],     season: 'outono',   tip: 'Safra jan–abr no Sul/Sudeste.' },
  { keywords: ['pêssego', 'pessego'], months: [11, 0, 1], season: 'outono',    tip: 'Safra dez–fev.' },
  { keywords: ['maçã', 'maca'],  months: [1, 2, 3, 4],     season: 'outono',   tip: 'Safra principal do Sul: fev–abr.' },
  { keywords: ['pera'],          months: [1, 2, 3],        season: 'outono',   tip: 'Safra jan–mar no Sul.' },

  // ── Inverno (Jun–Ago) ──────────────────────────────────────────────────────
  { keywords: ['couve'],         months: [4, 5, 6, 7, 8],  season: 'inverno',  tip: 'Folha mais tenra e saborosa no inverno. Fonte de ferro.' },
  { keywords: ['brócolis', 'brocolis'], months: [5, 6, 7, 8], season: 'inverno', tip: 'Alta produção em mai–ago. Excelente fonte de Ca e VitC.' },
  { keywords: ['couve-flor', 'couveflor'], months: [5, 6, 7, 8], season: 'inverno', tip: 'Pico em jun–ago.' },
  { keywords: ['repolho'],       months: [4, 5, 6, 7, 8],  season: 'inverno',  tip: 'Muito econômico no inverno.' },
  { keywords: ['cenoura'],       months: [4, 5, 6, 7],     season: 'inverno',  tip: 'Safra principal mai–jul. Rica em vitamina A.' },
  { keywords: ['beterraba'],     months: [4, 5, 6, 7, 8],  season: 'inverno',  tip: 'Preço baixo em mai–ago.' },
  { keywords: ['chuchu'],        months: [3, 4, 5, 6, 7],  season: 'inverno',  tip: 'Abundante e barato abr–jul.' },
  { keywords: ['vagem'],         months: [5, 6, 7],        season: 'inverno',  tip: 'Pico jun–ago.' },
  { keywords: ['batata doce', 'batata-doce'], months: [3, 4, 5, 6], season: 'inverno', tip: 'Safra abr–jun. Rica em vitamina A.' },
  { keywords: ['inhame'],        months: [4, 5, 6, 7],     season: 'inverno',  tip: 'Safra mai–jul.' },

  // ── Primavera (Set–Nov) ────────────────────────────────────────────────────
  { keywords: ['morango'],       months: [6, 7, 8, 9, 10], season: 'primavera', tip: 'Safra jun–out no Sudeste. Excelente fonte de VitC.' },
  { keywords: ['pimentão', 'pimentao'], months: [9, 10, 11], season: 'primavera', tip: 'Safra set–nov.' },
  { keywords: ['tomate'],        months: [8, 9, 10, 11],   season: 'primavera', tip: 'Pico set–dez. Rico em licopeno.' },
  { keywords: ['alface'],        months: [7, 8, 9, 10],    season: 'primavera', tip: 'Melhor qualidade no tempo seco (ago–out).' },
  { keywords: ['rúcula', 'rucula'], months: [7, 8, 9],     season: 'primavera', tip: 'Safra set–out.' },
  { keywords: ['espinafre'],     months: [5, 6, 7, 8, 9],  season: 'primavera', tip: 'Pico jun–set. Rico em ferro.' },
  { keywords: ['goiaba'],        months: [1, 2, 3, 8, 9],  season: 'primavera', tip: 'Duas safras: fev–abr e ago–set.' },
  { keywords: ['banana'],        months: [0,1,2,3,4,5,6,7,8,9,10,11], season: 'verao', tip: 'Disponível o ano todo; safra maior no verão.' },
  { keywords: ['feijão', 'feijao'], months: [0,1,2,3,4,5,6,7,8,9,10,11], season: 'verao', tip: 'Produzido o ano todo; preço menor após colheita jan–mar.' },
  { keywords: ['arroz'],         months: [0,1,2,3,4,5,6,7,8,9,10,11], season: 'verao', tip: 'Produto de estoque; colheita jan–abr no RS e SP.' },
];

/** Retorna informação sazonal para um nome de alimento no mês dado (0=Jan). */
export function getFoodSeasonality(foodName: string, month: number): SeasonalFood | null {
  const lower = foodName.toLowerCase();
  return seasonalFoods.find((sf) =>
    sf.keywords.some((kw) => lower.includes(kw)) && sf.months.includes(month),
  ) ?? null;
}

/** Retorna apenas o badge label da estação. */
export const seasonLabels: Record<Season, { label: string; color: string; emoji: string }> = {
  verao:     { label: 'Verão',     color: 'bg-yellow-100 text-yellow-800 border-yellow-200', emoji: '☀️' },
  outono:    { label: 'Outono',    color: 'bg-orange-100 text-orange-800 border-orange-200', emoji: '🍂' },
  inverno:   { label: 'Inverno',   color: 'bg-blue-100 text-blue-800 border-blue-200',       emoji: '❄️' },
  primavera: { label: 'Primavera', color: 'bg-pink-100 text-pink-800 border-pink-200',       emoji: '🌸' },
};

/**
 * Sugestões automáticas de preparações para o mês atual,
 * baseadas nos alimentos em safra.
 */
export interface SeasonalSuggestion {
  name: string;
  ingredients: string[];
  category: string;
  season: Season;
}

export const seasonalSuggestions: SeasonalSuggestion[] = [
  // Verão
  { name: 'Vitamina de Manga',         ingredients: ['manga', 'leite'],             category: 'Bebida',      season: 'verao' },
  { name: 'Salada de Melancia',        ingredients: ['melancia'],                   category: 'Sobremesa',   season: 'verao' },
  { name: 'Cuscuz com Milho Verde',    ingredients: ['milho', 'cuscuz'],            category: 'Lanche',      season: 'verao' },
  { name: 'Refogado de Abobrinha',     ingredients: ['abobrinha'],                  category: 'Guarnicao',   season: 'verao' },
  { name: 'Sopa de Abóbora',          ingredients: ['abóbora'],                    category: 'Prato principal', season: 'verao' },
  // Outono
  { name: 'Suco de Laranja Natural',   ingredients: ['laranja'],                    category: 'Bebida',      season: 'outono' },
  { name: 'Salada de Maçã com Cenoura', ingredients: ['maçã', 'cenoura'],          category: 'Guarnicao',   season: 'outono' },
  { name: 'Compota de Pêssego',        ingredients: ['pêssego'],                   category: 'Sobremesa',   season: 'outono' },
  // Inverno
  { name: 'Caldo Verde',              ingredients: ['couve', 'batata'],             category: 'Prato principal', season: 'inverno' },
  { name: 'Brócolis no Vapor',        ingredients: ['brócolis'],                   category: 'Guarnicao',   season: 'inverno' },
  { name: 'Salada de Beterraba',      ingredients: ['beterraba'],                  category: 'Guarnicao',   season: 'inverno' },
  { name: 'Creme de Cenoura',         ingredients: ['cenoura'],                    category: 'Prato principal', season: 'inverno' },
  { name: 'Refogado de Repolho',      ingredients: ['repolho'],                    category: 'Guarnicao',   season: 'inverno' },
  // Primavera
  { name: 'Vitamina de Morango',      ingredients: ['morango', 'leite'],           category: 'Bebida',      season: 'primavera' },
  { name: 'Salada de Tomate',         ingredients: ['tomate'],                     category: 'Guarnicao',   season: 'primavera' },
  { name: 'Refogado de Espinafre',    ingredients: ['espinafre'],                  category: 'Guarnicao',   season: 'primavera' },
  { name: 'Suco de Goiaba',           ingredients: ['goiaba'],                     category: 'Bebida',      season: 'primavera' },
];

/** Retorna as sugestões para um mês (0=Jan). */
export function getSuggestionsForMonth(month: number): SeasonalSuggestion[] {
  const inSeason = seasonalFoods.filter((sf) => sf.months.includes(month));
  const inSeasonKeywords = inSeason.flatMap((sf) => sf.keywords);
  return seasonalSuggestions.filter((s) =>
    s.ingredients.some((ing) =>
      inSeasonKeywords.some((kw) => ing.toLowerCase().includes(kw)),
    ),
  );
}
