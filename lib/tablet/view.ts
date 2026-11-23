import { bookingServiceName, formatDateBR, fromMinutes, toMinutes, type BookingStatus } from '@/lib/data';
import { COOKIE_PATH } from '@/lib/tablet/auth';
import type { DayFlags, TabletBooking } from '@/lib/tablet/repo';

// Painel do tablet: HTML montado inteiro no servidor, para o Safari do iOS 9.
// Regras desta página: nenhum bundle JS, CSS só com flexbox prefixado (sem grid,
// sem variáveis, sem "gap") e script inline em ES5 puro. Os testes conferem isso.

const BASE = COOKIE_PATH;
const WEEKDAYS = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
const MONTHS = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

/** Como cada status do banco aparece no painel. "Pendente" é o agendado, ainda a confirmar. */
const STATUS: Record<BookingStatus, { label: string; color: string }> = {
  Pendente: { label: 'A confirmar', color: '#c98a1b' },
  Confirmado: { label: 'Confirmado', color: '#2f80ed' },
  Finalizado: { label: 'Finalizado', color: '#27ae60' },
  Cancelado: { label: 'Cancelado', color: '#b84a4a' },
};

export const OK_MESSAGES: Record<string, string> = {
  confirmar: 'Atendimento confirmado.',
  finalizar: 'Atendimento finalizado.',
  cancelar: 'Agendamento cancelado.',
  reabrir: 'Agendamento reaberto: voltou para "A confirmar".',
  lembrete: 'Lembrete enviado.',
  lembrete_registrado: 'Lembrete registrado, mas nenhuma mensagem foi enviada: o envio automático ainda não está ligado. Avise a cliente pelo WhatsApp.',
};

export const ERROR_MESSAGES: Record<string, string> = {
  nao_encontrado: 'Agendamento não encontrado. Ele pode ter sido apagado.',
  status: 'Essa ação não vale para a situação atual do agendamento. A lista abaixo já está atualizada.',
  ocupado: 'Não deu para reabrir: outro atendimento ou um bloqueio ocupa esse horário.',
  csrf: 'Por segurança, a página precisou ser recarregada. Toque no botão de novo.',
  acao: 'Ação desconhecida.',
  id: 'Agendamento inválido.',
  banco: 'Não foi possível falar com o banco de dados. Tente de novo em instantes.',
  migracao: 'Falta rodar a migração 0007_tablet.sql no Supabase para usar essa ação.',
};

