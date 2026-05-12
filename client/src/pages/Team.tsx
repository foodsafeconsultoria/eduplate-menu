/**
 * Team.tsx — Página de Equipe / Convite de Usuários
 * Mostra o código de convite da organização e lista os membros ativos.
 */
import { useEffect, useState } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import {
  Copy, Users, KeyRound, CheckCircle2, Mail,
  ShieldCheck, Eye, UserCircle2, Crown,
} from 'lucide-react';

interface Member {
  uid: string;
  displayName: string;
  email: string;
  role: string;
  createdAt: any;
}

const ROLE_LABELS: Record<string, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
  admin:         { label: 'Nutricionista RT',  color: '#1B2A4A', bg: 'rgba(27,42,74,0.08)',   icon: <Crown size={12} /> },
  nutricionista: { label: 'Nutricionista RT',  color: '#1B2A4A', bg: 'rgba(27,42,74,0.08)',   icon: <Crown size={12} /> },
  nutritionist:  { label: 'Nutricionista RT',  color: '#1B2A4A', bg: 'rgba(27,42,74,0.08)',   icon: <Crown size={12} /> },
  fiscal:        { label: 'Agente Escolar',    color: '#1A73E8', bg: 'rgba(26,115,232,0.10)', icon: <ShieldCheck size={12} /> },
  diretor:       { label: 'Diretor',           color: '#FF9800', bg: 'rgba(255,152,0,0.10)',  icon: <UserCircle2 size={12} /> },
  viewer:        { label: 'Visualizador',      color: '#64748B', bg: 'rgba(100,116,139,0.10)',icon: <Eye size={12} /> },
};

function roleMeta(role: string) {
  return ROLE_LABELS[role] ?? { label: role, color: '#64748B', bg: 'rgba(100,116,139,0.10)', icon: <UserCircle2 size={12} /> };
}

function avatar(name: string) {
  return name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
}

