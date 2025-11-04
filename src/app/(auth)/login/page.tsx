import LoginForm from '@/components/auth/LoginForm'
import AuthDivider from '@/components/auth/AuthDivider'
import SignInButton from '@/components/auth/SignInButton'
import Link from 'next/link'

export default function LoginPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Bienvenido</h1>
          <p className="text-gray-600">Inicia sesión en tu cuenta</p>
        </div>

        <div className="bg-white p-8 rounded-lg shadow-sm border border-gray-200">
          <LoginForm />
          
          <AuthDivider />
          
          <SignInButton />
          
          <div className="mt-6 text-center">
            <p className="text-sm text-gray-600">
              ¿No tienes una cuenta?{' '}
              <Link href="/register" className="text-blue-600 hover:text-blue-700 font-medium">
                Regístrate
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}