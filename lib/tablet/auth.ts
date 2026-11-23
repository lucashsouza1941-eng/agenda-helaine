import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

// Acesso do tablet: um PIN (TABLET_PIN) troca por um cookie de sessão longa,
// válido só em /admin/tablet. Essa sessão não é um login de admin: ela só
// lista o dia e executa as ações do painel do tablet.

export const SESSION_COOKIE = 'tablet_session';
export const COOKIE_PATH = '/admin/tablet';
export const SESSION_SECONDS = 60 * 60 * 24 * 365;
const MIN_PIN_LENGTH = 4;

const pin = () => (process.env.TABLET_PIN ?? '').trim();

/** Sem TABLET_PIN (ou com PIN curto demais) o painel do tablet fica desligado. */
export const tabletConfigured = () => pin().length >= MIN_PIN_LENGTH;

// Trocar o PIN invalida todas as sessões. A service role key entra na chave para
// que saber só o PIN não baste para forjar um cookie.
const secret = () => createHash('sha256').update(`tablet|${pin()}|${process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''}`).digest();
const sign = (text: string) => createHmac('sha256', secret()).update(text).digest('hex');

function safeEqual(a: string, b: string): boolean {
  const x = createHash('sha256').update(a).digest(), y = createHash('sha256').update(b).digest();
  return timingSafeEqual(x, y);
}

export function checkPin(candidate: string): boolean {
  return tabletConfigured() && candidate.length <= 64 && safeEqual(candidate.trim(), pin());
}

/** Valor do cookie: "<expira em segundos>.<assinatura>". */
export function createSession(now = Date.now()): string {
  const expires = Math.floor(now / 1000) + SESSION_SECONDS;
  return `${expires}.${sign(`session|${expires}`)}`;
}

export function validSession(token: string | undefined | null, now = Date.now()): boolean {
  if (!tabletConfigured() || !token || token.length > 200) return false;
  const [expires, signature, ...rest] = token.split('.');
  if (!/^\d{1,12}$/.test(expires ?? '') || !signature || rest.length) return false;
  if (Number(expires) * 1000 < now) return false;
  return safeEqual(signature, sign(`session|${expires}`));
}

/** Token anti-CSRF preso à sessão: vai num campo hidden de cada formulário. */
export const csrfToken = (session: string) => sign(`csrf|${session}`).slice(0, 40);

export function validCsrf(session: string, token: string | undefined | null): boolean {
  return Boolean(token) && token!.length <= 80 && safeEqual(token!, csrfToken(session));
}

export function sessionCookie(value: string, secure: boolean, maxAge = SESSION_SECONDS): string {
  // Sem "Secure" em HTTP: o iPad antigo acessa pela rede local, sem HTTPS.
  return `${SESSION_COOKIE}=${value}; Path=${COOKIE_PATH}; Max-Age=${maxAge}; HttpOnly; SameSite=Lax${secure ? '; Secure' : ''}`;
}

/* ---------- Limite de tentativas de PIN (em memória, por processo) ---------- */

const WINDOW_MS = 10 * 60 * 1000;
export const MAX_FAILS_PER_IP = 5;
/** Teto geral: o IP pode ser forjado na rede local, então também há um limite somando todos. */
export const MAX_FAILS_TOTAL = 20;
const fails = new Map<string, number[]>();
const GLOBAL = '*';

const recent = (key: string, now: number) => (fails.get(key) ?? []).filter((t) => now - t < WINDOW_MS);

/** Minutos que faltam para poder tentar de novo (0 = liberado). */
export function loginBlockedMinutes(ip: string, now = Date.now()): number {
  const mine = recent(ip, now), all = recent(GLOBAL, now);
  const oldest = mine.length >= MAX_FAILS_PER_IP ? mine[0] : all.length >= MAX_FAILS_TOTAL ? all[0] : null;
  return oldest === null ? 0 : Math.max(1, Math.ceil((oldest + WINDOW_MS - now) / 60000));
}

export function recordLoginFailure(ip: string, now = Date.now()) {
  for (const key of [ip, GLOBAL]) fails.set(key, [...recent(key, now), now]);
  // Não deixa o mapa crescer sem limite com IPs que nunca mais voltam.
  if (fails.size > 500) for (const key of fails.keys()) if (recent(key, now).length === 0) fails.delete(key);
}

export function clearLoginFailures(ip: string) {
  fails.delete(ip);
}

export function resetLoginLimiterForTests() {
  fails.clear();
}
