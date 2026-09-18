import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { educationNetworks, educationStages } from './SchoolEducationFields';
import { useOrgId } from '@/hooks/useOrgId';
import { apiUrl, authHeaders } from '@/lib/apiUrl';
import { distributionWarnings, pdfSchoolFilename, retrySchoolIds, schoolsInGroup, validSchoolEmail, type DistributionResult } from '@/lib/menuDistribution';
import type { MenuPdfContext } from '@/lib/menuPdf';
import type { Menu } from '@/types/nutrition';
import type { School } from '@/types';
import { toast } from 'sonner';

interface Props {
  menu: Menu; context: MenuPdfContext; meals: string[]; onClose: () => void;
  generatePdf: (school: School) => Promise<string>;
}

export function MenuDistributionDialog({ menu, context, meals, generatePdf, onClose }: Props) {
  const orgId = useOrgId();
  const [network, setNetwork] = useState('');
  const [stage, setStage] = useState('');
  const [selected, setSelected] = useState<string[]>(menu.schoolIds || []);
  const [results, setResults] = useState<Record<string, DistributionResult>>({});
  const [busy, setBusy] = useState(false);
  const [reviewed, setReviewed] = useState(false);
  const [progress, setProgress] = useState('');
  const running = useRef(false);
  const stop = useRef(false);
  const batchId = useRef(crypto.randomUUID());
  const payloads = useRef(new Map<string, { pdfBase64: string; pdfFilename: string; expectedEmail: string }>());
  const visible = schoolsInGroup(context.schools, network, stage);
  const chosen = context.schools.filter(s => selected.includes(s.id));
  const unsent = chosen.filter(s => results[s.id]?.status !== 'sent');
  const ready = unsent.filter(s => validSchoolEmail(s.email));
  const hasWarnings = unsent.some(s => distributionWarnings(menu, s, context, meals).length > 0);
  const failures = retrySchoolIds(results);
  const changeSelection = (ids: string[]) => { setSelected(ids); setReviewed(false); };
  const report = (id: string, result: DistributionResult) => setResults(previous => ({ ...previous, [id]: result }));

  async function send(ids: string[]) {
    if (running.current || context.loading || !orgId) return;
    const recipients = context.schools.filter(s => ids.includes(s.id) && results[s.id]?.status !== 'sent');
    if (recipients.some(s => distributionWarnings(menu, s, context, meals).length) && !reviewed) {
      toast.error('Confira as pendências e marque a revisão antes de enviar.'); return;
    }
    running.current = true; stop.current = false; setBusy(true);
    try {
      for (let i = 0; i < recipients.length; i++) {
        if (stop.current) break;
        const school = recipients[i];
        if (!validSchoolEmail(school.email)) { report(school.id, { status: 'error', message: 'E-mail ausente ou inválido. Corrija o cadastro da escola.' }); continue; }
        setProgress(`Enviando ${i + 1} de ${recipients.length}: ${school.name}`);
        report(school.id, { status: 'sending', message: 'Gerando PDF e enviando…' });
        try {
          let payload = payloads.current.get(school.id);
          if (!payload) {
            payload = { pdfBase64: await generatePdf(school), pdfFilename: pdfSchoolFilename(menu, school), expectedEmail: school.email!.trim() };
            payloads.current.set(school.id, payload); // reuse exact bytes after an uncertain response
          }
          const response = await fetch(apiUrl('/api/email/send-menu-school'), {
            method: 'POST', headers: await authHeaders(), signal: AbortSignal.timeout(45000),
            body: JSON.stringify({ orgId, batchId: batchId.current, schoolId: school.id, menuId: menu.id, menuTitle: menu.title, ...payload }),
          });
          const data = await response.json();
          if (!response.ok || data.status !== 'sent') throw new Error(data.error || 'Não foi possível confirmar o envio.');
          report(school.id, { status: 'sent', message: 'Envio aceito pelo serviço de e-mail.' });
        } catch (error) {
          report(school.id, { status: 'error', message: error instanceof Error ? error.message : 'Falha no envio. Tente novamente neste lote.' });
        }
        if (i < recipients.length - 1 && !stop.current) await new Promise(resolve => setTimeout(resolve, 750));
      }
      setProgress(stop.current ? 'Lote interrompido. Os resultados foram preservados nesta tela.' : 'Lote concluído. Confira o resultado de cada escola.');
    } finally { running.current = false; setBusy(false); }
  }

  async function downloadZip() {
    if (running.current || context.loading || !chosen.length) return;
    running.current = true; setBusy(true);
    try {
      const entries: Record<string, Uint8Array> = {};
      for (let i = 0; i < chosen.length; i++) {
        const school = chosen[i];
        setProgress(`Gerando PDF ${i + 1} de ${chosen.length}: ${school.name}`);
        const binary = atob(await generatePdf(school));
        // Index also guarantees unique filenames for schools whose names normalize equally.
        entries[`${String(i + 1).padStart(3, '0')}_${pdfSchoolFilename(menu, school)}`] = Uint8Array.from(binary, c => c.charCodeAt(0));
      }
      const { zip } = await import('fflate');
      const data = await new Promise<Uint8Array>((resolve, reject) => zip(entries, { level: 1 }, (error, zipped) => error ? reject(error) : resolve(zipped)));
      const url = URL.createObjectURL(new Blob([data as BlobPart], { type: 'application/zip' }));
      const anchor = document.createElement('a'); anchor.href = url; anchor.download = `Cardapios_${batchId.current.slice(0, 8)}.zip`; anchor.click();
      setTimeout(() => URL.revokeObjectURL(url), 30000);
      setProgress(`ZIP gerado com ${chosen.length} PDFs, um por escola.`);
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Falha ao gerar ZIP.'); }
    finally { running.current = false; setBusy(false); }
  }

  return <Dialog open onOpenChange={open => { if (!open && !running.current) onClose(); }}>
    <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl">
      <DialogHeader>
        <DialogTitle>Distribuir cardápio por grupo</DialogTitle>
        <DialogDescription>{menu.title} · Cada escola recebe somente o seu PDF, com horários e observações próprios.</DialogDescription>
      </DialogHeader>
      <fieldset disabled={busy} className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm">Rede de ensino
          <select className="mt-1 w-full rounded border bg-background p-2" value={network} onChange={e => { setNetwork(e.target.value); changeSelection([]); }}>
            <option value="">Todas as redes</option>
            {Object.entries(educationNetworks).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
          </select>
        </label>
        <label className="text-sm">Etapa atendida
          <select className="mt-1 w-full rounded border bg-background p-2" value={stage} onChange={e => { setStage(e.target.value); changeSelection([]); }}>
            <option value="">Todas as etapas</option>
            {educationStages.map(s => <option key={s}>{s}</option>)}
          </select>
        </label>
      </fieldset>
      <p className="text-xs text-muted-foreground">Para selecionar todas as creches, filtre a etapa Creche. Para separar estado e município, use a rede. Cadastre esses dados em Escolas; unidades sem classificação aparecem em “Todas”.</p>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" disabled={busy} onClick={() => changeSelection(visible.map(s => s.id))}>Selecionar grupo ({visible.length})</Button>
        <Button variant="ghost" size="sm" disabled={busy} onClick={() => changeSelection([])}>Limpar seleção</Button>
      </div>
      <div className="max-h-72 space-y-2 overflow-y-auto">
        {!visible.length && <p className="p-3 text-sm text-muted-foreground">Nenhuma escola neste grupo. Confira a classificação no cadastro.</p>}
        {visible.map(school => {
          const warnings = distributionWarnings(menu, school, context, meals);
          const result = results[school.id];
          return <div className="rounded-lg border p-3" key={school.id}>
            <label className="flex items-start gap-3 text-sm">
              <input className="mt-1" type="checkbox" disabled={busy} checked={selected.includes(school.id)} onChange={e => changeSelection(e.target.checked ? [...selected, school.id] : selected.filter(id => id !== school.id))} />
              <span><strong>{school.name}</strong><span className="block text-xs text-muted-foreground">{school.email || 'Sem e-mail'} · {school.educationNetwork ? educationNetworks[school.educationNetwork] : 'Rede não informada'} · {school.educationStages?.join(', ') || 'Etapas não informadas'}</span></span>
            </label>
            {!validSchoolEmail(school.email) && <p className="mt-1 text-xs text-red-700">Não receberá e-mail até corrigir o endereço. O PDF pode ser baixado no ZIP.</p>}
            {warnings.map(warning => <p className="mt-1 text-xs text-amber-800" key={warning}>{warning}</p>)}
            {result && <p role="status" className={`mt-2 text-xs font-medium ${result.status === 'sent' ? 'text-green-700' : result.status === 'error' ? 'text-red-700' : 'text-blue-700'}`}>{result.message}</p>}
          </div>;
        })}
      </div>
      <p className="text-sm">{chosen.length} selecionada(s) · {ready.length} com e-mail válido e ainda não enviada(s) · {Object.values(results).filter(r => r.status === 'sent').length} envio(s) aceito(s) · {failures.length} falha(s).</p>
      {(hasWarnings || failures.length > 0) && <label className="flex gap-2 text-sm"><input type="checkbox" checked={reviewed} disabled={busy} onChange={e => setReviewed(e.target.checked)} />Revisei as pendências das escolas e do cardápio antes do envio.</label>}
      <p className="text-xs text-muted-foreground">Mantenha esta tela aberta durante o lote. “Envio aceito” não confirma a entrega na caixa de entrada. Use a repetição de falhas nesta tela para evitar reenviar as escolas já atendidas.</p>
      <p role="status" aria-live="polite" className="text-sm">{context.loading ? 'Carregando escolas, dietas e dados da RT…' : progress}</p>
      <div className="flex flex-wrap gap-2">
        <Button disabled={busy || context.loading || !orgId || !ready.length || (hasWarnings && !reviewed)} onClick={() => void send(selected)}>Enviar para {ready.length} escola(s)</Button>
        <Button variant="outline" disabled={busy || context.loading || !orgId || !failures.length || !reviewed} onClick={() => void send(failures)}>Repetir somente falhas ({failures.length})</Button>
        <Button variant="outline" disabled={busy || context.loading || !chosen.length} onClick={() => void downloadZip()}>Baixar selecionadas em ZIP</Button>
        {busy && progress.startsWith('Enviando') && <Button variant="ghost" onClick={() => { stop.current = true; }}>Parar após o envio atual</Button>}
      </div>
    </DialogContent>
  </Dialog>;
}
