export interface EditorDraft<T> {
  version: 1;
  snapshot: T;
  baseline: string;
  savedAt: string;
}
export const editorDraftKey = (orgId: string, uid: string) =>
  `eduplate:menu-editor:v1:${encodeURIComponent(orgId)}:${encodeURIComponent(uid)}`;

export function readEditorDraft<T>(
  storage: Pick<Storage, "getItem">,
  key: string
): EditorDraft<T> | null {
  try {
    const value = JSON.parse(storage.getItem(key) || "null");
    if (
      !value ||
      value.version !== 1 ||
      !value.snapshot ||
      typeof value.snapshot !== "object" ||
      typeof value.baseline !== "string" ||
      !Number.isFinite(Date.parse(value.savedAt))
    )
      return null;
    const baseline = JSON.parse(value.baseline);
    if (!baseline || typeof baseline !== "object" || Array.isArray(baseline))
      return null;
    return value;
  } catch {
    return null;
  }
}

export function pushEditorHistory(
  history: string[],
  cursor: number,
  snapshot: string
): { history: string[]; cursor: number } {
  if (history[cursor] === snapshot) return { history, cursor };
  const next = [...history.slice(0, cursor + 1), snapshot].slice(-50);
  return { history: next, cursor: next.length - 1 };
}
