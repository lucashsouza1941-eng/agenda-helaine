import Link from 'next/link';
import { promoPeriod, type Promotion } from '@/lib/promo';

/** Cartão de uma promoção. `serviceName` é o serviço em promoção, ou null se vale para todos. */
export function PromoCard({ p, serviceName, today }: { p: Promotion; serviceName: string | null; today: string }) {
  // O link já leva o serviço e o primeiro dia em que a promoção vale.
  const date = p.starts_on > today ? p.starts_on : today;
  const href = `/agendar?${p.service_id ? `servico=${p.service_id}&` : ''}data=${date}`;
  return <article className="promo-card">
    <span className="promo-tag">Promoção · {promoPeriod(p)}</span>
    <h3>{p.title}</h3>
    {p.description && <p>{p.description}</p>}
    <div className="promo-meta"><span>{serviceName ?? 'Todos os serviços'}</span><b>{p.price}</b></div>
    <Link className="text-link" href={href}>Agendar com a promoção →</Link>
  </article>;
}
