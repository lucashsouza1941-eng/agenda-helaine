const secret = () => process.env.TURNSTILE_SECRET_KEY;
const siteKey = () => process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

/** A verificação só liga com as duas chaves; sem elas o agendamento funciona sem captcha. */
export const turnstileConfigured = () => Boolean(secret() && siteKey());

/** Confere na Cloudflare se o token do widget é válido. */
export async function verifyTurnstile(token: string, ip?: string | null): Promise<boolean> {
  if (!token || token.length > 2048) return false;
  const body = new URLSearchParams({ secret: secret()!, response: token });
  if (ip) body.set('remoteip', ip);
  try {
    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST', body, signal: AbortSignal.timeout(8000),
    });
    const data = (await res.json()) as { success?: boolean; 'error-codes'?: string[] };
    if (!data.success) console.warn('verifyTurnstile', data['error-codes']);
    return data.success === true;
  } catch (err) {
    console.error('verifyTurnstile', err);
    return false;
  }
}
