import { describe, expect, it, vi } from 'vitest';
import { jsPDF } from 'jspdf';
import { mkdirSync, writeFileSync } from 'node:fs';
import { menuMeals, numberMenuPages, renderSchoolMenus, schoolDietNote, slotIngredients, slotCompositionIssues, isPlainFruitSlot } from './menuPdf';
import type { MenuPdfContext } from './menuPdf';
import type { Menu, Recipe, SpecialDiet } from '../types/nutrition';
import type { School } from '../types';
import { editorMeals, partialSlots, mealScheduleText } from './menuAttendance';

const now = new Date('2026-09-17T12:00:00');
const school: School = { id: 'a', name: 'Escola Municipal de Educação Infantil - Unidade Jardim das Flores',
  mealSchedules: [{ mealLabel: 'Almoço', time: '11:30' }, { mealLabel: 'Lanche', time: '14:00' }], createdAt: now, updatedAt: now };
const nutrients = { kcal: 300, protein: 12, carbohydrates: 40, lipids: 10, calcium: 120, iron: 3, zinc: 2, vitaminA: 100, vitaminC: 12, fiber: 4 };
const recipe = { id: 'r', name: 'Arroz com legumes', ingredients: [{ foodName: 'Arroz' }, { foodName: 'Cenoura' }, { foodName: 'Óleo' }, { foodName: 'Sal' }] } as Recipe;
const menu = { id: 'menu', title: 'Cardápio semanal - setembro', category: 'Creche', targetCategories: ['Creche'], schoolIds: ['a'], referenceMonth: 'Setembro 2026', weekStartDate: '2026-09-14', items: [],
  slots: ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta'].flatMap(dayLabel => ['Almoço', 'Lanche'].map(mealLabel => ({
    id: `${dayLabel}-${mealLabel}`, dayLabel, mealLabel, nomeFantasia: 'Arroz com legumes', consistency: 'Arroz macio e legumes bem cozidos, amassados',
    composicao: [{ id: 'i', nome: recipe.name, type: 'recipe' as const, referenceId: 'r', pesoReferencia: 100, pesoAtual: 150, valoresNutricionaisBase: nutrients, custoBase: 2 }],
  }))), responsibleName: 'Usuário que não é a RT',
} as Menu;
const diet = { id: 'd', schoolId: 'a', schoolName: school.name, studentName: 'NOME PRIVADO', category: 'Creche', labels: ['sem-gluten'], prescription: 'PRESCRIÇÃO PRIVADA', diagnosis: 'DIAGNÓSTICO PRIVADO', status: 'active', createdAt: now, updatedAt: now } as SpecialDiet;
const context: MenuPdfContext = { schools: [school], recipes: [recipe], specialDiets: [diet], settings: { nutritionistName: 'Nutricionista de exemplo', nutritionistCrn: 'EXEMPLO', municipio: 'Município de exemplo', uf: 'SP' } };

