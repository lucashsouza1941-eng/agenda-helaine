'use server';
import { headers } from 'next/headers';
import { createServiceClient, supabaseConfigured } from '@/lib/supabase/server';
import { turnstileConfigured, verifyTurnstile } from '@/lib/turnstile';
import { CANCEL_MIN_HOURS, hoursUntil, isPastSlot, NOTES_MAX, services as defaultServices, slotConflict, todaySP, toMinutes, type Booking, type BusyInterval } from '@/lib/data';
import { getActiveServices, getClosingTime, getCurrentPromotions, getTimeSlots, isMissingColumn } from '@/lib/settings';
import { promoFor, promoSnapshot } from '@/lib/promo';
import { AUTHOR_MAX, CAPTION_MAX, MAX_PHOTO_BYTES, oneLine, photoProblem } from '@/lib/mural';
import { savePhoto } from '@/lib/muralStore';
import { getCurrentClient } from '@/lib/cliente/session';

const NOT_CONFIGURED = 'O agendamento online ainda não está configurado. Fale com a Helaine pelo WhatsApp.';
const DAY_OFF = 'A Helaine não atende nesse dia. Escolha outra data, por favor.';
const CAPTCHA = 'Não conseguimos confirmar que você não é um robô. Marque a verificação de novo, por favor.';
const SLOT_TAKEN = 'Esse horário não está mais livre para este serviço. Escolha outro, por favor.';
const tooLate = (closing: string) => `Esse serviço terminaria depois das ${closing}, quando o atendimento encerra. Escolha um horário mais cedo, por favor.`;
const SLOT_BLOCKED = 'A Helaine não atende nesse horário. Escolha outro, por favor.';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const isValidDate = (d: string) => DATE.test(d) && !Number.isNaN(Date.parse(d + 'T00:00:00Z')) && d >= todaySP();

export type PublicBooking = Pick<Booking, 'id' | 'service_id' | 'service_name' | 'promo_title' | 'date' | 'time' | 'status'>;

type BusyRow = { time: string; service_id: string; duration_minutes?: number | null };

/** Intervalos ocupados pelos agendamentos ativos de um dia. */
async function getBusyIntervals(date: string): Promise<BusyInterval[]> {
  const supabase = createServiceClient();
  const query = (cols: string) => supabase.from('bookings').select(cols).eq('date', date).neq('status', 'Cancelado').returns<BusyRow[]>();
  let { data, error } = await query('time, service_id, duration_minutes');
  // Antes da migração 0006 a coluna não existe: usa o tempo padrão de cada serviço.
  if (error && isMissingColumn(error)) ({ data, error } = await query('time, service_id'));
  if (error) console.error('getBusyIntervals', error);
  return (data ?? []).map((r) => {
    const start = toMinutes(r.time);
    return { start, end: start + (r.duration_minutes || defaultServices.find((s) => s.id === r.service_id)?.minutes || 60) };
  });
}

/** Intervalos ocupados, horários bloqueados e se é dia de folga (sem dados das clientes). */
export async function getDayAvailability(date: string): Promise<{ busy: BusyInterval[]; blocked: string[]; dayOff: boolean }> {
  if (!supabaseConfigured() || !isValidDate(date)) return { busy: [], blocked: [], dayOff: false };
  const supabase = createServiceClient();
  const [busy, off, slots] = await Promise.all([
    getBusyIntervals(date),
    supabase.from('blocked_dates').select('date').eq('date', date).maybeSingle(),
    supabase.from('blocked_slots').select('time').eq('date', date),
  ]);
  if (off.error || slots.error) console.error('getDayAvailability', off.error ?? slots.error);
  return { busy, blocked: (slots.data ?? []).map((r) => r.time), dayOff: Boolean(off.data) };
}

/** Próximos dias de folga, para avisar as clientes antes de escolherem a data. */
export async function getUpcomingDaysOff(): Promise<string[]> {
  if (!supabaseConfigured()) return [];
  const { data, error } = await createServiceClient()
    .from('blocked_dates').select('date').gte('date', todaySP()).order('date').limit(60);
  if (error) { console.error('getUpcomingDaysOff', error); return []; }
  return data.map((r) => r.date);
}

