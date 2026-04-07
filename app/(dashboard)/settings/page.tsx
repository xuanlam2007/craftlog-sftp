'use client'

import { useState, useEffect } from 'react'
import { useSftp } from '@/lib/sftp-context'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { FieldGroup, Field, FieldLabel } from '@/components/ui/field'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Skeleton } from '@/components/ui/skeleton'
import { Loader2, Save, TestTube, Server } from 'lucide-react'
import Link from 'next/link'

interface Settings {
  name: string
  sftp_host: string
  sftp_port: number
  sftp_username: string
  sftp_password: string
  base_path: string
  ignored_folders: string
}

export default function SettingsPage() {
  const { currentAccount, isLoading: accountLoading, updateAccount } = useSftp()
  const [settings, setSettings] = useState<Settings>({
    name: '',
    sftp_host: '',
    sftp_port: 22,
    sftp_username: '',
    sftp_password: '',
    base_path: '/home/container',
    ignored_folders: 'logs,cache,crash-reports',
  })
  const [isSaving, setIsSaving] = useState(false)
  const [isTesting, setIsTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null)
  const [saveResult, setSaveResult] = useState<{ success: boolean; message: string } | null>(null)

  // Load current account settings
  useEffect(() => {
    if (currentAccount) {
      setSettings({
        name: currentAccount.name || '',
        sftp_host: currentAccount.sftp_host || '',
        sftp_port: currentAccount.sftp_port || 22,
        sftp_username: currentAccount.sftp_username || '',
        sftp_password: currentAccount.sftp_password || '',
        base_path: currentAccount.base_path || '/home/container',
        ignored_folders: currentAccount.ignored_folders || 'logs,cache,crash-reports',
      })
    }
  }, [currentAccount])

  const handleSave = async () => {
    if (!currentAccount?.$id) return
    
    setIsSaving(true)
    setSaveResult(null)
    try {
      await updateAccount(currentAccount.$id, settings)
      setSaveResult({ success: true, message: 'Settings saved!' })
    } catch (err) {
      setSaveResult({ success: false, message: err instanceof Error ? err.message : 'Failed to save' })
    } finally {
      setIsSaving(false)
    }
  }

  const handleTestConnection = async () => {
    setIsTesting(true)
    setTestResult(null)
    try {
      const response = await fetch('/api/test-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          host: settings.sftp_host,
          port: settings.sftp_port,
          username: settings.sftp_username,
          password: settings.sftp_password,
          basePath: settings.base_path,
          ignoredPaths: settings.ignored_folders.split(',').map((p) => p.trim()).filter(Boolean),
        }),
      })
      const result = await response.json()
      setTestResult({ success: result.success, message: result.message })
    } catch (err) {
      setTestResult({ success: false, message: 'Connection test failed' })
    } finally {
      setIsTesting(false)
    }
  }

  // Show loading state
  if (accountLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Settings</h1>
          <p className="mt-1 text-sm text-muted-foreground">Loading...</p>
        </div>
        <Card>
          <CardContent className="p-6">
            <div className="space-y-4">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Show prompt to select/create account
  if (!currentAccount) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Settings</h1>
          <p className="mt-1 text-sm text-muted-foreground">Configure your SFTP connection</p>
        </div>
        <Alert>
          <Server className="h-4 w-4" />
          <AlertTitle>No SFTP Account Selected</AlertTitle>
          <AlertDescription className="flex flex-col gap-3">
            <span>Please create or select an SFTP account to configure settings.</span>
            <Button asChild size="sm" className="w-fit">
              <Link href="/accounts">Manage Accounts</Link>
            </Button>
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Configure settings for: {currentAccount.name}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>SFTP Connection</CardTitle>
          <CardDescription>
            Enter your SFTP server credentials
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FieldGroup>
            <Field>
              <FieldLabel>Account Name</FieldLabel>
              <Input
                placeholder="My Minecraft Server"
                value={settings.name}
                onChange={(e) => setSettings({ ...settings, name: e.target.value })}
              />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel>Host</FieldLabel>
                <Input
                  placeholder="sftp.example.com"
                  value={settings.sftp_host}
                  onChange={(e) => setSettings({ ...settings, sftp_host: e.target.value })}
                />
              </Field>
              <Field>
                <FieldLabel>Port</FieldLabel>
                <Input
                  type="number"
                  placeholder="22"
                  value={settings.sftp_port}
                  onChange={(e) => setSettings({ ...settings, sftp_port: parseInt(e.target.value) || 22 })}
                />
              </Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel>Username</FieldLabel>
                <Input
                  placeholder="sftp_user"
                  value={settings.sftp_username}
                  onChange={(e) => setSettings({ ...settings, sftp_username: e.target.value })}
                />
              </Field>
              <Field>
                <FieldLabel>Password</FieldLabel>
                <Input
                  type="password"
                  placeholder="Your SFTP password"
                  value={settings.sftp_password}
                  onChange={(e) => setSettings({ ...settings, sftp_password: e.target.value })}
                />
              </Field>
            </div>
            <Field>
              <FieldLabel>Base Path</FieldLabel>
              <Input
                placeholder="/home/container"
                value={settings.base_path}
                onChange={(e) => setSettings({ ...settings, base_path: e.target.value })}
              />
              <p className="mt-1 text-xs text-muted-foreground">
                The root directory to scan (usually /home/container for Pterodactyl)
              </p>
            </Field>
            <Field>
              <FieldLabel>Ignored Folders</FieldLabel>
              <Input
                placeholder="logs,cache,crash-reports"
                value={settings.ignored_folders}
                onChange={(e) => setSettings({ ...settings, ignored_folders: e.target.value })}
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Comma-separated list of folder names to ignore during scans
              </p>
            </Field>
          </FieldGroup>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Button onClick={handleTestConnection} variant="outline" disabled={isTesting}>
              {isTesting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <TestTube className="mr-2 h-4 w-4" />
              )}
              Test Connection
            </Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              Save Settings
            </Button>
            {testResult && (
              <Badge variant={testResult.success ? 'default' : 'destructive'}>
                {testResult.message}
              </Badge>
            )}
            {saveResult && (
              <Badge variant={saveResult.success ? 'default' : 'destructive'}>
                {saveResult.message}
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
