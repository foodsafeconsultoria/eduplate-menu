import { useEffect, useRef, useState } from 'react';
import { useServiceWorker } from '@/hooks/useServiceWorker';
import { Wifi, WifiOff, RefreshCw } from 'lucide-react';

export default function OfflineIndicator() {
  const { isOnline, updateAvailable, isUpdating, updateError, applyUpdate, dismissUpdate } = useServiceWorker();
  const [showBackOnline, setShowBackOnline] = useState(false);
  const prevOnline = useRef(isOnline);

  useEffect(() => {
    const wasOnline = prevOnline.current;
    prevOnline.current = isOnline;
    if (!wasOnline && isOnline) {
      // Just came back online — show flash message for 3 s
      setShowBackOnline(true);
      const t = setTimeout(() => setShowBackOnline(false), 3000);
      return () => clearTimeout(t);
    }
    if (!isOnline) setShowBackOnline(false);
  }, [isOnline]);

  const visible = !isOnline || updateAvailable || isUpdating || !!updateError || showBackOnline;
  if (!visible) return null;

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex w-[calc(100%-2rem)] max-w-md flex-col gap-2 items-center pointer-events-none" aria-live="polite">
      {!isOnline && (
        <div className="pointer-events-auto flex items-center gap-2.5 rounded-full border border-amber-200 bg-amber-50 px-4 py-2 shadow-lg text-amber-800 text-sm font-medium">
          <WifiOff className="h-4 w-4 shrink-0" />
          <span>Modo offline — dados locais disponíveis</span>
        </div>
      )}

      {isOnline && showBackOnline && (
        <div className="pointer-events-auto flex items-center gap-2.5 rounded-full border border-green-200 bg-green-50 px-4 py-2 shadow-md text-green-800 text-sm font-medium">
          <Wifi className="h-4 w-4 shrink-0" />
          <span>Conexão restabelecida</span>
        </div>
      )}

      {isOnline && (updateAvailable || isUpdating || updateError) && (
        <div className="pointer-events-auto w-full rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 shadow-lg text-blue-800 text-sm">
          <div className="flex items-center gap-2">
            <RefreshCw className={`h-4 w-4 shrink-0 ${isUpdating ? 'animate-spin' : ''}`} />
            <span>{isUpdating ? 'Atualizando…' : updateError || 'Nova versão disponível'}</span>
          </div>
          {!isUpdating && (
            <div className="mt-2 flex justify-end gap-4">
              <button type="button" onClick={dismissUpdate} className="rounded px-2 py-1 hover:bg-blue-100">Agora não</button>
              {updateAvailable && <button type="button" onClick={applyUpdate} className="rounded px-2 py-1 font-semibold hover:bg-blue-100">Atualizar</button>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
