'use client';

import { useState, useEffect, useRef } from 'react';

interface Rally {
  rally_number: number;
  score_before: { aluron: number; bogdanka: number };
  score_after: { aluron: number; bogdanka: number };
  team_scored: string;
  touches: Array<{
    action: string;
    player: string;
    number: string;
    team: string;
  }>;
  final_action: {
    type: string;
    player: string;
    number: string;
  };
}

interface MatchData {
  match_id: string;
  match_url: string;
  set_number: number;
  final_score: {
    aluron: number;
    bogdanka: number;
  };
  teams: {
    home: string;
    away: string;
  };
  rallies: Rally[];
}

interface CommentaryEntry {
  rallyNumber: number;
  text: string;
  timestamp: Date;
  player: string;
  team: string;
  action: string;
  type: string;
  // NEW FIELDS
  tags: string[];
  milestones: string[];
  icon: string;
  momentumScore: number;
  dramaScore: number;
}

type Language = 'pl' | 'en' | 'it' | 'de' | 'tr' | 'es' | 'pt' | 'jp';
type Mode = 'demo' | 'live';

const languages: { code: Language; flag: string; name: string }[] = [
  { code: 'pl', flag: '🇵🇱', name: 'Polski' },
  { code: 'en', flag: 'EN', name: 'English' },
  { code: 'it', flag: '🇮🇹', name: 'Italiano' },
  { code: 'de', flag: '🇩🇪', name: 'Deutsch' },
  { code: 'tr', flag: '🇹🇷', name: 'Türkçe' },
  { code: 'es', flag: '🇪🇸', name: 'Español' },
  { code: 'pt', flag: '🇵🇹', name: 'Português' },
  { code: 'jp', flag: '🇯🇵', name: '日本語' },
];

// Tag color mapping
const TAG_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  '#koniec_seta': { bg: 'bg-amber-500/20', text: 'text-amber-600', border: 'border-amber-500' },
  '#momentum': { bg: 'bg-orange-500/20', text: 'text-orange-600', border: 'border-orange-500' },
  '#seria': { bg: 'bg-red-500/20', text: 'text-red-600', border: 'border-red-500' },
  '#drama': { bg: 'bg-purple-500/20', text: 'text-purple-600', border: 'border-purple-500' },
  '#clutch': { bg: 'bg-pink-500/20', text: 'text-pink-600', border: 'border-pink-500' },
  '#comeback': { bg: 'bg-green-500/20', text: 'text-green-600', border: 'border-green-500' },
  '#milestone': { bg: 'bg-blue-500/20', text: 'text-blue-600', border: 'border-blue-500' },
  '#as': { bg: 'bg-red-600/20', text: 'text-red-700', border: 'border-red-600' },
  '#długa_wymiana': { bg: 'bg-indigo-500/20', text: 'text-indigo-600', border: 'border-indigo-500' },
};

