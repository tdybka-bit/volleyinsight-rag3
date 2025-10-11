'use client'

import { useState, useEffect, useRef } from 'react'
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

export default function VolleyInsight() {
  const { theme } = useTheme()
  const { trackBlockClick, trackQuestion, trackPageView } = useAnalytics()
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const [messages, setMessages] = useState([
    { 
      role: 'assistant', 
      content: 'Cześć! Jestem ekspertem VolleyInsight. Pomogę Ci w treningu siatkówki, analizie techniki i strategii gry. O czym chciałbyś porozmawiać?'
    }
  ])
  const [inputMessage, setInputMessage] = useState('')
  const [isLoading, setIsLoading] = useState(false)

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

    const newMessages = [...messages, { role: 'user', content: inputMessage }]
    setMessages(newMessages)
    const userMessage = inputMessage
    setInputMessage('')
    setIsLoading(true)
    
    try {
      // Wyślij pytanie do API chat
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ message: userMessage, limit: 3 }),
      })

      const data = await response.json()

      if (data.success) {
        // Dodaj odpowiedź AI z smart context info
        const aiMessage = data.message
        let contextInfo = ''
        
        if (data.context?.responseSource === 'database') {
          contextInfo = `\n\n📚 *Odpowiedź na podstawie ${data.context.relevantSourcesCount} wysokiej jakości źródeł z bazy wiedzy VolleyInsight*`
        } else if (data.context?.responseSource === 'hybrid') {
          contextInfo = `\n\n🔗 *Odpowiedź hybrydowa: ${data.context.relevantSourcesCount} źródeł z bazy + wiedza ekspercka*`
        } else {
          contextInfo = '\n\n🤖 *Odpowiedź na podstawie wiedzy eksperckiej (brak odpowiednich danych w bazie)*'
        }
        
        setMessages(prev => [...prev, { 
          role: 'assistant', 
          content: aiMessage + contextInfo 
        }])

        // Track question analytics
        trackQuestion(
          userMessage, 
          undefined, 
          aiMessage.length, 
          data.context?.hasContext || false, 
          data.context?.sourcesCount || 0
        )
      } else {
        // Błąd API - pokaż komunikat błędu
        setMessages(prev => [...prev, { 
          role: 'assistant', 
          content: data.message || 'Przepraszam, wystąpił błąd podczas przetwarzania Twojego pytania.' 
        }])
      }
    } catch (error) {
      console.error('Błąd wysyłania wiadomości:', error)
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: 'Przepraszam, wystąpił błąd połączenia. Spróbuj ponownie.' 
      }])
    } finally {
      setIsLoading(false)
    }
  }

  const handleModuleClick = (module: typeof trainingModules[0]) => {
    // Track block click analytics
    trackBlockClick(module.id, module.title, 'home')
    
    // Przekieruj do dedykowanej strony tematu
    window.location.href = `/${module.id}`
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

            {/* LIVE Mecz - NOWY */}
            <div className="glass-card rounded-xl p-3 border-2 border-red-500/50">
              <h3 className="font-semibold text-card-foreground mb-2 flex items-center text-sm">
                <div className="w-2 h-2 bg-red-500 rounded-full mr-2 animate-pulse"></div>
                LIVE Mecz
              </h3>
              <button 
                onClick={() => window.location.href = '/live'}
                className="w-full p-3 text-left text-sm font-semibold text-white bg-gradient-to-r from-red-600 to-blue-600 hover:from-red-700 hover:to-blue-700 rounded-lg transition-all transform hover:scale-105"
              >
                <div className="flex items-center justify-between">
                  <span>🏐 Polska vs Brazylia</span>
                  <ChevronRight className="w-4 h-4" />
                </div>
                <div className="text-xs mt-1 opacity-90">
                  Set 3 • 21:19 • NA ŻYWO
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
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {messages.map((message, index) => (
              <div
                key={index}
                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[85%] px-4 py-3 rounded-lg text-lg leading-relaxed ${
                    message.role === 'user'
                      ? 'text-white'
                      : 'glass-card text-card-foreground'
                  }`}
                  style={message.role === 'user' ? {
                    background: `linear-gradient(135deg, var(--gradient-start), var(--gradient-end))`
                  } : {}}
                >
                  {message.content}
                </div>
              </div>
            ))}
            {/* Auto-scroll target */}
            <div ref={messagesEndRef} />
            {isLoading && (
              <div className="flex justify-start">
                <div className="glass-card text-card-foreground px-4 py-3 rounded-lg">
                  <div className="flex items-center space-x-3">
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span className="text-lg">AI analizuje pytanie...</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Input */}
          <div className="p-6 border-t border-border">
            <div className="flex space-x-3">
              <input
                type="text"
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                placeholder="Zadaj pytanie o siatkówkę..."
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