// Promoções: tipos e regras puras (sem banco), usadas no servidor e no navegador.

export type Promotion = {
  id: string; title: string; description: string;
  /** null = vale para todos os serviços. */
  service_id: string | null;
  /** Período em que o atendimento precisa acontecer (AAAA-MM-DD, inclusive nas duas pontas). */
  starts_on: string; ends_on: string;
  price: string; active: boolean;
};

export const PROMO_COLUMNS = 'id, title, description, service_id, starts_on, ends_on, price, active';

/** A promoção vale para este serviço nesta data? */
export const promoApplies = (p: Promotion, serviceId: string, date: string) =>
  p.active && (p.service_id === null || p.service_id === serviceId) && date >= p.starts_on && date <= p.ends_on;

/**
 * A promoção de um agendamento. Se mais de uma servir, ganha a específica do
 * serviço; entre iguais, a que termina primeiro (a mais "urgente").
 */
export function promoFor(promos: Promotion[], serviceId: string, date: string): Promotion | null {
  const matching = promos.filter((p) => promoApplies(p, serviceId, date));
  matching.sort((a, b) => Number(a.service_id === null) - Number(b.service_id === null) || a.ends_on.localeCompare(b.ends_on) || a.id.localeCompare(b.id));
  return matching[0] ?? null;
}

/** Texto gravado no agendamento: "Novembro Negro — R$ 300,00". */
export const promoSnapshot = (p: Promotion) => `${p.title} — ${p.price}`.slice(0, 160);

/** Promoções que ainda podem ser usadas: ativas e que não terminaram. */
export const currentPromos = (promos: Promotion[], today: string) =>
  promos.filter((p) => p.active && p.ends_on >= today).sort((a, b) => a.starts_on.localeCompare(b.starts_on) || a.ends_on.localeCompare(b.ends_on));

/** "20/11 a 30/11" ou "só em 20/11". */
export function promoPeriod(p: Pick<Promotion, 'starts_on' | 'ends_on'>): string {
  const br = (d: string) => d.split('-').reverse().slice(0, 2).join('/');
  return p.starts_on === p.ends_on ? `só em ${br(p.starts_on)}` : `${br(p.starts_on)} a ${br(p.ends_on)}`;
}
