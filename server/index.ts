import express from "express";
import { createServer } from "http";
import path from "path";
import { fileURLToPath } from "url";
import stripeRouter from "./stripe.js";
import emailRouter from "./email.js";
import aiRouter from "./ai.js";
import { getAdminDb } from "./firebase-admin.js";
import { requireAuth } from "./auth-middleware.js";
import { rateLimit } from "./rate-limit.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Allowed origins for CORS (Firebase Hosting + custom domain)
const ALLOWED_ORIGINS = [
  'https://www.eduplate.com.br',
  'https://eduplate.com.br',
  'https://gestaoescola-e5f3d.web.app',
  'https://gestaoescola-e5f3d.firebaseapp.com',
  'http://localhost:3000',
  'http://localhost:5173',
];

async function startServer() {
  const app = express();
  const server = createServer(app);

  // ── CORS — allow Firebase Hosting frontend to call this API ──────────────
  app.use((req, res, next) => {
    const origin = req.headers.origin || '';
    const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
    res.setHeader('Access-Control-Allow-Origin', allowed);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization,stripe-signature');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    if (req.method === 'OPTIONS') {
      res.status(204).end();
      return;
    }
    next();
  });

  // ── Parse JSON for all API routes except Stripe webhook ─────────────────
  // The webhook MUST receive the raw body for signature verification.
  // All other routes get the JSON parser with a generous 10 MB limit.
  app.use((req, res, next) => {
    if (req.path === '/api/stripe/webhook') return next();
    express.json({ limit: '10mb' })(req, res, next);
  });

  // ── Rate limiting em todas as rotas de API (webhook do Stripe é isento) ──
  app.use('/api', rateLimit);

  // ── Stripe routes ─────────────────────────────────────────────────────────
  app.use('/api/stripe', stripeRouter);

  // ── Email routes (require login — prevents open-relay abuse) ─────────────
  app.use('/api/email', requireAuth, emailRouter);

  // ── AI routes (require login — prevents anonymous credit burn) ───────────
  app.use('/api/ai', requireAuth, aiRouter);

  // ── Org helper routes ─────────────────────────────────────────────────────
  app.post('/api/org/resolve-invite', requireAuth, async (req, res) => {
    try {
      const inviteCode = String(req.body?.inviteCode || '').trim().toUpperCase();
      if (!inviteCode) {
        return res.status(400).json({ error: 'inviteCode é obrigatório.' });
      }

      const snap = await getAdminDb()
        .collection('organizations')
        .where('inviteCode', '==', inviteCode)
        .limit(1)
        .get();

      if (snap.empty) {
        return res.status(404).json({ error: 'Código de convite inválido.' });
      }

      return res.json({ orgId: snap.docs[0].id });
    } catch (err: any) {
      console.error('[resolve-invite]', err.message);
      return res.status(500).json({ error: 'Erro ao validar código de convite.' });
    }
  });

  // ── Unmatched API routes should return JSON, not the SPA shell ───────────
  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'Rota de API não encontrada.' });
  });

  // ── Static files (production build) ──────────────────────────────────────
  const staticPath =
    process.env.NODE_ENV === "production"
      ? path.resolve(__dirname, "public")
      : path.resolve(__dirname, "..", "dist", "public");

  app.use(express.static(staticPath));

  // Handle client-side routing — serve index.html for all non-API routes
  app.get("*", (_req, res) => {
    res.sendFile(path.join(staticPath, "index.html"));
  });

  const port = process.env.PORT || (process.env.NODE_ENV === "production" ? 3000 : 3001);

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
    if (process.env.NODE_ENV !== "production") {
      console.log("  Stripe API routes available at /api/stripe/*");
    }
  });
}

startServer().catch(console.error);
