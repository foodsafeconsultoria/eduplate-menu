/** FC = peso bruto / peso líquido ANTES da cocção. Não mede hidratação. */
export const CORRECTION_FACTOR_SOURCE = {
  label: 'Prefeitura de Pirapora — PE 045/2024, Anexo VIII, pp. 103–107',
  url: 'https://www.pirapora.mg.gov.br/public/admin/globalarq/licitacao/arquivo/76_EDITAL%20PE%20045-2024%20-%20MERENDA%20ESCOLAR.pdf',
};

// Sugestões para a forma de aquisição indicada. Confirmar por pesagem local.
// A TACO fornece composição nutricional, não estes fatores de limpeza.
const CORRECTION_FACTORS: Record<string, number> = {
  'food-200': 1.00, // Arroz branco cru
  'food-205': 1.04, // Feijão carioca cru
  'food-225': 1.12, // Ovo inteiro cru, com casca
  'food-226': 1.21, // Batata doce crua
  'food-227': 1.31, // Mandioca crua
  'food-9': 1.17, // Cenoura crua
  'food-10': 1.46, // Alface crespa
  'food-13': 1.25, // Tomate cru com sementes
  'food-234': 1.53, // Beterraba crua
  'food-235': 1.50, // Couve crua
  'food-24': 1.73, // Cebola crua
  'food-25': 1.08, // Alho cru
  'food-27': 1.54, // Repolho cru
  'food-5': 1.51, // Banana prata inteira
  'food-15': 1.50, // Laranja pera inteira
  'food-28': 1.39, // Mamão papaia inteiro
  'food-433': 1.38, // Mamão formosa inteiro
  'food-252': 1.22, // Goiaba com casca
  'food-255': 1.90, // Melancia inteira
  'food-765': 1.90,
  'food-301': 1.26, // Coentro
  'food-391': 1.18, // Cebolinha
  'food-386': 1.52, // Manjericão
  'food-222': 1.00, // Atum em conserva
  'food-26': 1.00, // Sardinha em conserva
  'food-273': 1.00, // Macarrão cru
  'food-279': 1.00, // Fubá
  'food-281': 1.00, // Farinha de trigo
  'food-21': 1.00, // Farinha de mandioca
  'food-22': 1.00, // Óleo
  'food-286': 1.00, // Manteiga
  'food-352': 1.00, // Leite condensado
  'food-298': 1.00, // Linguiça calabresa
  'food-300': 1.00, // Bacon
};

/** Sem referência verificada, retorna 0 para exigir informação, nunca 1 por omissão. */
export function getDefaultCorrectionFactor(foodId: string): number {
  return CORRECTION_FACTORS[foodId] ?? 0;
}
