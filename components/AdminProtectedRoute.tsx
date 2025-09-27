'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAdminAuth } from './AdminAuthProvider'

interface AdminProtectedRouteProps {
  children: React.ReactNode
}

export default function AdminProtectedRoute({ children }: AdminProtectedRouteProps) {
  const { isAdmin, user } = useAdminAuth()
  const router = useRouter()
  const [isChecking, setIsChecking] = useState(true)

  useEffect(() => {
    // Sprawdź czy mamy dane z localStorage
    const checkAuth = () => {
      if (typeof window === 'undefined') return
      
      const savedSession = localStorage.getItem('volleyinsight-admin-session')
      if (savedSession) {
        try {
          const sessionData = JSON.parse(savedSession)
          // Sprawdź czy sesja jest nadal ważna (24 godziny)
          if (Date.now() - sessionData.loginTime < 24 * 60 * 60 * 1000) {
            setIsChecking(false)
            return
          } else {
            localStorage.removeItem('volleyinsight-admin-session')
          }
        } catch (error) {
          localStorage.removeItem('volleyinsight-admin-session')
        }
      }
      
      // Jeśli nie ma ważnej sesji, przekieruj do logowania
      setIsChecking(false)
      router.push('/admin')
    }

    // Sprawdź po krótkim opóźnieniu, żeby kontekst się załadował
    const timer = setTimeout(checkAuth, 100)
    
    return () => clearTimeout(timer)
  }, [router])

  // Jeśli sprawdzamy uprawnienia, pokaż loading
  if (isChecking) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--background)' }}>
        <div className="glass-card rounded-xl p-8 text-center">
          <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-muted-foreground">Sprawdzanie uprawnień...</p>
        </div>
      </div>
    )
  }

  // Jeśli nie jesteś zalogowany, nie pokazuj nic (zostaniesz przekierowany)
  if (!isAdmin) {
    return null
  }

  return <>{children}</>
}
