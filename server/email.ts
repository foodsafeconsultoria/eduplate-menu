/**
 * Email routes — powered by Resend.
 * Required env var: RESEND_API_KEY
 * Optional: RESEND_FROM (defaults to onboarding@resend.dev for testing)
 */
import express, { Request, Response } from 'express';
import { Resend } from 'resend';

const router = express.Router();

function getResend() {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error('RESEND_API_KEY não configurada.');
  return new Resend(key);
}

// ── POST /api/email/send-menu ─────────────────────────────────────────────────
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
    console.log(`[Email /send-menu] PDF base64 length: ${pdfBase64?.length ?? 0} chars, filename: ${pdfFilename ?? 'none'}`);

    const resend = getResend();
    const fromName = senderName || 'EduPlate Menu';
    const fromEmail = process.env.RESEND_FROM || 'onboarding@resend.dev';

    const results: { school: string; status: 'sent' | 'error'; error?: string }[] = [];

    for (const school of schools) {
      if (!school.email) {
        results.push({ school: school.name, status: 'error', error: 'Sem e-mail cadastrado' });
        continue;
      }
      try {
        await resend.emails.send({
          from: `${fromName} <${fromEmail}>`,
          to: [school.email],
          subject: `📋 ${menuTitle} — ${school.name}`,
          html: buildEmailHtml({ schoolName: school.name, menuTitle, menuHtml, senderName: fromName }),
          ...(pdfBase64 && pdfFilename
            ? { attachments: [{ filename: pdfFilename, content: Buffer.from(pdfBase64, 'base64') }] }
            : {}),
        });
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
      essencial: 'Básico', pro: 'Profissional', enterprise: 'Consórcio',
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
                : `Seu período de avaliação gratuita de <strong style="color:#4CAF50;">3 meses</strong> foi ativado! Você não será cobrado por 3 meses — explore tudo à vontade e cancele quando quiser.`
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
