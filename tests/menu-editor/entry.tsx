import React from "react";
import { createRoot } from "react-dom/client";
import Menus from "../../client/src/pages/nutrition/Menus";
import { Toaster } from "../../client/src/components/ui/sonner";
import "../../client/src/index.css";
import { useMenus } from "../../client/src/hooks/useMenus";
function SyncObserver() {
  const { syncStates } = useMenus();
  return (
    <output hidden data-qa-sync-observer>
      {JSON.stringify(syncStates)}
    </output>
  );
}
createRoot(document.getElementById("root")!).render(
  <>
    <SyncObserver />
    <Menus />
    <Toaster />
  </>
);
