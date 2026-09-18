/**
 * Email routes — powered by Resend.
 * Required env var: RESEND_API_KEY
 * Optional: RESEND_FROM (defaults to onboarding@resend.dev for testing)
 */
import express, { Request, Response } from 'express';
import { Resend } from 'resend';
import { requireOrgMember } from './auth-middleware.js';
import { getAdminDb } from './firebase-admin.js';
import { menuMailSchema, buildSchoolEmail, mailHash, deliveryDecision, sendSchoolEmail, type DeliveryRecord } from './menu-mail.js';

const router = express.Router();

function getResend() {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error('RESEND_API_KEY não configurada.');
  return new Resend(key);
}

// ── POST /api/email/send-menu ─────────────────────────────────────────────────
// Each batch request carries exactly one school's PDF. Retrying the same school
// uses the same provider key and a durable delivery record scoped to its organization.
router.post('/send-menu-school', requireOrgMember, async (req: Request, res: Response) => {
  const parsed = menuMailSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Dados do envio inválidos. Confira escola, e-mail e anexo PDF.' });
  const input = parsed.data;
  try {
    const resend = getResend();
    const org = getAdminDb().collection('organizations').doc(input.orgId);
    const schoolDoc = await org.collection('schools').doc(input.schoolId).get();
    const school = schoolDoc.data();
    if (!schoolDoc.exists || !school?.email || school.email.trim() !== input.expectedEmail) {
      return res.status(409).json({ error: 'A escola ou seu e-mail mudou ou ainda não foi sincronizado. Atualize o cadastro e abra um novo lote.' });
    }
    const payload = buildSchoolEmail(input, { name: school.name || 'Escola', email: school.email.trim() }, process.env.RESEND_FROM || 'onboarding@resend.dev');
    const hash = mailHash(JSON.stringify(payload));
    const key = mailHash(`${input.orgId}:${input.batchId}:${input.schoolId}`);
    const ref = org.collection('menu_email_deliveries').doc(key);
    const now = Date.now();
    const decision = await getAdminDb().runTransaction(async transaction => {
      const snapshot = await transaction.get(ref);
      const record = snapshot.exists ? snapshot.data() as DeliveryRecord : undefined;
      const action = deliveryDecision(record, hash, now);
      if (action === 'send') transaction.set(ref, {
        batchId: input.batchId, schoolId: input.schoolId, menuId: input.menuId,
        status: 'sending', payloadHash: hash, firstAttemptAt: record?.firstAttemptAt ?? now,
        leaseUntil: now + 60000, updatedAt: now,
      }, { merge: true });
      return action;
    });
    if (decision === 'sent') return res.json({ schoolId: input.schoolId, status: 'sent', alreadySent: true });
    if (decision !== 'send') {
      const errors = {
        busy: 'Este envio ainda está em andamento. Aguarde um minuto e repita somente as falhas.',
        changed: 'O conteúdo deste envio mudou. Confira o resultado anterior antes de abrir um novo lote.',
        expired: 'A janela de repetição segura terminou. Confira o envio no serviço de e-mail antes de abrir um novo lote.',
      };
      return res.status(409).json({ error: errors[decision] });
    }
    try {
      const providerId = await sendSchoolEmail((data, options) => resend.emails.send(data, options), payload, key);
      await ref.set({ status: 'sent', providerId, leaseUntil: 0, updatedAt: Date.now() }, { merge: true });
      return res.json({ schoolId: input.schoolId, status: 'sent' });
    } catch (error) {
      // If delivery succeeded but the write failed, the provider key still protects the retry.
      await getAdminDb().runTransaction(async transaction => {
        const latest = await transaction.get(ref);
        if (latest.data()?.status !== 'sent') transaction.set(ref, { status: 'error', leaseUntil: 0, updatedAt: Date.now() }, { merge: true });
      }).catch(() => {});
      throw error;
    }
  } catch (error) {
    return res.status(502).json({ error: error instanceof Error ? error.message : 'Não foi possível confirmar o envio.' });
  }
});

