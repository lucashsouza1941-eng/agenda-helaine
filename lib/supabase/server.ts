import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

const url = () => process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = () => process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = () => process.env.SUPABASE_SERVICE_ROLE_KEY;

export const supabaseConfigured = () => Boolean(url() && anonKey() && serviceKey());

/** Cliente com a sessão do usuário logado (admin). Respeita as regras de RLS. */
export async function createAuthClient() {
  const cookieStore = await cookies();
  return createServerClient(url()!, anonKey()!, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (list) => {
        try { list.forEach(({ name, value, options }) => cookieStore.set(name, value, options)); }
        catch { /* chamado de um Server Component: o proxy.ts renova a sessão */ }
      },
    },
  });
}

/** Cliente com a service role key. Só no servidor: ignora RLS. */
export function createServiceClient() {
  return createClient(url()!, serviceKey()!, { auth: { persistSession: false, autoRefreshToken: false } });
}
