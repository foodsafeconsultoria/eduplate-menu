/**
 * /cadastro?token=XXX&orgId=YYY
 *
 * Post-payment account creation page.
 * The user lands here after completing Stripe Checkout.
 * They verify their token, then create name + password to activate their account.
 */
import React, { useEffect, useState } from 'react';
import { useSearch, useLocation } from 'wouter';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { Input } from '@/components/ui/input';
import { AlertCircle, CheckCircle2, Loader2, Lock, User } from 'lucide-react';
import EduPlateLogo from '@/components/EduPlateLogo';
import { apiUrl, authHeaders } from '@/lib/apiUrl';

type Status = 'loading' | 'ready' | 'creating' | 'done' | 'error';

export default function Cadastro() {
  const search = useSearch();
  const params = new URLSearchParams(search);
  const token = params.get('token') || '';
  const orgId = params.get('orgId') || '';
  const [, navigate] = useLocation();

  const [status, setStatus] = useState<Status>('loading');
  const [email, setEmail] = useState('');
  const [plan, setPlan] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Verify token on mount
  useEffect(() => {
    if (!token || !orgId) {
      setErrorMsg('Link inválido. Verifique o e-mail de confirmação.');
      setStatus('error');
      return;
    }
    fetch(apiUrl(`/api/stripe/setup?token=${encodeURIComponent(token)}&orgId=${encodeURIComponent(orgId)}`))
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.error || 'Token inválido.');
        setEmail(data.email || '');
        setPlan(data.plan || '');
        setStatus('ready');
      })
      .catch((err) => {
        setErrorMsg(err.message);
        setStatus('error');
      });
  }, [token, orgId]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { setErrorMsg('Informe seu nome.'); return; }
    if (password.length < 6) { setErrorMsg('A senha deve ter ao menos 6 caracteres.'); return; }
    setErrorMsg('');
    setStatus('creating');
    try {
      // 1. Create Firebase Auth user
      const { user: firebaseUser } = await createUserWithEmailAndPassword(auth, email, password);

      // 2. Write user doc in Firestore
      await setDoc(doc(db, 'users', firebaseUser.uid), {
        uid: firebaseUser.uid,
        email,
        displayName: name.trim(),
        role: 'admin',
        organizationId: orgId,
        createdAt: new Date(),
      });

      // 3. Clear setupToken from org (mark account as fully created)
      await fetch(apiUrl('/api/stripe/setup/complete'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, orgId }),
      });

      // 4. Send welcome email (fire-and-forget — não bloqueia o fluxo)
      fetch(apiUrl('/api/email/welcome'), {
        method: 'POST',
        headers: await authHeaders(),
        body: JSON.stringify({ name: name.trim(), email, plan }),
      }).catch(() => {}); // falha silenciosa

      setStatus('done');
      setTimeout(() => navigate('/'), 2000);
    } catch (err: any) {
      if (err.code === 'auth/email-already-in-use') {
        setErrorMsg('Este e-mail já tem uma conta. Acesse com sua senha em /login.');
      } else if (err.code === 'auth/weak-password') {
        setErrorMsg('A senha deve ter ao menos 6 caracteres.');
      } else {
        setErrorMsg(err.message || 'Erro ao criar conta. Tente novamente.');
      }
      setStatus('ready');
    }
  };

  const planLabel: Record<string, string> = {
    essencial: 'Básico',
    pro: 'Profissional',
    enterprise: 'Consórcio',
  };

  return (
    <div className="min-h-screen flex" style={{ background: '#F5F7FA' }}>
      {/* Left branding */}
      <div
        className="hidden lg:flex lg:w-[48%] flex-col items-center justify-center p-14 relative overflow-hidden"
        style={{ background: '#1B2A4A' }}
      >
        <div className="z-10 flex flex-col items-center text-center max-w-sm">
          <EduPlateLogo className="w-72" />
          <div className="mt-8 w-10 h-0.5 rounded-full" style={{ background: '#4CAF50' }} />
          <p className="mt-5 text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.45)' }}>
            Você está a um passo de começar a usar<br />
            o EduPlate Menu no seu município.
          </p>
          {plan && (
            <div
              className="mt-8 w-full rounded-2xl px-6 py-5 text-center"
              style={{ background: 'rgba(76,175,80,0.12)', border: '1px solid rgba(76,175,80,0.35)' }}
            >
              <p style={{ fontSize: 13, fontWeight: 600, color: 'rgba(76,175,80,0.7)', marginBottom: 4 }}>
                Plano contratado
              </p>
              <p style={{ fontSize: 26, fontWeight: 800, color: '#4CAF50', margin: 0 }}>
                {planLabel[plan] || plan}
              </p>
            </div>
          )}
        </div>
        <div
          className="absolute bottom-8 z-10 flex items-center gap-2 rounded-full px-4 py-2"
          style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)' }}
        >
          <div className="w-1.5 h-1.5 rounded-full bg-green-400" />
          <span className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>eduplate.com.br</span>
        </div>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex flex-col items-center justify-center bg-white p-6">
        <div className="flex lg:hidden mb-8">
          <EduPlateLogo className="w-52" />
        </div>

        <div className="w-full max-w-sm">
          {/* Loading */}
          {status === 'loading' && (
            <div className="text-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-green-600 mx-auto mb-3" />
              <p className="text-gray-500 text-sm">Verificando pagamento…</p>
            </div>
          )}

          {/* Error */}
          {status === 'error' && (
            <div className="text-center py-8">
              <AlertCircle className="w-10 h-10 text-red-400 mx-auto mb-3" />
              <h2 className="text-lg font-bold text-gray-800 mb-2">Link inválido</h2>
              <p className="text-gray-500 text-sm mb-6">{errorMsg}</p>
              <a href="/planos" className="text-sm font-medium underline" style={{ color: '#4CAF50' }}>
                ← Voltar aos planos
              </a>
            </div>
          )}

          {/* Done */}
          {status === 'done' && (
            <div className="text-center py-8">
              <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-3" />
              <h2 className="text-2xl font-bold text-gray-800 mb-2">Conta criada!</h2>
              <p className="text-gray-500 text-sm">Redirecionando para o painel…</p>
            </div>
          )}

          {/* Form */}
          {(status === 'ready' || status === 'creating') && (
            <>
              <div className="mb-6">
                {/* Payment confirmed badge */}
                <div
                  className="flex items-center gap-2 rounded-xl px-4 py-3 mb-6"
                  style={{ background: 'rgba(76,175,80,0.08)', border: '1px solid rgba(76,175,80,0.25)' }}
                >
                  <CheckCircle2 className="w-4 h-4 shrink-0" style={{ color: '#4CAF50' }} />
                  <span className="text-sm font-medium" style={{ color: '#2d7a30' }}>
                    Pagamento confirmado! Crie sua conta para acessar.
                  </span>
                </div>
                <h2 className="text-2xl font-bold" style={{ color: '#1B2A4A' }}>Criar sua conta</h2>
                <p className="text-gray-400 text-sm mt-1">
                  Conta vinculada a <strong className="text-gray-600">{email}</strong>
                </p>
              </div>

              {errorMsg && (
                <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 mb-4 text-sm">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              <form onSubmit={handleCreate} className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-1.5">Seu nome completo</label>
                  <div className="relative">
                    <User className="w-4 h-4 text-gray-300 absolute left-3 top-1/2 -translate-y-1/2" />
                    <Input
                      type="text"
                      placeholder="Ex: Maria Silva"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      disabled={status === 'creating'}
                      required
                      className="pl-9 border-gray-200"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-1.5">Crie uma senha</label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-gray-300 absolute left-3 top-1/2 -translate-y-1/2" />
                    <Input
                      type="password"
                      placeholder="Mínimo 6 caracteres"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      disabled={status === 'creating'}
                      required
                      minLength={6}
                      className="pl-9 border-gray-200"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={status === 'creating'}
                  className="w-full py-2.5 rounded-xl font-semibold text-white mt-2 flex items-center justify-center gap-2 transition-opacity"
                  style={{ background: '#4CAF50', opacity: status === 'creating' ? 0.7 : 1 }}
                >
                  {status === 'creating'
                    ? <><Loader2 className="w-4 h-4 animate-spin" />Criando conta…</>
                    : 'Entrar no EduPlate'}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
