'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import { useAuth } from '@/lib/auth-context'
import { SftpProvider, useSftp } from '@/lib/sftp-context'
import { FileText, Files, Settings, Activity, LogOut, Loader2, Server, ChevronDown, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

const navigation = [
  { name: 'Logs', href: '/', icon: FileText },
  { name: 'All Changed Files', href: '/changed-files', icon: Files },
  { name: 'SFTP Accounts', href: '/accounts', icon: Server },
  { name: 'Settings', href: '/settings', icon: Settings },
]

function DashboardContent({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const { user, logout } = useAuth()
  const { accounts, currentAccount, isLoading: sftpLoading, selectAccount } = useSftp()

  const handleLogout = async () => {
    await logout()
    router.push('/login')
  }

  return (
    <div className="flex min-h-screen bg-background" suppressHydrationWarning>
      {/* Sidebar */}
      <aside className="fixed inset-y-0 left-0 z-50 w-64 border-r border-border bg-card">
        <div className="flex h-16 items-center gap-2 border-b border-border px-6">
          <Activity className="h-6 w-6 text-primary" />
          <span className="text-lg font-semibold text-foreground">CraftLog</span>
        </div>

        {/* Account Switcher */}
        <div className="border-b border-border p-4">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                className="w-full justify-between text-left font-normal"
                disabled={sftpLoading}
              >
                {sftpLoading ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading...
                  </span>
                ) : currentAccount ? (
                  <span className="flex items-center gap-2 truncate">
                    <Server className="h-4 w-4 shrink-0" />
                    <span className="truncate">{currentAccount.name}</span>
                  </span>
                ) : (
                  <span className="text-muted-foreground">Select account...</span>
                )}
                <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56" align="start">
              <DropdownMenuLabel>SFTP Accounts</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {accounts.length === 0 ? (
                <DropdownMenuItem disabled>
                  No accounts yet
                </DropdownMenuItem>
              ) : (
                accounts.map((account) => (
                  <DropdownMenuItem
                    key={account.$id}
                    onClick={() => selectAccount(account.$id!)}
                    className="flex items-center justify-between"
                  >
                    <span className="truncate">{account.name}</span>
                    {currentAccount?.$id === account.$id && (
                      <Check className="h-4 w-4 text-primary" />
                    )}
                  </DropdownMenuItem>
                ))
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => router.push('/accounts')}>
                Manage accounts...
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <nav className="flex flex-col gap-1 p-4">
          {navigation.map((item) => {
            const isActive = pathname === item.href
            return (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.name}
              </Link>
            )
          })}
        </nav>
        
        {/* User section at bottom */}
        <div className="absolute bottom-0 left-0 right-0 border-t border-border p-4">
          <div className="mb-3 truncate text-sm text-muted-foreground">
            {user?.email}
          </div>
          <Button
            variant="outline"
            size="sm"
            className="w-full justify-start"
            onClick={handleLogout}
          >
            <LogOut className="mr-2 h-4 w-4" />
            Sign Out
          </Button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 pl-64">
        <div className="h-full p-6">
          {children}
        </div>
      </main>
    </div>
  )
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const { user, isLoading } = useAuth()

  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/login')
    }
  }, [user, isLoading, router])

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!user) {
    return null
  }

  return (
    <SftpProvider>
      <DashboardContent>{children}</DashboardContent>
    </SftpProvider>
  )
}
