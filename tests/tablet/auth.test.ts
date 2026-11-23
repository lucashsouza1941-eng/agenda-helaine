import { beforeEach, describe, expect, it } from 'vitest';
import {
  checkPin, createSession, csrfToken, loginBlockedMinutes, MAX_FAILS_PER_IP, MAX_FAILS_TOTAL, recordLoginFailure,
  resetLoginLimiterForTests, SESSION_SECONDS, sessionCookie, tabletConfigured, validCsrf, validSession,
} from '@/lib/tablet/auth';
import { PIN, setEnv } from './helpers';

beforeEach(() => { setEnv(); resetLoginLimiterForTests(); });

describe('PIN', () => {
  it('aceita só o PIN certo', () => {
    expect(checkPin(PIN)).toBe(true);
    expect(checkPin('000000')).toBe(false);
    expect(checkPin('')).toBe(false);
    expect(checkPin(PIN + '0')).toBe(false);
  });

  it('sem TABLET_PIN (ou com PIN curto) o painel fica desligado e nada passa', () => {
    delete process.env.TABLET_PIN;
    expect(tabletConfigured()).toBe(false);
    expect(checkPin('')).toBe(false);
    process.env.TABLET_PIN = '12';
    expect(tabletConfigured()).toBe(false);
    expect(checkPin('12')).toBe(false);
  });
});

describe('sessão', () => {
  it('vale por 1 ano e expira depois', () => {
    const now = Date.UTC(2026, 10, 20);
    const s = createSession(now);
    expect(validSession(s, now)).toBe(true);
    expect(validSession(s, now + (SESSION_SECONDS - 60) * 1000)).toBe(true);
    expect(validSession(s, now + (SESSION_SECONDS + 60) * 1000)).toBe(false);
  });

  it('recusa cookie forjado ou adulterado', () => {
    const s = createSession();
    const [exp, sig] = s.split('.');
    expect(validSession(`${Number(exp) + 1}.${sig}`)).toBe(false);
    expect(validSession(`${exp}.${'0'.repeat(sig.length)}`)).toBe(false);
    expect(validSession(PIN)).toBe(false);
    expect(validSession('')).toBe(false);
    expect(validSession(null)).toBe(false);
    expect(validSession(`${exp}.${sig}.extra`)).toBe(false);
  });

  it('o cookie não contém o PIN', () => {
    expect(createSession()).not.toContain(PIN);
  });

  it('trocar o PIN derruba as sessões antigas', () => {
    const s = createSession();
    process.env.TABLET_PIN = '999999';
    expect(validSession(s)).toBe(false);
  });

  it('cookie HttpOnly, 1 ano, só em /admin/tablet; Secure só em HTTPS', () => {
    const http = sessionCookie('abc', false);
    expect(http).toContain('HttpOnly');
    expect(http).toContain('Path=/admin/tablet');
    expect(http).toContain(`Max-Age=${60 * 60 * 24 * 365}`);
    expect(http).toContain('SameSite=Lax');
    expect(http).not.toContain('Secure');
    expect(sessionCookie('abc', true)).toContain('Secure');
  });
});

describe('CSRF', () => {
  it('o token é preso à sessão', () => {
    const a = createSession(Date.UTC(2026, 0, 1)), b = createSession(Date.UTC(2026, 0, 2));
    expect(validCsrf(a, csrfToken(a))).toBe(true);
    expect(validCsrf(a, csrfToken(b))).toBe(false);
    expect(validCsrf(a, '')).toBe(false);
    expect(validCsrf(a, null)).toBe(false);
  });
});

describe('limite de tentativas', () => {
  it(`bloqueia o IP depois de ${MAX_FAILS_PER_IP} erros e libera após 10 minutos`, () => {
    const now = Date.UTC(2026, 10, 20, 12);
    for (let i = 0; i < MAX_FAILS_PER_IP - 1; i++) recordLoginFailure('1.1.1.1', now);
    expect(loginBlockedMinutes('1.1.1.1', now)).toBe(0);
    recordLoginFailure('1.1.1.1', now);
    expect(loginBlockedMinutes('1.1.1.1', now)).toBe(10);
    expect(loginBlockedMinutes('2.2.2.2', now)).toBe(0);
    expect(loginBlockedMinutes('1.1.1.1', now + 10 * 60 * 1000 + 1)).toBe(0);
  });

  it(`teto geral de ${MAX_FAILS_TOTAL} erros, mesmo trocando de IP`, () => {
    const now = Date.UTC(2026, 10, 20, 12);
    for (let i = 0; i < MAX_FAILS_TOTAL; i++) recordLoginFailure(`10.0.0.${i}`, now);
    expect(loginBlockedMinutes('10.9.9.9', now)).toBeGreaterThan(0);
  });
});
