'use client'

import { useState } from 'react'
import { Send, Loader2, MessageCircle } from 'lucide-react'

interface TopicChatProps {
  topic: string
  topicName: string
}

export default function TopicChat({ topic, topicName }: TopicChatProps) {
  const [messages, setMessages] = useState([
    { 
      role: 'assistant' as const, 
      content: `Cześć! Jestem tutaj, aby pomóc Ci w nauce ${topicName.toLowerCase()}. Zadaj mi pytanie!` 
    }
  ])
  const [inputMessage, setInputMessage] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const sendMessage = async () => {
    if (!inputMessage.trim() || isLoading) return

    const newMessages = [...messages, { role: 'user' as const, content: inputMessage }]
    setMessages(newMessages)
    const userMessage = inputMessage
    setInputMessage('')
    setIsLoading(true)
    
    try {
      // Wyślij pytanie do API chat z filtrem tematu
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          message: userMessage, 
          limit: 3,
          topic: topic // Filtruj odpowiedzi według tematu
        }),
      })

      const data = await response.json()

      if (data.success) {
        const aiMessage = data.message
        const contextInfo = data.context?.hasContext 
          ? `\n\n📚 *Odpowiedź na podstawie ${data.context.sourcesCount} źródeł z bazy wiedzy*`
          : '\n\n⚠️ *Odpowiedź na podstawie ogólnej wiedzy (brak danych w bazie)*'
        
        setMessages(prev => [...prev, { 
          role: 'assistant', 
          content: aiMessage + contextInfo 
        }])
      } else {
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


  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" 
               style={{ background: `linear-gradient(135deg, var(--gradient-start), var(--gradient-end), var(--gradient-accent))` }}>
            <MessageCircle className="w-6 h-6 text-white" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-card-foreground">Chat - {topicName}</h3>
            <p className="text-sm text-muted-foreground">Zadaj pytania dotyczące {topicName.toLowerCase()}</p>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message, index) => (
          <div key={index} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div 
              className={`max-w-[80%] px-4 py-2 rounded-lg ${
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
            <div className="glass-card text-card-foreground px-3 py-2 rounded-lg">
              <div className="flex items-center space-x-2">
                <Loader2 className="w-3 h-3 animate-spin" />
                <span className="text-sm">AI analizuje...</span>
              </div>
            </div>
          </div>
        )}
      </div>


      {/* Input */}
      <div className="p-4 border-t border-border">
        <div className="flex space-x-2">
          <input
            type="text"
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
            placeholder={`Zadaj pytanie o ${topicName.toLowerCase()}...`}
            className="flex-1 px-3 py-2 text-sm glass rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            disabled={isLoading}
          />
          <button
            onClick={sendMessage}
            disabled={isLoading || !inputMessage.trim()}
            className="px-3 py-2 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center"
            style={{ 
              background: `linear-gradient(135deg, var(--gradient-start), var(--gradient-end))` 
            }}
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
