import type { Food } from '@/types/nutrition';

/**
 * tbcaFoods — alimentos importados da TBCA (Tabela Brasileira de Composição
 * de Alimentos — USP/FoRC, tbca.net.br), complementando a base TACO.
 *
 * ESTE ARQUIVO É GERADO POR SCRIPT — não edite à mão.
 * Para gerar/atualizar: node scripts/import-tbca.mjs <arquivo-de-dados>
 * (ver instruções no próprio script)
 *
 * Convenções (iguais a nutritionFoods.ts):
 *   - Valores nutricionais por 100 g/100 mL do alimento como descrito
 *   - id no padrão 'food-tbca-<código TBCA>'
 *   - source: 'taco' (mantido por compatibilidade com o tipo Food;
 *     o id identifica a origem TBCA)
 *   - price: estimativa editável pela nutricionista no sistema
 *
 * Os alimentos daqui são mesclados automaticamente ao banco existente
 * pelo useFoods (novos ids entram sem sobrescrever personalizações).
 */
export const tbcaFoods: Food[] = [
  // Aguardando importação — execute scripts/import-tbca.mjs
];
