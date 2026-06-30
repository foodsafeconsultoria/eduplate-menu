import { useState, useEffect } from 'react';
import { OrgDocument } from '@/types';
import { loadHybridCollection, persistHybridSnapshot, removeHybridDocument, syncHybridDocument } from '@/lib/hybridStore';
import { useAuth } from '@/contexts/AuthContext';
import { useOrgId } from '@/hooks/useOrgId';

const STORAGE_KEY = 'pnae_org_documents';
const COLLECTION_NAME = 'org_documents';
const LEGACY_ORG_ID = 'pnae-default-org';

function toDate(value: unknown): Date {
  if (!value) return new Date();
  if (typeof (value as any).toDate === 'function') return (value as any).toDate();
  if (value instanceof Date) return value;
  const d = new Date(value as string | number);
  return isNaN(d.getTime()) ? new Date() : d;
}

/**
 * Converte qualquer formato de validade (string 'AAAA-MM-DD', ISO completo,
 * Date, Firestore Timestamp) para uma string canônica 'AAAA-MM-DD'.
 * Retorna undefined quando não há data válida — evita falsos "vencidos".
 */
export function toISODateString(value: unknown): string | undefined {
  if (!value) return undefined;
  // Já no formato 'AAAA-MM-DD' (ou com hora) — pega só a parte da data
  if (typeof value === 'string') {
    const m = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) return `${m[1]}-${m[2]}-${m[3]}`;
    const d = new Date(value);
    return isNaN(d.getTime()) ? undefined : d.toISOString().slice(0, 10);
  }
  if (typeof (value as any).toDate === 'function') {
    const d = (value as any).toDate();
    return isNaN(d.getTime()) ? undefined : d.toISOString().slice(0, 10);
  }
  if (value instanceof Date) {
    return isNaN(value.getTime()) ? undefined : value.toISOString().slice(0, 10);
  }
  return undefined;
}

/** Status de validade a partir de uma string 'AAAA-MM-DD' canônica. */
export function expiryStatusFromISO(iso?: string): 'expired' | 'soon' | 'ok' | 'none' {
  if (!iso) return 'none';
  const exp = new Date(iso + 'T23:59:59');
  if (isNaN(exp.getTime())) return 'none';
  const diff = Math.ceil((exp.getTime() - Date.now()) / 86400000);
  if (diff < 0) return 'expired';
  if (diff <= 30) return 'soon';
  return 'ok';
}

function normalizeDocuments(raw: unknown): OrgDocument[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((item, index) => {
    const doc = item as Partial<OrgDocument>;
    return {
      id: doc.id || `doc-imported-${index}`,
      name: doc.name || 'Documento sem nome',
      category: doc.category || 'Outros',
      description: doc.description,
      // Normaliza qualquer formato de validade para 'AAAA-MM-DD' (ou undefined)
      expiryDate: toISODateString(doc.expiryDate),
      fileUrl: doc.fileUrl,
      fileName: doc.fileName,
      uploadedAt: doc.uploadedAt ? toDate(doc.uploadedAt) : undefined,
      updatedAt: doc.updatedAt ? toDate(doc.updatedAt) : undefined,
    };
  });
}

export const useDocuments = () => {
  const { user } = useAuth();
  const orgId = useOrgId();

  const [documents, setDocuments] = useState<OrgDocument[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!orgId) { setLoading(false); return; }

    let mounted = true;
    setLoading(true);
    loadHybridCollection({
      orgId,
      collectionName: COLLECTION_NAME,
      storageKey: STORAGE_KEY,
      normalize: normalizeDocuments,
      fallbackData: [],
    })
      .then((items) => {
        if (mounted) setDocuments(items);
      })
      .catch((err) => {
        console.error('Erro ao carregar documentos:', err);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => { mounted = false; };
  }, [orgId]);

  const addDocument = (doc: Omit<OrgDocument, 'id'>) => {
    const newDoc: OrgDocument = {
      ...doc,
      id: `doc-${crypto.randomUUID()}`,
      uploadedAt: new Date(),
      updatedAt: new Date(),
    };
    const updated = [newDoc, ...documents];
    setDocuments(updated);
    persistHybridSnapshot(`${STORAGE_KEY}_${orgId}`, updated);
    void syncHybridDocument(orgId, COLLECTION_NAME, newDoc);
    return newDoc;
  };

  const updateDocument = (id: string, updates: Partial<OrgDocument>) => {
    const updated = documents.map(d =>
      d.id === id ? { ...d, ...updates, updatedAt: new Date() } : d
    );
    setDocuments(updated);
    persistHybridSnapshot(`${STORAGE_KEY}_${orgId}`, updated);
    const changed = updated.find(d => d.id === id);
    if (changed) void syncHybridDocument(orgId, COLLECTION_NAME, changed);
  };

  const deleteDocument = (id: string) => {
    const updated = documents.filter(d => d.id !== id);
    setDocuments(updated);
    persistHybridSnapshot(`${STORAGE_KEY}_${orgId}`, updated);
    void removeHybridDocument(orgId, COLLECTION_NAME, id);
  };

  // Returns documents expiring within `days` days (or already expired).
  const getExpiringDocuments = (days = 30): OrgDocument[] => {
    const cutoff = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
    return documents.filter(d => {
      const iso = toISODateString(d.expiryDate);
      if (!iso) return false;
      const exp = new Date(iso + 'T23:59:59');
      if (isNaN(exp.getTime())) return false;
      return exp <= cutoff;
    });
  };

  return {
    documents,
    loading,
    addDocument,
    updateDocument,
    deleteDocument,
    getExpiringDocuments,
  };
};
