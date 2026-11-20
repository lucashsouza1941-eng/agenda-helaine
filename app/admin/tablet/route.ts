import { nowTimeSP, todaySP } from '@/lib/data';
import { supabaseConfigured } from '@/lib/supabase/server';
import { COOKIE_PATH, csrfToken, tabletConfigured, validSession } from '@/lib/tablet/auth';
import { html, sessionFrom } from '@/lib/tablet/http';
import { reminderConfigured } from '@/lib/tablet/reminder';
import { TabletError, tabletRepo } from '@/lib/tablet/repo';
import { agendaPage, ERROR_MESSAGES, isValidDate, loginPage, messagePage, OK_MESSAGES } from '@/lib/tablet/view';

// Painel do dia para tablet antigo (Safari do iOS 9). É um Route Handler que devolve
// HTML pronto: fica fora do layout do app e não carrega nenhum JavaScript do Next.
export const dynamic = 'force-dynamic';

export async function GET(request: Request): Promise<Response> {
  if (!tabletConfigured()) return html(messagePage('Agenda', 'Painel do tablet desligado: defina a variável TABLET_PIN (4 dígitos ou mais) no servidor.'), 503);
  const session = sessionFrom(request);
  if (!session || !validSession(session)) return html(loginPage());
  if (!supabaseConfigured()) return html(messagePage('Agenda', 'Banco de dados não configurado: faltam as variáveis do Supabase no servidor.'), 503);

  const params = new URL(request.url).searchParams;
  const requested = params.get('data');
  const explicitDate = isValidDate(requested);
  const today = todaySP();
  const date = explicitDate ? requested : today;

  // A mensagem vem como código na URL e só vira texto se estiver na lista.
  const ok = params.get('ok'), erro = params.get('erro');
  const known = (table: Record<string, string>, code: string | null): code is string => Boolean(code) && Object.prototype.hasOwnProperty.call(table, code!);
  const notice = known(OK_MESSAGES, ok) ? { ok: true, code: ok } : known(ERROR_MESSAGES, erro) ? { ok: false, code: erro } : null;

  try {
    const repo = tabletRepo();
    const [bookings, flags] = await Promise.all([repo.listDay(date), repo.dayFlags(date)]);
    return html(agendaPage({
      date, explicitDate, today, nowTime: nowTimeSP(), bookings, flags, notice,
      csrf: csrfToken(session), reminderDelivers: reminderConfigured(),
    }));
  } catch (error) {
    if (!(error instanceof TabletError)) console.error('tablet GET', error);
    // 503: o recarregamento automático do tablet percebe e mantém a última lista na tela.
    return html(messagePage('Agenda', `${ERROR_MESSAGES.banco} Abra ${COOKIE_PATH} de novo.`), 503);
  }
}