// Sends a menu PDF (or HTML) to one or more schools.
// Body: { schools: { name, email }[], menuTitle: string, menuHtml: string, senderName: string }
router.post('/send-menu', async (req: Request, res: Response) => {
  try {
    const { schools, menuTitle, menuHtml, senderName, pdfBase64, pdfFilename } = req.body as {
      schools: { name: string; email: string }[];
      menuTitle: string;
      menuHtml: string;
      senderName: string;
      pdfBase64?: string;
      pdfFilename?: string;
    };

    if (!schools?.length) return res.status(400).json({ error: 'Nenhuma escola selecionada.' });
    if (!menuTitle) return res.status(400).json({ error: 'Título do cardápio é obrigatório.' });
    const resend = getResend();
    const fromName = senderName || 'EduPlate Menu';
    const fromEmail = process.env.RESEND_FROM || 'onboarding@resend.dev';

    // Decode and validate PDF
    let pdfBuffer: Buffer | undefined;
    if (pdfBase64 && pdfFilename) {
      pdfBuffer = Buffer.from(pdfBase64, 'base64');
      const header = pdfBuffer.slice(0, 5).toString('ascii');
      console.log(`[Email /send-menu] PDF: ${pdfBuffer.length} bytes, header="${header}", valid=${header.startsWith('%PDF')}`);
    }

    const results: { school: string; status: 'sent' | 'error'; error?: string }[] = [];

    for (const school of schools) {
      if (!school.email) {
        results.push({ school: school.name, status: 'error', error: 'Sem e-mail cadastrado' });
        continue;
      }
      try {
        const result = await resend.emails.send({
          from: `${fromName} <${fromEmail}>`,
          to: [school.email],
          subject: `📋 ${menuTitle} — ${school.name}`,
          html: buildEmailHtml({ schoolName: school.name, menuTitle, menuHtml, senderName: fromName }),
          ...(pdfBuffer && pdfFilename
            ? { attachments: [{ filename: pdfFilename, content: pdfBuffer }] }
            : {}),
        });
        if (result.error) throw new Error(result.error.message);
        results.push({ school: school.name, status: 'sent' });
      } catch (err: any) {
        results.push({ school: school.name, status: 'error', error: err.message });
      }
    }

    const sent = results.filter(r => r.status === 'sent').length;
    res.json({ sent, total: schools.length, results });
  } catch (err: any) {
    console.error('[Email /send-menu error]', err.message);
    res.status(500).json({ error: err.message });
  }
});

