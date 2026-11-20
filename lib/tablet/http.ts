import { SESSION_COOKIE } from '@/lib/tablet/auth';

// Respostas do painel do tablet: HTML pronto e redirects 303, sem nada do Next no cliente.

const HEADERS = {
  'Cache-Control': 'no-store',
  'X-Robots-Tag': 'noindex, nofollow',
  'X-Frame-Options': 'DENY',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
};

export function html(body: string, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(body, {
    status,
    headers: {
      ...HEADERS,
      'Content-Type': 'text/html; charset=utf-8',
      // Só o que a página usa: estilo e script inline, formulários para o próprio site.
      'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; connect-src 'self'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'",
      ...headers,
    },
  });
}

/** Redirect 303 (o navegador volta com GET). Location relativo, para valer em qualquer IP ou domínio. */
export function seeOther(location: string, headers: Record<string, string> = {}): Response {
  return new Response(null, { status: 303, headers: { ...HEADERS, Location: location, ...headers } });
}

export function sessionFrom(request: Request): string | null {
  for (const part of (request.headers.get('cookie') ?? '').split(';')) {
    const i = part.indexOf('=');
    if (i > 0 && part.slice(0, i).trim() === SESSION_COOKIE) return part.slice(i + 1).trim();
  }
  return null;
}

/** HTTPS (direto ou atrás de proxy)? Decide se o cookie leva "Secure". */
export function isHttps(request: Request): boolean {
  const proto = request.headers.get('x-forwarded-proto')?.split(',')[0].trim();
  return proto ? proto === 'https' : new URL(request.url).protocol === 'https:';
}

/** Barra POST vindo de outro site. Navegador que não manda Origin passa (o token CSRF cobre as ações). */
export function sameOrigin(request: Request): boolean {
  const origin = request.headers.get('origin');
  if (!origin || origin === 'null') return true;
  try { return new URL(origin).host === (request.headers.get('host') ?? new URL(request.url).host); }
  catch { return false; }
}

export function clientIp(request: Request): string {
  return request.headers.get('x-forwarded-for')?.split(',')[0].trim().slice(0, 64) || 'local';
}

const MAX_BODY = 4096;

/** Corpo de um <form method="POST"> comum. null se não for um formulário ou for grande demais. */
export async function readForm(request: Request): Promise<URLSearchParams | null> {
  if (!(request.headers.get('content-type') ?? '').toLowerCase().startsWith('application/x-www-form-urlencoded')) return null;
  if (Number(request.headers.get('content-length') ?? 0) > MAX_BODY) return null;
  const text = await request.text();
  return text.length > MAX_BODY ? null : new URLSearchParams(text);
}
