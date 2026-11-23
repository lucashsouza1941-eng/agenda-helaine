import { describe, expect, it } from 'vitest';
import { bookingServiceName, CATEGORY_LABELS, services, slugify } from '@/lib/data';

describe('id de serviço novo (slugify)', () => {
  it('tira acentos, espaços e símbolos', () => {
    expect(slugify('Nagô desenho coração')).toBe('nago-desenho-coracao');
    expect(slugify('  Box Braids!  ')).toBe('box-braids');
    expect(slugify('Corte reto (alinhamento)')).toBe('corte-reto-alinhamento');
    expect(slugify('Franja + corte / 2026')).toBe('franja-corte-2026');
  });

  it('respeita o formato e o tamanho que o banco aceita', () => {
    for (const name of ['Tranças Chanel', 'x'.repeat(80), 'a - b', 'Ação & reação', 'Nagô desenho curvas laterais bem compridas mesmo']) {
      const id = slugify(name);
      expect(id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
      expect(id.length).toBeLessThanOrEqual(40);
    }
  });

  it('nome só com símbolos não vira id', () => {
    expect(slugify('!!! ???')).toBe('');
    expect(slugify('')).toBe('');
  });
});

describe('nome do serviço num agendamento', () => {
  it('usa o nome gravado no agendamento', () => {
    expect(bookingServiceName({ service_id: 'fulani-braids', service_name: 'Fulani Braids' })).toBe('Fulani Braids');
  });

  it('agendamento antigo, sem nome gravado, usa o catálogo de reserva', () => {
    expect(bookingServiceName({ service_id: 'box-braids', service_name: null })).toBe('Box Braids');
    expect(bookingServiceName({ service_id: 'box-braids' })).toBe('Box Braids');
  });

  it('serviço desconhecido mostra o id em vez de quebrar', () => {
    expect(bookingServiceName({ service_id: 'sumiu' })).toBe('sumiu');
  });
});

describe('catálogo de reserva', () => {
  it('todo serviço tem uma categoria que o site sabe mostrar', () => {
    for (const s of services) expect(Object.keys(CATEGORY_LABELS)).toContain(s.category);
  });
});
