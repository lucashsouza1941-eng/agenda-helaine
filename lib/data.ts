/** minutes: tempo que o serviço ocupa na agenda (duration é só o texto que a cliente lê). */
export type Service = { id:string; name:string; duration:string; minutes:number; price:string; description:string; image:string };
export const services: Service[] = [
  {id:'box-braids',name:'Box Braids',duration:'4 a 6 horas',minutes:360,price:'A definir',description:'Tranças tradicionais e versáteis, com acabamento profissional e orientação de cuidados. ',image:'linear-gradient(135deg,#34103f,#8d3f62 55%,#f0a01a)'},
  {id:'nago',name:'Nagô',duration:'2 a 4 horas',minutes:240,price:'A definir',description:'Tranças rente ao couro cabeludo com desenho e acabamento personalizado.',image:'linear-gradient(135deg,#27132f,#703151 55%,#c87322)'},
  {id:'twist',name:'Twist',duration:'3 a 5 horas',minutes:300,price:'A definir',description:'Visual leve, versátil e contemporâneo, com diferentes comprimentos.',image:'linear-gradient(135deg,#331743,#7f255f 55%,#e1a12a)'},
  {id:'chanel',name:'Tranças Chanel',duration:'3 a 5 horas',minutes:300,price:'A definir',description:'Elegância, praticidade e identidade em um comprimento marcante.',image:'linear-gradient(135deg,#251029,#5b1e56 55%,#b8761f)'},
  {id:'manutencao',name:'Manutenção',duration:'1 a 3 horas',minutes:180,price:'A definir',description:'Cuidado para prolongar a beleza e a durabilidade das suas tranças.',image:'linear-gradient(135deg,#1b1426,#5b2657 55%,#d89e23)'}
];
export const timeSlots=['09:00','10:00','11:00','14:00','15:00','16:00','17:00'];
export const bookingStatuses = ['Pendente', 'Confirmado', 'Cancelado'] as const;
export type BookingStatus = typeof bookingStatuses[number];
export type Booking = { id:string; service_id:string; date:string; time:string; duration_minutes?:number; name:string; phone:string; email:string|null; status:BookingStatus; created_at:string };
export const serviceName = (id:string) => services.find(s=>s.id===id)?.name ?? id;
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
