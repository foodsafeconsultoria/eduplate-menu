import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ setDoc: vi.fn(), deleteDoc: vi.fn(), onSnapshot: vi.fn(), doc: vi.fn(), collection: vi.fn() }));
vi.mock('firebase/firestore', () => mocks);
vi.mock('./firebase', () => ({ db: 'db' }));
import { confirmSchoolWrite, deleteSchoolOnServer, saveSchoolOnServer, subscribeServerSchools } from './schoolServerStore';
import type { School } from '../types';
const school: School = { id: 'a', name: 'Escola A', email: undefined, createdAt: new Date(), updatedAt: new Date(),
  mealSchedules: [{ mealLabel: 'Almoço', time: '11:30' }], studentCounts: { morning: 120 },
  documentation: { mbp: true, pops: false, technicalRecipes: false, popList: 'Higienização' } };
beforeEach(() => {
  vi.clearAllMocks();
  mocks.doc.mockReturnValue('document'); mocks.collection.mockReturnValue('collection');
  mocks.setDoc.mockResolvedValue(undefined); mocks.deleteDoc.mockResolvedValue(undefined);
});
describe('server-only school storage', () => {
  it('saves the full school in its organization and strips undefined values', async () => {
    await saveSchoolOnServer('org-a', school);
    expect(mocks.doc).toHaveBeenCalledWith('db', 'organizations', 'org-a', 'schools', 'a');
    expect(mocks.setDoc).toHaveBeenCalledWith('document', expect.objectContaining({ mealSchedules: school.mealSchedules,
      documentation: school.documentation, studentCounts: { morning: 120 } }));
    expect(mocks.setDoc.mock.calls[0][1]).not.toHaveProperty('email');
    expect(mocks.setDoc.mock.calls[0][1].createdAt).toBe(school.createdAt);
  });
  it('does not resolve before the server acknowledges and propagates permission failures', async () => {
    let acknowledge!: () => void;
    mocks.setDoc.mockImplementationOnce(() => new Promise<void>(resolve => { acknowledge = resolve; }));
    const completed = vi.fn();
    const pending = saveSchoolOnServer('org-a', school).then(completed);
    await Promise.resolve(); expect(completed).not.toHaveBeenCalled();
    acknowledge(); await pending; expect(completed).toHaveBeenCalledOnce();
    mocks.setDoc.mockRejectedValueOnce(new Error('permission-denied'));
    await expect(saveSchoolOnServer('org-a', school)).rejects.toThrow('permission-denied');
  });
  it('ignores cached and pending snapshots and delivers confirmed cross-PC updates', () => {
    const receive = vi.fn(), fail = vi.fn(), unsubscribe = vi.fn();
    mocks.onSnapshot.mockReturnValue(unsubscribe);
    expect(subscribeServerSchools('org-a', receive, fail)).toBe(unsubscribe);
    expect(mocks.collection).toHaveBeenCalledWith('db', 'organizations', 'org-a', 'schools');
    const next = mocks.onSnapshot.mock.calls[0][2];
    const docs = [{ id: 'a', data: () => ({ name: 'Escola A', mealSchedules: [{ mealLabel: 'Almoço', time: '12:00' }] }) }];
    next({ metadata: { fromCache: true, hasPendingWrites: false }, docs });
    next({ metadata: { fromCache: false, hasPendingWrites: true }, docs });
    expect(receive).not.toHaveBeenCalled();
    next({ metadata: { fromCache: false, hasPendingWrites: false }, docs });
    expect(receive).toHaveBeenCalledWith([{ id: 'a', name: 'Escola A', mealSchedules: [{ mealLabel: 'Almoço', time: '12:00' }] }]);
  });
  it('rejects offline saves before queuing a database write', async () => {
    vi.stubGlobal('navigator', { onLine: false });
    try {
      await expect(saveSchoolOnServer('org-a', school)).rejects.toThrow('Sem conexão');
      expect(mocks.setDoc).not.toHaveBeenCalled();
    } finally { vi.unstubAllGlobals(); }
  });
  it('deletes on the server and propagates failures', async () => {
    await deleteSchoolOnServer('org-a', 'a');
    expect(mocks.deleteDoc).toHaveBeenCalledWith('document');
    mocks.deleteDoc.mockRejectedValueOnce(new Error('permission-denied'));
    await expect(deleteSchoolOnServer('org-a', 'a')).rejects.toThrow('permission-denied');
  });
  it('times out without reporting an unconfirmed write as saved', async () => {
    vi.useFakeTimers();
    try {
      const result = confirmSchoolWrite(new Promise(() => {}), 15000);
      const assertion = expect(result).rejects.toThrow('Não foi possível confirmar');
      await vi.advanceTimersByTimeAsync(15000);
      await assertion;
      expect(vi.getTimerCount()).toBe(0);
    } finally { vi.useRealTimers(); }
  });
});
