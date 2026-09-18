import { describe, expect, it, vi } from 'vitest';
import { buildSchoolEmail, deliveryDecision, menuMailSchema, sendSchoolEmail, type DeliveryRecord, type MenuMailInput } from './menu-mail';

const input: MenuMailInput = { orgId: 'org', batchId: 'ea8a557f-e2be-468f-a717-5b6735767f8c', schoolId: 'school', menuId: 'menu', menuTitle: '<Cardápio>', expectedEmail: 'escola@example.org', pdfFilename: 'Cardapio_escola.pdf', pdfBase64: Buffer.from('%PDF-1.3\nTEST').toString('base64') };

describe('Envios individuais em lote', () => {
  it('valida destinatário, anexo e identificador do lote', () => {
    expect(menuMailSchema.safeParse(input).success).toBe(true);
    for (const bad of [{ schoolId: '../other' }, { batchId: 'bad' }, { expectedEmail: 'a@b.org,c@d.org' }, { pdfFilename: '../file.pdf' }, { pdfBase64: '??' }]) {
      expect(menuMailSchema.safeParse({ ...input, ...bad }).success).toBe(false);
    }
    expect(() => buildSchoolEmail({ ...input, pdfBase64: Buffer.from('not a pdf').toString('base64') }, { name: 'Escola', email: input.expectedEmail }, 'from@example.org')).toThrow();
  });
  it('envia apenas o anexo e destinatário da escola atual, escapando texto', () => {
    const payload = buildSchoolEmail(input, { name: 'Escola <A>', email: input.expectedEmail }, 'from@example.org');
    expect(payload.to).toEqual([input.expectedEmail]);
    expect(payload.attachments).toHaveLength(1);
    expect(payload.attachments[0].content.toString()).toBe('%PDF-1.3\nTEST');
    expect(payload.html).toContain('Escola &lt;A&gt;');
    expect(payload.html).not.toContain('<Cardápio>');
  });
  it('não reenvia sucesso, conteúdo alterado, tentativa simultânea ou expirada', () => {
    const now = Date.now();
    const record: DeliveryRecord = { status: 'sending', payloadHash: 'a', firstAttemptAt: now, leaseUntil: now + 60000 };
    expect(deliveryDecision(undefined, 'a', now)).toBe('send');
    expect(deliveryDecision(record, 'a', now)).toBe('busy');
    expect(deliveryDecision(record, 'a', now + 61000)).toBe('send');
    expect(deliveryDecision({ ...record, status: 'error' }, 'a', now)).toBe('send');
    expect(deliveryDecision(record, 'b', now)).toBe('changed');
    expect(deliveryDecision(record, 'a', now + 24 * 60 * 60 * 1000)).toBe('expired');
    expect(deliveryDecision({ ...record, status: 'sent' }, 'b', now + 48 * 60 * 60 * 1000)).toBe('sent');
  });
  it('trata erro retornado pelo provedor como falha e preserva a chave de repetição', async () => {
    const payload = buildSchoolEmail(input, { name: 'Escola', email: input.expectedEmail }, 'from@example.org');
    const send = vi.fn().mockResolvedValueOnce({ data: null, error: { message: 'Limite de envio' } }).mockResolvedValueOnce({ data: { id: 'email-id' }, error: null });
    await expect(sendSchoolEmail(send, payload, 'same-key')).rejects.toThrow('Limite de envio');
    await expect(sendSchoolEmail(send, payload, 'same-key')).resolves.toBe('email-id');
    expect(send.mock.calls.map(call => call[1].idempotencyKey)).toEqual(['same-key', 'same-key']);
  });
});
