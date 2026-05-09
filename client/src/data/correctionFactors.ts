/**
 * Fatores de Correção (FC) padrão para alimentos da Tabela TACO.
 * FC = Peso Bruto / Peso Líquido (sempre >= 1.0)
 * Fonte: PNAE / UNIFESP / literatura de técnica dietética.
 *
 * Alimentos já limpos, cozidos ou processados têm FC = 1.00.
 * Alimentos crus com casca, folhas, ossos ou talos têm FC > 1.00.
 */

const CORRECTION_FACTORS: Record<string, number> = {
  // ── Arroz ────────────────────────────────────────────────────────────────
  'food-1':   1.00, // Arroz branco cozido
  'food-200': 1.00, // Arroz branco cru
  'food-201': 1.00, // Arroz integral cozido
  'food-202': 1.00, // Arroz integral cru
  'food-203': 1.00, // Arroz parboilizado cozido
  'food-204': 1.00, // Arroz parboilizado cru

  // ── Feijão ────────────────────────────────────────────────────────────────
  'food-2':   1.00, // Feijão carioca cozido
  'food-205': 1.00, // Feijão carioca cru
  'food-206': 1.00, // Feijão preto cozido
  'food-207': 1.00, // Feijão preto cru
  'food-208': 1.00, // Feijão verde cozido
  'food-209': 1.00, // Lentilha cozida
  'food-210': 1.00, // Lentilha crua
  'food-211': 1.00, // Ervilha cozida
  'food-212': 1.00, // Grão de bico cozido
  'food-213': 1.00, // Soja cozida

  // ── Carnes e proteínas ───────────────────────────────────────────────────
  'food-3':   1.00, // Peito de frango grelhado
  'food-214': 1.21, // Coxa de frango assada (osso)
  'food-215': 1.23, // Frango inteiro cru (osso + pele + miúdos)
  'food-11':  1.10, // Carne bovina acém cozida
  'food-216': 1.10, // Carne bovina patinho cozido
  'food-217': 1.10, // Carne bovina músculo cozido
  'food-218': 1.12, // Carne bovina picanha grelhada
  'food-219': 1.00, // Carne bovina moída cozida
  'food-220': 1.15, // Carne suína pernil cozido
  'food-221': 1.00, // Linguiça de frango grelhada
  'food-26':  1.00, // Sardinha em conserva (já limpa)
  'food-222': 1.00, // Atum em conserva
  'food-223': 1.17, // Tilápia filé grelhado (pele)
  'food-224': 1.10, // Merluza cozida
  'food-7':   1.00, // Ovo de galinha cozido
  'food-225': 1.00, // Ovo de galinha cru

  // ── Tubérculos e raízes ──────────────────────────────────────────────────
  'food-4':   1.10, // Batata doce cozida (casca amolecida)
  'food-226': 1.10, // Batata doce crua
  'food-12':  1.25, // Mandioca cozida (casca grossa)
  'food-227': 1.25, // Mandioca crua
  'food-228': 1.15, // Batata inglesa cozida
  'food-229': 1.15, // Batata inglesa crua
  'food-230': 1.14, // Inhame cozido
  'food-231': 1.25, // Aipim / Macaxeira cozido

  // ── Verduras e legumes ───────────────────────────────────────────────────
  'food-9':   1.10, // Cenoura crua
  'food-232': 1.10, // Cenoura cozida
  'food-10':  1.37, // Alface crespa (talos)
  'food-13':  1.10, // Tomate cru (pedúnculo)
  'food-16':  1.20, // Abobrinha cozida
  'food-233': 1.20, // Abobrinha crua
  'food-17':  1.10, // Beterraba cozida
  'food-234': 1.10, // Beterraba crua
  'food-18':  1.20, // Chuchu cozido (casca + caroço)
  'food-19':  1.40, // Couve refogada (talos)
  'food-235': 1.40, // Couve crua
  'food-20':  1.50, // Milho verde cozido (palha + sabugo)
  'food-24':  1.16, // Cebola crua
  'food-25':  1.30, // Alho cru
  'food-27':  1.15, // Repolho cru (folhas externas + talo)
  'food-236': 1.15, // Repolho cozido
  'food-237': 1.30, // Espinafre cozido (talos)
  'food-238': 1.30, // Espinafre cru
  'food-239': 1.50, // Brócolis cozido (talo + folhas)
  'food-240': 1.50, // Brócolis cru
  'food-241': 1.40, // Couve-flor cozida
  'food-242': 1.14, // Berinjela cozida
  'food-243': 1.20, // Pimentão verde cru
  'food-244': 1.20, // Pimentão vermelho cru
};

/**
 * Retorna o fator de correção padrão para um alimento.
 * Retorna 1.0 se o alimento não tiver FC cadastrado.
 */
export function getDefaultCorrectionFactor(foodId: string): number {
  return CORRECTION_FACTORS[foodId] ?? 1.0;
}
