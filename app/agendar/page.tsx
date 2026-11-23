import {Suspense} from 'react';import {Shell} from '@/components/Shell';import {BookingForm} from '@/components/BookingForm';import {getActiveServices,getClosingTime,getCurrentPromotions,getTimeSlots} from '@/lib/settings';
export const metadata={title:'Agendar horário'};
export const dynamic='force-dynamic';
export default async function Page(){const [services,timeSlots,closing,promotions]=await Promise.all([getActiveServices(),getTimeSlots(),getClosingTime(),getCurrentPromotions()]);return <Shell><Suspense fallback={null}><BookingForm services={services} timeSlots={timeSlots} closing={closing} promotions={promotions}/></Suspense></Shell>}
