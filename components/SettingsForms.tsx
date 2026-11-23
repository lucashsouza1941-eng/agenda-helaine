'use client';
import { useActionState } from 'react';
import { addService, saveOpeningSlots, saveServices } from '@/app/admin/actions';
import { CATEGORY_LABELS, type ServiceCategory } from '@/lib/data';
import type { ServiceWithStatus } from '@/lib/settings';

function Feedback({ state }: { state: { error: string; ok: string } }) {
  return <>{state.error && <p className="form-error" role="alert">{state.error}</p>}{state.ok && <p className="form-ok" role="status">{state.ok}</p>}</>;
}

const hours = (minutes: number) => String(minutes / 60).replace('.', ',');

function ServiceFields({ suffix, s }: { suffix: string; s?: ServiceWithStatus }) {
  return <div className="fields">
    <label>Nome<input name={`name${suffix}`} defaultValue={s?.name} required minLength={2} maxLength={60} placeholder="Ex.: Fulani Braids" /></label>
    <label>Aparece em<select name={`category${suffix}`} defaultValue={s?.category ?? 'tranca'}>{(Object.keys(CATEGORY_LABELS) as ServiceCategory[]).map((c) => <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>)}</select></label>
    <label>Preço<input name={`price${suffix}`} defaultValue={!s || s.price === 'A definir' ? '' : s.price} maxLength={40} placeholder="Ex.: a partir de R$ 250,00" /></label>
    <label>Duração (texto que a cliente lê)<input name={`duration${suffix}`} defaultValue={s?.duration} maxLength={40} placeholder="Ex.: 3 a 4 horas" /></label>
    <label>Tempo reservado na agenda (horas)<input name={`hours${suffix}`} defaultValue={s ? hours(s.minutes) : ''} inputMode="decimal" required maxLength={5} placeholder="Ex.: 4 ou 4,5" /></label>
    {s && <label className="check"><input type="checkbox" name={`active${suffix}`} defaultChecked={s.active} /> Mostrar no site</label>}
    <label className="wide">Descrição<textarea name={`description${suffix}`} defaultValue={s?.description} maxLength={300} rows={2} placeholder="Uma ou duas frases sobre o serviço." /></label>
  </div>;
}

export function ServicesForm({ services, editable }: { services: ServiceWithStatus[]; editable: boolean }) {
  const [state, action, pending] = useActionState(saveServices, { error: '', ok: '' });
  if (!editable) return <p className="form-error">Para criar e editar serviços, rode a migração <b>0008_catalogo.sql</b> no Supabase. Enquanto isso o site mostra os serviços padrão.</p>;
  return <form action={action} className="settings-form">
    {services.map((s) => <details key={s.id} className="service-edit">
      <summary>{s.name} <small>{s.duration} · {s.price}</small>{!s.active && <span className="tag">oculto</span>}</summary>
      <input type="hidden" name="ids" value={s.id} />
      <ServiceFields suffix={`_${s.id}`} s={s} />
    </details>)}
    <p className="muted small">Toque num serviço para editar. Preço em branco aparece como “A definir”. O tempo reservado bloqueia a agenda: enquanto um atendimento não termina, nenhuma cliente consegue marcar outro. Mudar o tempo não altera agendamentos já feitos. Para tirar um serviço do site, desmarque “Mostrar no site”.</p>
    <Feedback state={state} />
    <button className="btn gold" disabled={pending}>{pending ? 'Salvando...' : 'Salvar serviços'}</button>
  </form>;
}

export function AddServiceForm() {
  const [state, action, pending] = useActionState(addService, { error: '', ok: '' });
  // Ao criar com sucesso, a chave muda e o formulário volta em branco.
  return <form action={action} className="settings-form" key={state.ok}>
    <h3>Novo serviço</h3>
    <div className="service-edit"><ServiceFields suffix="" /></div>
    <Feedback state={state} />
    <button className="btn gold" disabled={pending}>{pending ? 'Criando...' : 'Criar serviço'}</button>
  </form>;
}

export function OpeningHoursForm({ options, selected, closingOptions, closing }: { options: string[]; selected: string[]; closingOptions: string[]; closing: string }) {
  const [state, action, pending] = useActionState(saveOpeningSlots, { error: '', ok: '' });
  return <form action={action} className="settings-form">
    <fieldset className="slot-picks">
      <legend>Horários em que as clientes podem agendar</legend>
      {options.map((t) => <label key={t} className="slot-pick"><input type="checkbox" name="times" value={t} defaultChecked={selected.includes(t)} /><span>{t}</span></label>)}
    </fieldset>
    <label>Atendimento até
      <select name="closing" defaultValue={closing}>{closingOptions.map((t) => <option key={t} value={t}>{t}</option>)}</select>
    </label>
    <p className="muted small">Nenhum serviço pode terminar depois desse horário: o site só oferece os horários em que o serviço inteiro cabe.</p>
    <p className="muted small">Vale para todos os dias. Para tirar um dia ou um horário específico, use as folgas e os horários bloqueados.</p>
    <Feedback state={state} />
    <button className="btn gold" disabled={pending}>{pending ? 'Salvando...' : 'Salvar horários'}</button>
  </form>;
}
