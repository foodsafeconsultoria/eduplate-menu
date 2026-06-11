/**
 * import-tbca.mjs — gera client/src/data/tbcaFoods.ts a partir de um
 * arquivo de dados da TBCA (Tabela Brasileira de Composição de Alimentos).
 *
 * USO:
 *   node scripts/import-tbca.mjs <entrada.csv|entrada.json>
 *
 * FORMATO DE ENTRADA ACEITO:
 *
 * 1) CSV com cabeçalho (separador ; ou ,), colunas mínimas:
 *    codigo;nome;kcal;proteina;lipidios;carboidratos;fibra;calcio;ferro;zinco;vitaminaA;vitaminaC
 *    (valores por 100 g; vitaminaA em mcg RAE; demais em g ou mg conforme padrão TBCA)
 *
 * 2) JSON: array de objetos com as mesmas chaves acima.
 *
 * ONDE OBTER OS DADOS:
 *   - TBCA oficial: http://www.tbca.net.br (exportação por busca, ou solicitar base à equipe FoRC/USP)
 *   - Alternativa: dumps públicos da TBCA/TACO no GitHub (verificar versão e licença)
 *
 * O script:
 *   - normaliza números (vírgula decimal → ponto; vazio/traço/'tr' → 0)
 *   - descarta linhas sem nome ou sem kcal
 *   - deduplica por nome normalizado
 *   - gera ids estáveis 'food-tbca-<codigo>'
 *   - escreve client/src/data/tbcaFoods.ts no formato do projeto
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT = path.join(__dirname, '..', 'client', 'src', 'data', 'tbcaFoods.ts');

const inputPath = process.argv[2];
if (!inputPath) {
  console.error('Uso: node scripts/import-tbca.mjs <entrada.csv|entrada.json>');
  process.exit(1);
}

// ── Parse helpers ─────────────────────────────────────────────────────────────

function toNumber(v) {
  if (v === null || v === undefined) return 0;
  const s = String(v).trim().toLowerCase();
  if (!s || s === '-' || s === 'tr' || s === 'na' || s === 'nd' || s === '*') return 0;
  const n = parseFloat(s.replace(/\./g, (m, i) => (s.indexOf(',') > -1 ? m : m)).replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
}

function parseCsv(text) {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  const sep = (lines[0].match(/;/g) || []).length >= (lines[0].match(/,/g) || []).length ? ';' : ',';
  const header = lines[0].split(sep).map((h) => h.trim().toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')); // remove acentos
  const idx = (names) => header.findIndex((h) => names.some((n) => h.includes(n)));

  const cols = {
    codigo:   idx(['codigo', 'code', 'id']),
    nome:     idx(['nome', 'descricao', 'alimento', 'name']),
    kcal:     idx(['kcal', 'energia', 'energy']),
    proteina: idx(['protein']),
    lipidios: idx(['lipid', 'gordura', 'fat']),
    carbo:    idx(['carbo']),
    fibra:    idx(['fibra', 'fiber']),
    calcio:   idx(['calcio', 'calcium', 'ca']),
    ferro:    idx(['ferro', 'iron', 'fe']),
    zinco:    idx(['zinco', 'zinc', 'zn']),
    vitA:     idx(['vitamina a', 'vitamin a', 'vita', 'rae']),
    vitC:     idx(['vitamina c', 'vitamin c', 'vitc', 'ascorb']),
  };

  if (cols.nome === -1 || cols.kcal === -1) {
    console.error('CSV precisa ter ao menos colunas de nome e kcal. Cabeçalho lido:', header.join(' | '));
    process.exit(1);
  }

  return lines.slice(1).map((line) => {
    const parts = line.split(sep);
    const get = (i) => (i >= 0 && i < parts.length ? parts[i] : '');
    return {
      codigo:   get(cols.codigo).trim(),
      nome:     get(cols.nome).trim(),
      kcal:     toNumber(get(cols.kcal)),
      proteina: toNumber(get(cols.proteina)),
      lipidios: toNumber(get(cols.lipidios)),
      carboidratos: toNumber(get(cols.carbo)),
      fibra:    toNumber(get(cols.fibra)),
      calcio:   toNumber(get(cols.calcio)),
      ferro:    toNumber(get(cols.ferro)),
      zinco:    toNumber(get(cols.zinco)),
      vitaminaA: toNumber(get(cols.vitA)),
      vitaminaC: toNumber(get(cols.vitC)),
    };
  });
}

// ── Load input ────────────────────────────────────────────────────────────────

const raw = fs.readFileSync(inputPath, 'utf-8');
let rows;
if (inputPath.toLowerCase().endsWith('.json')) {
  const data = JSON.parse(raw);
  rows = (Array.isArray(data) ? data : data.alimentos || data.foods || []).map((r) => ({
    codigo:   String(r.codigo ?? r.code ?? r.id ?? '').trim(),
    nome:     String(r.nome ?? r.descricao ?? r.name ?? '').trim(),
    kcal:     toNumber(r.kcal ?? r.energia ?? r.energy),
    proteina: toNumber(r.proteina ?? r.protein),
    lipidios: toNumber(r.lipidios ?? r.lipids ?? r.gordura),
    carboidratos: toNumber(r.carboidratos ?? r.carbohydrates ?? r.carbo),
    fibra:    toNumber(r.fibra ?? r.fiber),
    calcio:   toNumber(r.calcio ?? r.calcium),
    ferro:    toNumber(r.ferro ?? r.iron),
    zinco:    toNumber(r.zinco ?? r.zinc),
    vitaminaA: toNumber(r.vitaminaA ?? r.vitamina_a ?? r.vitaminA ?? r.rae),
    vitaminaC: toNumber(r.vitaminaC ?? r.vitamina_c ?? r.vitaminC),
  }));
} else {
  rows = parseCsv(raw);
}

// ── Filter, dedupe, generate ──────────────────────────────────────────────────

const seen = new Set();
const foods = [];
let skipped = 0;

for (const r of rows) {
  if (!r.nome || r.kcal <= 0) { skipped++; continue; }
  const key = r.nome.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
  if (seen.has(key)) { skipped++; continue; }
  seen.add(key);
  const code = r.codigo || `x${foods.length + 1}`;
  foods.push(
    `  { id: 'food-tbca-${code}', name: ${JSON.stringify(r.nome)}, unit: 'kg', price: 0, source: 'taco', nutrients: { kcal: ${r.kcal}, protein: ${r.proteina}, lipids: ${r.lipidios}, carbohydrates: ${r.carboidratos}, fiber: ${r.fibra}, calcium: ${r.calcio}, iron: ${r.ferro}, zinc: ${r.zinco}, vitaminA: ${r.vitaminaA}, vitaminC: ${r.vitaminaC} }, createdAt: now, updatedAt: now },`
  );
}

const out = `import type { Food } from '@/types/nutrition';

/**
 * tbcaFoods — GERADO AUTOMATICAMENTE por scripts/import-tbca.mjs
 * Fonte: TBCA (tbca.net.br) — valores por 100 g/100 mL.
 * Gerado em: ${new Date().toISOString().slice(0, 10)} · ${foods.length} alimentos
 * NÃO EDITE À MÃO — rode o script novamente para atualizar.
 */
const now = new Date();

export const tbcaFoods: Food[] = [
${foods.join('\n')}
];
`;

fs.writeFileSync(OUTPUT, out, 'utf-8');
console.log(`OK: ${foods.length} alimentos gravados em ${OUTPUT} (${skipped} linhas puladas).`);
console.log('Lembrete: os preços entram zerados — a nutricionista ajusta no sistema, ou adicione coluna de preço no CSV.');
