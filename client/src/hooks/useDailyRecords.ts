import { useEffect, useRef, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { syncHybridDocument } from "@/lib/hybridStore";
import { useAuth } from "@/contexts/AuthContext";
import { useOrgId } from "@/hooks/useOrgId";
import {
  currentDailyRecords,
  dailyContextKey,
  dailyIssues,
  type DailyRecord,
  type DailyRecordInput,
} from "@/lib/dailyRecord";

const COLLECTION = "daily_meal_records";
interface Cache {
  records: DailyRecord[];
  pending: string[];
}
export function useDailyRecords() {
  const orgId = useOrgId();
  const { user } = useAuth();
  const [state, setState] = useState<Cache>({ records: [], pending: [] });
  const [loadedOrg, setLoadedOrg] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const cache = useRef(state);
  const activeOrg = useRef(orgId);
  activeOrg.current = orgId;
  const lock = useRef(false);
  const key = (id: string) => `pnae_daily_meal_records_${id}`;
  const persist = (id: string, next: Cache) => {
    localStorage.setItem(key(id), JSON.stringify(next));
    if (activeOrg.current === id) {
      cache.current = next;
      setState(next);
    }
  };
  useEffect(() => {
    let active = true;
    setLoadedOrg(null);
    setState({ records: [], pending: [] });
    cache.current = { records: [], pending: [] };
    setError("");
    if (!orgId) return;
    const id = orgId;
    (async () => {
      let local: Cache = { records: [], pending: [] };
      try {
        const raw = JSON.parse(localStorage.getItem(key(id)) || "null");
        if (raw) {
          if (!Array.isArray(raw.records) || !Array.isArray(raw.pending))
            throw new Error("Cache inválido");
          local = raw;
        }
      } catch {
        throw new Error("Não foi possível ler o histórico local.");
      }
      let next = local;
      try {
        const snap = await getDocs(
          collection(db, "organizations", id, COLLECTION)
        );
        const remote = snap.docs.map(
          d => ({ ...d.data(), id: d.id }) as DailyRecord
        );
        const ids = new Set(remote.map(r => r.id));
        // Append-only records: the server copy wins; unsynchronized local records remain visible.
        next = {
          records: [...remote, ...local.records.filter(r => !ids.has(r.id))],
          pending: local.pending.filter(p => !ids.has(p)),
        };
      } catch {
        if (active)
          setError(
            "Nuvem indisponível. O histórico pode estar incompleto; os novos registros ficarão neste navegador até sincronizar."
          );
      }
      if (active) {
        persist(id, next);
        setLoadedOrg(id);
      }
    })().catch(() => {
      if (active)
        setError(
          "Não foi possível abrir o histórico. Recarregue a página antes de salvar."
        );
    });
    return () => {
      active = false;
    };
  }, [orgId]);
  const canWrite =
    !!user && ["admin", "nutritionist", "nutricionista"].includes(user.role);
  async function save(input: DailyRecordInput) {
    if (!orgId || loadedOrg !== orgId || !user || !canWrite || lock.current)
      throw new Error(
        "Aguarde o carregamento e confira a permissão de edição."
      );
    const issues = dailyIssues(input);
    if (issues.length) throw new Error(issues[0]);
    const existing = currentDailyRecords(cache.current.records).find(
      r => dailyContextKey(r) === dailyContextKey(input)
    );
    if (existing && existing.id !== input.supersedesId)
      throw new Error(
        "Já existe um registro para esse cardápio e data. Use Corrigir no histórico."
      );
    if (input.supersedesId && (!existing || existing.id !== input.supersedesId))
      throw new Error(
        "A versão anterior mudou. Reabra o histórico para corrigir."
      );
    lock.current = true;
    setSaving(true);
    const id = orgId;
    try {
      const record: DailyRecord = JSON.parse(
        JSON.stringify({
          ...input,
          id: crypto.randomUUID(),
          createdAt: new Date().toISOString(),
          actorUid: user.uid,
          actorName: user.displayName || user.email,
          actorRole: user.role,
        })
      );
      persist(id, {
        records: [record, ...cache.current.records],
        pending: [...cache.current.pending, record.id],
      });
      const synced = await syncHybridDocument(id, COLLECTION, record);
      if (synced && activeOrg.current === id)
        persist(id, {
          ...cache.current,
          pending: cache.current.pending.filter(p => p !== record.id),
        });
      return { record, synced };
    } finally {
      lock.current = false;
      setSaving(false);
    }
  }
  async function retrySync() {
    if (!orgId || loadedOrg !== orgId || !canWrite || lock.current) return;
    const id = orgId;
    lock.current = true;
    setSaving(true);
    try {
      for (const record of cache.current.records.filter(r =>
        cache.current.pending.includes(r.id)
      )) {
        if (activeOrg.current !== id) break;
        if (
          (await syncHybridDocument(id, COLLECTION, record)) &&
          activeOrg.current === id
        )
          persist(id, {
            ...cache.current,
            pending: cache.current.pending.filter(p => p !== record.id),
          });
      }
    } finally {
      lock.current = false;
      setSaving(false);
    }
  }
  return {
    records: loadedOrg === orgId ? state.records : [],
    pending: loadedOrg === orgId ? state.pending : [],
    loading: !orgId || loadedOrg !== orgId,
    error,
    saving,
    canWrite,
    save,
    retrySync,
  };
}
