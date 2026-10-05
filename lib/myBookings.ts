// IDs dos agendamentos feitos neste aparelho. Os dados ficam no Supabase;
// aqui guardamos só os IDs para a cliente ver "Meus agendamentos" sem login.
const KEY = 'ht-booking-ids';

export function getMyBookingIds(): string[] {
  try { const ids = JSON.parse(localStorage.getItem(KEY) || '[]'); return Array.isArray(ids) ? ids.filter((i) => typeof i === 'string') : []; }
  catch { return []; }
}

export function saveMyBookingId(id: string) {
  try { localStorage.setItem(KEY, JSON.stringify([id, ...getMyBookingIds().filter((i) => i !== id)].slice(0, 50))); }
  catch { /* navegador sem localStorage: o agendamento continua salvo no banco */ }
}
