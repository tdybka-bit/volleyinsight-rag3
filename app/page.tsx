'use client'

import { useState, useEffect } from 'react'
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
        
        {/* Left Column - Control Panel (25%) */}
        <div className="w-1/4 glass border-r border-border p-4">
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

        {/* Middle Column - Training Sections (50%) */}
        <div className="w-1/2 p-4">
          <div className="text-center mb-3">
            <h2 className="text-xl font-bold text-foreground mb-1">Moduły treningowe</h2>
            <p className="text-xs text-muted-foreground">Kliknij na moduł aby rozpocząć dedykowaną ścieżkę nauki</p>
          </div>
        
            {/* Training Modules Grid 2x3 */}
            <div className="grid grid-cols-2 gap-2">
              {trainingModules.map((module, index) => {
            const IconComponent = module.icon
            return (
                  <div 
                key={module.id}
                    onClick={() => handleModuleClick(module)}
                    className="glass-card rounded-lg p-3 cursor-pointer hover:shadow-lg transition-all duration-300 group hover:scale-105"
                    style={{ 
                      background: `linear-gradient(135deg, var(--gradient-start)/10, var(--gradient-end)/10, var(--gradient-accent)/5)` 
                    }}
                  >
                    <div className="text-center">
                      <div 
                        className="w-10 h-10 rounded-lg flex items-center justify-center mx-auto mb-2 group-hover:scale-110 transition-transform duration-300"
                        style={{ 
                          background: `linear-gradient(135deg, var(--gradient-start), var(--gradient-end), var(--gradient-accent))` 
                        }}
                      >
                        <span className="text-lg">{module.emoji}</span>
                      </div>
                      <h3 className="text-sm font-bold text-card-foreground mb-1 group-hover:text-primary transition-colors">
                        {module.title}
                      </h3>
                      <p className="text-xs text-muted-foreground mb-2">
                        {module.description}
                      </p>
                      
                      {/* Progress Bar */}
                      <div className="mb-2">
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
                        <div className="text-xs text-muted-foreground mt-1">
                          {module.completedMaterials}/{module.totalMaterials} materiałów
                        </div>
                      </div>
                      
                      <div className="text-xs text-primary opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                        Kliknij aby rozpocząć naukę
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
        </div>

        {/* Right Column - AI Chat (25%) */}
        <div className="w-1/4 glass border-l border-border flex flex-col">
          <div className="p-3 border-b border-border">
            <h3 className="font-semibold text-foreground flex items-center text-sm">
              <MessageCircle className="w-4 h-4 mr-2" />
              Chat AI
            </h3>
          </div>

            {/* Messages */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {messages.map((message, index) => (
                <div
                  key={index}
                  className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                  className={`max-w-[90%] px-2 py-1.5 rounded-lg text-xs ${
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
            {isLoading && (
              <div className="flex justify-start">
                <div className="glass-card text-card-foreground px-2 py-1.5 rounded-lg">
                  <div className="flex items-center space-x-2">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    <span className="text-xs">AI analizuje...</span>
                  </div>
                </div>
              </div>
            )}
            </div>

            {/* Input */}
          <div className="p-3 border-t border-border">
            <div className="flex space-x-2">
                <input
                  type="text"
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                placeholder="Zadaj pytanie..."
                className="flex-1 px-2 py-1.5 text-xs glass rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                disabled={isLoading}
                />
                <button
                  onClick={sendMessage}
                disabled={isLoading || !inputMessage.trim()}
                className="px-2 py-1.5 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center"
                style={{ 
                  background: `linear-gradient(135deg, var(--gradient-start), var(--gradient-end))` 
                }}
              >
                <Send className="w-3 h-3" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}