export function readPendingMenus<T extends { id: string }>(
  storage: Pick<Storage, "getItem">,
  key: string
): Record<string, T> {
  const raw = storage.getItem(key);
  if (!raw) return {};
  const parsed = JSON.parse(raw);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
    throw new Error("Fila de sincronização inválida.");
  return parsed;
}

export function acknowledgeMenu<T extends { id: string }>(
  pending: Record<string, T>,
  sent: T
): Record<string, T> {
  // A slow acknowledgement must never remove a newer edit waiting to be sent.
  if (JSON.stringify(pending[sent.id]) !== JSON.stringify(sent)) return pending;
  const next = { ...pending };
  delete next[sent.id];
  return next;
}
