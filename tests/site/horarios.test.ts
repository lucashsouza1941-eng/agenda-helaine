import { describe, expect, it } from 'vitest';
import { freeSlots, halfHourSlots, timeSlots, toMinutes, type BusyInterval } from '@/lib/data';

const at = (time: string, minutes: number): BusyInterval => ({ start: toMinutes(time), end: toMinutes(time) + minutes });
const day = (minutes: number, extra: Partial<Parameters<typeof freeSlots>[0]> = {}) =>
  freeSlots({ slots: timeSlots, minutes, busy: [], blocked: [], closing: '20:00', dayOff: false, isPast: () => false, ...extra });

describe('horários padrão', () => {
  it('de 30 em 30 minutos, das 08:00 às 19:30', () => {
    expect(timeSlots).toHaveLength(24);
    expect(timeSlots[0]).toBe('08:00');
    expect(timeSlots[1]).toBe('08:30');
    expect(timeSlots.at(-1)).toBe('19:30');
  });

  it('halfHourSlots respeita o início e não inclui o fim', () => {
    expect(halfHourSlots('09:30', '11:00')).toEqual(['09:30', '10:00', '10:30']);
    expect(halfHourSlots('10:00', '10:00')).toEqual([]);
  });
});

describe('horários livres para um serviço', () => {
  it('dia vazio: o último horário é o que termina no fechamento', () => {
    expect(day(60).free.at(-1)).toBe('19:00');    // corte de 1h
    expect(day(90).free.at(-1)).toBe('18:30');    // 1h30
    expect(day(360).free.at(-1)).toBe('14:00');   // box braids, 6h
    expect(day(420).free).toEqual(['08:00', '08:30', '09:00', '09:30', '10:00', '10:30', '11:00', '11:30', '12:00', '12:30', '13:00']); // knotless, 7h
    expect(day(60).reason).toBeNull();
  });

  it('agenda ocupada no meio do dia: sobram os horários antes e depois (caso do app antigo)', () => {
    // Atendimento das 11:00 às 17:30; corte de 1h -> 08:00 a 10:00 e 17:30 a 19:00.
    const r = day(60, { busy: [at('11:00', 390)] });
    expect(r.free).toEqual(['08:00', '08:30', '09:00', '09:30', '10:00', '17:30', '18:00', '18:30', '19:00']);
  });

  it('o serviço precisa caber inteiro antes do próximo atendimento', () => {
    // Livre das 08:00 às 11:00: 1h30 pode começar até 09:30; 3h só às 08:00; 4h não cabe de manhã.
    const busy = [at('11:00', 540)];
    expect(day(90, { busy }).free).toEqual(['08:00', '08:30', '09:00', '09:30']);
    expect(day(180, { busy }).free).toEqual(['08:00']);
    expect(day(240, { busy })).toEqual({ free: [], reason: 'full' });
  });

  it('atendimento que termina em horário quebrado libera o horário seguinte', () => {
    // 08:00 + 1h30 termina 09:30: 09:00 continua ocupado, 09:30 fica livre.
    const r = day(60, { busy: [at('08:00', 90)] });
    expect(r.free.slice(0, 2)).toEqual(['09:30', '10:00']);
  });

  it('horário bloqueado tira os inícios que passariam por cima dele', () => {
    const r = day(60, { blocked: ['12:00', '12:30', '13:00', '13:30'] });
    expect(r.free).not.toContain('11:30');
    expect(r.free).not.toContain('12:00');
    expect(r.free).not.toContain('13:30');
    expect(r.free).toContain('11:00');
    expect(r.free).toContain('14:00');
  });

  it('diz o motivo quando não há horário', () => {
    expect(day(60, { dayOff: true })).toEqual({ free: [], reason: 'day-off' });
    expect(day(60, { busy: [at('08:00', 720)] })).toEqual({ free: [], reason: 'full' });
    // 8h não cabe entre 13:00 e 20:00 em dia nenhum.
    expect(day(480, { slots: halfHourSlots('13:00', '20:00') })).toEqual({ free: [], reason: 'no-fit' });
    // Hoje à noite: havia horário, mas todos já passaram.
    expect(day(60, { isPast: () => true })).toEqual({ free: [], reason: 'past' });
  });

  it('hoje: some só o que já passou', () => {
    const r = day(60, { isPast: (t) => t <= '15:10' });
    expect(r.free[0]).toBe('15:30');
  });

  it('respeita os horários que a Helaine marcou no admin e o fechamento dela', () => {
    const slots = ['09:00', '10:00', '11:00', '14:00', '15:00', '16:00', '17:00'];
    expect(day(180, { slots, closing: '18:00' }).free).toEqual(['09:00', '10:00', '11:00', '14:00', '15:00']);
  });
});
