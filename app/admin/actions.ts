'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createAuthClient, createServiceClient, supabaseConfigured } from '@/lib/supabase/server';
import { bookingStatuses, CATEGORY_LABELS, formatDateBR, MAX_SERVICE_MINUTES, MIN_SERVICE_MINUTES, slugify, todaySP, type BookingStatus, type ServiceCategory } from '@/lib/data';
import { closingOptions, getTimeSlots, slotOptions } from '@/lib/settings';
import { TRYON_EXTRA_MAX, TRYON_GRANT } from '@/lib/provador/rules';
import { AUTHOR_MAX, CAPTION_MAX, MAX_PHOTO_BYTES, oneLine, photoProblem } from '@/lib/mural';
import { approvePhoto, deletePhoto, savePhoto } from '@/lib/muralStore';

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

export type PromoState = { error: string; ok: string };
const MAX_PROMO_DAYS = 366;
const NEEDS_0009 = 'Não foi possível salvar. Confira se a migração 0009 foi rodada no Supabase.';

/** Cria uma promoção: serviço (ou todos), período do atendimento e preço promocional. */
export async function addPromotion(_prev: PromoState, formData: FormData): Promise<PromoState> {
  const title = text(formData, 'title', 80), description = text(formData, 'description', 300), price = text(formData, 'price', 60);
  const serviceId = text(formData, 'service_id', 40) || null;
  const from = text(formData, 'from', 10), to = text(formData, 'to', 10) || from;
  if (title.length < 2) return { error: 'Dê um nome para a promoção.', ok: '' };
  if (!price) return { error: 'Informe o preço ou o desconto da promoção.', ok: '' };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) return { error: 'Escolha a data de início.', ok: '' };
  if (to < from) return { error: 'A data final precisa ser depois da inicial.', ok: '' };
  if (to < todaySP()) return { error: 'Esse período já passou. Escolha datas a partir de hoje.', ok: '' };
  if ((Date.parse(to) - Date.parse(from)) / 864e5 > MAX_PROMO_DAYS) return { error: 'A promoção pode durar no máximo um ano.', ok: '' };
  const supabase = await createAuthClient();
  if (serviceId) {
    const { data: service, error: serviceError } = await supabase.from('services').select('id').eq('id', serviceId).maybeSingle();
    if (serviceError) { console.error('addPromotion', serviceError); return { error: NEEDS_0009, ok: '' }; }
    if (!service) return { error: 'Serviço não encontrado.', ok: '' };
  }
  const { error } = await supabase.from('promotions').insert({ title, description, price, service_id: serviceId, starts_on: from, ends_on: to });
  if (error) { console.error('addPromotion', error); return { error: NEEDS_0009, ok: '' }; }
  revalidatePath('/', 'layout');
  return { error: '', ok: `Promoção ${title} criada. Vale para atendimentos de ${formatDateBR(from)}${to === from ? '' : ` a ${formatDateBR(to)}`}.` };
}

const PROMO_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Pausa ou reativa uma promoção (pausada não aparece no site nem vale no agendamento). */
export async function setPromotionActive(id: string, active: boolean) {
  if (!PROMO_ID.test(id)) return;
  const supabase = await createAuthClient();
  const { error } = await supabase.from('promotions').update({ active }).eq('id', id);
  if (error) console.error('setPromotionActive', error);
  revalidatePath('/', 'layout');
}

/** Apaga uma promoção. Agendamentos já feitos com ela continuam com a promoção anotada. */
export async function deletePromotion(id: string) {
  if (!PROMO_ID.test(id)) return;
  const supabase = await createAuthClient();
  const { error } = await supabase.from('promotions').delete().eq('id', id);
  if (error) console.error('deletePromotion', error);
  revalidatePath('/', 'layout');
}

/** Confere se quem chamou é um admin logado (as ações do mural usam a service role, que ignora o RLS). */
async function isAdminSession(): Promise<boolean> {
  if (!supabaseConfigured()) return false;
  const supabase = await createAuthClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;
  const { data } = await supabase.from('admins').select('user_id').eq('user_id', user.id).maybeSingle();
  return Boolean(data);
}

const PHOTO_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Aprova uma foto enviada por cliente: ela passa a aparecer na galeria. */
export async function approveMuralPhoto(id: string) {
  if (!PHOTO_ID.test(id) || !(await isAdminSession())) return;
  await approvePhoto(id);
  revalidatePath('/', 'layout');
}

/** Recusa uma foto pendente ou tira uma foto da galeria. A foto é apagada. */
export async function deleteMuralPhoto(id: string) {
  if (!PHOTO_ID.test(id) || !(await isAdminSession())) return;
  await deletePhoto(id);
  revalidatePath('/', 'layout');
}

export type AdminMuralState = { error: string; ok: string };

/** O admin publica uma foto direto na galeria, sem passar pela fila. */
export async function addMuralPhoto(_prev: AdminMuralState, formData: FormData): Promise<AdminMuralState> {
  if (!(await isAdminSession())) return { error: 'Entre no painel de novo para publicar.', ok: '' };
  const file = formData.get('photo');
  if (!(file instanceof File) || file.size === 0) return { error: 'Escolha uma foto.', ok: '' };
  if (file.size > MAX_PHOTO_BYTES) return { error: 'A foto ficou grande demais. Tente outra foto.', ok: '' };
  const bytes = new Uint8Array(await file.arrayBuffer());
  const problem = photoProblem(bytes);
  if (problem) return { error: problem, ok: '' };
  const result = await savePhoto({ bytes, caption: oneLine(formData.get('caption'), CAPTION_MAX), author: oneLine(formData.get('author'), AUTHOR_MAX), source: 'admin' });
  if (!result.ok) return { error: result.reason === 'migracao' ? 'Rode a migração 0010_mural.sql no Supabase para usar o mural.' : 'Não foi possível publicar. Confira se a migração 0010 foi rodada.', ok: '' };
  revalidatePath('/', 'layout');
  return { error: '', ok: 'Foto publicada na galeria.' };
}

/** Cliente esqueceu a senha: o admin apaga a senha e o bloqueio. Ela volta a entrar com telefone + e-mail e cria outra. */
export async function resetClientPin(id: string) {
  if (!PHOTO_ID.test(id) || !(await isAdminSession())) return;
  const { error } = await createServiceClient().from('clients').update({ pin_hash: null, failed_logins: 0, locked_until: null }).eq('id', id);
  if (error) console.error('resetClientPin', error);
  revalidatePath('/admin');
}

/** Libera mais fotos no provador de tranças para uma cliente (cada foto gerada custa dinheiro). */
export async function grantTryons(id: string) {
  if (!PHOTO_ID.test(id) || !(await isAdminSession())) return;
  const supabase = createServiceClient();
  const { data, error } = await supabase.from('clients').select('tryon_extra').eq('id', id).maybeSingle();
  if (error || !data) { if (error) console.error('grantTryons', error); return; }
  const { error: upError } = await supabase.from('clients').update({ tryon_extra: Math.min(TRYON_EXTRA_MAX, (data.tryon_extra ?? 0) + TRYON_GRANT) }).eq('id', id);
  if (upError) console.error('grantTryons', upError);
  revalidatePath('/admin');
}
