'use client'

import { Sun, Moon, Palette } from 'lucide-react'
import { useTheme } from './ThemeProvider'

export default function ThemeToggle() {
  const { theme, toggleTheme } = useTheme()

  return (
    <button
      onClick={toggleTheme}
      className="flex items-center space-x-2 px-3 py-2 glass rounded-lg hover:bg-white/10 transition-all duration-300 group"
      title={`Przełącz na motyw ${theme === 'blue' ? 'miętowy' : 'niebieski'}`}
    >
      <div className="flex items-center space-x-1">
        <div 
          className="w-3 h-3 rounded-full"
          style={{ 
            background: `linear-gradient(135deg, var(--gradient-start), var(--gradient-end))` 
          }}
        ></div>
        <div 
          className="w-3 h-3 rounded-full"
          style={{ 
            background: `var(--gradient-accent)` 
          }}
        ></div>
      </div>
      <span className="text-sm font-medium text-card-foreground group-hover:text-primary transition-colors">
        {theme === 'blue' ? 'Niebieski + Pomarańczowy' : 'Miętowy + Beżowy'}
      </span>
      <Palette className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
    </button>
  )
}
