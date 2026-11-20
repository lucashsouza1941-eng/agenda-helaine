import { createServiceClient } from '@/lib/supabase/server';
import { isMissingColumn } from '@/lib/settings';
import type { BookingStatus } from '@/lib/data';

export type TabletBooking = {
  id: string; service_id: string; date: string; time: string; name: string; phone: string; email: string | null;
  status: BookingStatus; duration_minutes: number | null; reminder_sent_at: string | null;
};

export type DayFlags = { dayOff: boolean; blockedTimes: string[] };

/** 'changed': mudou. 'unchanged': o status atual não permitia. 'conflict': outro atendimento ocupa o horário. */
export type TransitionResult = 'changed' | 'unchanged' | 'conflict';

/** Tudo o que a sessão do tablet pode fazer no banco. Nada além disto. */
export interface TabletRepo {
  listDay(date: string): Promise<TabletBooking[]>;
  dayFlags(date: string): Promise<DayFlags>;
  get(id: string): Promise<TabletBooking | null>;
  /** Troca o status só se o atual estiver em `from` (uma operação só, sem corrida). */
  transition(id: string, from: BookingStatus[], to: BookingStatus): Promise<TransitionResult>;
  markReminderSent(id: string, at: string): Promise<void>;
}

/** Falha que o painel sabe explicar (o código vira uma mensagem na tela). */
export class TabletError extends Error {
  constructor(public code: 'banco' | 'migracao') { super(code); }
}

const COLUMNS = 'id, service_id, date, time, name, phone, email, status, duration_minutes';
type Row = Omit<TabletBooking, 'reminder_sent_at' | 'duration_minutes'> & { duration_minutes?: number | null; reminder_sent_at?: string | null };
const toBooking = (r: Row): TabletBooking => ({ ...r, duration_minutes: r.duration_minutes ?? null, reminder_sent_at: r.reminder_sent_at ?? null });

function fail(where: string, error: { code?: string; message?: string }): never {
  console.error(`tablet ${where}`, error);
  throw new TabletError(isMissingColumn(error) || error.code === '23514' ? 'migracao' : 'banco');
}

export const supabaseTabletRepo: TabletRepo = {
  async listDay(date) {
    const supabase = createServiceClient();
    const query = (cols: string) => supabase.from('bookings').select(cols).eq('date', date).order('time').returns<Row[]>();
    let { data, error } = await query(`${COLUMNS}, reminder_sent_at`);
    // Antes da migração 0007 a coluna do lembrete não existe: lista sem ela.
    if (error && isMissingColumn(error)) ({ data, error } = await query(COLUMNS));
    if (error || !data) fail('listDay', error ?? {});
    return data.map(toBooking);
  },

  async dayFlags(date) {
    const supabase = createServiceClient();
    const [off, slots] = await Promise.all([
      supabase.from('blocked_dates').select('date').eq('date', date).maybeSingle(),
      supabase.from('blocked_slots').select('time').eq('date', date),
    ]);
    // Só enfeita a lista: se falhar, o painel continua funcionando sem os avisos.
    if (off.error || slots.error) console.error('tablet dayFlags', off.error ?? slots.error);
    return { dayOff: Boolean(off.data), blockedTimes: (slots.data ?? []).map((r) => r.time) };
  },

  async get(id) {
    const supabase = createServiceClient();
    const query = (cols: string) => supabase.from('bookings').select(cols).eq('id', id).returns<Row[]>().maybeSingle();
    let { data, error } = await query(`${COLUMNS}, reminder_sent_at`);
    if (error && isMissingColumn(error)) ({ data, error } = await query(COLUMNS));
    if (error) fail('get', error);
    return data ? toBooking(data) : null;
  },

  async transition(id, from, to) {
    const { data, error } = await createServiceClient()
      .from('bookings').update({ status: to }).eq('id', id).in('status', from).select('id');
    if (error) {
      // Trigger da migração 0006: reabrir um cancelado em cima de outro atendimento.
      if (error.code === 'P0001' && (error.message === 'horario_ocupado' || error.message === 'horario_bloqueado')) return 'conflict';
      fail('transition', error);
    }
    return data && data.length > 0 ? 'changed' : 'unchanged';
  },

  async markReminderSent(id, at) {
    const { error } = await createServiceClient().from('bookings').update({ reminder_sent_at: at }).eq('id', id);
    if (error) fail('markReminderSent', error);
  },
};

let override: TabletRepo | null = null;
export const tabletRepo = (): TabletRepo => override ?? supabaseTabletRepo;
/** Só para os testes: troca o banco por um repositório em memória. */
export function setTabletRepoForTests(repo: TabletRepo | null) { override = repo; }
