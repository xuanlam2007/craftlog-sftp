'use client'

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react'
import { useAuth } from './auth-context'
import type { SftpAccount } from './types'

interface SftpContextType {
  accounts: SftpAccount[]
  currentAccount: SftpAccount | null
  isLoading: boolean
  selectAccount: (accountId: string) => Promise<void>
  refreshAccounts: () => Promise<void>
  createAccount: (data: Omit<SftpAccount, '$id' | '$createdAt' | 'owner_id'>) => Promise<SftpAccount>
  updateAccount: (accountId: string, data: Partial<SftpAccount>) => Promise<void>
  deleteAccount: (accountId: string) => Promise<void>
}

const SftpContext = createContext<SftpContextType | null>(null)

export function SftpProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [accounts, setAccounts] = useState<SftpAccount[]>([])
  const [currentAccount, setCurrentAccount] = useState<SftpAccount | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const refreshAccounts = useCallback(async () => {
    if (!user) {
      setAccounts([])
      setCurrentAccount(null)
      setIsLoading(false)
      return
    }

    try {
      const response = await fetch('/api/accounts')
      const data = await response.json()
      if (data.accounts) {
        setAccounts(data.accounts)
      }
    } catch (error) {
      console.error('Failed to fetch accounts:', error)
    } finally {
      setIsLoading(false)
    }
  }, [user])

  // Load accounts and auto-select last used
  useEffect(() => {
    if (!user) {
      setAccounts([])
      setCurrentAccount(null)
      setIsLoading(false)
      return
    }

    const loadAccountsAndAutoSelect = async () => {
      setIsLoading(true)
      try {
        // Fetch accounts
        const accountsRes = await fetch('/api/accounts')
        const accountsData = await accountsRes.json()
        const fetchedAccounts = accountsData.accounts || []
        setAccounts(fetchedAccounts)

        // Get user preferences for auto-connect
        const prefsRes = await fetch('/api/user-preferences')
        const prefsData = await prefsRes.json()
        
        if (prefsData.preferences?.last_account_id && fetchedAccounts.length > 0) {
          const lastAccount = fetchedAccounts.find(
            (a: SftpAccount) => a.$id === prefsData.preferences.last_account_id
          )
          if (lastAccount) {
            setCurrentAccount(lastAccount)
          } else if (fetchedAccounts.length > 0) {
            setCurrentAccount(fetchedAccounts[0])
          }
        } else if (fetchedAccounts.length > 0) {
          setCurrentAccount(fetchedAccounts[0])
        }
      } catch (error) {
        console.error('Failed to load accounts:', error)
      } finally {
        setIsLoading(false)
      }
    }

    loadAccountsAndAutoSelect()
  }, [user])

  const selectAccount = async (accountId: string) => {
    const account = accounts.find(a => a.$id === accountId)
    if (account) {
      setCurrentAccount(account)
      // Save preference
      try {
        await fetch('/api/user-preferences', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ last_account_id: accountId })
        })
      } catch (error) {
        console.error('Failed to save preference:', error)
      }
    }
  }

  const createAccount = async (data: Omit<SftpAccount, '$id' | '$createdAt' | 'owner_id'>): Promise<SftpAccount> => {
    const response = await fetch('/api/accounts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    })
    const result = await response.json()
    if (!response.ok) {
      throw new Error(result.error || 'Failed to create account')
    }
    await refreshAccounts()
    // Auto-select the new account
    if (result.account) {
      setCurrentAccount(result.account)
    }
    return result.account
  }

  const updateAccount = async (accountId: string, data: Partial<SftpAccount>) => {
    const response = await fetch(`/api/accounts/${accountId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    })
    if (!response.ok) {
      const result = await response.json()
      throw new Error(result.error || 'Failed to update account')
    }
    await refreshAccounts()
  }

  const deleteAccount = async (accountId: string) => {
    const response = await fetch(`/api/accounts/${accountId}`, {
      method: 'DELETE'
    })
    if (!response.ok) {
      const result = await response.json()
      throw new Error(result.error || 'Failed to delete account')
    }
    if (currentAccount?.$id === accountId) {
      setCurrentAccount(accounts.find(a => a.$id !== accountId) || null)
    }
    await refreshAccounts()
  }

  return (
    <SftpContext.Provider value={{
      accounts,
      currentAccount,
      isLoading,
      selectAccount,
      refreshAccounts,
      createAccount,
      updateAccount,
      deleteAccount
    }}>
      {children}
    </SftpContext.Provider>
  )
}

export function useSftp() {
  const context = useContext(SftpContext)
  if (!context) {
    throw new Error('useSftp must be used within a SftpProvider')
  }
  return context
}
