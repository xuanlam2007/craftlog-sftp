'use client'

import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Trash2, Loader2 } from 'lucide-react'
import type { ChangeLog } from '@/lib/types'

interface LogsTableProps {
  logs: ChangeLog[]
  onLogDeleted?: () => void
}

const SKIP_DELETE_CONFIRM_KEY = 'sftp-monitor-skip-delete-confirm'

export function LogsTable({ logs, onLogDeleted }: LogsTableProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [isDeleting, setIsDeleting] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [pendingDeleteIds, setPendingDeleteIds] = useState<string[]>([])
  const [skipConfirm, setSkipConfirm] = useState(false)
  const [dontAskAgain, setDontAskAgain] = useState(false)

  // Load skip confirm preference
  useEffect(() => {
    const saved = localStorage.getItem(SKIP_DELETE_CONFIRM_KEY)
    if (saved === 'true') {
      setSkipConfirm(true)
    }
  }, [])

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(new Set(logs.map(log => log.$id).filter(Boolean) as string[]))
    } else {
      setSelectedIds(new Set())
    }
  }

  const handleSelectOne = (logId: string, checked: boolean) => {
    const newSelected = new Set(selectedIds)
    if (checked) {
      newSelected.add(logId)
    } else {
      newSelected.delete(logId)
    }
    setSelectedIds(newSelected)
  }

  const initiateDelete = (ids: string[]) => {
    if (ids.length === 0) return
    
    if (skipConfirm) {
      performDelete(ids)
    } else {
      setPendingDeleteIds(ids)
      setShowDeleteDialog(true)
    }
  }

  const performDelete = async (ids: string[]) => {
    setIsDeleting(true)
    setShowDeleteDialog(false)
    
    // Save preference if "don't ask again" was checked
    if (dontAskAgain) {
      localStorage.setItem(SKIP_DELETE_CONFIRM_KEY, 'true')
      setSkipConfirm(true)
    }
    
    try {
      // Delete all selected logs in parallel
      const results = await Promise.all(
        ids.map(id => fetch(`/api/logs?id=${id}`, { method: 'DELETE' }))
      )
      
      const failedCount = results.filter(r => !r.ok).length
      if (failedCount > 0) {
        toast.error(`Failed to delete ${failedCount} log(s)`, {
          description: 'Please try again or check your connection.',
        })
      } else {
        toast.success(`Deleted ${ids.length} log(s)`)
      }
      
      setSelectedIds(new Set())
      onLogDeleted?.()
    } catch (error) {
      toast.error('Failed to delete logs', {
        description: 'An unexpected error occurred. Please try again.',
      })
    } finally {
      setIsDeleting(false)
      setPendingDeleteIds([])
      setDontAskAgain(false)
    }
  }

  const handleDeleteSelected = () => {
    initiateDelete(Array.from(selectedIds))
  }

  const handleDeleteSingle = (logId: string) => {
    initiateDelete([logId])
  }

  const getChangeTypeBadge = (type: ChangeLog['change_type']) => {
    switch (type) {
      case 'added':
        return <Badge className="bg-emerald-500/15 text-emerald-600 hover:bg-emerald-500/25">Added</Badge>
      case 'modified':
        return <Badge className="bg-amber-500/15 text-amber-600 hover:bg-amber-500/25">Modified</Badge>
      case 'deleted':
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

  const allSelected = logs.length > 0 && selectedIds.size === logs.length
  const someSelected = selectedIds.size > 0

  if (logs.length === 0) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center p-12">
          <div className="text-center">
            <p className="text-muted-foreground">No changes detected yet.</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Click &quot;Create Log&quot; to manually log a file change.
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 h-[72px]">
          <CardTitle>Recent Changes</CardTitle>
          <div className="w-[180px] flex justify-end">
            {someSelected && (
              <Button
                variant="destructive"
                size="sm"
                onClick={handleDeleteSelected}
                disabled={isDeleting}
              >
                {isDeleting ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="mr-2 h-4 w-4" />
                )}
                Delete ({selectedIds.size})
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[50px]">
                    <Checkbox
                      checked={allSelected}
                      onCheckedChange={handleSelectAll}
                      aria-label="Select all"
                    />
                  </TableHead>
                  <TableHead className="w-[100px]">Type</TableHead>
                  <TableHead>File Name</TableHead>
                  <TableHead className="hidden md:table-cell">Path</TableHead>
                  <TableHead className="w-[180px]">Detected At</TableHead>
                  <TableHead className="w-[60px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((log) => (
                  <TableRow key={log.$id} data-selected={selectedIds.has(log.$id || '')}>
                    <TableCell>
                      <Checkbox
                        checked={selectedIds.has(log.$id || '')}
                        onCheckedChange={(checked) => log.$id && handleSelectOne(log.$id, checked as boolean)}
                        aria-label={`Select ${log.file_path}`}
                      />
                    </TableCell>
                    <TableCell>{getChangeTypeBadge(log.change_type)}</TableCell>
                    <TableCell className="font-medium">{getFilename(log.file_path)}</TableCell>
                    <TableCell className="hidden max-w-[300px] truncate text-muted-foreground md:table-cell">
                      {log.file_path}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDate(log.detected_at)}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-red-600"
                        onClick={() => log.$id && handleDeleteSingle(log.$id)}
                        disabled={isDeleting}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {pendingDeleteIds.length === 1 ? 'Log' : `${pendingDeleteIds.length} Logs`}?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. {pendingDeleteIds.length === 1 
                ? 'This log will be permanently deleted from the database.'
                : `These ${pendingDeleteIds.length} logs will be permanently deleted from the database.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex items-center space-x-2 py-2">
            <Checkbox
              id="dont-ask"
              checked={dontAskAgain}
              onCheckedChange={(checked) => setDontAskAgain(checked as boolean)}
            />
            <label
              htmlFor="dont-ask"
              className="text-sm text-muted-foreground cursor-pointer"
            >
              Don&apos;t ask me again
            </label>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => performDelete(pendingDeleteIds)}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
