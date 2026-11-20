import { formatDateBR, serviceName } from '@/lib/data';
import type { TabletBooking } from '@/lib/tablet/repo';

// O projeto ainda não tem envio automático de mensagens: o que existe hoje são
// links wa.me, que só funcionam com o WhatsApp aberto no aparelho de quem clica.
//
// TODO: ligar um provedor de envio (API do WhatsApp Business, Z-API, SMS ou e-mail).
// Quando houver um, implemente o envio em sendReminder, devolva { delivered: true }
// e faça reminderConfigured() devolver true: o painel passa a dizer "lembrete enviado".

/** Existe um provedor de envio ligado? Hoje não. */
export const reminderConfigured = () => false;

export function reminderMessage(b: Pick<TabletBooking, 'name' | 'service_id' | 'date' | 'time'>): string {
  return `Olá, ${b.name.trim().split(/\s+/)[0]}! Lembrete do seu horário na Helaine Tranças: `
    + `${serviceName(b.service_id)}, dia ${formatDateBR(b.date)} às ${b.time}. `
    + 'Se precisar remarcar, é só avisar por aqui.';
}

/** Dispara o lembrete para a cliente. `delivered` diz se a mensagem saiu de verdade. */
export async function sendReminder(b: TabletBooking): Promise<{ delivered: boolean }> {
  // Sem provedor: só registra no log do servidor (telefone mascarado) o que seria enviado.
  const phone = b.phone.replace(/\D/g, '');
  console.log(`[lembrete] agendamento ${b.id}, telefone ***${phone.slice(-4)}: ${reminderMessage(b)}`);
  return { delivered: false };
}
