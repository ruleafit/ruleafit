import { createClient } from '@supabase/supabase-js'

// Cliente admin: SOLO servidor. Usa la service role key, que se salta RLS.
// NUNCA importar este archivo en un componente cliente.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

export const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
})
