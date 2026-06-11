/**
 * Auth middleware — verifies the Firebase ID token sent by the client
 * in the Authorization header ("Bearer <token>").
 *
 * Protects API routes from anonymous abuse:
 *   - /api/email/*  (open relay risk — anyone could send emails from our domain)
 *   - /api/ai/*     (burns Anthropic credits)
 *   - /api/stripe/portal, /checkout, /checkout-subscribe (IDOR via orgId)
 *
 * Usage:
 *   router.post('/portal', requireAuth, handler)
 *   // inside handler: (req as AuthedRequest).uid
 *
 * requireOrgMember additionally checks that the authenticated user belongs
 * to the org referenced in req.body.orgId (or req.query.orgId).
 */
import { Request, Response, NextFunction } from 'express';
import { getAdminAuth, getAdminDb } from './firebase-admin.js';

export interface AuthedRequest extends Request {
  uid?: string;
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : '';
    if (!token) {
      return res.status(401).json({ error: 'Não autenticado. Faça login novamente.' });
    }
    const decoded = await getAdminAuth().verifyIdToken(token);
    (req as AuthedRequest).uid = decoded.uid;
    next();
  } catch {
    return res.status(401).json({ error: 'Sessão expirada. Faça login novamente.' });
  }
}

/**
 * Must run AFTER requireAuth. Confirms the caller's user document points to
 * the same organizationId as the one in the request (body or query).
 */
export async function requireOrgMember(req: Request, res: Response, next: NextFunction) {
  try {
    const uid = (req as AuthedRequest).uid;
    if (!uid) return res.status(401).json({ error: 'Não autenticado.' });

    const orgId = (req.body?.orgId || req.query?.orgId) as string | undefined;
    if (!orgId) return res.status(400).json({ error: 'orgId é obrigatório.' });

    const userDoc = await getAdminDb().collection('users').doc(uid).get();
    const userOrgId = userDoc.data()?.organizationId;
    if (userOrgId !== orgId) {
      return res.status(403).json({ error: 'Você não tem permissão para acessar esta organização.' });
    }
    next();
  } catch (err: any) {
    console.error('[requireOrgMember]', err.message);
    return res.status(500).json({ error: 'Erro ao validar permissões.' });
  }
}
