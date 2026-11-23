import { createServiceClient, supabaseConfigured } from '@/lib/supabase/server';
import { CARD_GRADIENTS, DEFAULT_CLOSING_TIME, formatDuration, services as defaultServices, timeSlots as defaultTimeSlots, type Service, type ServiceCategory } from '@/lib/data';

export type ServiceWithStatus = Service & { active: boolean };

/** Erro de coluna que ainda não existe no banco (migração pendente). */
export const isMissingColumn = (e: { code?: string } | null) => e?.code === '42703' || e?.code === 'PGRST204';

/** Horários que a Helaine pode escolher como de atendimento: 07:00 a 21:30, de meia em meia hora. */
export const slotOptions = Array.from({ length: 30 }, (_, i) => `${String(7 + Math.floor(i / 2)).padStart(2, '0')}:${i % 2 ? '30' : '00'}`);

/** Erro de tabela que ainda não existe no banco (migração pendente). */
export const isMissingTable = (e: { code?: string } | null) => e?.code === '42P01' || e?.code === 'PGRST205';

export type CatalogRow = {
  id: string; name: string; category: ServiceCategory; description: string; duration_label: string;
  duration_minutes: number; price: string; photo: string; active: boolean; sort: number;
};
export const CATALOG_COLUMNS = 'id, name, category, description, duration_label, duration_minutes, price, photo, active, sort';

/** Linha da tabela `services` no formato que as páginas usam. */
function fromCatalog(r: CatalogRow, index: number): ServiceWithStatus {
  const extra = defaultServices.find((s) => s.id === r.id); // gradiente e enquadramento da foto
  return {
    id: r.id, name: r.name, category: r.category, description: r.description,
    duration: r.duration_label || formatDuration(r.duration_minutes), minutes: r.duration_minutes,
    price: r.price || 'A definir', image: extra?.image ?? CARD_GRADIENTS[index % CARD_GRADIENTS.length],
    photo: r.photo || undefined, photoAlt: extra?.photoAlt ?? r.name, photoPosition: extra?.photoPosition,
    active: r.active,
  };
}

/**
 * Catálogo de serviços. `editable` diz se ele vem da tabela `services` (migração 0008),
 * que o /admin cria e edita; sem ela, valem os 5 serviços de reserva do código.
 */
export async function getCatalog(): Promise<{ services: ServiceWithStatus[]; editable: boolean }> {
  if (!supabaseConfigured()) return { services: defaultServices.map((s) => ({ ...s, active: true })), editable: false };
  const { data, error } = await createServiceClient().from('services').select(CATALOG_COLUMNS).order('sort').order('name').returns<CatalogRow[]>();
  if (!error && data) return { services: data.map(fromCatalog), editable: true };
  if (!isMissingTable(error)) console.error('getCatalog', error);
  return { services: await getLegacyServices(), editable: false };
}

export async function getServices(): Promise<ServiceWithStatus[]> {
  return (await getCatalog()).services;
}

/** Antes da migração 0008: os 5 serviços do código, com o que foi editado em service_settings. */
async function getLegacyServices(): Promise<ServiceWithStatus[]> {
  const base = defaultServices.map((s) => ({ ...s, active: true }));
  type Row = { service_id: string; price: string | null; duration: string | null; active: boolean; duration_minutes?: number | null };
  const supabase = createServiceClient();
  let { data, error } = await supabase.from('service_settings').select('service_id, price, duration, active, duration_minutes').returns<Row[]>();
  // Antes da migração 0006 a coluna duration_minutes não existe: segue com o tempo padrão.
  if (error && isMissingColumn(error)) ({ data, error } = await supabase.from('service_settings').select('service_id, price, duration, active').returns<Row[]>());
  if (error || !data) { console.error('getLegacyServices', error); return base; }
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

/** Opções de horário de fechamento: 12:00 a 23:30, de meia em meia hora. */
export const closingOptions = Array.from({ length: 24 }, (_, i) => `${String(12 + Math.floor(i / 2)).padStart(2, '0')}:${i % 2 ? '30' : '00'}`);

/** Até que horas vai o atendimento (editado no /admin, ou 20:00). */
export async function getClosingTime(): Promise<string> {
  if (!supabaseConfigured()) return DEFAULT_CLOSING_TIME;
  const { data, error } = await createServiceClient().from('site_settings').select('value').eq('key', 'closing_time').maybeSingle();
  // Antes da migração 0006 a tabela não existe: usa o padrão.
  if (error) { if (error.code !== '42P01' && error.code !== 'PGRST205') console.error('getClosingTime', error); return DEFAULT_CLOSING_TIME; }
  return data && closingOptions.includes(data.value) ? data.value : DEFAULT_CLOSING_TIME;
}
