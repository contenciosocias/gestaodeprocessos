import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

/** Falso quando as variáveis de ambiente não foram configuradas (mostra aviso na UI). */
export const isSupabaseConfigured = Boolean(url && anonKey)

// A anon key é PÚBLICA por natureza (vai no bundle estático). Sem login, qualquer
// pessoa com a URL + anon key acessa os dados. Aceitável para o MVP interno;
// endurecer com Supabase Auth depois (ver README, seção "Segurança").
export const supabase = createClient(url ?? 'http://localhost', anonKey ?? 'anon')
