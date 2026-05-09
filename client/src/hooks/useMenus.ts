import { useEffect, useMemo, useState } from 'react';
import { loadHybridCollection, persistHybridSnapshot, removeHybridDocument, syncHybridDocument } from '@/lib/hybridStore';
import { toast } from 'sonner';
import type { Menu, MenuInsumo, MenuSlot, MenuStatus, NutritionNutrientSet } from '@/types/nutrition';
import { useAuth } from '@/contexts/AuthContext';

const STORAGE_KEY = 'pnae_nutrition_menus';
const COLLECTION_NAME = 'nutrition_menus';
const LEGACY_ORG_ID = 'pnae-default-org';

export interface CreateMenuInput {
  title: string;
  category: string;
  targetCategories: string[];
  referenceMonth: string;
  schoolIds?: string[];
  /** New composition-based slots */
  slots: MenuSlot[];
  /** Legacy — pass [] for new menus */
  items?: Menu['items'];
  averageCost: number;
  averageKcal: number;
  averageProtein: number;
  familyFarmShare: number;
  missingTargets: string[];
  repeatedPreparations: string[];
  emptySlots: string[];
  complianceAlerts: string[];
  responsibleName: string;
}

/** Safely converts a Firestore Timestamp, ISO string, or Date to a JS Date. */
function toDate(value: unknown): Date {
  if (!value) return new Date();
  if (typeof (value as any).toDate === 'function') return (value as any).toDate();
  if (value instanceof Date) return value;
  const d = new Date(value as string | number);
  return isNaN(d.getTime()) ? new Date() : d;
}

function normalizeNutrients(raw: any): NutritionNutrientSet {
  return {
    kcal:          Number(raw?.kcal)          || 0,
    protein:       Number(raw?.protein)       || 0,
    lipids:        Number(raw?.lipids)        || 0,
    carbohydrates: Number(raw?.carbohydrates) || 0,
    fiber:         Number(raw?.fiber)         || 0,
    calcium:       Number(raw?.calcium)       || 0,
    iron:          Number(raw?.iron)          || 0,
    zinc:          Number(raw?.zinc)          || 0,
    vitaminA:      Number(raw?.vitaminA)      || 0,
    vitaminC:      Number(raw?.vitaminC)      || 0,
  };
}

function normalizeInsumo(raw: any, idx: number): MenuInsumo {
  return {
    id:              raw?.id              || `ins-${idx}`,
    nome:            raw?.nome            || '',
    type:            raw?.type === 'food' ? 'food' : 'recipe',
    referenceId:     raw?.referenceId     || '',
    pesoReferencia:  Number(raw?.pesoReferencia)  || 100,
    pesoAtual:       Number(raw?.pesoAtual)       || 100,
    valoresNutricionaisBase: normalizeNutrients(raw?.valoresNutricionaisBase),
    custoBase:       Number(raw?.custoBase)       || 0,
    familyFarm:      Boolean(raw?.familyFarm),
    sourceUnit:      raw?.sourceUnit || 'g',
  };
}

function normalizeSlot(raw: any, idx: number): MenuSlot {
  return {
    id:           raw?.id           || `slot-${idx}`,
    dayLabel:     raw?.dayLabel     || '',
    mealLabel:    raw?.mealLabel    || '',
    nomeFantasia: raw?.nomeFantasia || '',
    composicao:   Array.isArray(raw?.composicao)
      ? raw.composicao.map((ins: any, i: number) => normalizeInsumo(ins, i))
      : [],
  };
}

function normalizeMenus(raw: unknown): Menu[] {
  if (!Array.isArray(raw)) return [];

  return raw.map((item, index) => {
    const menu = item as Partial<Menu>;
    return {
      id:             menu.id             || `menu-imported-${index}`,
      title:          menu.title          || 'Cardápio sem título',
      category:       menu.category       || 'Geral',
      // targetCategories: backward-compat — default to [category] if missing
      targetCategories: Array.isArray(menu.targetCategories) && menu.targetCategories.length > 0
        ? menu.targetCategories
        : [menu.category || 'Fundamental 1'],
      referenceMonth: menu.referenceMonth || '',
      schoolIds: Array.isArray(menu.schoolIds) ? menu.schoolIds : [],
      items:  Array.isArray(menu.items)  ? menu.items  : [],
      slots:  Array.isArray(menu.slots)
        ? menu.slots.map((s: any, i: number) => normalizeSlot(s, i))
        : [],
      averageCost:    Number(menu.averageCost)    || 0,
      averageKcal:    Number(menu.averageKcal)    || 0,
      averageProtein: Number(menu.averageProtein) || 0,
      familyFarmShare: Number(menu.familyFarmShare) || 0,
      missingTargets:       Array.isArray(menu.missingTargets)       ? menu.missingTargets.filter(Boolean)       : [],
      repeatedPreparations: Array.isArray(menu.repeatedPreparations) ? menu.repeatedPreparations.filter(Boolean) : [],
      emptySlots:           Array.isArray(menu.emptySlots)           ? menu.emptySlots.filter(Boolean)           : [],
      complianceAlerts:     Array.isArray(menu.complianceAlerts)     ? menu.complianceAlerts.filter(Boolean)     : [],
      status: (menu.status as MenuStatus) || 'draft',
      responsibleName: menu.responsibleName || 'Equipe técnica',
      reviewerName:    menu.reviewerName    || '',
      approverName:    menu.approverName    || '',
      publishedAt: menu.publishedAt ? toDate(menu.publishedAt) : undefined,
      workflowHistory: Array.isArray(menu.workflowHistory)
        ? menu.workflowHistory.map((entry, wi) => ({
            id:        entry?.id        || `workflow-${index}-${wi}`,
            action:    entry?.action    || 'created',
            actor:     entry?.actor     || 'Sistema',
            note:      entry?.note      || '',
            createdAt: toDate(entry?.createdAt),
          }))
        : [],
      createdAt: toDate(menu.createdAt),
      updatedAt: toDate(menu.updatedAt),
    };
  });
}

