import { createServiceClient } from '@/lib/supabase/server';
import { isMissingColumn, isMissingTable } from '@/lib/settings';

/** Quantas fotos a cliente já gerou e quantas a Helaine liberou a mais. null = migração 0012 pendente. */
export async function getTryonUsage(clientId: string): Promise<{ used: number; extra: number } | null> {
  const supabase = createServiceClient();
  const [uses, client] = await Promise.all([
    supabase.from('tryon_uses').select('id', { count: 'exact', head: true }).eq('client_id', clientId),
    supabase.from('clients').select('tryon_extra').eq('id', clientId).maybeSingle(),
  ]);
  const error = uses.error ?? client.error;
  if (error) { if (!isMissingTable(error) && !isMissingColumn(error)) console.error('getTryonUsage', error); return null; }
  return { used: uses.count ?? 0, extra: client.data?.tryon_extra ?? 0 };
}

