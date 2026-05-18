import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useLocation, useSearch } from 'wouter';
import { Input } from '@/components/ui/input';
import { AlertCircle, CheckCircle2, Loader2, Lock, Mail } from 'lucide-react';
import EduPlateLogo from '@/components/EduPlateLogo';

export default function Login() {
  const { login, resetPassword, error } = useAuth();
  const [, setLocation] = useLocation();
  const search = useSearch();
  const redirectTo = new URLSearchParams(search).get('redirect') || '/';
  const [loading, setLoading] = useState(false);
  const [showReset, setShowReset] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetSent, setResetSent] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);

  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetEmail) return;
    setResetLoading(true);
    try {
      await resetPassword(resetEmail);
      setResetSent(true);
    } catch (_) {
      // error shown by AuthContext
    } finally {
      setResetLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      await login(loginEmail, loginPassword);
      setLocation(redirectTo);
    } catch (err) {
      console.error('Erro no login:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex" style={{ background: '#F5F7FA' }}>

      {/* ── Left branding panel ── */}
      <div
        className="hidden lg:flex lg:w-[48%] flex-col items-center justify-center p-14 relative overflow-hidden"
        style={{ background: '#1B2A4A' }}
      >
        {/* Subtle geometric background circles */}
        <div
          className="absolute"
          style={{
            width: 480,
            height: 480,
            borderRadius: '50%',
            border: '1px solid rgba(255,255,255,0.05)',
            top: -60,
            left: -80,
          }}
        />
        <div
          className="absolute"
          style={{
            width: 320,
            height: 320,
            borderRadius: '50%',
            border: '1px solid rgba(255,255,255,0.06)',
            bottom: -40,
            right: -60,
          }}
        />

        <div className="z-10 flex flex-col items-center text-center max-w-sm">
          {/* Logo */}
          <EduPlateLogo className="w-72" />

          <div className="mt-8 w-10 h-0.5 rounded-full" style={{ background: '#4CAF50' }} />

          <p className="mt-5 text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.45)' }}>
            Plataforma completa para gestão do<br />
            Programa Nacional de Alimentação Escolar
          </p>

          {/* Free trial — destaque principal */}
          <div
            className="mt-8 w-full rounded-2xl px-6 py-5 text-center"
            style={{ background: 'rgba(76,175,80,0.12)', border: '1px solid rgba(76,175,80,0.35)' }}
          >
            <p style={{ fontSize: 30, fontWeight: 800, color: '#4CAF50', margin: 0, lineHeight: 1.1 }}>
              3 meses grátis
            </p>
            <p className="mt-1 text-sm" style={{ color: 'rgba(76,175,80,0.7)', margin: '6px 0 0', fontWeight: 600 }}>
              Acesso completo · Cartão necessário
            </p>
          </div>

          {/* Feature pills */}
          <div className="mt-6 flex flex-wrap gap-2 justify-center">
            {['Cardápios', 'Fiscalização', 'SIGPC', 'Treinamentos', 'Certificados'].map((f) => (
              <span
                key={f}
                className="text-xs px-3 py-1 rounded-full"
                style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.45)', border: '1px solid rgba(255,255,255,0.1)' }}
              >
                {f}
              </span>
            ))}
          </div>
        </div>

        {/* Bottom badge */}
        <div
          className="absolute bottom-8 z-10 flex items-center gap-2 rounded-full px-4 py-2"
          style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)' }}
        >
          <div className="w-1.5 h-1.5 rounded-full bg-green-400" />
          <span className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>eduplate.com.br</span>
        </div>
      </div>

      {/* ── Right login panel ── */}
      <div className="flex-1 flex flex-col items-center justify-center bg-white p-6">

        {/* Mobile logo */}
        <div className="flex lg:hidden mb-8">
          <EduPlateLogo className="w-52" />
        </div>

        <div className="w-full max-w-sm">
          <div className="mb-8">
            <h2 className="text-2xl font-bold" style={{ color: '#1B2A4A' }}>Bem-vindo(a)</h2>
            <p className="text-gray-400 text-sm mt-1">Acesse com suas credenciais</p>
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 mb-4 text-sm">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* ── Login form ── */}
          {!showReset && (
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1.5">Email</label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-gray-300 absolute left-3 top-1/2 -translate-y-1/2" />
                  <Input
                    type="email"
                    placeholder="seu@email.com"
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    disabled={loading}
                    required
                    className="pl-9 border-gray-200"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-sm font-medium text-gray-700">Senha</label>
                  <button
                    type="button"
                    onClick={() => setLocation('/esqueci-senha')}
                    className="text-xs font-medium transition-colors"
                    style={{ color: '#4CAF50' }}
                  >
                    Esqueci minha senha
                  </button>
                </div>
                <div className="relative">
                  <Lock className="w-4 h-4 text-gray-300 absolute left-3 top-1/2 -translate-y-1/2" />
                  <Input
                    type="password"
                    placeholder="••••••••"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    disabled={loading}
                    required
                    className="pl-9 border-gray-200"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 rounded-xl font-semibold text-white mt-2 flex items-center justify-center gap-2 transition-opacity"
                style={{ background: '#4CAF50', opacity: loading ? 0.7 : 1 }}
              >
                {loading ? <><Loader2 className="w-4 h-4 animate-spin" />Entrando…</> : 'Entrar'}
              </button>
            </form>
          )}

          {/* ── Recuperar senha ── */}
          {showReset && (
            <div className="space-y-4">
              <div>
                <button
                  type="button"
                  onClick={() => { setShowReset(false); setResetSent(false); }}
                  className="text-xs text-gray-400 hover:text-gray-600 mb-3 flex items-center gap-1"
                >
                  ← Voltar ao login
                </button>
                <h3 className="font-semibold text-gray-800">Recuperar senha</h3>
                <p className="text-xs text-gray-400 mt-1">Digite seu e-mail e enviaremos um link para criar uma nova senha.</p>
              </div>

              {resetSent ? (
                <div className="flex items-start gap-3 bg-green-50 border border-green-200 rounded-xl px-4 py-3">
                  <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-green-800">E-mail enviado!</p>
                    <p className="text-xs text-green-700 mt-0.5">Verifique sua caixa de entrada (e o spam) para redefinir a senha.</p>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleReset} className="space-y-3">
                  <div className="relative">
                    <Mail className="w-4 h-4 text-gray-300 absolute left-3 top-1/2 -translate-y-1/2" />
                    <Input
                      type="email"
                      placeholder="seu@email.com"
                      value={resetEmail}
                      onChange={(e) => setResetEmail(e.target.value)}
                      disabled={resetLoading}
                      required
                      className="pl-9 border-gray-200"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={resetLoading}
                    className="w-full py-2.5 rounded-xl font-semibold text-white flex items-center justify-center gap-2 transition-opacity"
                    style={{ background: '#4CAF50', opacity: resetLoading ? 0.7 : 1 }}
                  >
                    {resetLoading ? <><Loader2 className="w-4 h-4 animate-spin" />Enviando…</> : 'Enviar link de recuperação'}
                  </button>
                </form>
              )}
            </div>
          )}

          {/* Ainda não tem conta */}
          <div className="mt-6 pt-5 border-t border-gray-100 text-center text-sm text-gray-500">
            Ainda não tem conta?{' '}
            <button
              onClick={() => setLocation('/registro')}
              className="font-semibold hover:underline"
              style={{ color: '#4CAF50' }}
            >
              Criar conta grátis →
            </button>
          </div>

          <p className="text-center text-xs text-gray-300 mt-4">
            EduPlate Menu · {new Date().getFullYear()}
          </p>
          <p className="text-center text-xs text-gray-300 mt-1">
            <a href="/privacidade" className="underline hover:text-gray-400 transition-colors">Privacidade</a>
            {' · '}
            <a href="/termos" className="underline hover:text-gray-400 transition-colors">Termos de Uso</a>
          </p>
        </div>
      </div>
    </div>
  );
}
