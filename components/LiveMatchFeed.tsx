'use client';

import { useState, useEffect } from 'react';
import { mockLiveMatch, LiveEvent, getNextEvent } from '../lib/mockLiveData';

interface LiveMatchFeedProps {
  onEventClick: (question: string) => void;
}

export default function LiveMatchFeed({ onEventClick }: LiveMatchFeedProps) {
  const [match, setMatch] = useState(mockLiveMatch);
  const [events, setEvents] = useState(mockLiveMatch.events);

  // Symulacja "live" - dodaje nowe eventy co 10 sekund
  useEffect(() => {
    const interval = setInterval(() => {
      const newEvent = getNextEvent();
      if (newEvent) {
        setEvents(prev => [newEvent, ...prev]);
        // Update score randomly
        setMatch(prev => ({
          ...prev,
          score: {
            home: prev.score.home + (Math.random() > 0.5 ? 1 : 0),
            away: prev.score.away + (Math.random() > 0.5 ? 1 : 0)
          }
        }));
      }
    }, 10000); // Co 10 sekund

    return () => clearInterval(interval);
  }, []);

  const getEventColor = (type: string) => {
    const colors = {
      'ace': 'border-l-red-500 bg-red-500/10',
      'block': 'border-l-blue-500 bg-blue-500/10',
      'attack': 'border-l-yellow-500 bg-yellow-500/10',
      'point': 'border-l-green-500 bg-green-500/10',
      'error': 'border-l-gray-500 bg-gray-500/10',
      'timeout': 'border-l-purple-500 bg-purple-500/10'
    };
    return colors[type as keyof typeof colors] || 'border-l-gray-500 bg-gray-500/10';
  };

  return (
    <div className="h-full flex flex-col">
      {/* Match Header */}
      <div className="p-6 border-b border-border bg-gradient-to-r from-blue-600/20 to-red-600/20">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
            <span className="text-sm font-semibold text-red-500">NA ŻYWO</span>
            <span className="text-sm text-muted-foreground">Set {match.set}</span>
          </div>
          <span className="text-sm text-muted-foreground">{match.time}</span>
        </div>

        {/* Score */}
        <div className="flex items-center justify-center space-x-8">
          <div className="text-center">
            <div className="text-4xl mb-1">{match.homeFlag}</div>
            <div className="text-sm font-medium text-foreground mb-1">{match.homeTeam}</div>
            <div className="text-3xl font-bold text-foreground">{match.score.home}</div>
          </div>
          
          <div className="text-2xl font-bold text-muted-foreground">:</div>
          
          <div className="text-center">
            <div className="text-4xl mb-1">{match.awayFlag}</div>
            <div className="text-sm font-medium text-foreground mb-1">{match.awayTeam}</div>
            <div className="text-3xl font-bold text-foreground">{match.score.away}</div>
          </div>
        </div>
      </div>

      {/* Events Timeline */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        <div className="text-sm font-semibold text-muted-foreground mb-2 sticky top-0 bg-background/95 backdrop-blur py-2">
          📋 Przebieg meczu
        </div>

        {events.map((event, index) => (
          <button
            key={event.id}
            onClick={() => onEventClick(event.question)}
            className={`w-full text-left p-4 rounded-lg border-l-4 ${getEventColor(event.type)} 
              hover:scale-[1.02] transition-all duration-200 cursor-pointer
              hover:shadow-lg`}
          >
            <div className="flex items-start space-x-3">
              <div className="text-2xl">{event.icon}</div>
              <div className="flex-1">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-muted-foreground">{event.timestamp}</span>
                  <span className={`text-xs font-semibold ${
                    event.team === 'POL' ? 'text-red-500' : 'text-blue-500'
                  }`}>
                    {event.team === 'POL' ? match.homeFlag : match.awayFlag} {event.team}
                  </span>
                </div>
                <p className="font-semibold text-foreground text-sm mb-1">
                  {event.description}
                </p>
                <p className="text-xs text-muted-foreground">
                  {event.player}
                </p>
                <div className="mt-2 text-xs text-blue-500 hover:text-blue-400 flex items-center space-x-1">
                  <span>💡</span>
                  <span>Kliknij aby zapytać AI</span>
                </div>
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}