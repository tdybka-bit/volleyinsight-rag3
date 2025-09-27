'use client'

import { createContext, useContext, useState, useEffect } from 'react'

interface AdminUser {
  isAuthenticated: boolean
  loginTime: number
  sessionId: string
}

interface AdminAuthContextType {
  user: AdminUser | null
  login: (password: string) => boolean
  logout: () => void
  isAdmin: boolean
}

const AdminAuthContext = createContext<AdminAuthContextType | undefined>(undefined)

const ADMIN_PASSWORD = 'volleyadmin2024'

export function AdminAuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AdminUser | null>(null)

  // Check for existing session on mount
  useEffect(() => {
    if (typeof window === 'undefined') return
    
    const savedSession = localStorage.getItem('volleyinsight-admin-session')
    if (savedSession) {
      try {
        const sessionData = JSON.parse(savedSession)
        // Check if session is still valid (24 hours)
        if (Date.now() - sessionData.loginTime < 24 * 60 * 60 * 1000) {
          setUser(sessionData)
        } else {
          localStorage.removeItem('volleyinsight-admin-session')
        }
      } catch (error) {
        localStorage.removeItem('volleyinsight-admin-session')
      }
    }
  }, [])

  const login = (password: string): boolean => {
    if (password === ADMIN_PASSWORD) {
      const sessionData: AdminUser = {
        isAuthenticated: true,
        loginTime: Date.now(),
        sessionId: `admin_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      }
      setUser(sessionData)
      if (typeof window !== 'undefined') {
        localStorage.setItem('volleyinsight-admin-session', JSON.stringify(sessionData))
      }
      return true
    }
    return false
  }

  const logout = () => {
    setUser(null)
    if (typeof window !== 'undefined') {
      localStorage.removeItem('volleyinsight-admin-session')
    }
  }

  const isAdmin = user?.isAuthenticated || false

  return (
    <AdminAuthContext.Provider value={{ user, login, logout, isAdmin }}>
      {children}
    </AdminAuthContext.Provider>
  )
}

export function useAdminAuth() {
  const context = useContext(AdminAuthContext)
  if (context === undefined) {
    throw new Error('useAdminAuth must be used within an AdminAuthProvider')
  }
  return context
}
