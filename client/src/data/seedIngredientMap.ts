/**
 * Mapa de vínculo dos ingredientes das fichas-modelo (DEFAULT_RECIPES) aos
 * alimentos reais do banco (nutritionFoods.ts — tabela TACO, com nutriente e preço).
 *
 * Ao importar a biblioteca inicial, cada ingrediente é ligado ao seu food.id
 * aqui mapeado, e a nutrição/custo da ficha é CALCULADA AO VIVO pelo mesmo
 * motor das fichas criadas manualmente — garantindo valores reais, nunca zerados.
 *
 * Itens sem contribuição relevante aos 10 nutrientes monitorados (água, alguns
 * temperos secos) ficam de fora propositalmente — contribuem ~0 e não distorcem.
 */
export const SEED_INGREDIENT_MAP: Record<string, string> = {
  // Cereais, massas, farináceos
  'Arroz mix': 'food-200',
  'Arroz polido': 'food-200',
  'Macarrão': 'food-273',
  'Macarrão (parafuso ou penne)': 'food-273',
  'Fubá de milho': 'food-279',
  'Farinha de trigo': 'food-281',
  'Farinha de mandioca': 'food-21',
  'Amido de milho': 'food-283',
  'Trigo para kibe': 'food-618',
  'Biscoito maisena': 'food-276',

  // Leguminosas
  'Feijão carioca': 'food-205',
  'Feijão preto': 'food-207',
  'Grão de bico': 'food-364',
  'Ervilha em conserva': 'food-642',

  // Carnes e proteínas
  'Carne bovina': 'food-217',
  'Carne bovina (músculo ou acém)': 'food-217',
  'Carne bovina (músculo)': 'food-217',
  'Carne bovina (patinho ou coxão mole)': 'food-216',
  'Carne bovina moída': 'food-219',
  'Carne bovina ou frango': 'food-217',
  'Carne seca dessalgada': 'food-350',
  'Costelinha suína': 'food-410',
  'Lombo suíno': 'food-411',
  'Lombo suíno fatiado': 'food-411',
  'Bacon': 'food-300',
  'Linguiça calabresa': 'food-298',
  'Paio': 'food-298',
  'Frango (coxa e sobrecoxa)': 'food-214',
  'Frango em pedaços': 'food-215',
  'Frango inteiro ou em pedaços': 'food-215',
  'Peito de frango': 'food-3',
  'Atum em conserva': 'food-222',
  'Ovos': 'food-225',
  'Gemas': 'food-558',

  // Laticínios e gorduras
  'Leite': 'food-6',
  'Leite integral': 'food-6',
  'Leite em pó integral': 'food-267',
  'Leite condensado': 'food-352',
  'Creme de leite': 'food-351',
  'Queijo mussarela ralado': 'food-423',
  'Queijo parmesão ralado': 'food-270',
  'Ricota fresca': 'food-422',
  'Manteiga': 'food-286',
  'Margarina': 'food-285',
  'Maionese': 'food-503',
  'Óleo': 'food-22',
  'Azeite': 'food-284',

  // Tubérculos e raízes
  'Batata doce': 'food-226',
  'Batata inglesa': 'food-229',
  'Mandioca (aipim)': 'food-227',

  // Legumes e verduras
  'Abobrinha': 'food-233',
  'Abóbora moranga': 'food-448',
  'Beterraba': 'food-234',
  'Cenoura': 'food-9',
  'Cebola': 'food-24',
  'Cebola fatiada': 'food-24',
  'Cebola picada': 'food-24',
  'Alho picado': 'food-25',
  'Repolho': 'food-27',
  'Couve manteiga': 'food-575',
  'Tomate': 'food-13',
  'Tomate maduro': 'food-13',
  'Pepino': 'food-250',
  'Pimentão': 'food-243',
  'Pimentão verde': 'food-243',
  'Pimentão colorido': 'food-244',
  'Milho verde cozido': 'food-20',
  'Champignon em conserva': 'food-537',
  'Cebolinha': 'food-391',
  'Salsinha': 'food-392',
  'Manjericão': 'food-386',
  'Hortelã': 'food-387',
  'Alecrim': 'food-389',

  // Frutas
  'Banana nanica': 'food-251',
  'Limão': 'food-262',

  // Molhos, condimentos e doces
  'Molho de tomate pronto': 'food-289',
  'Extrato de tomate': 'food-290',
  'Mostarda': 'food-495',
  'Orégano': 'food-291',
  'Açúcar': 'food-23',
  'Sal': 'food-30',
  'Achocolatado em pó': 'food-293',
  'Cacau em pó ou achocolatado': 'food-341',
  'Café moído': 'food-294',
  'Canela em pó': 'food-494',
  'Açafrão': 'food-490',
  'Fermento em pó': 'food-340',

  // Itens propositalmente sem vínculo (contribuição ~0 aos nutrientes monitorados):
  // 'Água', 'Água quente', 'Cravo', 'Louro', 'Ervas finas', 'Pimenta síria', 'Páprica'
};
