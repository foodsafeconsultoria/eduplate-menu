import { useEffect, useRef, useState } from 'react';
import { activateWaitingWorker, watchWaitingWorker } from '@/lib/serviceWorkerUpdates';

export function useServiceWorker() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null);
  const [dismissedWorker, setDismissedWorker] = useState<ServiceWorker | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [updateError, setUpdateError] = useState('');
  const applying = useRef(false);

  useEffect(() => {
    let disposed = false;
    let stopWatching: (() => void) | undefined;
    if ('serviceWorker' in navigator && import.meta.env.PROD) {
      navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' })
        .then((registration) => {
          if (disposed) return;
          stopWatching = watchWaitingWorker(registration, setWaitingWorker);
        })
        .catch((error) => console.warn('[SW] Registration failed:', error));
    }
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      disposed = true;
      stopWatching?.();
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const applyUpdate = async () => {
    if (applying.current || !waitingWorker) return;
    if (waitingWorker.state !== 'installed') {
      setWaitingWorker(null);
      return;
    }
    applying.current = true;
    setIsUpdating(true);
    setUpdateError('');
    try {
      await activateWaitingWorker(waitingWorker, navigator.serviceWorker, () => window.location.reload());
    } catch {
      setUpdateError('Não foi possível atualizar. Tente novamente mais tarde.');
    } finally {
      applying.current = false;
      setIsUpdating(false);
    }
  };

  const dismissUpdate = () => {
    setDismissedWorker(waitingWorker);
    setUpdateError('');
  };

  return {
    isOnline,
    updateAvailable: !!waitingWorker && waitingWorker !== dismissedWorker,
    isUpdating,
    updateError,
    applyUpdate,
    dismissUpdate,
  };
}
