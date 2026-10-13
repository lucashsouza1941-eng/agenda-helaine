'use client';
import { useActionState } from 'react';
import { saveOpeningSlots, saveServices } from '@/app/admin/actions';
import type { ServiceWithStatus } from '@/lib/settings';

function Feedback({ state }: { state: { error: string; ok: string } }) {
  return <>{state.error && <p className="form-error" role="alert">{state.error}</p>}{state.ok && <p className="form-ok" role="status">{state.ok}</p>}</>;
}

export function ServicesForm({ services }: { services: ServiceWithStatus[] }) {
  const [state, action, pending] = useActionState(saveServices, { error: '', ok: '' });
  return <form action={action} className="settings-form">
    {services.map((s) => <fieldset key={s.id} className="service-row">
      <legend>{s.name}</legend>
      <label>Preço<input name={`price_${s.id}`} defaultValue={s.price === 'A definir' ? '' : s.price} maxLength={40} placeholder="Ex.: R$ 250 ou a partir de R$ 200" /></label>
      <label>Duração<input name={`duration_${s.id}`} defaultValue={s.duration} maxLength={40} placeholder="Ex.: 3 a 4 horas" /></label>
      <label className="check"><input type="checkbox" name={`active_${s.id}`} defaultChecked={s.active} /> Mostrar no site</label>
    </fieldset>)}
    <p className="muted small">Preço em branco aparece como “A definir”.</p>
    <Feedback state={state} />
    <button className="btn gold" disabled={pending}>{pending ? 'Salvando...' : 'Salvar serviços'}</button>
  </form>;
}

export function OpeningHoursForm({ options, selected }: { options: string[]; selected: string[] }) {
  const [state, action, pending] = useActionState(saveOpeningSlots, { error: '', ok: '' });
  return <form action={action} className="settings-form">
    <fieldset className="slot-picks">
      <legend>Horários em que as clientes podem agendar</legend>
      {options.map((t) => <label key={t} className="slot-pick"><input type="checkbox" name="times" value={t} defaultChecked={selected.includes(t)} /><span>{t}</span></label>)}
    </fieldset>
    <p className="muted small">Vale para todos os dias. Para tirar um dia ou um horário específico, use as folgas e os horários bloqueados.</p>
    <Feedback state={state} />
    <button className="btn gold" disabled={pending}>{pending ? 'Salvando...' : 'Salvar horários'}</button>
  </form>;
}
