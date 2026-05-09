/**
 * Mapeamento de alérgenos por palavras-chave no nome do alimento.
 * Baseado na Resolução ANVISA RDC 26/2015 — 14 grupos alérgicos de
 * declaração obrigatória no Brasil.
 *
 * Retorna um array de strings com os alérgenos identificados.
 */

interface AllergenRule {
  allergen: string;
  keywords: string[];
}

const ALLERGEN_RULES: AllergenRule[] = [
  {
    allergen: 'Glúten (trigo)',
    keywords: [
      'trigo', 'farinha de trigo', 'centeio', 'cevada', 'aveia',
      'macarrão', 'massa', 'pão', 'biscoito', 'bolacha', 'bolo',
      'coxinha', 'empanado', 'panko', 'farinha', 'amido de trigo',
      'sêmola', 'semolina', 'espaguete', 'fusilli', 'talharim',
    ],
  },
  {
    allergen: 'Leite / Lactose',
    keywords: [
      'leite', 'creme de leite', 'queijo', 'iogurte', 'manteiga',
      'requeijão', 'nata', 'creme', 'butter', 'whey', 'ricota',
      'muçarela', 'mozzarella', 'parmesão', 'gruyère', 'cottage',
      'cheddar', 'cream cheese', 'leite em pó', 'leite condensado',
      'brigadeiro', 'achocolatado', 'chocolate ao leite',
    ],
  },
  {
    allergen: 'Ovo',
    keywords: [
      'ovo', 'ovos', 'clara', 'gema', 'mayonese', 'maionese',
      'merengue', 'albumina',
    ],
  },
  {
    allergen: 'Soja',
    keywords: [
      'soja', 'tofu', 'extrato de soja', 'proteína de soja',
      'proteína texturizada', 'pts', 'pvt', 'tempeh',
    ],
  },
  {
    allergen: 'Amendoim',
    keywords: [
      'amendoim', 'pasta de amendoim', 'manteiga de amendoim',
    ],
  },
  {
    allergen: 'Nozes / Castanhas',
    keywords: [
      'nozes', 'noz', 'amêndoa', 'amêndoas', 'castanha',
      'avelã', 'macadâmia', 'pistache', 'pecã', 'pecan',
      'pinhão', 'pinhao', 'caju',
    ],
  },
  {
    allergen: 'Peixes',
    keywords: [
      'peixe', 'sardinha', 'atum', 'tilápia', 'tilápía', 'tilapia',
      'merluza', 'cação', 'bacalhau', 'salmão', 'saint peter',
      'traíra', 'robalo', 'pescada', 'anchovas', 'anchova',
    ],
  },
  {
    allergen: 'Crustáceos',
    keywords: [
      'camarão', 'caranguejo', 'lagosta', 'lagostim', 'siri',
    ],
  },
  {
    allergen: 'Moluscos',
    keywords: [
      'lula', 'polvo', 'mexilhão', 'ostra', 'vieira', 'mariscos',
    ],
  },
  {
    allergen: 'Gergelim',
    keywords: ['gergelim', 'tahine', 'tahini'],
  },
  {
    allergen: 'Mostarda',
    keywords: ['mostarda'],
  },
  {
    allergen: 'Aipo / Salsão',
    keywords: ['aipo', 'salsão'],
  },
  {
    allergen: 'Sulfitos',
    keywords: ['vinho', 'vinagre balsâmico', 'frutas secas', 'uva passa'],
  },
  {
    allergen: 'Tremoço',
    keywords: ['tremoço', 'tremoco'],
  },
];

/**
 * Detecta alérgenos a partir do nome do alimento.
 * Busca por correspondência parcial (substring) case-insensitive.
 */
export function detectAllergens(foodName: string): string[] {
  const lower = foodName.toLowerCase();
  const found: string[] = [];

  for (const rule of ALLERGEN_RULES) {
    for (const kw of rule.keywords) {
      if (lower.includes(kw.toLowerCase())) {
        if (!found.includes(rule.allergen)) {
          found.push(rule.allergen);
        }
        break; // next rule
      }
    }
  }

  // Margarina: contém leite E soja na maioria das formulações
  if (lower.includes('margarina')) {
    if (!found.includes('Leite / Lactose')) found.push('Leite / Lactose');
    if (!found.includes('Soja'))            found.push('Soja');
  }

  return found;
}
