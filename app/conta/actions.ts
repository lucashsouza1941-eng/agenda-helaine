'use server';
import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { createServiceClient, supabaseConfigured } from '@/lib/supabase/server';
import { isMissingColumn, isMissingTable } from '@/lib/settings';
import { turnstileConfigured, verifyTurnstile } from '@/lib/turnstile';
import { checkNewPin, checkProfile, checkSignup, LOCK_MINUTES, lockedMinutes, loginCheck, MAX_FAILED_LOGINS, normalizePhone } from '@/lib/cliente/rules';
import { CLIENT_COLUMNS, clearClientCookie, getCurrentClient, hashPin, setClientCookie, verifyPin, type ClientRow } from '@/lib/cliente/session';

export type AccountState = { error: string; ok: string };
const fail = (error: string): AccountState => ({ error, ok: '' });

const NOT_READY = 'O cadastro ainda não está ligado. Tente mais tarde ou agende sem cadastro.';
const CAPTCHA = 'Não conseguimos confirmar que você não é um robô. Marque a verificação de novo, por favor.';
const TRY_AGAIN = 'Não foi possível concluir agora. Tente novamente.';
// A mesma resposta para telefone que não existe e para senha errada: não revela quem é cliente.
const WRONG_LOGIN = 'Telefone ou senha não conferem. Confira e tente de novo.';
const locked = (minutes: number) => `Muitas tentativas erradas. Tente de novo em ${minutes} minuto${minutes === 1 ? '' : 's'} ou fale com a Helaine.`;

async function captchaOk(formData: FormData): Promise<boolean> {
  if (!turnstileConfigured()) return true;
  const ip = (await headers()).get('x-forwarded-for')?.split(',')[0].trim();
  return verifyTurnstile(String(formData.get('captcha') ?? ''), ip);
}

/** Cadastro: nome completo, telefone, e-mail e, se a cliente quiser, uma senha de 4 números. */
export async function registerClient(_prev: AccountState, formData: FormData): Promise<AccountState> {
  if (!supabaseConfigured()) return fail(NOT_READY);
  const checked = checkSignup({ name: formData.get('name'), phone: formData.get('phone'), email: formData.get('email'), pin: formData.get('pin') });
  if (!checked.ok) return fail(checked.error);
  if (!(await captchaOk(formData))) return fail(CAPTCHA);
  const { name, phone, email, pin } = checked.data;
  const { data, error } = await createServiceClient().from('clients')
    .insert({ name, phone, email, pin_hash: pin ? hashPin(pin) : null }).select('id').single();
  if (error || !data) {
    if (error?.code === '23505') return fail('Esse telefone já tem cadastro. Use "Já tenho cadastro" para entrar.');
    if (error && (isMissingTable(error) || isMissingColumn(error))) return fail(NOT_READY);
    console.error('registerClient', error);
    return fail(TRY_AGAIN);
  }
  await setClientCookie(data.id, name);
  revalidatePath('/conta');
  return { error: '', ok: 'Cadastro feito!' };
}

/**
 * Entrar em outro aparelho: telefone + senha de 4 números. Quem não criou senha entra com
 * telefone + o e-mail do cadastro. Cada tentativa é contada ANTES de conferir, com uma
 * atualização condicional, para que tentativas ao mesmo tempo não escapem do limite.
 */
export async function loginClient(_prev: AccountState, formData: FormData): Promise<AccountState> {
  if (!supabaseConfigured()) return fail(NOT_READY);
  const phone = normalizePhone(formData.get('phone'));
  const typed = String(formData.get('secret') ?? '').trim().slice(0, 160);
  if (!phone) return fail('Informe o telefone com DDD. Ex.: (11) 99999-9999.');
  if (!typed) return fail('Digite sua senha de 4 números (ou o e-mail do cadastro, se você não criou senha).');
  if (!(await captchaOk(formData))) return fail(CAPTCHA);

  const supabase = createServiceClient();
  const { data: row, error } = await supabase.from('clients').select(CLIENT_COLUMNS).eq('phone', phone).returns<ClientRow[]>().maybeSingle();
  if (error) {
    if (isMissingTable(error)) return fail(NOT_READY);
    console.error('loginClient', error);
    return fail(TRY_AGAIN);
  }
  if (!row) return fail(WRONG_LOGIN);
  const wait = lockedMinutes(row.locked_until);
  if (wait > 0) return fail(locked(wait));

  // Reserva a tentativa. Depois do limite, cada novo erro bloqueia de novo; só acertar zera.
  const attempts = row.failed_logins + 1;
  const lockUntil = attempts >= MAX_FAILED_LOGINS ? new Date(Date.now() + LOCK_MINUTES * 60000).toISOString() : null;
  const { data: reserved, error: reserveError } = await supabase.from('clients')
    .update({ failed_logins: attempts, locked_until: lockUntil }).eq('id', row.id).eq('failed_logins', row.failed_logins).select('id');
  if (reserveError || !reserved || reserved.length === 0) {
    if (reserveError) console.error('loginClient', reserveError);
    return fail(TRY_AGAIN);
  }

  const hasPin = Boolean(row.pin_hash);
  if (!loginCheck({ email: row.email, hasPin }, typed, hasPin && verifyPin(typed, row.pin_hash))) {
    return fail(lockUntil ? locked(LOCK_MINUTES) : WRONG_LOGIN);
  }
  await supabase.from('clients').update({ failed_logins: 0, locked_until: null }).eq('id', row.id);
  await setClientCookie(row.id, row.name);
  revalidatePath('/conta');
  return { error: '', ok: 'Você entrou!' };
}

export async function logoutClient() {
  await clearClientCookie();
  revalidatePath('/conta');
}

/** A cliente logada muda nome, e-mail e, se quiser, cria ou troca a senha. */
export async function updateProfile(_prev: AccountState, formData: FormData): Promise<AccountState> {
  const client = await getCurrentClient();
  if (!client) return fail('Entre na sua conta de novo para alterar seus dados.');
  const profile = checkProfile({ name: formData.get('name'), email: formData.get('email') });
  if (!profile.ok) return fail(profile.error);
  const pin = checkNewPin(formData.get('pin'), true);
  if (!pin.ok) return fail(pin.error);
  const { error } = await createServiceClient().from('clients')
    .update({ ...profile.data, ...(pin.data ? { pin_hash: hashPin(pin.data), failed_logins: 0, locked_until: null } : {}) }).eq('id', client.id);
  if (error) { console.error('updateProfile', error); return fail(TRY_AGAIN); }
  await setClientCookie(client.id, profile.data.name);
  revalidatePath('/conta');
  return { error: '', ok: pin.data ? 'Dados e senha salvos.' : 'Dados salvos.' };
}