export function useMenus() {
  const { user } = useAuth();
  const orgId = user?.organizationId || LEGACY_ORG_ID;

  const [menus, setMenus] = useState<Menu[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;


    loadHybridCollection({
      orgId,
      collectionName: COLLECTION_NAME,
      storageKey: STORAGE_KEY,
      normalize: normalizeMenus,
      fallbackData: [],
    })
      .then((items) => {
        if (mounted) setMenus(items);
      })
      .catch((error) => {
        console.error('Erro ao carregar cardápios:', error);
        if (mounted) setMenus([]);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [orgId]);

  const persistMenus = (nextMenus: Menu[]) => {
    setMenus(nextMenus);
    persistHybridSnapshot(`${STORAGE_KEY}_${orgId}`, nextMenus);
  };

  const actions = useMemo(
    () => ({
      addMenu: (input: CreateMenuInput) => {
        const timestamp = new Date();
        const menu: Menu = {
          id: `menu-${crypto.randomUUID()}`,
          title: input.title.trim(),
          category: input.category,
          targetCategories: input.targetCategories,
          referenceMonth: input.referenceMonth,
          schoolIds: input.schoolIds || [],
          items: input.items || [],
          slots: input.slots,
          averageCost:          input.averageCost,
          averageKcal:          input.averageKcal,
          averageProtein:       input.averageProtein,
          familyFarmShare:      input.familyFarmShare,
          missingTargets:       input.missingTargets,
          repeatedPreparations: input.repeatedPreparations,
          emptySlots:           input.emptySlots,
          complianceAlerts:     input.complianceAlerts,
          status: 'draft',
          responsibleName: input.responsibleName.trim(),
          reviewerName: '',
          approverName: '',
          workflowHistory: [{
            id: `wf-${crypto.randomUUID()}`,
            action: 'created',
            actor: input.responsibleName.trim() || 'Sistema',
            note: 'Cardápio criado.',
            createdAt: timestamp,
          }],
          createdAt: timestamp,
          updatedAt: timestamp,
        };

        persistMenus([menu, ...menus]);
        syncHybridDocument(orgId, COLLECTION_NAME, menu).then((ok) => {
          if (!ok) toast.warning('Cardápio salvo localmente, mas falhou ao sincronizar com a nuvem. Será sincronizado quando a conexão for restaurada.');
        });
        return menu;
      },

      updateMenu: (id: string, input: Partial<CreateMenuInput>) => {
        const targetMenu = menus.find((m) => m.id === id);
        if (!targetMenu) {
          console.error(`[useMenus] updateMenu: cardápio ${id} não encontrado.`);
          toast.error('Cardápio não encontrado. Recarregue a página e tente novamente.');
          return false;
        }

        const updated: Menu = {
          ...targetMenu,
          ...(input.title              !== undefined && { title:              input.title.trim() }),
          ...(input.category           !== undefined && { category:           input.category }),
          ...(input.targetCategories   !== undefined && { targetCategories:   input.targetCategories }),
          ...(input.referenceMonth     !== undefined && { referenceMonth:     input.referenceMonth }),
          ...(input.schoolIds          !== undefined && { schoolIds:          input.schoolIds }),
          ...(input.slots              !== undefined && { slots:              input.slots }),
          ...(input.items              !== undefined && { items:              input.items }),
          ...(input.averageCost        !== undefined && { averageCost:        input.averageCost }),
          ...(input.averageKcal        !== undefined && { averageKcal:        input.averageKcal }),
          ...(input.averageProtein     !== undefined && { averageProtein:     input.averageProtein }),
          ...(input.familyFarmShare    !== undefined && { familyFarmShare:    input.familyFarmShare }),
          ...(input.missingTargets     !== undefined && { missingTargets:     input.missingTargets }),
          ...(input.repeatedPreparations !== undefined && { repeatedPreparations: input.repeatedPreparations }),
          ...(input.emptySlots         !== undefined && { emptySlots:         input.emptySlots }),
          ...(input.complianceAlerts   !== undefined && { complianceAlerts:   input.complianceAlerts }),
          ...(input.responsibleName    !== undefined && { responsibleName:    input.responsibleName.trim() }),
          updatedAt: new Date(),
        };

        const nextMenus = menus.map((m) => (m.id === id ? updated : m));
        persistMenus(nextMenus);
        syncHybridDocument(orgId, COLLECTION_NAME, updated).then((ok) => {
          if (!ok) toast.warning('Cardápio atualizado localmente, mas falhou ao sincronizar com a nuvem.');
        });
        return true;
      },

      deleteMenu: (id: string) => {
        const targetMenu = menus.find((m) => m.id === id);
        if (!targetMenu) return false;

        persistMenus(menus.filter((m) => m.id !== id));
        removeHybridDocument(orgId, COLLECTION_NAME, id).catch((err) => {
          console.warn('[useMenus] deleteMenu: falha ao remover do Firebase:', err);
        });
        return true;
      },
    }),
    [menus, orgId]
  );

  return {
    menus,
    loading,
    ...actions,
  };
}
