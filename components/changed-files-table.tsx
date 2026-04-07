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
import type { ChangedFile } from '@/lib/types'

interface ChangedFilesTableProps {
  files: ChangedFile[]
}

export function ChangedFilesTable({ files }: ChangedFilesTableProps) {
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

  if (files.length === 0) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center p-12">
          <div className="text-center">
            <p className="text-muted-foreground">No changed files recorded yet.</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Changes will appear here after scans detect file modifications.
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          Changed Files Registry
          <Badge variant="secondary" className="ml-2">
            {files.length} unique files
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>File Name</TableHead>
                <TableHead className="hidden md:table-cell">Path</TableHead>
                <TableHead>Last Changed</TableHead>
                <TableHead className="w-[120px] text-center">Changes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {files.map((file) => (
                <TableRow key={file.$id}>
                  <TableCell className="font-medium">{getFilename(file.file_path)}</TableCell>
                  <TableCell className="hidden max-w-[300px] truncate text-muted-foreground md:table-cell">
                    {file.file_path}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDate(file.last_detected)}
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge variant="outline">{file.change_count}</Badge>
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
