import { repairLegacyMenuPortions } from "@/lib/recipeMenuPortion";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  loadHybridCollection,
  persistHybridSnapshot,
  syncHybridDocument,
} from "@/lib/hybridStore";
import { toast } from "sonner";
import { deleteDoc, doc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { acknowledgeMenu, readPendingMenus } from "../lib/menuSyncQueue";
import type {
  Menu,
  MenuInsumo,
  MenuSlot,
  MenuStatus,
  NutritionNutrientSet,
} from "@/types/nutrition";
import { useAuth } from "@/contexts/AuthContext";
import { useOrgId } from "@/hooks/useOrgId";

const STORAGE_KEY = "pnae_nutrition_menus";
const COLLECTION_NAME = "nutrition_menus";
// Navigation and editor both subscribe to menus. Share a lock within this tab.
const menuSyncInFlight = new Set<string>();
const MENU_SYNC_EVENT = "eduplate:menu-sync";

export interface CreateMenuInput {
  nutritionAgeGroups?: Menu["nutritionAgeGroups"];
  mealsPerStudentDay?: number;
  traditionalCommunity?: boolean;
  title: string;
  category: string;
  targetCategories: string[];
  attendanceMode?: "partial" | "integral";
  referenceMonth: string;
  weekStartDate?: string;
  studentCount?: number;
  mealCount?: number;
  schoolIds?: string[];
  /** New composition-based slots */
  slots: MenuSlot[];
  /** Legacy — pass [] for new menus */
  items?: Menu["items"];
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
  if (typeof (value as any).toDate === "function")
    return (value as any).toDate();
  if (value instanceof Date) return value;
  const d = new Date(value as string | number);
  return isNaN(d.getTime()) ? new Date() : d;
}

function normalizeNutrients(raw: any): NutritionNutrientSet {
  return {
    kcal: Number(raw?.kcal) || 0,
    protein: Number(raw?.protein) || 0,
    lipids: Number(raw?.lipids) || 0,
    carbohydrates: Number(raw?.carbohydrates) || 0,
    fiber: Number(raw?.fiber) || 0,
    calcium: Number(raw?.calcium) || 0,
    iron: Number(raw?.iron) || 0,
    zinc: Number(raw?.zinc) || 0,
    vitaminA: Number(raw?.vitaminA) || 0,
    vitaminC: Number(raw?.vitaminC) || 0,
  };
}

function normalizeInsumo(raw: any, idx: number): MenuInsumo {
  return {
    id: raw?.id || `ins-${idx}`,
    nome: raw?.nome || "",
    type: raw?.type === "food" ? "food" : "recipe",
    referenceId: raw?.referenceId || "",
    pesoReferencia: Number(raw?.pesoReferencia) || 100,
    pesoAtual:
      raw?.pesoAtual != null && Number.isFinite(Number(raw.pesoAtual))
        ? Math.max(0, Number(raw.pesoAtual))
        : 100,
    valoresNutricionaisBase: normalizeNutrients(raw?.valoresNutricionaisBase),
    custoBase: Number(raw?.custoBase) || 0,
    familyFarm: Boolean(raw?.familyFarm),
    sourceUnit: raw?.sourceUnit || "g",
    ...(raw?.portionUnitVersion === 1
      ? { portionUnitVersion: 1 as const }
      : {}),
  };
}

function normalizeSlot(raw: any, idx: number): MenuSlot {
  return {
    mealCount: raw?.mealCount != null ? Number(raw.mealCount) : undefined,
    id: raw?.id || `slot-${idx}`,
    dayLabel: raw?.dayLabel || "",
    mealLabel: raw?.mealLabel || "",
    nomeFantasia: raw?.nomeFantasia || "",
    consistency: raw?.consistency || "",
    composicao: Array.isArray(raw?.composicao)
      ? raw.composicao.map((ins: any, i: number) => normalizeInsumo(ins, i))
      : [],
  };
}

function normalizeMenus(raw: unknown): Menu[] {
  if (!Array.isArray(raw)) return [];

  return raw.map((item, index) => {
    const menu = item as Partial<Menu>;
    return repairLegacyMenuPortions({
      id: menu.id || `menu-imported-${index}`,
      title: menu.title || "Cardápio sem título",
      category: menu.category || "Geral",
      nutritionAgeGroups: Array.isArray(menu.nutritionAgeGroups)
        ? menu.nutritionAgeGroups
        : [],
      mealsPerStudentDay:
        menu.mealsPerStudentDay != null
          ? Number(menu.mealsPerStudentDay)
          : undefined,
      traditionalCommunity: Boolean(menu.traditionalCommunity),
      attendanceMode:
        menu.attendanceMode === "partial" ? "partial" : "integral",
      // targetCategories: backward-compat — default to [category] if missing
      targetCategories:
        Array.isArray(menu.targetCategories) && menu.targetCategories.length > 0
          ? menu.targetCategories
          : [menu.category || "Fundamental 1"],
      referenceMonth: menu.referenceMonth || "",
      weekStartDate: menu.weekStartDate || undefined,
      studentCount:
        menu.studentCount != null ? Number(menu.studentCount) : undefined,
      mealCount: menu.mealCount != null ? Number(menu.mealCount) : undefined,
      schoolIds: Array.isArray(menu.schoolIds) ? menu.schoolIds : [],
      items: Array.isArray(menu.items) ? menu.items : [],
      slots: Array.isArray(menu.slots)
        ? menu.slots.map((s: any, i: number) => normalizeSlot(s, i))
        : [],
      averageCost: Number(menu.averageCost) || 0,
      averageKcal: Number(menu.averageKcal) || 0,
      averageProtein: Number(menu.averageProtein) || 0,
      familyFarmShare: Number(menu.familyFarmShare) || 0,
      missingTargets: Array.isArray(menu.missingTargets)
        ? menu.missingTargets.filter(Boolean)
        : [],
      repeatedPreparations: Array.isArray(menu.repeatedPreparations)
        ? menu.repeatedPreparations.filter(Boolean)
        : [],
      emptySlots: Array.isArray(menu.emptySlots)
        ? menu.emptySlots.filter(Boolean)
        : [],
      complianceAlerts: Array.isArray(menu.complianceAlerts)
        ? menu.complianceAlerts.filter(Boolean)
        : [],
      status: (menu.status as MenuStatus) || "draft",
      responsibleName: menu.responsibleName || "Equipe técnica",
      reviewerName: menu.reviewerName || "",
      approverName: menu.approverName || "",
      publishedAt: menu.publishedAt ? toDate(menu.publishedAt) : undefined,
      workflowHistory: Array.isArray(menu.workflowHistory)
        ? menu.workflowHistory.map((entry, wi) => ({
            id: entry?.id || `workflow-${index}-${wi}`,
            action: entry?.action || "created",
            actor: entry?.actor || "Sistema",
            note: entry?.note || "",
            createdAt: toDate(entry?.createdAt),
          }))
        : [],
      createdAt: toDate(menu.createdAt),
      updatedAt: toDate(menu.updatedAt),
    });
  });
}

export function useMenus() {
  const { user } = useAuth();
  const orgId = useOrgId();

  const [menus, setMenus] = useState<Menu[]>([]);
  const [loading, setLoading] = useState(true);

  const queueKey =
    orgId && user?.uid ? `eduplate:menu-sync:${orgId}:${user.uid}` : null;
  const scopeRef = useRef(queueKey);
  scopeRef.current = queueKey;
  const [syncStates, setSyncStates] = useState<
    Record<string, "local" | "syncing" | "synced">
  >({});
  const inFlight = useRef(menuSyncInFlight);
  const setSyncStatus = useCallback(
    (id: string, status: "local" | "syncing" | "synced") => {
      setSyncStates(states => ({ ...states, [id]: status }));
      window.dispatchEvent(
        new CustomEvent(MENU_SYNC_EVENT, { detail: { queueKey, id, status } })
      );
    },
    [queueKey]
  );
  useEffect(() => {
    const receive = (event: Event) => {
      const detail = (event as CustomEvent).detail;
      if (detail?.queueKey === queueKey)
        setSyncStates(states => ({ ...states, [detail.id]: detail.status }));
    };
    window.addEventListener(MENU_SYNC_EVENT, receive);
    return () => window.removeEventListener(MENU_SYNC_EVENT, receive);
  }, [queueKey]);
  const syncOne = useCallback(
    async (menu: Menu) => {
      if (!orgId || !queueKey) return;
      const token = queueKey + ":" + menu.id;
      if (inFlight.current.has(token)) return;
      inFlight.current.add(token);
      setSyncStatus(menu.id, navigator.onLine ? "syncing" : "local");
      if (!navigator.onLine) {
        inFlight.current.delete(token);
        return;
      }
      const warning = setTimeout(() => {
        if (scopeRef.current === queueKey) setSyncStatus(menu.id, "local");
      }, 12000);
      try {
        const document = {
          ...menu,
          createdAt: toDate(menu.createdAt),
          updatedAt: toDate(menu.updatedAt),
          ...(menu.publishedAt
            ? { publishedAt: toDate(menu.publishedAt) }
            : {}),
          workflowHistory: menu.workflowHistory.map(entry => ({
            ...entry,
            createdAt: toDate(entry.createdAt),
          })),
        };
        const ok = await syncHybridDocument(orgId, COLLECTION_NAME, document);
        if (scopeRef.current !== queueKey) return;
        if (ok) {
          const pending = readPendingMenus<Menu>(localStorage, queueKey);
          const next = acknowledgeMenu(pending, menu);
          localStorage.setItem(queueKey, JSON.stringify(next));
          setSyncStatus(menu.id, next[menu.id] ? "local" : "synced");
        } else setSyncStatus(menu.id, "local");
      } catch {
        if (scopeRef.current === queueKey) setSyncStatus(menu.id, "local");
      } finally {
        clearTimeout(warning);
        inFlight.current.delete(token);
        // A second save may have arrived while this snapshot was in flight.
        if (scopeRef.current === queueKey) {
          try {
            const latest = readPendingMenus<Menu>(localStorage, queueKey)[
              menu.id
            ];
            if (latest && JSON.stringify(latest) !== JSON.stringify(menu))
              void syncOne(latest);
          } catch {
            /* Keep the durable queue for a later explicit retry. */
          }
        }
      }
    },
    [orgId, queueKey, setSyncStatus]
  );
  const queueSync = (menu: Menu) => {
    if (!queueKey)
      throw new Error("Sessão indisponível. Entre novamente antes de salvar.");
    const pending = readPendingMenus<Menu>(localStorage, queueKey);
    localStorage.setItem(
      queueKey,
      JSON.stringify({ ...pending, [menu.id]: menu })
    );
    setSyncStatus(menu.id, "local");
    void syncOne(menu);
  };
  const retryPending = useCallback(() => {
    if (!queueKey) return;
    try {
      Object.values(readPendingMenus<Menu>(localStorage, queueKey)).forEach(
        menu => void syncOne(menu)
      );
    } catch {
      toast.error(
        "Não foi possível ler a fila de sincronização. Preserve seus dados antes de limpar o navegador."
      );
    }
  }, [queueKey, syncOne]);
  useEffect(() => {
    const online = () => retryPending();
    window.addEventListener("online", online);
    return () => window.removeEventListener("online", online);
  }, [retryPending]);

  useEffect(() => {
    if (!orgId) {
      setLoading(false);
      return;
    }
    let mounted = true;

    loadHybridCollection({
      orgId,
      collectionName: COLLECTION_NAME,
      storageKey: STORAGE_KEY,
      normalize: normalizeMenus,
      fallbackData: [],
    })
      .then(items => {
        if (mounted) {
          const pending = queueKey
            ? readPendingMenus<Menu>(localStorage, queueKey)
            : {};
          const merged = new Map(items.map(menu => [menu.id, menu]));
          Object.values(pending).forEach(menu =>
            merged.set(menu.id, normalizeMenus([menu])[0])
          );
          setMenus(Array.from(merged.values()));
          setSyncStates(
            Object.fromEntries(
              Object.keys(pending).map(id => [id, "local" as const])
            )
          );
          retryPending();
        }
      })
      .catch(error => {
        console.error("Erro ao carregar cardápios:", error);
        if (mounted) setMenus([]);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [orgId, queueKey, retryPending]);

  const persistMenus = (nextMenus: Menu[]) => {
    persistHybridSnapshot(`${STORAGE_KEY}_${orgId}`, nextMenus);
    setMenus(nextMenus);
  };

  const actions = useMemo(
    () => ({
      addMenu: (input: CreateMenuInput) => {
        const timestamp = new Date();
        const menu: Menu = {
          id: `menu-${crypto.randomUUID()}`,
          title: input.title.trim(),
          category: input.category,
          nutritionAgeGroups: input.nutritionAgeGroups || [],
          mealsPerStudentDay: input.mealsPerStudentDay,
          traditionalCommunity: Boolean(input.traditionalCommunity),
          targetCategories: input.targetCategories,
          attendanceMode: input.attendanceMode || "integral",
          referenceMonth: input.referenceMonth,
          weekStartDate: input.weekStartDate,
          studentCount: input.studentCount,
          mealCount: input.mealCount,
          schoolIds: input.schoolIds || [],
          items: input.items || [],
          slots: input.slots,
          averageCost: input.averageCost,
          averageKcal: input.averageKcal,
          averageProtein: input.averageProtein,
          familyFarmShare: input.familyFarmShare,
          missingTargets: input.missingTargets,
          repeatedPreparations: input.repeatedPreparations,
          emptySlots: input.emptySlots,
          complianceAlerts: input.complianceAlerts,
          status: "draft",
          responsibleName: input.responsibleName.trim(),
          reviewerName: "",
          approverName: "",
          workflowHistory: [
            {
              id: `wf-${crypto.randomUUID()}`,
              action: "created",
              actor: input.responsibleName.trim() || "Sistema",
              note: "Cardápio criado.",
              createdAt: timestamp,
            },
          ],
          createdAt: timestamp,
          updatedAt: timestamp,
        };

        queueSync(menu);
        persistMenus([menu, ...menus]);
        return menu;
      },

      updateMenu: (id: string, input: Partial<CreateMenuInput>) => {
        const targetMenu = menus.find(m => m.id === id);
        if (!targetMenu) {
          console.error(
            `[useMenus] updateMenu: cardápio ${id} não encontrado.`
          );
          toast.error(
            "Cardápio não encontrado. Recarregue a página e tente novamente."
          );
          return false;
        }

        const updated: Menu = {
          ...targetMenu,
          ...(input.title !== undefined && { title: input.title.trim() }),
          ...(input.category !== undefined && { category: input.category }),
          ...("nutritionAgeGroups" in input && {
            nutritionAgeGroups: input.nutritionAgeGroups,
          }),
          ...("mealsPerStudentDay" in input && {
            mealsPerStudentDay: input.mealsPerStudentDay,
          }),
          ...("traditionalCommunity" in input && {
            traditionalCommunity: input.traditionalCommunity,
          }),
          ...(input.targetCategories !== undefined && {
            targetCategories: input.targetCategories,
          }),
          ...(input.attendanceMode !== undefined && {
            attendanceMode: input.attendanceMode,
          }),
          ...(input.referenceMonth !== undefined && {
            referenceMonth: input.referenceMonth,
          }),
          ...("weekStartDate" in input && {
            weekStartDate: input.weekStartDate,
          }),
          ...("studentCount" in input && {
            studentCount: input.studentCount,
          }),
          ...("mealCount" in input && { mealCount: input.mealCount }),
          ...(input.schoolIds !== undefined && { schoolIds: input.schoolIds }),
          ...(input.slots !== undefined && { slots: input.slots }),
          ...(input.items !== undefined && { items: input.items }),
          ...(input.averageCost !== undefined && {
            averageCost: input.averageCost,
          }),
          ...(input.averageKcal !== undefined && {
            averageKcal: input.averageKcal,
          }),
          ...(input.averageProtein !== undefined && {
            averageProtein: input.averageProtein,
          }),
          ...(input.familyFarmShare !== undefined && {
            familyFarmShare: input.familyFarmShare,
          }),
          ...(input.missingTargets !== undefined && {
            missingTargets: input.missingTargets,
          }),
          ...(input.repeatedPreparations !== undefined && {
            repeatedPreparations: input.repeatedPreparations,
          }),
          ...(input.emptySlots !== undefined && {
            emptySlots: input.emptySlots,
          }),
          ...(input.complianceAlerts !== undefined && {
            complianceAlerts: input.complianceAlerts,
          }),
          ...(input.responsibleName !== undefined && {
            responsibleName: input.responsibleName.trim(),
          }),
          updatedAt: new Date(),
        };

        const nextMenus = menus.map(m => (m.id === id ? updated : m));
        queueSync(updated);
        persistMenus(nextMenus);
        return true;
      },

      deleteMenu: async (id: string) => {
        if (!orgId || !queueKey) throw new Error("Organização indisponível.");
        if (!navigator.onLine)
          throw new Error("Conecte-se à internet para excluir com segurança.");
        if (inFlight.current.has(queueKey + ":" + id))
          throw new Error("Aguarde o salvamento terminar antes de excluir.");
        const targetMenu = menus.find(m => m.id === id);
        if (!targetMenu) throw new Error("Cardápio não encontrado.");
        await deleteDoc(doc(db, "organizations", orgId, COLLECTION_NAME, id));
        if (scopeRef.current !== queueKey) return false;
        const pending = readPendingMenus<Menu>(localStorage, queueKey);
        delete pending[id];
        localStorage.setItem(queueKey, JSON.stringify(pending));
        persistMenus(menus.filter(m => m.id !== id));
        return true;
      },
    }),
    [menus, orgId, queueKey, syncOne, setSyncStatus]
  );

  return {
    menus,
    loading,
    ...actions,
    syncStates,
    retryPending,
  };
}
