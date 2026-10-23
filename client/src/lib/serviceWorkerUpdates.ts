/** Track only workers that can actually be activated by the update button. */
export function watchWaitingWorker(
  registration: ServiceWorkerRegistration,
  onChange: (worker: ServiceWorker | null) => void,
) {
  const observed = new Set<ServiceWorker>();
  const refresh = () => {
    const waiting = registration.waiting;
    onChange(waiting?.state === 'installed' ? waiting : null);
  };
  const observe = (worker: ServiceWorker | null) => {
    if (!worker || observed.has(worker)) return;
    observed.add(worker);
    worker.addEventListener('statechange', refresh);
  };
  const updateFound = () => {
    observe(registration.installing);
    refresh();
  };
  observe(registration.waiting);
  updateFound();
  registration.addEventListener('updatefound', updateFound);
  return () => {
    registration.removeEventListener('updatefound', updateFound);
    observed.forEach((worker) => worker.removeEventListener('statechange', refresh));
  };
}

/** Reload only after the replacement worker controls this page. */
export function activateWaitingWorker(
  worker: ServiceWorker,
  container: ServiceWorkerContainer,
  reload: () => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const cleanup = () => {
      clearTimeout(timeout);
      container.removeEventListener('controllerchange', changed);
    };
    const changed = () => {
      if (container.controller !== worker) return;
      cleanup();
      reload();
      resolve();
    };
    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error('A atualização demorou mais que o esperado. Tente novamente.'));
    }, 15000);
    container.addEventListener('controllerchange', changed);
    try {
      worker.postMessage({ type: 'SKIP_WAITING' });
    } catch (error) {
      cleanup();
      reject(error);
    }
  });
}
