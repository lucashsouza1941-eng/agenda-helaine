import { describe, expect, it } from 'vitest';
import { isTabletAction, runTabletAction, TABLET_ACTIONS } from '@/lib/tablet/actions';
import { booking, ID, memoryRepo } from './helpers';

const NOW = new Date('2026-11-20T15:30:00.000Z');

describe('mudança de status', () => {
  it('confirmar: só quem está a confirmar (Pendente)', async () => {
    const m = memoryRepo([booking(1, '09:00', 'Pendente'), booking(2, '10:00', 'Confirmado'), booking(3, '11:00', 'Cancelado'), booking(4, '14:00', 'Finalizado')]);
    expect(await runTabletAction(m.repo, ID(1), 'confirmar')).toEqual({ ok: true, code: 'confirmar' });
    expect(m.find(1).status).toBe('Confirmado');
    for (const n of [2, 3, 4]) {
      const before = m.find(n).status;
      expect(await runTabletAction(m.repo, ID(n), 'confirmar')).toEqual({ ok: false, code: 'status' });
      expect(m.find(n).status).toBe(before);
    }
  });

  it('finalizar: a confirmar ou confirmado viram Finalizado', async () => {
    const m = memoryRepo([booking(1, '09:00', 'Pendente'), booking(2, '10:00', 'Confirmado'), booking(3, '11:00', 'Cancelado')]);
    expect((await runTabletAction(m.repo, ID(1), 'finalizar')).ok).toBe(true);
    expect((await runTabletAction(m.repo, ID(2), 'finalizar')).ok).toBe(true);
    expect(m.find(1).status).toBe('Finalizado');
    expect(m.find(2).status).toBe('Finalizado');
    expect(await runTabletAction(m.repo, ID(3), 'finalizar')).toEqual({ ok: false, code: 'status' });
    expect(m.find(3).status).toBe('Cancelado');
  });

  it('cancelar: só agendamento aberto', async () => {
    const m = memoryRepo([booking(1, '09:00', 'Confirmado'), booking(2, '10:00', 'Finalizado')]);
    expect(await runTabletAction(m.repo, ID(1), 'cancelar')).toEqual({ ok: true, code: 'cancelar' });
    expect(m.find(1).status).toBe('Cancelado');
    expect(await runTabletAction(m.repo, ID(2), 'cancelar')).toEqual({ ok: false, code: 'status' });
    expect(m.find(2).status).toBe('Finalizado');
  });

  it('reabrir (Desfazer): finalizado ou cancelado voltam para Pendente', async () => {
    const m = memoryRepo([booking(1, '09:00', 'Finalizado'), booking(2, '10:00', 'Cancelado'), booking(3, '11:00', 'Confirmado')]);
    expect((await runTabletAction(m.repo, ID(1), 'reabrir')).ok).toBe(true);
    expect((await runTabletAction(m.repo, ID(2), 'reabrir')).ok).toBe(true);
    expect(m.find(1).status).toBe('Pendente');
    expect(m.find(2).status).toBe('Pendente');
    expect(await runTabletAction(m.repo, ID(3), 'reabrir')).toEqual({ ok: false, code: 'status' });
    expect(m.find(3).status).toBe('Confirmado');
  });

  it('reabrir um cancelado cujo horário já foi ocupado por outra cliente dá erro e não muda nada', async () => {
    const m = memoryRepo([booking(1, '09:00', 'Cancelado'), booking(2, '09:00', 'Pendente')]);
    expect(await runTabletAction(m.repo, ID(1), 'reabrir')).toEqual({ ok: false, code: 'ocupado' });
    expect(m.find(1).status).toBe('Cancelado');
  });

  it('agendamento que não existe', async () => {
    const m = memoryRepo([booking(1, '09:00', 'Pendente')]);
    for (const a of TABLET_ACTIONS) expect(await runTabletAction(m.repo, ID(99), a)).toEqual({ ok: false, code: 'nao_encontrado' });
    expect(m.find(1).status).toBe('Pendente');
  });
});

describe('lembrete', () => {
  it('grava a hora do lembrete e avisa que nada foi enviado (não há provedor)', async () => {
    const m = memoryRepo([booking(1, '09:00', 'Confirmado')]);
    expect(await runTabletAction(m.repo, ID(1), 'lembrete', NOW)).toEqual({ ok: true, code: 'lembrete_registrado' });
    expect(m.find(1).reminder_sent_at).toBe(NOW.toISOString());
    expect(m.find(1).status).toBe('Confirmado');
  });

  it('não manda lembrete de agendamento finalizado ou cancelado', async () => {
    const m = memoryRepo([booking(1, '09:00', 'Cancelado'), booking(2, '10:00', 'Finalizado')]);
    for (const n of [1, 2]) {
      expect(await runTabletAction(m.repo, ID(n), 'lembrete', NOW)).toEqual({ ok: false, code: 'status' });
      expect(m.find(n).reminder_sent_at).toBeNull();
    }
  });
});

describe('lista de ações permitidas', () => {
  it('só as 5 ações do painel', () => {
    expect([...TABLET_ACTIONS].sort()).toEqual(['cancelar', 'confirmar', 'finalizar', 'lembrete', 'reabrir']);
    for (const a of ['apagar', 'delete', 'Confirmar', '', 'confirmar ', '__proto__', 'constructor', 'toString', null, undefined, 1]) expect(isTabletAction(a)).toBe(false);
  });
});
