/**
 * Stripe API routes for the Sistema PNAE billing system.
 *
 * Required env vars (set in .env):
 *   STRIPE_SECRET_KEY         — sk_live_... or sk_test_...
 *   STRIPE_WEBHOOK_SECRET     — whsec_... (from Stripe Dashboard → Webhooks)
 *   STRIPE_PRICE_ESSENCIAL    — price_... (Stripe Price ID for Essencial plan)
 *   STRIPE_PRICE_PRO          — price_... (Stripe Price ID for Pro plan)
 *   STRIPE_PRICE_ENTERPRISE   — price_... (Stripe Price ID for Enterprise plan)
 *   APP_URL                   — https://your-domain.com (for redirect URLs)
 */
import express, { Request, Response } from 'express';
import Stripe from 'stripe';
import { randomBytes, randomUUID } from 'crypto';
import { getAdminDb } from './firebase-admin.js';

// ── Plan definitions (must match Stripe Price IDs in env) ────────────────────

export const PLANS = {
  essencial: {
    name: 'Básico',
    priceId: () => process.env.STRIPE_PRICE_ESSENCIAL || '',
    description: '1 município · até 2 usuários',
    amount: 4990, // R$ 49,90 in centavos
  },
  pro: {
    name: 'Profissional',
    priceId: () => process.env.STRIPE_PRICE_PRO || '',
    description: '1 município · usuários ilimitados',
    amount: 9900, // R$ 99,00 in centavos
  },
  enterprise: {
    name: 'Consórcio',
    priceId: () => process.env.STRIPE_PRICE_ENTERPRISE || '',
    description: 'Municípios ilimitados · onboarding incluso',
    amount: 39900, // R$ 399,00 in centavos
  },
} as const;

export type PlanKey = keyof typeof PLANS;

// ── Stripe client (lazy-init so missing key doesn't crash on startup) ─────────

function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error('STRIPE_SECRET_KEY env var is missing.');
  return new Stripe(key, { apiVersion: '2025-04-30.basil' });
}

// ── Router ────────────────────────────────────────────────────────────────────

const router = express.Router();

// ── POST /api/stripe/checkout-new ────────────────────────────────────────────
// Creates a Stripe Checkout session for a NEW subscriber (no login required).
// Body: { email, plan }
router.post('/checkout-new', async (req: Request, res: Response) => {
  try {
    const { email, plan } = req.body as { email: string; plan: PlanKey };
    if (!email || !plan) {
      return res.status(400).json({ error: 'email e plan são obrigatórios.' });
    }
    const planConfig = PLANS[plan];
    if (!planConfig) return res.status(400).json({ error: `Plano inválido: ${plan}` });
    const priceId = planConfig.priceId();
    if (!priceId) return res.status(500).json({ error: `STRIPE_PRICE_${plan.toUpperCase()} não configurado.` });

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
      metadata: { orgId, plan, setupToken },
      subscription_data: { metadata: { orgId, plan } },
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
// Body: { orgId, plan, userId, userEmail, orgName }
router.post('/checkout', async (req: Request, res: Response) => {
  try {
    const { orgId, plan, userId, userEmail, orgName } = req.body as {
      orgId: string;
      plan: PlanKey;
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

    const priceId = planConfig.priceId();
    if (!priceId) {
      return res.status(500).json({
        error: `Stripe Price ID para o plano "${plan}" não configurado (STRIPE_PRICE_${plan.toUpperCase()}).`
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
      metadata: { orgId, userId, plan },
      subscription_data: {
        metadata: { orgId, userId, plan },
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
router.post('/portal', async (req: Request, res: Response) => {
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

      // ── Payment succeeded → activate subscription ──────────────────────────
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const orgId = session.metadata?.orgId;
        const plan = session.metadata?.plan as PlanKey | undefined;
        if (!orgId) break;

        await db.collection('organizations').doc(orgId).update({
          subscriptionStatus: 'active',
          plan: plan || 'essencial',
          stripeCustomerId: session.customer as string,
          stripeSubscriptionId: session.subscription as string,
          activatedAt: new Date(),
          // Keep setupToken — cleared after account creation in /cadastro
        });
        console.log(`[Stripe] Org ${orgId} activated on plan ${plan}`);
        break;
      }

      // ── Subscription updated (upgrade/downgrade/renewal) ──────────────────
      case 'customer.subscription.updated': {
        const sub = event.data.object as Stripe.Subscription;
        const orgId = sub.metadata?.orgId;
        if (!orgId) break;

        const status = sub.status === 'active' ? 'active'
          : sub.status === 'past_due' ? 'past_due'
          : sub.status === 'trialing' ? 'trial'
          : 'canceled';

        await db.collection('organizations').doc(orgId).update({
          subscriptionStatus: status,
          stripeSubscriptionId: sub.id,
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
