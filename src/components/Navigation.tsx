/**
 * App sidebar shell for IncidentRoom.
 * Keeps scaffold test hooks: app-navigation, nav-sign-in-button,
 * nav-user-name, nav-user-email.
 */

import { useState, useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { AuthOverlay, useAuthProfileReady, signOut } from 'deepspace'
import {
  ChevronDown,
  LayoutDashboard,
  LogOut,
  Menu,
  Settings,
  ShieldAlert,
  Siren,
  X,
} from 'lucide-react'
import { APP_NAME } from '../constants'
import type { Role } from '../constants'
import { nav } from '../nav'
import { cn } from '../lib/utils'
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui'

const NAV_ICONS: Record<string, typeof LayoutDashboard> = {
  '/home': LayoutDashboard,
  '/incidents': Siren,
  '/settings': Settings,
}

export default function Navigation() {
  const { isLoaded, isSignedIn, user, userLoading } = useAuthProfileReady({ requireUser: true })
  const location = useLocation()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [showAuthModal, setShowAuthModal] = useState(false)
  const [collapsed, setCollapsed] = useState(false)

  const profileReady = !isSignedIn || (!userLoading && !!user)
  const userRole = (user?.role ?? 'anonymous') as Role | 'anonymous'

  useEffect(() => {
    setMobileOpen(false)
  }, [location.pathname])

  const visibleNav = nav.filter((item) => {
    if (item.devOnly && !import.meta.env.DEV) return false
    if (!item.roles) return true
    if (!profileReady) return false
    if (userRole === 'admin') return true
    return item.roles.includes(userRole as Role)
  })

  const brand = (
    <Link
      to="/home"
      className={cn(
        'flex items-center gap-2.5 px-3 py-2 text-foreground',
        collapsed && 'justify-center px-0',
      )}
    >
      <span className="flex size-8 items-center justify-center rounded-md bg-primary/15 text-primary">
        <ShieldAlert className="size-4" aria-hidden />
      </span>
      {!collapsed && (
        <span className="min-w-0">
          <span className="block truncate text-sm font-semibold tracking-tight">
            IncidentRoom
          </span>
          <span className="block truncate text-[11px] text-muted-foreground">
            Security operations
          </span>
        </span>
      )}
    </Link>
  )

  const navLinks = (
    <nav className="flex flex-1 flex-col gap-1 px-2" aria-label="Primary">
      {visibleNav.map((item) => {
        const active =
          item.path === '/home'
            ? location.pathname === '/home'
            : location.pathname.startsWith(item.path)
        const Icon = NAV_ICONS[item.path] ?? LayoutDashboard
        return (
          <Link
            key={item.path}
            to={item.path}
            aria-current={active ? 'page' : undefined}
            title={item.label}
            className={cn(
              'flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm transition-colors',
              active
                ? 'bg-accent text-foreground'
                : 'text-muted-foreground hover:bg-accent/60 hover:text-foreground',
              collapsed && 'justify-center px-0',
            )}
          >
            <Icon className="size-4 shrink-0" aria-hidden />
            {!collapsed && <span>{item.label}</span>}
          </Link>
        )
      })}
    </nav>
  )

  const account = (
    <div className={cn('border-t border-border p-2', collapsed && 'flex justify-center')}>
      {!isLoaded ? null : isSignedIn && !profileReady ? (
        <div className="flex items-center gap-2 rounded-md px-2 py-1.5">
          <div className="h-7 w-7 animate-pulse rounded-full bg-muted" />
          {!collapsed && <div className="h-4 w-24 animate-pulse rounded-md bg-muted" />}
        </div>
      ) : isSignedIn && user ? (
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <button
                aria-label="Account menu"
                className={cn(
                  'group flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-accent',
                  collapsed && 'w-auto justify-center px-1.5',
                )}
              >
                <Avatar className="h-7 w-7 ring-1 ring-inset ring-border">
                  <AvatarImage src={user.imageUrl ?? undefined} referrerPolicy="no-referrer" />
                  <AvatarFallback className="text-[11px]">
                    {(user.name?.[0] ?? user.email?.[0] ?? '?').toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                {!collapsed && (
                  <>
                    <span
                      data-testid="nav-user-name"
                      className="min-w-0 flex-1 truncate text-left text-foreground"
                    >
                      {user.name || user.email}
                    </span>
                    <ChevronDown
                      className="size-3.5 text-muted-foreground transition-transform duration-150 group-data-[popup-open]:rotate-180"
                      aria-hidden
                    />
                  </>
                )}
              </button>
            }
          />
          <DropdownMenuContent align="end" side="top" className="w-56">
            <DropdownMenuLabel>
              <div className="truncate font-medium text-foreground">
                {user.name || 'Signed in'}
              </div>
              <div
                data-testid="nav-user-email"
                className="truncate text-xs font-normal text-muted-foreground"
              >
                {user.email}
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => signOut()}>
              <LogOut aria-hidden />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ) : (
        <Button
          data-testid="nav-sign-in-button"
          size={collapsed ? 'icon' : 'sm'}
          className={cn(!collapsed && 'w-full')}
          onClick={() => setShowAuthModal(true)}
        >
          {collapsed ? 'In' : 'Sign in'}
        </Button>
      )}
    </div>
  )

  const sidebarBody = (
    <>
      <div className="flex h-14 items-center justify-between gap-2 border-b border-border px-2">
        {brand}
        <Button
          variant="ghost"
          size="icon"
          className="hidden shrink-0 md:inline-flex"
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          onClick={() => setCollapsed((prev) => !prev)}
        >
          <Menu className="size-4" />
        </Button>
      </div>
      <div className="flex flex-1 flex-col overflow-y-auto py-3">{navLinks}</div>
      {account}
    </>
  )

  return (
    <div data-testid="app-navigation" className="contents">
      {/* Mobile top bar */}
      <div className="flex h-12 items-center justify-between gap-2 border-b border-border bg-shell px-3 md:hidden">
        <div className="flex items-center gap-2 min-w-0">
          <ShieldAlert className="size-4 shrink-0 text-primary" aria-hidden />
          <span className="truncate text-sm font-semibold">IncidentRoom</span>
        </div>
        <div className="flex items-center gap-1">
          {isLoaded && !isSignedIn && (
            <Button size="sm" onClick={() => setShowAuthModal(true)}>
              Sign in
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            aria-label="Toggle navigation"
            aria-expanded={mobileOpen}
            onClick={() => setMobileOpen((prev) => !prev)}
          >
            {mobileOpen ? <X className="size-4" /> : <Menu className="size-4" />}
          </Button>
        </div>
      </div>

      {mobileOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-black/50"
            aria-label="Close navigation"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="relative z-10 flex h-full w-64 flex-col border-r border-border bg-shell">
            {sidebarBody}
          </aside>
        </div>
      )}

      {/* Desktop sidebar */}
      <aside
        className={cn(
          'hidden h-full shrink-0 flex-col border-r border-border bg-shell md:flex',
          collapsed ? 'w-[68px]' : 'w-56',
        )}
        aria-label={`${APP_NAME} navigation`}
      >
        {sidebarBody}
      </aside>

      {showAuthModal && <AuthOverlay onClose={() => setShowAuthModal(false)} />}
    </div>
  )
}
