import { COOKIE_PATH, sessionCookie, validCsrf, validSession } from '@/lib/tablet/auth';
import { isHttps, readForm, sameOrigin, seeOther, sessionFrom } from '@/lib/tablet/http';

export const dynamic = 'force-dynamic';

/** Sai do painel: apaga o cookie do tablet. */
export async function POST(request: Request): Promise<Response> {
  const session = sessionFrom(request);
  if (!session || !validSession(session)) return seeOther(COOKIE_PATH);
  const form = sameOrigin(request) ? await readForm(request) : null;
  if (!form || !validCsrf(session, form.get('csrf'))) return seeOther(`${COOKIE_PATH}?erro=csrf`);
  return seeOther(COOKIE_PATH, { 'Set-Cookie': sessionCookie('', isHttps(request), 0) });
}

export function GET(): Response {
  return seeOther(COOKIE_PATH);
}
