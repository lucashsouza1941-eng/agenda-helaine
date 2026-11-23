import { createHash, createHmac, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';
import { createServiceClient, supabaseConfigured } from '@/lib/supabase/server';
import { isMissingTable } from '@/lib/settings';
import type { Client } from '@/lib/cliente/rules';

// Sessão da cliente: um cookie assinado com o id dela. Só o servidor lê (HttpOnly).
// Vale por 180 dias no aparelho em que ela se cadastrou ou entrou.

export const CLIENT_COOKIE = 'cliente';
export const CLIENT_SESSION_SECONDS = 60 * 60 * 24 * 180;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// A chave vem da service role key: sem ela ninguém forja um cookie.
const secret = () => createHash('sha256').update(`cliente|${process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''}`).digest();
const sign = (text: string) => createHmac('sha256', secret()).update(text).digest('hex');
const safeEqual = (a: string, b: string) => timingSafeEqual(createHash('sha256').update(a).digest(), createHash('sha256').update(b).digest());

/** Valor do cookie: "<id>.<expira em segundos>.<assinatura>". */
export function createClientToken(clientId: string, now = Date.now()): string {
  const expires = Math.floor(now / 1000) + CLIENT_SESSION_SECONDS;
  return `${clientId}.${expires}.${sign(`${clientId}|${expires}`)}`;
}

/** Id da cliente de um cookie válido, ou null (forjado, adulterado ou vencido). */
export function readClientToken(token: string | undefined | null, now = Date.now()): string | null {
  if (!token || token.length > 200 || !process.env.SUPABASE_SERVICE_ROLE_KEY) return null;
  const [id, expires, signature, ...rest] = token.split('.');
  if (rest.length || !UUID.test(id ?? '') || !/^\d{1,12}$/.test(expires ?? '') || !signature) return null;
  if (Number(expires) * 1000 < now) return null;
  return safeEqual(signature, sign(`${id}|${expires}`)) ? id : null;
}

/* ---------- Senha de 4 números ---------- */

/** Guarda a senha embaralhada com scrypt e um sal por cliente: "scrypt$<sal>$<hash>". */
export function hashPin(pin: string): string {
  const salt = randomBytes(16).toString('hex');
  return `scrypt$${salt}$${scryptSync(pin, salt, 32).toString('hex')}`;
}

export function verifyPin(pin: string, stored: string | null): boolean {
  const [scheme, salt, hash] = (stored ?? '').split('$');
  if (scheme !== 'scrypt' || !salt || !hash) return false;
  return safeEqual(scryptSync(pin, salt, 32).toString('hex'), hash);
}

/* ---------- Cookie ---------- */

/** Só o primeiro nome, para o site dizer "Olá, Maria". Não dá acesso a nada. */
export const CLIENT_NAME_COOKIE = 'cliente_nome';

export async function setClientCookie(clientId: string, name: string) {
  const jar = await cookies();
  const base = { sameSite: 'lax' as const, path: '/', maxAge: CLIENT_SESSION_SECONDS, secure: process.env.NODE_ENV === 'production' };
  jar.set(CLIENT_COOKIE, createClientToken(clientId), { ...base, httpOnly: true });
  jar.set(CLIENT_NAME_COOKIE, name.split(' ')[0].slice(0, 30), base);
}

export async function clearClientCookie() {
  const jar = await cookies();
  jar.delete(CLIENT_COOKIE);
  jar.delete(CLIENT_NAME_COOKIE);
}

export type ClientRow = { id: string; name: string; phone: string; email: string; pin_hash: string | null; failed_logins: number; locked_until: string | null };
export const CLIENT_COLUMNS = 'id, name, phone, email, pin_hash, failed_logins, locked_until';
export const toClient = (r: ClientRow): Client => ({ id: r.id, name: r.name, phone: r.phone, email: r.email, hasPin: Boolean(r.pin_hash) });

/** A cliente logada neste aparelho, ou null. Sem a migração 0011 ninguém está logado. */
export async function getCurrentClient(): Promise<Client | null> {
  if (!supabaseConfigured()) return null;
  const id = readClientToken((await cookies()).get(CLIENT_COOKIE)?.value);
  if (!id) return null;
  const { data, error } = await createServiceClient().from('clients').select(CLIENT_COLUMNS).eq('id', id).returns<ClientRow[]>().maybeSingle();
  if (error) { if (!isMissingTable(error)) console.error('getCurrentClient', error); return null; }
  return data ? toClient(data) : null;
}
