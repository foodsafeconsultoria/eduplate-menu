import React, { createContext, useContext, useEffect, useState } from 'react';
import { User } from '@/types';
import { auth, db } from '@/lib/firebase';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from 'firebase/auth';
import { doc, getDoc, setDoc, collection, query, where, getDocs } from 'firebase/firestore';

/**
 * Legacy org ID: users who registered before multi-tenancy was added are
 * automatically placed in this shared org so they keep seeing each other's data.
 */
const LEGACY_ORG_ID = 'pnae-default-org';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  /**
   * inviteCode: 6-char code of an existing org to join.
   * If omitted, a brand-new org is created for this user.
   */
  register: (email: string, password: string, displayName: string, role: string, inviteCode?: string) => Promise<void>;
  logout: () => Promise<void>;
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
          // Back-fill organizationId for users registered before multi-tenancy
          if (!data.organizationId) {
            await setDoc(docRef, { organizationId: LEGACY_ORG_ID }, { merge: true });
            data.organizationId = LEGACY_ORG_ID;
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
            organizationId: LEGACY_ORG_ID,
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

  const register = async (email: string, password: string, displayName: string, role: string, inviteCode?: string) => {
    setError(null);
    let firebaseUser: import('firebase/auth').User | null = null;
    try {
      // ── Step 1: Create the Firebase Auth user FIRST ──────────────────────
      // The Firestore security rules require isSignedIn() for org creation and
      // invite-code lookup, so authentication must come before any Firestore writes.
      const res = await createUserWithEmailAndPassword(auth, email, password);
      firebaseUser = res.user;

      // ── Step 2: Resolve orgId ─────────────────────────────────────────────
      let orgId: string;

      if (inviteCode) {
        // User is now signed in → org read is allowed by Firestore rules.
        const orgsRef = collection(db, 'organizations');
        const q = query(orgsRef, where('inviteCode', '==', inviteCode.trim().toUpperCase()));
        const snap = await getDocs(q);
        if (snap.empty) {
          // Invalid code — delete the just-created auth user to avoid orphans,
          // then surface the error.
          await res.user.delete();
          firebaseUser = null;
          setError('Código de convite inválido. Verifique e tente novamente.');
          return;
        }
        orgId = snap.docs[0].id;
      } else {
        // Create a brand-new organisation. User is signed in, so the rule
        // `request.resource.data.ownerEmail == request.auth.token.email` passes.
        orgId = crypto.randomUUID();
        const newInviteCode = Math.random().toString(36).substring(2, 8).toUpperCase();
        const trialEndsAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000); // +14 days
        await setDoc(doc(db, 'organizations', orgId), {
          id: orgId,
          inviteCode: newInviteCode,
          ownerEmail: email,
          createdAt: new Date(),
          subscriptionStatus: 'trial',
          plan: null,
          trialEndsAt,
        });
      }

      // ── Step 3: Write the user document ──────────────────────────────────
      const userData = {
        email,
        displayName,
        role,
        organizationId: orgId,
        createdAt: new Date(),
        uid: res.user.uid,
      };
      await setDoc(doc(db, 'users', res.user.uid), userData);
      // Explicitly set user state so the dashboard loads with the correct org,
      // overriding any fallback state set by the onAuthStateChanged handler.
      setUser(userData as User);
    } catch (err: any) {
      if (err.code === 'auth/email-already-in-use') {
        setError('Este e-mail já está em uso.');
      } else if (err.code === 'auth/weak-password') {
        setError('A senha deve ter pelo menos 6 caracteres.');
      } else if (!err.message?.includes('inválido')) {
        setError('Erro ao criar conta. Tente novamente.');
      }
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
    <AuthContext.Provider value={{ user, loading, error, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth deve ser usado dentro de AuthProvider');
  return context;
};