import type { School } from '../types';
import type { Menu } from '../types/nutrition';
import type { MenuPdfContext } from './menuPdf';
import { menuMeals, slotCompositionIssues } from './menuPdf';

export const validSchoolEmail = (email?: string) => /^[^\s@<>;,]+@[^\s@<>;,]+\.[^\s@<>;,]+$/.test(email?.trim() || '');
export function schoolsInGroup(schools: School[], network: string, stage: string): School[] {
  return schools.filter(s => (!network || s.educationNetwork === network) && (!stage || s.educationStages?.includes(stage)));
}

export function distributionWarnings(menu: Menu, school: School, context: MenuPdfContext, fallback: string[]): string[] {
  const warnings: string[] = [];
  const stages = menu.targetCategories?.length ? menu.targetCategories : [menu.category];
  if (!menu.slots?.some(s => s.composicao.length) && !menu.items?.length) warnings.push('Cardápio sem composição planejada.');
  if (!school.educationStages?.length) warnings.push('Etapas atendidas não cadastradas.');
  else if (!stages.some(stage => school.educationStages!.includes(stage))) warnings.push('A etapa do cardápio não corresponde às etapas da escola.');
  if (!school.educationNetwork) warnings.push('Rede de ensino não cadastrada.');
  const missingTimes = menuMeals(menu.slots || [], [school], fallback).filter(meal => !school.mealSchedules?.some(row => row.mealLabel === meal && /^([01]\d|2[0-3]):[0-5]\d$/.test(row.time)));
  if (missingTimes.length) warnings.push(`Horários ausentes: ${missingTimes.join(', ')}.`);
  if (menu.slots?.some(slot => slotCompositionIssues(slot, context.recipes).length)) warnings.push('Preparações com ficha técnica ou composição pendente.');
  if (stages.includes('Creche') && menu.slots?.some(s => (s.nomeFantasia.trim() || s.composicao.length) && !s.consistency?.trim())) warnings.push('Consistências da creche pendentes.');
  if (!context.settings?.nutritionistName?.trim() || !context.settings?.nutritionistCrn?.trim()) warnings.push('Nome ou CRN da RT pendente em Perfil.');
  if (!context.settings?.signatureDataUrl && !context.settings?.signatureUrl) warnings.push('Assinatura da RT pendente em Perfil.');
  return warnings;
}

export function pdfSchoolFilename(menu: Menu, school: School): string {
  const safe = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9_-]/g, '_').replace(/_+/g, '_').slice(0, 65);
  return `Cardapio_${safe(menu.title)}_${safe(school.name)}_${safe(school.id)}.pdf`;
}

export type DistributionStatus = 'sending' | 'sent' | 'error';
export interface DistributionResult { status: DistributionStatus; message: string }
export function retrySchoolIds(results: Record<string, DistributionResult>): string[] {
  return Object.keys(results).filter(id => results[id].status === 'error');
}
