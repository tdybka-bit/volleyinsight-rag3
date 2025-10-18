'use client'

import { createContext, useContext, useState, useEffect } from 'react'

type Theme = 'blue' | 'mint'

interface ThemeContextType {
  theme: Theme
  toggleTheme: () => void
  setTheme: (theme: Theme) => void
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('blue')

  // Load theme from localStorage on mount
  useEffect(() => {
    const savedTheme = localStorage.getItem('volleyinsight-theme') as Theme
    if (savedTheme && (savedTheme === 'blue' || savedTheme === 'mint')) {
      setThemeState(savedTheme)
    }
  }, [])

  // Save theme to localStorage and update document
  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme)
    localStorage.setItem('volleyinsight-theme', newTheme)
    document.documentElement.setAttribute('data-theme', newTheme)
  }

  const toggleTheme = () => {
    const newTheme = theme === 'blue' ? 'mint' : 'blue'
    setTheme(newTheme)
  }

  // Update document attribute when theme changes
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
  }, [theme])

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const context = useContext(ThemeContext)
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider')
  }
  return context
}

















