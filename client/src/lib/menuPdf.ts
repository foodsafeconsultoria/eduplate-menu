import { jsPDF } from 'jspdf';
import autoTable, { type Cell } from 'jspdf-autotable';
import type { School } from '../types';
import type { Menu, MenuSlot, Recipe, SpecialDiet } from '../types/nutrition';
import type { OrgSettings } from '../hooks/useOrgSettings';
import { DIET_LABEL_MAP } from '../data/dietLabels';
import { partialMeal, partialSlots, mealScheduleText, type AttendanceMode } from './menuAttendance';

export interface MenuPdfContext {
  schools: School[];
  recipes: Recipe[];
  specialDiets: SpecialDiet[];
  settings: OrgSettings | null;
  loading?: boolean;
}
const days = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta'];
const green: [number, number, number] = [22, 101, 52];

export function menuMeals(slots: MenuSlot[], _schools: School[], fallback: string[], mode?: AttendanceMode): string[] {
  // School schedules describe serving times, not the structure of a menu.
  // Keep saved meal labels so existing preparations remain accessible.
  const labels = slots.length ? slots.map(s => s.mealLabel) : fallback;
  return Array.from(new Set(labels.map(label => mode === 'partial' ? partialMeal(label) : label)));
}

export function schoolDietNote(menu: Menu, school: School | undefined, diets: SpecialDiet[]): string {
  const stages = menu.targetCategories?.length ? menu.targetCategories : [menu.category];
  const active = diets.filter(d => d.status === 'active'
    && (school ? d.schoolId === school.id : !menu.schoolIds?.length || menu.schoolIds.includes(d.schoolId))
    && (!d.category || stages.includes(d.category)));
  if (!active.length) return '';
  // Only predefined restriction labels are public; never print medical free text or student names.
  const labels = Array.from(new Set(active.flatMap(d => d.labels || [])))
    .map(key => DIET_LABEL_MAP.get(key)?.text).filter(Boolean);
  return `ATENÇÃO: esta unidade possui estudantes com necessidades alimentares especiais${labels.length ? ` (${labels.join('; ')})` : ''}. Ofertar cardápio adaptado conforme orientação individual da RT e prevenir contato cruzado. Esta observação não substitui o cardápio adaptado.`;
}

export function slotIngredients(slot: MenuSlot, recipes: Recipe[]): string {
  const names = slot.composicao.flatMap(ins => ins.type === 'food'
    ? [ins.nome]
    : (recipes.find(recipe => recipe.id === ins.referenceId)?.ingredients || []).map(i => i.foodName));
  const unique = new Map<string, string>();
  for (const name of names) {
    const label = (name || '').trim().replace(/\s+/g, ' ');
    const key = label.toLocaleLowerCase('pt-BR');
    if (label && !unique.has(key)) unique.set(key, label);
  }
  return Array.from(unique.values()).join(', ');
}

/** Suppress only redundant labels for a single, clearly identified plain fruit. */
export function isPlainFruitSlot(slot: MenuSlot, recipes: Recipe[]): boolean {
  if (slot.composicao.length !== 1) return false;
  const ins = slot.composicao[0];
  const names = ins.type === 'food' ? [ins.nome]
    : (recipes.find(r => r.id === ins.referenceId)?.ingredients || []).map(i => i.foodName);
  if (names.length !== 1) return false;
  const fruit = (value: string) => {
    const text = value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[-,]/g, ' ').replace(/\s+/g, ' ').trim();
    return /^(maca|banana|pera|mamao|melancia|melao|laranja|tangerina|mexerica|goiaba|manga|abacaxi|uva|morango|kiwi|ameixa|pessego|caqui|abacate)(?: (?:com casca|sem casca|crua|cru|in natura|nanica|prata|maca|verde|vermelha|vermelho|formosa|papaya|palmer|tommy|pera|lima|bahia|italia|rubi|fresca|fresco|picada|picado|em pedacos|em fatias))*$/.exec(text)?.[1];
  };
  const ingredientFruit = fruit(names[0] || '');
  return Boolean(ingredientFruit && fruit(slot.nomeFantasia.trim() || ins.nome) === ingredientFruit);
}

