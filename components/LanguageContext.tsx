'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';

// Supported locales
export const locales = ['pl', 'en', 'es', 'it', 'de', 'tr', 'pt', 'jp'] as const;
export type Locale = (typeof locales)[number];

export const localeNames: Record<Locale, string> = {
  pl: 'Polski',
  en: 'English',
  es: 'Español',
  it: 'Italiano',
  de: 'Deutsch',
  tr: 'Türkçe',
  pt: 'Português',
  jp: '日本語',
};

export const localeFlags: Record<Locale, string> = {
  pl: '🇵🇱',
  en: '🇬🇧',
  es: '🇪🇸',
  it: '🇮🇹',
  de: '🇩🇪',
  tr: '🇹🇷',
  pt: '🇵🇹',
  jp: '🇯🇵',
};

interface LanguageContextType {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>('pl');
  const [messages, setMessages] = useState<Record<string, any>>({});

  // Load messages when locale changes
  useEffect(() => {
    const loadMessages = async () => {
      try {
        const response = await fetch(`/messages/${locale}.json`);
        const data = await response.json();
        setMessages(data);
        
        // Save to localStorage
        localStorage.setItem('preferredLocale', locale);
      } catch (error) {
        console.error('Failed to load messages:', error);
      }
    };

    loadMessages();
  }, [locale]);

  // Load saved locale on mount
  useEffect(() => {
    const saved = localStorage.getItem('preferredLocale') as Locale;
    if (saved && locales.includes(saved)) {
      setLocaleState(saved);
    }
  }, []);

  // Translation function
  const t = (key: string): string => {
    const keys = key.split('.');
    let value: any = messages;

    for (const k of keys) {
      if (value && typeof value === 'object') {
        value = value[k];
      } else {
        return key; // Return key if not found
      }
    }

    return typeof value === 'string' ? value : key;
  };

  const setLocale = (newLocale: Locale) => {
    setLocaleState(newLocale);
  };

  return (
    <LanguageContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}