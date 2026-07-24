import { useState } from 'react'
import type { FormEvent } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Plus, Clipboard, MessageCircle, Check, Key, ShieldCheck } from 'lucide-react'
import { api } from '../lib'
import type { Client, Plan } from '../lib'
import { 
  Card, CardHeader, Input, Select, Textarea, 
  Button, EmptyState 
} from '../components/ui'

export default function CreateLicensePage() {
  const [created, setCreated] = useState<Client | null>(null)
  const [copiedKey, setCopiedKey] = useState(false)
  const [customDuration, setCustomDuration] = useState(false)

  const mutation = useMutation({
    mutationFn: api.createClient,
    onSuccess: (data) => {
      setCreated(data)
    },
  })

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    mutation.mutate({
      shopName: String(form.get('shopName')),
      ownerName: String(form.get('ownerName')),
      phone: String(form.get('phone')),
      email: String(form.get('email')),
      plan: String(form.get('plan')) as Plan,
      duration: String(form.get('duration')),
      customExpiry: String(form.get('customExpiry') || ''),
      gracePeriodDays: Number(form.get('gracePeriodDays') || 7),
      maxSeats: Number(form.get('maxSeats') || 1),
      notes: String(form.get('notes') || ''),
    })
  }

  const handleCopyKey = (key: string) => {
    navigator.clipboard.writeText(key)
    setCopiedKey(true)
    setTimeout(() => setCopiedKey(false), 1500)
  }

  const whatsappMessage = created 
    ? encodeURIComponent(`Welcome to Sarva One! Your license key is: ${created.licenseKey}
Download link: https://sarvaone.com/download
Setup guide: https://sarvaone.com/setup-guide
Support Hotline: +91-XXXXXXXXXX`) 
    : ''

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px] animate-fadeIn">
      {/* Create License Form */}
      <Card>
        <CardHeader title="Generate Client License" description="Establish a new licensing credentials for a Sarva One terminal." />
        <form className="grid gap-4.5 p-6 sm:grid-cols-2" onSubmit={submit}>
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Shop / Company Name</label>
            <Input name="shopName" placeholder="e.g. QuikMart Supermarket" required />
          </div>

          <div className="space-y-1.5">
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Owner Name</label>
            <Input name="ownerName" placeholder="e.g. S Sultan" required />
          </div>

          <div className="space-y-1.5">
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Contact Phone Number</label>
            <Input name="phone" placeholder="e.g. 919876543210" required />
          </div>

          <div className="space-y-1.5">
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Email Address</label>
            <Input name="email" type="email" placeholder="e.g. contact@quikmart.in" required />
          </div>

          <div className="space-y-1.5">
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Service Plan Tier</label>
            <Select name="plan" defaultValue="starter">
              <option value="starter">Starter Plan</option>
              <option value="growth">Growth Plan</option>
              <option value="pro">Pro Enterprise</option>
              <option value="custom">Custom Tier</option>
            </Select>
          </div>

          <div className="space-y-1.5">
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">License Term / Duration</label>
            <Select 
              name="duration" 
              defaultValue="1month"
              onChange={(e) => setCustomDuration(e.target.value === 'custom')}
            >
              <option value="1month">1 Month</option>
              <option value="3months">3 Months</option>
              <option value="6months">6 Months</option>
              <option value="1year">1 Year</option>
              <option value="custom">Custom Date Expiry</option>
            </Select>
          </div>

          {customDuration && (
            <div className="space-y-1.5 sm:col-span-2 animate-slideDown">
              <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Custom Expiration Date</label>
              <Input name="customExpiry" type="date" required />
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Grace Period Days</label>
            <Input name="gracePeriodDays" type="number" min="0" defaultValue={7} required />
          </div>

          <div className="space-y-1.5">
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Max Device Seats</label>
            <Input name="maxSeats" type="number" min="1" max="99" defaultValue={1} required />
          </div>

          <div className="space-y-1.5 sm:col-span-2">
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Administrative Notes</label>
            <Textarea name="notes" placeholder="Enter custom onboarding notes or terms details..." />
          </div>

          {mutation.isError && (
            <div className="rounded-lg bg-rose-50 border border-rose-100 p-4 text-xs font-semibold text-rose-600 sm:col-span-2">
              {mutation.error.message}
            </div>
          )}

          <Button 
            className="sm:col-span-2 font-bold text-sm tracking-wide mt-2" 
            type="submit"
            isLoading={mutation.isPending}
          >
            {!mutation.isPending && <Plus className="h-4.5 w-4.5" />} Create Client License Key
          </Button>
        </form>
      </Card>

      {/* Generated License Result Card */}
      <div className="h-fit">
        <Card className={created ? "bg-emerald-50/15 border-emerald-100" : ""}>
          <CardHeader title="Generated Credentials" />
          <div className="p-6">
            {created ? (
              <div className="space-y-6 animate-scaleUp">
                <div className="flex items-center gap-3 rounded-xl bg-emerald-50 border border-emerald-100/70 p-4 text-emerald-800">
                  <ShieldCheck className="h-5 w-5 shrink-0" />
                  <span className="text-xs font-bold leading-snug">
                    License credentials compiled and generated successfully!
                  </span>
                </div>

                <div className="rounded-xl border border-slate-100 bg-white p-5 shadow-sm space-y-4">
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">License Key</span>
                    <p className="break-all font-mono text-lg font-black tracking-tight text-brand-dark leading-tight select-all">
                      {created.licenseKey}
                    </p>
                  </div>
                  <div className="border-t border-slate-50 pt-3">
                    <p className="font-display text-sm font-bold text-slate-800">{created.shopName}</p>
                    <p className="text-xs font-semibold text-slate-400 mt-0.5">Owner: {created.ownerName} · Phone: {created.phone}</p>
                  </div>
                </div>

                <div className="flex flex-col gap-2.5">
                  <Button 
                    className="w-full font-bold text-xs" 
                    variant="secondary" 
                    onClick={() => handleCopyKey(created.licenseKey)}
                  >
                    {copiedKey ? (
                      <><Check className="h-4 w-4 text-emerald-500" /> Key Copied</>
                    ) : (
                      <><Clipboard className="h-4 w-4" /> Copy Key to Clipboard</>
                    )}
                  </Button>

                  <a 
                    className="inline-flex min-h-[42px] w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4.5 py-2.5 text-xs font-bold text-white hover:bg-emerald-700 active:scale-[0.98] shadow-sm hover:shadow transition-all duration-200" 
                    href={`https://wa.me/${created.phone.replace(/[^0-9]/g, '')}?text=${whatsappMessage}`} 
                    target="_blank"
                    rel="noreferrer"
                  >
                    <MessageCircle className="h-4 w-4 shrink-0" /> Share key via WhatsApp
                  </a>
                </div>
              </div>
            ) : (
              <EmptyState 
                title="Awaiting Key Generation" 
                icon={<Key className="h-10 w-10 text-slate-300" />}
              >
                Submit the validation form on the left. The generated license key alongside activation directives will compile here.
              </EmptyState>
            )}
          </div>
        </Card>
      </div>
    </div>
  )
}
