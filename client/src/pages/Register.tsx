/**
 * /registro — Trial registration page
 * Flow: collect name/email/phone/password → create Firebase account + org
 *       → direct dashboard access (30-day trial, no card required)
 */
import React, { useState } from 'react';
import { useLocation } from 'wouter';
import { Eye, EyeOff, Loader2, CheckCircle2, Phone } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/contexts/AuthContext';
import EduPlateLogo from '@/components/EduPlateLogo';
import { apiUrl } from '@/lib/apiUrl';

// Format phone as (XX) XXXXX-XXXX
function formatPhone(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 2) return digits.length ? `(${digits}` : '';
  if (digits.length <= 7) return `(${digits.slice(0,2)}) ${digits.slice(2)}`;
  return `(${digits.slice(0,2)}) ${digits.slice(2,7)}-${digits.slice(7)}`;
}

function validatePhone(phone: string): boolean {
  const digits = phone.replace(/\D/g, '');
  return digits.length === 11 && /^[1-9]{2}[9][0-9]{8}$/.test(digits);
}

export default function Register() {
  const { register, user, error: authError } = useAuth();
  const [, navigate] = useLocation();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { setErrorMsg('Informe seu nome.'); return; }
    if (!validatePhone(phone)) { setErrorMsg('Informe um celular válido com DDD. Ex: (11) 99999-8888'); return; }
    if (password.length < 6) { setErrorMsg('A senha deve ter ao menos 6 caracteres.'); return; }
    setErrorMsg('');
    setLoading(true);
    try {
      const phoneDigits = phone.replace(/\D/g, '');

      // Create Firebase account + org (trial status set in Firestore)
      // Phone uniqueness check runs inside register() after auth is established
      await register(email.trim(), password, name.trim(), 'admin', undefined, phoneDigits);

      // Send welcome email (fire-and-forget)
      fetch(apiUrl('/api/email/welcome'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), email: email.trim() }),
      }).catch(() => {});

      // Vai direto para o dashboard — trial de 30 dias sem cartão
      navigate('/');

    } catch (err: any) {
      // authError is already set by AuthContext for phone-already-in-use and other known errors
      setErrorMsg(authError || err.message || 'Erro ao criar conta. Tente novamente.');
      setLoading(false);
    }
  };


  const BENEFITS = [
    '30 dias grátis — sem cartão necessário',
    'Nenhuma cobrança surpresa durante o trial',
    'Cardápios, fichas técnicas e dietas especiais',
    'Fiscalização de escolas e relatórios SIGPC',
    'Acesso a todos os módulos durante o trial',
    'Cartão solicitado apenas ao final do trial',
  ];

  return (
    <div className="min-h-screen flex" style={{ background: '#F5F7FA' }}>

      {/* ── Left branding ─────────────────────────────────────────── */}
      <div
        className="hidden lg:flex lg:w-[46%] flex-col items-center justify-center p-14 relative overflow-hidden"
        style={{ background: '#1B2A4A' }}
      >
        {/* Decorative blobs */}
        <div style={{ position:'absolute', top:-80, right:-80, width:320, height:320, borderRadius:'50%', background:'rgba(76,175,80,0.08)' }} />
        <div style={{ position:'absolute', bottom:-60, left:-60, width:240, height:240, borderRadius:'50%', background:'rgba(76,175,80,0.06)' }} />

        <div className="z-10 flex flex-col items-center text-center max-w-sm">
          <EduPlateLogo className="w-64" />

          <div className="mt-10 w-full text-left space-y-3">
            {BENEFITS.map((b) => (
              <div key={b} className="flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" style={{ color: '#4CAF50' }} />
                <span className="text-sm" style={{ color: 'rgba(255,255,255,0.75)' }}>{b}</span>
              </div>
            ))}
          </div>

          <div className="mt-10 w-full rounded-2xl p-4" style={{ background:'rgba(76,175,80,0.1)', border:'1px solid rgba(76,175,80,0.2)' }}>
            <p className="text-xs text-center" style={{ color:'rgba(255,255,255,0.5)' }}>
              Após o 1º mês, a partir de
            </p>
            <p className="text-2xl font-extrabold text-center mt-1" style={{ color:'#4CAF50' }}>
              R$ 49,90<span className="text-sm font-normal" style={{ color:'rgba(255,255,255,0.5)' }}>/mês</span>
            </p>
            <p className="text-xs text-center mt-1" style={{ color:'rgba(255,255,255,0.35)' }}>
              Cancele no trial e não paga nada
            </p>
          </div>
        </div>
      </div>

      {/* ── Right form ────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col items-center justify-center p-6">
        {/* Mobile logo */}
        <div className="lg:hidden mb-8">
          <EduPlateLogo className="w-48" />
        </div>

        <div className="w-full max-w-md">
          <div className="mb-2 inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold"
            style={{ background:'rgba(76,175,80,0.1)', color:'#2E7D32', border:'1px solid rgba(76,175,80,0.3)' }}>
            30 dias grátis · Sem cartão
          </div>
          <h1 className="text-2xl font-extrabold text-gray-900 mt-2">Criar conta grátis</h1>
          <p className="text-sm text-gray-500 mt-1">
            Crie sua conta em segundos e acesse tudo por <strong className="text-gray-700">30 dias grátis</strong>.<br/>
            <strong className="text-gray-600">Sem cartão. Sem compromisso.</strong>
          </p>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">Nome completo</label>
              <Input
                type="text"
                placeholder="Sua Nutricionista"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                autoFocus
                className="h-11"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">E-mail profissional</label>
              <Input
                type="email"
                placeholder="voce@prefeitura.gov.br"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="h-11"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">Celular com DDD <span style={{ color: '#EF4444' }}>*</span></label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  type="tel"
                  placeholder="(11) 99999-8888"
                  value={phone}
                  onChange={(e) => setPhone(formatPhone(e.target.value))}
                  required
                  className="h-11 pl-9"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">Senha</label>
              <div className="relative">
                <Input
                  type={showPass ? 'text' : 'password'}
                  placeholder="Mínimo 6 caracteres"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  className="h-11 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPass((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {(errorMsg || authError) && (
              <p className="text-sm text-red-600 font-medium">{errorMsg || authError}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full h-11 flex items-center justify-center gap-2 rounded-xl text-white text-sm font-semibold transition-colors disabled:opacity-60"
              style={{ background: '#4CAF50' }}
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              {loading ? 'Criando conta…' : 'Criar conta grátis — sem cartão →'}
            </button>

            <p className="text-xs text-center text-gray-400 mt-2">
              Ao criar sua conta, você concorda com nossa{' '}
              <a href="/privacidade" className="underline text-gray-500">Política de Privacidade</a>.
            </p>
          </form>

          <div className="mt-6 pt-5 border-t border-gray-100 text-center text-sm text-gray-500">
            Já tem conta?{' '}
            <button onClick={() => navigate('/login')} className="font-semibold text-green-700 hover:underline">
              Entrar
            </button>
            {' · '}
            <button onClick={() => navigate('/planos')} className="font-semibold text-gray-700 hover:underline">
              Ver planos
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