export async function createBooking(input: {
  serviceId: string; date: string; time: string; name: string; phone: string; email: string; notes?: string; captcha?: string;
}): Promise<{ id: string } | { error: string }> {
  if (!supabaseConfigured()) return { error: NOT_CONFIGURED };
  const name = input.name.trim(), phone = input.phone.trim(), email = input.email.trim(), notes = (input.notes ?? '').trim();
  const [services, timeSlots, closing] = await Promise.all([getActiveServices(), getTimeSlots(), getClosingTime()]);
  const service = services.find((s) => s.id === input.serviceId);
  if (!service) return { error: 'Escolha um serviço.' };
  if (!isValidDate(input.date)) return { error: 'Escolha uma data a partir de hoje.' };
  if (!timeSlots.includes(input.time)) return { error: 'Escolha um horário.' };
  if (isPastSlot(input.date, input.time)) return { error: 'Esse horário já passou. Escolha outro, por favor.' };
  if (name.length < 2 || name.length > 120) return { error: 'Informe seu nome completo.' };
  if (phone.replace(/\D/g, '').length < 10 || phone.length > 30) return { error: 'Informe um telefone com DDD.' };
  if (notes.length > NOTES_MAX) return { error: `As observações podem ter até ${NOTES_MAX} letras.` };
  if (email && (email.length > 160 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) return { error: 'E-mail inválido.' };
  if (turnstileConfigured()) {
    const ip = (await headers()).get('x-forwarded-for')?.split(',')[0].trim();
    if (!(await verifyTurnstile(input.captcha ?? '', ip))) return { error: CAPTCHA };
  }

  // O banco confere de novo (trigger da migração 0006), mas checar aqui dá a resposta certa
  // mesmo antes da migração e evita uma ida ao banco à toa.
  const day = await getDayAvailability(input.date);
  if (day.dayOff) return { error: DAY_OFF };
  const conflict = slotConflict(input.time, service.minutes, day.busy, day.blocked, closing);
  if (conflict === 'closed') return { error: tooLate(closing) };
  if (conflict) return { error: conflict === 'blocked' ? SLOT_BLOCKED : SLOT_TAKEN };

  const supabase = createServiceClient();
  const row = { service_id: input.serviceId, date: input.date, time: input.time, name, phone, email: email || null };
  // Do mais completo para o mais antigo: cada migração pendente (0008, depois 0006) tira colunas.
  // A promoção é decidida aqui no servidor, pela data e pelo serviço: o navegador não escolhe preço.
  const promo = promoFor(await getCurrentPromotions(), service.id, input.date);
  const full = { ...row, duration_minutes: service.minutes, service_name: service.name, notes: notes || null };
  const variants = [
    ...(promo ? [{ ...full, promo_title: promoSnapshot(promo) }] : []),
    full,
    { ...row, duration_minutes: service.minutes },
    row,
  ];
  // Cliente logada: o agendamento fica ligado ao cadastro dela (migração 0011).
  const client = await getCurrentClient();
  const attempts = client ? [{ ...variants[0], client_id: client.id }, ...variants] : variants;
  let { data, error } = await supabase.from('bookings').insert(attempts[0]).select('id').single();
  for (let i = 1; error && isMissingColumn(error) && i < attempts.length; i++) {
    ({ data, error } = await supabase.from('bookings').insert(attempts[i]).select('id').single());
  }
  if (error || !data) {
    if (error?.code === '23505' || (error?.code === 'P0001' && error.message === 'horario_ocupado')) return { error: SLOT_TAKEN };
    if (error?.code === 'P0001' && error.message === 'dia_de_folga') return { error: DAY_OFF };
    if (error?.code === 'P0001' && error.message === 'depois_do_fechamento') return { error: tooLate(closing) };
    if (error?.code === 'P0001' && error.message === 'horario_bloqueado') return { error: SLOT_BLOCKED };
    console.error('createBooking', error);
    return { error: 'Não foi possível salvar o agendamento. Tente novamente.' };
  }
  return { id: data.id };
}

/**
 * Agendamentos da cliente: os feitos neste aparelho (IDs guardados no navegador) e, se ela
 * estiver logada, todos os do cadastro dela. Os deste aparelho passam a pertencer ao cadastro.
 */
export async function getMyBookings(ids: string[]): Promise<PublicBooking[]> {
  const valid = ids.filter((id) => UUID.test(id)).slice(0, 50);
  if (!supabaseConfigured()) return [];
  const client = await getCurrentClient();
  if (!client && valid.length === 0) return [];
  const supabase = createServiceClient();
  if (client && valid.length > 0) {
    const { error } = await supabase.from('bookings').update({ client_id: client.id }).in('id', valid).is('client_id', null);
    if (error) console.error('getMyBookings', error);
  }
  const query = (cols: string) => {
    const q = supabase.from('bookings').select(cols);
    const mine = !client ? q.in('id', valid)
      : valid.length > 0 ? q.or(`client_id.eq.${client.id},id.in.(${valid.join(',')})`) : q.eq('client_id', client.id);
    return mine.order('date', { ascending: false }).order('time', { ascending: false }).limit(100).returns<PublicBooking[]>();
  };
  const columnSets = ['id, service_id, service_name, promo_title, date, time, status', 'id, service_id, service_name, date, time, status', 'id, service_id, date, time, status'];
  let { data, error } = await query(columnSets[0]);
  for (let i = 1; error && isMissingColumn(error) && i < columnSets.length; i++) ({ data, error } = await query(columnSets[i]));
  if (error || !data) { console.error('getMyBookings', error); return []; }
  return data;
}

/** A cliente cancela o próprio agendamento (só quem tem o ID, guardado no aparelho dela). */
export async function cancelMyBooking(id: string): Promise<{ ok: true } | { error: string }> {
  if (!supabaseConfigured()) return { error: NOT_CONFIGURED };
  if (!UUID.test(id)) return { error: 'Agendamento não encontrado.' };
  const supabase = createServiceClient();
  const { data: b, error } = await supabase.from('bookings').select('date, time, status').eq('id', id).maybeSingle();
  if (error) { console.error('cancelMyBooking', error); return { error: 'Não foi possível cancelar. Tente novamente.' }; }
  if (!b) return { error: 'Agendamento não encontrado.' };
  if (b.status === 'Cancelado') return { ok: true };
  if (b.status === 'Finalizado') return { error: 'Esse atendimento já foi finalizado.' };
  if (hoursUntil(b.date, b.time) < CANCEL_MIN_HOURS) return { error: `Faltam menos de ${CANCEL_MIN_HOURS} horas. Para cancelar, fale com a Helaine pelo WhatsApp.` };
  const { error: upError } = await supabase.from('bookings').update({ status: 'Cancelado' }).eq('id', id).in('status', ['Pendente', 'Confirmado']);
  if (upError) { console.error('cancelMyBooking', upError); return { error: 'Não foi possível cancelar. Tente novamente.' }; }
  return { ok: true };
}

export type MuralState = { error: string; ok: string };

/** Lê e confere o arquivo de foto de um formulário. */
async function readPhoto(formData: FormData): Promise<{ bytes: Uint8Array } | { error: string }> {
  const file = formData.get('photo');
  if (!(file instanceof File) || file.size === 0) return { error: 'Escolha uma foto.' };
  if (file.size > MAX_PHOTO_BYTES) return { error: 'A foto ficou grande demais. Tente outra foto.' };
  const bytes = new Uint8Array(await file.arrayBuffer());
  const problem = photoProblem(bytes);
  return problem ? { error: problem } : { bytes };
}

/** A cliente envia uma foto para o mural. Ela só aparece no site depois que a Helaine aprovar. */
export async function submitMuralPhoto(_prev: MuralState, formData: FormData): Promise<MuralState> {
  if (!supabaseConfigured()) return { error: NOT_CONFIGURED, ok: '' };
  if (formData.get('consent') !== 'on') return { error: 'Marque a caixinha de autorização para enviar a foto.', ok: '' };
  const photo = await readPhoto(formData);
  if ('error' in photo) return { error: photo.error, ok: '' };
  if (turnstileConfigured()) {
    const ip = (await headers()).get('x-forwarded-for')?.split(',')[0].trim();
    if (!(await verifyTurnstile(String(formData.get('captcha') ?? ''), ip))) return { error: CAPTCHA, ok: '' };
  }
  const result = await savePhoto({ bytes: photo.bytes, caption: oneLine(formData.get('caption'), CAPTION_MAX), author: oneLine(formData.get('author'), AUTHOR_MAX), source: 'cliente' });
  if (result.ok) return { error: '', ok: 'Foto enviada! Ela aparece na galeria depois que a Helaine aprovar.' };
  if (result.reason === 'fila') return { error: 'Recebemos muitas fotos e a Helaine ainda está olhando. Tente de novo em alguns dias.', ok: '' };
  if (result.reason === 'migracao') return { error: 'O mural ainda não está ligado. Tente mais tarde.', ok: '' };
  return { error: 'Não foi possível enviar a foto. Tente novamente.', ok: '' };
}
