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
    <div className="min-h-screen flex items-center justify-center p-6" style={{ background: '#F5F7FA' }}>
      <div className="w-full max-w-md">

        {/* Logo */}
        <div className="flex justify-center mb-8">
          <EduPlateLogo className="w-48" />
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">

          {sent ? (
            /* ── Success state ── */
            <div className="text-center">
              <div className="flex justify-center mb-4">
                <div className="w-16 h-16 rounded-full flex items-center justify-center" style={{ background: 'rgba(76,175,80,0.1)' }}>
                  <CheckCircle2 className="w-8 h-8" style={{ color: '#4CAF50' }} />
                </div>
              </div>
              <h1 className="text-xl font-bold text-gray-900">E-mail enviado!</h1>
              <p className="text-sm text-gray-500 mt-2 leading-relaxed">
                Enviamos um link de recuperação para<br />
                <strong className="text-gray-700">{email}</strong>
              </p>
              <p className="text-xs text-gray-400 mt-3">
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
              <div className="mb-6">
                <h1 className="text-xl font-bold text-gray-900">Esqueceu sua senha?</h1>
                <p className="text-sm text-gray-500 mt-1">
                  Informe seu e-mail e enviaremos um link para você criar uma nova senha.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1.5">
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
          className="mt-5 flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mx-auto transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Voltar ao login
        </button>

      </div>
    </div>
  );
}
