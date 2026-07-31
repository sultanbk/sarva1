import { useState } from 'react'
import type { FormEvent } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useMutationToast } from '../hooks/useMutationToast'
import {
  Save, Copy, RefreshCcw, Check, Server,
  Terminal, Lock
} from 'lucide-react'
import { api, LICENSE_ENDPOINTS, API_URL, LICENSE_API_PREFIX, TOKEN_KEY, copyText } from '../lib'
import { Card, CardHeader, Input, Button } from '../components/ui'

export default function SettingsPage() {
  const [copiedTextMap, setCopiedTextMap] = useState<Record<string, boolean>>({})

  const status = useQuery({ 
    queryKey: ['server-status'], 
    queryFn: api.serverStatus 
  })
  
  const key = useQuery({ 
    queryKey: ['api-key'], 
    queryFn: api.apiKey 
  })
  
  const password = useMutationToast({
    mutationFn: api.changePassword,
    successMessage: 'Password updated successfully',
  })

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    password.mutate({
      currentPassword: String(form.get('currentPassword')),
      newPassword: String(form.get('newPassword')),
    })
    event.currentTarget.reset()
  }

  const handleCopy = (path: string, text: string) => {
    copyText(text)
    setCopiedTextMap(prev => ({ ...prev, [path]: true }))
    setTimeout(() => {
      setCopiedTextMap(prev => ({ ...prev, [path]: false }))
    }, 1500)
  }

  return (
    <div className="grid gap-6 xl:grid-cols-2">
      {/* Change Password Card */}
      <Card className="h-fit">
        <CardHeader title="Change Administrator Password" description="Update the credentials used to access the licensing console" />
        <form className="space-y-4.5 p-6" onSubmit={submit}>
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Current Password</label>
            <div className="relative">
              <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                <Lock className="h-4.5 w-4.5" />
              </span>
              <Input 
                className="pl-10" 
                type="password" 
                name="currentPassword" 
                placeholder="••••••••••••"
                required 
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">New Password</label>
            <div className="relative">
              <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                <Lock className="h-4.5 w-4.5" />
              </span>
              <Input 
                className="pl-10" 
                type="password" 
                name="newPassword" 
                minLength={10} 
                placeholder="Minimum 10 characters"
                required 
              />
            </div>
          </div>

          <Button className="font-bold text-xs" disabled={password.isPending} isLoading={password.isPending}>
            {!password.isPending && <Save className="h-4 w-4" />} Update Password
          </Button>
        </form>
      </Card>

      {/* API Key & System Endpoints */}
      <div className="space-y-6">
        {/* API Key */}
        <Card>
          <CardHeader title="Console API Key" description="Authorization token used by Sarva One terminal installations" />
          <div className="p-6">
            <div className="flex items-center gap-2 rounded-xl bg-slate-900 border border-slate-950 p-4 font-mono text-xs text-white">
              <Terminal className="h-4.5 w-4.5 text-brand-secondary shrink-0" />
              <code className="overflow-x-auto select-all flex-1 py-1">
                {key.isLoading ? 'Syncing credentials...' : key.data?.apiKey || 'Unconfigured api-key'}
              </code>
              {!key.isLoading && key.data?.apiKey && (
                <Button 
                  size="sm" 
                  variant="ghost" 
                  className="text-white hover:bg-white/10 hover:text-white h-8 w-8 p-0 border border-white/5" 
                  onClick={() => handleCopy('apikey', key.data.apiKey)}
                >
                  {copiedTextMap['apikey'] ? (
                    <Check className="h-3.5 w-3.5 text-emerald-400" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                </Button>
              )}
            </div>
          </div>
        </Card>

        {/* Endpoints Portal */}
        <Card>
          <CardHeader title="Client Licensing Endpoints" description="Target methods and paths mapped in router schema" />
          <div className="divide-y divide-slate-50">
            {LICENSE_ENDPOINTS.map((endpoint) => {
              const url = `${API_URL}${LICENSE_API_PREFIX}${endpoint.path}`
              const isPost = endpoint.method === 'POST'
              return (
                <div key={endpoint.path} className="flex flex-col gap-3.5 p-5 sm:flex-row sm:items-center sm:justify-between">
                  <div className="space-y-1">
                    <p className="font-display text-sm font-bold text-slate-800 leading-tight">{endpoint.label}</p>
                    <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-[9px] font-extrabold tracking-wider ${
                      isPost ? 'bg-purple-50 text-purple-700 ring-1 ring-purple-600/10' : 'bg-blue-50 text-blue-700 ring-1 ring-blue-600/10'
                    }`}>
                      {endpoint.method}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 min-w-0 flex-1 sm:max-w-[340px]">
                    <code className="overflow-x-auto rounded-lg bg-slate-50 border border-slate-100 px-3 py-2 text-[11px] font-semibold text-slate-600 flex-1 truncate select-all">
                      {url}
                    </code>
                    <Button 
                      size="sm" 
                      variant="secondary" 
                      className="h-8.5 w-8.5 p-0 shrink-0" 
                      onClick={() => handleCopy(endpoint.path, url)}
                    >
                      {copiedTextMap[endpoint.path] ? (
                        <Check className="h-3.5 w-3.5 text-emerald-500" />
                      ) : (
                        <Copy className="h-3.5 w-3.5" />
                      )}
                    </Button>
                  </div>
                </div>
              )
            })}
          </div>
        </Card>

        {/* Server Status monitor */}
        <Card>
          <CardHeader 
            title="License Host System" 
            action={
              <Button 
                size="sm" 
                variant="secondary" 
                onClick={() => status.refetch()}
                isLoading={status.isFetching}
              >
                {!status.isFetching && <RefreshCcw className="h-3.5 w-3.5" />} Telemetry Check
              </Button>
            } 
          />
          <div className="p-6 space-y-4">
            <div className="flex items-center gap-3 rounded-xl bg-slate-50 border border-slate-100 p-4.5">
              <Server className="h-5 w-5 text-brand-primary" />
              <div className="text-xs">
                <span className="font-bold text-slate-500">API Connection Host:</span>
                <code className="block mt-0.5 font-semibold text-slate-800">{API_URL}</code>
              </div>
            </div>

            <div className="grid gap-3.5 sm:grid-cols-2 text-xs">
              <div className="rounded-lg border border-slate-50 p-3.5 space-y-1">
                <span className="font-bold text-slate-400">Token Storage Key</span>
                <p className="font-semibold font-mono text-slate-800">{TOKEN_KEY}</p>
              </div>

              <div className="rounded-lg border border-slate-50 p-3.5 flex items-center justify-between">
                <div className="space-y-1">
                  <span className="font-bold text-slate-400">Connection State</span>
                  <p className="font-bold text-slate-800 capitalize">
                    {status.isLoading 
                      ? 'Reconnecting...' 
                      : status.data?.status || (status.isError ? 'System Offline' : 'Unconfirmed')}
                  </p>
                </div>
                {!status.isLoading && (
                  <span className="relative flex h-3.5 w-3.5 shrink-0">
                    {status.data?.status === 'online' ? (
                      <>
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
                        <span className="relative inline-flex h-3.5 w-3.5 rounded-full bg-emerald-500"></span>
                      </>
                    ) : (
                      <span className="relative inline-flex h-3.5 w-3.5 rounded-full bg-rose-500"></span>
                    )}
                  </span>
                )}
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  )
}