function buildEmailHtml({
  schoolName,
  menuTitle,
  menuHtml,
  senderName,
}: {
  schoolName: string;
  menuTitle: string;
  menuHtml: string;
  senderName: string;
}) {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${menuTitle}</title>
</head>
<body style="margin:0;padding:0;background:#f5f7fa;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f7fa;padding:32px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
        <!-- Header -->
        <tr>
          <td style="background:#1B2A4A;padding:28px 32px;text-align:center;">
            <p style="margin:0;font-size:22px;font-weight:800;color:#ffffff;">🥗 EduPlate Menu</p>
            <p style="margin:6px 0 0;font-size:13px;color:rgba(255,255,255,0.5);">Programa Nacional de Alimentação Escolar</p>
          </td>
        </tr>
        <!-- Greeting -->
        <tr>
          <td style="padding:28px 32px 0;">
            <p style="margin:0;font-size:16px;color:#1B2A4A;font-weight:600;">Olá, ${schoolName}!</p>
            <p style="margin:8px 0 0;font-size:14px;color:#6b7280;line-height:1.6;">
              Segue o cardápio <strong>${menuTitle}</strong> enviado pela equipe de nutrição.
            </p>
          </td>
        </tr>
        <!-- Menu content -->
        <tr>
          <td style="padding:24px 32px;">
            <div style="background:#f9fafb;border-radius:8px;border:1px solid #e5e7eb;padding:20px;">
              ${menuHtml || '<p style="color:#6b7280;font-size:14px;">Consulte o cardápio em anexo ou pelo sistema.</p>'}
            </div>
          </td>
        </tr>
        <!-- Footer -->
        <tr>
          <td style="padding:20px 32px 28px;border-top:1px solid #f3f4f6;">
            <p style="margin:0;font-size:12px;color:#9ca3af;text-align:center;">
              Enviado por ${senderName} via EduPlate Menu · <a href="https://eduplate.com.br" style="color:#4CAF50;">eduplate.com.br</a>
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

// ── POST /api/email/welcome ───────────────────────────────────────────────────
// Sends a welcome email after /cadastro account creation.
// Body: { name: string, email: string, plan?: string }
router.post('/welcome', async (req: Request, res: Response) => {
  try {
    const { name, email, plan } = req.body as { name: string; email: string; plan?: string };
    if (!email) return res.status(400).json({ error: 'E-mail obrigatório.' });

    const resend = getResend();
    const fromEmail = process.env.RESEND_FROM || 'onboarding@resend.dev';
    const planLabel: Record<string, string> = {
      essencial: 'EduPlate Menu', pro: 'EduPlate Menu', enterprise: 'EduPlate Menu',
    };

    await resend.emails.send({
      from: `EduPlate Menu <${fromEmail}>`,
      to: [email],
      subject: '✅ Bem-vindo(a) ao EduPlate Menu! Sua conta está pronta.',
      html: buildWelcomeHtml({ name, email, plan: plan ? (planLabel[plan] || plan) : undefined }),
    });

    res.json({ ok: true });
  } catch (err: any) {
    console.error('[Email /welcome error]', err.message);
    res.status(500).json({ error: err.message });
  }
});

function buildWelcomeHtml({ name, email, plan }: { name: string; email: string; plan?: string }) {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/></head>
<body style="margin:0;padding:0;background:#f5f7fa;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f7fa;padding:32px 16px;">
    <tr><td align="center">
      <table width="580" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);">
        <!-- Header verde -->
        <tr>
          <td style="background:#1B2A4A;padding:36px 40px;text-align:center;">
            <p style="margin:0;font-size:26px;font-weight:800;color:#ffffff;letter-spacing:-0.5px;">EduPlate Menu</p>
            <p style="margin:6px 0 0;font-size:12px;color:rgba(255,255,255,0.4);letter-spacing:1px;text-transform:uppercase;">Gestão do PNAE</p>
          </td>
        </tr>
        <!-- Body -->
        <tr>
          <td style="padding:40px 40px 0;">
            <p style="margin:0 0 8px;font-size:22px;font-weight:700;color:#1B2A4A;">Olá, ${name}! 🎉</p>
            <p style="margin:0;font-size:15px;color:#6b7280;line-height:1.7;">
              Sua conta no <strong style="color:#1B2A4A;">EduPlate Menu</strong> foi criada com sucesso.
              ${plan
                ? `Você está no plano <strong style="color:#4CAF50;">${plan}</strong>. Acesso completo liberado!`
                : `Seu período de avaliação gratuita de <strong style="color:#4CAF50;">30 dias</strong> foi ativado! Você não será cobrado durante o trial — explore tudo à vontade e cancele quando quiser.`
              }
            </p>
          </td>
        </tr>
        <!-- Steps -->
        <tr>
          <td style="padding:32px 40px 0;">
            <p style="margin:0 0 16px;font-size:13px;font-weight:700;color:#1B2A4A;text-transform:uppercase;letter-spacing:0.5px;">Por onde começar</p>
            ${[
              ['1', '#4CAF50', 'Cadastre suas escolas', 'Menu Fiscalização → Escolas. Adicione nome, endereço e e-mail de cada unidade.'],
              ['2', '#4CAF50', 'Configure seu perfil e assinatura', 'Em Treinamentos, faça upload da sua assinatura para os certificados.'],
              ['3', '#4CAF50', 'Crie seu primeiro cardápio', 'Menu Alimentação → Cardápios. Publique e envie por e-mail direto para as escolas.'],
            ].map(([n, c, title, desc]) => `
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:14px;">
              <tr>
                <td width="32" valign="top">
                  <div style="width:28px;height:28px;border-radius:50%;background:${c};color:#fff;font-size:13px;font-weight:700;text-align:center;line-height:28px;">${n}</div>
                </td>
                <td style="padding-left:12px;">
                  <p style="margin:0;font-size:14px;font-weight:600;color:#1B2A4A;">${title}</p>
                  <p style="margin:2px 0 0;font-size:13px;color:#9ca3af;">${desc}</p>
                </td>
              </tr>
            </table>`).join('')}
          </td>
        </tr>
        <!-- CTA -->
        <tr>
          <td style="padding:32px 40px;">
            <a href="https://www.eduplate.com.br" style="display:inline-block;background:#4CAF50;color:#fff;font-size:15px;font-weight:700;text-decoration:none;padding:14px 32px;border-radius:12px;">
              Acessar o EduPlate →
            </a>
          </td>
        </tr>
        <!-- Footer -->
        <tr>
          <td style="padding:20px 40px 28px;border-top:1px solid #f3f4f6;">
            <p style="margin:0;font-size:12px;color:#d1d5db;">
              Conta registrada para <strong>${email}</strong> · EduPlate Menu · Avaré — SP<br/>
              Dúvidas? Responda este e-mail ou acesse <a href="https://www.eduplate.com.br" style="color:#4CAF50;">www.eduplate.com.br</a>
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

export default router;
