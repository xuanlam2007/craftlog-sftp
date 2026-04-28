'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Plus, Folder, File, ChevronRight, ArrowLeft, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface FileItem {
  name: string
  type: 'folder' | 'file'
  path: string
  size: number
}

interface CreateLogDialogProps {
  accountId: string
  onLogCreated: () => void
}

export function CreateLogDialog({ accountId, onLogCreated }: CreateLogDialogProps) {
  const [open, setOpen] = useState(false)
  const [filePath, setFilePath] = useState('')
  const [changeType, setChangeType] = useState<'added' | 'modified' | 'deleted'>('modified')
  const [isSubmitting, setIsSubmitting] = useState(false)
  
  // File browser state
  const [currentPath, setCurrentPath] = useState('/')
  const [items, setItems] = useState<FileItem[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [showBrowser, setShowBrowser] = useState(false)

  const loadDirectory = async (path: string) => {
    setIsLoading(true)
    try {
      const response = await fetch('/api/browse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ account_id: accountId, path })
      })
      const data = await response.json()
      
      if (data.success) {
        setItems(data.items)
        setCurrentPath(path)
      } else {
        toast.error('Failed to load directory', {
          description: data.message || 'Could not connect to SFTP server.',
        })
        setShowBrowser(false)
      }
    } catch {
      toast.error('Failed to load directory', {
        description: 'An unexpected error occurred.',
      })
      setShowBrowser(false)
    } finally {
      setIsLoading(false)
    }
  }

  const handleOpenBrowser = () => {
    setShowBrowser(true)
    loadDirectory('/')
  }

  const handleSelectItem = (item: FileItem) => {
    if (item.type === 'folder') {
      loadDirectory(item.path)
    } else {
      setFilePath(item.path)
      setShowBrowser(false)
    }
  }

  const handleGoBack = () => {
    const parentPath = currentPath.split('/').slice(0, -1).join('/') || '/'
    loadDirectory(parentPath)
  }

  const handleSubmit = async () => {
    if (!filePath.trim()) return

    setIsSubmitting(true)
    try {
      const response = await fetch('/api/logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          account_id: accountId,
          file_path: filePath,
          change_type: changeType,
        })
      })
      
      if (response.ok) {
        toast.success('Log created successfully')
        setFilePath('')
        setChangeType('modified')
        setOpen(false)
        onLogCreated()
      } else {
        const data = await response.json()
        toast.error('Failed to create log', {
          description: data.message || 'Please try again.',
        })
      }
    } catch {
      toast.error('Failed to create log', {
        description: 'An unexpected error occurred.',
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="mr-2 h-4 w-4" />
          Create Log
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Create Change Log</DialogTitle>
          <DialogDescription>
            Manually log a file change. Browse or type the file path.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 pt-4">
          {/* File Path Input */}
          <div className="space-y-2">
            <Label htmlFor="filePath">File Path</Label>
            <div className="flex gap-2">
              <Input
                id="filePath"
                placeholder="/plugins/example/config.yml"
                value={filePath}
                onChange={(e) => setFilePath(e.target.value)}
                className="flex-1"
              />
              <Button 
                type="button" 
                variant="outline" 
                onClick={handleOpenBrowser}
                disabled={isLoading}
              >
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Browse'}
              </Button>
            </div>
          </div>

          {/* File Browser */}
          {showBrowser && (
            <div className="border rounded-lg overflow-hidden">
              {/* Browser Header */}
              <div className="flex items-center gap-2 px-3 py-2 bg-muted border-b">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleGoBack}
                  disabled={currentPath === '/' || isLoading}
                  className="h-7 px-2"
                >
                  <ArrowLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm text-muted-foreground truncate flex-1">
                  {currentPath}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowBrowser(false)}
                  className="h-7 px-2"
                >
                  Close
                </Button>
              </div>
              
              {/* File List */}
              <div className="max-h-64 overflow-y-auto">
                {isLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : items.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground text-sm">
                    Empty directory
                  </div>
                ) : (
                  <div className="divide-y">
                    {items.map((item) => (
                      <button
                        key={item.path}
                        onClick={() => handleSelectItem(item)}
                        className={cn(
                          "w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-muted/50 transition-colors",
                          item.type === 'file' && "hover:bg-primary/5"
                        )}
                      >
                        {item.type === 'folder' ? (
                          <Folder className="h-4 w-4 text-amber-500 shrink-0" />
                        ) : (
                          <File className="h-4 w-4 text-muted-foreground shrink-0" />
                        )}
                        <span className="text-sm truncate flex-1">{item.name}</span>
                        {item.type === 'folder' && (
                          <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Change Type */}
          <div className="space-y-2">
            <Label htmlFor="changeType">Change Type</Label>
            <Select value={changeType} onValueChange={(v) => setChangeType(v as typeof changeType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="added">Added (New File)</SelectItem>
                <SelectItem value="modified">Modified (Edited)</SelectItem>
                <SelectItem value="deleted">Deleted</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Submit Button */}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={!filePath.trim() || isSubmitting}>
              {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Create Log
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
