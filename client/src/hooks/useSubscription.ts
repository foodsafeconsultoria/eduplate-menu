import { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';

export type SubscriptionStatus = 'trial' | 'active' | 'past_due' | 'canceled' | 'unknown';
export type PlanKey = 'essencial' | 'pro' | 'enterprise' | null;

export interface Subscription {
  status: SubscriptionStatus;
  plan: PlanKey;
  trialEndsAt: Date | null;
  trialDaysLeft: number;        // 0 if expired or not on trial
  isActive: boolean;            // true for 'active' or 'trial' (not expired)
  isPastDue: boolean;
  isCanceled: boolean;
  isTrialExpired: boolean;
  loading: boolean;
}

const TRIAL_GRACE_DAYS = 0; // extra days after trial expires before blocking

export function useSubscription(): Subscription {
  const { user } = useAuth();
  const [status, setStatus]         = useState<SubscriptionStatus>('unknown');
  const [plan, setPlan]             = useState<PlanKey>(null);
  const [trialEndsAt, setTrialEndsAt] = useState<Date | null>(null);
  const [loading, setLoading]       = useState(true);

  const orgId = user?.organizationId;

  useEffect(() => {
    if (!orgId) { setLoading(false); return; }

    const unsub = onSnapshot(doc(db, 'organizations', orgId), (snap) => {
      if (!snap.exists()) { setLoading(false); return; }
      const data = snap.data();

      setStatus((data.subscriptionStatus as SubscriptionStatus) || 'trial');
      setPlan((data.plan as PlanKey) || null);

      // Firestore Timestamps or plain Date
      const raw = data.trialEndsAt;
      if (raw) {
        setTrialEndsAt(typeof raw.toDate === 'function' ? raw.toDate() : new Date(raw));
      } else {
        setTrialEndsAt(null);
      }

      setLoading(false);
    });

    return unsub;
  }, [orgId]);

  const now = Date.now();
  const trialMs = trialEndsAt ? trialEndsAt.getTime() : 0;
  const trialDaysLeft = trialEndsAt
    ? Math.max(0, Math.ceil((trialMs - now) / (1000 * 60 * 60 * 24)))
    : 0;
  const isTrialExpired = status === 'trial' && trialEndsAt !== null && trialMs <= now - TRIAL_GRACE_DAYS * 86400000;
  const isActive = (status === 'active') || (status === 'trial' && !isTrialExpired);

  return {
    status,
    plan,
    trialEndsAt,
    trialDaysLeft,
    isActive,
    isPastDue: status === 'past_due',
    isCanceled: status === 'canceled',
    isTrialExpired,
    loading,
  };
}
