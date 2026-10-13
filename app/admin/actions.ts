'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createAuthClient, supabaseConfigured } from '@/lib/supabase/server';
import { bookingStatuses, formatDateBR, services, todaySP, type BookingStatus } from '@/lib/data';
import { getTimeSlots, slotOptions } from '@/lib/settings';

export type SignInState = { error: string; email: string };

export async function signIn(_prev: SignInState, formData: FormData): Promise<SignInState> {
  const email = String(formData.get('email') || '').trim(), password = String(formData.get('password') || '');
  if (!supabaseConfigured()) return { error: 'Supabase ainda não configurado (veja o README).', email };
  const supabase = await createAuthClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: 'E-mail ou senha incorretos.', email };
  redirect('/admin');
}

export async function signOut() {
  const supabase = await createAuthClient();
  await supabase.auth.signOut();
  redirect('/admin/login');
}

// A permissão é garantida pelo RLS: só quem está na tabela admins consegue alterar.
export async function setBookingStatus(id: string, status: BookingStatus) {
  if (!bookingStatuses.includes(status)) return;
  const supabase = await createAuthClient();
  const { error } = await supabase.from('bookings').update({ status }).eq('id', id);
  if (error) console.error('setBookingStatus', error);
  revalidatePath('/admin');
}

export type DaysOffState = { error: string; ok: string };
const MAX_DAYS_OFF = 60;

/** Bloqueia um dia ou um período (ex.: férias). Agendamentos já feitos nesses dias não são cancelados. */
export async function addDaysOff(_prev: DaysOffState, formData: FormData): Promise<DaysOffState> {
  const from = String(formData.get('from') || ''), to = String(formData.get('to') || '') || from;
  const reason = String(formData.get('reason') || '').trim().slice(0, 120) || null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) return { error: 'Escolha a data.', ok: '' };
  if (from < todaySP()) return { error: 'Escolha uma data a partir de hoje.', ok: '' };
  if (to < from) return { error: 'A data final precisa ser depois da inicial.', ok: '' };
  const dates: string[] = [];
  for (let d = new Date(from + 'T00:00:00Z'); d <= new Date(to + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + 1)) {
    dates.push(d.toISOString().slice(0, 10));
    if (dates.length > MAX_DAYS_OFF) return { error: `Bloqueie no máximo ${MAX_DAYS_OFF} dias por vez.`, ok: '' };
  }
  const supabase = await createAuthClient();
  const { error } = await supabase.from('blocked_dates')
    .upsert(dates.map((date) => ({ date, reason })), { onConflict: 'date', ignoreDuplicates: true });
  if (error) { console.error('addDaysOff', error); return { error: 'Não foi possível bloquear. Tente novamente.', ok: '' }; }
  const { count } = await supabase.from('bookings').select('id', { count: 'exact', head: true })
    .gte('date', from).lte('date', to).neq('status', 'Cancelado');
  revalidatePath('/admin');
  const what = dates.length === 1 ? `${formatDateBR(from)} bloqueado.` : `${dates.length} dias bloqueados (${formatDateBR(from)} a ${formatDateBR(to)}).`;
  const warn = count ? ` Atenção: ${count === 1 ? 'já existe 1 agendamento' : `já existem ${count} agendamentos`} nesse período. Fale com as clientes e cancele na agenda, se for o caso.` : '';
  return { error: '', ok: what + warn };
}

export async function removeDayOff(date: string) {
  const supabase = await createAuthClient();
  const { error } = await supabase.from('blocked_dates').delete().eq('date', date);
  if (error) console.error('removeDayOff', error);
  revalidatePath('/admin');
}

export type BlockSlotsState = { error: string; ok: string };

