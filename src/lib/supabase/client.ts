import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

// Función helper para obtener la URL de redirección correcta
export function getAuthRedirectUrl(path: string = '/dashboard') {
  if (typeof window !== 'undefined') {
    return `${window.location.origin}${path}`
  }
  return `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}${path}`
}