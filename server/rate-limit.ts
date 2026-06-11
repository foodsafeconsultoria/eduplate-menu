/**
 * Rate limiting simples em memória (sliding window por IP).
 * Sem dependências externas — adequado para instância única no Railway.
 *
 * Limites:
 *   - Geral (/api/*): 120 requisições/minuto por IP
 *   - Webhook do Stripe é isento (o Stripe controla o próprio retry)
 */
import { Request, Response, NextFunction } from 'express';

const WINDOW_MS = 60_000;   // 1 minuto
const MAX_REQUESTS = 120;   // por IP por janela

const hits = new Map<string, number[]>();

// Limpeza periódica para não crescer indefinidamente
setInterval(() => {
  const cutoff = Date.now() - WINDOW_MS;
  hits.forEach((times, ip) => {
    const recent = times.filter((t) => t > cutoff);
    if (recent.length === 0) hits.delete(ip);
    else hits.set(ip, recent);
  });
}, 5 * 60_000).unref();

function clientIp(req: Request): string {
  // Railway/proxies definem x-forwarded-for; o primeiro IP é o do cliente
  const fwd = req.headers['x-forwarded-for'];
  if (typeof fwd === 'string' && fwd.length > 0) return fwd.split(',')[0].trim();
  return req.socket.remoteAddress || 'unknown';
}

export function rateLimit(req: Request, res: Response, next: NextFunction) {
  // Stripe webhook é isento — assinado e com retry próprio
  if (req.path === '/stripe/webhook' || req.originalUrl === '/api/stripe/webhook') {
    return next();
  }

  const ip = clientIp(req);
  const now = Date.now();
  const recent = (hits.get(ip) || []).filter((t) => now - t < WINDOW_MS);

  if (recent.length >= MAX_REQUESTS) {
    res.setHeader('Retry-After', Math.ceil(WINDOW_MS / 1000));
    return res.status(429).json({ error: 'Muitas requisições. Aguarde um instante e tente novamente.' });
  }

  recent.push(now);
  hits.set(ip, recent);
  next();
}
