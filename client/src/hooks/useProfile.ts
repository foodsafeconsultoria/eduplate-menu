import { useState, useEffect } from 'react';
import { UserProfile } from '@/types';
import { db } from '@/lib/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { useAuth } from '@/contexts/AuthContext';

/** Build a default profile from Firebase Auth so the page never hangs. */
function buildDefaultProfile(
  uid: string,
  displayName: string | null | undefined,
  email: string | null | undefined,
): UserProfile {
  return {
    id: uid,
    name: displayName || email?.split('@')[0] || 'Usuário',
    email: email || '',
    phone: '',
    role: 'nutricionista',
    school: '',
    bio: '',
    avatar: undefined,
    notifications: { email: true, sms: false, push: true },
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

export const useProfile = () => {
  const { user, loading: authLoading } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  // Keep loading=true while AuthContext is still resolving to avoid
  // flashing the "perfil não encontrado" error before the user object arrives.
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Do not do anything until auth has finished its own async check
    if (authLoading) return;

    const fetchProfile = async () => {
      if (!user?.uid) {
        setLoading(false);
        return;
      }
      // Reset on each user change so the spinner shows while re-fetching
      setLoading(true);
      setProfile(null);

      try {
        const docRef = doc(db, 'users', user.uid);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          const data = docSnap.data() as UserProfile;
          // Ensure notifications always has all three keys
          if (!data.notifications) {
            data.notifications = { email: true, sms: false, push: true };
          }
          setProfile(data);
        } else {
          // No Firestore doc yet — create one from Auth data
          const defaultProfile = buildDefaultProfile(
            user.uid,
            user.displayName,
            user.email,
          );
          // Persist to Firestore (fire-and-forget)
          setDoc(docRef, {
            ...defaultProfile,
            createdAt: defaultProfile.createdAt.toISOString(),
            updatedAt: defaultProfile.updatedAt.toISOString(),
          }).catch((e) => console.warn('Could not persist default profile:', e));
          setProfile(defaultProfile);
        }
      } catch (error) {
        console.error('Erro ao buscar perfil no Firebase:', error);
        // Even on error, render the page with a fallback profile
        if (user) {
          setProfile(buildDefaultProfile(user.uid, user.displayName, user.email));
        }
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [user, authLoading]);

  const updateProfile = async (updates: Partial<UserProfile> & { id: string }) => {
    if (!updates.id) return;

    const docRef = doc(db, 'users', updates.id);
    const now = new Date().toISOString();

    // Serialize dates before writing to Firestore
    const payload: Record<string, unknown> = { ...updates, updatedAt: now };
    if (payload.createdAt instanceof Date) {
      payload.createdAt = (payload.createdAt as Date).toISOString();
    }

    await setDoc(docRef, payload, { merge: true });
    setProfile((prev) =>
      prev ? { ...prev, ...updates, updatedAt: new Date() } : null,
    );
  };

  const updateAvatar = (avatar: string) => {
    if (user?.uid) updateProfile({ id: user.uid, avatar });
  };

  const updateNotifications = (notifications: UserProfile['notifications']) => {
    if (user?.uid) updateProfile({ id: user.uid, notifications });
  };

  return { profile, loading, updateProfile, updateAvatar, updateNotifications };
};
