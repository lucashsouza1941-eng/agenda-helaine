'use client';
import { useActionState } from 'react';
import { addPromotion } from '@/app/admin/actions';
import { todaySP } from '@/lib/data';

export function PromotionForm({ services }: { services: { id: string; name: string }[] }) {
  const [state, action, pending] = useActionState(addPromotion, { error: '', ok: '' });
  const today = todaySP();
  // Ao criar com sucesso, a chave muda e o formulário volta em branco.
  return <form action={action} className="promo-form" key={state.ok}>
    <label>Nome da promoção<input name="title" required minLength={2} maxLength={80} placeholder="Ex.: Semana da Consciência Negra" /></label>
    <label>Serviço<select name="service_id" defaultValue=""><option value="">Todos os serviços</option>{services.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
    <label>Preço ou desconto<input name="price" required maxLength={60} placeholder="Ex.: R$ 300,00 ou 10% de desconto" /></label>
    <label>Vale para atendimentos de<input name="from" type="date" required min={today} /></label>
    <label>Até (opcional)<input name="to" type="date" min={today} /></label>
    <label className="wide">Descrição (opcional)<textarea name="description" maxLength={300} rows={2} placeholder="Ex.: Vagas limitadas. Garanta seu horário com antecedência." /></label>
    {state.error && <p className="form-error" role="alert">{state.error}</p>}
    {state.ok && <p className="form-ok" role="status">{state.ok}</p>}
    <button className="btn gold wide" disabled={pending}>{pending ? 'Criando...' : 'Criar promoção'}</button>
  </form>;
}
