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

function normalizeDocuments(raw: unknown): OrgDocument[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((item, index) => {
    const doc = item as Partial<OrgDocument>;
    return {
      id: doc.id || `doc-imported-${index}`,
      name: doc.name || 'Documento sem nome',
      category: doc.category || 'Outros',
      description: doc.description,
      expiryDate: doc.expiryDate,
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

  // Returns documents expiring within `days` days (or already expired)
  const getExpiringDocuments = (days = 30): OrgDocument[] => {
    const now = new Date();
    const cutoff = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
    return documents.filter(d => {
      if (!d.expiryDate) return false;
      const exp = new Date(d.expiryDate + 'T23:59:59');
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
