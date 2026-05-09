import { useState, useEffect } from 'react';
import { useParams } from 'wouter';
import { db } from '@/lib/firebase';
import {
  collection,
  query,
  where,
  getDocs,
  addDoc,
  getDoc,
  doc,
  serverTimestamp,
} from 'firebase/firestore';
import { GraduationCap, CheckCircle2, Loader2, AlertCircle, User, FileText, Mail, Phone } from 'lucide-react';

interface Training {
  id: string;
  title: string;
  type: string;
  date: string;
  hours: number;
  duration?: number; // alias used by Training.tsx
  location: string;
  instructor: string;
  presenceToken: string;
  status?: 'scheduled' | 'open' | 'closed';
}

interface FormData {
  name: string;
  cpf: string;
  email: string;
  phone: string;
}

function formatCPF(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
}

function formatPhone(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 2) return digits;
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

function validateCPF(cpf: string): boolean {
  const digits = cpf.replace(/\D/g, '');
  if (digits.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(digits)) return false;
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += parseInt(digits[i]) * (10 - i);
  let check = (sum * 10) % 11;
  if (check === 10 || check === 11) check = 0;
  if (check !== parseInt(digits[9])) return false;
  sum = 0;
  for (let i = 0; i < 10; i++) sum += parseInt(digits[i]) * (11 - i);
  check = (sum * 10) % 11;
  if (check === 10 || check === 11) check = 0;
  return check === parseInt(digits[10]);
}

