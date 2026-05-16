import { useEffect, useRef, useState } from 'react';
import { useServiceWorker } from '@/hooks/useServiceWorker';
import { Wifi, WifiOff, RefreshCw } from 'lucide-react';

export default function OfflineIndicator() {
  const { isOnline, updateAvailable, applyUpdate } = useServiceWorker();
  const [showBackOnline, setShowBackOnline] = useState(false);
  const prevOnline = useRef(isOnline);

  useEffect(() => {
    if (!prevOnline.current && isOnline) {
      // Just came back online — show flash message for 3 s
      setShowBackOnline(true);
      const t = setTimeout(() => setShowBackOnline(false), 3000);
      return () => clearTimeout(t);
    }
    prevOnline.current = isOnline;
  }, [isOnline]);

  const visible = !isOnline || updateAvailable || showBackOnline;
  if (!visible) return null;

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex flex-col gap-2 items-center pointer-events-none">
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

      {isOnline && updateAvailable && (
        <button
          onClick={applyUpdate}
          className="pointer-events-auto flex items-center gap-2.5 rounded-full border border-blue-200 bg-blue-50 px-4 py-2 shadow-lg text-blue-800 text-sm font-medium hover:bg-blue-100 transition-colors"
        >
          <RefreshCw className="h-4 w-4 shrink-0" />
          <span>Nova versão disponível — clique para atualizar</span>
        </button>
      )}
    </div>
  );
}
