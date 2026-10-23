import { afterEach, describe, expect, it, vi } from 'vitest';
import { activateWaitingWorker, watchWaitingWorker } from './serviceWorkerUpdates';

class Worker extends EventTarget {
  state: ServiceWorkerState = 'installed';
  postMessage = vi.fn();
}
const asWorker = (worker: Worker) => worker as unknown as ServiceWorker;

afterEach(() => vi.useRealTimers());

describe('service worker updates', () => {
  it('removes stale notices when an automatically activating worker leaves waiting', () => {
    const worker = new Worker();
    const registration = Object.assign(new EventTarget(), {
      waiting: asWorker(worker) as ServiceWorker | null,
      installing: null as ServiceWorker | null,
    });
    const change = vi.fn();
    const stop = watchWaitingWorker(registration as ServiceWorkerRegistration, change);
    expect(change).toHaveBeenLastCalledWith(worker);
    registration.waiting = null;
    worker.state = 'activating';
    worker.dispatchEvent(new Event('statechange'));
    expect(change).toHaveBeenLastCalledWith(null);
    stop();
    change.mockClear();
    worker.dispatchEvent(new Event('statechange'));
    registration.dispatchEvent(new Event('updatefound'));
    expect(change).not.toHaveBeenCalled();
  });

  it('announces a newly installed update and ignores first installs that already activated', () => {
    const worker = new Worker();
    worker.state = 'installing';
    const registration = Object.assign(new EventTarget(), {
      waiting: null as ServiceWorker | null,
      installing: null as ServiceWorker | null,
    });
    const change = vi.fn();
    const stop = watchWaitingWorker(registration as ServiceWorkerRegistration, change);
    registration.installing = asWorker(worker);
    registration.dispatchEvent(new Event('updatefound'));
    expect(change).toHaveBeenLastCalledWith(null);
    worker.state = 'installed';
    registration.waiting = asWorker(worker);
    worker.dispatchEvent(new Event('statechange'));
    expect(change).toHaveBeenLastCalledWith(worker);
    worker.state = 'activated';
    registration.waiting = null;
    worker.dispatchEvent(new Event('statechange'));
    expect(change).toHaveBeenLastCalledWith(null);
    stop();
  });

  it('waits for the requested worker to control the page before reloading once', async () => {
    const worker = new Worker();
    const container = Object.assign(new EventTarget(), { controller: null as ServiceWorker | null });
    const reload = vi.fn();
    const result = activateWaitingWorker(asWorker(worker), container as ServiceWorkerContainer, reload);
    expect(worker.postMessage).toHaveBeenCalledWith({ type: 'SKIP_WAITING' });
    expect(reload).not.toHaveBeenCalled();
    container.dispatchEvent(new Event('controllerchange'));
    expect(reload).not.toHaveBeenCalled();
    container.controller = asWorker(worker);
    container.dispatchEvent(new Event('controllerchange'));
    await result;
    container.dispatchEvent(new Event('controllerchange'));
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('allows retry after an activation timeout without reloading later', async () => {
    vi.useFakeTimers();
    const worker = new Worker();
    const container = Object.assign(new EventTarget(), { controller: null as ServiceWorker | null });
    const reload = vi.fn();
    const result = activateWaitingWorker(asWorker(worker), container as ServiceWorkerContainer, reload);
    const rejected = expect(result).rejects.toThrow('demorou');
    await vi.advanceTimersByTimeAsync(15000);
    await rejected;
    container.controller = asWorker(worker);
    container.dispatchEvent(new Event('controllerchange'));
    expect(reload).not.toHaveBeenCalled();
  });
});
