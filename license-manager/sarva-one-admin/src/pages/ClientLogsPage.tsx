import { useQuery } from '@tanstack/react-query'
import { Terminal } from 'lucide-react'
import { api, type Client } from '../lib'
import { ClientLogsView } from '../components/ClientLogsView'
import { Card } from '../components/ui'

export default function ClientLogsPage() {
  const { data: clients } = useQuery({
    queryKey: ['clients', 'logs-page'],
    queryFn: async () => {
      const res = await api.clients('pageSize=100&sort=shopName')
      return res.licenses
    }
  })

  const licenseOptions = (clients ?? []).map((c: Client) => ({ id: c.id, shopName: c.shopName }))

  return (
    <div className="space-y-6">
      <Card className="p-4.5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-dark text-white">
            <Terminal className="h-5 w-5" />
          </div>
          <div>
            <h2 className="font-display text-lg font-black text-brand-dark">Client Runtime Logs</h2>
            <p className="text-xs font-semibold text-slate-400">
              Unified diagnostic feed across all installed client terminals
            </p>
          </div>
        </div>
      </Card>

      <ClientLogsView licenseOptions={licenseOptions} />
    </div>
  )
}