export default function TrainingAttend() {
  const params = useParams<{ token: string }>();
  const token = params?.token ?? '';

  const [training, setTraining] = useState<Training | null>(null);
  const [orgId, setOrgId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [closed, setClosed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [alreadyRegistered, setAlreadyRegistered] = useState(false);
  const [errors, setErrors] = useState<Partial<FormData>>({});

  const [form, setForm] = useState<FormData>({
    name: '',
    cpf: '',
    email: '',
    phone: '',
  });

  useEffect(() => {
    if (!token) {
      setNotFound(true);
      setLoading(false);
      return;
    }
    (async () => {
      try {
        // 1. Look up the training_tokens global collection to find orgId + trainingId
        const tokenDoc = await getDoc(doc(db, 'training_tokens', token));
        if (tokenDoc.exists()) {
          const tokenData = tokenDoc.data() as { orgId: string; trainingId: string; status?: string };
          const resolvedOrgId = tokenData.orgId;
          setOrgId(resolvedOrgId);

          // Check if training was closed at the token level (fast path)
          if (tokenData.status === 'closed') {
            setClosed(true);
            setLoading(false);
            return;
          }

          // Fetch full training from org-scoped collection
          const trainingDoc = await getDoc(doc(db, 'organizations', resolvedOrgId, 'trainings', tokenData.trainingId));
          if (trainingDoc.exists()) {
            const trainingData = trainingDoc.data() as Omit<Training, 'id'>;
            if (trainingData.status === 'closed' || trainingData.status === 'scheduled') {
              setClosed(true);
            } else {
              setTraining({ id: trainingDoc.id, ...trainingData });
            }
          } else {
            setNotFound(true);
          }
        } else {
          // Fallback: old flat collection for backward-compat with older QR codes
          const q = query(collection(db, 'pnae_trainings'), where('presenceToken', '==', token));
          const snap = await getDocs(q);
          if (snap.empty) {
            setNotFound(true);
          } else {
            const docData = snap.docs[0].data() as Omit<Training, 'id'>;
            if (docData.status === 'closed' || docData.status === 'scheduled') {
              setClosed(true);
            } else {
              // Legacy trainings don't have orgId — use legacy org
              setOrgId('pnae-default-org');
              setTraining({ id: snap.docs[0].id, ...docData });
            }
          }
        }
      } catch {
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  function validate(): boolean {
    const errs: Partial<FormData> = {};
    if (!form.name.trim() || form.name.trim().split(' ').length < 2) {
      errs.name = 'Informe seu nome completo';
    }
    if (!validateCPF(form.cpf)) {
      errs.cpf = 'CPF inválido';
    }
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      errs.email = 'E-mail inválido';
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate() || !training) return;
    setSubmitting(true);
    try {
      const cpfClean = form.cpf.replace(/\D/g, '');
      const attendeesCollection = orgId
        ? collection(db, 'organizations', orgId, 'training_attendees')
        : collection(db, 'pnae_attendees'); // fallback for legacy

      // Check for duplicate by CPF in this training
      const dupQ = query(
        attendeesCollection,
        where('trainingId', '==', training.id),
        where('cpf', '==', cpfClean),
      );
      const dupSnap = await getDocs(dupQ);
      if (!dupSnap.empty) {
        setAlreadyRegistered(true);
        setSubmitted(true);
        setSubmitting(false);
        return;
      }
      await addDoc(attendeesCollection, {
        trainingId: training.id,
        name: form.name.trim(),
        cpf: cpfClean,
        email: form.email.trim(),
        phone: form.phone.replace(/\D/g, ''),
        registeredAt: serverTimestamp(),
        certificateIssued: false,
      });
      setSubmitted(true);
    } catch {
      setErrors({ name: 'Erro ao registrar. Tente novamente.' });
    } finally {
      setSubmitting(false);
    }
  }

  function handleChange(field: keyof FormData, raw: string) {
    let val = raw;
    if (field === 'cpf') val = formatCPF(raw);
    if (field === 'phone') val = formatPhone(raw);
    setForm((prev) => ({ ...prev, [field]: val }));
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: undefined }));
  }

  // ── Loading ──────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center" style={{ background: 'linear-gradient(135deg, #14532d 0%, #166534 50%, #15803d 100%)' }}>
        <Loader2 className="h-10 w-10 animate-spin text-white/70" />
      </div>
    );
  }

  // ── Not found ────────────────────────────────────────────────────────────
  if (notFound) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center px-4 text-center" style={{ background: 'linear-gradient(135deg, #14532d 0%, #166534 50%, #15803d 100%)' }}>
        <AlertCircle className="mb-4 h-16 w-16 text-red-300" />
        <h1 className="text-2xl font-bold text-white">Treinamento não encontrado</h1>
        <p className="mt-2 text-white/70">O link pode ter expirado ou é inválido. Solicite um novo QR code ao responsável.</p>
      </div>
    );
  }

  // ── Closed ───────────────────────────────────────────────────────────────
  if (closed) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center px-4 text-center" style={{ background: 'linear-gradient(135deg, #14532d 0%, #166534 50%, #15803d 100%)' }}>
        <AlertCircle className="mb-4 h-16 w-16 text-amber-300" />
        <h1 className="text-2xl font-bold text-white">Inscrições encerradas</h1>
        <p className="mt-2 text-white/70">As inscrições para este treinamento já foram encerradas ou ainda não foram abertas.</p>
        <p className="mt-4 text-white/50 text-sm">Procure o responsável pelo treinamento para mais informações.</p>
      </div>
    );
  }

  // ── Success ──────────────────────────────────────────────────────────────
  if (submitted) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center px-4 text-center" style={{ background: 'linear-gradient(135deg, #14532d 0%, #166534 50%, #15803d 100%)' }}>
        <div className="w-full max-w-sm rounded-3xl bg-white/10 p-8 shadow-2xl backdrop-blur-sm border border-white/20">
          <CheckCircle2 className="mx-auto mb-4 h-20 w-20 text-green-300" />
          <h1 className="text-2xl font-bold text-white">
            {alreadyRegistered ? 'Presença já registrada!' : 'Presença registrada!'}
          </h1>
          <p className="mt-3 text-white/80">
            {alreadyRegistered
              ? 'Seu CPF já consta na lista deste treinamento.'
              : 'Sua participação foi confirmada com sucesso.'}
          </p>
          {training && (
            <div className="mt-6 rounded-2xl bg-white/10 p-4 text-left text-sm text-white/90">
              <p className="font-semibold text-white">{training.title}</p>
              <p className="mt-1 text-white/70">{training.type}</p>
              <div className="mt-3 space-y-1">
                <p>📅 {new Date(training.date + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}</p>
                <p>⏱ {training.hours ?? training.duration}h de carga horária</p>
                <p>📍 {training.location}</p>
              </div>
            </div>
          )}
          <p className="mt-5 text-xs text-white/50">Você poderá retirar seu certificado com o responsável pelo treinamento.</p>
        </div>
      </div>
    );
  }

  // ── Form ─────────────────────────────────────────────────────────────────
  return (
    <div className="flex min-h-screen flex-col items-center justify-start px-4 py-8" style={{ background: 'linear-gradient(135deg, #14532d 0%, #166534 50%, #15803d 100%)' }}>
      {/* Header */}
      <div className="mb-6 text-center">
        <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-2xl bg-white/15 backdrop-blur-sm">
          <GraduationCap className="h-9 w-9 text-white" />
        </div>
        <p className="text-sm font-semibold uppercase tracking-widest text-green-200">PNAE · Registro de Presença</p>
        <h1 className="mt-1 text-xl font-bold text-white leading-tight">{training?.title}</h1>
        <p className="mt-1 text-sm text-white/70">{training?.type}</p>
      </div>

      {/* Training info card */}
      {training && (
        <div className="mb-6 w-full max-w-sm rounded-2xl bg-white/10 border border-white/20 p-4 text-sm text-white/90 backdrop-blur-sm">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <p className="text-white/50 text-xs">Data</p>
              <p className="font-medium">{new Date(training.date + 'T12:00:00').toLocaleDateString('pt-BR')}</p>
            </div>
            <div>
              <p className="text-white/50 text-xs">Carga Horária</p>
              <p className="font-medium">{training.hours ?? training.duration}h</p>
            </div>
            <div className="col-span-2">
              <p className="text-white/50 text-xs">Local</p>
              <p className="font-medium">{training.location}</p>
            </div>
            <div className="col-span-2">
              <p className="text-white/50 text-xs">Instrutor(a)</p>
              <p className="font-medium">{training.instructor}</p>
            </div>
          </div>
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-4">
        {/* Name */}
        <div>
          <label className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-white/90">
            <User className="h-4 w-4" /> Nome Completo *
          </label>
          <input
            type="text"
            value={form.name}
            onChange={(e) => handleChange('name', e.target.value)}
            placeholder="Seu nome completo"
            autoComplete="name"
            className={`w-full rounded-2xl border px-4 py-3 text-sm outline-none transition-all bg-white/10 text-white placeholder-white/40 backdrop-blur-sm focus:bg-white/15 focus:ring-2 ${
              errors.name ? 'border-red-400 focus:ring-red-400/50' : 'border-white/20 focus:border-white/40 focus:ring-white/20'
            }`}
          />
          {errors.name && <p className="mt-1 text-xs text-red-300">{errors.name}</p>}
        </div>

        {/* CPF */}
        <div>
          <label className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-white/90">
            <FileText className="h-4 w-4" /> CPF *
          </label>
          <input
            type="text"
            inputMode="numeric"
            value={form.cpf}
            onChange={(e) => handleChange('cpf', e.target.value)}
            placeholder="000.000.000-00"
            autoComplete="off"
            className={`w-full rounded-2xl border px-4 py-3 text-sm outline-none transition-all bg-white/10 text-white placeholder-white/40 backdrop-blur-sm focus:bg-white/15 focus:ring-2 ${
              errors.cpf ? 'border-red-400 focus:ring-red-400/50' : 'border-white/20 focus:border-white/40 focus:ring-white/20'
            }`}
          />
          {errors.cpf && <p className="mt-1 text-xs text-red-300">{errors.cpf}</p>}
        </div>

        {/* Email */}
        <div>
          <label className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-white/90">
            <Mail className="h-4 w-4" /> E-mail <span className="text-white/40">(opcional)</span>
          </label>
          <input
            type="email"
            value={form.email}
            onChange={(e) => handleChange('email', e.target.value)}
            placeholder="seu@email.com"
            autoComplete="email"
            className={`w-full rounded-2xl border px-4 py-3 text-sm outline-none transition-all bg-white/10 text-white placeholder-white/40 backdrop-blur-sm focus:bg-white/15 focus:ring-2 ${
              errors.email ? 'border-red-400 focus:ring-red-400/50' : 'border-white/20 focus:border-white/40 focus:ring-white/20'
            }`}
          />
          {errors.email && <p className="mt-1 text-xs text-red-300">{errors.email}</p>}
        </div>

        {/* Phone */}
        <div>
          <label className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-white/90">
            <Phone className="h-4 w-4" /> Telefone <span className="text-white/40">(opcional)</span>
          </label>
          <input
            type="tel"
            inputMode="numeric"
            value={form.phone}
            onChange={(e) => handleChange('phone', e.target.value)}
            placeholder="(00) 00000-0000"
            autoComplete="tel"
            className="w-full rounded-2xl border border-white/20 px-4 py-3 text-sm outline-none transition-all bg-white/10 text-white placeholder-white/40 backdrop-blur-sm focus:bg-white/15 focus:border-white/40 focus:ring-2 focus:ring-white/20"
          />
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={submitting}
          className="mt-2 w-full rounded-2xl bg-white py-4 text-base font-bold text-green-800 shadow-lg transition-all hover:bg-green-50 active:scale-95 disabled:opacity-60"
        >
          {submitting ? (
            <span className="flex items-center justify-center gap-2">
              <Loader2 className="h-5 w-5 animate-spin" /> Registrando…
            </span>
          ) : (
            'Confirmar Presença'
          )}
        </button>

        <p className="text-center text-xs text-white/40 pb-4">
          Seus dados são utilizados exclusivamente para emissão de certificado de participação.
        </p>
      </form>
    </div>
  );
}
