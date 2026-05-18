import { useState, useEffect } from 'react';
import { MaintenanceTicket } from '@/types';
import { loadHybridCollection, persistHybridSnapshot, removeHybridDocument, syncHybridDocument } from '@/lib/hybridStore';
import { useAuth } from '@/contexts/AuthContext';
import { useOrgId } from '@/hooks/useOrgId';

const STORAGE_KEY = 'pnae_maintenance_tickets';
const COLLECTION_NAME = 'maintenance_tickets';
const LEGACY_ORG_ID = 'pnae-default-org';

function toDate(value: unknown): Date {
  if (!value) return new Date();
  if (typeof (value as any).toDate === 'function') return (value as any).toDate();
  if (value instanceof Date) return value;
  const d = new Date(value as string | number);
  return isNaN(d.getTime()) ? new Date() : d;
}

function normalizeTickets(raw: unknown): MaintenanceTicket[] {
  if (!Array.isArray(raw)) return [];

  return raw.map((item, index) => {
    const ticket = item as Partial<MaintenanceTicket>;
    return {
      id: ticket.id || `ticket-imported-${index}`,
      schoolId: ticket.schoolId || '',
      schoolName: ticket.schoolName || '',
      inspectionId: ticket.inspectionId,
      equipment: ticket.equipment || '',
      description: ticket.description || '',
      photo: ticket.photo,
      priority: ticket.priority || 'low',
      status: ticket.status || 'open',
      createdAt: toDate(ticket.createdAt),
      createdBy: ticket.createdBy || 'Sistema',
      resolvedAt: ticket.resolvedAt ? toDate(ticket.resolvedAt) : undefined,
    };
  });
}

export const useMaintenanceTickets = () => {
  const { user } = useAuth();
  const orgId = useOrgId();

  const [tickets, setTickets] = useState<MaintenanceTicket[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!orgId) { setLoading(false); return; }
    let mounted = true;
    loadHybridCollection({
      orgId,
      collectionName: COLLECTION_NAME,
      storageKey: STORAGE_KEY,
      normalize: normalizeTickets,
      fallbackData: [],
    })
      .then((items) => {
        if (mounted) setTickets(items);
      })
      .catch((err) => {
        console.error('Erro ao carregar tickets:', err);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [orgId]);

  const addTicket = (ticket: Omit<MaintenanceTicket, 'id'>) => {
    const newTicket: MaintenanceTicket = {
      ...ticket,
      id: `ticket-${crypto.randomUUID()}`,
    };

    const updated = [newTicket, ...tickets];
    setTickets(updated);
    persistHybridSnapshot(`${STORAGE_KEY}_${orgId}`, updated);
    void syncHybridDocument(orgId, COLLECTION_NAME, newTicket);
    return newTicket;
  };

  const updateTicket = (id: string, updates: Partial<MaintenanceTicket>) => {
    const updated = tickets.map(t => t.id === id ? { ...t, ...updates } : t);
    setTickets(updated);
    persistHybridSnapshot(`${STORAGE_KEY}_${orgId}`, updated);
    const changed = updated.find((ticket) => ticket.id === id);
    if (changed) void syncHybridDocument(orgId, COLLECTION_NAME, changed);
  };

  const deleteTicket = (id: string) => {
    const updated = tickets.filter(t => t.id !== id);
    setTickets(updated);
    persistHybridSnapshot(`${STORAGE_KEY}_${orgId}`, updated);
    void removeHybridDocument(orgId, COLLECTION_NAME, id);
  };

  const getTicketsBySchool = (schoolId: string) => {
    return tickets.filter(t => t.schoolId === schoolId);
  };

  const getTicketsByInspection = (inspectionId: string) => {
    return tickets.filter(t => t.inspectionId === inspectionId);
  };

  return {
    tickets,
    loading,
    addTicket,
    updateTicket,
    deleteTicket,
    getTicketsBySchool,
    getTicketsByInspection
  };
};
