import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export const TOKEN_KEY = 'sarvaone_admin_token'
export const API_URL =
  import.meta.env.VITE_API_URL ||
  'https://sarvaonelicencemanagement-production.up.railway.app'
export const ADMIN_API_PREFIX = import.meta.env.VITE_ADMIN_API_PREFIX || '/api/admin'
export const LICENSE_API_PREFIX = import.meta.env.VITE_LICENSE_API_PREFIX || '/api/license'
export const LICENSE_ENDPOINTS = [
  { label: 'Activate', method: 'POST', path: '/activate' },
  { label: 'Validate', method: 'POST', path: '/validate' },
  { label: 'Heartbeat', method: 'POST', path: '/heartbeat' },
  { label: 'Deactivate Machine', method: 'POST', path: '/deactivate-machine' },
]

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function getToken() {
  return localStorage.getItem(TOKEN_KEY)
}

export function setToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token)
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY)
}

export function getAdminName(): string {
  const token = getToken()
  if (!token) return 'Admin'
  try {
    const payload = JSON.parse(atob(token.split('.')[1])) as { name?: string; email?: string }
    return payload.name || payload.email || 'Admin'
  } catch {
    return 'Admin'
  }
}

export function formatDate(value?: string | null) {
  if (!value) return 'Never'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date)
}

export function formatDateTime(value?: string | null) {
  if (!value) return 'Never'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

export function formatCurrency(value = 0) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(value)
}

export async function copyText(value: string) {
  await navigator.clipboard.writeText(value)
}

