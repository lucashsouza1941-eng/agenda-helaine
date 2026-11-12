import { createServiceClient, supabaseConfigured } from '@/lib/supabase/server';
import { services as defaultServices, timeSlots as defaultTimeSlots, type Service } from '@/lib/data';

export type ServiceWithStatus = Service & { active: boolean };

/** Erro de coluna que ainda não existe no banco (migração pendente). */
export const isMissingColumn = (e: { code?: string } | null) => e?.code === '42703' || e?.code === 'PGRST204';

/** Horários que a Helaine pode escolher como de atendimento: 07:00 a 21:30, de meia em meia hora. */
export const slotOptions = Array.from({ length: 30 }, (_, i) => `${String(7 + Math.floor(i / 2)).padStart(2, '0')}:${i % 2 ? '30' : '00'}`);

/** Serviços com preço, duração e visibilidade editados no /admin (ou os valores padrão do código). */
export async function getServices(): Promise<ServiceWithStatus[]> {
  const base = defaultServices.map((s) => ({ ...s, active: true }));
  if (!supabaseConfigured()) return base;
  type Row = { service_id: string; price: string | null; duration: string | null; active: boolean; duration_minutes?: number | null };
  const supabase = createServiceClient();
  let { data, error } = await supabase.from('service_settings').select('service_id, price, duration, active, duration_minutes').returns<Row[]>();
  // Antes da migração 0006 a coluna duration_minutes não existe: segue com o tempo padrão.
  if (error && isMissingColumn(error)) ({ data, error } = await supabase.from('service_settings').select('service_id, price, duration, active').returns<Row[]>());
  if (error || !data) { console.error('getServices', error); return base; }
  const byId = new Map(data.map((r) => [r.service_id, r]));
  return base.map((s) => {
    const r = byId.get(s.id);
    return r ? { ...s, price: r.price || s.price, duration: r.duration || s.duration, minutes: r.duration_minutes || s.minutes, active: r.active } : s;
  });
}

export async function getActiveServices(): Promise<Service[]> {
  return (await getServices()).filter((s) => s.active);
}

/** Horários de atendimento editados no /admin (ou os padrão do código, se ainda não houver nenhum). */
export async function getTimeSlots(): Promise<string[]> {
  if (!supabaseConfigured()) return defaultTimeSlots;
  const { data, error } = await createServiceClient().from('opening_slots').select('time').order('time');
  if (error) { console.error('getTimeSlots', error); return defaultTimeSlots; }
  return data.length ? data.map((r) => r.time) : defaultTimeSlots;
}
