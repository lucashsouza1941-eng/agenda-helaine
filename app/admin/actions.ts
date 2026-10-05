'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createAuthClient, supabaseConfigured } from '@/lib/supabase/server';
import { bookingStatuses, type BookingStatus } from '@/lib/data';

export type SignInState = { error: string; email: string };

export async function signIn(_prev: SignInState, formData: FormData): Promise<SignInState> {
  const email = String(formData.get('email') || '').trim(), password = String(formData.get('password') || '');
  if (!supabaseConfigured()) return { error: 'Supabase ainda não configurado (veja o README).', email };
  const supabase = await createAuthClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: 'E-mail ou senha incorretos.', email };
  redirect('/admin');
}

export async function signOut() {
  const supabase = await createAuthClient();
  await supabase.auth.signOut();
  redirect('/admin/login');
}

// A permissão é garantida pelo RLS: só quem está na tabela admins consegue alterar.
export async function setBookingStatus(id: string, status: BookingStatus) {
  if (!bookingStatuses.includes(status)) return;
  const supabase = await createAuthClient();
  const { error } = await supabase.from('bookings').update({ status }).eq('id', id);
  if (error) console.error('setBookingStatus', error);
  revalidatePath('/admin');
}
