import { todaySP } from '@/lib/data';
import { supabaseConfigured } from '@/lib/supabase/server';
import { isTabletAction, runTabletAction, UUID } from '@/lib/tablet/actions';
import { COOKIE_PATH, tabletConfigured, validCsrf, validSession } from '@/lib/tablet/auth';
import { readForm, sameOrigin, seeOther, sessionFrom } from '@/lib/tablet/http';
import { TabletError, tabletRepo } from '@/lib/tablet/repo';
import { isValidDate } from '@/lib/tablet/view';

export const dynamic = 'force-dynamic';

// Ações do painel do tablet. Sempre responde com redirect 303 para a lista do
// mesmo dia, levando um código de sucesso ou erro (nunca texto livre) na URL.
export async function POST(request: Request): Promise<Response> {
  const session = sessionFrom(request);
  // Sem sessão válida: volta para o painel, que pede o PIN.
  if (!tabletConfigured() || !session || !validSession(session)) return seeOther(COOKIE_PATH);

  const form = sameOrigin(request) ? await readForm(request) : null;
  const data = form?.get('data');
  // Hoje vai sem data na URL, para o painel continuar virando o dia sozinho.
  const back = (key: 'ok' | 'erro', code: string) =>
    seeOther(`${COOKIE_PATH}?${isValidDate(data) && data !== todaySP() ? `data=${data}&` : ''}${key}=${code}`);

  if (!form || !validCsrf(session, form.get('csrf'))) return back('erro', 'csrf');
  const action = form.get('acao'), id = form.get('id') ?? '';
  if (!isTabletAction(action)) return back('erro', 'acao');
  if (!UUID.test(id)) return back('erro', 'id');
  if (!supabaseConfigured()) return back('erro', 'banco');

  try {
    const result = await runTabletAction(tabletRepo(), id, action);
    return back(result.ok ? 'ok' : 'erro', result.code);
  } catch (error) {
    if (error instanceof TabletError) return back('erro', error.code);
    console.error('tablet acao', error);
    return back('erro', 'banco');
  }
}

export function GET(): Response {
  return seeOther(COOKIE_PATH);
}
