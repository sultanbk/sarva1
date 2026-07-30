import { ChevronRight, Home } from 'lucide-react'
import { NavLink, useLocation } from 'react-router-dom'

const labelMap: Record<string, string> = {
  '/': 'Dashboard',
  '/clients': 'Clients',
  '/clients/new': 'Generate Key',
  '/settings': 'Settings',
  '/audit-log': 'Audit Log',
}

export function Breadcrumbs() {
  const { pathname } = useLocation()

  if (pathname === '/') return null

  const parts = pathname.split('/').filter(Boolean)
  const crumbs: { label: string; path: string }[] = [{ label: 'Home', path: '/' }]

  let current = ''
  for (const part of parts) {
    current += '/' + part
    const isClientDetail = parts[0] === 'clients' && parts.length > 1 && parts[1] !== 'new'
    if (isClientDetail && part === parts[1]) {
      crumbs.push({ label: 'Client Detail', path: current })
      continue
    }
    crumbs.push({ label: labelMap[current] || part.charAt(0).toUpperCase() + part.slice(1), path: current })
  }

  return (
    <nav className="mb-5 flex items-center gap-1.5 text-xs font-semibold text-slate-400">
      {crumbs.map((crumb, i) => (
        <span key={crumb.path} className="flex items-center gap-1.5">
          {i > 0 && <ChevronRight className="h-3 w-3 text-slate-300" />}
          {i === crumbs.length - 1 ? (
            <span className="text-slate-600">{crumb.label}</span>
          ) : (
            <NavLink to={crumb.path} className="hover:text-slate-600 transition-colors">
              {i === 0 ? <Home className="h-3.5 w-3.5" /> : crumb.label}
            </NavLink>
          )}
        </span>
      ))}
    </nav>
  )
}
