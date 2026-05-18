/**
 * /esqueci-senha — Forgot Password page
 * Uses Firebase's sendPasswordResetEmail via AuthContext.resetPassword()
 */
import React, { useState } from 'react';
import { useLocation } from 'wouter';
import { Loader2, Mail, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/contexts/AuthContext';
import EduPlateLogo from '@/components/EduPlateLogo';

export default function ForgotPassword() {
  const { resetPassword } = useAuth();
  const [, navigate] = useLocation();

  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setErrorMsg('');
    setLoading(true);
    try {
      await resetPassword(email.trim());
      setSent(true);
    } catch (err: any) {
      if (err.code === 'auth/user-not-found' || err.code === 'auth/invalid-email') {
        setErrorMsg('E-mail não encontrado. Verifique e tente novamente.');
      } else {
        setErrorMsg('Erro ao enviar. Tente novamente em instantes.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6" style={{ background: '#F5F7FA', colorScheme: 'light' }}>
      <div className="w-full max-w-md">

        {/* Logo */}
        <div className="flex justify-center mb-8">
          <EduPlateLogo className="w-48" />
        </div>

        <div style={{ background: '#ffffff', borderRadius: 20, boxShadow: '0 2px 12px rgba(0,0,0,0.08)', border: '1px solid #E5E7EB', padding: '2rem' }}>

          {sent ? (
            /* ── Success state ── */
            <div className="text-center">
              <div className="flex justify-center mb-4">
                <div className="w-16 h-16 rounded-full flex items-center justify-center" style={{ background: 'rgba(76,175,80,0.1)' }}>
                  <CheckCircle2 className="w-8 h-8" style={{ color: '#4CAF50' }} />
                </div>
              </div>
              <h1 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#111827', margin: 0 }}>E-mail enviado!</h1>
              <p style={{ fontSize: '0.875rem', color: '#6B7280', marginTop: 8, lineHeight: 1.6 }}>
                Enviamos um link de recuperação para<br />
                <strong className="text-gray-700">{email}</strong>
              </p>
              <p style={{ fontSize: '0.75rem', color: '#9CA3AF', marginTop: 12 }}>
                Não recebeu? Verifique a pasta de spam ou aguarde alguns minutos.
              </p>
              <button
                onClick={() => navigate('/login')}
                className="mt-6 w-full h-11 rounded-xl text-sm font-semibold text-white transition-colors"
                style={{ background: '#4CAF50' }}
              >
                Voltar ao login
              </button>
            </div>
          ) : (
            /* ── Form state ── */
            <>
              <div style={{ marginBottom: 24 }}>
                <h1 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#111827', margin: 0 }}>Esqueceu sua senha?</h1>
                <p style={{ fontSize: '0.875rem', color: '#6B7280', marginTop: 4 }}>
                  Informe seu e-mail e enviaremos um link para você criar uma nova senha.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#374151', marginBottom: 6 }}>
                    E-mail da conta
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <Input
                      type="email"
                      placeholder="voce@prefeitura.gov.br"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      autoFocus
                      className="h-11 pl-9"
                    />
                  </div>
                </div>

                {errorMsg && (
                  <p className="text-sm text-red-600 font-medium">{errorMsg}</p>
                )}

                <button
                  type="submit"
                  disabled={loading || !email.trim()}
                  className="w-full h-11 flex items-center justify-center gap-2 rounded-xl text-white text-sm font-semibold transition-colors disabled:opacity-50"
                  style={{ background: '#4CAF50' }}
                >
                  {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                  {loading ? 'Enviando…' : 'Enviar link de recuperação'}
                </button>
              </form>
            </>
          )}

        </div>

        {/* Back to login */}
        <button
          onClick={() => navigate('/login')}
          style={{ marginTop: 20, display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.875rem', color: '#6B7280', background: 'none', border: 'none', cursor: 'pointer', marginLeft: 'auto', marginRight: 'auto' }}
        >
          <ArrowLeft className="w-4 h-4" />
          Voltar ao login
        </button>

      </div>
    </div>
  );
}
