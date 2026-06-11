/**
 * Stripe API routes for the Sistema PNAE billing system.
 *
 * Required env vars (set in .env / Railway):
 *   STRIPE_SECRET_KEY                   — sk_live_... or sk_test_...
 *   STRIPE_WEBHOOK_SECRET               — whsec_... (from Stripe Dashboard → Webhooks)
 *   STRIPE_PRICE_ESSENCIAL              — price_... (Básico · mensal)
 *   STRIPE_PRICE_ESSENCIAL_SEMESTRAL    — price_... (Básico · semestral R$250)
 *   STRIPE_PRICE_ESSENCIAL_ANUAL        — price_... (Básico · anual R$412)
 *   STRIPE_PRICE_PRO                    — price_... (Essencial · mensal)
 *   STRIPE_PRICE_PRO_SEMESTRAL          — price_... (Essencial · semestral R$505)
 *   STRIPE_PRICE_PRO_ANUAL              — price_... (Essencial · anual R$832)
 *   STRIPE_PRICE_ENTERPRISE             — price_... (Consórcio · mensal)
 *   STRIPE_PRICE_ENTERPRISE_SEMESTRAL   — price_... (Consórcio · semestral R$2035)
 *   STRIPE_PRICE_ENTERPRISE_ANUAL       — price_... (Consórcio · anual R$3352)
 *   APP_URL                             — https://your-domain.com (for redirect URLs)
 */
import express, { Request, Response } from 'express';
import Stripe from 'stripe';
import { randomBytes, randomUUID } from 'crypto';
import { getAdminDb } from './firebase-admin.js';
import { requireAuth, requireOrgMember } from './auth-middleware.js';

// ── Plan definitions (must match Stripe Price IDs in env) ────────────────────

export type BillingPeriod = 'mensal' | 'semestral' | 'anual';

export const PLANS = {
  essencial: {
    name: 'Básico',
    description: '1 município · até 2 usuários',
    priceIds: {
      mensal:    () => process.env.STRIPE_PRICE_ESSENCIAL            || '',
      semestral: () => process.env.STRIPE_PRICE_ESSENCIAL_SEMESTRAL  || '',
      anual:     () => process.env.STRIPE_PRICE_ESSENCIAL_ANUAL      || '',
    },
  },
  pro: {
    name: 'Essencial',
    description: '1 município · usuários ilimitados',
    priceIds: {
      mensal:    () => process.env.STRIPE_PRICE_PRO            || '',
      semestral: () => process.env.STRIPE_PRICE_PRO_SEMESTRAL  || '',
      anual:     () => process.env.STRIPE_PRICE_PRO_ANUAL      || '',
    },
  },
  enterprise: {
    name: 'Consórcio',
    description: 'Municípios ilimitados · onboarding incluso',
    priceIds: {
      mensal:    () => process.env.STRIPE_PRICE_ENTERPRISE            || '',
      semestral: () => process.env.STRIPE_PRICE_ENTERPRISE_SEMESTRAL  || '',
      anual:     () => process.env.STRIPE_PRICE_ENTERPRISE_ANUAL      || '',
    },
  },
} as const;

export type PlanKey = keyof typeof PLANS;

/** Returns the correct Stripe Price ID for a plan + billing period. */
function getPriceId(plan: PlanKey, period: BillingPeriod = 'mensal'): string {
  return PLANS[plan].priceIds[period]();
}

// ── Stripe client (lazy-init so missing key doesn't crash on startup) ─────────

function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error('STRIPE_SECRET_KEY env var is missing.');
  return new Stripe(key, { apiVersion: '2025-02-24.acacia' });
}

// ── Router ────────────────────────────────────────────────────────────────────

const router = express.Router();

