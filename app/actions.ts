'use server';
import { createServiceClient, supabaseConfigured } from '@/lib/supabase/server';
import { services, timeSlots, todaySP, type Booking } from '@/lib/data';

const NOT_CONFIGURED = 'O agendamento online ainda não está configurado. Fale com a Helaine pelo WhatsApp.';
const DAY_OFF = 'A Helaine não atende nesse dia. Escolha outra data, por favor.';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const isValidDate = (d: string) => DATE.test(d) && !Number.isNaN(Date.parse(d + 'T00:00:00Z')) && d >= todaySP();

export type PublicBooking = Pick<Booking, 'id' | 'service_id' | 'date' | 'time' | 'status'>;

/** Horários ocupados numa data e se é dia de folga (sem dados das clientes). */
export async function getDayAvailability(date: string): Promise<{ taken: string[]; dayOff: boolean }> {
  if (!supabaseConfigured() || !isValidDate(date)) return { taken: [], dayOff: false };
  const supabase = createServiceClient();
  const [bookings, off] = await Promise.all([
    supabase.from('bookings').select('time').eq('date', date).neq('status', 'Cancelado'),
    supabase.from('blocked_dates').select('date').eq('date', date).maybeSingle(),
  ]);
  if (bookings.error || off.error) console.error('getDayAvailability', bookings.error ?? off.error);
  return { taken: (bookings.data ?? []).map((r) => r.time), dayOff: Boolean(off.data) };
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
  serviceId: string; date: string; time: string; name: string; phone: string; email: string;
}): Promise<{ id: string } | { error: string }> {
  if (!supabaseConfigured()) return { error: NOT_CONFIGURED };
  const name = input.name.trim(), phone = input.phone.trim(), email = input.email.trim();
  if (!services.some((s) => s.id === input.serviceId)) return { error: 'Escolha um serviço.' };
  if (!isValidDate(input.date)) return { error: 'Escolha uma data a partir de hoje.' };
  if (!timeSlots.includes(input.time)) return { error: 'Escolha um horário.' };
  if (name.length < 2 || name.length > 120) return { error: 'Informe seu nome completo.' };
  if (phone.replace(/\D/g, '').length < 10 || phone.length > 30) return { error: 'Informe um telefone com DDD.' };
  if (email && (email.length > 160 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) return { error: 'E-mail inválido.' };

  const { data, error } = await createServiceClient()
    .from('bookings')
    .insert({ service_id: input.serviceId, date: input.date, time: input.time, name, phone, email: email || null })
    .select('id').single();
  if (error) {
    if (error.code === '23505') return { error: 'Esse horário acabou de ser reservado. Escolha outro, por favor.' };
    if (error.code === 'P0001' && error.message === 'dia_de_folga') return { error: DAY_OFF };
    console.error('createBooking', error);
    return { error: 'Não foi possível salvar o agendamento. Tente novamente.' };
  }
  return { id: data.id };
}

/** Agendamentos feitos neste aparelho (a cliente guarda os IDs no navegador). */
export async function getMyBookings(ids: string[]): Promise<PublicBooking[]> {
  const valid = ids.filter((id) => UUID.test(id)).slice(0, 50);
  if (!supabaseConfigured() || valid.length === 0) return [];
  const { data, error } = await createServiceClient()
    .from('bookings').select('id, service_id, date, time, status').in('id', valid)
    .order('date', { ascending: false }).order('time', { ascending: false });
  if (error) { console.error('getMyBookings', error); return []; }
  return data as PublicBooking[];
}