/** Shared by the editor and export: never infer a recipe's ingredients from its title. */
export function slotCompositionIssues(slot: MenuSlot, recipes: Recipe[]): string[] {
  if (!slot.composicao.length) return slot.nomeFantasia.trim() ? ['Adicionar a composição da preparação.'] : [];
  return Array.from(new Set(slot.composicao.flatMap(ins => {
    if (ins.type === 'food') return ins.nome.trim() ? [] : ['Preencher o nome do alimento.'];
    const recipe = recipes.find(r => r.id === ins.referenceId);
    if (!recipe) return [`Vincular uma ficha técnica disponível para ${ins.nome || 'a preparação'}.`];
    if (!recipe.ingredients?.length || recipe.ingredients.some(i => !i.foodName?.trim())) {
      return [`Completar os ingredientes da ficha técnica ${recipe.name || ins.nome}.`];
    }
    return [];
  })));
}

/** Each school gets its own section. AutoTable paginates all content; no absolute bottom content. */
export function renderSchoolMenus(doc: jsPDF, menu: Menu, fallbackMeals: string[], context: MenuPdfContext): void {
  if (context.loading) throw new Error('Aguarde o carregamento dos dados das escolas, fichas e dietas.');
  const selected = context.schools.filter(s => !menu.schoolIds?.length || menu.schoolIds.includes(s.id));
  const missingIds = (menu.schoolIds || []).filter(id => !context.schools.some(s => s.id === id));
  const units: (School | undefined)[] = [...selected, ...missingIds.map(id => ({ id, name: 'Escola não disponível', createdAt: new Date(), updatedAt: new Date() }))];
  if (!units.length) units.push(undefined);
  units.forEach((school, index) => {
    if (index) doc.addPage('a4', 'landscape');
    renderSchool(doc, menu, school, fallbackMeals, context);
  });
}

