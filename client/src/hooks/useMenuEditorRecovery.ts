import { useEffect, useRef, useState } from "react";
import {
  editorDraftKey,
  pushEditorHistory,
  readEditorDraft,
  type EditorDraft,
} from "../lib/menuEditorRecovery";

export function useMenuEditorRecovery<T extends object>(
  snapshot: T,
  open: boolean,
  orgId: string | undefined,
  uid: string | undefined,
  restore: (value: T) => void
) {
  const key = orgId && uid ? editorDraftKey(orgId, uid) : null;
  const serialized = JSON.stringify(snapshot);
  const [baseline, setBaseline] = useState<string | null>(null);
  const baselineRef = useRef<string | null>(null);
  const history = useRef<{ history: string[]; cursor: number }>({
    history: [],
    cursor: -1,
  });
  const [draft, setDraft] = useState<EditorDraft<T> | null>(null);
  const [storageError, setStorageError] = useState(false);
  const scopeRef = useRef(key);
  const [, refresh] = useState(0);
  const dirty = open && baseline !== null && baseline !== serialized;

  useEffect(() => {
    try {
      setDraft(key ? readEditorDraft<T>(localStorage, key) : null);
    } catch {
      setDraft(null);
      setStorageError(true);
    }
  }, [key]);

  useEffect(() => {
    if (scopeRef.current !== key) {
      scopeRef.current = key;
      baselineRef.current = null;
      setBaseline(null);
      history.current = { history: [], cursor: -1 };
      return; // Never carry an open editor into another user's storage.
    }
    if (!open) {
      baselineRef.current = null;
      setBaseline(null);
      history.current = { history: [], cursor: -1 };
      return;
    }
    if (baselineRef.current === null) {
      baselineRef.current = serialized;
      setBaseline(serialized);
    }
    history.current = pushEditorHistory(
      history.current.history,
      history.current.cursor,
      serialized
    );
    refresh(value => value + 1);
    if (!key) {
      setStorageError(true);
      return;
    }
    try {
      if (baselineRef.current !== serialized) {
        const value: EditorDraft<T> = {
          version: 1,
          snapshot: JSON.parse(serialized),
          baseline: baselineRef.current,
          savedAt: new Date().toISOString(),
        };
        localStorage.setItem(key, JSON.stringify(value));
        setDraft(value);
      } else {
        localStorage.removeItem(key);
        setDraft(null);
      }
      setStorageError(false);
    } catch {
      setStorageError(true);
    }
  }, [open, serialized, key]);

  useEffect(() => {
    if (!dirty) return;
    const unload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    const navigate = (event: MouseEvent) => {
      const anchor = (event.target as Element).closest?.(
        "a[href]"
      ) as HTMLAnchorElement | null;
      if (
        !anchor ||
        anchor.target === "_blank" ||
        anchor.hasAttribute("download") ||
        anchor.href === window.location.href
      )
        return;
      if (
        !window.confirm(
          storageError
            ? "Há alterações sem proteção de rascunho. Sair mesmo assim?"
            : "Sair do editor? Seu rascunho ficará guardado neste navegador."
        )
      ) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    window.addEventListener("beforeunload", unload);
    document.addEventListener("click", navigate, true);
    return () => {
      window.removeEventListener("beforeunload", unload);
      document.removeEventListener("click", navigate, true);
    };
  }, [dirty, storageError]);

  return {
    dirty,
    draft,
    storageError,
    canUndo: history.current.cursor > 0,
    canRedo: history.current.cursor < history.current.history.length - 1,
    undo: () => {
      const state = history.current;
      if (state.cursor > 0) {
        state.cursor--;
        restore(JSON.parse(state.history[state.cursor]));
        refresh(v => v + 1);
      }
    },
    redo: () => {
      const state = history.current;
      if (state.cursor < state.history.length - 1) {
        state.cursor++;
        restore(JSON.parse(state.history[state.cursor]));
        refresh(v => v + 1);
      }
    },
    recover: () => {
      if (!draft) return;
      baselineRef.current = draft.baseline;
      setBaseline(draft.baseline);
      history.current = {
        history: [draft.baseline, JSON.stringify(draft.snapshot)],
        cursor: 1,
      };
      restore(draft.snapshot);
    },
    discard: () => {
      if (key) {
        try {
          localStorage.removeItem(key);
        } catch {
          setStorageError(true);
          return false;
        }
      }
      setDraft(null);
      return true;
    },
    markSaved: (value: T = snapshot) => {
      const next = JSON.stringify(value);
      // Saving a newly created record assigns its id. Keep undo attached to that record.
      const assigned = Object.fromEntries(
        Object.entries(value).filter(
          ([field, item]) =>
            JSON.stringify(item) !==
            JSON.stringify((snapshot as Record<string, unknown>)[field])
        )
      );
      history.current.history = history.current.history.map(item =>
        JSON.stringify({ ...JSON.parse(item), ...assigned })
      );
      baselineRef.current = next;
      setBaseline(next);
      if (key) {
        try {
          localStorage.removeItem(key);
          setDraft(null);
        } catch {
          setStorageError(true);
        }
      }
    },
  };
}