export function esc(text: unknown): string {
  return String(text ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

export function isValidDate(d: unknown): d is string {
  if (typeof d !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(d)) return false;
  const parsed = new Date(`${d}T00:00:00Z`);
  // Recusa datas que não existem, como 2026-02-30 ou 2026-99-99.
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === d;
}

export function addDays(date: string, n: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** "sexta-feira, 20 de novembro de 2026" */
export function longDate(date: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  return `${WEEKDAYS[d.getUTCDay()]}, ${d.getUTCDate()} de ${MONTHS[d.getUTCMonth()]} de ${d.getUTCFullYear()}`;
}

/** Hora (HH:MM) de um instante, no fuso de São Paulo. */
export const timeSP = (iso: string) =>
  new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(iso));

const CSS = `
html,body{margin:0;padding:0;background:#0d0f12;color:#e8e8e8;font-family:"Helvetica Neue",Helvetica,Arial,sans-serif;-webkit-text-size-adjust:100%;-webkit-tap-highlight-color:rgba(0,0,0,0)}
a{color:#e9b949;text-decoration:none}
form{margin:0}
.topo{display:-webkit-box;display:-webkit-flex;display:flex;-webkit-box-align:center;-webkit-align-items:center;align-items:center;padding:14px 24px;background:#15181d;border-bottom:1px solid #23272e}
.topo .t{-webkit-box-flex:1;-webkit-flex:1;flex:1;min-width:0}
.topo h1{margin:0;font-size:25px;font-weight:300}
.topo .sub{color:#888;font-size:14px;margin-top:3px}
.nav a{display:inline-block;min-height:44px;line-height:44px;padding:0 16px;margin-left:8px;background:#22262d;border-radius:8px;font-size:16px;color:#ddd}
.nav a.atual{color:#666}
#relogio{font-size:40px;font-weight:200;margin-left:22px;min-width:108px;text-align:right}
.resumo{padding:12px 24px;color:#999;font-size:16px}
.resumo b{color:#eee;font-weight:500}
.resumo span{margin-right:16px;white-space:nowrap}
.msg{margin:0 24px 12px;padding:13px 16px;border-radius:8px;background:#1d3b2a;color:#9be3b5;font-size:17px}
.msg.erro{background:#3b1d1d;color:#f3a3a3}
.msg.aviso{background:#3a3016;color:#f0d28a}
.lista{padding:0 24px 16px}
.card{display:-webkit-box;display:-webkit-flex;display:flex;background:#171a1f;border-radius:12px;margin-bottom:12px;border-left:6px solid #444;overflow:hidden}
.card.proximo{background:#221d10;-webkit-box-shadow:0 0 0 2px #e9b949;box-shadow:0 0 0 2px #e9b949}
.card.apagado{opacity:.45}
.hora{width:104px;padding:16px 0;text-align:center;font-size:30px;font-weight:300;border-right:1px solid #23272e;-webkit-flex-shrink:0;flex-shrink:0}
.hora small{display:block;font-size:13px;color:#777;margin-top:4px}
.info{-webkit-box-flex:1;-webkit-flex:1;flex:1;padding:14px 18px;min-width:0}
.nome{font-size:22px}
.serv{font-size:16px;color:#9aa;margin-top:4px}
.obs{font-size:15px;color:#e0b45a;margin-top:6px}
.meta{font-size:14px;color:#888;margin-top:6px}
.selo{display:inline-block;padding:3px 10px;border-radius:20px;font-size:13px;color:#fff;margin-left:8px;vertical-align:middle;white-space:nowrap}
.selo.prox{background:#e9b949;color:#1a1405;font-weight:bold}
.acoes{padding:10px 12px 10px 0;text-align:right;width:336px;-webkit-flex-shrink:0;flex-shrink:0}
.acoes form{display:inline-block;margin:4px 0 4px 8px}
.btn{-webkit-appearance:none;border:0;border-radius:8px;min-height:46px;padding:0 16px;font-size:16px;color:#fff;background:#2b3038;font-family:inherit;cursor:pointer}
.btn.azul{background:#2f80ed}
.btn.verde{background:#27ae60}
.btn.vermelho{background:#5a2626;color:#f3a3a3}
.vazio{padding:70px 24px;text-align:center;color:#666;font-size:21px}
.rodape{padding:6px 24px 30px;color:#555;font-size:13px}
.rodape .btn{min-height:44px;font-size:14px;color:#999;background:#1b1e24;margin-right:12px}
.login{max-width:340px;margin:110px auto 0;padding:0 20px;text-align:center}
.login h1{font-weight:300;font-size:30px;margin:0 0 6px}
.login p{color:#888;font-size:16px}
.login .msg{margin:0 0 14px}
.login input{display:block;width:100%;-webkit-box-sizing:border-box;box-sizing:border-box;min-height:64px;font-size:30px;text-align:center;padding:10px;border-radius:10px;border:1px solid #333;background:#171a1f;color:#fff;letter-spacing:6px;-webkit-appearance:none}
.login .btn{display:block;width:100%;margin-top:14px;min-height:56px;font-size:20px}
`;

function page(title: string, body: string): string {
  return `<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="utf-8">
<title>${esc(title)}</title>
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black">
<meta name="apple-mobile-web-app-title" content="Agenda">
<meta name="format-detection" content="telephone=no">
<meta name="robots" content="noindex, nofollow">
<style>${CSS}</style></head>
<body>${body}</body></html>`;
}

export function messagePage(title: string, text: string): string {
  return page(title, `<div class="vazio">${esc(text)}</div>`);
}

export function loginPage(opts: { error?: 'pin' | 'bloqueado' | 'origem'; blockedMinutes?: number } = {}): string {
  const message = opts.error === 'pin' ? 'PIN incorreto.'
    : opts.error === 'origem' ? 'Não foi possível entrar por esta página. Abra o endereço do painel e tente de novo.'
    : opts.error === 'bloqueado' ? `Muitas tentativas. Aguarde ${opts.blockedMinutes ?? 10} min e tente de novo.` : '';
  return page('Agenda · Entrar', `
<form class="login" method="POST" action="${BASE}/login" autocomplete="off">
  <h1>Helaine Tranças</h1>
  <p>Agenda do dia · digite o PIN</p>
  ${message ? `<div class="msg erro">${esc(message)}</div>` : ''}
  <input type="password" name="pin" inputmode="numeric" pattern="[0-9]*" maxlength="64" autocomplete="off" autofocus>
  <button class="btn azul" type="submit">Entrar</button>
</form>`);
}

type AgendaInput = {
  date: string;
  /** A data veio na URL? Se não, o painel acompanha "hoje" e vira o dia sozinho. */
  explicitDate: boolean;
  today: string;
  /** Hora atual (HH:MM) em São Paulo. */
  nowTime: string;
  bookings: TabletBooking[];
  flags: DayFlags;
  csrf: string;
  notice?: { ok: boolean; code: string } | null;
  /** Diz "lembrete enviado" (há envio automático) ou "lembrete registrado" (não há). */
  reminderDelivers: boolean;
};

const isOpen = (b: TabletBooking) => b.status === 'Pendente' || b.status === 'Confirmado';
const dayUrl = (date: string | null) => (date ? `${BASE}?data=${date}` : BASE);

function actionForm(b: TabletBooking, date: string, csrf: string, action: string, label: string, cls: string, confirm?: string): string {
  // O texto do confirm() vai num data-attribute escapado e é lido pelo script:
  // nunca é interpolado dentro de código JS.
  return `<form method="POST" action="${BASE}/acao"${confirm ? ` data-confirm="${esc(confirm)}"` : ''}>`
    + `<input type="hidden" name="csrf" value="${esc(csrf)}"><input type="hidden" name="id" value="${esc(b.id)}">`
    + `<input type="hidden" name="data" value="${esc(date)}"><input type="hidden" name="acao" value="${esc(action)}">`
    + `<button class="btn${cls ? ` ${cls}` : ''}" type="submit">${esc(label)}</button></form>`;
}

function card(b: TabletBooking, input: AgendaInput, isNext: boolean): string {
  const st = STATUS[b.status] ?? STATUS.Pendente;
  const { date, csrf } = input;
  let actions = '';
  if (b.status === 'Pendente') actions += actionForm(b, date, csrf, 'confirmar', 'Confirmar', 'azul');
  if (isOpen(b)) {
    actions += actionForm(b, date, csrf, 'finalizar', 'Finalizar', 'verde');
    actions += actionForm(b, date, csrf, 'lembrete', b.reminder_sent_at ? 'Reenviar lembrete' : 'Lembrete', '');
    actions += actionForm(b, date, csrf, 'cancelar', 'Cancelar', 'vermelho', `Cancelar o horário de ${b.name} às ${b.time}?`);
  } else {
    actions += actionForm(b, date, csrf, 'reabrir', 'Desfazer', '', `Voltar ${b.name} (${b.time}) para "A confirmar"?`);
  }

  // Linha de observação: o que a cliente escreveu ao agendar, mais os avisos da agenda.
  const start = toMinutes(b.time), end = start + (b.duration_minutes ?? 60);
  const notes: string[] = b.notes ? [b.notes] : [];
  if (isOpen(b) && input.flags.dayOff) notes.push('Marcado em dia de folga');
  else if (isOpen(b) && input.flags.blockedTimes.some((t) => toMinutes(t) >= start && toMinutes(t) < end)) notes.push('Passa por um horário bloqueado');

  const meta = [esc(b.phone)];
  if (b.email) meta.push(esc(b.email));
  if (b.reminder_sent_at) meta.push(`${input.reminderDelivers ? 'lembrete enviado' : 'lembrete registrado'} ${esc(timeSP(b.reminder_sent_at))}`);

  const closed = !isOpen(b);
  return `<div class="card${isNext ? ' proximo' : ''}${closed ? ' apagado' : ''}" style="border-left-color:${st.color}">
<div class="hora">${esc(b.time)}${b.duration_minutes ? `<small>até ${esc(fromMinutes(end))}</small>` : ''}</div>
<div class="info">
<div class="nome">${esc(b.name)}${isNext ? '<span class="selo prox">Próximo</span>' : ''}<span class="selo" style="background:${st.color}">${st.label}</span></div>
<div class="serv">${esc(bookingServiceName(b))}</div>
${notes.length ? `<div class="obs">${esc(notes.join(' · '))}</div>` : ''}
<div class="meta">${meta.join(' · ')}</div>
</div>
<div class="acoes">${actions}</div>
</div>`;
}

export function agendaPage(input: AgendaInput): string {
  const { date, today, bookings } = input;
  const isToday = date === today;

  // "Próximo": o primeiro atendimento ainda aberto a partir de agora (só no dia de hoje).
  const next = isToday ? bookings.find((b) => isOpen(b) && b.time >= input.nowTime) : undefined;

  const count = (s: BookingStatus) => bookings.filter((b) => b.status === s).length;
  const notice = input.notice;
  const table = notice?.ok ? OK_MESSAGES : ERROR_MESSAGES;
  const noticeText = notice && Object.prototype.hasOwnProperty.call(table, notice.code) ? table[notice.code] : undefined;
  const noticeClass = !notice?.ok ? ' erro' : notice.code === 'lembrete_registrado' ? ' aviso' : '';

  // Ao recarregar sozinho, some com a mensagem; e sem data na URL o painel segue o dia de hoje.
  const reloadUrl = dayUrl(input.explicitDate ? date : null);

  const body = `
<div class="topo">
  <div class="t">
    <h1>${isToday ? 'Hoje · ' : ''}${esc(longDate(date))}</h1>
    <div class="sub">Helaine Tranças · <span id="estado">atualiza sozinho a cada minuto</span></div>
  </div>
  <div class="nav">
    <a href="${dayUrl(addDays(date, -1))}">&#8249; Anterior</a>
    <a href="${BASE}"${isToday ? ' class="atual"' : ''}>Hoje</a>
    <a href="${dayUrl(addDays(date, 1))}">Próximo &#8250;</a>
  </div>
  <div id="relogio">${esc(input.nowTime)}</div>
</div>
<div class="resumo">
  <span><b>${bookings.length}</b> ${bookings.length === 1 ? 'atendimento' : 'atendimentos'}</span>
  <span><b>${count('Pendente')}</b> a confirmar</span>
  <span><b>${count('Confirmado')}</b> ${count('Confirmado') === 1 ? 'confirmado' : 'confirmados'}</span>
  <span><b>${count('Finalizado')}</b> ${count('Finalizado') === 1 ? 'finalizado' : 'finalizados'}</span>
  <span><b>${count('Cancelado')}</b> ${count('Cancelado') === 1 ? 'cancelado' : 'cancelados'}</span>
</div>
${noticeText ? `<div class="msg${noticeClass}">${esc(noticeText)}</div>` : ''}
${input.flags.dayOff ? `<div class="msg aviso">${esc(formatDateBR(date))} está marcado como dia de folga.</div>` : ''}
<div class="lista">
${bookings.length ? bookings.map((b) => card(b, input, b.id === next?.id)).join('\n') : '<div class="vazio">Nenhum atendimento neste dia.</div>'}
</div>
<div class="rodape">
  <form method="POST" action="${BASE}/sair" data-confirm="Sair do painel? Será preciso digitar o PIN de novo.">
    <input type="hidden" name="csrf" value="${esc(input.csrf)}"><button class="btn" type="submit">Sair</button>
  </form>
</div>
<script>${clientScript(reloadUrl)}</script>`;
  return page(`Agenda · ${formatDateBR(date)}`, body);
}

/** Script do painel. Só ES5: o Safari do iOS 9 não entende let/const, arrow functions, fetch nem Promise. */
export function clientScript(reloadUrl: string): string {
  // JSON.stringify dá uma string JS válida; o "<" escapado impede fechar a tag <script>.
  const url = JSON.stringify(reloadUrl).replace(/</g, '\\u003c');
  return `
(function () {
  var RELOAD_URL = ${url};
  function dois(n) { return n < 10 ? "0" + n : "" + n; }
  function relogio() {
    var d = new Date();
    document.getElementById("relogio").innerHTML = dois(d.getHours()) + ":" + dois(d.getMinutes());
  }
  relogio();
  setInterval(relogio, 5000);

  // Pergunta antes de cancelar, desfazer ou sair.
  var forms = document.getElementsByTagName("form");
  for (var i = 0; i < forms.length; i++) {
    (function (f) {
      var texto = f.getAttribute("data-confirm");
      if (texto) f.onsubmit = function () { return window.confirm(texto); };
    })(forms[i]);
  }

  // Recarrega a cada 60s. Antes confere se o servidor responde: se o computador
  // estiver desligado, a lista continua na tela em vez de virar uma página de erro.
  function recarregar() {
    var xhr = new XMLHttpRequest();
    var estado = document.getElementById("estado");
    function falhou() {
      estado.innerHTML = "sem conexão com o computador, tentando de novo...";
      setTimeout(recarregar, 60000);
    }
    xhr.open("GET", RELOAD_URL, true);
    xhr.timeout = 15000;
    xhr.onreadystatechange = function () {
      if (xhr.readyState !== 4) return;
      if (xhr.status === 200) window.location.replace(RELOAD_URL);
      else falhou();
    };
    xhr.ontimeout = function () {};
    try { xhr.send(); } catch (e) { falhou(); }
  }
  setTimeout(recarregar, 60000);
})();
`;
}
