'use client'

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import type { ChangeLog } from '@/lib/types'

interface LogsTableProps {
  logs: ChangeLog[]
}

export function LogsTable({ logs }: LogsTableProps) {
  const getChangeTypeBadge = (type: ChangeLog['change_type']) => {
    switch (type) {
      case 'upload':
        return <Badge className="bg-emerald-500/15 text-emerald-600 hover:bg-emerald-500/25">Uploaded</Badge>
      case 'edit':
        return <Badge className="bg-amber-500/15 text-amber-600 hover:bg-amber-500/25">Edited</Badge>
      case 'delete':
        return <Badge className="bg-red-500/15 text-red-600 hover:bg-red-500/25">Deleted</Badge>
      default:
        return <Badge variant="secondary">{type}</Badge>
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const getFilename = (filePath: string) => {
    return filePath.split('/').pop() || filePath
  }

  if (logs.length === 0) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center p-12">
          <div className="text-center">
            <p className="text-muted-foreground">No changes detected yet.</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Click &quot;Create Log&quot; to scan for file changes.
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Changes</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[100px]">Type</TableHead>
                <TableHead>File Name</TableHead>
                <TableHead className="hidden md:table-cell">Path</TableHead>
                <TableHead className="w-[180px]">Detected At</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.map((log) => (
                <TableRow key={log.$id}>
                  <TableCell>{getChangeTypeBadge(log.change_type)}</TableCell>
                  <TableCell className="font-medium">{getFilename(log.file_path)}</TableCell>
                  <TableCell className="hidden max-w-[300px] truncate text-muted-foreground md:table-cell">
                    {log.file_path}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDate(log.detected_at)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  )
}
