import { useState, useRef, useEffect } from 'react';
import { useDocuments } from '@/hooks/useDocuments';
import { OrgDocument, DocumentCategory } from '@/types';
import { storage } from '@/lib/firebase';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import {
  AlertTriangle, CheckCircle2, Clock,
  Paperclip, Trash2, Plus, ExternalLink, Loader2, X, Pencil,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ─── Lista base de documentos obrigatórios ───────────────────────────────────

interface TemplatDoc {
  name: string;
  category: DocumentCategory;
  hint?: string; // tooltip / help text
  hasExpiry: boolean; // se costuma ter data de validade
}

const MANDATORY_DOCS: TemplatDoc[] = [
  // RDC 216
  { name: 'Manual de Boas Práticas (MBP)',                       category: 'RDC 216',  hasExpiry: false },
  { name: 'POP — Higienização de Instalações e Equipamentos',    category: 'RDC 216',  hasExpiry: false },
  { name: 'POP — Controle de Pragas e Vetores',                  category: 'RDC 216',  hasExpiry: false },
  { name: 'POP — Higiene e Saúde dos Manipuladores',             category: 'RDC 216',  hasExpiry: false },
  { name: 'POP — Higienização do Reservatório de Água',          category: 'RDC 216',  hasExpiry: false },
  { name: 'POP — Seleção de Matérias-Primas e Fornecedores',     category: 'RDC 216',  hasExpiry: false },
  // RDC 275
  { name: 'Lista de Verificação de Boas Práticas (checklist)',   category: 'RDC 275',  hasExpiry: true  },
  // PNAE
  { name: 'Anotação de Responsabilidade Técnica — CFN (RT/ART)', category: 'PNAE',     hasExpiry: true  },
  // CVS / Vigilância Sanitária
  { name: 'Alvará Sanitário',                                    category: 'CVS',      hasExpiry: true  },
  // Municipal
  { name: 'Alvará de Funcionamento Municipal',                   category: 'Municipal', hasExpiry: true  },
  { name: 'Auto de Vistoria do Corpo de Bombeiros (AVCB)',       category: 'Municipal', hasExpiry: true  },
  // ANVISA / Outros
  { name: 'Laudo de Potabilidade da Água',                       category: 'ANVISA',   hasExpiry: true  },
  { name: 'Certificado de Limpeza da Caixa d\'Água',             category: 'ANVISA',   hasExpiry: true  },
  { name: 'Certificado de Controle de Pragas (Dedetização)',     category: 'ANVISA',   hasExpiry: true  },
  { name: 'Atestado de Saúde Ocupacional (ASO) — Manipuladores', category: 'Outros',   hasExpiry: true  },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

const CATEGORY_COLORS: Record<DocumentCategory, string> = {
  'RDC 216':  'bg-blue-100 text-blue-700',
  'RDC 275':  'bg-indigo-100 text-indigo-700',
  'PNAE':     'bg-green-100 text-green-700',
  'CVS':      'bg-purple-100 text-purple-700',
  'ANVISA':   'bg-red-100 text-red-700',
  'Municipal':'bg-orange-100 text-orange-700',
  'Outros':   'bg-gray-100 text-gray-600',
};

const CATEGORIES: DocumentCategory[] = ['RDC 216','RDC 275','PNAE','CVS','ANVISA','Municipal','Outros'];

function getExpiryStatus(expiryDate?: string): 'expired' | 'soon' | 'ok' | 'none' {
  if (!expiryDate) return 'none';
  const exp = new Date(expiryDate + 'T23:59:59');
  const diff = Math.ceil((exp.getTime() - Date.now()) / 86400000);
  if (diff < 0) return 'expired';
  if (diff <= 30) return 'soon';
  return 'ok';
}

function daysUntil(iso?: string) {
  if (!iso) return null;
  return Math.ceil((new Date(iso + 'T23:59:59').getTime() - Date.now()) / 86400000);
}

function formatDate(iso?: string) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

// ─── Status dot ──────────────────────────────────────────────────────────────

function StatusDot({ doc }: { doc: OrgDocument | undefined }) {
  if (!doc) return <span className="w-2.5 h-2.5 rounded-full bg-gray-200 shrink-0 mt-0.5" />;
  const s = getExpiryStatus(doc.expiryDate);
  if (s === 'expired') return <span className="w-2.5 h-2.5 rounded-full bg-red-500 shrink-0 mt-0.5" title="Vencido" />;
  if (s === 'soon')    return <span className="w-2.5 h-2.5 rounded-full bg-amber-400 shrink-0 mt-0.5 animate-pulse" title="Vencendo em breve" />;
  if (s === 'ok')      return <span className="w-2.5 h-2.5 rounded-full bg-green-500 shrink-0 mt-0.5" title="Válido" />;
  // no expiry, but has file
  if (doc.fileUrl)     return <span className="w-2.5 h-2.5 rounded-full bg-green-400 shrink-0 mt-0.5" title="Anexado" />;
  return <span className="w-2.5 h-2.5 rounded-full bg-gray-300 shrink-0 mt-0.5" />;
}

// ─── Add custom document modal ───────────────────────────────────────────────

function AddDocModal({ onClose, onAdd }: {
  onClose: () => void;
  onAdd: (name: string, category: DocumentCategory) => void;
}) {
  const [name, setName] = useState('');
  const [cat, setCat] = useState<DocumentCategory>('Outros');
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
        <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-gray-100">
          <h2 className="font-bold text-gray-900">Novo documento</h2>
          <button onClick={onClose} className="p-1.5 rounded-xl text-gray-400 hover:bg-gray-100"><X className="h-4 w-4" /></button>
        </div>
        <div className="px-5 py-4 space-y-3">
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">Nome do documento *</label>
            <input
              autoFocus
              className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              placeholder="Ex.: Licença Ambiental"
              value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && name && onAdd(name, cat)}
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">Categoria</label>
            <select
              className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-green-500"
              value={cat}
              onChange={e => setCat(e.target.value as DocumentCategory)}
            >
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>
        <div className="flex justify-end gap-2 px-5 py-3 border-t border-gray-100">
          <button onClick={onClose} className="px-4 py-2 rounded-xl text-sm text-gray-600 hover:bg-gray-100">Cancelar</button>
          <button
            disabled={!name.trim()}
            onClick={() => name.trim() && onAdd(name.trim(), cat)}
            className="px-4 py-2 rounded-xl bg-green-600 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-40"
          >
            Adicionar
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Document row ─────────────────────────────────────────────────────────────

interface RowProps {
  name: string;
  category: DocumentCategory;
  doc: OrgDocument | undefined;
  onFileChange: (file: File) => Promise<void>;
  onDateChange: (date: string) => void;
  onDelete: () => void;
}

function DocRow({ name, category, doc, onFileChange, onDateChange, onDelete }: RowProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [editingDate, setEditingDate] = useState(false);
  const [dateVal, setDateVal] = useState(doc?.expiryDate || '');

  useEffect(() => { setDateVal(doc?.expiryDate || ''); }, [doc?.expiryDate]);

  const status = getExpiryStatus(doc?.expiryDate);
  const days = daysUntil(doc?.expiryDate);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try { await onFileChange(file); } finally { setUploading(false); }
    e.target.value = '';
  };

  const handleDateBlur = () => {
    setEditingDate(false);
    if (dateVal !== (doc?.expiryDate || '')) onDateChange(dateVal);
  };

  return (
    <div className={cn(
      'group flex items-center gap-3 px-4 py-3 border-b border-gray-100 hover:bg-gray-50 transition-colors',
      status === 'expired' && 'bg-red-50/40 hover:bg-red-50',
      status === 'soon'    && 'bg-amber-50/40 hover:bg-amber-50',
    )}>
      {/* Status dot */}
      <StatusDot doc={doc} />

      {/* Name */}
      <div className="flex-1 min-w-0">
        <span className="text-sm text-gray-800 font-medium">{name}</span>
      </div>

      {/* Category */}
      <span className={cn('hidden sm:inline-flex shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold', CATEGORY_COLORS[category])}>
        {category}
      </span>

      {/* File */}
      <div className="shrink-0 w-36">
        <input ref={fileRef} type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" className="hidden" onChange={handleFile} />
        {uploading ? (
          <span className="flex items-center gap-1 text-xs text-gray-400">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Enviando…
          </span>
        ) : doc?.fileUrl ? (
          <div className="flex items-center gap-1">
            <a
              href={doc.fileUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-medium max-w-[100px] truncate"
              title={doc.fileName}
            >
              <ExternalLink className="h-3 w-3 shrink-0" />
              <span className="truncate">{doc.fileName || 'Ver arquivo'}</span>
            </a>
            <button
              onClick={() => fileRef.current?.click()}
              className="opacity-0 group-hover:opacity-100 text-[10px] text-gray-400 hover:text-gray-600 shrink-0"
              title="Trocar arquivo"
            >(trocar)</button>
          </div>
        ) : (
          <button
            onClick={() => fileRef.current?.click()}
            className="flex items-center gap-1 text-xs text-gray-400 hover:text-green-600 font-medium transition-colors"
          >
            <Paperclip className="h-3.5 w-3.5" />
            Anexar
          </button>
        )}
      </div>

      {/* Expiry date */}
      <div className="shrink-0 w-32">
        {editingDate ? (
          <input
            autoFocus
            type="date"
            className="w-full rounded-lg border border-green-400 px-2 py-0.5 text-xs focus:outline-none focus:ring-2 focus:ring-green-500"
            value={dateVal}
            onChange={e => setDateVal(e.target.value)}
            onBlur={handleDateBlur}
            onKeyDown={e => { if (e.key === 'Enter') handleDateBlur(); if (e.key === 'Escape') setEditingDate(false); }}
          />
        ) : (
          <span className={cn(
            'flex items-center gap-1 text-xs',
            status === 'expired' ? 'text-red-600 font-semibold' :
            status === 'soon'    ? 'text-amber-600 font-semibold' :
            doc?.expiryDate     ? 'text-gray-600' : 'text-gray-300',
          )}>
            {status === 'expired' && <AlertTriangle className="h-3 w-3 shrink-0" />}
            {status === 'soon'    && <Clock className="h-3 w-3 shrink-0" />}
            {status === 'ok'      && <CheckCircle2 className="h-3 w-3 shrink-0 text-green-500" />}
            {doc?.expiryDate
              ? status === 'expired'
                ? `Vencido (${formatDate(doc.expiryDate)})`
                : status === 'soon'
                  ? `${days}d — ${formatDate(doc.expiryDate)}`
                  : formatDate(doc.expiryDate)
              : '— / — / —'}
          </span>
        )}
      </div>

      {/* Actions: always visible on hover */}
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
        <button
          onClick={() => setEditingDate(true)}
          className="p-1.5 rounded-lg text-gray-400 hover:text-green-600 hover:bg-green-50 transition-colors"
          title="Editar validade"
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={onDelete}
          className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
          title="Excluir documento"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function Documents() {
  const { user } = useAuth();
  const { documents, loading, addDocument, updateDocument, deleteDocument, getExpiringDocuments } = useDocuments();
  const [addModal, setAddModal] = useState(false);
  const [uploadingId, setUploadingId] = useState<string | null>(null);

  const expiring = getExpiringDocuments(30);
  const expired  = expiring.filter(d => getExpiryStatus(d.expiryDate) === 'expired');
  const soon     = expiring.filter(d => getExpiryStatus(d.expiryDate) === 'soon');

  // merge mandatory templates with Firestore docs by name
  const mandatoryRows = MANDATORY_DOCS.map(tpl => ({
    name: tpl.name,
    category: tpl.category,
    doc: documents.find(d => d.name === tpl.name),
  }));

  // custom docs (not in mandatory list)
  const customRows = documents
    .filter(d => !MANDATORY_DOCS.some(t => t.name === d.name))
    .map(d => ({
      name: d.name,
      category: d.category,
      doc: d,
    }));

  const allRows = [...mandatoryRows, ...customRows];

  // ── handlers ──────────────────────────────────────────────────────────────

  const getOrCreateDoc = (name: string, category: DocumentCategory): OrgDocument => {
    const existing = documents.find(d => d.name === name);
    if (existing) return existing;
    return addDocument({ name, category });
  };

  const handleFile = async (name: string, category: DocumentCategory, file: File) => {
    if (!user?.organizationId) { toast.error('Usuário sem organização'); return; }
    const doc = getOrCreateDoc(name, category);
    setUploadingId(doc.id);
    try {
      const path = `orgs/${user.organizationId}/documents/${Date.now()}_${file.name}`;
      const fRef = storageRef(storage, path);
      await uploadBytes(fRef, file);
      const fileUrl = await getDownloadURL(fRef);
      updateDocument(doc.id, { fileUrl, fileName: file.name });
      toast.success('Arquivo anexado com sucesso');
    } catch (err) {
      console.error(err);
      toast.error('Erro ao enviar arquivo');
    } finally {
      setUploadingId(null);
    }
  };

  const handleDate = (name: string, category: DocumentCategory, date: string) => {
    const doc = getOrCreateDoc(name, category);
    updateDocument(doc.id, { expiryDate: date || undefined });
  };

  const handleAddCustom = (name: string, category: DocumentCategory) => {
    addDocument({ name, category });
    setAddModal(false);
    toast.success('Documento adicionado');
  };

  const handleDelete = (doc: OrgDocument) => {
    if (!confirm(`Excluir "${doc.name}"?`)) return;
    deleteDocument(doc.id);
    toast.success('Documento removido');
  };

  // ── summary counts ────────────────────────────────────────────────────────
  const filled = documents.filter(d => d.fileUrl || d.expiryDate).length;
  const total  = allRows.length;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-6 py-5">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-xl font-bold text-gray-900">Documentos Obrigatórios</h1>
              <p className="text-sm text-gray-500 mt-0.5">
                Clique em <strong>Anexar</strong> para subir o arquivo · Clique na data para editar a validade
              </p>
            </div>
            {/* Summary pills */}
            <div className="hidden sm:flex items-center gap-2 shrink-0">
              {expired.length > 0 && (
                <span className="flex items-center gap-1 rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-700">
                  <AlertTriangle className="h-3.5 w-3.5" />{expired.length} vencido{expired.length > 1 ? 's' : ''}
                </span>
              )}
              {soon.length > 0 && (
                <span className="flex items-center gap-1 rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700">
                  <Clock className="h-3.5 w-3.5" />{soon.length} vencendo
                </span>
              )}
              <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-600">
                {filled}/{total} preenchidos
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="max-w-4xl mx-auto px-4 py-6">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          {/* Column headers */}
          <div className="flex items-center gap-3 px-4 py-2 bg-gray-50 border-b border-gray-100 text-xs font-semibold text-gray-400 uppercase tracking-wide">
            <div className="w-2.5 shrink-0" />
            <div className="flex-1">Documento</div>
            <div className="hidden sm:block w-24 shrink-0">Categoria</div>
            <div className="w-32 shrink-0">Arquivo</div>
            <div className="w-28 text-right shrink-0">Validade</div>
            <div className="w-5 shrink-0" />
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-green-600" />
            </div>
          ) : (
            <>
              {allRows.map(row => (
                <DocRow
                  key={row.name}
                  name={row.name}
                  category={row.category}
                  doc={uploadingId === row.doc?.id ? undefined : row.doc}
                  onFileChange={(file) => handleFile(row.name, row.category, file)}
                  onDateChange={(date) => handleDate(row.name, row.category, date)}
                  onDelete={() => row.doc ? handleDelete(row.doc) : undefined}
                />
              ))}

              {/* Add row */}
              <button
                onClick={() => setAddModal(true)}
                className="w-full flex items-center gap-3 px-4 py-3.5 text-sm text-green-600 hover:bg-green-50 transition-colors font-medium"
              >
                <Plus className="h-4 w-4" />
                Adicionar novo documento
              </button>
            </>
          )}
        </div>

        {/* Legend */}
        <div className="mt-4 flex flex-wrap gap-4 text-xs text-gray-400">
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-green-500" />Válido</span>
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-amber-400" />Vence em até 30 dias</span>
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-red-500" />Vencido</span>
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-gray-300" />Pendente</span>
        </div>
      </div>

      {addModal && (
        <AddDocModal
          onClose={() => setAddModal(false)}
          onAdd={handleAddCustom}
        />
      )}
    </div>
  );
}
