'use client'

import { useState } from 'react'
import { useSftp } from '@/lib/sftp-context'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Plus, Server, Trash2, Users, Check, Loader2 } from 'lucide-react'
import type { SftpAccount, SftpAccountMember } from '@/lib/types'

export default function AccountsPage() {
  const { accounts, currentAccount, isLoading, selectAccount, createAccount, deleteAccount } = useSftp()
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const [selectedAccountForMembers, setSelectedAccountForMembers] = useState<SftpAccount | null>(null)
  const [members, setMembers] = useState<SftpAccountMember[]>([])
  const [loadingMembers, setLoadingMembers] = useState(false)

  // Default ignored folders for Minecraft servers (supports wildcards like world*)
  const DEFAULT_IGNORED_FOLDERS = 'logs, cache, tmp, libraries, versions, FancyAnalytics, world*, .paper_remapped'

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    sftp_host: '',
    sftp_port: '22',
    sftp_username: '',
    sftp_password: '',
    base_path: '/',
    ignored_folders: DEFAULT_IGNORED_FOLDERS
  })

  const handleCreate = async () => {
    setIsCreating(true)
    try {
      await createAccount({
        name: formData.name,
        sftp_host: formData.sftp_host,
        sftp_port: parseInt(formData.sftp_port) || 22,
        sftp_username: formData.sftp_username,
        sftp_password: formData.sftp_password,
        base_path: formData.base_path,
        ignored_folders: formData.ignored_folders
      })
      setIsCreateOpen(false)
      setFormData({
        name: '',
        sftp_host: '',
        sftp_port: '22',
        sftp_username: '',
        sftp_password: '',
        base_path: '/',
        ignored_folders: DEFAULT_IGNORED_FOLDERS
      })
    } catch (error) {
      console.error('Failed to create account:', error)
    } finally {
      setIsCreating(false)
    }
  }

  const handleViewMembers = async (account: SftpAccount) => {
    setSelectedAccountForMembers(account)
    setLoadingMembers(true)
    try {
      const res = await fetch(`/api/accounts/${account.$id}/members`)
      const data = await res.json()
      setMembers(data.members || [])
    } catch (error) {
      console.error('Failed to fetch members:', error)
    } finally {
      setLoadingMembers(false)
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">SFTP Accounts</h1>
          <p className="mt-1 text-sm text-muted-foreground">Manage your SFTP connections</p>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-48 w-full" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">SFTP Accounts</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage your SFTP connections and share access with team members
          </p>
        </div>
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Add Account
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Add SFTP Account</DialogTitle>
              <DialogDescription>
                Add a new SFTP connection to monitor file changes.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="name">Account Name</Label>
                <Input
                  id="name"
                  placeholder="My Minecraft Server"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="col-span-2 grid gap-2">
                  <Label htmlFor="host">SFTP Host</Label>
                  <Input
                    id="host"
                    placeholder="sftp.example.com"
                    value={formData.sftp_host}
                    onChange={(e) => setFormData({ ...formData, sftp_host: e.target.value })}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="port">Port</Label>
                  <Input
                    id="port"
                    placeholder="22"
                    value={formData.sftp_port}
                    onChange={(e) => setFormData({ ...formData, sftp_port: e.target.value })}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="username">Username</Label>
                  <Input
                    id="username"
                    value={formData.sftp_username}
                    onChange={(e) => setFormData({ ...formData, sftp_username: e.target.value })}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    value={formData.sftp_password}
                    onChange={(e) => setFormData({ ...formData, sftp_password: e.target.value })}
                  />
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="basePath">Base Path</Label>
                <Input
                  id="basePath"
                  placeholder="/home/user/server"
                  value={formData.base_path}
                  onChange={(e) => setFormData({ ...formData, base_path: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="ignored">Ignored Folders (comma-separated, use * for wildcards)</Label>
                <Input
                  id="ignored"
                  placeholder="logs, cache, tmp"
                  value={formData.ignored_folders}
                  onChange={(e) => setFormData({ ...formData, ignored_folders: e.target.value })}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreate} disabled={isCreating || !formData.name || !formData.sftp_host}>
                {isCreating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create Account
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {accounts.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Server className="h-12 w-12 text-muted-foreground/50" />
            <h3 className="mt-4 text-lg font-semibold">No SFTP Accounts</h3>
            <p className="mt-2 text-sm text-muted-foreground text-center max-w-sm">
              Add your first SFTP account to start monitoring file changes.
            </p>
            <Button className="mt-4" onClick={() => setIsCreateOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Add Account
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {accounts.map((account) => (
            <Card
              key={account.$id}
              className={`cursor-pointer transition-all hover:border-primary/50 ${
                currentAccount?.$id === account.$id ? 'border-primary ring-1 ring-primary' : ''
              }`}
              onClick={() => selectAccount(account.$id!)}
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <Server className="h-5 w-5 text-muted-foreground" />
                    <CardTitle className="text-lg">{account.name}</CardTitle>
                  </div>
                  {currentAccount?.$id === account.$id && (
                    <Badge className="bg-primary/15 text-primary">
                      <Check className="mr-1 h-3 w-3" />
                      Active
                    </Badge>
                  )}
                </div>
                <CardDescription className="text-xs">
                  {account.sftp_host}:{account.sftp_port}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="text-sm text-muted-foreground">
                  <span className="font-medium">Path:</span> {account.base_path}
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleViewMembers(account)
                    }}
                  >
                    <Users className="mr-2 h-4 w-4" />
                    Members
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete Account?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will permanently delete the SFTP account &quot;{account.name}&quot; and all associated
                          logs. This action cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          className="bg-destructive text-white hover:bg-destructive/90"
                          onClick={() => deleteAccount(account.$id!)}
                        >
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Members Dialog */}
      <Dialog open={!!selectedAccountForMembers} onOpenChange={(open) => !open && setSelectedAccountForMembers(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Team Members - {selectedAccountForMembers?.name}</DialogTitle>
            <DialogDescription>
              People with access to this SFTP account.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            {loadingMembers ? (
              <div className="space-y-2">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : (
              <div className="space-y-2">
                {members.map((member) => (
                  <div
                    key={member.$id}
                    className="flex items-center justify-between rounded-lg border p-3"
                  >
                    <div>
                      <p className="font-medium">{member.user_email}</p>
                      <p className="text-xs text-muted-foreground capitalize">{member.role}</p>
                    </div>
                    {member.role === 'owner' && (
                      <Badge variant="secondary">Owner</Badge>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
