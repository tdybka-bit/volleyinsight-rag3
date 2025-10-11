export interface LiveEvent {
    id: string;
    timestamp: string;
    type: 'ace' | 'block' | 'attack' | 'point' | 'error' | 'timeout';
    team: 'POL' | 'BRA';
    player: string;
    description: string;
    icon: string;
    question: string; // Pytanie które się pojawi po kliknięciu
  }
  
  export interface LiveMatch {
    id: string;
    homeTeam: string;
    awayTeam: string;
    homeFlag: string;
    awayFlag: string;
    score: {
      home: number;
      away: number;
    };
    set: number;
    status: 'live' | 'finished' | 'upcoming';
    time: string;
    events: LiveEvent[];
  }
  
  // Mock live match data
  export const mockLiveMatch: LiveMatch = {
    id: 'match-001',
    homeTeam: 'Polska',
    awayTeam: 'Brazylia',
    homeFlag: '🇵🇱',
    awayFlag: '🇧🇷',
    score: {
      home: 21,
      away: 19
    },
    set: 3,
    status: 'live',
    time: '15:23',
    events: [
      {
        id: 'event-1',
        timestamp: '15:23',
        type: 'ace',
        team: 'POL',
        player: 'Wilfredo Leon',
        description: 'AS SERWISOWY! Leon posyła nie do obrony!',
        icon: '🔥',
        question: 'Co to jest as serwisowy i jak go wykonać?'
      },
      {
        id: 'event-2',
        timestamp: '15:21',
        type: 'block',
        team: 'POL',
        player: 'Jakub Kochanowski',
        description: 'BLOK! Kochanowski zatrzymuje atak środkiem!',
        icon: '🧱',
        question: 'Jak poprawić technikę bloku?'
      },
      {
        id: 'event-3',
        timestamp: '15:19',
        type: 'attack',
        team: 'BRA',
        player: 'Wallace',
        description: 'Skuteczny atak Wallace po skosie',
        icon: '⚡',
        question: 'Jakie są rodzaje ataków w siatkówce?'
      },
      {
        id: 'event-4',
        timestamp: '15:17',
        type: 'point',
        team: 'POL',
        player: 'Bartosz Kurek',
        description: 'Punkt dla Polski! Kurek kończy akcję',
        icon: '✅',
        question: 'Jakie są zasady zdobywania punktów?'
      },
      {
        id: 'event-5',
        timestamp: '15:15',
        type: 'error',
        team: 'BRA',
        player: 'Bruno',
        description: 'Błąd w zagrywce - piłka w aut',
        icon: '❌',
        question: 'Jakie są najczęstsze błędy w zagrywce?'
      },
      {
        id: 'event-6',
        timestamp: '15:13',
        type: 'timeout',
        team: 'BRA',
        player: 'Trener Renan',
        description: 'Czas na przerwę techniczną',
        icon: '⏸️',
        question: 'Kiedy i jak często można brać time-out?'
      },
      {
        id: 'event-7',
        timestamp: '15:10',
        type: 'ace',
        team: 'POL',
        player: 'Marcin Janusz',
        description: 'Zagrywka Janusza! Brazylia nie przyjmuje!',
        icon: '🔥',
        question: 'Jakie są techniki skutecznej zagrywki?'
      },
      {
        id: 'event-8',
        timestamp: '15:08',
        type: 'block',
        team: 'BRA',
        player: 'Lucão',
        description: 'Blok podwójny! Brazylia punktuje',
        icon: '🧱',
        question: 'Czym różni się blok pojedynczy od podwójnego?'
      }
    ]
  };
  
  // Funkcja do symulacji "live" - dodaje nowe eventy
  export function getNextEvent(): LiveEvent | null {
    const newEvents: LiveEvent[] = [
      {
        id: `event-${Date.now()}`,
        timestamp: new Date().toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' }),
        type: 'attack',
        team: 'POL',
        player: 'Leon',
        description: 'Potężny atak Leona po prostej!',
        icon: '💥',
        question: 'Jak poprawić siłę ataku?'
      }
    ];
    
    return Math.random() > 0.7 ? newEvents[0] : null;
  }
  
  // Stats data (dla PIVOT 4)
  export interface PlayerStats {
    name: string;
    team: string;
    position: string;
    stats: {
      attacks: number;
      attackSuccess: number;
      aces: number;
      blocks: number;
      digs: number;
    };
  }
  
  export const mockPlayerStats: PlayerStats[] = [
    {
      name: 'Wilfredo Leon',
      team: 'Polska',
      position: 'Przyjmujący',
      stats: {
        attacks: 347,
        attackSuccess: 58.3,
        aces: 45,
        blocks: 23,
        digs: 156
      }
    },
    {
      name: 'Bartosz Kurek',
      team: 'Polska',
      position: 'Atakujący',
      stats: {
        attacks: 298,
        attackSuccess: 54.1,
        aces: 32,
        blocks: 41,
        digs: 89
      }
    },
    {
      name: 'Wallace',
      team: 'Brazylia',
      position: 'Przyjmujący',
      stats: {
        attacks: 312,
        attackSuccess: 52.8,
        aces: 38,
        blocks: 28,
        digs: 134
      }
    }
  ];