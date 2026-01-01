'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { 
  Volleyball, 
  MessageCircle, 
  Send, 
  Target, 
  Shield, 
  BookOpen,
  ChevronRight,
  Play,
  Sparkles,
  Loader2,
  Zap,
  Settings,
  User,
  Phone,
  HelpCircle
} from 'lucide-react'
import { useTheme } from '../components/ThemeProvider'
import ThemeToggle from '../components/ThemeToggle'
import { useAnalytics } from '../lib/analytics'

interface Message {
  role: 'user' | 'assistant';
  content: string;
  queryType?: 'stats' | 'expert';
  sources?: Array<{
    id: number;
    content: string;
    score: number;
    source: string;
  }>;
}

export default function VolleyInsight() {
  const { theme } = useTheme()
  const { trackBlockClick, trackQuestion, trackPageView } = useAnalytics()
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [inputMessage, setInputMessage] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [useHybrid, setUseHybrid] = useState(false) // ← DODAJ TO

  // Track page view on mount
  useEffect(() => {
    trackPageView('home')
  }, [trackPageView])

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

const sendMessage = async () => {
  if (!inputMessage.trim() || isLoading) return

  const userMessage: Message = { role: 'user', content: inputMessage }
  setMessages(prev => [...prev, userMessage])
  setInputMessage('')
  setIsLoading(true)

  // Create placeholder for streaming response
  const assistantMessageId = Date.now();
  const assistantMessage: Message = {
    role: 'assistant',
    content: '',
    queryType: undefined,
    sources: undefined
  }
  
  setMessages(prev => [...prev, assistantMessage])

  try {
    const response = await fetch(useHybrid ? '/api/chat-hybrid' : '/api/chat-unified', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: inputMessage,
        history: messages.map(m => ({
          role: m.role,
          content: m.content
        }))
      })
    })

    if (!response.ok) {
      throw new Error('Network response was not ok')
    }

    // ✅ HANDLE STREAMING RESPONSE
    const reader = response.body?.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    let fullContent = ''
    let metadata: any = null

    if (reader) {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6)
            
            if (data === '[DONE]') {
              continue
            }

            try {
              const parsed = JSON.parse(data)
              
              // Handle metadata (queryType, sources)
              if (parsed.metadata) {
                metadata = parsed.metadata
              }
              
              // Handle content chunks
              if (parsed.content) {
                fullContent += parsed.content
                
                // Update message in real-time
                setMessages(prev => prev.map((msg, idx) => 
                  idx === prev.length - 1
                    ? {
                        ...msg,
                        content: fullContent,
                        queryType: metadata?.queryType,
                        sources: metadata?.sources
                      }
                    : msg
                ))
              }
            } catch (e) {
              console.error('Parse error:', e)
            }
          }
        }
      }
    }

  } catch (error) {
    console.error('Chat error:', error)
    setMessages(prev => [
      ...prev.slice(0, -1), // Remove placeholder
      {
        role: 'assistant',
        content: 'Przepraszam, wystąpił błąd. Spróbuj ponownie.',
      }
    ])
  } finally {
    setIsLoading(false)
  }
}

  const trainingModules = [
    {
      id: 'blok',
      title: 'Blok',
      description: 'Technika i taktyka bloku',
      icon: Shield,
      question: 'Jak poprawić technikę bloku?',
      emoji: '🛡️',
      progress: 40,
      completedMaterials: 2,
      totalMaterials: 5
    },
    {
      id: 'obrona',
      title: 'Obrona',
      description: 'Podstawy obrony w siatkówce',
      icon: Shield,
      question: 'Jakie są podstawy obrony w siatkówce?',
      emoji: '🛡️',
      progress: 40,
      completedMaterials: 2,
      totalMaterials: 5
    },
    {
      id: 'atak',
      title: 'Atak',
      description: 'Skuteczne ataki i finisze',
      icon: Zap,
      question: 'Jak wykonać skuteczny atak?',
      emoji: '⚡',
      progress: 40,
      completedMaterials: 2,
      totalMaterials: 5
    },
    {
      id: 'zagrywka',
      title: 'Zagrywka',
      description: 'Rodzaje i techniki zagrywek',
      icon: Target,
      question: 'Jakie są rodzaje zagrywek?',
      emoji: '🏐',
      progress: 40,
      completedMaterials: 2,
      totalMaterials: 5
    },
    {
      id: 'ustawienia',
      title: 'Ustawienia',
      description: 'Prawidłowe ustawianie piłki',
      icon: Settings,
      question: 'Jak prawidłowo ustawiać piłkę?',
      emoji: '⚙️',
      progress: 40,
      completedMaterials: 2,
      totalMaterials: 5
    },
    {
      id: 'przepisy',
      title: 'Przepisy',
      description: 'Zasady i regulamin gry',
      icon: BookOpen,
      question: 'Jakie są najważniejsze przepisy gry?',
      emoji: '📋',
      progress: 40,
      completedMaterials: 2,
      totalMaterials: 5
    },
    {
      id: 'dashboard',
      title: 'Dashboard Graczy',
      description: 'Statystyki i wykresy PlusLiga & Tauron Liga',
      icon: Target,
      question: 'Zobacz statystyki graczy',
      emoji: '📊',
      progress: 0,
      completedMaterials: 0,
      totalMaterials: 0
    }
  ]

  const quickQuestions = [
    'Jak poprawić technikę ataku?',
    'Jakie są podstawowe zasady siatkówki?',
    'Jak poprawnie wykonać blok?',
    'Jakie są najważniejsze przepisy?'
  ]

  return (
    <div className="min-h-screen theme-transition" style={{ background: 'var(--background)' }}>
      {/* Header */}
      <header className="sticky top-0 z-50 glass border-b border-border">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" 
                   style={{ background: `linear-gradient(135deg, var(--gradient-start), var(--gradient-end), var(--gradient-accent))` }}>
                <Volleyball className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold gradient-text">VolleyInsight</h1>
                <p className="text-sm text-muted-foreground">AI Platform</p>
              </div>
            </div>
            
            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* Main 3-Column Layout */}
      <div className="flex h-[calc(100vh-80px)]">
        
        {/* Left Column - Control Panel (20%) */}
        <div className="w-1/5 glass border-r border-border p-4">
          <div className="space-y-3">
            {/* My Account */}
            <div className="glass-card rounded-xl p-3">
              <h3 className="font-semibold text-card-foreground mb-2 flex items-center text-sm">
                <User className="w-4 h-4 mr-2" />
                Moje konto
              </h3>
              <div className="space-y-1">
                <button className="w-full p-2 text-left text-xs text-muted-foreground hover:text-foreground hover:bg-white/10 rounded-lg transition-colors opacity-50 cursor-not-allowed">
                  Profil użytkownika
                </button>
                <button className="w-full p-2 text-left text-xs text-muted-foreground hover:text-foreground hover:bg-white/10 rounded-lg transition-colors opacity-50 cursor-not-allowed">
                  Ustawienia konta
                </button>
                <button className="w-full p-2 text-left text-xs text-muted-foreground hover:text-foreground hover:bg-white/10 rounded-lg transition-colors opacity-50 cursor-not-allowed">
                  Historia aktywności
                </button>
              </div>
            </div>

            {/* Contacts */}
            <div className="glass-card rounded-xl p-3">
              <h3 className="font-semibold text-card-foreground mb-2 flex items-center text-sm">
                <Phone className="w-4 h-4 mr-2" />
                Kontakty
              </h3>
              <div className="space-y-1">
                <button className="w-full p-2 text-left text-xs text-muted-foreground hover:text-foreground hover:bg-white/10 rounded-lg transition-colors opacity-50 cursor-not-allowed">
                  Zespół trenerów
                </button>
                <button className="w-full p-2 text-left text-xs text-muted-foreground hover:text-foreground hover:bg-white/10 rounded-lg transition-colors opacity-50 cursor-not-allowed">
                  Wsparcie techniczne
                </button>
                <button className="w-full p-2 text-left text-xs text-muted-foreground hover:text-foreground hover:bg-white/10 rounded-lg transition-colors opacity-50 cursor-not-allowed">
                  Kontakt z nami
                </button>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="glass-card rounded-xl p-3">
              <h3 className="font-semibold text-card-foreground mb-2 flex items-center text-sm">
                <Sparkles className="w-4 h-4 mr-2" />
                Szybkie pytania
              </h3>
              <div className="space-y-1">
                {quickQuestions.map((question, index) => (
                  <button 
                    key={index}
                    onClick={() => setInputMessage(question)}
                    className="w-full p-2 text-left text-xs text-muted-foreground hover:text-foreground hover:bg-white/10 rounded-lg transition-colors"
                  >
                    {question}
                  </button>
                ))}
              </div>
            </div>

            {/* LIVE Commentary - AI Powered */}
            <div className="glass-card rounded-xl p-3 border-2 border-red-500/50">
              <h3 className="font-semibold text-card-foreground mb-2 flex items-center text-sm">
                <div className="w-2 h-2 bg-red-500 rounded-full mr-2 animate-pulse"></div>
                🎤 LIVE Commentary
              </h3>
              <button 
                onClick={() => window.location.href = '/live-commentary'}
                className="w-full p-3 text-left text-sm font-semibold text-white bg-gradient-to-r from-red-600 to-blue-600 hover:from-red-700 hover:to-blue-700 rounded-lg transition-all transform hover:scale-105"
              >
                <div className="flex items-center justify-between">
                  <span>🏐 Zawiercie vs Lublin</span>
                  <ChevronRight className="w-4 h-4" />
                </div>
                <div className="text-xs mt-1 opacity-90">
                  Set 3 • AI Komentarz • 8 języków
                </div>
              </button>
            </div>

            {/* Help */}
            <div className="glass-card rounded-xl p-3">
              <h3 className="font-semibold text-card-foreground mb-2 flex items-center text-sm">
                <HelpCircle className="w-4 h-4 mr-2" />
                Pomoc
              </h3>
              <div className="space-y-1">
                <button className="w-full p-2 text-left text-xs text-muted-foreground hover:text-foreground hover:bg-white/10 rounded-lg transition-colors opacity-50 cursor-not-allowed">
                  FAQ
                </button>
                <button className="w-full p-2 text-left text-xs text-muted-foreground hover:text-foreground hover:bg-white/10 rounded-lg transition-colors opacity-50 cursor-not-allowed">
                  Instrukcja użytkowania
                </button>
                <button className="w-full p-2 text-left text-xs text-muted-foreground hover:text-foreground hover:bg-white/10 rounded-lg transition-colors opacity-50 cursor-not-allowed">
                  Zgłoś problem
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Middle Column - Chat Interface (60%) */}
        <div className="w-3/5 glass border-l border-r border-border flex flex-col">
          <div className="p-6 border-b border-border">
            <h3 className="font-semibold text-foreground flex items-center text-lg">
              <MessageCircle className="w-5 h-5 mr-2" />
              Chat AI - VolleyInsight
            </h3>
            <p className="text-sm text-muted-foreground mt-1">Zadaj pytanie o siatkówkę, technikę lub strategię gry</p>
            {/* Smart Chat Toggle */}
            <div className="mt-3">
              <label className="flex items-center gap-2 cursor-pointer text-sm">
                <input
                  type="checkbox"
                  checked={useHybrid}
                  onChange={(e) => setUseHybrid(e.target.checked)}
                  className="w-4 h-4 rounded"
                />
                <span className="text-muted-foreground">
                  🚀 Smart Chat (Expert Knowledge + Player Stats)
                </span>
              </label>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {messages.length === 0 && (
              <div className="text-center py-8">
                <div className="text-6xl mb-4">🏐</div>
                <h3 className="text-xl font-semibold text-white mb-2">VolleyInsight Chat</h3>
                <p className="text-gray-300 mb-4">Zadaj pytanie o statystyki lub technikę siatkówki</p>
                <div className="flex gap-2 justify-center text-sm">
                  <span className="px-3 py-1 bg-orange-500/20 text-orange-300 rounded-full">
                    📊 Statystyki
                  </span>
                  <span className="px-3 py-1 bg-purple-500/20 text-purple-300 rounded-full">
                    🎓 Wiedza ekspercka
                  </span>
                </div>
              </div>
            )}
            {messages.map((message, index) => (
              <div
                key={index}
                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[85%] rounded-xl p-4 ${
                    message.role === 'user'
                      ? 'bg-orange-500/20 border border-orange-500/30'
                      : 'bg-white/10 border border-white/20'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className="text-2xl">
                      {message.role === 'user' ? '👤' : '🤖'}
                    </div>
                    <div className="flex-1">
                      <p className="text-white whitespace-pre-wrap">{message.content}</p>
                      
                      {message.queryType && (
                        <div className="mt-2 text-xs text-gray-400">
                          Źródło: {message.queryType === 'stats' ? '📊 Statystyki' : '🎓 Wiedza ekspercka'}
                        </div>
                      )}

                      {message.sources && message.sources.length > 0 && (
                        <details className="mt-3">
                          <summary className="text-xs text-blue-400 cursor-pointer hover:text-blue-300">
                            Pokaż źródła ({message.sources.length})
                          </summary>
                          <div className="mt-2 space-y-2">
                            {message.sources.map(source => (
                              <div
                                key={source.id}
                                className="text-xs bg-slate-800/50 p-2 rounded border border-slate-700"
                              >
                                <div className="text-gray-400 mb-1">
                                  {source.source === 'stats' ? '📊' : '🎓'} Score: {source.score.toFixed(2)}
                                </div>
                                <div className="text-gray-300">{source.content}</div>
                              </div>
                            ))}
                          </div>
                        </details>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-white/10 border border-white/20 rounded-xl p-4">
                  <div className="flex items-center gap-3">
                    <div className="text-2xl">🤖</div>
                    <div className="flex gap-1">
                      <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                      <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                      <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                    </div>
                  </div>
                </div>
              </div>
            )}
            {/* Auto-scroll target */}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="p-6 border-t border-border">
            <div className="flex space-x-3">
              <input
                type="text"
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                placeholder="Zadaj pytanie o statystyki lub technikę siatkówki..."
                className="flex-1 px-4 py-3 text-lg glass rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                disabled={isLoading}
              />
              <button
                onClick={sendMessage}
                disabled={isLoading || !inputMessage.trim()}
                className="px-6 py-3 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center text-lg"
                style={{ 
                  background: `linear-gradient(135deg, var(--gradient-start), var(--gradient-end))` 
                }}
              >
                <Send className="w-5 h-5" />
              </button>
            </div>
            <div className="mt-2 text-center text-xs text-gray-400">
              💡 Chat automatycznie wybiera źródło danych na podstawie Twojego pytania
            </div>
          </div>
        </div>

        {/* Right Column - Training Sections Menu (20%) */}
        <div className="w-1/5 p-4">
          <div className="text-center mb-4">
            <h2 className="text-lg font-bold text-foreground mb-2">Moduły treningowe</h2>
            <p className="text-sm text-muted-foreground">Kliknij na moduł aby rozpocząć dedykowaną ścieżkę nauki</p>
          </div>
        
          {/* Training Modules Grid 2x3 */}
          <div className="grid grid-cols-2 gap-3">
            {trainingModules.map((module, index) => {
              const IconComponent = module.icon
              return (
                <div 
                  key={module.id}
                  onClick={() => handleModuleClick(module)}
                  className="glass-card rounded-lg p-3 cursor-pointer hover:shadow-lg transition-all duration-300 group hover:scale-105 aspect-square flex flex-col items-center justify-center"
                  style={{ 
                    background: `linear-gradient(135deg, var(--gradient-start)/10, var(--gradient-end)/10, var(--gradient-accent)/5)` 
                  }}
                >
                  {/* Icon */}
                  <div 
                    className="w-10 h-10 rounded-lg flex items-center justify-center mb-3 group-hover:scale-110 transition-transform duration-300"
                    style={{ 
                      background: `linear-gradient(135deg, var(--gradient-start), var(--gradient-end), var(--gradient-accent))` 
                    }}
                  >
                    <span className="text-lg">{module.emoji}</span>
                  </div>
                  
                  {/* Title */}
                  <h3 className="text-sm font-bold text-card-foreground mb-3 group-hover:text-primary transition-colors text-center">
                    {module.title}
                  </h3>
                  
                  {/* Progress */}
                  <div className="w-full">
                    <div className="flex justify-between text-xs text-muted-foreground mb-1">
                      <span>Postęp</span>
                      <span>{module.progress}%</span>
                    </div>
                    <div className="w-full bg-muted rounded-full h-1.5">
                      <div 
                        className="h-1.5 rounded-full transition-all duration-500"
                        style={{ 
                          width: `${module.progress}%`,
                          background: `linear-gradient(135deg, var(--gradient-start), var(--gradient-end), var(--gradient-accent))`
                        }}
                      ></div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}