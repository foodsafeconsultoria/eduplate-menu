import { collection, deleteDoc, doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from './firebase';
import type { School } from '../types';

function payload(value: unknown): unknown {
  if (value instanceof Date) return value;
  if (Array.isArray(value)) return value.map(payload);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined).map(([key, item]) => [key, payload(item)]));
  return value;
}
export async function confirmSchoolWrite(work: Promise<unknown>, timeoutMs = 15000): Promise<void> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([work, new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error('Não foi possível confirmar o salvamento no servidor. Verifique a conexão e tente novamente.')), timeoutMs);
    })]);
  } finally { if (timer) clearTimeout(timer); }
}
export function subscribeServerSchools(orgId: string, receive: (raw: unknown[]) => void, fail: (error: Error) => void) {
  return onSnapshot(collection(db, 'organizations', orgId, 'schools'), { includeMetadataChanges: true }, snapshot => {
    // Never present cached data or unconfirmed offline writes as server records.
    if (snapshot.metadata.fromCache || snapshot.metadata.hasPendingWrites) return;
    receive(snapshot.docs.map(item => ({ ...item.data(), id: item.id })));
  }, fail);
}
export async function saveSchoolOnServer(orgId: string, school: School) {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) throw new Error('Sem conexão. Conecte-se à internet para salvar a escola.');
  await confirmSchoolWrite(setDoc(doc(db, 'organizations', orgId, 'schools', school.id), payload(school)));
}
export async function deleteSchoolOnServer(orgId: string, id: string) {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) throw new Error('Sem conexão. Conecte-se à internet para excluir a escola.');
  await confirmSchoolWrite(deleteDoc(doc(db, 'organizations', orgId, 'schools', id)));
}