describe('Cardápio por escola', () => {
  it('permite adicionar almoço ao reabrir um cardápio salvo somente com café', () => {
    expect(editorMeals(['Café da manhã', 'Almoço', 'Café da tarde', 'Jantar'], ['Café manhã/tarde'], 'partial'))
      .toEqual(['Café manhã/tarde', 'Almoço/Jantar']);
    expect(editorMeals(['Almoço/Jantar', 'Lanche'], ['Café manhã/tarde'], 'partial'))
      .toEqual(['Almoço/Jantar', 'Lanche', 'Café manhã/tarde']);
  });
  it('mantém refeições vazias e personalizadas disponíveis durante a edição', () => {
    expect(editorMeals(['Almoço', 'Lanche'], [], 'integral')).toEqual(['Almoço', 'Lanche']);
    expect(editorMeals(['Almoço', 'Lanche'], ['Colação'], 'integral')).toEqual(['Almoço', 'Lanche', 'Colação']);
  });
  it('não reintroduz almoço combinado após separar as refeições integrais', () => {
    expect(editorMeals(['Almoço/Jantar', 'Lanche'], ['Almoço', 'Jantar'], 'integral'))
      .toEqual(['Almoço', 'Jantar', 'Lanche']);
  });
  it('conta turnos alternativos uma vez e preserva horários e escolhas de porção', () => {
    const slots = ['Café da manhã', 'Café da tarde', 'Almoço', 'Jantar'].map((mealLabel, i) => ({ ...menu.slots[0], id: String(i), mealLabel }));
    const converted = partialSlots(slots);
    expect(converted.conflicts).toHaveLength(0);
    expect(converted.slots.map(s => s.mealLabel)).toEqual(['Café manhã/tarde', 'Almoço/Jantar']);
    const unit = { ...school, mealSchedules: slots.map((s, i) => ({ mealLabel: s.mealLabel, time: ['07:00', '13:00', '11:00', '17:00'][i] })) };
    expect(mealScheduleText('Café manhã/tarde', unit, 'partial')).toBe('Café da manhã: 07:00\nCafé da tarde: 13:00');
    expect(menuMeals(slots, [unit], [], 'partial')).toHaveLength(2);
    expect(menuMeals(slots, [unit], [], 'integral')).toHaveLength(4);
    const changed = slots.map((s, i) => i === 1 ? { ...s, composicao: s.composicao.map(ins => ({ ...ins, pesoAtual: 200 })) } : s);
    const conflict = partialSlots(changed).conflicts[0];
    expect(conflict.options).toHaveLength(2);
    expect(partialSlots(changed, { [conflict.key]: '1' }).slots[0].composicao[0].pesoAtual).toBe(200);
    const doc = new jsPDF({ orientation: 'landscape' });
    renderSchoolMenus(doc, { ...menu, attendanceMode: 'partial', slots }, [], { ...context, schools: [unit] });
    expect(doc.output()).toContain('07:00');
    expect(doc.output()).toContain('17:00');
    expect(doc.output()).toContain('(900.0)');
    expect(doc.output()).not.toContain('(1800.0)');
    expect(() => renderSchoolMenus(new jsPDF(), { ...menu, attendanceMode: 'partial', slots: changed }, [], context)).toThrow('Revise');
    if (process.env.MENU_PDF_QA) writeFileSync('tmp/pdfs/cardapio-parcial.pdf', Buffer.from(doc.output('arraybuffer')));
  });
  it('usa a estrutura do cardápio e preserva preparações de cardápios antigos', () => {
    expect(menuMeals(menu.slots, [school], ['Jantar'])).toEqual(['Almoço', 'Lanche']);
    expect(menuMeals([...menu.slots, { ...menu.slots[0], mealLabel: 'Jantar' }], [school], [])).toContain('Jantar');
    expect(menuMeals([], [], ['Lanche'])).toEqual(['Lanche']);
  });
  it('não cria refeições a partir dos horários de várias escolas', () => {
    const other = { ...school, id: 'b', mealSchedules: ['Desjejum', 'Jantar', 'Lanche da Manhã', 'Lanche da manhã', 'Almoço da tarde'].map(mealLabel => ({ mealLabel, time: '10:00' })) };
    expect(menuMeals([], [school, other], ['Almoço/Jantar', 'Lanche'], 'partial')).toEqual(['Almoço/Jantar', 'Lanche']);
    expect(menuMeals(menu.slots, [school, other], ['Almoço', 'Lanche'], 'integral')).toEqual(['Almoço', 'Lanche']);
  });
  it('filtra dietas por escola, etapa e situação, sem divulgar dados individuais', () => {
    const note = schoolDietNote(menu, school, [diet]);
    expect(note).toContain('Sem Glúten');
    expect(note).not.toContain('PRIVAD');
    for (const change of [{ schoolId: 'b' }, { status: 'inactive' as const }, { category: 'Médio' }]) {
      expect(schoolDietNote(menu, school, [{ ...diet, ...change }])).toBe('');
    }
    expect(schoolDietNote(menu, school, [{ ...diet, labels: [], restrictionCode: 'outro' }])).toContain('necessidades alimentares especiais');
  });
  it('combina fichas e alimentos diretos sem repetir ingredientes, preservando preparos diferentes', () => {
    expect(slotIngredients(menu.slots[0], [recipe])).toBe('Arroz, Cenoura, Óleo, Sal');
    const food = { ...menu.slots[0].composicao[0], type: 'food' as const, nome: '  CENOURA  ' };
    expect(slotIngredients({ ...menu.slots[0], composicao: [...menu.slots[0].composicao, food, { ...food, nome: 'Cenoura cozida' }] }, [recipe]))
      .toBe('Arroz, Cenoura, Óleo, Sal, Cenoura cozida');
  });
  it('identifica composições ausentes ou incompletas sem inventar ingredientes', () => {
    const slot = menu.slots[0];
    expect(slotIngredients(slot, [])).toBe('');
    expect(slotCompositionIssues(slot, [recipe])).toEqual([]);
    expect(slotCompositionIssues(slot, [])[0]).toContain('Vincular uma ficha');
    expect(slotCompositionIssues(slot, [{ ...recipe, ingredients: [] }])[0]).toContain('Completar os ingredientes');
    expect(slotCompositionIssues({ ...slot, composicao: [] }, [])).toEqual(['Adicionar a composição da preparação.']);
    expect(slotCompositionIssues({ ...slot, composicao: [], nomeFantasia: '' }, [])).toEqual([]);
  });
  it('gera páginas por escola com horários próprios, nutrientes escalados e RT', () => {
    const doc = new jsPDF({ orientation: 'landscape' });
    renderSchoolMenus(doc, { ...menu, schoolIds: [] }, ['Almoço', 'Lanche'], { ...context, schools: [school, { ...school, id: 'b', name: 'Escola B', mealSchedules: [{ mealLabel: 'Almoço', time: '12:15' }, { mealLabel: 'Lanche', time: '15:00' }] }] });
    numberMenuPages(doc);
    const pdf = doc.output();
    expect(pdf).toContain('11:30'); expect(pdf).toContain('12:15');
    expect(pdf).toContain('900.0'); // two 450 kcal portions per day
    expect(pdf).toContain('CRN EXEMPLO'); expect(pdf).not.toContain(menu.responsibleName);
    expect(pdf).not.toContain('NOME PRIVADO'); expect(pdf).not.toContain('PRESCRI');
    expect(pdf).toContain('Consistência:');
    expect(pdf).toContain('Ingredientes:');
    expect(pdf).toContain('Arroz, Cenoura');
    expect(pdf).toContain('disponibilidade de alimentos');
    expect(pdf.indexOf('disponibilidade de alimentos')).toBeLessThan(pdf.indexOf('Nutrientes por aluno'));
    expect(doc.getNumberOfPages()).toBeGreaterThanOrEqual(2);
    if (process.env.MENU_PDF_QA) {
      mkdirSync('tmp/pdfs', { recursive: true });
      writeFileSync('tmp/pdfs/cardapio-escolas.pdf', Buffer.from(doc.output('arraybuffer')));
    }
  });
  it('não exporta antes do carregamento e preserva valores de cardápios legados', () => {
    const doc = new jsPDF({ orientation: 'landscape' });
    expect(() => renderSchoolMenus(doc, menu, [], { ...context, loading: true })).toThrow();
    renderSchoolMenus(doc, { ...menu, slots: [], items: [{ id: 'old', dayLabel: 'Segunda', mealLabel: 'Almoço', type: 'recipe', referenceId: 'r', name: recipe.name, displayName: recipe.name, nutrients, perCapita: 150 } as Menu['items'][number]] }, ['Almoço'], context);
    expect(doc.output()).toContain('300.0');
  });
  it('imprime o nome fantasia em negrito e os alimentos diretos em fonte normal', () => {
    const doc = new jsPDF({ orientation: 'landscape' });
    const drawn: { text: string; style: string }[] = [];
    const originalText = doc.text.bind(doc);
    vi.spyOn(doc, 'text').mockImplementation(((...args: Parameters<typeof doc.text>) => {
      drawn.push({ text: String(args[0]), style: doc.getFont().fontStyle });
      return originalText(...args);
    }) as typeof doc.text);
    const mixed = { ...menu, slots: menu.slots.map(s => ({ ...s, composicao: [...s.composicao, {
      ...s.composicao[0], id: 'direct-food', type: 'food' as const, nome: 'Cenoura cozida',
    }] })) };
    renderSchoolMenus(doc, mixed, [], context);
    numberMenuPages(doc);
    expect(drawn.some(d => d.text === 'Arroz com legumes' && d.style === 'bold')).toBe(true);
    expect(drawn.some(d => d.text === 'Ingredientes:' && d.style === 'bold')).toBe(true);
    expect(drawn.some(d => d.text.startsWith('Arroz, Cenoura') && d.style === 'normal')).toBe(true);
    expect(doc.output()).toContain('Óleo'); // ingredient available only inside the recipe
    expect(doc.output()).toContain('Cenoura cozida');
    if (process.env.MENU_PDF_QA) writeFileSync('tmp/pdfs/cardapio-misto.pdf', Buffer.from(doc.output('arraybuffer')));
  });
  it('oculta ingredientes redundantes de frutas, mas mantém misturas e preparações', () => {
    const fruitSlot = { ...menu.slots[0], nomeFantasia: 'Maçã', composicao: [{ ...menu.slots[0].composicao[0], type: 'food' as const, nome: 'Maçã com casca' }] };
    expect(isPlainFruitSlot(fruitSlot, [])).toBe(true);
    expect(isPlainFruitSlot({ ...fruitSlot, nomeFantasia: 'Banana', composicao: [{ ...fruitSlot.composicao[0], nome: 'Banana nanica' }] }, [])).toBe(true);
    expect(isPlainFruitSlot({ ...fruitSlot, composicao: [...fruitSlot.composicao, { ...fruitSlot.composicao[0], nome: 'Mel' }] }, [])).toBe(false);
    expect(isPlainFruitSlot({ ...fruitSlot, nomeFantasia: 'Maçã com canela' }, [])).toBe(false);
    expect(isPlainFruitSlot({ ...fruitSlot, composicao: [{ ...fruitSlot.composicao[0], nome: 'Maçã em calda' }] }, [])).toBe(false);
    const doc = new jsPDF({ orientation: 'landscape' });
    renderSchoolMenus(doc, { ...menu, category: 'Fundamental 1', targetCategories: ['Fundamental 1'], slots: [fruitSlot] }, [], context);
    expect(doc.output()).toContain('(Maçã)');
    expect(doc.output()).not.toContain('Ingredientes:');
    if (process.env.MENU_PDF_QA) writeFileSync('tmp/pdfs/cardapio-fruta.pdf', Buffer.from(doc.output('arraybuffer')));
  });
  it('inclui consistência somente nas etapas que atendem creche', () => {
    const doc = new jsPDF({ orientation: 'landscape' });
    renderSchoolMenus(doc, { ...menu, category: 'Fundamental 1', targetCategories: ['Fundamental 1'] }, [], context);
    expect(doc.output()).not.toContain('Consistência');
    expect(doc.output()).not.toContain('consistência');
    const nurseryDoc = new jsPDF({ orientation: 'landscape' });
    renderSchoolMenus(nurseryDoc, { ...menu, slots: menu.slots.map(s => ({ ...s, consistency: '' })) }, [], context);
    expect(nurseryDoc.output()).toContain('Consistência: não informada');
    expect(nurseryDoc.output()).toContain('Informar a consistência');
  });
  it('pagina conteúdo longo e registra pendências', () => {
    const doc = new jsPDF({ orientation: 'landscape' });
    const longMenu = { ...menu, slots: menu.slots.map(s => ({ ...s, nomeFantasia: 'Preparação com descrição extensa. '.repeat(18), consistency: '' })) };
    renderSchoolMenus(doc, longMenu, [], { ...context, settings: null });
    numberMenuPages(doc);
    expect(doc.getNumberOfPages()).toBeGreaterThan(1);
    expect(doc.output()).toContain('assinatura pendente');
    if (process.env.MENU_PDF_QA) writeFileSync('tmp/pdfs/cardapio-longo.pdf', Buffer.from(doc.output('arraybuffer')));
  });
});