// ── POST /api/stripe/checkout-new ────────────────────────────────────────────
// Creates a Stripe Checkout session for a NEW subscriber (no login required).
// Body: { email, plan, period? }
router.post('/checkout-new', async (req: Request, res: Response) => {
  try {
    const { email, plan, period = 'mensal' } = req.body as { email: string; plan: PlanKey; period?: BillingPeriod };
    if (!email || !plan) {
      return res.status(400).json({ error: 'email e plan são obrigatórios.' });
    }
    const planConfig = PLANS[plan];
    if (!planConfig) return res.status(400).json({ error: `Plano inválido: ${plan}` });
    const priceId = getPriceId(plan, period);
    if (!priceId) return res.status(500).json({ error: `Price ID para ${plan}/${period} não configurado.` });

    const stripe = getStripe();
    const db = getAdminDb();
    const appUrl = process.env.APP_URL || 'http://localhost:3000';

    // Generate a provisional org and a one-time setup token
    const orgId = randomUUID();
    const setupToken = randomBytes(24).toString('hex');
    const inviteCode = randomBytes(3).toString('hex').toUpperCase();

    await db.collection('organizations').doc(orgId).set({
      id: orgId,
      ownerEmail: email,
      subscriptionStatus: 'pending_payment',
      plan: null,
      setupToken,
      inviteCode,
      createdAt: new Date(),
      trialEndsAt: null,
    });

    // Create Stripe customer linked to the org
    const customer = await stripe.customers.create({
      email,
      metadata: { orgId, firebaseProjectId: 'gestaoescola-e5f3d' },
    });
    await db.collection('organizations').doc(orgId).set({ stripeCustomerId: customer.id }, { merge: true });

    const session = await stripe.checkout.sessions.create({
      customer: customer.id,
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${appUrl}/cadastro?token=${setupToken}&orgId=${orgId}`,
      cancel_url: `${appUrl}/planos?canceled=1`,
      metadata: { orgId, plan, period, setupToken },
      subscription_data: {
        trial_period_days: 30,       // 1 mês grátis com cartão
        metadata: { orgId, plan, period },
      },
      locale: 'pt-BR',
      billing_address_collection: 'required',
      allow_promotion_codes: true,
      customer_update: { address: 'auto', name: 'auto' },
    });

    res.json({ url: session.url });
  } catch (err: any) {
    console.error('[Stripe /checkout-new error]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/stripe/verify-session?sessionId=XXX&orgId=YYY ──────────────────
// Fallback sync: called by Billing.tsx after returning from Stripe Checkout.
// Verifies the session was paid and updates Firestore if the webhook missed it.
router.get('/verify-session', async (req: Request, res: Response) => {
  try {
    const { sessionId, orgId } = req.query as { sessionId: string; orgId: string };
    if (!sessionId || !orgId) {
      return res.status(400).json({ error: 'sessionId e orgId são obrigatórios.' });
    }

    const stripe = getStripe();
    const db = getAdminDb();

    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (session.payment_status === 'paid' && session.metadata?.orgId === orgId) {
      const plan = (session.metadata?.plan as PlanKey) || 'essencial';
      await db.collection('organizations').doc(orgId).set({
        subscriptionStatus: 'active',
        plan,
        stripeCustomerId: session.customer as string,
        stripeSubscriptionId: session.subscription as string,
        activatedAt: new Date(),
      }, { merge: true });
      console.log(`[Stripe /verify-session] Org ${orgId} synced to active (plan: ${plan})`);
      return res.json({ status: 'active', plan });
    }

    // Session not paid yet — return current org status
    const orgDoc = await db.collection('organizations').doc(orgId).get();
    const data = orgDoc.data() || {};
    return res.json({ status: data.subscriptionStatus || 'unknown', plan: data.plan || null });
  } catch (err: any) {
    console.error('[Stripe /verify-session error]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/stripe/checkout-subscribe ──────────────────────────────────────
// Cria checkout para usuário JÁ CADASTRADO que quer assinar (sem trial).
// Chamado pelo TrialBanner quando o trial está próximo ou expirado.
// Body: { orgId, plan?, period? }
router.post('/checkout-subscribe', requireAuth, requireOrgMember, async (req: Request, res: Response) => {
  try {
    const { orgId, plan = 'essencial', period = 'mensal' } = req.body as { orgId: string; plan?: PlanKey; period?: BillingPeriod };
    if (!orgId) return res.status(400).json({ error: 'orgId é obrigatório.' });

    const planConfig = PLANS[plan as PlanKey];
    if (!planConfig) return res.status(400).json({ error: `Plano inválido: ${plan}` });
    const priceId = getPriceId(plan as PlanKey, period);
    if (!priceId) return res.status(500).json({ error: `Price ID para ${plan}/${period} não configurado.` });

    const stripe = getStripe();
    const db = getAdminDb();
    const appUrl = process.env.APP_URL || 'http://localhost:3000';

    // Busca ou cria Stripe customer para essa org
    const orgDoc = await db.collection('organizations').doc(orgId).get();
    if (!orgDoc.exists) return res.status(404).json({ error: 'Organização não encontrada.' });
    const orgData = orgDoc.data()!;

    let customerId: string = orgData.stripeCustomerId || '';
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: orgData.ownerEmail || '',
        metadata: { orgId, firebaseProjectId: 'gestaoescola-e5f3d' },
      });
      customerId = customer.id;
      await db.collection('organizations').doc(orgId).set({ stripeCustomerId: customerId }, { merge: true });
    }

    // Checkout SEM trial — cobrança imediata na aprovação do cartão
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${appUrl}/assinatura?status=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/planos?canceled=1`,
      metadata: { orgId, plan, period },
      subscription_data: { metadata: { orgId, plan, period } },
      locale: 'pt-BR',
      billing_address_collection: 'auto',
      allow_promotion_codes: true,
    });

    res.json({ url: session.url });
  } catch (err: any) {
    console.error('[Stripe /checkout-subscribe error]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/stripe/setup?token=XXX&orgId=YYY ────────────────────────────────
// Verifies a post-payment setup token and returns org info.
router.get('/setup', async (req: Request, res: Response) => {
  try {
    const { token, orgId } = req.query as { token: string; orgId: string };
    if (!token || !orgId) return res.status(400).json({ error: 'token e orgId são obrigatórios.' });

    const db = getAdminDb();
    const orgDoc = await db.collection('organizations').doc(orgId).get();
    if (!orgDoc.exists) return res.status(404).json({ error: 'Organização não encontrada.' });

    const org = orgDoc.data()!;
    if (org.setupToken !== token) return res.status(403).json({ error: 'Token inválido.' });

    res.json({
      email: org.ownerEmail,
      orgId,
      subscriptionStatus: org.subscriptionStatus,
      plan: org.plan,
    });
  } catch (err: any) {
    console.error('[Stripe /setup error]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/stripe/setup/complete ──────────────────────────────────────────
// Called after account creation. Clears the setupToken from the org.
// Body: { token, orgId }
router.post('/setup/complete', async (req: Request, res: Response) => {
  try {
    const { token, orgId } = req.body as { token: string; orgId: string };
    if (!token || !orgId) return res.status(400).json({ error: 'token e orgId obrigatórios.' });

    const db = getAdminDb();
    const orgDoc = await db.collection('organizations').doc(orgId).get();
    if (!orgDoc.exists) return res.status(404).json({ error: 'Org não encontrada.' });
    if (orgDoc.data()?.setupToken !== token) return res.status(403).json({ error: 'Token inválido.' });

    await db.collection('organizations').doc(orgId).update({ setupToken: null });
    res.json({ ok: true });
  } catch (err: any) {
    console.error('[Stripe /setup/complete error]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/stripe/checkout ─────────────────────────────────────────────────
// Creates a Stripe Checkout session for an EXISTING org (logged-in user).
// Body: { orgId, plan, period?, userId, userEmail, orgName }
router.post('/checkout', requireAuth, requireOrgMember, async (req: Request, res: Response) => {
  try {
    const { orgId, plan, period = 'mensal', userId, userEmail, orgName } = req.body as {
      orgId: string;
      plan: PlanKey;
      period?: BillingPeriod;
      userId: string;
      userEmail: string;
      orgName?: string;
    };

    if (!orgId || !plan || !userId || !userEmail) {
      return res.status(400).json({ error: 'orgId, plan, userId e userEmail são obrigatórios.' });
    }

    const planConfig = PLANS[plan];
    if (!planConfig) {
      return res.status(400).json({ error: `Plano inválido: ${plan}` });
    }

    const priceId = getPriceId(plan, period);
    if (!priceId) {
      return res.status(500).json({
        error: `Price ID para ${plan}/${period} não configurado.`
      });
    }

    const stripe = getStripe();
    const appUrl = process.env.APP_URL || 'http://localhost:3000';

    // Check if this org already has a Stripe customer ID
    const db = getAdminDb();
    const orgDoc = await db.collection('organizations').doc(orgId).get();
    const orgData = orgDoc.data() || {};
    let customerId: string | undefined = orgData.stripeCustomerId;

    // Create or reuse Stripe customer
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: userEmail,
        name: orgName || orgId,
        metadata: { orgId, userId, firebaseProjectId: 'gestaoescola-e5f3d' },
      });
      customerId = customer.id;
      // Save customer ID — use set+merge so it works even if doc doesn't exist yet
      await db.collection('organizations').doc(orgId).set(
        { stripeCustomerId: customerId },
        { merge: true }
      );
    }

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${appUrl}/billing?session_id={CHECKOUT_SESSION_ID}&status=success`,
      cancel_url: `${appUrl}/planos?canceled=1`,
      metadata: { orgId, userId, plan, period },
      subscription_data: {
        trial_period_days: 30,       // 1 mês grátis com cartão
        metadata: { orgId, userId, plan, period },
      },
      locale: 'pt-BR',
      allow_promotion_codes: true,
      billing_address_collection: 'required',
      customer_update: {
        address: 'auto',
        name: 'auto',
      },
    });

    res.json({ url: session.url });
  } catch (err: any) {
    console.error('[Stripe /checkout error]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/stripe/portal ───────────────────────────────────────────────────
// Creates a Stripe Customer Portal session for subscription management.
// Body: { orgId }
router.post('/portal', requireAuth, requireOrgMember, async (req: Request, res: Response) => {
  try {
    const { orgId } = req.body as { orgId: string };
    if (!orgId) return res.status(400).json({ error: 'orgId é obrigatório.' });

    const db = getAdminDb();
    const orgDoc = await db.collection('organizations').doc(orgId).get();
    const customerId = orgDoc.data()?.stripeCustomerId;

    if (!customerId) {
      return res.status(404).json({ error: 'Nenhuma assinatura Stripe encontrada para esta organização.' });
    }

    const stripe = getStripe();
    const appUrl = process.env.APP_URL || 'http://localhost:3000';

    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${appUrl}/billing`,
    });

    res.json({ url: session.url });
  } catch (err: any) {
    console.error('[Stripe /portal error]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/stripe/webhook ─────────────────────────────────────────────────
// Receives and processes Stripe webhook events.
// IMPORTANT: This route must receive the raw body (not JSON-parsed).
router.post('/webhook', express.raw({ type: 'application/json' }), async (req: Request, res: Response) => {
  const sig = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    console.error('[Stripe webhook] STRIPE_WEBHOOK_SECRET not set.');
    return res.status(500).send('Webhook secret not configured.');
  }

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(req.body, sig as string, webhookSecret);
  } catch (err: any) {
    console.error('[Stripe webhook] Signature verification failed:', err.message);
    return res.status(400).send(`Webhook error: ${err.message}`);
  }

  const db = getAdminDb();

  try {
    switch (event.type) {

      // ── Checkout completed → ativa assinatura (com ou sem trial) ─────────────
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const orgId = session.metadata?.orgId;
        const plan = session.metadata?.plan as PlanKey | undefined;
        if (!orgId) break;

        // Retrieve subscription to check if it's in trial
        let subscriptionStatus: string = 'active';
        let trialEndsAt: Date | null = null;
        if (session.subscription) {
          try {
            const sub = await getStripe().subscriptions.retrieve(session.subscription as string);
            if (sub.status === 'trialing') {
              subscriptionStatus = 'trial';
              trialEndsAt = sub.trial_end ? new Date(sub.trial_end * 1000) : null;
            }
          } catch (_) { /* se falhar, mantém 'active' */ }
        }

        await db.collection('organizations').doc(orgId).set({
          subscriptionStatus,
          plan: plan || 'essencial',
          stripeCustomerId: session.customer as string,
          stripeSubscriptionId: session.subscription as string,
          activatedAt: new Date(),
          ...(trialEndsAt ? { trialEndsAt } : {}),
        }, { merge: true });
        console.log(`[Stripe] Org ${orgId} → ${subscriptionStatus} (plan: ${plan})`);
        break;
      }

      // ── Subscription updated (upgrade/downgrade/trial→ativo) ─────────────
      case 'customer.subscription.updated': {
        const sub = event.data.object as Stripe.Subscription;
        const orgId = sub.metadata?.orgId;
        if (!orgId) break;

        const status = sub.status === 'active' ? 'active'
          : sub.status === 'past_due' ? 'past_due'
          : sub.status === 'trialing' ? 'trial'
          : 'canceled';

        const trialEndsAt = sub.trial_end ? new Date(sub.trial_end * 1000) : null;

        await db.collection('organizations').doc(orgId).update({
          subscriptionStatus: status,
          stripeSubscriptionId: sub.id,
          ...(trialEndsAt ? { trialEndsAt } : {}),
        });
        console.log(`[Stripe] Org ${orgId} subscription updated to ${status}`);
        break;
      }

      // ── Subscription canceled ─────────────────────────────────────────────
      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription;
        const orgId = sub.metadata?.orgId;
        if (!orgId) break;

        await db.collection('organizations').doc(orgId).update({
          subscriptionStatus: 'canceled',
        });
        console.log(`[Stripe] Org ${orgId} subscription canceled`);
        break;
      }

      // ── Payment failed ─────────────────────────────────────────────────────
      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = invoice.customer as string;

        // Look up org by stripeCustomerId
        const snap = await db.collection('organizations')
          .where('stripeCustomerId', '==', customerId)
          .limit(1)
          .get();

        if (!snap.empty) {
          await snap.docs[0].ref.update({ subscriptionStatus: 'past_due' });
          console.log(`[Stripe] Org ${snap.docs[0].id} payment failed → past_due`);
        }
        break;
      }

      default:
        // Unhandled event type — ignore
        break;
    }
  } catch (err: any) {
    console.error(`[Stripe webhook] Error processing ${event.type}:`, err.message);
    return res.status(500).send('Webhook processing error.');
  }

  res.json({ received: true });
});

export default router;
