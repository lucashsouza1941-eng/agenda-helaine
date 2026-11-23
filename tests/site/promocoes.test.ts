import { describe, expect, it } from 'vitest';
import { currentPromos, promoApplies, promoFor, promoPeriod, promoSnapshot, type Promotion } from '@/lib/promo';

const promo = (extra: Partial<Promotion> = {}): Promotion => ({
  id: 'p1', title: 'Novembro Negro', description: '', service_id: 'box-braids',
  starts_on: '2026-11-20', ends_on: '2026-11-30', price: 'R$ 300,00', active: true, ...extra,
});

describe('quando a promoção vale', () => {
  it('só dentro do período (as duas pontas contam)', () => {
    const p = promo();
    expect(promoApplies(p, 'box-braids', '2026-11-19')).toBe(false);
    expect(promoApplies(p, 'box-braids', '2026-11-20')).toBe(true);
    expect(promoApplies(p, 'box-braids', '2026-11-30')).toBe(true);
    expect(promoApplies(p, 'box-braids', '2026-12-01')).toBe(false);
  });

  it('só para o serviço dela; sem serviço, vale para todos', () => {
    expect(promoApplies(promo(), 'nago', '2026-11-25')).toBe(false);
    expect(promoApplies(promo({ service_id: null }), 'nago', '2026-11-25')).toBe(true);
    expect(promoApplies(promo({ service_id: null }), 'corte-pixie', '2026-11-25')).toBe(true);
  });

  it('pausada não vale', () => {
    expect(promoApplies(promo({ active: false }), 'box-braids', '2026-11-25')).toBe(false);
  });

  it('promoção de um dia só', () => {
    const p = promo({ starts_on: '2026-11-20', ends_on: '2026-11-20' });
    expect(promoApplies(p, 'box-braids', '2026-11-20')).toBe(true);
    expect(promoApplies(p, 'box-braids', '2026-11-21')).toBe(false);
  });
});

describe('qual promoção entra no agendamento', () => {
  it('nenhuma, se nada serve', () => {
    expect(promoFor([promo()], 'nago', '2026-11-25')).toBeNull();
    expect(promoFor([], 'box-braids', '2026-11-25')).toBeNull();
  });

  it('a do serviço ganha da que vale para todos, em qualquer ordem', () => {
    const geral = promo({ id: 'g', title: 'Geral', service_id: null, price: '10% de desconto' });
    const dela = promo({ id: 's', title: 'Só Box Braids' });
    expect(promoFor([geral, dela], 'box-braids', '2026-11-25')?.id).toBe('s');
    expect(promoFor([dela, geral], 'box-braids', '2026-11-25')?.id).toBe('s');
    expect(promoFor([geral, dela], 'nago', '2026-11-25')?.id).toBe('g');
  });

  it('entre duas iguais, a que termina primeiro', () => {
    const longa = promo({ id: 'a', ends_on: '2026-12-31' }), curta = promo({ id: 'b', ends_on: '2026-11-26' });
    expect(promoFor([longa, curta], 'box-braids', '2026-11-25')?.id).toBe('b');
  });

  it('não muda a lista recebida', () => {
    const list = [promo({ id: 'z', service_id: null }), promo({ id: 'a' })];
    promoFor(list, 'box-braids', '2026-11-25');
    expect(list.map((p) => p.id)).toEqual(['z', 'a']);
  });
});

describe('promoções à mostra no site', () => {
  it('só ativas e que ainda não terminaram, em ordem de início', () => {
    const list = [
      promo({ id: 'vencida', starts_on: '2026-10-01', ends_on: '2026-10-31' }),
      promo({ id: 'futura', starts_on: '2026-12-10', ends_on: '2026-12-20' }),
      promo({ id: 'pausada', active: false }),
      promo({ id: 'agora' }),
      promo({ id: 'ultimo-dia', starts_on: '2026-11-01', ends_on: '2026-11-23' }),
    ];
    expect(currentPromos(list, '2026-11-23').map((p) => p.id)).toEqual(['ultimo-dia', 'agora', 'futura']);
  });
});

describe('textos', () => {
  it('período', () => {
    expect(promoPeriod(promo())).toBe('20/11 a 30/11');
    expect(promoPeriod(promo({ ends_on: '2026-11-20' }))).toBe('só em 20/11');
  });

  it('o que fica gravado no agendamento cabe na coluna (160)', () => {
    expect(promoSnapshot(promo())).toBe('Novembro Negro — R$ 300,00');
    expect(promoSnapshot(promo({ title: 'x'.repeat(80), price: 'y'.repeat(60) })).length).toBeLessThanOrEqual(160);
  });
});