export function timeAgo(value?: string | null): string {
  if (!value) return 'Never'
  const now = Date.now()
  const then = new Date(value).getTime()
  if (Number.isNaN(then)) return 'Unknown'
  const diff = now - then
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d ago`
  const months = Math.floor(days / 30)
  return `${months}mo ago`
}

export type DaysRemaining = { days: number; label: string; urgent: boolean; warning: boolean; ok: boolean }

export function daysRemaining(value?: string | null): DaysRemaining {
  if (!value) return { days: 0, label: 'No expiry', urgent: false, warning: false, ok: true }
  const now = Date.now()
  const expiry = new Date(value).getTime()
  if (Number.isNaN(expiry)) return { days: 0, label: 'Invalid date', urgent: false, warning: false, ok: true }
  const diff = expiry - now
  const days = Math.ceil(diff / 86400000)
  if (days < 0) return { days, label: `Overdue by ${Math.abs(days)}d`, urgent: true, warning: false, ok: false }
  if (days === 0) return { days, label: 'Expires today', urgent: true, warning: false, ok: false }
  if (days <= 3) return { days, label: `${days}d remaining`, urgent: true, warning: false, ok: false }
  if (days <= 14) return { days, label: `${days}d remaining`, urgent: false, warning: true, ok: false }
  return { days, label: `${days}d remaining`, urgent: false, warning: false, ok: true }
}

export class ApiError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

type RequestOptions = RequestInit & { skipAuth?: boolean }

function authRedirect() {
  clearToken()
  if (location.pathname !== '/login') {
    location.assign('/login')
  }
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}) {
  const token = getToken()
  const headers = new Headers(options.headers)
  headers.set('Content-Type', 'application/json')
  if (token && !options.skipAuth) headers.set('Authorization', `Bearer ${token}`)

  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers,
  })

  const text = await response.text()
  let data: unknown
  try {
    data = text ? JSON.parse(text) : null
  } catch {
    data = { message: text || 'Invalid server response' }
  }

  if (response.status === 401) {
    authRedirect()
    throw new ApiError('Your session expired. Please sign in again.', 401)
  }

  if (!response.ok) {
    const errorData = data as { message?: string; error?: string } | null
    throw new ApiError(errorData?.message || errorData?.error || 'Request failed', response.status)
  }

  return (((data as { data?: unknown } | null)?.data ?? data) as T)
}

export type Plan = 'starter' | 'professional' | 'enterprise'
export type LicenseStatus = 'active' | 'trial' | 'grace' | 'expired' | 'suspended'

type ServerLicenseStatus = Exclude<LicenseStatus, 'grace'>

type ServerLicense = {
  id: string
  key: string
  shopName: string
  ownerName: string
  phone: string
  email: string
  plan: Plan
  status: LicenseStatus
  storedStatus?: ServerLicenseStatus
  effectiveStatus?: LicenseStatus
  machineId?: string | null
  activatedAt?: string | null
  expiresAt: string
  graceEndsAt?: string
  daysRemaining?: number
  gracePeriodDays: number
  maxSeats?: number
  createdAt: string
  updatedAt: string
  createdBy: string
  notes?: string | null
  lastHeartbeatAt?: string | null
}

type ServerHeartbeat = {
  id: string
  licenseId: string
  machineId: string
  appVersion: string
  billsToday: number
  totalBills: number
  totalCustomers: number
  totalProducts: number
  ipAddress: string
  createdAt: string
  metadata?: {
    osPlatform: string
    osRelease: string
    cpuModel: string
    cpuCores: number
    totalMemoryGB: number
    freeMemoryGB: number
    timezone: string
    chromeVersion: string
    electronVersion: string
    dbSizeMB: number
  } | null
}

type ServerLicenseEvent = {
  id: string
  licenseId?: string | null
  actorType: 'admin' | 'client' | 'system' | string
  actorId?: string | null
  eventType: string
  metadata?: Record<string, unknown> | null
  ipAddress?: string | null
  createdAt: string
}

type ServerActivation = {
  id: string
  licenseId: string
  machineIdHash: string
  hostname?: string | null
  appVersion?: string | null
  activatedAt: string
  lastSeenAt?: string | null
  deactivatedAt?: string | null
  blockedAt?: string | null
}

type ServerPayment = {
  id: string
  licenseId?: string | null
  provider: string
  providerPaymentId?: string | null
  providerOrderId?: string | null
  amount: number
  currency: string
  status: string
  createdAt: string
}

type ServerLicenseDetail = ServerLicense & {
  usageSummary?: {
    billsToday: number
    totalBills: number
    totalCustomers: number
    totalProducts: number
    appVersion: string
    lastHeartbeatAt: string
  } | null
  heartbeats: ServerHeartbeat[]
  events?: ServerLicenseEvent[]
  activations?: ServerActivation[]
  payments?: ServerPayment[]
}

type LicenseListResponse = {
  licenses: ServerLicense[]
  pagination: {
    page: number
    pageSize: number
    total: number
  }
}

type ServerDashboard = {
  total: number
  active: number
  trial?: number
  grace?: number
  expired: number
  suspended?: number
  totalBillsGenerated?: number
  billsToday?: number
  totalCustomersReported?: number
  totalProductsReported?: number
  reportingClients?: number
  clientsSyncedToday?: number
  clientsNeverSynced?: number
  mrr: number
  activeByPlan: Array<{ plan: Plan; total: number }>
  clientsByPlan?: Array<{ plan: Plan; count: number }>
  clientsPerMonth?: Array<{ month: string; clients: number }>
  heartbeatsDaily?: Array<{ day: string; heartbeats: number }>
  clientSyncHealth?: Array<{ status: string; clients: number }>
  appVersions?: Array<{ version: string; count: number }>
  topBillClients?: Array<{
    id: string
    shopName: string
    ownerName: string
    phone: string
    plan: Plan
    effectiveStatus: LicenseStatus
    lastHeartbeatAt?: string | null
    appVersion?: string | null
    billsToday: number
    totalBills: number
    totalCustomers: number
    totalProducts: number
  }>
  expiringSoon?: ServerLicense[]
  graceLicenses?: ServerLicense[]
  inactiveClients?: ServerLicense[]
}

export type Client = {
  id: string
  shopName: string
  ownerName: string
  phone: string
  email?: string
  plan: Plan
  status: LicenseStatus
  licenseKey: string
  activatedAt?: string
  expiresAt?: string
  graceEndsAt?: string
  daysRemaining?: number
  lastHeartbeatAt?: string
  notes?: string
  machineId?: string | null
  gracePeriodDays?: number
  maxSeats?: number
  createdAt?: string
}

export type Heartbeat = {
  id: string
  timestamp: string
  billsGenerated: number
  customers: number
  products: number
  appVersion: string
  metadata?: ServerHeartbeat['metadata']
}

export type LicenseEvent = {
  id: string
  timestamp: string
  actorType: string
  actorId?: string
  eventType: string
  metadata?: Record<string, unknown>
  ipAddress?: string
}

export type Activation = {
  id: string
  machineIdHash: string
  hostname?: string
  appVersion?: string
  activatedAt: string
  lastSeenAt?: string
  deactivatedAt?: string
  blockedAt?: string
}

export type Payment = {
  id: string
  provider: string
  amount: number
  currency: string
  status: string
  createdAt: string
}

export type ClientDetail = Client & {
  billsToday: number
  totalBillsGenerated: number
  totalCustomers: number
  totalProducts: number
  appVersion: string
  heartbeats: Heartbeat[]
  events: LicenseEvent[]
  activations: Activation[]
  payments: Payment[]
  billsSeries: Array<{ date: string; bills: number }>
}

export type DashboardData = {
  totalClients: number
  activeLicenses: number
  expiredLicenses: number
  totalBillsGenerated: number
  billsToday: number
  totalCustomersReported: number
  totalProductsReported: number
  reportingClients: number
  clientsSyncedToday: number
  clientsNeverSynced: number
  mrr: number
  arr: number
  clientsPerMonth: Array<{ month: string; clients: number }>
  clientsByPlan: Array<{ plan: Plan; count: number }>
  heartbeatsDaily: Array<{ day: string; heartbeats: number }>
  clientSyncHealth: Array<{ status: string; clients: number }>
  appVersions: Array<{ version: string; count: number }>
  topBillClients: Array<{
    id: string
    shopName: string
    ownerName: string
    phone: string
    plan: Plan
    effectiveStatus: LicenseStatus
    lastHeartbeatAt?: string | null
    appVersion?: string | null
    billsToday: number
    totalBills: number
    totalCustomers: number
    totalProducts: number
  }>
  expiringSoon: Client[]
  graceLicenses: Client[]
  inactiveClients: Client[]
}

export type CreateLicenseInput = {
  shopName: string
  ownerName: string
  phone: string
  email?: string
  plan: Plan
  duration: string
  customExpiry?: string
  gracePeriodDays: number
  maxSeats?: number
  notes?: string
}

function body(value: unknown) {
  return JSON.stringify(value)
}

function normalizedStatus(license: ServerLicense): LicenseStatus {
  return license.effectiveStatus ?? license.status
}

function toClient(license: ServerLicense, heartbeats: ServerHeartbeat[] = []): Client {
  return {
    id: license.id,
    shopName: license.shopName,
    ownerName: license.ownerName,
    phone: license.phone,
    email: license.email,
    plan: license.plan,
    status: normalizedStatus(license),
    licenseKey: license.key,
    activatedAt: license.activatedAt ?? undefined,
    expiresAt: license.expiresAt,
    graceEndsAt: license.graceEndsAt,
    daysRemaining: license.daysRemaining,
    lastHeartbeatAt: heartbeats[0]?.createdAt ?? license.lastHeartbeatAt ?? undefined,
    notes: license.notes ?? undefined,
    machineId: license.machineId,
    gracePeriodDays: license.gracePeriodDays,
    maxSeats: license.maxSeats,
    createdAt: license.createdAt,
  }
}

function toHeartbeat(heartbeat: ServerHeartbeat): Heartbeat {
  return {
    id: heartbeat.id,
    timestamp: heartbeat.createdAt,
    billsGenerated: heartbeat.totalBills,
    customers: heartbeat.totalCustomers,
    products: heartbeat.totalProducts,
    appVersion: heartbeat.appVersion,
    metadata: heartbeat.metadata,
  }
}

function toLicenseEvent(event: ServerLicenseEvent): LicenseEvent {
  return {
    id: event.id,
    timestamp: event.createdAt,
    actorType: event.actorType,
    actorId: event.actorId ?? undefined,
    eventType: event.eventType,
    metadata: event.metadata ?? undefined,
    ipAddress: event.ipAddress ?? undefined,
  }
}

function toActivation(activation: ServerActivation): Activation {
  return {
    id: activation.id,
    machineIdHash: activation.machineIdHash,
    hostname: activation.hostname ?? undefined,
    appVersion: activation.appVersion ?? undefined,
    activatedAt: activation.activatedAt,
    lastSeenAt: activation.lastSeenAt ?? undefined,
    deactivatedAt: activation.deactivatedAt ?? undefined,
    blockedAt: activation.blockedAt ?? undefined,
  }
}

function toPayment(payment: ServerPayment): Payment {
  return {
    id: payment.id,
    provider: payment.provider,
    amount: payment.amount,
    currency: payment.currency,
    status: payment.status,
    createdAt: payment.createdAt,
  }
}

function toClientDetail(license: ServerLicenseDetail): ClientDetail {
  const heartbeats = license.heartbeats.map(toHeartbeat)
  const events = (license.events ?? []).map(toLicenseEvent)
  const activations = (license.activations ?? []).map(toActivation)
  const payments = (license.payments ?? []).map(toPayment)
  const latest = license.heartbeats[0]
  const usageSummary = license.usageSummary
  const dailyBills = new Map<string, number>()

  license.heartbeats.forEach((heartbeat) => {
    const date = new Date(heartbeat.createdAt)
    const key = Number.isNaN(date.getTime()) ? heartbeat.createdAt : date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })
    dailyBills.set(key, Math.max(dailyBills.get(key) ?? 0, heartbeat.totalBills))
  })

  return {
    ...toClient(license, license.heartbeats),
    lastHeartbeatAt: usageSummary?.lastHeartbeatAt ?? latest?.createdAt ?? license.lastHeartbeatAt ?? undefined,
    billsToday: usageSummary?.billsToday ?? latest?.billsToday ?? 0,
    totalBillsGenerated: usageSummary?.totalBills ?? latest?.totalBills ?? 0,
    totalCustomers: usageSummary?.totalCustomers ?? latest?.totalCustomers ?? 0,
    totalProducts: usageSummary?.totalProducts ?? latest?.totalProducts ?? 0,
    appVersion: usageSummary?.appVersion ?? latest?.appVersion ?? 'Unknown',
    heartbeats,
    events,
    activations,
    payments,
    billsSeries: Array.from(dailyBills, ([date, bills]) => ({ date, bills })).reverse().slice(-30),
  }
}

async function dashboardData(): Promise<DashboardData> {
  const stats = await apiRequest<ServerDashboard>(`${ADMIN_API_PREFIX}/dashboard`)

  return {
    totalClients: stats.total,
    activeLicenses: stats.active,
    expiredLicenses: stats.expired,
    totalBillsGenerated: stats.totalBillsGenerated ?? 0,
    billsToday: stats.billsToday ?? 0,
    totalCustomersReported: stats.totalCustomersReported ?? 0,
    totalProductsReported: stats.totalProductsReported ?? 0,
    reportingClients: stats.reportingClients ?? 0,
    clientsSyncedToday: stats.clientsSyncedToday ?? 0,
    clientsNeverSynced: stats.clientsNeverSynced ?? 0,
    mrr: stats.mrr,
    arr: stats.mrr * 12,
    clientsPerMonth: stats.clientsPerMonth ?? [],
    clientsByPlan: stats.clientsByPlan ?? (['starter', 'professional', 'enterprise'] as Plan[]).map((plan) => ({ plan, count: 0 })),
    heartbeatsDaily: stats.heartbeatsDaily ?? [],
    clientSyncHealth: stats.clientSyncHealth ?? [],
    appVersions: stats.appVersions ?? [],
    topBillClients: stats.topBillClients ?? [],
    expiringSoon: (stats.expiringSoon ?? []).map((license) => toClient(license)),
    graceLicenses: (stats.graceLicenses ?? []).map((license) => toClient(license)),
    inactiveClients: (stats.inactiveClients ?? []).map((license) => toClient(license)),
  }
}

function createPayload(payload: CreateLicenseInput) {
  const data: Record<string, unknown> = {
    shopName: payload.shopName,
    ownerName: payload.ownerName,
    phone: payload.phone,
    email: payload.email,
    plan: payload.plan,
    gracePeriodDays: payload.gracePeriodDays,
    maxSeats: payload.maxSeats ?? 1,
    notes: payload.notes || null,
  }
  if (payload.duration === 'custom') {
    data.expiresAt = payload.customExpiry
  } else {
    data.duration = payload.duration
  }
  return data
}

function updatePayload(payload: Partial<Client> & Record<string, unknown>) {
  const data: Record<string, unknown> = {}
  if (payload.plan) data.plan = payload.plan
  if (payload.status && payload.status !== 'grace') data.status = payload.status
  if (payload.expiresAt) data.expiresAt = payload.expiresAt
  if (typeof payload.maxSeats === 'number') data.maxSeats = payload.maxSeats
  if ('notes' in payload) data.notes = payload.notes ?? null
  return data
}

export const api = {
  login: (email: string, password: string) =>
    apiRequest<{ token: string; admin?: { name?: string; email?: string } }>(`${ADMIN_API_PREFIX}/login`, {
      method: 'POST',
      skipAuth: true,
      body: body({ email, password }),
    }),
  dashboard: dashboardData,
  clients: async (params = '') => {
    const data = await apiRequest<LicenseListResponse>(`${ADMIN_API_PREFIX}/licenses${params ? `?${params}` : ''}`)
    return {
      licenses: data.licenses.map((license) => toClient(license)),
      pagination: data.pagination
    }
  },
  client: async (id: string) => toClientDetail(await apiRequest<ServerLicenseDetail>(`${ADMIN_API_PREFIX}/licenses/${id}`)),
  createClient: (payload: CreateLicenseInput) =>
    apiRequest<ServerLicense>(`${ADMIN_API_PREFIX}/licenses`, { method: 'POST', body: body(createPayload(payload)) }).then((license) => toClient(license)),
  updateClient: (id: string, payload: Partial<Client> & Record<string, unknown>) =>
    apiRequest<ServerLicense>(`${ADMIN_API_PREFIX}/licenses/${id}`, { method: 'PUT', body: body(updatePayload(payload)) }).then((license) => toClient(license)),
  deleteClient: (id: string) =>
    apiRequest<{ deleted: boolean }>(`${ADMIN_API_PREFIX}/licenses/${id}`, { method: 'DELETE' }),
  suspend: (id: string) =>
    apiRequest<ServerLicense>(`${ADMIN_API_PREFIX}/licenses/${id}/suspend`, { method: 'POST', body: body({}) }).then((license) => toClient(license)),
  reactivate: (id: string) =>
    apiRequest<ServerLicense>(`${ADMIN_API_PREFIX}/licenses/${id}/activate`, { method: 'POST', body: body({}) }).then((license) => toClient(license)),
  renew: async (id: string) => {
    const client = await apiRequest<ServerLicense>(`${ADMIN_API_PREFIX}/licenses/${id}`)
    const currentExpiry = client?.expiresAt ? new Date(client.expiresAt) : null
    const base = currentExpiry && currentExpiry.getTime() > Date.now() ? currentExpiry : new Date()
    const expiresAt = new Date(base.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString()
    return apiRequest<ServerLicense>(`${ADMIN_API_PREFIX}/licenses/${id}`, { method: 'PUT', body: body({ expiresAt, status: 'active' }) }).then((license) => toClient(license))
  },
  resetMachine: (id: string) =>
    apiRequest<ServerLicense>(`${ADMIN_API_PREFIX}/licenses/${id}/reset-machine`, { method: 'POST', body: body({}) }).then((license) => toClient(license)),
  deactivateMachine: (id: string, activationId: string) =>
    apiRequest<ServerActivation>(`${ADMIN_API_PREFIX}/licenses/${id}/activations/${activationId}/deactivate`, { method: 'POST', body: body({}) }).then(toActivation),
  blockMachine: (id: string, activationId: string) =>
    apiRequest<ServerActivation>(`${ADMIN_API_PREFIX}/licenses/${id}/activations/${activationId}/block`, { method: 'POST', body: body({}) }).then(toActivation),
  unblockMachine: (id: string, activationId: string) =>
    apiRequest<ServerActivation>(`${ADMIN_API_PREFIX}/licenses/${id}/activations/${activationId}/unblock`, { method: 'POST', body: body({}) }).then(toActivation),
  plans: () => apiRequest<Array<{ code: string; name: string; monthlyPrice: number; entitlements: Record<string, boolean | number | string> }>>(`${ADMIN_API_PREFIX}/plans`),
  renewalQuote: (id: string, months = 1) =>
    apiRequest<{ licenseId: string; plan: Plan; months: number; amount: number; currency: string }>(`${ADMIN_API_PREFIX}/licenses/${id}/renewal-quote?months=${months}`),
  recordManualPayment: (id: string, payload: { amount: number; months?: number; currency?: string; provider?: string; providerPaymentId?: string }) =>
    apiRequest<{ payment: ServerPayment; license: ServerLicense }>(`${ADMIN_API_PREFIX}/licenses/${id}/manual-payment`, { method: 'POST', body: body(payload) }),
  changePassword: (payload: { currentPassword: string; newPassword: string }) =>
    apiRequest<{ changed: boolean }>(`${ADMIN_API_PREFIX}/password`, { method: 'PUT', body: body(payload) }),
  serverStatus: async () => {
    await apiRequest<{ ok: boolean }>('/health', { skipAuth: true })
    return { status: 'online' }
  },
  apiKey: () => apiRequest<{ apiKey: string }>(`${ADMIN_API_PREFIX}/config/api-key`),
  auditLog: (params = '') =>
    apiRequest<{ events: ServerLicenseEvent[]; pagination: { page: number; pageSize: number; total: number } }>(`${ADMIN_API_PREFIX}/audit-log${params ? `?${params}` : ''}`),
  bulkExtend: (licenseIds: string[], months: number) =>
    apiRequest<{ updated: ServerLicense[] }>(`${ADMIN_API_PREFIX}/licenses/bulk-extend`, { method: 'POST', body: body({ licenseIds, months }) }),
}
