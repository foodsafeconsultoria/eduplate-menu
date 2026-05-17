/**
 * useOrgSettings
 * Manages organisation-level branding and configuration stored in Firestore.
 * Document path: organizations/{orgId}/settings/branding
 *
 * Fields:
 *   logoUrl          – municipality / school logo (Firebase Storage URL)
 *   logoDataUrl      – logo as base64 dataURL (salvo no Firestore para evitar CORS no PDF)
 *   signatureUrl     – nutritionist RT handwritten signature (Firebase Storage URL)
 *   signatureDataUrl – assinatura como base64 dataURL (salvo no Firestore para evitar CORS)
 *   nutritionistName – full name
 *   nutritionistCrn  – CRN registration number
 *   municipio        – city name
 *   uf               – state abbreviation
 */
import { useCallback, useEffect, useState } from 'react';
import { db, storage } from '@/lib/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { useAuth } from '@/contexts/AuthContext';

export interface OrgSettings {
  logoUrl?: string;
  logoDataUrl?: string;        // base64 dataURL — sem CORS, usada diretamente no PDF
  signatureUrl?: string;
  signatureDataUrl?: string;   // base64 dataURL — sem CORS, usada diretamente no PDF
  nutritionistName?: string;
  nutritionistCrn?: string;
  municipio?: string;
  uf?: string;
}

const LEGACY_ORG_ID = 'pnae-default-org';

function storageKey(orgId: string) {
  return `pnae_org_settings_${orgId}`;
}

/** Converte um File para dataURL (base64) */
function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function useOrgSettings() {
  const { user } = useAuth();
  const orgId = user?.organizationId || LEGACY_ORG_ID;

  const [settings, setSettings] = useState<OrgSettings>(() => {
    try {
      const raw = localStorage.getItem(storageKey(orgId));
      return raw ? JSON.parse(raw) : {};
    } catch { return {}; }
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // ── Load from Firestore on mount ───────────────────────────────────────────
  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        // Also try legacy SIGPC config as seed
        const legacyRaw =
          localStorage.getItem(`pnae_sigpc_entity_config_${orgId}`) ||
          localStorage.getItem('pnae_sigpc_entity_config');
        const legacy = legacyRaw ? JSON.parse(legacyRaw) : {};

        // Try Firestore
        const ref = doc(db, 'organizations', orgId, 'settings', 'branding');
        const snap = await getDoc(ref);
        if (!mounted) return;

        if (snap.exists()) {
          const data = snap.data() as OrgSettings;
          setSettings(data);
          localStorage.setItem(storageKey(orgId), JSON.stringify(data));
        } else if (Object.keys(legacy).length > 0) {
          // Seed from SIGPC config
          const seeded: OrgSettings = {
            nutritionistName: legacy.nutricionista || '',
            nutritionistCrn:  legacy.crn           || '',
            municipio:        legacy.municipio      || '',
            uf:               legacy.uf             || 'SP',
          };
          setSettings(seeded);
        }
      } catch (err) {
        console.warn('[useOrgSettings] load error:', err);
      } finally {
        if (mounted) setLoading(false);
      }
    };
    load();
    return () => { mounted = false; };
  }, [orgId]);

  // ── Save to Firestore ──────────────────────────────────────────────────────
  const saveSettings = useCallback(async (updates: Partial<OrgSettings>) => {
    const next = { ...settings, ...updates };
    setSettings(next);
    localStorage.setItem(storageKey(orgId), JSON.stringify(next));
    setSaving(true);
    try {
      await setDoc(
        doc(db, 'organizations', orgId, 'settings', 'branding'),
        next,
        { merge: true },
      );
    } catch (err) {
      console.warn('[useOrgSettings] save error:', err);
    } finally {
      setSaving(false);
    }
  }, [orgId, settings]);

  // ── Upload image: Storage (URL) + Firestore (dataURL) ────────────────────
  // Salva a imagem no Storage E o dataURL no Firestore para uso no PDF sem CORS
  const uploadImage = useCallback(async (
    file: File,
    field: 'logo' | 'signature',
  ): Promise<string> => {
    // 1. Upload para Firebase Storage
    const path = `orgs/${orgId}/branding/${field}_${Date.now()}.png`;
    const fRef = storageRef(storage, path);
    await uploadBytes(fRef, file);
    const url = await getDownloadURL(fRef);

    // 2. Converter para dataURL e salvar no Firestore imediatamente
    try {
      const dataUrl = await fileToDataUrl(file);
      const dataField = field === 'logo' ? 'logoDataUrl' : 'signatureDataUrl';
      // Salva só o dataURL (merge) — o caller cuida do resto
      await setDoc(
        doc(db, 'organizations', orgId, 'settings', 'branding'),
        { [dataField]: dataUrl },
        { merge: true },
      );
      // Atualiza estado local imediatamente
      setSettings(prev => ({ ...prev, [dataField]: dataUrl }));
    } catch (err) {
      console.warn('[useOrgSettings] dataUrl save error:', err);
    }

    return url;
  }, [orgId]);

  return {
    settings,
    loading,
    saving,
    saveSettings,
    uploadImage,
  };
}
