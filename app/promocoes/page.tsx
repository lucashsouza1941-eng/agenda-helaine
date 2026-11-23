import Link from 'next/link';
import { Shell } from '@/components/Shell';
import { PromoCard } from '@/components/PromoCard';
import { todaySP } from '@/lib/data';
import { getCurrentPromotions, getServices } from '@/lib/settings';

export const metadata = { title: 'Promoções' };
export const revalidate = 300;

export default async function Page() {
  const [promos, services] = await Promise.all([getCurrentPromotions(), getServices()]);
  const today = todaySP();
  const nameOf = (id: string | null) => (id ? services.find((s) => s.id === id)?.name ?? null : null);
  // Promoção de um serviço que saiu do site não aparece.
  const visible = promos.filter((p) => p.service_id === null || services.some((s) => s.id === p.service_id && s.active));
  return <Shell><main className="page">
    <div className="page-title"><span className="eyebrow dark">Helaine Tranças</span><h1>Promoções</h1><p>A promoção vale para atendimentos marcados dentro do período de cada uma.</p></div>
    {visible.length === 0
      ? <div className="empty"><h2>Nenhuma promoção no momento.</h2><p>Volte em breve ou agende seu horário normalmente.</p><Link className="btn gold" href="/agendar">Agendar →</Link></div>
      : <div className="promo-list">{visible.map((p) => <PromoCard key={p.id} p={p} serviceName={nameOf(p.service_id)} today={today} />)}</div>}
  </main></Shell>;
}
