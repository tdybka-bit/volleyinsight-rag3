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
  const [useHybrid, setUseHybrid] = useState(false) // NEW: Toggle for Smart Chat

  const sendMessage = async () => {
    if (!inputMessage.trim() || isLoading) return

    const newMessages = [...messages, { role: 'user' as const, content: inputMessage }]
    setMessages(newMessages)
    const userMessage = inputMessage
    setInputMessage('')
    setIsLoading(true)

    try {
      // NEW: Use hybrid endpoint if enabled
      const endpoint = useHybrid ? '/api/chat-hybrid' : '/api/chat'
      
      const response = await fetch(endpoint, {
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

      if (useHybrid) {
        // Handle hybrid response
        const aiMessage = data.response || 'Przepraszam, nie mogę odpowiedzieć.'
        
        // Add classification info
        let contextInfo = ''
        if (data.classification) {
          const typeLabel = {
            'rag': '📚 Wiedza ekspercka',
            'compute': '💻 Statystyki graczy',
            'hybrid': '🚀 Hybrid (Wiedza + Stats)'
          }[data.classification.type] || '💡'
          
          contextInfo = `\n\n${typeLabel} (${(data.classification.confidence * 100).toFixed(0)}% confidence)`
        }

        setMessages([
          ...newMessages,
          {
            role: 'assistant' as const,
            content: aiMessage + contextInfo
          }
        ])
      } else {
        // Handle standard response
        if (data.success) {
          const aiMessage = data.message
          const contextInfo = data.context?.hasContext
            ? `\n\n📚 *Odpowiedź na podstawie ${data.context.sourcesCount} źródeł z bazy wiedzy*`
            : '\n\n⚠️ *Odpowiedź na podstawie ogólnej wiedzy (brak danych w bazie)*'

          setMessages([
            ...newMessages,
            {
              role: 'assistant' as const,
              content: aiMessage + contextInfo
            }
          ])
        } else {
          throw new Error(data.error || 'Wystąpił błąd')
        }
      }

    } catch (error) {
      console.error('Chat error:', error)
      setMessages([
        ...newMessages,
        {
          role: 'assistant' as const,
          content: 'Przepraszam, wystąpił błąd podczas przetwarzania Twojego zapytania. Spróbuj ponownie.'
        }
      ])
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex flex-col h-[600px] bg-white dark:bg-gray-800 rounded-lg shadow-lg">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-2">
          <MessageCircle className="w-5 h-5 text-blue-500" />
          <h3 className="font-semibold text-gray-900 dark:text-white">
            Chat: {topicName}
          </h3>
        </div>
        
        {/* NEW: Smart Chat Toggle */}
        <div className="mt-3 flex items-center gap-2">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={useHybrid}
              onChange={(e) => setUseHybrid(e.target.checked)}
              className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
            />
            <span className="text-sm text-gray-700 dark:text-gray-300 flex items-center gap-1">
                Smart Chat (Expert Knowledge + Player Stats)
            </span>
          </label>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg, idx) => (
          <div
            key={idx}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[80%] rounded-lg p-3 ${
                msg.role === 'user'
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white'
              }`}
            >
              <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-gray-100 dark:bg-gray-700 rounded-lg p-3">
              <Loader2 className="w-5 h-5 animate-spin text-gray-600 dark:text-gray-300" />
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="p-4 border-t border-gray-200 dark:border-gray-700">
        <div className="flex gap-2">
          <input
            type="text"
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
            placeholder="Zadaj pytanie..."
            className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            disabled={isLoading}
          />
          <button
            onClick={sendMessage}
            disabled={isLoading || !inputMessage.trim()}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isLoading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Send className="w-5 h-5" />
            )}
          </button>
        </div>
      </div>
    </div>
  )
}