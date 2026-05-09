import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useLocation } from 'wouter';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertCircle, Loader2, Lock, Mail, User, KeyRound, HelpCircle } from 'lucide-react';
import EduPlateLogo from '@/components/EduPlateLogo';

export default function Login() {
  const { login, register, error } = useAuth();
  const [, setLocation] = useLocation();
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'login' | 'register'>('login');

  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [registerEmail, setRegisterEmail] = useState('');
  const [registerPassword, setRegisterPassword] = useState('');
  const [registerName, setRegisterName] = useState('');
  const [registerRole, setRegisterRole] = useState<'admin' | 'nutritionist' | 'viewer'>('nutritionist');
  const [inviteCode, setInviteCode] = useState('');
  const [joinMode, setJoinMode] = useState<'new' | 'join'>('new');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      await login(loginEmail, loginPassword);
      setLocation('/');
    } catch (err) {
      console.error('Erro no login:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      await register(
        registerEmail,
        registerPassword,
        registerName,
        registerRole,
        joinMode === 'join' ? inviteCode : undefined
      );
      setLocation('/');
    } catch (err) {
      console.error('Erro no registro:', err);
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
              14 dias grátis
            </p>
            <p className="mt-1 text-sm" style={{ color: 'rgba(76,175,80,0.7)', margin: '6px 0 0', fontWeight: 600 }}>
              Acesso completo · Sem cartão de crédito
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

          {/* Tabs */}
          <div className="flex bg-gray-100 rounded-xl p-1 mb-6">
            {(['login', 'register'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className="flex-1 py-2 text-sm font-semibold rounded-lg transition-all duration-200"
                style={
                  activeTab === tab
                    ? { background: 'white', color: '#1B2A4A', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }
                    : { color: '#9ca3af' }
                }
              >
                {tab === 'login' ? 'Entrar' : 'Registrar'}
              </button>
            ))}
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 mb-4 text-sm">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* ── Login form ── */}
          {activeTab === 'login' && (
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
                <label className="text-sm font-medium text-gray-700 block mb-1.5">Senha</label>
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
                {loading
                  ? <><Loader2 className="w-4 h-4 animate-spin" />Entrando…</>
                  : 'Entrar'}
              </button>
            </form>
          )}

          {/* ── Register form ── */}
          {activeTab === 'register' && (
            <form onSubmit={handleRegister} className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1.5">Nome Completo</label>
                <div className="relative">
                  <User className="w-4 h-4 text-gray-300 absolute left-3 top-1/2 -translate-y-1/2" />
                  <Input
                    type="text"
                    placeholder="Seu nome"
                    value={registerName}
                    onChange={(e) => setRegisterName(e.target.value)}
                    disabled={loading}
                    required
                    className="pl-9 border-gray-200"
                  />
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1.5">Email</label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-gray-300 absolute left-3 top-1/2 -translate-y-1/2" />
                  <Input
                    type="email"
                    placeholder="seu@email.com"
                    value={registerEmail}
                    onChange={(e) => setRegisterEmail(e.target.value)}
                    disabled={loading}
                    required
                    className="pl-9 border-gray-200"
                  />
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1.5">Senha</label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-gray-300 absolute left-3 top-1/2 -translate-y-1/2" />
                  <Input
                    type="password"
                    placeholder="Crie uma senha"
                    value={registerPassword}
                    onChange={(e) => setRegisterPassword(e.target.value)}
                    disabled={loading}
                    required
                    className="pl-9 border-gray-200"
                  />
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1.5">Função</label>
                <Select value={registerRole} onValueChange={(v: any) => setRegisterRole(v)}>
                  <SelectTrigger className="border-gray-200">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Nutricionista RT (Admin)</SelectItem>
                    <SelectItem value="nutritionist">Agente Escolar</SelectItem>
                    <SelectItem value="viewer">Visualizador</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Org mode toggle */}
              <div className="rounded-xl border border-gray-100 bg-gray-50 p-3">
                <p className="text-xs font-semibold text-gray-400 mb-2 uppercase tracking-wide">Organização</p>
                <div className="flex gap-2 mb-2">
                  <button
                    type="button"
                    onClick={() => setJoinMode('new')}
                    className="flex-1 py-1.5 text-xs rounded-lg font-medium transition-all"
                    style={
                      joinMode === 'new'
                        ? { background: '#4CAF50', color: 'white' }
                        : { background: 'white', color: '#6b7280', border: '1px solid #e5e7eb' }
                    }
                  >
                    Nova organização
                  </button>
                  <button
                    type="button"
                    onClick={() => setJoinMode('join')}
                    className="flex-1 py-1.5 text-xs rounded-lg font-medium transition-all"
                    style={
                      joinMode === 'join'
                        ? { background: '#4CAF50', color: 'white' }
                        : { background: 'white', color: '#6b7280', border: '1px solid #e5e7eb' }
                    }
                  >
                    Entrar com convite
                  </button>
                </div>
                {joinMode === 'new' && (
                  <p className="text-xs text-gray-400 flex items-center gap-1">
                    <HelpCircle className="w-3 h-3" />
                    Será criada uma nova organização. Convide outros usuários depois.
                  </p>
                )}
                {joinMode === 'join' && (
                  <div className="mt-1">
                    <div className="relative">
                      <KeyRound className="w-4 h-4 text-gray-300 absolute left-3 top-1/2 -translate-y-1/2" />
                      <Input
                        type="text"
                        placeholder="Código de convite (ex: AB1C2D)"
                        value={inviteCode}
                        onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                        disabled={loading}
                        maxLength={6}
                        className="pl-9 border-gray-200 text-sm font-mono tracking-widest uppercase"
                      />
                    </div>
                  </div>
                )}
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 rounded-xl font-semibold text-white mt-2 flex items-center justify-center gap-2 transition-opacity"
                style={{ background: '#4CAF50', opacity: loading ? 0.7 : 1 }}
              >
                {loading
                  ? <><Loader2 className="w-4 h-4 animate-spin" />Registrando…</>
                  : 'Criar Conta'}
              </button>
            </form>
          )}

          {/* Ver planos link */}
          <div className="mt-6 text-center">
            <a
              href="/planos"
              className="inline-flex items-center gap-1.5 text-sm font-medium transition-colors"
              style={{ color: '#4CAF50' }}
            >
              Ver planos e preços →
            </a>
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
