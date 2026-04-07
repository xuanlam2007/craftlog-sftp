'use client'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Search, RefreshCw } from 'lucide-react'

interface DashboardHeaderProps {
  title: string
  description?: string
  searchValue?: string
  onSearchChange?: (value: string) => void
  onScan?: () => void
  isScanning?: boolean
  showScanButton?: boolean
}

export function DashboardHeader({
  title,
  description,
  searchValue,
  onSearchChange,
  onScan,
  isScanning,
  showScanButton = true,
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
        {showScanButton && onScan && (
          <Button onClick={onScan} disabled={isScanning}>
            <RefreshCw className={cn('mr-2 h-4 w-4', isScanning && 'animate-spin')} />
            {isScanning ? 'Scanning...' : 'Create Log'}
          </Button>
        )}
      </div>
    </div>
  )
}

function cn(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(' ')
}
