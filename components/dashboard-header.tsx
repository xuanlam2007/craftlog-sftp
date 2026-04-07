'use client'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Search, CheckCircle, AlertCircle, Loader2, Play, Square } from 'lucide-react'

interface DashboardHeaderProps {
  title: string
  description?: string
  searchValue?: string
  onSearchChange?: (value: string) => void
  monitoringStatus?: 'idle' | 'starting' | 'monitoring' | 'error'
  onStartMonitoring?: () => void
  onStopMonitoring?: () => void
}

export function DashboardHeader({
  title,
  description,
  searchValue,
  onSearchChange,
  monitoringStatus,
  onStartMonitoring,
  onStopMonitoring,
}: DashboardHeaderProps) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 className="text-2xl font-bold text-foreground">{title}</h1>
        {description && (
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      <div className="flex items-center gap-3">
        {onSearchChange && (
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search files..."
              value={searchValue}
              onChange={(e) => onSearchChange(e.target.value)}
              className="w-64 pl-9"
            />
          </div>
        )}
        {monitoringStatus === 'idle' && onStartMonitoring && (
          <Button onClick={onStartMonitoring} size="sm">
            <Play className="mr-2 h-4 w-4" />
            Start Monitoring
          </Button>
        )}
        {monitoringStatus === 'starting' && onStopMonitoring && (
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 rounded-md bg-blue-500/10 px-3 py-1.5 text-sm">
              <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
              <span className="text-blue-600 font-medium">Starting...</span>
            </div>
            <Button onClick={onStopMonitoring} variant="outline" size="sm">
              <Square className="mr-2 h-3 w-3" />
              Cancel
            </Button>
          </div>
        )}
        {monitoringStatus === 'monitoring' && onStopMonitoring && (
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 rounded-md bg-emerald-500/10 px-3 py-1.5 text-sm">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500"></span>
              </span>
              <span className="text-emerald-600 font-medium">Monitoring</span>
            </div>
            <Button onClick={onStopMonitoring} variant="outline" size="sm">
              <Square className="mr-2 h-3 w-3" />
              Stop
            </Button>
          </div>
        )}
        {monitoringStatus === 'error' && onStartMonitoring && (
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 rounded-md bg-red-500/10 px-3 py-1.5 text-sm">
              <AlertCircle className="h-4 w-4 text-red-500" />
              <span className="text-red-600">Error</span>
            </div>
            <Button onClick={onStartMonitoring} variant="outline" size="sm">
              Retry
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