function renderSchool(doc: jsPDF, menu: Menu, school: School | undefined, fallback: string[], context: MenuPdfContext) {
  const width = doc.internal.pageSize.getWidth();
  const settings = context.settings;
  const stages = menu.targetCategories?.length ? menu.targetCategories : [menu.category];
  const nursery = stages.includes('Creche');
  const rawSlots = menu.slots?.length ? menu.slots : legacySlots(menu);
  const converted = partialSlots(rawSlots);
  if (menu.attendanceMode === 'partial' && converted.conflicts.length) throw new Error('Revise as preparações dos turnos no editor antes de exportar o cardápio parcial.');
  const slots = menu.attendanceMode === 'partial' ? converted.slots : rawSlots;
  const meals = menuMeals(slots, school ? [school] : [], fallback, menu.attendanceMode);
  const textX = settings?.logoDataUrl ? 42 : 14;
  doc.setFont('helvetica', 'bold'); doc.setFontSize(10);
  const titleLines = doc.splitTextToSize(school?.name || 'Rede escolar - unidade não cadastrada', width - textX - 14);
  const location = [settings?.municipio, settings?.uf].filter(Boolean).join(' / ');
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8);
  const metaLines = doc.splitTextToSize(`${menu.title}\n${stages.join(', ')} | ${menu.referenceMonth || 'Referência não informada'}${location ? ` | ${location}` : ''}`, width - textX - 14);
  const headerHeight = 20 + titleLines.length * 4 + metaLines.length * 3.5;
  const header = () => {
    doc.setFillColor(242, 248, 244);
    doc.rect(10, 8, width - 20, headerHeight - 5, 'F');
    if (settings?.logoDataUrl) {
      try {
        const props = doc.getImageProperties(settings.logoDataUrl);
        const scale = Math.min(22 / props.width, 22 / props.height);
        doc.addImage(settings.logoDataUrl, 14, 11, props.width * scale, props.height * scale);
      } catch { /* Invalid branding must not hide the menu. */ }
    }
    doc.setTextColor(...green);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(13);
    doc.text('CARDÁPIO ESCOLAR | PNAE', textX, 16);
    doc.setFontSize(10); doc.text(titleLines, textX, 22);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8);
    doc.text(metaLines, textX, 23 + titleLines.length * 4);
    doc.setDrawColor(...green); doc.line(10, headerHeight + 4, width - 10, headerHeight + 4);
  };
  // Draw header on each page created by a table, including continuations.
  const decorated = new Set<number>();
  const table = (head: string[], body: string[][], startY: number, bottom = 15) => {
    const grid = head.length === 6;
    const dayWidth = (width - 20 - 27) / 5;
    const titleLines = new Map<string, string[]>();
    const hiddenText = new WeakMap<Cell, string[]>();
    autoTable(doc, {
      head: [head], body, startY, theme: 'grid',
      margin: { left: 10, right: 10, top: headerHeight + 8, bottom },
      styles: { font: 'helvetica', fontSize: 7.5, cellPadding: 1.7, overflow: 'linebreak', valign: 'middle', lineColor: [210, 225, 214] },
      columnStyles: grid ? {
        0: { cellWidth: 27, fontStyle: 'bold' },
        ...Object.fromEntries([1, 2, 3, 4, 5].map(i => [i, { cellWidth: dayWidth, valign: 'top' as const }])),
      } : {},
      headStyles: { fillColor: green, textColor: [255, 255, 255], fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [248, 251, 249] },
      rowPageBreak: 'avoid',
      didParseCell: ({ cell, section, column }) => {
        if (!grid || section !== 'body' || column.index === 0) return;
        const [title, ...details] = String(cell.raw).split('\n');
        doc.setFont('helvetica', 'bold'); doc.setFontSize(cell.styles.fontSize);
        const boldLines: string[] = doc.splitTextToSize(title, dayWidth - cell.padding('horizontal'));
        doc.setFont('helvetica', 'normal');
        const normalLines: string[] = details.flatMap(detail => {
          let labelExtra = 0;
          if (detail.startsWith('Ingredientes:')) {
            const normalWidth = doc.getTextWidth('Ingredientes: ');
            doc.setFont('helvetica', 'bold');
            labelExtra = doc.getTextWidth('Ingredientes: ') - normalWidth;
            doc.setFont('helvetica', 'normal');
          }
          return doc.splitTextToSize(detail, dayWidth - cell.padding('horizontal') - Math.max(0, labelExtra));
        });
        titleLines.set(String(cell.raw), boldLines);
        cell.text = [...boldLines, ...normalLines];
        // Wrapping is measured separately for each font before AutoTable calculates row heights.
        cell.styles.overflow = 'visible';
      },
      willDrawCell: ({ cell, section, column }) => {
        if (!grid || section !== 'body' || column.index === 0) return;
        hiddenText.set(cell, cell.text);
        cell.text = []; // AutoTable still draws the background and borders.
      },
      didDrawCell: ({ cell }) => {
        const lines = hiddenText.get(cell);
        if (!lines) return;
        cell.text = lines;
        const fontHeight = cell.styles.fontSize / doc.internal.scaleFactor;
        const lineHeight = fontHeight * doc.getLineHeightFactor();
        const boldLines = titleLines.get(String(cell.raw)) || [];
        doc.setFontSize(cell.styles.fontSize);
        lines.forEach((line, i) => {
          const x = cell.x + cell.padding('left');
          const y = cell.y + cell.padding('top') + fontHeight * 0.85 + i * lineHeight;
          if (line.startsWith('Ingredientes:') && !boldLines.includes(line)) {
            doc.setFont('helvetica', 'bold');
            doc.text('Ingredientes:', x, y);
            const indent = doc.getTextWidth('Ingredientes: ');
            doc.setFont('helvetica', 'normal');
            doc.text(line.slice('Ingredientes:'.length).trimStart(), x + indent, y);
            return;
          }
          doc.setFont('helvetica', boldLines.includes(line) ? 'bold' : 'normal');
          doc.text(line, x, y);
        });
        hiddenText.delete(cell);
      },
      willDrawPage: () => {
        const page = doc.getCurrentPageInfo().pageNumber;
        if (!decorated.has(page)) { header(); decorated.add(page); }
      },
    });
    return (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 3;
  };
  const dateLabels = days.map((day, i) => {
    if (!menu.weekStartDate) return day;
    const date = new Date(`${menu.weekStartDate}T12:00:00`);
    if (Number.isNaN(date.getTime())) return day;
    date.setDate(date.getDate() + i);
    return `${day} ${date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}`;
  });
  let y = table(['Refeição / horário', ...dateLabels], meals.map(meal => [
    `${meal}\n${mealScheduleText(meal, school, menu.attendanceMode)}`,
    ...days.map(day => {
      const slot = slots.find(s => s.dayLabel === day && s.mealLabel === meal);
      if (!slot || (!slot.nomeFantasia && !slot.composicao.length)) return 'Não planejado';
      const ingredients = isPlainFruitSlot(slot, context.recipes) ? '' : slotIngredients(slot, context.recipes);
      return [slot.nomeFantasia || slot.composicao.map(i => i.nome).join(', '),
        ingredients ? `\nIngredientes: ${ingredients}` : '',
        slotCompositionIssues(slot, context.recipes).length ? 'Composição pendente de revisão.' : '',
        nursery ? `Consistência: ${slot.consistency?.trim() || 'não informada'}` : '',
      ].filter(Boolean).join('\n');
    }),
  ]), headerHeight + 8);

  const nutrientKeys = ['kcal', 'carbohydrates', 'protein', 'lipids', 'calcium', 'iron', 'zinc', 'vitaminA', 'vitaminC'] as const;
  const totals = days.map(day => nutrientKeys.map(key => slots.filter(s => s.dayLabel === day)
    .flatMap(s => s.composicao).reduce((sum, ins) => sum + (ins.valoresNutricionaisBase?.[key] || 0)
      * (ins.pesoReferencia > 0 ? ins.pesoAtual / ins.pesoReferencia : 0), 0)));
  const dietNote = schoolDietNote(menu, school, context.specialDiets);
  const notes = ['Os itens ou o cardápio poderão sofrer alterações conforme a disponibilidade de alimentos.',
    dietNote,
    menu.attendanceMode === 'partial' ? 'Atendimento parcial: manhã OU tarde. As refeições compartilhadas são contabilizadas uma única vez nos valores por aluno.' : '',
    'Valores calculados a partir das porções e composições cadastradas. A RT deve validar as necessidades por faixa etária, período de atendimento e os cardápios adaptados.',
    'Referência: Resolução CD/FNDE nº 4/2026, arts. 17 e 18.'].filter(Boolean);
  y = table(['Observações e revisão técnica'], notes.map(n => [n]), y);
  const signatureSpace = settings?.signatureDataUrl ? 17 : 9;
  y = table(['Nutrientes por aluno / dia', 'Energia (kcal)', 'CHO (g)', 'PTN (g)', 'LIP (g)', 'Ca (mg)', 'Fe (mg)', 'Zn (mg)', 'Vit. A (µg)', 'Vit. C (mg)'],
    days.map((day, i) => [dateLabels[i], ...totals[i].map(n => slots.some(s => s.dayLabel === day && s.composicao.length) ? n.toFixed(1) : '-')]), y, 34 + signatureSpace);
  const name = settings?.nutritionistName?.trim() || 'Nome da RT não cadastrado';
  const crn = settings?.nutritionistCrn?.trim() || 'não cadastrado';
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9);
  const signerLines = doc.splitTextToSize(`${name} | CRN ${crn}`, width - 30);
  if (y + signatureSpace + 12 + signerLines.length * 4 > doc.internal.pageSize.getHeight() - 15) { doc.addPage(); header(); y = headerHeight + 10; }
  let signed = false;
  if (settings?.signatureDataUrl) {
    try {
      const props = doc.getImageProperties(settings.signatureDataUrl);
      const scale = Math.min(55 / props.width, 15 / props.height);
      doc.addImage(settings.signatureDataUrl, width / 2 - props.width * scale / 2, y, props.width * scale, props.height * scale);
      signed = true;
    } catch { /* Keep the signature line available. */ }
  }
  doc.setDrawColor(110); doc.line(width / 2 - 55, y + signatureSpace, width / 2 + 55, y + signatureSpace);
  doc.setTextColor(45); doc.setFont('helvetica', 'normal'); doc.setFontSize(9);
  doc.text(signerLines, width / 2, y + signatureSpace + 5, { align: 'center' });
  doc.setFontSize(8); doc.text(`Nutricionista responsável técnico(a)${signed ? '' : ' - assinatura pendente'}`, width / 2, y + signatureSpace + 8 + signerLines.length * 4, { align: 'center' });
}

function legacySlots(menu: Menu): MenuSlot[] {
  const slots: MenuSlot[] = [];
  for (const item of menu.items || []) {
    let slot = slots.find(s => s.dayLabel === item.dayLabel && s.mealLabel === item.mealLabel);
    if (!slot) { slot = { id: item.id, dayLabel: item.dayLabel, mealLabel: item.mealLabel, nomeFantasia: '', composicao: [] }; slots.push(slot); }
    slot.nomeFantasia = [slot.nomeFantasia, item.displayName || item.name].filter(Boolean).join(', ');
    slot.composicao.push({ id: item.id, nome: item.name, type: item.type, referenceId: item.referenceId,
      pesoReferencia: 1, pesoAtual: 1, valoresNutricionaisBase: item.nutrients, custoBase: item.estimatedCost });
  }
  return slots;
}

export function numberMenuPages(doc: jsPDF) {
  const count = doc.getNumberOfPages();
  for (let p = 1; p <= count; p++) {
    doc.setPage(p); doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(100);
    doc.text(`PNAE | Cardápio escolar - Página ${p} de ${count}`, 10, doc.internal.pageSize.getHeight() - 7);
  }
}
