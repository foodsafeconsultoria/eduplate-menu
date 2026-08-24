import React, { createContext, useContext, useEffect, useState } from 'react';
import { User } from '@/types';
import { auth, db } from '@/lib/firebase';
import { apiUrl, authHeaders } from '@/lib/apiUrl';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  sendPasswordResetEmail,
} from 'firebase/auth';
import { doc, getDoc, setDoc, collection, query, where, getDocs } from 'firebase/firestore';

/**
 * Creates an isolated recovery org for accounts that are missing organization
 * data, avoiding accidental placement into a shared tenant.
 */
async function createRecoveryOrganization(email: string) {
  const orgId = crypto.randomUUID();
  const inviteCode = Math.random().toString(36).substring(2, 8).toUpperCase();
  const trialEndsAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  await setDoc(doc(db, 'organizations', orgId), {
    id: orgId,
    inviteCode,
    ownerEmail: email,
    createdAt: new Date(),
    subscriptionStatus: 'trial',
    plan: null,
    trialEndsAt,
  });

  return orgId;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  /**
   * inviteCode: 6-char code of an existing org to join.
   * If omitted, a brand-new org is created for this user.
   */
  register: (email: string, password: string, displayName: string, role: string, inviteCode?: string, phone?: string) => Promise<void>;
  logout: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Monitora se o usuário está logado ou não
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        const docRef = doc(db, "users", firebaseUser.uid);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          const data = docSnap.data();
          if (!data.organizationId) {
            const recoveryOrgId = await createRecoveryOrganization(firebaseUser.email || '');
            await setDoc(docRef, { organizationId: recoveryOrgId }, { merge: true });
            data.organizationId = recoveryOrgId;
          }
          setUser({ uid: firebaseUser.uid, ...data } as User);
        } else {
          // Usuário autenticado mas sem doc no Firestore ainda —
          // usa dados do Auth como fallback para não bloquear a navegação.
          const fallback: User = {
            uid: firebaseUser.uid,
            email: firebaseUser.email || '',
            displayName:
            firebaseUser.displayName ||
              firebaseUser.email?.split('@')[0] ||
              'Usuário',
            role: 'nutricionista',
            organizationId: await createRecoveryOrganization(firebaseUser.email || ''),
            createdAt: new Date(),
          };
          await setDoc(docRef, fallback, { merge: true });
          setUser(fallback);
        }
      } else {
        setUser(null);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const login = async (email: string, password: string) => {
    setError(null);
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err: any) {
      setError("Email ou senha incorretos.");
      throw err;
    }
  };

  const register = async (email: string, password: string, displayName: string, role: string, inviteCode?: string, phone?: string) => {
    setError(null);
    let firebaseUser: import('firebase/auth').User | null = null;
    try {
      // ── Step 1: Create the Firebase Auth user FIRST ──────────────────────
      // The Firestore security rules require isSignedIn() for org creation and
      // invite-code lookup, so authentication must come before any Firestore writes.
      const res = await createUserWithEmailAndPassword(auth, email, password);
      firebaseUser = res.user;

      // ── Step 1b: Phone uniqueness check (best-effort — skip if Firestore rules deny) ──
      // NOTE: Firestore collection-level queries require list permission in rules.
      // If the query fails, we continue registration without blocking the user.
      if (phone) {
        try {
          const usersRef = collection(db, 'users');
          const phoneSnap = await getDocs(query(usersRef, where('phone', '==', phone)));
          if (!phoneSnap.empty) {
            await res.user.delete();
            firebaseUser = null;
            setError('Este número de celular já está cadastrado. Faça login ou use outro número.');
            throw new Error('phone-already-in-use');
          }
        } catch (phoneErr: any) {
          // If the error is our own phone-duplicate signal, re-throw it
          if (phoneErr.message === 'phone-already-in-use') throw phoneErr;
          // Otherwise (Firestore permissions, network, etc.) — log and continue
          console.warn('Phone uniqueness check skipped:', phoneErr?.message);
        }
      }

      // ── Step 2: Resolve orgId ─────────────────────────────────────────────
      let orgId: string;

      if (inviteCode) {
        const response = await fetch(apiUrl('/api/org/resolve-invite'), {
          method: 'POST',
          headers: await authHeaders(),
          body: JSON.stringify({ inviteCode: inviteCode.trim().toUpperCase() }),
        });
        const data = await response.json().catch(() => ({}));

        if (!response.ok || !data.orgId) {
          // Invalid code — delete the just-created auth user to avoid orphans,
          // then surface the error.
          await res.user.delete();
          firebaseUser = null;
          setError('Código de convite inválido. Verifique e tente novamente.');
          return;
        }
        orgId = data.orgId;
      } else {
        orgId = await createRecoveryOrganization(email);
      }

      // ── Step 3: Write the user document ──────────────────────────────────
      const userData = {
        email,
        displayName,
        role,
        organizationId: orgId,
        createdAt: new Date(),
        uid: res.user.uid,
        ...(phone ? { phone } : {}),
      };
      await setDoc(doc(db, 'users', res.user.uid), userData);
      // Explicitly set user state so the dashboard loads with the correct org,
      // overriding any fallback state set by the onAuthStateChanged handler.
      setUser(userData as User);
    } catch (err: any) {
      // phone-already-in-use: error message was already set above, don't overwrite
      if (err.message === 'phone-already-in-use') {
        throw err;
      }
      if (err.code === 'auth/email-already-in-use') {
        setError('Este e-mail já está em uso.');
      } else if (err.code === 'auth/weak-password') {
        setError('A senha deve ter pelo menos 6 caracteres.');
      } else if (err.code === 'auth/too-many-requests') {
        setError('Muitas tentativas seguidas. Aguarde alguns minutos e tente novamente.');
      } else if (!err.message?.includes('inválido')) {
        setError('Erro ao criar conta. Tente novamente.');
      }
      throw err;
    }
  };

  const resetPassword = async (email: string) => {
    setError(null);
    try {
      await sendPasswordResetEmail(auth, email);
    } catch (err: any) {
      setError('Não foi possível enviar o e-mail. Verifique o endereço e tente novamente.');
      throw err;
    }
  };

  // FUNÇÃO DE SAIR CORRIGIDA
  const logout = async () => {
    try {
      await signOut(auth); // Desloga do Firebase
      setUser(null);       // Limpa os dados da tela
      // Força o navegador a ir para a tela de login e limpa a memória
      window.location.href = '/login'; 
    } catch (err: any) {
      console.error("Erro ao sair:", err);
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, error, login, register, logout, resetPassword }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth deve ser usado dentro de AuthProvider');
  return context;
};
