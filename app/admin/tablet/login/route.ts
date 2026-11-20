import {
  checkPin, clearLoginFailures, COOKIE_PATH, createSession, loginBlockedMinutes, recordLoginFailure, sessionCookie, tabletConfigured,
} from '@/lib/tablet/auth';
import { clientIp, html, isHttps, readForm, sameOrigin, seeOther } from '@/lib/tablet/http';
import { loginPage, messagePage } from '@/lib/tablet/view';

export const dynamic = 'force-dynamic';

export async function POST(request: Request): Promise<Response> {
  if (!tabletConfigured()) return html(messagePage('Agenda', 'Painel do tablet desligado.'), 503);
  if (!sameOrigin(request)) return html(loginPage({ error: 'origem' }), 403);

  const ip = clientIp(request);
  const blocked = loginBlockedMinutes(ip);
  if (blocked) return html(loginPage({ error: 'bloqueado', blockedMinutes: blocked }), 429, { 'Retry-After': String(blocked * 60) });

  const form = await readForm(request);
  if (!form || !checkPin(form.get('pin') ?? '')) {
    recordLoginFailure(ip);
    return html(loginPage({ error: 'pin' }), 401);
  }

  clearLoginFailures(ip);
  return seeOther(COOKIE_PATH, { 'Set-Cookie': sessionCookie(createSession(), isHttps(request)) });
}

/** Quem abrir /admin/tablet/login direto vai para o painel (que mostra o PIN se precisar). */
export function GET(): Response {
  return seeOther(COOKIE_PATH);
}