/** Bloqueia horários específicos de um dia. Agendamentos já feitos nesses horários não são cancelados. */
export async function addBlockedSlots(_prev: BlockSlotsState, formData: FormData): Promise<BlockSlotsState> {
  const date = String(formData.get('date') || '');
  const timeSlots = await getTimeSlots();
  const times = [...new Set(formData.getAll('times').map(String))].filter((t) => timeSlots.includes(t)).sort();
  const reason = String(formData.get('reason') || '').trim().slice(0, 120) || null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { error: 'Escolha a data.', ok: '' };
  if (date < todaySP()) return { error: 'Escolha uma data a partir de hoje.', ok: '' };
  if (times.length === 0) return { error: 'Marque pelo menos um horário.', ok: '' };
  const supabase = await createAuthClient();
  const { error } = await supabase.from('blocked_slots')
    .upsert(times.map((time) => ({ date, time, reason })), { onConflict: 'date,time', ignoreDuplicates: true });
  if (error) { console.error('addBlockedSlots', error); return { error: 'Não foi possível bloquear. Tente novamente.', ok: '' }; }
  const { count } = await supabase.from('bookings').select('id', { count: 'exact', head: true })
    .eq('date', date).in('time', times).neq('status', 'Cancelado');
  revalidatePath('/admin');
  const what = `${formatDateBR(date)}: ${times.length === 1 ? `${times[0]} bloqueado.` : `${times.join(', ')} bloqueados.`}`;
  const warn = count ? ` Atenção: ${count === 1 ? 'já existe 1 agendamento' : `já existem ${count} agendamentos`} nesse horário. Fale com a cliente e cancele na agenda, se for o caso.` : '';
  return { error: '', ok: what + warn };
}

export async function removeBlockedSlot(date: string, time: string) {
  const supabase = await createAuthClient();
  const { error } = await supabase.from('blocked_slots').delete().eq('date', date).eq('time', time);
  if (error) console.error('removeBlockedSlot', error);
  revalidatePath('/admin');
}

export type SettingsState = { error: string; ok: string };

/** Salva preço, duração e visibilidade de cada serviço. */
export async function saveServices(_prev: SettingsState, formData: FormData): Promise<SettingsState> {
  const rows = services.map((s) => ({
    service_id: s.id,
    price: String(formData.get(`price_${s.id}`) || '').trim().slice(0, 40) || null,
    duration: String(formData.get(`duration_${s.id}`) || '').trim().slice(0, 40) || null,
    active: formData.get(`active_${s.id}`) === 'on',
    updated_at: new Date().toISOString(),
  }));
  if (!rows.some((r) => r.active)) return { error: 'Deixe pelo menos um serviço aparecendo no site.', ok: '' };
  const supabase = await createAuthClient();
  const { error } = await supabase.from('service_settings').upsert(rows, { onConflict: 'service_id' });
  if (error) { console.error('saveServices', error); return { error: 'Não foi possível salvar. Confira se a migração 0005 foi rodada no Supabase.', ok: '' }; }
  revalidatePath('/', 'layout');
  return { error: '', ok: 'Serviços salvos. O site já mostra os novos valores.' };
}

/** Salva os horários de atendimento. Agendamentos já feitos não mudam. */
export async function saveOpeningSlots(_prev: SettingsState, formData: FormData): Promise<SettingsState> {
  const times = [...new Set(formData.getAll('times').map(String))].filter((t) => slotOptions.includes(t)).sort();
  if (times.length === 0) return { error: 'Marque pelo menos um horário.', ok: '' };
  const supabase = await createAuthClient();
  const { error: delError } = await supabase.from('opening_slots').delete().not('time', 'in', `(${times.map((t) => `"${t}"`).join(',')})`);
  const { error } = delError ? { error: delError } : await supabase.from('opening_slots').upsert(times.map((time) => ({ time })), { onConflict: 'time', ignoreDuplicates: true });
  if (error) { console.error('saveOpeningSlots', error); return { error: 'Não foi possível salvar. Confira se a migração 0005 foi rodada no Supabase.', ok: '' }; }
  revalidatePath('/', 'layout');
  return { error: '', ok: `Horários salvos: ${times.join(', ')}.` };
}
