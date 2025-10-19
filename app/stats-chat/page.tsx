'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  sources?: any[];
}

export default function StatsChatPage() {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: 'Cześć! Jestem ekspertem od statystyk siatkówki. Mogę odpowiedzieć na pytania o graczy PlusLigi i Tauron Ligi z sezonów 2022-2025. O co chcesz zapytać?'
    }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim() || loading) return;

    const userMessage = input;
    setInput('');
    
    // Dodaj wiadomość użytkownika
    const newMessages = [...messages, { role: 'user' as const, content: userMessage }];
    setMessages(newMessages);
    setLoading(true);

    try {
      const response = await fetch('/api/stats-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMessage,
          history: messages.slice(-6) // Ostatnie 6 wiadomości dla kontekstu
        })
      });

      const data = await response.json();

      if (response.ok) {
        setMessages([...newMessages, {
          role: 'assistant',
          content: data.message,
          sources: data.sources
        }]);
      } else {
        setMessages([...newMessages, {
          role: 'assistant',
          content: `Przepraszam, wystąpił błąd: ${data.error || 'Nieznany błąd'}`
        }]);
      }
    } catch (error) {
      setMessages([...newMessages, {
        role: 'assistant',
        content: 'Przepraszam, nie mogę teraz połączyć się z serwerem. Spróbuj ponownie.'
      }]);
    } finally {
      setLoading(false);
    }
  };

  const exampleQuestions = [
    "Kto zdobył najwięcej punktów w PlusLidze w sezonie 2024/25?",
    "Porównaj statystyki Bartosza Kurka z ostatnich 3 sezonów",
    "Która drużyna ma najlepszego strzelca w Tauron Lidze?",
    "Ile asów miał Wilfredo Leon w sezonie 2023/24?"
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900">
      {/* Header */}
      <div className="border-b border-white/10 bg-slate-900/50 backdrop-blur-lg">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <Link href="/" className="text-blue-400 hover:text-blue-300 text-sm">
              ← Powrót do menu
            </Link>
            <h1 className="text-2xl font-bold text-white mt-2">
              🤖 Stats Chat - Asystent Statystyk
            </h1>
            <p className="text-blue-200 text-sm">Zapytaj o statystyki graczy z sezonów 2022-2025</p>
          </div>
        </div>
      </div>

      {/* Chat Container */}
      <div className="max-w-4xl mx-auto px-6 py-8">
        {/* Messages */}
        <div className="bg-white/5 backdrop-blur-lg rounded-xl border border-white/10 p-6 mb-6 h-[500px] overflow-y-auto">
          {messages.map((message, index) => (
            <div
              key={index}
              className={`mb-6 ${message.role === 'user' ? 'text-right' : 'text-left'}`}
            >
              <div
                className={`inline-block max-w-[80%] p-4 rounded-lg ${
                  message.role === 'user'
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-800 text-white'
                }`}
              >
                <div className="whitespace-pre-wrap">{message.content}</div>
                
                {/* Sources */}
                {message.sources && message.sources.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-white/20">
                    <div className="text-xs text-blue-200 mb-2">📊 Źródła:</div>
                    {message.sources.map((source, idx) => (
                      <div key={idx} className="text-xs text-blue-300 mb-1">
                        • {source.name} ({source.league} {source.season}, {source.team})
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
          
          {loading && (
            <div className="text-left mb-6">
              <div className="inline-block bg-slate-800 text-white p-4 rounded-lg">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce"></div>
                  <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                  <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></div>
                </div>
              </div>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>

        {/* Example Questions */}
        {messages.length === 1 && (
          <div className="mb-6">
            <div className="text-sm text-blue-200 mb-3">💡 Przykładowe pytania:</div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {exampleQuestions.map((question, idx) => (
                <button
                  key={idx}
                  onClick={() => setInput(question)}
                  className="text-left p-3 bg-white/5 hover:bg-white/10 rounded-lg border border-white/10 text-sm text-blue-100 transition-colors"
                >
                  {question}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Input */}
        <div className="bg-white/10 backdrop-blur-lg rounded-xl border border-white/20 p-4">
          <div className="flex gap-3">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
              placeholder="Zadaj pytanie o statystyki..."
              disabled={loading}
              className="flex-1 bg-slate-800 text-white px-4 py-3 rounded-lg border border-blue-500/50 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
            />
            <button
              onClick={sendMessage}
              disabled={loading || !input.trim()}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? '...' : 'Wyślij'}
            </button>
          </div>
        </div>

        {/* Info */}
        <div className="mt-4 text-center text-sm text-blue-300">
          💾 Dane: PlusLiga & Tauron Liga (sezony 2022/23, 2023/24, 2024/25)
        </div>
      </div>
    </div>
  );
}