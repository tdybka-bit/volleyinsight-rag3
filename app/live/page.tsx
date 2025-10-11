'use client';

import { useState, useRef, useEffect } from 'react';
import LiveMatchFeed from '../../components/LiveMatchFeed';
import { MessageCircle, Send } from 'lucide-react';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export default function LivePage() {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: '👋 Witaj! Oglądam mecz razem z Tobą. Kliknij na akcję z live feed lub zapytaj mnie o cokolwiek!'
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleEventClick = async (question: string) => {
    // Dodaj pytanie użytkownika
    const userMessage: Message = { role: 'user', content: question };
    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          message: question,
          context: 'live-match' 
        })
      });

      const data = await response.json();
      
      const assistantMessage: Message = {
        role: 'assistant',
        content: data.response || data.message || 'Przepraszam, nie mogę teraz odpowiedzieć.'
      };
      
      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Chat error:', error);
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: '❌ Przepraszam, wystąpił błąd. Spróbuj ponownie.'
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const question = input.trim();
    setInput('');
    await handleEventClick(question);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              {/* Przycisk powrotu */}
              <button
                onClick={() => window.location.href = '/'}
                className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                title="Powrót do strony głównej"
              >
                <svg className="w-5 h-5 text-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
              </button>
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-500 to-blue-500 flex items-center justify-center">
                <span className="text-2xl">🏐</span>
              </div>
              <div>
                <h1 className="text-2xl font-bold text-foreground">VolleyLive AI</h1>
                <p className="text-sm text-muted-foreground">Mecz na żywo + AI Assistant</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-[calc(100vh-200px)]">
          {/* Live Feed - Left */}
          <div className="bg-card rounded-xl border border-border overflow-hidden shadow-lg">
            <LiveMatchFeed onEventClick={handleEventClick} />
          </div>

          {/* AI Chat - Right */}
          <div className="bg-card rounded-xl border border-border overflow-hidden shadow-lg flex flex-col">
            {/* Chat Header */}
            <div className="p-4 border-b border-border bg-gradient-to-r from-purple-600/20 to-blue-600/20">
              <div className="flex items-center space-x-2">
                <MessageCircle className="w-5 h-5 text-purple-500" />
                <h3 className="font-semibold text-foreground">AI Assistant</h3>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Zapytaj o akcje z meczu lub ogólne pytania o siatkówkę
              </p>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.map((message, index) => (
                <div
                  key={index}
                  className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[80%] rounded-lg p-3 ${
                      message.role === 'user'
                        ? 'bg-blue-600 text-white'
                        : 'bg-muted text-foreground'
                    }`}
                  >
                    <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                  </div>
                </div>
              ))}
              
              {isLoading && (
                <div className="flex justify-start">
                  <div className="bg-muted rounded-lg p-3">
                    <div className="flex space-x-2">
                      <div className="w-2 h-2 bg-foreground/50 rounded-full animate-bounce"></div>
                      <div className="w-2 h-2 bg-foreground/50 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                      <div className="w-2 h-2 bg-foreground/50 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                    </div>
                  </div>
                </div>
              )}
              
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <form onSubmit={handleSubmit} className="p-4 border-t border-border">
              <div className="flex space-x-2">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Zadaj pytanie o mecz lub siatkówkę..."
                  className="flex-1 px-4 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-foreground"
                  disabled={isLoading}
                />
                <button
                  type="submit"
                  disabled={isLoading || !input.trim()}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <Send className="w-5 h-5" />
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}