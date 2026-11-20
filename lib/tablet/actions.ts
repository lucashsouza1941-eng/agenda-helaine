import type { BookingStatus } from '@/lib/data';
import { sendReminder } from '@/lib/tablet/reminder';
import type { TabletRepo } from '@/lib/tablet/repo';

/** As únicas ações que o tablet pode pedir. */
export const TABLET_ACTIONS = ['confirmar', 'finalizar', 'cancelar', 'reabrir', 'lembrete'] as const;
export type TabletAction = typeof TABLET_ACTIONS[number];
export const isTabletAction = (a: unknown): a is TabletAction => typeof a === 'string' && (TABLET_ACTIONS as readonly string[]).includes(a);

const OPEN: BookingStatus[] = ['Pendente', 'Confirmado'];

/** De quais status cada ação pode partir e para qual leva. "Agendado" no painel é o status Pendente. */
const TRANSITIONS: Record<Exclude<TabletAction, 'lembrete'>, { from: BookingStatus[]; to: BookingStatus }> = {
  confirmar: { from: ['Pendente'], to: 'Confirmado' },
  finalizar: { from: OPEN, to: 'Finalizado' },
  cancelar: { from: OPEN, to: 'Cancelado' },
  reabrir: { from: ['Finalizado', 'Cancelado'], to: 'Pendente' },
};

export type ActionOk = TabletAction | 'lembrete_registrado';
export type ActionError = 'nao_encontrado' | 'status' | 'ocupado';
export type ActionResult = { ok: true; code: ActionOk } | { ok: false; code: ActionError };

export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Executa uma ação do painel. `id` e `action` já chegam validados pela rota. */
export async function runTabletAction(repo: TabletRepo, id: string, action: TabletAction, now = new Date()): Promise<ActionResult> {
  if (action === 'lembrete') {
    const booking = await repo.get(id);
    if (!booking) return { ok: false, code: 'nao_encontrado' };
    if (!OPEN.includes(booking.status)) return { ok: false, code: 'status' };
    const { delivered } = await sendReminder(booking);
    await repo.markReminderSent(id, now.toISOString());
    return { ok: true, code: delivered ? 'lembrete' : 'lembrete_registrado' };
  }

  const { from, to } = TRANSITIONS[action];
  const result = await repo.transition(id, from, to);
  if (result === 'changed') return { ok: true, code: action };
  if (result === 'conflict') return { ok: false, code: 'ocupado' };
  // Não mudou: ou o agendamento não existe, ou o status atual não permite a ação.
  return { ok: false, code: (await repo.get(id)) ? 'status' : 'nao_encontrado' };
}
