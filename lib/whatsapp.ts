import { formatDateBR, serviceName } from '@/lib/data';

/** Número da Helaine com DDI e DDD, só dígitos (ex.: 5511999999999). Sem ele o botão não aparece. */
const helaineNumber = () => (process.env.NEXT_PUBLIC_WHATSAPP_HELAINE ?? '').replace(/\D/g, '');

/** Link do WhatsApp com a mensagem pronta avisando a Helaine do agendamento. */
export function notifyHelaineLink(b: { service_id: string; date: string; time: string }): string | null {
  const number = helaineNumber();
  if (number.length < 12) return null;
  const text = `Olá, Helaine! Acabei de agendar pelo site: ${serviceName(b.service_id)}, dia ${formatDateBR(b.date)} às ${b.time}.`;
  return `https://wa.me/${number}?text=${encodeURIComponent(text)}`;
}
