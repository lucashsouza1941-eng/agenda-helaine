import { parse } from 'acorn';
import { beforeEach, describe, expect, it } from 'vitest';
import { csrfToken } from '@/lib/tablet/auth';
import type { TabletBooking } from '@/lib/tablet/repo';
import { addDays, agendaPage, clientScript, esc, isValidDate, loginPage, longDate, messagePage } from '@/lib/tablet/view';
import { booking, ID, session, setEnv } from './helpers';

beforeEach(setEnv);

function render(bookings: TabletBooking[], extra: Partial<Parameters<typeof agendaPage>[0]> = {}): string {
  return agendaPage({
    date: '2026-11-20', explicitDate: false, today: '2026-11-20', nowTime: '12:30', bookings,
    flags: { dayOff: false, blockedTimes: [] }, csrf: csrfToken(session()), notice: null, reminderDelivers: false, ...extra,
  });
}

const DAY = [
  booking(1, '09:00', 'Finalizado'), booking(2, '11:00', 'Confirmado'), booking(3, '14:00', 'Pendente'),
  booking(4, '16:00', 'Confirmado'), booking(5, '17:00', 'Cancelado'),
];
const ALL_PAGES = () => [render(DAY), render([]), loginPage(), loginPage({ error: 'pin' }), messagePage('x', 'y')];
const scripts = (html: string) => [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)].map((x) => x[1]);
const cardOf = (html: string, n: number) => html.split('<div class="card').find((c) => c.includes(`value="${ID(n)}"`))!;

