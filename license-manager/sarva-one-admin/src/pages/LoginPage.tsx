import { useState } from 'react'
import type { FormEvent } from 'react'
import { KeyRound, Shield, Mail, Lock } from 'lucide-react'
import { useMutation } from '@tanstack/react-query'
import { Navigate, useNavigate } from 'react-router-dom'
import { api, getToken, setToken } from '../lib'
import { Button, Input, Card } from '../components/ui'

export default function LoginPage() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  const mutation = useMutation({
    mutationFn: () => api.login(email, password),
    onSuccess: (data) => {
      setToken(data.token)
      navigate('/', { replace: true })
    },
  })

  function submit(event: FormEvent) {
    event.preventDefault()
    mutation.mutate()
  }

  if (getToken()) return <Navigate to="/" replace />

  return (
    <main className="relative flex min-h-screen items-center justify-center bg-brand-midnight px-4 py-12 overflow-hidden">
      {/* Background Graphic Blobs */}
      <div className="pointer-events-none absolute -left-1/4 -top-1/4 h-[70vw] w-[70vw] rounded-full bg-brand-primary/10 blur-[120px] animate-pulse duration-[8s]" />
      <div className="pointer-events-none absolute -right-1/4 -bottom-1/4 h-[70vw] w-[70vw] rounded-full bg-brand-secondary/10 blur-[120px] animate-pulse duration-[12s]" />
      <div className="absolute inset-0 dark-grid-bg opacity-[0.15]" />

      <div className="relative z-10 w-full max-w-[440px]">
        {/* Floating Glassmorphic Login Card */}
        <Card className="border-white/10 bg-brand-dark/40 shadow-2xl backdrop-blur-xl">
          <div className="p-8 sm:p-10">
            {/* Logo and Headers */}
            <div className="mb-8 flex flex-col items-center text-center">
              <div className="relative mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-primary/40 to-brand-secondary/20 p-3 shadow-inner ring-1 ring-white/10">
                <img 
                  src="/logo.png" 
                  alt="Sarva One Logo" 
                  className="h-full w-full object-contain filter drop-shadow-md"
                  onError={(e) => {
                    // Fallback to Icon if image fails
                    e.currentTarget.style.display = 'none';
                    const sib = e.currentTarget.nextElementSibling as HTMLElement;
                    if (sib) sib.style.display = 'block';
                  }}
                />
                <Shield className="hidden h-7 w-7 text-white" />
              </div>
              <h1 className="font-display text-2xl font-black tracking-tight text-white">
                Sarva One Admin
              </h1>
              <p className="mt-2 text-xs font-semibold text-slate-400">
                Sign in to access licensing console
              </p>
            </div>

            {/* Form */}
            <form className="space-y-5" onSubmit={submit}>
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-300">
                  Email Address
                </label>
                <div className="relative">
                  <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                    <Mail className="h-4.5 w-4.5" />
                  </span>
                  <Input 
                    className="border-white/10 bg-white/5 pl-10 text-white placeholder:text-slate-500 focus:border-brand-secondary focus:bg-white/10 focus:ring-brand-secondary/20" 
                    type="email" 
                    value={email} 
                    onChange={(e) => setEmail(e.target.value)} 
                    placeholder="name@sarvaone.com"
                    required 
                    autoComplete="email" 
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-300">
                  Secure Password
                </label>
                <div className="relative">
                  <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                    <Lock className="h-4.5 w-4.5" />
                  </span>
                  <Input 
                    className="border-white/10 bg-white/5 pl-10 text-white placeholder:text-slate-500 focus:border-brand-secondary focus:bg-white/10 focus:ring-brand-secondary/20" 
                    type="password" 
                    value={password} 
                    onChange={(e) => setPassword(e.target.value)} 
                    placeholder="••••••••••••"
                    required 
                    autoComplete="current-password" 
                  />
                </div>
              </div>

              {mutation.isError && (
                <div className="rounded-lg bg-rose-500/10 border border-rose-500/20 p-3 text-xs font-semibold text-rose-300 animate-headShake">
                  {mutation.error.message}
                </div>
              )}

              <Button 
                className="w-full mt-2 cursor-pointer font-bold text-sm tracking-wide shadow-glow-blue" 
                type="submit" 
                isLoading={mutation.isPending}
              >
                {!mutation.isPending && <KeyRound className="h-4 w-4" />}
                Authenticate Account
              </Button>
            </form>
          </div>
        </Card>
      </div>
    </main>
  )
}
