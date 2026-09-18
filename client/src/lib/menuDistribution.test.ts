import { describe, expect, it } from 'vitest';
import { jsPDF } from 'jspdf';
import { unzipSync, zipSync } from 'fflate';
import { distributionWarnings, pdfSchoolFilename, retrySchoolIds, schoolsInGroup, validSchoolEmail } from './menuDistribution';
import { numberMenuPages, renderSchoolMenus, type MenuPdfContext } from './menuPdf';
import type { School } from '../types';
import type { Menu, SpecialDiet } from '../types/nutrition';

const school = (id: string, network: School['educationNetwork'], stages: string[]): School => ({ id, name: `Escola ${id}`, email: `${id}@example.org`, educationNetwork: network, educationStages: stages, mealSchedules: [{ mealLabel: 'Almoço', time: '11:30' }], createdAt: new Date(), updatedAt: new Date() });
const a = school('a', 'municipal', ['Creche']);
const b = school('b', 'estadual', ['Fundamental 1']);
const c = school('c', undefined, []);
const menu = { id: 'm', title: 'Cardápio da semana', category: 'Creche', targetCategories: ['Creche'], schoolIds: [], slots: [], items: [], referenceMonth: 'Setembro' } as unknown as Menu;
const context: MenuPdfContext = { schools: [a, b, c], recipes: [], specialDiets: [], settings: null };

describe('Distribuição por grupo', () => {
  it('combina rede e etapa e mantém cadastros antigos disponíveis em Todas', () => {
    expect(schoolsInGroup([a, b, c], 'municipal', 'Creche')).toEqual([a]);
    expect(schoolsInGroup([a, b, c], '', 'Creche')).toEqual([a]);
    expect(schoolsInGroup([a, b, c], 'estadual', 'Creche')).toEqual([]);
    expect(schoolsInGroup([a, b, c], '', '')).toEqual([a, b, c]);
  });
  it('confere e-mails, horários e etapas antes de enviar', () => {
    expect(validSchoolEmail(' escola@example.org ')).toBe(true);
    expect(validSchoolEmail('a@example.org,b@example.org')).toBe(false);
    expect(validSchoolEmail('')).toBe(false);
    expect(distributionWarnings(menu, b, context, ['Almoço']).join(' ')).toContain('não corresponde');
    expect(distributionWarnings(menu, { ...c, mealSchedules: [] }, context, ['Lanche']).join(' ')).toContain('Horários ausentes: Lanche');
  });
  it('repete somente falhas e distingue nomes de arquivos iguais', () => {
    expect(retrySchoolIds({ a: { status: 'sent', message: '' }, b: { status: 'error', message: '' }, c: { status: 'sending', message: '' } })).toEqual(['b']);
    expect(pdfSchoolFilename(menu, a)).not.toBe(pdfSchoolFilename(menu, { ...a, id: 'b' }));
  });
  it('gera um ZIP de PDFs isolados, com horários e dietas somente do destinatário', () => {
    const schools = [a, { ...b, mealSchedules: [{ mealLabel: 'Almoço', time: '12:40' }] }];
    const diets = [{ schoolId: 'a', category: 'Creche', status: 'active', labels: ['sem-gluten'] }] as SpecialDiet[];
    const entries: Record<string, Uint8Array> = {};
    for (const unit of schools) {
      const doc = new jsPDF({ orientation: 'landscape' });
      renderSchoolMenus(doc, { ...menu, schoolIds: [unit.id] }, ['Almoço'], { ...context, schools: [unit], specialDiets: diets });
      numberMenuPages(doc);
      entries[pdfSchoolFilename(menu, unit)] = new Uint8Array(doc.output('arraybuffer'));
    }
    const archive = unzipSync(zipSync(entries));
    expect(Object.keys(archive)).toHaveLength(2);
    const pdfA = Buffer.from(archive[pdfSchoolFilename(menu, a)]).toString('latin1');
    const pdfB = Buffer.from(archive[pdfSchoolFilename(menu, b)]).toString('latin1');
    expect(pdfA).toContain('Escola a'); expect(pdfA).not.toContain('Escola b');
    expect(pdfA).toContain('11:30'); expect(pdfA).not.toContain('12:40');
    expect(pdfA).toContain('Sem Glúten'); expect(pdfB).not.toContain('Sem Glúten');
    expect(pdfB).toContain('Escola b'); expect(pdfB).toContain('12:40');
  });
});
