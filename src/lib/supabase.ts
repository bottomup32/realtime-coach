
import { createBrowserClient } from '@supabase/ssr'

export function createClient(config?: { url: string; anonKey: string }) {
    return createBrowserClient(
        config?.url || process.env.NEXT_PUBLIC_SUPABASE_URL!,
        config?.anonKey || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
}
