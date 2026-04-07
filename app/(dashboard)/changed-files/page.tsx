'use client'

import { useState } from 'react'
import useSWR from 'swr'
import { useSftp } from '@/lib/sftp-context'
import { DashboardHeader } from '@/components/dashboard-header'
import { ChangedFilesTable } from '@/components/changed-files-table'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Server } from 'lucide-react'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import type { ChangedFile } from '@/lib/types'

const fetcher = (url: string) => fetch(url).then((res) => res.json())

export default function ChangedFilesPage() {
  const { currentAccount, isLoading: accountLoading } = useSftp()
  const [searchQuery, setSearchQuery] = useState('')

  const { data, error, isLoading } = useSWR<{ files: ChangedFile[]; total: number }>(
    currentAccount?.$id ? `/api/changed-files?account_id=${currentAccount.$id}` : null,
    fetcher,
    { refreshInterval: 30000 }
  )

  const filteredFiles = data?.files?.filter((file) =>
    file.file_path.toLowerCase().includes(searchQuery.toLowerCase())
  ) ?? []

  // Show prompt to select/create account
  if (!accountLoading && !currentAccount) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">All Changed Files</h1>
          <p className="mt-1 text-sm text-muted-foreground">Unique list of all files that have ever been changed</p>
        </div>
        <Alert>
          <Server className="h-4 w-4" />
          <AlertTitle>No SFTP Account Selected</AlertTitle>
          <AlertDescription className="flex flex-col gap-3">
            <span>Please create or select an SFTP account to view changed files.</span>
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
        title="All Changed Files"
        description={`Monitoring: ${currentAccount?.name || 'Loading...'}`}
        searchValue={searchQuery}
        onSearchChange={setSearchQuery}
        showScanButton={false}
      />

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
            <p className="text-muted-foreground">Failed to load changed files.</p>
          </CardContent>
        </Card>
      ) : filteredFiles.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center p-12 text-center">
            <Server className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <h3 className="font-semibold">No Changed Files Yet</h3>
            <p className="text-sm text-muted-foreground mt-1 max-w-sm">
              Run a scan from the Logs page to start tracking file changes.
            </p>
          </CardContent>
        </Card>
      ) : (
        <ChangedFilesTable files={filteredFiles} />
      )}
    </div>
  )
}
