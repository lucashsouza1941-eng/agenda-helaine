// Cadastro de clientes: regras puras (sem banco e sem cookies), usadas no servidor,
// no navegador e nos testes.

export type Client = { id: string; name: string; phone: string; email: string; hasPin: boolean };

export const PIN_LENGTH = 4;
/** Tentativas erradas seguidas até bloquear a entrada, e por quanto tempo. */
export const MAX_FAILED_LOGINS = 5;
export const LOCK_MINUTES = 15;

/**
 * Telefone como é guardado: só dígitos, com DDD e sem o 55.
 * "(11) 95858-1395", "+55 11 95858-1395" e "5511958581395" viram "11958581395".
 * Devolve null se não for um telefone brasileiro com DDD.
 */
export function normalizePhone(input: unknown): string | null {
  let digits = String(input ?? '').replace(/\D/g, '');
  if ((digits.length === 12 || digits.length === 13) && digits.startsWith('55')) digits = digits.slice(2);
  if (digits.startsWith('0')) digits = digits.slice(1); // 011...
  return /^[1-9][0-9]{9,10}$/.test(digits) ? digits : null;
}

/** "11958581395" -> "(11) 95858-1395" */
export function formatPhone(phone: string): string {
  const ddd = phone.slice(0, 2), rest = phone.slice(2);
  return `(${ddd}) ${rest.slice(0, rest.length - 4)}-${rest.slice(-4)}`;
}

export const normalizeEmail = (input: unknown) => String(input ?? '').trim().toLowerCase();
export const isEmail = (email: string) => email.length <= 160 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
export const cleanName = (input: unknown) => String(input ?? '').replace(/\s+/g, ' ').trim();
/** Nome completo: pelo menos nome e sobrenome. */
export const isFullName = (name: string) => name.length >= 3 && name.length <= 120 && name.includes(' ');
export const isPin = (pin: string) => new RegExp(`^[0-9]{${PIN_LENGTH}}$`).test(pin);
/** Senhas que qualquer pessoa tentaria primeiro. */
export const isWeakPin = (pin: string) => /^(\d)\1{3}$/.test(pin) || ['1234', '4321', '0123'].includes(pin);

export type SignupInput = { name: string; phone: string; email: string; pin: string };
type Checked<T> = { ok: true; data: T } | { ok: false; error: string };

/** Confere nome e e-mail (cadastro e edição do perfil). */
export function checkProfile(raw: { name: unknown; email: unknown }): Checked<{ name: string; email: string }> {
  const name = cleanName(raw.name), email = normalizeEmail(raw.email);
  if (!isFullName(name)) return { ok: false, error: 'Informe seu nome completo (nome e sobrenome).' };
  if (!isEmail(email)) return { ok: false, error: 'Informe um e-mail válido.' };
  return { ok: true, data: { name, email } };
}

/** Confere uma senha nova. Vazia é permitido só quando `optional`. */
export function checkNewPin(raw: unknown, optional: boolean): Checked<string> {
  const pin = String(raw ?? '').trim();
  if (!pin) return optional ? { ok: true, data: '' } : { ok: false, error: `Digite a senha de ${PIN_LENGTH} números.` };
  if (!isPin(pin)) return { ok: false, error: `A senha precisa ter exatamente ${PIN_LENGTH} números.` };
  if (isWeakPin(pin)) return { ok: false, error: 'Escolha uma senha menos óbvia (não use 1234 nem quatro números iguais).' };
  return { ok: true, data: pin };
}

/** Confere o formulário de cadastro. Devolve os dados limpos ou a mensagem de erro. */
export function checkSignup(raw: { name: unknown; phone: unknown; email: unknown; pin: unknown }): Checked<SignupInput> {
  const profile = checkProfile(raw);
  if (!profile.ok) return profile;
  const phone = normalizePhone(raw.phone);
  if (!phone) return { ok: false, error: 'Informe um telefone com DDD. Ex.: (11) 99999-9999.' };
  const pin = checkNewPin(raw.pin, true);
  if (!pin.ok) return pin;
  return { ok: true, data: { ...profile.data, phone, pin: pin.data } };
}

/**
 * Quem pode entrar. Cliente COM senha entra com telefone + senha. Cliente SEM senha
 * entra com telefone + o e-mail do cadastro (é uma conferência fraca: por isso o site
 * recomenda criar a senha). `pinMatches` já é o resultado da conferência da senha.
 */
export function loginCheck(client: { email: string; hasPin: boolean }, typed: string, pinMatches: boolean): boolean {
  return client.hasPin ? pinMatches : normalizeEmail(typed) === client.email;
}

/** Minutos que faltam de bloqueio (0 = liberado). */
export function lockedMinutes(lockedUntil: string | null, now = Date.now()): number {
  if (!lockedUntil) return 0;
  const left = Date.parse(lockedUntil) - now;
  return left > 0 ? Math.ceil(left / 60000) : 0;
}
