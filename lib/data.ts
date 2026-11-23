/** minutes: tempo que o serviço ocupa na agenda (duration é só o texto que a cliente lê). */
/** photo: foto do cartão (em public/); image é o gradiente que aparece enquanto ela carrega. */
export type ServiceCategory = 'tranca'|'corte'|'outro';
/** A ordem daqui é a ordem das seções no site. */
export const CATEGORY_LABELS: Record<ServiceCategory,string> = { tranca:'Tranças', corte:'Cortes de cabelo', outro:'Outros serviços' };
export type Service = { id:string; name:string; category:ServiceCategory; duration:string; minutes:number; price:string; description:string; image:string; photo?:string; photoAlt?:string; photoPosition?:string };
// Catálogo de reserva: vale enquanto a tabela `services` (migração 0008) não existir.
// Depois dela, daqui só se aproveitam o gradiente e o enquadramento da foto de cada id.
export const services: Service[] = [
  {id:'box-braids',category:'tranca',name:'Box Braids',duration:'4 a 6 horas',minutes:360,price:'A definir',description:'Tranças tradicionais e versáteis, com acabamento profissional e orientação de cuidados. ',image:'linear-gradient(135deg,#34103f,#8d3f62 55%,#f0a01a)',photo:'/images/servicos/box-braids.jpg',photoAlt:'Mulher de costas com box braids longas até a cintura e argolas douradas',photoPosition:'50% 35%'},
  {id:'nago',category:'tranca',name:'Nagô',duration:'2 a 4 horas',minutes:240,price:'A definir',description:'Tranças rente ao couro cabeludo com desenho e acabamento personalizado.',image:'linear-gradient(135deg,#27132f,#703151 55%,#c87322)',photo:'/images/servicos/nago.jpg',photoAlt:'Mulher de costas com tranças nagô rentes à cabeça, em fileiras até a nuca',photoPosition:'50% 30%'},
  {id:'twist',category:'tranca',name:'Twist',duration:'3 a 5 horas',minutes:300,price:'A definir',description:'Visual leve, versátil e contemporâneo, com diferentes comprimentos.',image:'linear-gradient(135deg,#331743,#7f255f 55%,#e1a12a)',photo:'/images/servicos/twist.jpg',photoAlt:'Mulher de costas com twists longos, torcidos como corda',photoPosition:'45% 35%'},
  {id:'chanel',category:'tranca',name:'Tranças Chanel',duration:'3 a 5 horas',minutes:300,price:'A definir',description:'Elegância, praticidade e identidade em um comprimento marcante.',image:'linear-gradient(135deg,#251029,#5b1e56 55%,#b8761f)',photo:'/images/servicos/chanel.jpg',photoAlt:'Mulher de costas com tranças em corte chanel, na altura do queixo',photoPosition:'50% 35%'},
  {id:'manutencao',category:'outro',name:'Manutenção',duration:'1 a 3 horas',minutes:180,price:'A definir',description:'Cuidado para prolongar a beleza e a durabilidade das suas tranças.',image:'linear-gradient(135deg,#1b1426,#5b2657 55%,#d89e23)',photo:'/images/servicos/manutencao.jpg',photoAlt:'Mãos de uma trancista refazendo a raiz das tranças com um pente de cabo fino',photoPosition:'50% 60%'}
];
/** Horários de início de meia em meia hora, de `from` (inclusive) até `to` (exclusive). */
export const halfHourSlots = (from:string, to:string) => { const out:string[]=[]; const [fh,fm]=from.split(':').map(Number), [th,tm]=to.split(':').map(Number); for(let m=fh*60+fm; m<th*60+tm; m+=30) out.push(`${String(Math.floor(m/60)).padStart(2,'0')}:${m%60?'30':'00'}`); return out; };
/** Horários de atendimento enquanto nada for salvo no /admin: de 30 em 30 min, das 08:00 às 19:30. */
export const timeSlots=halfHourSlots('08:00','20:00');
export const bookingStatuses = ['Pendente', 'Confirmado', 'Finalizado', 'Cancelado'] as const;
export type BookingStatus = typeof bookingStatuses[number];
export type Booking = { id:string; service_id:string; service_name?:string|null; notes?:string|null; date:string; time:string; duration_minutes?:number; name:string; phone:string; email:string|null; status:BookingStatus; created_at:string };
export const serviceName = (id:string) => services.find(s=>s.id===id)?.name ?? id;
/** Nome do serviço de um agendamento: o gravado no dia, ou o do catálogo de reserva. */
export const bookingServiceName = (b:{service_id:string; service_name?:string|null}) => b.service_name || serviceName(b.service_id);
/** Tamanho máximo das observações da cliente (igual ao do banco). */
export const NOTES_MAX = 500;
/** Gradientes para os cartões de serviços sem foto. */
export const CARD_GRADIENTS = ['linear-gradient(135deg,#34103f,#8d3f62 55%,#f0a01a)','linear-gradient(135deg,#27132f,#703151 55%,#c87322)','linear-gradient(135deg,#331743,#7f255f 55%,#e1a12a)','linear-gradient(135deg,#251029,#5b1e56 55%,#b8761f)','linear-gradient(135deg,#1b1426,#5b2657 55%,#d89e23)'];
/** "Box Braids!" -> "box-braids" (id de um serviço novo). */
export const slugify = (text:string) => text.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,40).replace(/-+$/,'');
/** Data de hoje (AAAA-MM-DD) no fuso de São Paulo. */
export const todaySP = () => new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo'}).format(new Date());
/** Hora atual (HH:MM) no fuso de São Paulo. */
export const nowTimeSP = () => new Intl.DateTimeFormat('pt-BR',{timeZone:'America/Sao_Paulo',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date());
/** Horário de hoje que já passou (não dá mais para agendar). */
export const isPastSlot = (date:string,time:string) => date < todaySP() || (date === todaySP() && time <= nowTimeSP());
/** Antecedência mínima (em horas) para a cliente cancelar pelo site. */
export const CANCEL_MIN_HOURS = 24;
/** Horas que faltam para o horário do agendamento (fuso de São Paulo, UTC-3). */
export const hoursUntil = (date:string,time:string) => (Date.parse(`${date}T${time}:00-03:00`) - Date.now()) / 36e5;
export const formatDateBR = (d:string) => d.split('-').reverse().join('/');
/** 'HH:MM' em minutos desde a meia-noite. */
export const toMinutes = (t:string) => { const [h,m]=t.split(':').map(Number); return h*60+m; };
export const fromMinutes = (m:number) => `${String(Math.floor(m/60)%24).padStart(2,'0')}:${String(m%60).padStart(2,'0')}`;
/** 360 -> '6h', 150 -> '2h30'. */
export const formatDuration = (m:number) => `${Math.floor(m/60)}h${m%60?String(m%60).padStart(2,'0'):''}`;
/** Limites do tempo reservado por serviço (iguais aos do banco). */
export const MIN_SERVICE_MINUTES = 30, MAX_SERVICE_MINUTES = 720;
/** Até que horas vai o atendimento, se nada for salvo no /admin. Nenhum serviço termina depois disso. */
export const DEFAULT_CLOSING_TIME = '20:00';
/** Intervalo ocupado na agenda, em minutos desde a meia-noite. */
export type BusyInterval = { start:number; end:number };
/** Por que um serviço de `minutes` não pode começar em `time` (ou null se pode). */
export function slotConflict(time:string, minutes:number, busy:BusyInterval[], blocked:string[], closing=DEFAULT_CLOSING_TIME): 'busy'|'blocked'|'closed'|null {
  const start=toMinutes(time), end=start+minutes;
  if (end>toMinutes(closing)) return 'closed';
  if (blocked.some(b=>{ const m=toMinutes(b); return m>=start && m<end; })) return 'blocked';
  if (busy.some(b=>b.start<end && start<b.end)) return 'busy';
  return null;
}

/** Por que não há nenhum horário para escolher (ou null se há). */
export type NoSlotsReason = 'day-off'|'no-fit'|'past'|'full'|null;
/**
 * Horários em que um serviço de `minutes` pode começar num dia. Só entram os que
 * cabem inteiros: sem atendimento por cima, sem horário bloqueado no meio e
 * terminando até o fechamento. `isPast` diz se um horário de hoje já passou.
 */
export function freeSlots(o:{ slots:string[]; minutes:number; busy:BusyInterval[]; blocked:string[]; closing:string; dayOff:boolean; isPast:(t:string)=>boolean }): { free:string[]; reason:NoSlotsReason } {
  if (o.dayOff) return { free:[], reason:'day-off' };
  const fits = o.slots.filter(t=>slotConflict(t,o.minutes,[],[],o.closing)===null);            // cabe no expediente
  if (fits.length===0) return { free:[], reason:'no-fit' };
  const open = fits.filter(t=>slotConflict(t,o.minutes,o.busy,o.blocked,o.closing)===null);   // e está livre
  const free = open.filter(t=>!o.isPast(t));
  return { free, reason: free.length ? null : open.length ? 'past' : 'full' };
}