export default function LiveMatchCommentaryV3() {
  const [matchData, setMatchData] = useState<MatchData | null>(null);
  const [rallies, setRallies] = useState<Rally[]>([]);
  const [commentaries, setCommentaries] = useState<CommentaryEntry[]>([]);
  const [currentRallyIndex, setCurrentRallyIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [speed, setSpeed] = useState(3000);
  const [language, setLanguage] = useState<Language>('pl');
  const [mode, setMode] = useState<Mode>('demo');
  const commentaryRef = useRef<HTMLDivElement>(null);
  const [isRetranslating, setIsRetranslating] = useState(false);
  
  const [playerStats, setPlayerStats] = useState<Record<string, {
    blocks: number;
    aces: number;
    attacks: number;
    errors: number;
    points: number;
  }>>({});

  // Re-translate all commentaries when language changes
  useEffect(() => {
    if (commentaries.length > 0) {
      retranslateCommentaries();
    }
  }, [language]);

  const retranslateCommentaries = async () => {
    if (commentaries.length === 0 || isRetranslating) return;
    
    setIsRetranslating(true);
    const currentLanguage = language;
    console.log('🌍 Re-translating', commentaries.length, 'commentaries to', currentLanguage);
    
    // NEW: Use translation endpoint instead of full regeneration
    const translationPromises = commentaries.map(async (commentary) => {
      try {
        const response = await fetch('/api/translate', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            text: commentary.text,
            fromLanguage: 'pl', // Original language
            toLanguage: currentLanguage,
            tags: commentary.tags,
          }),
        });

        if (!response.ok) {
          console.error('Translation failed for rally', commentary.rallyNumber);
          return commentary; // Keep original on error
        }

        const data = await response.json();

        return {
          ...commentary,
          text: data.translatedText,
          tags: data.translatedTags || commentary.tags,
          timestamp: new Date(),
        };
      } catch (error) {
        console.error('Translation error:', error);
        return commentary; // Keep original on error
      }
    });
    
    const results = await Promise.all(translationPromises);
    
    setCommentaries(results);
    setIsRetranslating(false);
    console.log('✅ Re-translation complete in parallel!');
  };
  
  const generateCommentaryInLanguage = async (rally: Rally, targetLanguage: Language) => {
    try {
      console.log('🎤 Generating commentary for rally #', rally.rally_number, 'in', targetLanguage);
      setIsGenerating(true);
      
      const updatedStats = calculatePlayerStats(rally);
      
      const rallyIndex = rallies.findIndex(r => r.rally_number === rally.rally_number);
      const recentRallies = rallyIndex >= 0 ? rallies.slice(Math.max(0, rallyIndex - 9), rallyIndex + 1) : [];

      const response = await fetch('/api/commentary', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          rally, 
          language: targetLanguage,
          playerStats: updatedStats,
          recentRallies: recentRallies,
        }),
      });

      if (!response.ok) {
        throw new Error('Commentary API failed');
      }

      // NEW: Parse JSON response instead of streaming
      const data = await response.json();

      setIsGenerating(false);
      return {
        commentary: data.commentary || '',
        tags: data.tags || [],
        milestones: data.milestones || [],
        icon: data.icon || '⚡',
        momentumScore: data.momentumScore || 0,
        dramaScore: data.dramaScore || 0,
      };
    } catch (error) {
      console.error('❌ Commentary generation error:', error);
      setIsGenerating(false);
      
      const finalTouch = rally.touches[rally.touches.length - 1];
      return {
        commentary: `${finalTouch.player}: ${finalTouch.action}`,
        tags: [],
        milestones: [],
        icon: '⚡',
        momentumScore: 0,
        dramaScore: 0,
      };
    }
  };

  useEffect(() => {
    loadMatchData();
  }, []);

  const loadMatchData = async () => {
    try {
      console.log('📥 Loading match data...');
      const response = await fetch('/data/matches/rallies/match_1104643_full_game_rallies.json');
      
      if (!response.ok) {
        throw new Error('Failed to load match data');
      }

      const data: MatchData = await response.json();
      console.log('✅ Loaded match data:', {
        match_id: data.match_id,
        set: data.set_number,
        rallies: data.rallies.length,
        teams: data.teams,
      });

      setMatchData(data);
      setRallies(data.rallies);
    } catch (error) {
      console.error('❌ Error loading match data:', error);
    }
  };

  const generateCommentary = async (rally: Rally) => {
    try {
      console.log('🎤 Generating commentary for rally #', rally.rally_number);
      setIsGenerating(true);
      
      const updatedStats = calculatePlayerStats(rally);
      
      const rallyIndex = rallies.findIndex(r => r.rally_number === rally.rally_number);
      const recentRallies = rallyIndex >= 0 ? rallies.slice(Math.max(0, rallyIndex - 9), rallyIndex + 1) : [];
      
      const rallyAnalysis = analyzeRallyChain(rally);

      const response = await fetch('/api/commentary', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          rally, 
          language,
          playerStats: updatedStats,
          recentRallies: recentRallies,
          rallyAnalysis: rallyAnalysis,
        }),
      });

      if (!response.ok) {
        throw new Error('Commentary API failed');
      }

      // NEW: Parse JSON response
      const data = await response.json();

      setIsGenerating(false);
      console.log('✅ Commentary generated:', data);
      
      return {
        commentary: data.commentary || '',
        tags: data.tags || [],
        milestones: data.milestones || [],
        icon: data.icon || '⚡',
        momentumScore: data.momentumScore || 0,
        dramaScore: data.dramaScore || 0,
      };
    } catch (error) {
      console.error('❌ Commentary generation error:', error);
      setIsGenerating(false);
      
      const finalTouch = rally.touches[rally.touches.length - 1];
      return {
        commentary: `${finalTouch.player}: ${finalTouch.action}`,
        tags: [],
        milestones: [],
        icon: '⚡',
        momentumScore: 0,
        dramaScore: 0,
      };
    }
  };
  
  const analyzeRallyChain = (rally: Rally) => {
    const touches = rally.touches;
    const numTouches = touches.length;
    
    let passQuality = 'unknown';
    let passPlayer = '';
    if (numTouches >= 2) {
      const passAction = touches[1].action.toLowerCase();
      passPlayer = touches[1].player;
      
      if (passAction.includes('perfect')) {
        passQuality = 'perfect';
      } else if (passAction.includes('error')) {
        passQuality = 'error';
      } else if (passAction.includes('negative')) {
        passQuality = 'negative';
      } else if (passAction.includes('pass')) {
        passQuality = 'good';
      }
    }
    
    const serverPlayer = touches[0]?.player || '';
    const setterPlayer = numTouches >= 3 ? touches[2]?.player : '';
    const attackerPlayer = numTouches >= 4 ? touches[3]?.player : '';
    
    let dramaScore = numTouches / 4.0;
    
    if (passQuality === 'error') {
      dramaScore *= 1.5;
    } else if (passQuality === 'negative' && numTouches >= 4) {
      dramaScore *= 2.0;
    }
    
    const scoreDiff = Math.abs(rally.score_after.aluron - rally.score_after.bogdanka);
    if (rally.score_after.aluron >= 20 && rally.score_after.bogdanka >= 20) {
      dramaScore *= 2.0;
    } else if (scoreDiff >= 5) {
      dramaScore *= 1.3;
    }
    
    return {
      numTouches,
      passQuality,
      passPlayer,
      serverPlayer,
      setterPlayer,
      attackerPlayer,
      dramaScore: Math.min(dramaScore, 5.0),
      isLongRally: numTouches >= 8,
      isDramatic: dramaScore >= 3.0,
    };
  };
  
  const calculatePlayerStats = (currentRally: Rally) => {
    const stats: Record<string, { blocks: number; aces: number; attacks: number; errors: number; points: number }> = {};
    
    const currentIndex = rallies.findIndex(r => r.rally_number === currentRally.rally_number);
    const ralliesToProcess = currentIndex >= 0 ? rallies.slice(0, currentIndex + 1) : [currentRally];
    
    ralliesToProcess.forEach(rally => {
      rally.touches.forEach(touch => {
        if (!stats[touch.player]) {
          stats[touch.player] = { blocks: 0, aces: 0, attacks: 0, errors: 0, points: 0 };
        }
        
        const action = touch.action.toLowerCase();
        
        if (action.includes('block') && !action.includes('error')) {
          stats[touch.player].blocks++;
        }
        if (action.includes('ace')) {
          stats[touch.player].aces++;
        }
        if (action.includes('attack') && !action.includes('error')) {
          stats[touch.player].attacks++;
        }
        if (action.includes('error')) {
          stats[touch.player].errors++;
        }
      });
      
      const finalTouch = rally.touches[rally.touches.length - 1];
      if (!finalTouch.action.toLowerCase().includes('error')) {
        if (!stats[finalTouch.player]) {
          stats[finalTouch.player] = { blocks: 0, aces: 0, attacks: 0, errors: 0, points: 0 };
        }
        stats[finalTouch.player].points++;
      }
    });
    
    setPlayerStats(stats);
    return stats;
  };

  const playMatch = async () => {
    if (currentRallyIndex >= rallies.length) {
      setIsPlaying(false);
      return;
    }

    setIsPlaying(true);
    const rally = rallies[currentRallyIndex];
    const finalTouch = rally.touches[rally.touches.length - 1];

    const result = await generateCommentary(rally);

    const newCommentary: CommentaryEntry = {
      rallyNumber: rally.rally_number,
      text: result.commentary,
      timestamp: new Date(),
      player: finalTouch.player,
      team: rally.team_scored,
      action: finalTouch.action,
      type: getActionType(finalTouch.action),
      // NEW FIELDS
      tags: result.tags,
      milestones: result.milestones,
      icon: result.icon,
      momentumScore: result.momentumScore,
      dramaScore: result.dramaScore,
    };

    setCommentaries((prev) => [newCommentary, ...prev]);

    setTimeout(() => {
      if (commentaryRef.current) {
        commentaryRef.current.scrollTop = 0;
      }
    }, 100);

    setTimeout(() => {
      setCurrentRallyIndex((prev) => prev + 1);
    }, speed);
  };

  useEffect(() => {
    if (isPlaying && currentRallyIndex < rallies.length) {
      playMatch();
    } else if (currentRallyIndex >= rallies.length) {
      setIsPlaying(false);
    }
  }, [isPlaying, currentRallyIndex]);

  const handlePlayPause = () => {
    if (currentRallyIndex >= rallies.length) {
      setCurrentRallyIndex(0);
      setCommentaries([]);
      setIsPlaying(true);
    } else {
      setIsPlaying(!isPlaying);
    }
  };

  const handleReset = () => {
    setIsPlaying(false);
    setCurrentRallyIndex(0);
    setCommentaries([]);
  };

  const getActionType = (action: string): string => {
    const lower = action.toLowerCase();
    if (lower.includes('ace')) return 'ace';
    if (lower.includes('block')) return 'block';
    if (lower.includes('attack') || lower.includes('kill')) return 'attack';
    if (lower.includes('error')) return 'error';
    return 'point';
  };

  const getEventColor = (type: string) => {
    const colors = {
      'ace': 'border-l-red-500 bg-red-500/10',
      'block': 'border-l-blue-500 bg-blue-500/10',
      'attack': 'border-l-yellow-500 bg-yellow-500/10',
      'point': 'border-l-green-500 bg-green-500/10',
      'error': 'border-l-gray-500 bg-gray-500/10',
    };
    return colors[type as keyof typeof colors] || 'border-l-gray-500 bg-gray-500/10';
  };

  const progress = rallies.length > 0 ? (currentRallyIndex / rallies.length) * 100 : 0;
  const currentRally = rallies[currentRallyIndex];
  const formatScore = (rally: Rally) => `${rally.score_after.aluron}:${rally.score_after.bogdanka}`;

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto">
        {/* Match Header */}
        <div className="p-6 border-b border-border bg-gradient-to-r from-blue-600/20 to-red-600/20">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
                <span className="text-sm font-semibold text-red-500">
                  {mode === 'live' ? 'NA ŻYWO' : 'DEMO MODE'}
                </span>
              </div>
              {matchData && (
                <span className="text-sm text-muted-foreground">Set {matchData.set_number}</span>
              )}
            </div>

            {/* Language Switcher */}
            <div className="flex items-center gap-2">
              {languages.map((lang) => (
                <button
                  key={lang.code}
                  onClick={() => setLanguage(lang.code)}
                  className={`px-3 py-1.5 rounded-lg ${lang.code !== 'en' ? 'text-sm' : ''} font-medium transition-all ${
                    language === lang.code
                      ? 'bg-blue-500 text-white'
                      : 'bg-muted hover:bg-muted/80 text-muted-foreground'
                  }`}
                  style={lang.code === 'en' ? { fontSize: '1.4rem', lineHeight: '1.4rem' } : undefined}
                  title={lang.name}
                >
                  {lang.flag}
                </button>
              ))}
            </div>
          </div>

          {/* Score Display */}
          {matchData && currentRally && (
            <div className="flex items-center justify-center space-x-8">
              <div className="text-center">
                <div className="mb-2">
                  <img 
                    src="/team-logos/aluron-logo.png" 
                    alt="Aluron CMC Warta Zawiercie"
                    className="w-16 h-16 mx-auto object-contain"
                  />
                </div>
                <div className="text-sm font-medium mb-1">{matchData.teams.home}</div>
                <div className="text-3xl font-bold">{currentRally.score_after.aluron}</div>
              </div>

              <div className="text-2xl font-bold text-muted-foreground">:</div>

              <div className="text-center">
                <div className="mb-2">
                  <img 
                    src="/team-logos/bogdanka-logo.png" 
                    alt="BOGDANKA LUK Lublin"
                    className="w-16 h-16 mx-auto object-contain"
                  />
                </div>
                <div className="text-sm font-medium mb-1">{matchData.teams.away}</div>
                <div className="text-3xl font-bold">{currentRally.score_after.bogdanka}</div>
              </div>
            </div>
          )}
        </div>

        {/* Controls - Only in Demo Mode */}
        {mode === 'demo' && (
          <div className="bg-card p-6 border-b">
            <div className="flex items-center justify-between mb-4">
              <div className="flex gap-4">
                <button
                  onClick={handlePlayPause}
                  disabled={isGenerating || !matchData}
                  className={`px-6 py-3 rounded-lg font-semibold text-white transition-all ${
                    isPlaying
                      ? 'bg-yellow-500 hover:bg-yellow-600'
                      : 'bg-green-500 hover:bg-green-600'
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  {isPlaying ? '⏸️ Pause' : currentRallyIndex >= rallies.length ? '🔄 Replay' : '▶️ Play'}
                </button>
                <button
                  onClick={handleReset}
                  disabled={isGenerating || !matchData}
                  className="px-6 py-3 bg-gray-500 hover:bg-gray-600 text-white rounded-lg font-semibold transition-all disabled:opacity-50"
                >
                  🔄 Reset
                </button>
              </div>

              <div className="flex items-center gap-4">
                <span className="text-sm font-medium">Speed:</span>
                {[
                  { label: '🐌 Slow', value: 5000 },
                  { label: '🚶 Normal', value: 3000 },
                  { label: '🏃 Fast', value: 1500 },
                ].map((option) => (
                  <button
                    key={option.value}
                    onClick={() => setSpeed(option.value)}
                    disabled={!matchData}
                    className={`px-4 py-2 rounded-lg font-medium transition-all disabled:opacity-50 ${
                      speed === option.value
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted hover:bg-muted/80'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="mb-2">
              <div className="flex justify-between text-sm text-muted-foreground mb-1">
                <span>Rally {currentRallyIndex + 1} / {rallies.length}</span>
                <span>{Math.round(progress)}%</span>
              </div>
              <div className="w-full bg-muted rounded-full h-3">
                <div
                  className="bg-primary h-3 rounded-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>

            {isGenerating && (
              <div className="flex items-center gap-2 text-primary mt-4">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary"></div>
                <span className="font-medium">Generating AI commentary...</span>
              </div>
            )}
            
            {isRetranslating && (
              <div className="flex items-center gap-2 text-blue-500 mt-4">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-500"></div>
                <span className="font-medium">🌍 Re-translating commentaries...</span>
              </div>
            )}
          </div>
        )}

        {/* Commentary Timeline */}
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-muted-foreground">
              🎤 Przebieg meczu - AI Commentary
            </h2>
            <div className="text-sm text-muted-foreground">
              {commentaries.length} komentarzy
            </div>
          </div>

          <div
            ref={commentaryRef}
            className="space-y-3 overflow-y-auto"
            style={{ maxHeight: mode === 'demo' ? '500px' : '700px' }}
          >
            {commentaries.length === 0 ? (
              <div className="text-center text-muted-foreground py-12 bg-muted/30 rounded-lg">
                <div className="text-4xl mb-3">🎤</div>
                <p className="font-medium">Press Play to start AI commentary...</p>
                <p className="text-sm mt-2">Rally-by-rally analysis powered by GPT-4o-mini + RAG</p>
              </div>
            ) : (
              commentaries.map((commentary, index) => {
                const rally = rallies.find(r => r.rally_number === commentary.rallyNumber);
                const score = rally ? `${rally.score_after.aluron}:${rally.score_after.bogdanka}` : '';
                
                return (
                  <div key={index} className="flex gap-3 items-start">
                    {/* Score Box - Left Side */}
                    {score && (
                      <div className="flex-shrink-0 bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-lg px-4 py-3 text-center min-w-[80px]">
                        <div className="text-2xl font-bold text-blue-700">{score}</div>
                      </div>
                    )}
                    
                    {/* Commentary Card - Right Side */}
                    <div
                      className={`flex-1 p-4 rounded-lg border-l-4 ${getEventColor(commentary.type)}
                        hover:scale-[1.01] transition-all duration-200 animate-fade-in`}
                    >
                      <div className="flex items-start space-x-3">
                        {/* NEW: Dynamic Icon */}
                        <div className="text-2xl">
                          {commentary.icon}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-bold text-gray-600">
                              Rally #{commentary.rallyNumber}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {commentary.timestamp.toLocaleTimeString()}
                            </span>
                          </div>
                          <p className="font-medium text-foreground leading-relaxed mb-2">
                            {commentary.text}
                          </p>
                          
                          {/* NEW: Tags Display */}
                          {commentary.tags.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 mb-2">
                              {commentary.tags.map((tag, idx) => {
                                const tagStyle = TAG_COLORS[tag] || { 
                                  bg: 'bg-gray-500/20', 
                                  text: 'text-gray-600', 
                                  border: 'border-gray-500' 
                                };
                                return (
                                  <span
                                    key={idx}
                                    className={`text-xs font-semibold px-2 py-1 rounded border ${tagStyle.bg} ${tagStyle.text} ${tagStyle.border}`}
                                  >
                                    {tag}
                                  </span>
                                );
                              })}
                            </div>
                          )}
                          
                          {/* NEW: Milestones Display */}
                          {commentary.milestones.length > 0 && (
                            <div className="mb-2">
                              {commentary.milestones.map((milestone, idx) => (
                                <div key={idx} className="flex items-center gap-2 text-xs font-semibold text-blue-600 bg-blue-500/10 px-2 py-1 rounded">
                                  <span>🎯</span>
                                  <span>{milestone}</span>
                                </div>
                              ))}
                            </div>
                          )}
                          
                          <div className="flex items-center justify-between">
                            <p className="text-xs text-muted-foreground">
                              {commentary.player} • {commentary.action}
                            </p>
                            <span className={`text-xs font-semibold px-2 py-1 rounded ${
                              commentary.team === 'Aluron' 
                                ? 'bg-blue-500/20 text-blue-500' 
                                : 'bg-red-500/20 text-red-500'
                            }`}>
                              {commentary.team}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes fade-in {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-fade-in {
          animation: fade-in 0.5s ease-out;
        }
      `}</style>
    </div>
  );
}