describe('compatível com o Safari do iOS 9', () => {
  it('o script inline é ES5 válido (acorn, ecmaVersion 5)', () => {
    const found = scripts(render(DAY));
    expect(found).toHaveLength(1);
    for (const code of found) expect(() => parse(code, { ecmaVersion: 5, sourceType: 'script' })).not.toThrow();
    // Datas e caminhos diferentes não mudam isso.
    for (const url of ['/admin/tablet', '/admin/tablet?data=2026-11-21']) expect(() => parse(clientScript(url), { ecmaVersion: 5 })).not.toThrow();
  });

  it('o parser recusa mesmo sintaxe moderna (o teste acima não passa à toa)', () => {
    for (const modern of ['let a = 1;', 'const a = 1;', 'var f = () => 1;', 'var s = `x`;', 'async function f() {}', 'var {a} = b;']) {
      expect(() => parse(modern, { ecmaVersion: 5 })).toThrow();
    }
  });

  it('o script não usa APIs que o iOS 9 não tem', () => {
    const code = scripts(render(DAY)).join('\n');
    for (const api of ['fetch(', 'Promise', 'Intl.', 'padStart', 'classList', 'querySelector', 'addEventListener', '.includes(', 'Object.assign', 'URLSearchParams']) {
      expect(code).not.toContain(api);
    }
  });

  it('nenhuma página carrega script externo, bundle do Next ou folha de estilo externa', () => {
    for (const html of ALL_PAGES()) {
      expect(html).not.toMatch(/<script[^>]+src=/i);
      expect(html).not.toContain('_next');
      expect(html).not.toMatch(/<link\b/i);
      expect(html).not.toContain('__next');
    }
  });

  it('sem handlers inline: o confirm() vem de data-confirm lido pelo script', () => {
    for (const html of ALL_PAGES()) expect(html).not.toMatch(/\son[a-z]+\s*=/i);
    expect(render(DAY)).toContain('data-confirm="Cancelar o horário de Cliente 2 às 11:00?"');
  });

  it('CSS só com flexbox prefixado: sem grid, variáveis, gap, calc ou unidades novas', () => {
    for (const html of ALL_PAGES()) {
      const css = [...html.matchAll(/<style>([\s\S]*?)<\/style>/g)].map((x) => x[1]).join('\n');
      expect(css.length).toBeGreaterThan(500);
      expect(css).not.toMatch(/\bgrid\b/);
      expect(css).not.toMatch(/var\(|--[a-z]/);
      expect(css).not.toMatch(/\bgap\s*:/);
      expect(css).not.toMatch(/calc\(|clamp\(|min\(|max\(|\bdvh\b|\bsvh\b|:is\(|:where\(|@supports|@container|inset\s*:|aspect-ratio/);
      // Todo display:flex vem depois do -webkit-flex.
      expect((css.match(/display:flex/g) ?? []).length).toBe((css.match(/display:-webkit-flex;display:flex/g) ?? []).length);
      expect(css).toContain('display:-webkit-flex');
    }
  });

  it('abre em tela cheia pela tela de início', () => {
    for (const html of ALL_PAGES()) {
      expect(html).toContain('<meta name="apple-mobile-web-app-capable" content="yes">');
      expect(html).toContain('apple-mobile-web-app-status-bar-style');
      expect(html).toContain('<meta name="viewport" content="width=device-width');
      expect(html.startsWith('<!DOCTYPE html>')).toBe(true);
    }
  });

  it('botões e links de toque com pelo menos 44px de altura', () => {
    const css = render(DAY).match(/<style>([\s\S]*?)<\/style>/)![1];
    const heights = [...css.matchAll(/\.(?:btn|nav a|rodape \.btn|login \.btn|login input)\{[^}]*?min-height:(\d+)px/g)].map((x) => Number(x[1]));
    expect(heights.length).toBeGreaterThanOrEqual(5);
    expect(Math.min(...heights)).toBeGreaterThanOrEqual(44);
  });
});

describe('lista do dia', () => {
  it('resumo: total, a confirmar, confirmados, finalizados, cancelados', () => {
    const text = render(DAY).match(/<div class="resumo">([\s\S]*?)<\/div>/)![1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
    expect(text).toBe('5 atendimentos 1 a confirmar 2 confirmados 1 finalizado 1 cancelado');
  });

  it('ordem por horário, com hora, cliente, serviço, telefone e selo de status', () => {
    const html = render(DAY);
    const order = [...html.matchAll(/<div class="hora">(\d\d:\d\d)/g)].map((x) => x[1]);
    expect(order).toEqual(['09:00', '11:00', '14:00', '16:00', '17:00']);
    const c = cardOf(html, 3);
    expect(c).toContain('Cliente 3');
    expect(c).toContain('Nagô');
    expect(c).toContain('11999990003');
    expect(c).toContain('>A confirmar</span>');
    expect(cardOf(html, 2)).toContain('>Confirmado</span>');
    expect(cardOf(html, 1)).toContain('>Finalizado</span>');
    expect(cardOf(html, 5)).toContain('>Cancelado</span>');
  });

  it('"Próximo" é o primeiro aberto a partir de agora (12:30 -> 14:00)', () => {
    const html = render(DAY);
    expect((html.match(/class="card proximo/g) ?? []).length).toBe(1);
    expect(cardOf(html, 3)).toMatch(/^ proximo"/);
    // Às 15:00 passa a ser o das 16:00; depois do último, ninguém.
    expect(cardOf(render(DAY, { nowTime: '15:00' }), 4)).toMatch(/^ proximo"/);
    expect(render(DAY, { nowTime: '18:00' })).not.toContain('class="card proximo');
  });

  it('não marca "Próximo" em outro dia', () => {
    expect(render(DAY, { date: '2026-11-20', today: '2026-11-19' })).not.toContain('class="card proximo');
  });

  it('finalizados e cancelados ficam esmaecidos; abertos não', () => {
    const html = render(DAY);
    expect(cardOf(html, 1)).toMatch(/^ apagado"/);
    expect(cardOf(html, 5)).toMatch(/^ apagado"/);
    expect(cardOf(html, 2)).not.toContain('apagado');
    expect(cardOf(html, 3)).not.toContain('apagado');
  });

  it('cada status mostra só as ações que valem para ele', () => {
    const html = render(DAY);
    const actions = (n: number) => [...cardOf(html, n).matchAll(/name="acao" value="([a-z]+)"/g)].map((x) => x[1]);
    expect(actions(3)).toEqual(['confirmar', 'finalizar', 'lembrete', 'cancelar']);
    expect(actions(2)).toEqual(['finalizar', 'lembrete', 'cancelar']);
    expect(actions(1)).toEqual(['reabrir']);
    expect(actions(5)).toEqual(['reabrir']);
  });

  it('todo formulário é POST com o token CSRF; cancelar e desfazer pedem confirmação', () => {
    const html = render(DAY);
    const forms = [...html.matchAll(/<form\b[^>]*>[\s\S]*?<\/form>/g)].map((x) => x[0]);
    expect(forms.length).toBe(4 + 3 + 1 + 3 + 1 + 1); // ações dos 5 cartões + sair
    for (const f of forms) {
      expect(f).toMatch(/^<form method="POST" action="\/admin\/tablet\/(acao|sair)"/);
      expect(f).toMatch(/name="csrf" value="[0-9a-f]{40}"/);
      if (/value="(cancelar|reabrir)"/.test(f)) expect(f).toContain('data-confirm="');
      if (/value="(confirmar|finalizar|lembrete)"/.test(f)) expect(f).not.toContain('data-confirm');
    }
  });

  it('lembrete: "registrado" enquanto não há envio automático, "enviado" quando houver', () => {
    const sent = [booking(2, '11:00', 'Confirmado', { reminder_sent_at: '2026-11-20T13:05:00.000Z' })];
    expect(render(sent)).toContain('lembrete registrado 10:05');
    expect(render(sent, { reminderDelivers: true })).toContain('lembrete enviado 10:05');
    expect(render(sent)).toContain('Reenviar lembrete');
  });

  it('mostra até que horas vai o atendimento e avisa de folga ou horário bloqueado', () => {
    const b = [booking(2, '11:00', 'Confirmado', { duration_minutes: 240 })];
    expect(render(b)).toContain('até 15:00');
    expect(render(b, { flags: { dayOff: false, blockedTimes: ['14:00'] } })).toContain('Passa por um horário bloqueado');
    expect(render(b, { flags: { dayOff: true, blockedTimes: [] } })).toContain('Marcado em dia de folga');
  });

  it('mostra a observação da cliente e o nome do serviço gravado no agendamento', () => {
    const b = [booking(2, '11:00', 'Confirmado', { service_id: 'fulani-braids', service_name: 'Fulani Braids', notes: 'Alergia a tinta. Cabelo na cintura.' })];
    const html = render(b);
    expect(html).toContain('<div class="serv">Fulani Braids</div>');
    expect(html).toContain('<div class="obs">Alergia a tinta. Cabelo na cintura.</div>');
    // Sem nome gravado (agendamento antigo), usa o catálogo de reserva.
    expect(render([booking(2, '11:00', 'Confirmado')])).toContain('<div class="serv">Nagô</div>');
  });

  it('observação maliciosa é escapada', () => {
    const html = render([booking(2, '11:00', 'Confirmado', { notes: '<script>alert(1)</script>' })]);
    expect(html).not.toContain('<script>alert');
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
  });

  it('dia vazio', () => {
    expect(render([])).toContain('Nenhum atendimento neste dia.');
  });

  it('recarrega na mesma data; sem data na URL acompanha "hoje"', () => {
    expect(render(DAY)).toContain('var RELOAD_URL = "/admin/tablet";');
    expect(render(DAY, { explicitDate: true, date: '2026-11-21' })).toContain('var RELOAD_URL = "/admin/tablet?data=2026-11-21";');
  });
});

describe('escape de HTML', () => {
  const NASTY = `<script>alert(1)</script>"'><img src=x onerror=alert(2)>&`;

  it('nome, telefone e e-mail maliciosos nunca viram HTML nem JavaScript', () => {
    const html = render([booking(2, '11:00', 'Confirmado', { name: NASTY, phone: NASTY, email: NASTY, service_id: NASTY })]);
    expect(html).not.toContain('<script>alert');
    expect(html).not.toContain('<img');
    expect(html).not.toContain(`"'>`);
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;&quot;&#39;&gt;');
    expect(scripts(html)).toHaveLength(1);
    expect(scripts(html)[0]).not.toContain('alert');
    expect(() => parse(scripts(html)[0], { ecmaVersion: 5 })).not.toThrow();
  });

  it(`nome que tenta fechar a string do confirm() fica só no data-confirm, escapado`, () => {
    const html = render([booking(2, '11:00', 'Confirmado', { name: `'); alert(1); ('` })]);
    expect(html).toContain('data-confirm="Cancelar o horário de &#39;); alert(1); (&#39; às 11:00?"');
    expect(scripts(html)[0]).not.toContain('alert');
  });

  it('esc cobre os cinco caracteres', () => {
    expect(esc(`&<>"'`)).toBe('&amp;&lt;&gt;&quot;&#39;');
    expect(esc(null)).toBe('');
  });

  it('URL de recarga não consegue fechar a tag <script>', () => {
    const code = clientScript('/admin/tablet?data=</script><script>alert(1)');
    expect(code).not.toContain('</script>');
    expect(() => parse(code, { ecmaVersion: 5 })).not.toThrow();
  });
});

describe('datas', () => {
  it('valida YYYY-MM-DD de verdade', () => {
    for (const ok of ['2026-11-20', '2028-02-29']) expect(isValidDate(ok)).toBe(true);
    for (const bad of ['2026-02-30', '2026-13-01', '2026-99-99', '2027-02-29', '20261120', '2026-1-1', ' 2026-11-20', '2026-11-20T00:00', '', null, undefined, 20261120]) expect(isValidDate(bad)).toBe(false);
  });

  it('anterior e próximo viram mês e ano', () => {
    expect(addDays('2026-11-30', 1)).toBe('2026-12-01');
    expect(addDays('2027-01-01', -1)).toBe('2026-12-31');
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
  });

  it('data por extenso em pt-BR', () => {
    expect(longDate('2026-11-20')).toBe('Sexta-feira, 20 de novembro de 2026');
    expect(longDate('2026-03-01')).toBe('Domingo, 1 de março de 2026');
  });
});
