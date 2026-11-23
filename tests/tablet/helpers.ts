import type { BookingStatus } from '@/lib/data';
import { SESSION_COOKIE, createSession, csrfToken } from '@/lib/tablet/auth';
import type { DayFlags, TabletBooking, TabletRepo, TransitionResult } from '@/lib/tablet/repo';

export const PIN = '482913';
export const BASE = 'http://192.168.0.10:3000';

export function setEnv() {
  process.env.TABLET_PIN = PIN;
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://supabase.invalid';
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-de-teste';
}

export const ID = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

export function booking(n: number, time: string, status: BookingStatus, extra: Partial<TabletBooking> = {}): TabletBooking {
  return {
    id: ID(n), service_id: 'nago', service_name: null, notes: null, promo_title: null, date: '2026-11-20', time, name: `Cliente ${n}`, phone: `1199999000${n}`,
    email: null, status, duration_minutes: 60, reminder_sent_at: null, ...extra,
  };
}

/** Repositório em memória no lugar do Supabase. Imita a trava de sobreposição do banco. */
export function memoryRepo(rows: TabletBooking[], flags: DayFlags = { dayOff: false, blockedTimes: [] }) {
  const calls: string[] = [];
  const repo: TabletRepo = {
    async listDay(date) { calls.push(`listDay ${date}`); return rows.filter((r) => r.date === date).sort((a, b) => a.time.localeCompare(b.time)).map((r) => ({ ...r })); },
    async dayFlags() { return flags; },
    async get(id) { const r = rows.find((x) => x.id === id); return r ? { ...r } : null; },
    async transition(id, from, to): Promise<TransitionResult> {
      calls.push(`transition ${id} ${to}`);
      const r = rows.find((x) => x.id === id);
      if (!r || !from.includes(r.status)) return 'unchanged';
      const reactivating = r.status === 'Cancelado' && to !== 'Cancelado';
      if (reactivating && rows.some((o) => o.id !== r.id && o.date === r.date && o.time === r.time && o.status !== 'Cancelado')) return 'conflict';
      r.status = to;
      return 'changed';
    },
    async markReminderSent(id, at) { const r = rows.find((x) => x.id === id); if (r) r.reminder_sent_at = at; },
  };
  return { repo, rows, calls, find: (n: number) => rows.find((r) => r.id === ID(n))! };
}

export const session = () => createSession();
export const cookieHeader = (s: string) => `${SESSION_COOKIE}=${s}`;

export function get(path: string, sessionValue?: string, headers: Record<string, string> = {}): Request {
  return new Request(BASE + path, { headers: { host: '192.168.0.10:3000', ...(sessionValue ? { cookie: cookieHeader(sessionValue) } : {}), ...headers } });
}

export function post(path: string, fields: Record<string, string>, sessionValue?: string, headers: Record<string, string> = {}): Request {
  return new Request(BASE + path, {
    method: 'POST',
    headers: {
      host: '192.168.0.10:3000', 'content-type': 'application/x-www-form-urlencoded',
      ...(sessionValue ? { cookie: cookieHeader(sessionValue) } : {}), ...headers,
    },
    body: new URLSearchParams(fields).toString(),
  });
}

/** Campos de um formulário de ação válido (com o token CSRF da sessão). */
export const actionFields = (s: string, n: number, acao: string, data = '2026-11-20') => ({ csrf: csrfToken(s), id: ID(n), acao, data });
