'use client'

import { ArrowLeft, Home, Volleyball } from 'lucide-react'
import Link from 'next/link'
import ThemeToggle from './ThemeToggle'

interface TopicHeaderProps {
  topic: string
  topicName: string
  emoji: string
  description: string
}

export default function TopicHeader({ topic, topicName, emoji, description }: TopicHeaderProps) {
  return (
    <div className="glass-card rounded-xl p-6 mb-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Link 
            href="/"
            className="p-2 rounded-lg hover:bg-white/10 transition-colors"
            title="Powrót do strony głównej"
          >
            <ArrowLeft className="w-5 h-5 text-muted-foreground" />
          </Link>
          
          <div className="flex items-center space-x-3">
            <div 
              className="w-12 h-12 rounded-xl flex items-center justify-center"
              style={{ 
                background: `linear-gradient(135deg, var(--gradient-start), var(--gradient-end), var(--gradient-accent))` 
              }}
            >
              <span className="text-2xl">{emoji}</span>
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">{topicName}</h1>
              <p className="text-muted-foreground">{description}</p>
            </div>
          </div>
        </div>
        
        <div className="flex items-center space-x-2">
          <Link 
            href="/"
            className="flex items-center space-x-2 px-3 py-2 glass rounded-lg hover:bg-white/10 transition-colors"
          >
            <Home className="w-4 h-4" />
            <span className="text-sm">Strona główna</span>
          </Link>
          
          <ThemeToggle />
          
          <div className="flex items-center space-x-2 px-3 py-2 glass rounded-lg">
            <Volleyball className="w-4 h-4 text-primary" />
            <span className="text-sm font-semibold text-primary">VolleyInsight</span>
          </div>
        </div>
      </div>
    </div>
  )
}
