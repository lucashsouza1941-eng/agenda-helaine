'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createAuthClient, supabaseConfigured } from '@/lib/supabase/server';
import { bookingStatuses, CATEGORY_LABELS, formatDateBR, MAX_SERVICE_MINUTES, MIN_SERVICE_MINUTES, slugify, todaySP, type BookingStatus, type ServiceCategory } from '@/lib/data';
import { closingOptions, getTimeSlots, slotOptions } from '@/lib/settings';

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

const CATEGORIES = Object.keys(CATEGORY_LABELS) as ServiceCategory[];
const text = (formData: FormData, key: string, max: number) => String(formData.get(key) || '').trim().slice(0, max);
// Tempo reservado: a Helaine digita em horas (aceita vírgula), o banco guarda em minutos.
const minutesFrom = (formData: FormData, key: string) => Math.round(Number(String(formData.get(key) || '').replace(',', '.')) * 60);
const validMinutes = (m: number) => Number.isFinite(m) && m >= MIN_SERVICE_MINUTES && m <= MAX_SERVICE_MINUTES;
const HOURS_HELP = `em horas, de ${MIN_SERVICE_MINUTES / 60} a ${MAX_SERVICE_MINUTES / 60} (ex.: 4 ou 4,5)`;
const NEEDS_0008 = 'Não foi possível salvar. Confira se a migração 0008 foi rodada no Supabase.';

/** Campos de um serviço vindos do formulário (`suffix` separa um serviço do outro no mesmo form). */
function serviceFields(formData: FormData, suffix: string) {
  const category = text(formData, `category${suffix}`, 10) as ServiceCategory;
  return {
    name: text(formData, `name${suffix}`, 60),
    category: CATEGORIES.includes(category) ? category : 'tranca' as ServiceCategory,
    description: text(formData, `description${suffix}`, 300),
    duration_label: text(formData, `duration${suffix}`, 40),
    duration_minutes: minutesFrom(formData, `hours${suffix}`),
    price: text(formData, `price${suffix}`, 40),
  };
}

/** Salva os serviços do catálogo: nome, categoria, descrição, preço, duração e visibilidade. */
export async function saveServices(_prev: SettingsState, formData: FormData): Promise<SettingsState> {
  const ids = [...new Set(formData.getAll('ids').map(String))].filter((id) => /^[a-z0-9-]{1,40}$/.test(id));
  if (ids.length === 0) return { error: 'Nenhum serviço para salvar.', ok: '' };
  const rows = ids.map((id) => ({ id, ...serviceFields(formData, `_${id}`), active: formData.get(`active_${id}`) === 'on', updated_at: new Date().toISOString() }));
  const noName = rows.find((r) => r.name.length < 2);
  if (noName) return { error: 'Todo serviço precisa de um nome.', ok: '' };
  const badTime = rows.find((r) => !validMinutes(r.duration_minutes));
  if (badTime) return { error: `Informe o tempo reservado de ${badTime.name} ${HOURS_HELP}.`, ok: '' };
  if (!rows.some((r) => r.active)) return { error: 'Deixe pelo menos um serviço aparecendo no site.', ok: '' };
  const supabase = await createAuthClient();
  // Só altera serviços que já existem: um id inventado no formulário não cria nada.
  const { data: existing, error: readError } = await supabase.from('services').select('id').in('id', ids);
  if (readError) { console.error('saveServices', readError); return { error: NEEDS_0008, ok: '' }; }
  const known = new Set((existing ?? []).map((r) => r.id));
  const { error } = await supabase.from('services').upsert(rows.filter((r) => known.has(r.id)), { onConflict: 'id' });
  if (error) { console.error('saveServices', error); return { error: NEEDS_0008, ok: '' }; }
  revalidatePath('/', 'layout');
  return { error: '', ok: 'Serviços salvos. O site já mostra os novos valores.' };
}

/** Cria um serviço novo no catálogo. */
export async function addService(_prev: SettingsState, formData: FormData): Promise<SettingsState> {
  const fields = serviceFields(formData, '');
  if (fields.name.length < 2) return { error: 'Informe o nome do serviço.', ok: '' };
  if (!validMinutes(fields.duration_minutes)) return { error: `Informe o tempo reservado ${HOURS_HELP}.`, ok: '' };
  const base = slugify(fields.name);
  if (!base) return { error: 'Use letras ou números no nome do serviço.', ok: '' };
  const supabase = await createAuthClient();
  const { data: all, error: readError } = await supabase.from('services').select('id, name, sort');
  if (readError) { console.error('addService', readError); return { error: NEEDS_0008, ok: '' }; }
  if (all.some((r) => r.name.trim().toLowerCase() === fields.name.toLowerCase())) return { error: `Já existe um serviço chamado ${fields.name}.`, ok: '' };
  const taken = new Set(all.map((r) => r.id));
  let id = base;
  for (let n = 2; taken.has(id); n++) id = `${base.slice(0, 36)}-${n}`;
  const sort = Math.max(0, ...all.map((r) => r.sort ?? 0)) + 10;
  const { error } = await supabase.from('services').insert({ id, ...fields, sort });
  if (error) { console.error('addService', error); return { error: NEEDS_0008, ok: '' }; }
  revalidatePath('/', 'layout');
  return { error: '', ok: `${fields.name} criado. Já aparece no site e no agendamento.` };
}

/** Salva os horários de atendimento. Agendamentos já feitos não mudam. */
export async function saveOpeningSlots(_prev: SettingsState, formData: FormData): Promise<SettingsState> {
  const times = [...new Set(formData.getAll('times').map(String))].filter((t) => slotOptions.includes(t)).sort();
  if (times.length === 0) return { error: 'Marque pelo menos um horário.', ok: '' };
  const closing = String(formData.get('closing') || '');
  if (!closingOptions.includes(closing)) return { error: 'Escolha até que horas vai o atendimento.', ok: '' };
  if (times[0] >= closing) return { error: `O atendimento encerra às ${closing}: marque algum horário antes disso.`, ok: '' };
  const supabase = await createAuthClient();
  const { error: closeError } = await supabase.from('site_settings').upsert({ key: 'closing_time', value: closing }, { onConflict: 'key' });
  if (closeError) { console.error('saveOpeningSlots', closeError); return { error: 'Não foi possível salvar. Confira se a migração 0006 foi rodada no Supabase.', ok: '' }; }
  const { error: delError } = await supabase.from('opening_slots').delete().not('time', 'in', `(${times.map((t) => `"${t}"`).join(',')})`);
  const { error } = delError ? { error: delError } : await supabase.from('opening_slots').upsert(times.map((time) => ({ time })), { onConflict: 'time', ignoreDuplicates: true });
  if (error) { console.error('saveOpeningSlots', error); return { error: 'Não foi possível salvar. Confira se a migração 0005 foi rodada no Supabase.', ok: '' }; }
  revalidatePath('/', 'layout');
  return { error: '', ok: `Horários salvos: ${times.join(', ')}. Atendimento até as ${closing}.` };
}
