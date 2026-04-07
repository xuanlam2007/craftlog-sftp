'use client'

import { useState, useRef, useCallback } from 'react'
import useSWR from 'swr'
import { useSftp } from '@/lib/sftp-context'
import { DashboardHeader } from '@/components/dashboard-header'
import { LogsTable } from '@/components/logs-table'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Server, CheckCircle, AlertCircle, Play, Square } from 'lucide-react'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import type { ChangeLog } from '@/lib/types'

const fetcher = (url: string) => fetch(url).then((res) => res.json())

export default function LogsPage() {
  const { currentAccount, isLoading: accountLoading } = useSftp()
  const [searchQuery, setSearchQuery] = useState('')
  const [monitoringStatus, setMonitoringStatus] = useState<'idle' | 'starting' | 'monitoring' | 'error'>('idle')
  const [lastScanResult, setLastScanResult] = useState<string | null>(null)
  const [totalFiles, setTotalFiles] = useState(0)
  const scanIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const isScanningRef = useRef(false)

  const { data, error, isLoading, mutate } = useSWR<{ logs: ChangeLog[]; total: number }>(
    currentAccount?.$id ? `/api/logs?account_id=${currentAccount.$id}` : null,
    fetcher,
    { refreshInterval: 15000 }
  )

  // Manual start monitoring
  const startMonitoring = useCallback(async () => {
    if (!currentAccount?.$id || monitoringStatus === 'monitoring') return

    setMonitoringStatus('starting')
    setLastScanResult('Connecting to SFTP...')

    try {
      // Step 1: Initialize (just tests connection, instant)
      const initResponse = await fetch('/api/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ account_id: currentAccount.$id, action: 'initialize' })
      })
      const initResult = await initResponse.json()

      if (!initResult.success) {
        setMonitoringStatus('error')
        setLastScanResult(initResult.message)
        return
      }

      setLastScanResult('Building baseline...')

      // Step 2: First scan to build baseline (this takes longer)
      const scanResponse = await fetch('/api/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ account_id: currentAccount.$id })
      })
      const scanResult = await scanResponse.json()

      if (scanResult.success) {
        setMonitoringStatus('monitoring')
        setTotalFiles(scanResult.totalFiles)
        setLastScanResult(`Watching ${scanResult.totalFiles} files`)

        // Start periodic scanning every 30 seconds
        scanIntervalRef.current = setInterval(async () => {
          if (isScanningRef.current) return
          isScanningRef.current = true

          try {
            const res = await fetch('/api/scan', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ account_id: currentAccount.$id })
            })
            const data = await res.json()
            if (data.totalFiles) setTotalFiles(data.totalFiles)
            if (data.changesDetected > 0) {
              setLastScanResult(`${data.changesDetected} change(s) detected`)
              mutate()
            }
          } catch {
            // Silent fail
          } finally {
            isScanningRef.current = false
          }
        }, 30000)
      } else {
        setMonitoringStatus('error')
        setLastScanResult(scanResult.message || 'Failed to build baseline')
      }
    } catch {
      setMonitoringStatus('error')
      setLastScanResult('Connection failed')
    }
  }, [currentAccount?.$id, monitoringStatus, mutate])

  // Stop monitoring
  const stopMonitoring = useCallback(() => {
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current)
      scanIntervalRef.current = null
    }
    setMonitoringStatus('idle')
    setLastScanResult(null)
  }, [])

  const filteredLogs = data?.logs?.filter((log) =>
    log.file_path.toLowerCase().includes(searchQuery.toLowerCase())
  ) ?? []

  // Show prompt to select/create account
  if (!accountLoading && !currentAccount) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Change Logs</h1>
          <p className="mt-1 text-sm text-muted-foreground">View all detected file changes from SFTP scans</p>
        </div>
        <Alert>
          <Server className="h-4 w-4" />
          <AlertTitle>No SFTP Account Selected</AlertTitle>
          <AlertDescription className="flex flex-col gap-3">
            <span>Please create or select an SFTP account to start monitoring file changes.</span>
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
      <DashboardHeader
        title="Change Logs"
        description={`Account: ${currentAccount?.name || 'Loading...'}`}
        searchValue={searchQuery}
        onSearchChange={setSearchQuery}
        monitoringStatus={monitoringStatus}
        onStartMonitoring={startMonitoring}
        onStopMonitoring={stopMonitoring}
      />

      <div className="grid gap-4 md:grid-cols-3">
        <StatsCard
          title="Total Changes"
          value={data?.total ?? 0}
          isLoading={isLoading || accountLoading}
        />
        <StatsCard
          title="Added/Modified"
          value={data?.logs?.filter((l) => l.change_type === 'added' || l.change_type === 'modified').length ?? 0}
          isLoading={isLoading || accountLoading}
          className="text-emerald-600"
        />
        <StatsCard
          title="Deletions"
          value={data?.logs?.filter((l) => l.change_type === 'deleted').length ?? 0}
          isLoading={isLoading || accountLoading}
          className="text-red-600"
        />
      </div>

      {isLoading || accountLoading ? (
        <Card>
          <CardContent className="p-6">
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          </CardContent>
        </Card>
      ) : error ? (
        <Card>
          <CardContent className="flex items-center justify-center p-12">
            <p className="text-muted-foreground">Failed to load logs. Please check your SFTP settings.</p>
          </CardContent>
        </Card>
      ) : filteredLogs.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center p-12 text-center">
            {monitoringStatus === 'monitoring' ? (
              <CheckCircle className="h-12 w-12 text-emerald-500 mb-4" />
            ) : monitoringStatus === 'error' ? (
              <AlertCircle className="h-12 w-12 text-red-500 mb-4" />
            ) : monitoringStatus === 'starting' ? (
              <Server className="h-12 w-12 text-blue-500 animate-pulse mb-4" />
            ) : (
              <Server className="h-12 w-12 text-muted-foreground/50 mb-4" />
            )}
            <h3 className="font-semibold">
              {monitoringStatus === 'monitoring' ? 'Monitoring Active - No Changes Yet' : 
               monitoringStatus === 'error' ? 'Connection Error' :
               monitoringStatus === 'starting' ? 'Starting Monitor...' : 'Ready to Monitor'}
            </h3>
            <p className="text-sm text-muted-foreground mt-1 max-w-sm">
              {monitoringStatus === 'monitoring' 
                ? `Watching ${totalFiles} files. Changes will appear here automatically.`
                : monitoringStatus === 'error'
                ? lastScanResult || 'Failed to connect to SFTP server.'
                : monitoringStatus === 'starting'
                ? 'Connecting to SFTP and creating baseline...'
                : 'Click "Start Monitoring" to begin watching for file changes.'}
            </p>
            {monitoringStatus === 'idle' && (
              <Button onClick={startMonitoring} className="mt-4">
                <Play className="mr-2 h-4 w-4" />
                Start Monitoring
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <LogsTable logs={filteredLogs} />
      )}
    </div>
  )
}

function StatsCard({
  title,
  value,
  isLoading,
  className,
}: {
  title: string
  value: number
  isLoading: boolean
  className?: string
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-8 w-16" />
        ) : (
          <p className={`text-2xl font-bold ${className ?? ''}`}>{value}</p>
        )}
      </CardContent>
    </Card>
  )
}
