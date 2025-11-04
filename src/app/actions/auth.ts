'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { createClient } from '@/lib/supabase/server'

// Helper para obtener la URL de origen desde los headers
async function getOriginUrl() {
  const headersList = await headers()
  const host = headersList.get('host')
  const protocol = headersList.get('x-forwarded-proto') || 'http'

  // Si el host es 0.0.0.0, usar la variable de entorno
  if (host?.includes('0.0.0.0')) {
    return process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
  }

  return `${protocol}://${host}`
}

export async function signInWithGoogle() {
  const supabase = await createClient()
  const origin = await getOriginUrl()

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${origin}/auth/callback`,
    },
  })

  if (error) {
    redirect('/login?error=auth_error')
  }

  redirect(data.url)
}

export async function signInWithEmail(email: string, password: string) {
  const supabase = await createClient()

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (error) {
    return { error: 'Email o contraseña incorrectos' }
  }

  revalidatePath('/', 'layout')
  redirect('/dashboard')
}

export async function signUpWithEmail(email: string, password: string, fullName: string) {
  const supabase = await createClient()

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName,
      },
    },
  })

  if (error) {
    return { error: 'Error al crear la cuenta. El email podría estar en uso.' }
  }

  revalidatePath('/', 'layout')
  redirect('/dashboard')
}

export async function signOut() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  revalidatePath('/', 'layout')
  redirect('/login')
}

export async function getUser() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return user
}