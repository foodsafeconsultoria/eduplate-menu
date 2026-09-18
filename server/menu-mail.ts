import { createHash } from 'node:crypto';
import { z } from 'zod';

export const menuMailSchema = z.object({
  orgId: z.string().min(1).max(128).regex(/^[^/]+$/),
  batchId: z.string().uuid(),
  schoolId: z.string().min(1).max(128).regex(/^[^/]+$/),
  menuId: z.string().min(1).max(128),
  menuTitle: z.string().trim().min(1).max(250),
  expectedEmail: z.string().trim().email(),
  pdfFilename: z.string().min(5).max(240).regex(/^[a-zA-Z0-9_.-]+\.pdf$/),
  pdfBase64: z.string().min(8).max(6 * 1024 * 1024).regex(/^[A-Za-z0-9+/]+={0,2}$/),
});
export type MenuMailInput = z.infer<typeof menuMailSchema>;
export interface DeliveryRecord {
  status: 'sending' | 'sent' | 'error'; payloadHash: string; firstAttemptAt: number; leaseUntil: number;
  providerId?: string;
}
export function deliveryDecision(record: DeliveryRecord | undefined, hash: string, now: number) {
  if (!record) return 'send';
  if (record.status === 'sent') return 'sent';
  if (record.payloadHash !== hash) return 'changed';
  // Provider keys expire after 24 hours. Leave an hour of margin for network/clock delays.
  if (now - record.firstAttemptAt >= 23 * 60 * 60 * 1000) return 'expired';
  if (record.status === 'sending' && record.leaseUntil > now) return 'busy';
  return 'send';
}
export const mailHash = (text: string) => createHash('sha256').update(text).digest('hex');
export const escapeMailText = (text: string) => text.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

export function buildSchoolEmail(input: MenuMailInput, school: { name: string; email: string }, from: string) {
  const content = Buffer.from(input.pdfBase64, 'base64');
  if (content.length > 4 * 1024 * 1024 || content.subarray(0, 5).toString('ascii') !== '%PDF-') throw new Error('Anexo PDF inválido ou maior que 4 MB.');
  return {
    from: `EduPlate Menu <${from}>`, to: [school.email],
    subject: `${input.menuTitle} - ${school.name}`,
    html: `<p>Olá, ${escapeMailText(school.name)}.</p><p>Segue o cardápio <strong>${escapeMailText(input.menuTitle)}</strong>, com os horários e observações específicos da sua escola.</p><p>Consulte o PDF em anexo.</p><p>Equipe de nutrição · EduPlate Menu</p>`,
    attachments: [{ filename: input.pdfFilename, content }],
  };
}

/** Resend returns errors in the result as well as throwing transport errors. */
export async function sendSchoolEmail(
  send: (payload: ReturnType<typeof buildSchoolEmail>, options: { idempotencyKey: string }) => Promise<{ data: { id: string } | null; error: { message: string } | null }>,
  payload: ReturnType<typeof buildSchoolEmail>, key: string,
) {
  const result = await send(payload, { idempotencyKey: key });
  if (result.error || !result.data?.id) throw new Error(result.error?.message || 'O serviço de e-mail não confirmou o envio.');
  return result.data.id;
}