export default function Team() {
  const { user } = useAuth();
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  const orgId = user?.organizationId;

  useEffect(() => {
    if (!orgId) return;

    const load = async () => {
      try {
        // Fetch org invite code
        const orgSnap = await getDoc(doc(db, 'organizations', orgId));
        if (orgSnap.exists()) {
          setInviteCode(orgSnap.data().inviteCode || null);
        }

        // Fetch all members of this org
        const q = query(collection(db, 'users'), where('organizationId', '==', orgId));
        const snap = await getDocs(q);
        const list: Member[] = snap.docs.map(d => ({ uid: d.id, ...d.data() } as Member));
        // Sort: admins first, then by name
        list.sort((a, b) => {
          const aAdmin = ['admin','nutricionista','nutritionist'].includes(a.role);
          const bAdmin = ['admin','nutricionista','nutritionist'].includes(b.role);
          if (aAdmin && !bAdmin) return -1;
          if (!aAdmin && bAdmin) return 1;
          return (a.displayName || '').localeCompare(b.displayName || '');
        });
        setMembers(list);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [orgId]);

  const handleCopy = () => {
    if (!inviteCode) return;
    navigator.clipboard.writeText(inviteCode).then(() => {
      setCopied(true);
      toast.success('Código copiado!');
      setTimeout(() => setCopied(false), 2500);
    });
  };

  const handleCopyLink = () => {
    const link = `${window.location.origin}/login?convite=${inviteCode}`;
    navigator.clipboard.writeText(link).then(() => {
      toast.success('Link copiado! Cole no WhatsApp ou e-mail.');
    });
  };

  const handleShareWhatsApp = () => {
    const link = `${window.location.origin}/login?convite=${inviteCode}`;
    const msg = encodeURIComponent(
      `Olá! Você foi convidado(a) para acessar o EduPlate Menu.\n\nAcesse o link abaixo e use o código *${inviteCode}* para entrar na nossa organização:\n${link}`
    );
    window.open(`https://wa.me/?text=${msg}`, '_blank');
  };

  if (loading) {
    return (
      <div className="flex-1 p-8 bg-gray-50 min-h-screen flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-green-600 mx-auto" />
          <p className="text-gray-400 text-sm">Carregando equipe…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 p-4 md:p-8 bg-gray-50 min-h-screen">
      <div className="max-w-3xl mx-auto space-y-6">

        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Equipe</h1>
          <p className="text-gray-500 mt-1">
            Gerencie quem tem acesso ao EduPlate Menu da sua organização.
          </p>
        </div>

        {/* ── Invite code card ─────────────────────────────────────── */}
        {inviteCode && (
          <div
            style={{
              background: 'linear-gradient(135deg, #1B2A4A 0%, #243A66 100%)',
              borderRadius: 20,
              padding: '28px 32px',
              color: '#fff',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <KeyRound size={18} color="#4CAF50" />
              <span style={{ fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: 1 }}>
                Código de Convite da Organização
              </span>
            </div>

            <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.55)', marginBottom: 20, maxWidth: 480 }}>
              Compartilhe este código com quem você quiser convidar. A pessoa entra no site, clica em
              <strong style={{ color: 'rgba(255,255,255,0.8)' }}> "Registrar → Entrar com convite"</strong> e digita o código abaixo.
            </p>

            {/* Big code */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
              <div
                style={{
                  background: 'rgba(255,255,255,0.08)',
                  border: '2px solid rgba(76,175,80,0.4)',
                  borderRadius: 14,
                  padding: '14px 28px',
                  fontFamily: 'monospace',
                  fontSize: 36,
                  fontWeight: 800,
                  letterSpacing: 10,
                  color: '#fff',
                }}
              >
                {inviteCode}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <button
                  onClick={handleCopy}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    background: copied ? 'rgba(76,175,80,0.25)' : 'rgba(255,255,255,0.1)',
                    border: `1px solid ${copied ? 'rgba(76,175,80,0.5)' : 'rgba(255,255,255,0.15)'}`,
                    borderRadius: 10, padding: '9px 16px',
                    fontSize: 13, fontWeight: 700, color: '#fff', cursor: 'pointer',
                    transition: 'all 0.2s',
                  }}
                >
                  {copied ? <CheckCircle2 size={14} color="#4CAF50" /> : <Copy size={14} />}
                  {copied ? 'Copiado!' : 'Copiar código'}
                </button>

                <button
                  onClick={handleCopyLink}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    background: 'rgba(255,255,255,0.07)',
                    border: '1px solid rgba(255,255,255,0.12)',
                    borderRadius: 10, padding: '9px 16px',
                    fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.7)', cursor: 'pointer',
                  }}
                >
                  <Mail size={14} />
                  Copiar link de convite
                </button>

                <button
                  onClick={handleShareWhatsApp}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    background: 'rgba(37,211,102,0.15)',
                    border: '1px solid rgba(37,211,102,0.3)',
                    borderRadius: 10, padding: '9px 16px',
                    fontSize: 13, fontWeight: 700, color: '#25d366', cursor: 'pointer',
                  }}
                >
                  {/* WhatsApp icon */}
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
                    <path d="M12 0C5.373 0 0 5.373 0 12c0 2.123.554 4.11 1.523 5.835L.057 23.75l6.064-1.432A11.96 11.96 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818a9.818 9.818 0 01-5.008-1.374l-.36-.213-3.6.851.898-3.499-.233-.373A9.818 9.818 0 0112 2.182c5.42 0 9.818 4.399 9.818 9.818 0 5.42-4.398 9.818-9.818 9.818z"/>
                  </svg>
                  Enviar pelo WhatsApp
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Como funciona ─────────────────────────────────────────── */}
        <div
          style={{
            background: '#fff',
            border: '1px solid #E6EBF2',
            borderRadius: 16,
            padding: '20px 24px',
          }}
        >
          <p style={{ fontSize: 13, fontWeight: 700, color: '#1B2A4A', marginBottom: 14 }}>
            Como convidar alguém
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[
              { n: '1', t: 'Copie o código ou link acima' },
              { n: '2', t: 'Envie para a pessoa por WhatsApp, e-mail ou mensagem' },
              { n: '3', t: 'Ela acessa eduplate.com.br, clica em "Registrar" e depois "Entrar com convite"' },
              { n: '4', t: 'Cola o código e cria a própria senha — pronto, ela já entra na sua organização' },
            ].map(s => (
              <div key={s.n} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{
                  width: 24, height: 24, borderRadius: 8, background: '#1B2A4A',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 11, fontWeight: 800, color: '#fff', flexShrink: 0,
                }}>
                  {s.n}
                </div>
                <span style={{ fontSize: 13, color: '#64748B' }}>{s.t}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── Members list ─────────────────────────────────────────── */}
        <div
          style={{
            background: '#fff',
            border: '1px solid #E6EBF2',
            borderRadius: 16,
            overflow: 'hidden',
          }}
        >
          <div style={{ padding: '18px 24px', borderBottom: '1px solid #E6EBF2', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Users size={16} color="#1B2A4A" />
            <span style={{ fontSize: 15, fontWeight: 700, color: '#1B2A4A' }}>
              Membros da organização
            </span>
            <span style={{
              marginLeft: 8, background: '#F1F5F9', borderRadius: 99,
              padding: '2px 10px', fontSize: 12, fontWeight: 700, color: '#64748B',
            }}>
              {members.length}
            </span>
          </div>

          {members.length === 0 ? (
            <div style={{ padding: '40px 24px', textAlign: 'center', color: '#94A3B8', fontSize: 14 }}>
              Nenhum membro encontrado.
            </div>
          ) : (
            <div>
              {members.map((m, i) => {
                const meta = roleMeta(m.role);
                const isMe = m.uid === user?.uid;
                return (
                  <div
                    key={m.uid}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 14,
                      padding: '14px 24px',
                      borderBottom: i < members.length - 1 ? '1px solid #F1F5F9' : 'none',
                      background: isMe ? 'rgba(76,175,80,0.03)' : '#fff',
                    }}
                  >
                    {/* Avatar */}
                    <div style={{
                      width: 40, height: 40, borderRadius: 12, flexShrink: 0,
                      background: 'linear-gradient(135deg, #1B2A4A, #243A66)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 14, fontWeight: 800, color: '#fff',
                    }}>
                      {avatar(m.displayName || m.email)}
                    </div>

                    {/* Info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 14, fontWeight: 700, color: '#1B2A4A' }}>
                          {m.displayName || '—'}
                        </span>
                        {isMe && (
                          <span style={{
                            fontSize: 10, fontWeight: 700, background: 'rgba(76,175,80,0.12)',
                            color: '#2E7D32', borderRadius: 99, padding: '2px 8px',
                          }}>
                            você
                          </span>
                        )}
                      </div>
                      <span style={{ fontSize: 12, color: '#94A3B8' }}>{m.email}</span>
                    </div>

                    {/* Role badge */}
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: 5,
                      background: meta.bg, color: meta.color,
                      borderRadius: 99, padding: '4px 12px',
                      fontSize: 12, fontWeight: 700, flexShrink: 0,
                    }}>
                      {meta.icon}
                      {meta.label}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
