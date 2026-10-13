import {Suspense} from 'react';import {Shell} from '@/components/Shell';import {BookingForm} from '@/components/BookingForm';import {getActiveServices,getTimeSlots} from '@/lib/settings';
export const dynamic='force-dynamic';
export default async function Page(){const [services,timeSlots]=await Promise.all([getActiveServices(),getTimeSlots()]);return <Shell><Suspense fallback={null}><BookingForm services={services} timeSlots={timeSlots}/></Suspense></Shell>}
