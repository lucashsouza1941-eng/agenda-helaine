'use client';
import { createContext, useContext, useEffect, useState } from 'react';
import type { Service } from '@/lib/data';

export type Booking = { id:string; service:Service; date:string; time:string; name:string; phone:string; email:string; status:'Confirmado'|'Pendente' };
type Ctx={ bookings:Booking[]; addBooking:(b:Omit<Booking,'id'|'status'>)=>Booking };
const BookingContext=createContext<Ctx|null>(null);
export function BookingProvider({children}:{children:React.ReactNode}){
 const [bookings,setBookings]=useState<Booking[]>([]);
 useEffect(()=>{try{setBookings(JSON.parse(localStorage.getItem('ht-bookings')||'[]'))}catch{}},[]);
 const addBooking=(b:Omit<Booking,'id'|'status'>)=>{const item={...b,id:String(Date.now()),status:'Confirmado' as const}; const next=[item,...bookings]; setBookings(next); localStorage.setItem('ht-bookings',JSON.stringify(next)); return item};
 return <BookingContext.Provider value={{bookings,addBooking}}>{children}</BookingContext.Provider>
}
export const useBookings=()=>{const ctx=useContext(BookingContext);if(!ctx) throw new Error('BookingProvider ausente');return ctx}
