'use client';

import { useState, useEffect, useRef } from 'react';
import InlineFeedback from './InlineFeedback';
import { getIcon } from './IconMapper';
import { loadDataVolleyMatch, type MatchData as DVMatchData } from '@/lib/datavolley-parser';

const TEAM_LOGOS: Record<string, string> = {
 'Aluron': '/team-logos/aluron-logo.png',
 'aluron': '/team-logos/aluron-logo.png',
 'zaw': '/team-logos/aluron-logo.png',
 'ZAW': '/team-logos/aluron-logo.png',
 
 'Bogdanka': '/team-logos/bogdanka-logo.png',
 'bogdanka': '/team-logos/bogdanka-logo.png',
 'lbn': '/team-logos/bogdanka-logo.png',
 'LBN': '/team-logos/bogdanka-logo.png',
 
 'PGE': '/team-logos/warszawa-logo.png',
 'pge': '/team-logos/warszawa-logo.png',
 'Projekt': '/team-logos/warszawa-logo.png',
 
 'IND': '/team-logos/olsztyn-logo.png',
 'ind': '/team-logos/olsztyn-logo.png',
 'Indykpol': '/team-logos/olsztyn-logo.png',
 
 'JSW': '/team-logos/jsw-logo.png',
 'jsw': '/team-logos/jsw-logo.png',
 'Jastrzebski': '/team-logos/jsw-logo.png',
 
 'ASS': '/team-logos/rzeszow-logo.png',
 'ass': '/team-logos/rzeszow-logo.png',
 'Asseco': '/team-logos/rzeszow-logo.png',
};

function getTeamLogo(teamName: string): string {
 const lower = teamName?.toLowerCase() || '';
 
 // Try exact match (case-insensitive)
 if (TEAM_LOGOS[lower]) return TEAM_LOGOS[lower];
 if (TEAM_LOGOS[teamName]) return TEAM_LOGOS[teamName];
 
 // Try partial match
 for (const [key, logo] of Object.entries(TEAM_LOGOS)) {
 if (lower.includes(key.toLowerCase()) || key.toLowerCase().includes(lower)) {
 return logo;
 }
 }
 
 console.warn('[LOGO] No match for:', teamName, 'trying fallback...');
 return '/team-logos/aluron-logo.png';
}

const fetchWithUTF8 = async (url: string, options?: RequestInit) => {
 const response = await fetch(url, {
 ...options,
 headers: {
 ...options?.headers,
 'Content-Type': 'application/json; charset=utf-8',
 },
 });
 
 if (!response.ok) {
 throw new Error(`HTTP error! status: ${response.status}`);
 }
 
 const text = await response.text();
 return JSON.parse(text);
};

interface Rally {
 rally_number: number;
 set_number?: number;
 score_before: { aluron: number; bogdanka: number };
 score_after: { aluron: number; bogdanka: number };
 team_scored: string;
 touches: Array<{
 action: string;
 player: string;
 number: string;
 team: string;
 actionType?: string;  // raw: Serve, Receive, Attack, Block, Dig, Set, Freeball
 grade?: string;       // Perfect, Positive, Average, Poor, Fail, Incomplete
 rallyWon?: string;    // Won, Lost
 attackCombination?: string;
 attackLocation?: string;
 attackStyle?: string;
 serveType?: string;
 zone?: string;
 fromZone?: string;
 toZone?: string;
 middleRoute?: string;
 }>;
 final_action: {
 type: string;
 player: string;
 number: string;
 };
}

interface LineupPlayer {
 name: string;
 jersey: string;
 isServer?: boolean;
}

interface SetLineup {
 setNumber: number;
 home: LineupPlayer[];
 away: LineupPlayer[];
 firstServer: { team: string; player: string; jersey: string } | null;
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
 lineups?: SetLineup[];
}

interface CommentaryEntry {
 rallyNumber: number;
 text: string;
 originalText: string; // Always stores Polish original for re-translation
 timestamp: Date;
 player: string;
 team: string;
 action: string;
 type: string; // 'point_home' | 'point_away' | 'error' | 'lineup' | 'set_summary'
 // NEW FIELDS
 tags: string[];
 originalTags: string[]; // Always stores Polish original tags
 milestones: string[];
 icon: string;
 momentumScore: number;
 dramaScore: number;
 tagData: Record<string, any>;
 // LINEUP CARD DATA (only when type === 'lineup')
 lineupData?: SetLineup;
 // SET SUMMARY DATA (only when type === 'set_summary')
 summaryData?: {
   setNumber: number;
   finalScore: { home: number; away: number };
   winner: string;
   topScorers: Array<{ player: string; points: number }>;
   totalRallies: number;
 };
}

type Language = 'pl' | 'en' | 'it' | 'de' | 'tr' | 'es' | 'pt' | 'jp';
type Mode = 'demo' | 'live';

const languages: { code: Language; flag: string; name: string }[] = [
 { code: 'pl', name: 'Polski' },
 { code: 'en', name: 'English' },
 { code: 'it', name: 'Italiano' },
 { code: 'de', name: 'Deutsch' },
 { code: 'tr', name: 'Turkce' },
 { code: 'es', name: 'Espanol' },
 { code: 'pt', name: 'Portugues' },
 { code: 'jp', name: 'Nihongo' },
];

// ============================================================================
// BUDDY PANEL i18n
// ============================================================================
const BUDDY_I18N: Record<Language, Record<string, string>> = {
 pl: {
   statsTitle: 'Statystyki w meczu', points: 'Punkty', serve: 'Zagrywka',
   reception: 'Przyjecie', attack: 'Atak', block: 'Blok', other: 'Inne',
   expertTitle: 'Wiedza ekspercka', loading: 'Wczytywanie profilu z bazy wiedzy...',
   noProfile: 'Brak profilu w bazie wiedzy',
   addProfile: 'Dodaj informacje o {player} do Pinecone (namespace: player-profiles)',
   profilePending: 'Informacje eksperckie o zawodniku z bazy wiedzy RAG pojawia sie tutaj wkrotce...',
   selectPlayer: 'Wybierz ulubionego zawodnika aby aktywowac BUDDY panel',
   sources: 'zrodel w bazie wiedzy', source1: 'zrodlo w bazie wiedzy', sources24: 'zrodla w bazie wiedzy',
   highRelevance: 'wysoka trafnosc', medRelevance: 'srednia trafnosc',
 },
 en: {
   statsTitle: 'Match Statistics', points: 'Points', serve: 'Serve',
   reception: 'Reception', attack: 'Attack', block: 'Block', other: 'Other',
   expertTitle: 'Expert Knowledge', loading: 'Loading player profile...',
   noProfile: 'No profile in knowledge base',
   addProfile: 'Add info about {player} to Pinecone (namespace: player-profiles)',
   profilePending: 'Expert player info from RAG knowledge base coming soon...',
   selectPlayer: 'Select a favorite player to activate BUDDY panel',
   sources: 'sources in knowledge base', source1: 'source in knowledge base', sources24: 'sources in knowledge base',
   highRelevance: 'high relevance', medRelevance: 'medium relevance',
 },
 it: {
   statsTitle: 'Statistiche partita', points: 'Punti', serve: 'Battuta',
   reception: 'Ricezione', attack: 'Attacco', block: 'Muro', other: 'Altro',
   expertTitle: 'Conoscenza esperta', loading: 'Caricamento profilo...',
   noProfile: 'Nessun profilo nella base dati',
   addProfile: 'Aggiungi info su {player} a Pinecone (namespace: player-profiles)',
   profilePending: 'Informazioni esperte sul giocatore in arrivo...',
   selectPlayer: 'Seleziona un giocatore preferito per attivare il pannello BUDDY',
   sources: 'fonti nella base dati', source1: 'fonte nella base dati', sources24: 'fonti nella base dati',
   highRelevance: 'alta rilevanza', medRelevance: 'media rilevanza',
 },
 de: {
   statsTitle: 'Spielstatistiken', points: 'Punkte', serve: 'Aufschlag',
   reception: 'Annahme', attack: 'Angriff', block: 'Block', other: 'Andere',
   expertTitle: 'Expertenwissen', loading: 'Spielerprofil wird geladen...',
   noProfile: 'Kein Profil in der Wissensdatenbank',
   addProfile: 'Info uber {player} zu Pinecone hinzufugen (namespace: player-profiles)',
   profilePending: 'Experten-Spielerinfos aus RAG kommen bald...',
   selectPlayer: 'Wahle einen Lieblingsspieler um das BUDDY-Panel zu aktivieren',
   sources: 'Quellen in der Wissensdatenbank', source1: 'Quelle in der Wissensdatenbank', sources24: 'Quellen in der Wissensdatenbank',
   highRelevance: 'hohe Relevanz', medRelevance: 'mittlere Relevanz',
 },
 tr: {
   statsTitle: 'Mac Istatistikleri', points: 'Sayilar', serve: 'Servis',
   reception: 'Kabul', attack: 'Atak', block: 'Blok', other: 'Diger',
   expertTitle: 'Uzman Bilgisi', loading: 'Oyuncu profili yukleniyor...',
   noProfile: 'Bilgi tabaninda profil yok',
   addProfile: '{player} hakkinda bilgi ekleyin',
   profilePending: 'Uzman oyuncu bilgisi yakinda...',
   selectPlayer: 'BUDDY panelini etkinlestirmek icin bir oyuncu secin',
   sources: 'kaynak', source1: 'kaynak', sources24: 'kaynak',
   highRelevance: 'yuksek uyum', medRelevance: 'orta uyum',
 },
 es: {
   statsTitle: 'Estadisticas del partido', points: 'Puntos', serve: 'Saque',
   reception: 'Recepcion', attack: 'Ataque', block: 'Bloqueo', other: 'Otros',
   expertTitle: 'Conocimiento experto', loading: 'Cargando perfil del jugador...',
   noProfile: 'Sin perfil en la base de conocimiento',
   addProfile: 'Agregar info sobre {player} a Pinecone (namespace: player-profiles)',
   profilePending: 'Informacion experta del jugador proximamente...',
   selectPlayer: 'Selecciona un jugador favorito para activar el panel BUDDY',
   sources: 'fuentes en la base', source1: 'fuente en la base', sources24: 'fuentes en la base',
   highRelevance: 'alta relevancia', medRelevance: 'relevancia media',
 },
 pt: {
   statsTitle: 'Estatisticas do jogo', points: 'Pontos', serve: 'Saque',
   reception: 'Recepcao', attack: 'Ataque', block: 'Bloqueio', other: 'Outros',
   expertTitle: 'Conhecimento especializado', loading: 'Carregando perfil do jogador...',
   noProfile: 'Sem perfil na base de conhecimento',
   addProfile: 'Adicionar info sobre {player} ao Pinecone (namespace: player-profiles)',
   profilePending: 'Informacoes especializadas do jogador em breve...',
   selectPlayer: 'Selecione um jogador favorito para ativar o painel BUDDY',
   sources: 'fontes na base', source1: 'fonte na base', sources24: 'fontes na base',
   highRelevance: 'alta relevancia', medRelevance: 'relevancia media',
 },
 jp: {
   statsTitle: 'Match Statistics', points: 'Points', serve: 'Serve',
   reception: 'Reception', attack: 'Attack', block: 'Block', other: 'Other',
   expertTitle: 'Expert Knowledge', loading: 'Loading player profile...',
   noProfile: 'No profile in knowledge base',
   addProfile: 'Add info about {player}',
   profilePending: 'Expert player info coming soon...',
   selectPlayer: 'Select a favorite player to activate BUDDY panel',
   sources: 'sources', source1: 'source', sources24: 'sources',
   highRelevance: 'high relevance', medRelevance: 'medium relevance',
 },
};

// Unified yellow tags a" readable on dark backgrounds
const TAG_LABELS: Record<string, string> = {
 '#seria': '#seria',
 '#comeback': '#comeback',
 '#drama': '#drama',
 '#dluga_wymiana': '#dluga wymiana',
 '#milestone': '#milestone',
 '#debiut': '#debiut',
 '#zmiana': '#zmiana',
 '#koniec_seta': '#koniec seta',
};

const TEAM_FULL_NAMES: Record<string, string> = {
 'zaw': 'Aluron CMC Warta Zawiercie',
 'lbn': 'BOGDANKA LUK Lublin',
 'pge': 'PGE Projekt Warszawa',
 'ind': 'Indykpol AZS Olsztyn',
 'jsw': 'Jastrzebski Wegiel',
 'ass': 'Asseco Resovia Rzeszow',
 'aluron': 'Aluron CMC Warta Zawiercie',
 'bogdanka': 'BOGDANKA LUK Lublin',
};

export default function LiveMatchCommentaryV3() {
 const [matchData, setMatchData] = useState<MatchData | null>(null);
 const [rallies, setRallies] = useState<Rally[]>([]);
 const [commentaries, setCommentaries] = useState<CommentaryEntry[]>([]);
 const [currentRallyIndex, setCurrentRallyIndex] = useState(0);
 const [isPlaying, setIsPlaying] = useState(false);
 const [currentSetNumber, setCurrentSetNumber] = useState(0);
 const [isGenerating, setIsGenerating] = useState(false);
 const [speed, setSpeed] = useState(3000);
 const [language, setLanguage] = useState<Language>('pl');
 const [mode, setMode] = useState<Mode>('demo');
 const commentaryRef = useRef<HTMLDivElement>(null);
 const headerRef = useRef<HTMLDivElement>(null);
 const [headerHeight, setHeaderHeight] = useState(0);
 const [isRetranslating, setIsRetranslating] = useState(false);
 const [selectedMatch, setSelectedMatch] = useState('2025-11-12_ZAW-LBN.json');
 const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
 const [openTagPopup, setOpenTagPopup] = useState<string | null>(null);
 const [favPlayer, setFavPlayer] = useState<string | null>(null);
 const [openFavPopup, setOpenFavPopup] = useState<number | null>(null);
 const [playerProfile, setPlayerProfile] = useState<{
   found: boolean;
   summary: string;
   profile: { name: string; team: string; position: string; nationality: string; content: string } | null;
   chunks: Array<{ content: string; category: string; score: number }>;
 } | null>(null);
 const [isLoadingProfile, setIsLoadingProfile] = useState(false);
 const [translatedProfileSummary, setTranslatedProfileSummary] = useState<string | null>(null);

 const [playerStats, setPlayerStats] = useState<Record<string, {
 // Legacy fields (for route.ts compatibility)
 blocks: number;
 aces: number;
 attacks: number;
 errors: number;
 points: number;
 // Detailed stats
 serve: { sum: number; error: number; ace: number };
 reception: { sum: number; error: number; positive: number; perfect: number };
 attack: { sum: number; error: number; blocked: number; kill: number };
 block: { pts: number; touchPlus: number };
 dig: number;
 assist: number;
 bp: number; // break points (points scored while opponent serving)
 }>>({});
 
 // Build unique player list from rallies, grouped by team
 const playersByTeam = rallies.reduce((acc, rally) => {
 rally.touches.forEach(t => {
 if (t.player && t.team) {
 if (!acc[t.team]) acc[t.team] = new Set<string>();
 acc[t.team].add(t.player);
 }
 });
 return acc;
 }, {} as Record<string, Set<string>>);

 // Measure header height for fixed positioning
 useEffect(() => {
   const measure = () => {
     if (headerRef.current) {
       setHeaderHeight(headerRef.current.offsetHeight);
     }
   };
   measure();
   window.addEventListener('resize', measure);
   // Re-measure when mode/match changes (controls row appears/disappears)
   const observer = new ResizeObserver(measure);
   if (headerRef.current) observer.observe(headerRef.current);
   return () => {
     window.removeEventListener('resize', measure);
     observer.disconnect();
   };
 });

 // Load match data on mount
 useEffect(() => {
 /**
 * NOWY PARSER dla formatu 2025-11-12_ZAW-LBN.json
 * Struktura: { instances: [ { id, code, labels: {...} } ] }
 */
 /**
 * NAPRAWIONY PARSER dla formatu 2025-11-12_ZAW-LBN.json
 * Grupuje po Rally instances, nie po timestamps!
 */
 function parseNewDataVolleyFormat(datavolleyData: any): any {
 const instances = datavolleyData.instances;
 
 if (!instances || !Array.isArray(instances)) {
 throw new Error('Invalid NEW DataVolley format: missing instances array');
 }
 
 console.log('Parsing NEW DataVolley format...', {
 totalInstances: instances.length
 });
 
 // Find all Rally instances (they mark rally boundaries)
 const rallyIndices: number[] = [];
 instances.forEach((inst: any, idx: number) => {
 if (inst.code === 'Rally') {
 rallyIndices.push(idx);
 }
 });
 
 console.log('Found Rally markers:', rallyIndices.length);
 
 // Detect team names from rotation labels
 let homeTeamName = 'home';
 let awayTeamName = 'away';

 if (instances.length > 0) {
 const firstRally = instances.find((inst: any) => inst.code === 'Rally');
 if (firstRally && firstRally.labels) {
 const labels = firstRally.labels;
 const rotationKeys = Object.keys(labels).filter(k => k.includes('Rotation'));
 if (rotationKeys.length >= 2) {
 homeTeamName = rotationKeys[0].replace(' Rotation', '').toLowerCase();
 awayTeamName = rotationKeys[1].replace(' Rotation', '').toLowerCase();
 }
 }
 }

 // Detect home/away PREFIX from Team labels (e.g. PGE=Home, IND=Away)
 let homePrefix = '';
 let awayPrefix = '';
 for (const inst of instances) {
 const labels = inst.labels || {};
 if (labels['Team'] === 'Home' && !homePrefix) {
 const m = inst.code.match(/^([A-Z]{2,4})\s/);
 if (m) homePrefix = m[1];
 } else if (labels['Team'] === 'Away' && !awayPrefix) {
 const m = inst.code.match(/^([A-Z]{2,4})\s/);
 if (m) awayPrefix = m[1];
 }
 if (homePrefix && awayPrefix) break;
 }

 console.log('Detected teams:', { home: homeTeamName, away: awayTeamName, homePrefix, awayPrefix });

 // Track scores per set
 const setScores: Record<number, { home: number; away: number }> = {};
 
 const rallies: any[] = [];
 
 for (let i = 0; i < rallyIndices.length; i++) {
 const rallyIdx = rallyIndices[i];
 const nextRallyIdx = i < rallyIndices.length - 1 ? rallyIndices[i + 1] : instances.length;
 
 // Get all instances for this rally (from Rally marker to next Rally marker)
 const group = instances.slice(rallyIdx, nextRallyIdx);
 
 const rallyInst = group[0]; // First one is always the Rally marker
 const rallyLabels = rallyInst.labels || {};
 const setNumber = parseInt(rallyLabels.Set || '1');
 
 // Initialize set scores if not exists
 if (!setScores[setNumber]) {
 setScores[setNumber] = { home: 0, away: 0 };
 }
 
 // Extract touches (actions)
 const touches: any[] = [];
 const events: any = {
 timeout: null,
 substitutions: [],
 challenge: null
 };
 
 for (const inst of group) {
 const code = inst.code;
 const labels = inst.labels || {};
 
 if (code === 'Rally') continue;
 
 // Substitution
 if (code.includes('Substitution')) {
 const teamCode = code.split(' ')[0]; // ZAW, LBN, PGE, etc.
 const playerNames = labels[`${teamCode} Player Name`] || labels['Player Name'] || [];
 if (Array.isArray(playerNames) && playerNames.length >= 2) {
 const cleanName = (n: string) => n.split(',').reverse().map(s => s.trim()).join(' ');
 events.substitutions.push({
 player_out: cleanName(playerNames[0]),
 player_in: cleanName(playerNames[1]),
 team: labels['Team'] === 'Home' ? 'home' : 'away'
 });
 }
 continue;
 }
 
 // Timeout
 if (code.includes('Timeout')) {
 events.timeout = {
 team: code.startsWith('ZAW') ? 'home' : 'away',
 team_name: labels['Team Name'] || ''
 };
 continue;
 }
 
 // Video Challenge
 if (code.includes('Challenge') || code.includes('Video')) {
 events.challenge = {
 team: code.startsWith('ZAW') ? 'home' : 'away',
 team_name: labels['Team Name'] || '',
 type: 'Video Verification'
 };
 continue;
 }
 
 // Regular actions
 const actionMatch = code.match(/^([A-Z]{2,4})\s+(Serve|Attack|Set|Receive|Block|Dig|Freeball)/);
 if (actionMatch) {
 const teamPrefix = actionMatch[1];
 const actionType = actionMatch[2];
 
 // Skip meta actions
 if (!['Serve', 'Attack', 'Set', 'Receive', 'Block', 'Dig', 'Freeball'].includes(actionType)) {
 continue;
 }
 
 const playerNameKey = `${teamPrefix} Player Name`;
 const playerName = labels[playerNameKey] || '';
 const isHome = teamPrefix === homePrefix;

 const team = isHome ? 'home' : 'away';
 // Map action
 let action = actionType;
 const rallyWon = labels['Rally Won'];
 const grade = labels['Serve Grade'] || labels['Receive Grade'] || 
 labels['Attack Grade'] || labels['Block Grade'] || 
 labels['Dig Grade'] || '';
 
 if (actionType === 'Serve') {
 if (rallyWon === 'Lost') {
 action = 'Blad serwisu';
 } else if (grade === 'Ace') {
 action = 'As serwisowy';
 } else {
 action = 'Zagrywka';
 }
 } else if (actionType === 'Receive') {
 if (grade === 'Negative' || grade === 'Poor') {
 action = 'Przyjecie negative';
 } else if (grade === 'Positive') {
 action = 'Przyjecie positive';
 } else if (grade === 'Perfect') {
 action = 'Przyjecie perfect';
 } else {
 action = 'Przyjecie';
 }
 } else if (actionType === 'Set') {
 action = 'Rozegranie';
 } else if (actionType === 'Attack') {
 if (rallyWon === 'Lost') {
 action = 'Blad ataku';
 } else if (grade === 'Blocked') {
 action = 'Atak zablokowany';
 } else {
 action = 'Atak';
 }
 } else if (actionType === 'Block') {
 if (rallyWon === 'Lost') {
 action = 'Przebity blok';
 } else {
 action = 'Blok';
 }
 } else if (actionType === 'Dig') {
 action = 'Obrona';
 } else if (actionType === 'Freeball') {
 action = 'Wolna pilka';
 }
 
 if (action && playerName) {
 const cleanPlayerName = playerName.includes(',') 
 ? playerName.split(',')[0].trim() 
 : playerName;
 
 touches.push({
 action,
 player: cleanPlayerName,
 team,
 actionType: actionType,
 grade: grade || '',
 rallyWon: rallyWon || '',
 attackCombination: labels['Attack Combination'] || '',
 attackLocation: labels['Attack Location'] || '',
 attackStyle: labels['Attack Style'] || '',
 serveType: labels['Serve Type'] || '',
 zone: labels['Zone'] || '',
 fromZone: labels['From Zone'] || '',
 toZone: labels['To Zone'] || '',
 middleRoute: labels['Middle Route'] || '',
 });
 }
 }
 }
 
 // Determine who won the rally
 let team_scored = 'unknown';
 
 // Check for Rally Won = Won in any action
 for (const inst of group) {
 if (inst.code === 'Rally') continue;
 
 const labels = inst.labels || {};
 if (labels['Rally Won'] === 'Won') {
 const codeMatch = inst.code.match(/^([A-Z]{2,4})\s/);
 if (codeMatch) {
 const prefix = codeMatch[1];
 const isHome = prefix === homePrefix;
 team_scored = isHome ? 'home' : 'away';
 break;
 }
 }
 }
 
 // Get score BEFORE this rally
 const score_before = {
 home: setScores[setNumber].home,
 away: setScores[setNumber].away,
 [homeTeamName]: setScores[setNumber].home,
 [awayTeamName]: setScores[setNumber].away
 };
 
 // Update scores based on who won
 if (team_scored === 'home') {
 setScores[setNumber].home++;
 } else if (team_scored === 'away') {
 setScores[setNumber].away++;
 }
 
 // Get score AFTER this rally
 const score_after = {
 home: setScores[setNumber].home,
 away: setScores[setNumber].away,
 [homeTeamName]: setScores[setNumber].home,
 [awayTeamName]: setScores[setNumber].away
 };
 
 // Determine final_action
 const final_action = touches.length > 0 && touches[touches.length - 1] ? {
 type: touches[touches.length - 1].action || '',
 player: touches[touches.length - 1].player || ''
 } : { type: '', player: '' };
 
 // Build rally object
 const rally = {
 rally_number: i + 1,
 set_number: setNumber,
 score_before,
 score_after,
 team_scored,
 touches,
 final_action,
 timeout: events.timeout,
 substitutions: events.substitutions.length > 0 ? events.substitutions : null,
 challenge: events.challenge
 };
 
 rallies.push(rally);
 }
 
 // DEBUG - sprawdo pierwszy rally
 if (rallies.length > 0) {
 console.log('[SCORE-DEBUG] First rally score_after:', rallies[0].score_after);
 console.log('[SCORE-DEBUG] Team names:', { homeTeamName, awayTeamName });
 }

 console.log('NEW DataVolley parsed!', {
 rallies: rallies.length,
 withTouches: rallies.filter((r: any) => r.touches.length > 0).length,
 avgTouches: (rallies.reduce((sum: number, r: any) => sum + r.touches.length, 0) / rallies.length).toFixed(1),
 withTimeouts: rallies.filter((r: any) => r.timeout).length,
 withSubs: rallies.filter((r: any) => r.substitutions).length,
 withChallenges: rallies.filter((r: any) => r.challenge).length
 });
 
 // ========================================================================
 // LINEUP EXTRACTION - Starting 6 per set
 // ========================================================================
 const lineups: SetLineup[] = [];
 const setNumbers = [...new Set(rallies.map((r: any) => r.set_number || 1))];
 
 for (const setNum of setNumbers) {
   // Get instances for this set
   const setInstances = instances.filter((inst: any) => {
     const s = inst.labels?.Set;
     return s === String(setNum);
   });
   
   // Find starters: players who appear in first ~300 instances of the set
   // (middle blockers like Hoss/Brehme may not touch the ball until instance 180+)
   const homePlayers: Map<string, string> = new Map(); // name -> jersey
   const awayPlayers: Map<string, string> = new Map();
   
   for (const inst of setInstances.slice(0, 300)) {
     const labels = inst.labels || {};
     const code = inst.code || '';
     if (code === 'Rally') continue;
     
     const isSubstitution = code.includes('Substitution');
     
     // Try both team prefixes
     for (const [prefix, map] of [[homePrefix, homePlayers], [awayPrefix, awayPlayers]] as const) {
       if (!prefix) continue;
       const nameKey = `${prefix} Player Name`;
       const jerseyKey = `${prefix} Player Jersey`;
       let nameRaw = labels[nameKey] || '';
       let jerseyRaw = labels[jerseyKey] || '';
       
       // Substitution events have [playerOut, playerIn] as arrays ΓÇö add BOTH
       if (isSubstitution && Array.isArray(nameRaw)) {
         const jerseys = Array.isArray(jerseyRaw) ? jerseyRaw : [jerseyRaw, ''];
         nameRaw.forEach((n: string, idx: number) => {
           if (n && !map.has(n) && map.size < 14) {
             map.set(n, String(jerseys[idx] || ''));
           }
         });
         continue;
       }
       
       let name = Array.isArray(nameRaw) ? nameRaw[0] || '' : nameRaw;
       let jersey = Array.isArray(jerseyRaw) ? jerseyRaw[0] || '' : jerseyRaw;
       if (name && !map.has(name) && map.size < 14) {
         map.set(name, jersey);
       }
     }
     
     // Stop early if we found enough starters
     if (homePlayers.size >= 8 && awayPlayers.size >= 8) break;
   }
   
   // Find first server of the set
   let firstServer: SetLineup['firstServer'] = null;
   const firstServe = setInstances.find((inst: any) => inst.code?.includes('Serve'));
   if (firstServe) {
     const code = firstServe.code || '';
     const prefix = code.split(' ')[0];
     const name = firstServe.labels?.[`${prefix} Player Name`] || '';
     const jersey = firstServe.labels?.[`${prefix} Player Jersey`] || '';
     const cleanName = typeof name === 'string' && name.includes(',') ? name.split(',')[0].trim() : name;
     firstServer = {
       team: prefix === homePrefix ? 'home' : 'away',
       player: typeof cleanName === 'string' ? cleanName : String(cleanName),
       jersey: typeof jersey === 'string' ? jersey : String(jersey),
     };
   }
   
   // Clean player names
   const cleanLineup = (map: Map<string, string>): LineupPlayer[] => {
     return Array.from(map.entries()).slice(0, 7).map(([name, jersey]) => ({
       name: name.includes(',') ? name.split(',')[0].trim() : name,
       jersey,
     }));
   };
   
   lineups.push({
     setNumber: setNum,
     home: cleanLineup(homePlayers),
     away: cleanLineup(awayPlayers),
     firstServer,
   });
   
   console.log(`[LINEUP] Set ${setNum}: Home ${homePlayers.size} players, Away ${awayPlayers.size} players, Server: ${firstServer?.player || '?'}`);
 }

 return { 
 rallies,
 teams: {
 home: homeTeamName,
 away: awayTeamName
 },
 lineups
 };
 }

 /**
 * NAPRAWIONY PARSER - LICZY PUNKTY zamiast czyta Game Score
 */
 function parseDataVolleyFormat(datavolleyData: any): any {
 const instances = datavolleyData.file?.ALL_INSTANCES?.instance;
 
 if (!instances || !Array.isArray(instances)) {
 throw new Error('Invalid DataVolley format: missing instances');
 }
 
 console.log('Parsing DataVolley format...', {
 totalInstances: instances.length
 });
 
 // Group instances by rally (same start-end timestamp)
 const rallyGroups: Record<string, any[]> = {};
 
 for (const inst of instances) {
 const key = `${inst.start}-${inst.end}`;
 if (!rallyGroups[key]) {
 rallyGroups[key] = [];
 }
 rallyGroups[key].push(inst);
 }
 
 // Sort rally keys chronologically
 const sortedRallyKeys = Object.keys(rallyGroups).sort((a, b) => {
 const [startA] = a.split('-').map(Number);
 const [startB] = b.split('-').map(Number);
 return startA - startB;
 });
 
 // Track scores per set
 const setScores: Record<number, { home: number; away: number }> = {};
 
 const rallies: any[] = [];
 let rallyNumber = 1;
 
 for (const rallyKey of sortedRallyKeys) {
 const group = rallyGroups[rallyKey];
 
 // Find Rally instance
 const rallyInst = group.find((i: any) => i.code === 'Rally');
 if (!rallyInst) continue;
 
 const rallyLabels = labelsToObject(rallyInst.label);
 const setNumber = parseInt(rallyLabels.Set || '1');
 
 // Initialize set scores if not exists
 if (!setScores[setNumber]) {
 setScores[setNumber] = { home: 0, away: 0 };
 }
 
 // Extract touches (actions)
 const touches: any[] = [];
 const events: any = {
 timeout: null,
 substitutions: [],
 challenge: null
 };
 
 for (const inst of group) {
 const code = inst.code;
 const labels = labelsToObject(inst.label);
 
 if (code === 'Rally') continue;
 
 // Substitution
 if (code.includes('Substitution')) {
 const teamCode = code.split(' ')[0]; // ZAW, LBN, PGE, etc.
 const playerNames = labels[`${teamCode} Player Name`] || labels['Player Name'] || [];
 if (Array.isArray(playerNames) && playerNames.length >= 2) {
 const cleanName = (n: string) => n.split(',').reverse().map(s => s.trim()).join(' ');
 events.substitutions.push({
 player_out: cleanName(playerNames[0]),
 player_in: cleanName(playerNames[1]),
 team: labels['Team'] === 'Home' ? 'home' : 'away'
 });
 }
 continue;
 }
 
 // Timeout
 if (code.includes('Timeout')) {
 events.timeout = {
 team: code.startsWith('ZAW') ? 'home' : 'away',
 team_name: labels['Team Name'] || ''
 };
 continue;
 }
 
 // Video Challenge
 if (code.includes('Challenge') || code.includes('Video')) {
 events.challenge = {
 team: code.startsWith('ZAW') ? 'home' : 'away',
 team_name: labels['Team Name'] || '',
 type: 'Video Verification'
 };
 continue;
 }
 
 // Regular actions
 if (code.startsWith('ZAW ') || code.startsWith('LBN ')) {
 const teamPrefix = code.substring(0, 3);
 const actionType = code.substring(4);
 
 // Skip meta actions
 if (!['Serve', 'Attack', 'Set', 'Receive', 'Block', 'Dig', 'Freeball'].includes(actionType)) {
 continue;
 }
 
 const playerNameKey = `${teamPrefix} Player Name`;
 const playerName = labels[playerNameKey] || '';
 const team = teamPrefix === 'ZAW' ? 'home' : 'away';
 
 // Map action
 let action = actionType;
 const rallyWon = labels['Rally Won'];
 const grade = labels['Serve Grade'] || labels['Receive Grade'] || 
 labels['Attack Grade'] || labels['Block Grade'] || 
 labels['Dig Grade'] || '';
 
 if (actionType === 'Serve') {
 if (rallyWon === 'Lost') {
 action = 'Blad serwisu';
 } else if (grade === 'Ace') {
 action = 'As serwisowy';
 } else {
 action = 'Zagrywka';
 }
 } else if (actionType === 'Receive') {
 if (grade === 'Negative' || grade === 'Poor') {
 action = 'Przyjecie negative';
 } else if (grade === 'Positive') {
 action = 'Przyjecie positive';
 } else if (grade === 'Perfect') {
 action = 'Przyjecie perfect';
 } else {
 action = 'Przyjecie';
 }
 } else if (actionType === 'Set') {
 action = 'Rozegranie';
 } else if (actionType === 'Attack') {
 if (rallyWon === 'Lost') {
 action = 'Blad ataku';
 } else if (grade === 'Blocked') {
 action = 'Atak zablokowany';
 } else {
 action = 'Atak';
 }
 } else if (actionType === 'Block') {
 if (rallyWon === 'Lost') {
 action = 'Przebity blok';
 } else {
 action = 'Blok';
 }
 } else if (actionType === 'Dig') {
 action = 'Obrona';
 } else if (actionType === 'Freeball') {
 action = 'Wolna pilka';
 }
 
 if (action && playerName) {
          // Clean player name: "Leon Venero, Wilfredo" -> "Leon Venero"
 const cleanPlayerName = playerName.includes(',') 
 ? playerName.split(',')[0].trim() 
 : playerName;
 
 touches.push({
 action,
 player: cleanPlayerName,
 team,
 actionType: actionType,
 grade: grade || '',
 rallyWon: rallyWon || '',
 attackCombination: labels['Attack Combination'] || '',
 attackLocation: labels['Attack Location'] || '',
 attackStyle: labels['Attack Style'] || '',
 serveType: labels['Serve Type'] || '',
 zone: labels['Zone'] || '',
 fromZone: labels['From Zone'] || '',
 toZone: labels['To Zone'] || '',
 middleRoute: labels['Middle Route'] || '',
 });
 }
 }
 }
 
 // Determine who won the rally
 let team_scored = 'unknown';
 
 // Check for Rally Won = Won in any action
 for (const inst of group) {
 if (inst.code === 'Rally') continue;
 
 const labels = labelsToObject(inst.label);
 if (labels['Rally Won'] === 'Won') {
 // Check if it's ZAW or LBN action
 if (inst.code.startsWith('ZAW')) {
 team_scored = 'home';
 break;
 } else if (inst.code.startsWith('LBN')) {
 team_scored = 'away';
 break;
 }
 }
 }
 
 // Get score BEFORE this rally
 const score_before = {
 home: setScores[setNumber].home,
 away: setScores[setNumber].away,
 [homeTeamName]: setScores[setNumber].home,
 [awayTeamName]: setScores[setNumber].away
 };
 
 // Update scores based on who won
 if (team_scored === 'home') {
 setScores[setNumber].home++;
 } else if (team_scored === 'away') {
 setScores[setNumber].away++;
 }
 
 // Get score AFTER this rally
 const score_after = {
 home: setScores[setNumber].home,
 away: setScores[setNumber].away,
 [homeTeamName]: setScores[setNumber].home,
 [awayTeamName]: setScores[setNumber].away
 };
 
 // Determine final_action
 const final_action = touches.length > 0 && touches[touches.length - 1] ? {
 type: touches[touches.length - 1].action || '',
 player: touches[touches.length - 1].player || ''
 } : { type: '', player: '' };
 
 // Build rally object
 const rally = {
 rally_number: rallyNumber++,
 set_number: setNumber,
 score_before,
 score_after,
 team_scored,
 touches,
 final_action,
 timeout: events.timeout,
 substitutions: events.substitutions.length > 0 ? events.substitutions : null,
 challenge: events.challenge
 };
 
 rallies.push(rally);
 }
 
 console.log('DataVolley parsed!', {
 rallies: rallies.length,
 withTimeouts: rallies.filter((r: any) => r.timeout).length,
 withSubs: rallies.filter((r: any) => r.substitutions).length,
 withChallenges: rallies.filter((r: any) => r.challenge).length
 });
 
 return { rallies };
 }

 /**
 * Helper: Convert label array to object
 */
 function labelsToObject(labels: any[]): Record<string, string> {
 const obj: Record<string, string> = {};
 for (const label of labels) {
 obj[label.group] = label.text;
 }
 return obj;
 }

 const loadMatch = async () => {
 try {
 console.log('Loading match data (DataVolley format)...');
 
 const response = await fetch(`/data/matches/rallies/${selectedMatch}`);
 
 if (!response.ok) {
 throw new Error(`HTTP ${response.status}: ${response.statusText}`);
 }
 
 const rawData = await response.json();
 
 console.log('RAW JSON loaded:', rawData);
 
 // Check if it's DataVolley format or simple format
 let data;
 if (rawData.instances && Array.isArray(rawData.instances)) {
 console.log('Detected NEW DataVolley format (instances) - parsing...');
 data = parseNewDataVolleyFormat(rawData);
 } else if (rawData.file && rawData.file.ALL_INSTANCES) {
 console.log('Detected OLD DataVolley format - parsing...');
 data = parseDataVolleyFormat(rawData);
 } else if (rawData.rallies) {
 console.log('Detected simple format - using directly');
 data = rawData;
 } else {
 throw new Error('Invalid data format: neither DataVolley nor simple format');
 }
 
 console.log('Rallies parsed:', data.rallies?.length);
 
 // Validate data structure
 if (!data.rallies || !Array.isArray(data.rallies)) {
 throw new Error('Invalid data: rallies array missing after parsing');
 }
 
 console.log('Match data validated!', {
 rallies_count: data.rallies.length,
 first_rally: data.rallies[0],
 has_timeouts: data.rallies.filter((r: any) => r.timeout).length,
 has_subs: data.rallies.filter((r: any) => r.substitutions).length,
 has_challenges: data.rallies.filter((r: any) => r.challenge).length
 });
 
 setMatchData(data);
 setRallies(data.rallies);
 
 } catch (error) {
 console.error('Failed to load match data:', error);
 }
 };

 loadMatch();
 }, [selectedMatch]);
 // Re-translate all commentaries when language changes
 useEffect(() => {
 if (commentaries.length > 0) {
 retranslateCommentaries();
 }
 }, [language]);

 // Fetch player profile from RAG when favPlayer changes
 useEffect(() => {
   if (!favPlayer) {
     setPlayerProfile(null);
     setTranslatedProfileSummary(null);
     return;
   }

   const fetchProfile = async () => {
     setIsLoadingProfile(true);
     setPlayerProfile(null);
     
     try {
       console.log('[BUDDY] Fetching profile for:', favPlayer);
       const data = await fetchWithUTF8('/api/player-profile', {
         method: 'POST',
         body: JSON.stringify({ playerName: favPlayer }),
       });
       
       console.log('[BUDDY] Profile response:', data.found ? 'FOUND' : 'NOT FOUND', data.summary?.substring(0, 80));
       setPlayerProfile(data);
       
       // If not in PL, translate the profile summary
       if (data.found && data.summary && language !== 'pl') {
         try {
           const trResp = await fetch('/api/translate', {
             method: 'POST',
             headers: { 'Content-Type': 'application/json' },
             body: JSON.stringify({ text: data.summary, fromLanguage: 'pl', toLanguage: language }),
           });
           if (trResp.ok) {
             const trData = await trResp.json();
             setTranslatedProfileSummary(trData.translatedText);
           }
         } catch (e) { console.error('[BUDDY] Profile translate error:', e); }
       } else {
         setTranslatedProfileSummary(null);
       }
     } catch (error) {
       console.error('[BUDDY] Profile fetch error:', error);
       setPlayerProfile({ found: false, summary: '', profile: null, chunks: [] });
     } finally {
       setIsLoadingProfile(false);
     }
   };

   fetchProfile();
 }, [favPlayer]);

 const retranslateCommentaries = async () => {
 if (commentaries.length === 0 || isRetranslating) return;
 
 const currentLanguage = language;
 
 // PL = restore originals instantly (no API call needed!)
 if (currentLanguage === 'pl') {
   console.log('Restoring', commentaries.length, 'commentaries to original Polish');
   setCommentaries(prev => prev.map(c => ({
     ...c,
     text: c.originalText || c.text,
     tags: c.originalTags || c.tags,
   })));
   setTranslatedProfileSummary(null); // Reset to show original PL profile
   return;
 }
 
 setIsRetranslating(true);
 console.log('Re-translating', commentaries.length, 'commentaries to', currentLanguage);
 
 // Use originalText as source for translation (never the current translated text!)
 const translationPromises = commentaries.map(async (commentary) => {
 try {
 const sourceText = commentary.originalText || commentary.text;
 const sourceTags = commentary.originalTags || commentary.tags;
 
 const response = await fetch('/api/translate', {
 method: 'POST',
 headers: {
 'Content-Type': 'application/json',
 },
 body: JSON.stringify({
 text: sourceText,
 fromLanguage: 'pl', // Always translate FROM Polish original
 toLanguage: currentLanguage,
 tags: sourceTags,
 }),
 });

 if (!response.ok) {
 console.error('Translation failed for rally', commentary.rallyNumber);
 return commentary; // Keep current on error
 }

 const data = await response.json();

 return {
 ...commentary,
 text: data.translatedText,
 tags: data.translatedTags || commentary.tags,
 // originalText and originalTags stay unchanged!
 timestamp: new Date(),
 };
 } catch (error) {
 console.error('Translation error:', error);
 return commentary;
 }
 });
 
 const results = await Promise.all(translationPromises);
 
 setCommentaries(results);
 
 // Also translate expert knowledge profile summary
 if (playerProfile?.found && playerProfile.summary) {
   try {
     const profileResp = await fetch('/api/translate', {
       method: 'POST',
       headers: { 'Content-Type': 'application/json' },
       body: JSON.stringify({
         text: playerProfile.summary,
         fromLanguage: 'pl',
         toLanguage: currentLanguage,
       }),
     });
     if (profileResp.ok) {
       const profileData = await profileResp.json();
       setTranslatedProfileSummary(profileData.translatedText);
     }
   } catch (err) {
     console.error('Profile translation error:', err);
   }
 }
 
 setIsRetranslating(false);
 console.log('Re-translation complete in parallel!');
 };

 // Funkcja liczaca wyniki setow do aktualnego rally
 const calculateSetResults = (upToRallyIndex: number) => {
 const setWins = { home: 0, away: 0 };
 const setScores: Record<number, { home: number; away: number }> = {};
 
 // PrzejdAfa|A'Ao przez wszystkie rallies do aktualnego
 for (let i = 0; i <= upToRallyIndex && i < rallies.length; i++) {
 const rally = rallies[i];
 const setNum = rally.set_number;
 
 // Inicjalizuj set jeAfa|Aca'-Aoli nie istnieje
 if (!setScores[setNum]) {
 setScores[setNum] = { home: 0, away: 0 };
 }
 
 // Dodaj punkt
 if (rally.team_scored === 'home') {
 setScores[setNum].home++;
 } else if (rally.team_scored === 'away') {
 setScores[setNum].away++;
 }
 }
 
 // SprawdAfa|A'Ao ktore sety saAca'-A| zakoAfa|Aca'-3/4czone i kto wygraAfa|Aca'-!
 for (const setNum in setScores) {
 const score = setScores[setNum];
 // Set zakoAfa|Aca'-3/4czony jeAfa|Aca'-Aoli ktoAfa|Aca'-Ao ma 25+ i roznica >= 2, albo ktoAfa|Aca'-Ao ma 30+
 // LUB jeAfa|Aca'-Aoli to set 5 i ktoAfa|Aca'-Ao ma 15+ z roznica >= 2
 const isSet5 = parseInt(setNum) === 5;
 const winThreshold = isSet5 ? 15 : 25;
 const maxThreshold = isSet5 ? 999 : 30;
 
 if (
 (score.home >= winThreshold && score.home - score.away >= 2) ||
 (score.away >= winThreshold && score.away - score.home >= 2) ||
 score.home >= maxThreshold ||
 score.away >= maxThreshold
 ) {
 if (score.home > score.away) {
 setWins.home++;
 } else {
 setWins.away++;
 }
 }
 }
 
 return setWins;
 };

 
 const generateCommentaryInLanguage = async (rally: Rally, targetLanguage: Language) => {
 try {
 console.log('Generating commentary for rally #', rally.rally_number, 'in', targetLanguage);
 setIsGenerating(true);
 
 // Funkcja liczaca wyniki setow do aktualnego rally

 const updatedStats = calculatePlayerStats(rally);
 
 const rallyIndex = rallies.findIndex(r => r.rally_number === rally.rally_number);
 const recentRallies = rallyIndex >= 0 ? rallies.slice(Math.max(0, rallyIndex - 9), rallyIndex + 1) : [];

 const data = await fetchWithUTF8('/api/commentary', {
 method: 'POST',
 body: JSON.stringify({ rally, language: targetLanguage, playerStats: updatedStats, recentRallies: recentRallies, homeTeamFullName: TEAM_FULL_NAMES[matchData?.teams?.home || ''] || matchData?.teams?.home || 'Gospodarze', awayTeamFullName: TEAM_FULL_NAMES[matchData?.teams?.away || ''] || matchData?.teams?.away || 'Goscie' }),
 });

 setIsGenerating(false);
 return {
 commentary: data.commentary || '',
 tags: data.tags || [],
 tagData: data.tagData || {},
 milestones: data.milestones || [],
 icon: data.icon || '', momentumScore: data.momentumScore || 0,
 dramaScore: data.dramaScore || 0,
 };
 } catch (error) {
 console.error('Commentary generation error:', error);
 setIsGenerating(false);
 
 const finalTouch = rally.touches[rally.touches.length - 1];
 return {
 commentary: `${finalTouch.player}: ${finalTouch.action}`,
 tags: [],
 tagData: {},
 milestones: [],
 icon: '', momentumScore: 0,
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
 } else if (passAction.includes('pass') || passAction.includes('przyjecie')) {
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
 
 const scoreDiff = Math.abs(rally.score_after.home - rally.score_after.away);
 if (rally.score_after.home >= 20 && rally.score_after.away >= 20) {
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

 const generateCommentary = async (rally: Rally) => {
 try {
 console.log('Generating commentary for rally #', rally.rally_number);
 setIsGenerating(true);
 
 const updatedStats = calculatePlayerStats(rally);
 
 const rallyIndex = rallies.findIndex(r => r.rally_number === rally.rally_number);
 const recentRallies = rallyIndex >= 0 ? rallies.slice(Math.max(0, rallyIndex - 9), rallyIndex + 1) : [];
 
 const rallyAnalysis = analyzeRallyChain(rally);

 const data = await fetchWithUTF8('/api/commentary', {
 method: 'POST',
 body: JSON.stringify({ 
 rally, 
 language,
 playerStats: updatedStats,
 recentRallies: recentRallies,
 rallyAnalysis: rallyAnalysis,
 homeTeamFullName: TEAM_FULL_NAMES[matchData?.teams?.home || ''] || matchData?.teams?.home || 'Gospodarze',
 awayTeamFullName: TEAM_FULL_NAMES[matchData?.teams?.away || ''] || matchData?.teams?.away || 'Goscie',
 }),
 });

 setIsGenerating(false);
 console.log('Commentary generated:', data);
 
 return {
 commentary: data.commentary || '',
 tags: data.tags || [],
 tagData: data.tagData || {},
 milestones: data.milestones || [],
 icon: data.icon || '', momentumScore: data.momentumScore || 0,
 dramaScore: data.dramaScore || 0,
 };
 } catch (error) {
 console.error('Commentary generation error:', error);
 setIsGenerating(false);
 setIsPlaying(false); // STOP playback on error
 
 const finalTouch = rally.touches[rally.touches.length - 1];
 if (!finalTouch || !finalTouch.player || !finalTouch.action) {
 throw error; // Re-throw to stop execution
 }
 
 // Return fallback commentary but stop playback
 throw error;
 }
 };
 
 const calculatePlayerStats = (currentRally: Rally) => {
 const emptyStats = () => ({
   blocks: 0, aces: 0, attacks: 0, errors: 0, points: 0,
   serve: { sum: 0, error: 0, ace: 0 },
   reception: { sum: 0, error: 0, positive: 0, perfect: 0 },
   attack: { sum: 0, error: 0, blocked: 0, kill: 0 },
   block: { pts: 0, touchPlus: 0 },
   dig: 0, assist: 0, bp: 0,
 });
 
 const stats: Record<string, ReturnType<typeof emptyStats>> = {};
 
 const currentIndex = rallies.findIndex(r => r.rally_number === currentRally.rally_number);
 const ralliesToProcess = currentIndex >= 0 ? rallies.slice(0, currentIndex + 1) : [currentRally];
 
 ralliesToProcess.forEach(rally => {
 rally.touches.forEach(touch => {
 if (!touch.player) return;
 if (!stats[touch.player]) stats[touch.player] = emptyStats();
 const s = stats[touch.player];
 
 const at = (touch.actionType || '').toLowerCase();
 const grade = (touch.grade || '').toLowerCase();
 const action = touch.action.toLowerCase();
 
 // SERVE
 if (at === 'serve' || action.includes('zagrywka') || action.includes('serwis') || action.includes('ace')) {
   s.serve.sum++;
   if (action.includes('blad') || (grade === 'fail' && action.includes('serw'))) {
     s.serve.error++;
     s.errors++;
   }
   if (action.includes('ace') || grade === 'perfect') {
     s.serve.ace++;
     s.aces++;
   }
 }
 // RECEPTION
 else if (at === 'receive' || action.includes('przyjecie')) {
   s.reception.sum++;
   if (grade === 'fail' || action.includes('error')) {
     s.reception.error++;
     s.errors++;
   }
   if (grade === 'positive' || grade === 'perfect' || action.includes('positive') || action.includes('perfect')) {
     s.reception.positive++;
   }
   if (grade === 'perfect' || action.includes('perfect')) {
     s.reception.perfect++;
   }
 }
 // ATTACK
 else if (at === 'attack' || action.includes('atak')) {
   s.attack.sum++;
   s.attacks++;
   if (action.includes('blad') || grade === 'fail') {
     s.attack.error++;
     s.errors++;
   }
   if (action.includes('zablokowany') || grade === 'blocked') {
     s.attack.blocked++;
   }
   if (grade === 'perfect' || (touch.rallyWon === 'Won' && !action.includes('blad') && !action.includes('zablokowany'))) {
     s.attack.kill++;
   }
 }
 // BLOCK
 else if (at === 'block' || action.includes('blok')) {
   if (!action.includes('przebity') && !action.includes('error') && grade !== 'fail') {
     if (grade === 'perfect' || touch.rallyWon === 'Won') {
       s.block.pts++;
       s.blocks++;
     } else if (grade === 'positive') {
       s.block.touchPlus++;
     }
   }
 }
 // DIG
 else if (at === 'dig' || action.includes('obrona')) {
   s.dig++;
 }
 // SET (assist)
 else if (at === 'set' || action.includes('rozegranie')) {
   // Count as assist if the next touch was a kill
   // Simplified: count all sets as potential assists
   s.assist++;
 }
 });
 
 // POINTS: player who made the winning action (last touch, non-error)
 const finalTouch = rally.touches[rally.touches.length - 1];
 if (finalTouch && finalTouch.player) {
 if (!stats[finalTouch.player]) stats[finalTouch.player] = emptyStats();
 if (!finalTouch.action.toLowerCase().includes('error') && !finalTouch.action.toLowerCase().includes('blad')) {
   stats[finalTouch.player].points++;
 }
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
 const rallySetNumber = (rally as any).set_number || 1;
 
 // ========================================================================
 // INJECT LINEUP CARD when entering a new set
 // ========================================================================
 if (rallySetNumber !== currentSetNumber) {
   // If we had a previous set, inject SET SUMMARY first
   if (currentSetNumber > 0) {
     const prevSetRallies = rallies.filter((r: any) => (r.set_number || 1) === currentSetNumber);
     const lastRally = prevSetRallies[prevSetRallies.length - 1];
     if (lastRally) {
       // Calculate top scorers for the set
       const setScorers: Record<string, number> = {};
       prevSetRallies.forEach((r: any) => {
         const ft = r.touches?.[r.touches.length - 1];
         if (ft?.player && r.team_scored !== 'unknown' && !ft.action?.toLowerCase().includes('error')) {
           setScorers[ft.player] = (setScorers[ft.player] || 0) + 1;
         }
       });
       const topScorers = Object.entries(setScorers)
         .sort(([,a], [,b]) => b - a)
         .slice(0, 3)
         .map(([player, points]) => ({ player, points }));
       
       const summaryEntry: CommentaryEntry = {
         rallyNumber: -currentSetNumber - 100, // unique negative ID for summaries
         text: `Koniec ${currentSetNumber}. seta! ${lastRally.score_after.home}:${lastRally.score_after.away}`,
         originalText: `Koniec ${currentSetNumber}. seta! ${lastRally.score_after.home}:${lastRally.score_after.away}`,
         timestamp: new Date(),
         player: '', team: '', action: '',
         type: 'set_summary',
         tags: [], originalTags: [], milestones: [], icon: 'SET_END',
         momentumScore: 0, dramaScore: 0, tagData: {},
         summaryData: {
           setNumber: currentSetNumber,
           finalScore: { home: lastRally.score_after.home, away: lastRally.score_after.away },
           winner: lastRally.score_after.home > lastRally.score_after.away ? 'home' : 'away',
           topScorers,
           totalRallies: prevSetRallies.length,
         },
       };
       setCommentaries((prev) => [summaryEntry, ...prev]);
       // Small delay so summary appears before lineup
       await new Promise(resolve => setTimeout(resolve, 500));
     }
   }
   
   // Inject LINEUP CARD for the new set - REMOVED (lineup now in sticky header)
   // Just update current set number
   setCurrentSetNumber(rallySetNumber);
 }

 const result = await generateCommentary(rally);

 const finalTouch = rally.touches && rally.touches.length > 0 
 ? rally.touches[rally.touches.length - 1] 
 : null;

 // Skip rallies without valid touches
 if (!finalTouch || !finalTouch.player || !finalTouch.action) {
 console.warn(`Rally #${rally.rally_number} missing valid touches, skipping`); 
 // Skip to next rally instead of stopping completely
 if (currentRallyIndex < rallies.length - 1) {
 setCurrentRallyIndex(currentRallyIndex + 1);
 setTimeout(() => playMatch(), speed);
 } else {
 setIsPlaying(false);
 }
 return;
 }

 // Find the SCORING action (not the last touch which is often the losing action)
 const findScoringAction = (rally: Rally): { player: string; action: string } => {
   const touches = rally.touches;
   if (!touches || touches.length === 0) return { player: '?', action: '?' };
   
   const finalTouch = touches[touches.length - 1];
   const finalAction = finalTouch.action.toLowerCase();
   
   // If final touch is a LOSING action (przebity blok, obrona), go back to find winner
   if (finalAction.includes('przebity') || finalAction.includes('fail') || 
       finalAction.includes('obrona') || finalAction.includes('dig')) {
     // The touch before is likely the winning attack
     for (let i = touches.length - 2; i >= 0; i--) {
       const ta = touches[i].action.toLowerCase();
       if (ta.includes('atak') && !ta.includes('blad') && !ta.includes('zablok')) {
         return { player: touches[i].player, action: 'Atak' };
       }
     }
   }
   
   // Serve error = point for receiver
   if (finalAction.includes('blad') && finalAction.includes('serw')) {
     return { player: finalTouch.player, action: 'Blad serwisu' };
   }
   
   // Attack error
   if (finalAction.includes('blad') && finalAction.includes('atak')) {
     return { player: finalTouch.player, action: 'Blad ataku' };
   }
   
   // Successful block
   if ((finalAction.includes('blok') || finalAction.includes('block')) && 
       !finalAction.includes('przebity') && !finalAction.includes('fail')) {
     return { player: finalTouch.player, action: 'Blok' };
   }
   
   // Ace
   if (finalAction.includes('as ') || finalAction.includes('ace')) {
     return { player: finalTouch.player, action: 'As serwisowy' };
   }
   
   // Successful attack
   if (finalAction.includes('atak') && !finalAction.includes('blad') && !finalAction.includes('zablok')) {
     return { player: finalTouch.player, action: 'Atak' };
   }
   
   return { player: finalTouch.player, action: finalTouch.action };
 };
 
 const scoringInfo = findScoringAction(rally);
 
 const newCommentary: CommentaryEntry = {
 rallyNumber: rally.rally_number,
 text: result.commentary,
 originalText: result.commentary,
 timestamp: new Date(),
 player: scoringInfo.player,
 team: rally.team_scored,
 action: scoringInfo.action,
 type: getActionType(scoringInfo.action),
 // NEW FIELDS
 tags: result.tags,
 originalTags: result.tags,
 tagData: result.tagData || {},
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
 setCurrentSetNumber(0);
 setIsPlaying(true);
 } else {
 setIsPlaying(!isPlaying);
 }
 };

 const handleReset = () => {
 setIsPlaying(false);
 setCurrentRallyIndex(0);
 setCommentaries([]);
 setCurrentSetNumber(0);
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
 'intro': 'border-l-indigo-500 bg-indigo-500/10',
 };
 return colors[type as keyof typeof colors] || 'border-l-gray-500 bg-gray-500/10';
 };

 const progress = rallies.length > 0 ? (currentRallyIndex / rallies.length) * 100 : 0;
 const currentRally = rallies[currentRallyIndex];
 const formatScore = (rally: Rally) => `${rally.score_after.home}:${rally.score_after.away}`;

 return (
 <div className="h-screen bg-background flex flex-col overflow-hidden">

 {/* ===== HEADER (flex-shrink: 0, never scrolls) ===== */}
 <div ref={headerRef} className="flex-shrink-0 bg-background shadow-lg z-10">
 <div className="max-w-7xl mx-auto">

 {/* ΓòÉΓòÉΓòÉ SECTION 1: Match Selector ΓòÉΓòÉΓòÉ */}
 <div className="px-4 py-2.5 flex items-center gap-4 border-b border-border/50">
 <label className="text-sm font-bold text-foreground whitespace-nowrap">Wybierz mecz:</label>
 <select 
 value={selectedMatch}
 onChange={(e) => {
 setSelectedMatch(e.target.value);
 setCommentaries([]);
 setCurrentRallyIndex(0);
 setCurrentSetNumber(0);
 setIsPlaying(false);
 }}
 className="flex-1 max-w-xl px-3 py-2 text-sm font-semibold border border-border rounded-lg hover:border-primary focus:outline-none focus:ring-2 focus:ring-primary transition-all cursor-pointer"
 style={{ backgroundColor: '#1e293b', color: '#f1f5f9' }}
 >
 <option value="2025-11-12_ZAW-LBN.json" style={{ backgroundColor: '#1e293b', color: '#f1f5f9' }}>Aluron Zawiercie vs Bogdanka Lublin (12.11.2025)</option>
 <option value="2025-11-26_PGE-Ind.json" style={{ backgroundColor: '#1e293b', color: '#f1f5f9' }}>PGE Projekt Warszawa vs Indykpol Olsztyn (26.11.2025)</option>
 <option value="2025-12-06_JSW-Ass.json" style={{ backgroundColor: '#1e293b', color: '#f1f5f9' }}>Jastrzebski Wegiel vs Asseco Rzeszow (06.12.2025)</option>
 </select>
 <div className="flex items-center gap-1.5 px-2.5 py-1 bg-green-500/10 border border-green-500/20 rounded-lg">
 <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
 <span className="text-xs font-medium text-green-500">Live</span>
 </div>
 </div>

 {/* ΓòÉΓòÉΓòÉ SECTION 2: Set info + Mode + Languages ΓòÉΓòÉΓòÉ */}
 <div className="px-4 py-2 border-b border-border/50 bg-background">
 <div className="flex items-center justify-between">
 <div className="flex items-center gap-3">
 {currentRally && (() => {
 const setResults = calculateSetResults(currentRallyIndex);
 const hasCompletedSets = setResults.home > 0 || setResults.away > 0;
 return (
 <>
 <div className="bg-gradient-to-r from-blue-500 to-indigo-600 px-4 py-1.5 rounded-lg shadow">
 <span className="text-white font-bold text-sm">SET {currentRally.set_number}</span>
 </div>
 {hasCompletedSets && (
 <div className="flex items-center gap-1.5 bg-muted px-3 py-1.5 rounded-lg">
 <span className="text-xs font-semibold text-muted-foreground">Sets:</span>
 <span className="text-sm font-bold text-foreground">{setResults.home}-{setResults.away}</span>
 </div>
 )}
 <div className="flex items-center space-x-1.5 px-2.5 py-1 bg-red-500/10 border border-red-500/20 rounded-lg">
 <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
 <span className="text-xs font-semibold text-red-500">{mode === 'live' ? 'LIVE' : 'DEMO'}</span>
 </div>
 </>
 );
 })()}
 </div>
 <div className="flex flex-wrap items-center gap-1">
 {languages.map((lang) => (
 <button
 key={lang.code}
 onClick={() => setLanguage(lang.code)}
 className={`px-2.5 py-1 rounded text-xs font-semibold transition-all ${
 language === lang.code
 ? 'bg-blue-500 text-white'
 : 'bg-muted hover:bg-muted/80 text-muted-foreground'
 }`}
 title={lang.name}
 >
 {lang.code.toUpperCase()}
 </button>
 ))}
 </div>
 </div>
 </div>

 {/* ΓòÉΓòÉΓòÉ SECTION 3: Lineups + Scoreboard ΓòÉΓòÉΓòÉ */}
 <div className="px-4 py-3 border-b border-border/50 bg-background">
 <div className="flex items-stretch gap-4">

 {/* LEFT: Lineup table */}
 <div className="flex-1 min-w-0">
 {(() => {
   const currentLineup = matchData?.lineups?.find(l => l.setNumber === currentSetNumber) || matchData?.lineups?.[0];
   if (!currentLineup) return null;
   const homeFullName = TEAM_FULL_NAMES[matchData?.teams?.home || ''] || matchData?.teams?.home || '';
   const awayFullName = TEAM_FULL_NAMES[matchData?.teams?.away || ''] || matchData?.teams?.away || '';
   const maxRows = Math.max(currentLineup.home.length, currentLineup.away.length);
   return (
     <table className="w-full text-xs border-collapse">
       <thead>
         <tr className="border-b border-border/40">
           <th className="text-left pb-1.5 pr-2">
             <div className="flex items-center gap-1.5">
               <img src={getTeamLogo(matchData?.teams?.home || '')} alt="" className="w-4 h-4 object-contain" />
               <span className="font-bold text-blue-400">{homeFullName}</span>
             </div>
           </th>
           <th className="text-left pb-1.5 pl-2">
             <div className="flex items-center gap-1.5">
               <img src={getTeamLogo(matchData?.teams?.away || '')} alt="" className="w-4 h-4 object-contain" />
               <span className="font-bold text-red-400">{awayFullName}</span>
             </div>
           </th>
         </tr>
       </thead>
       <tbody>
         {Array.from({ length: maxRows }).map((_, i) => {
           const hp = currentLineup.home[i];
           const ap = currentLineup.away[i];
           return (
             <tr key={i}>
               <td className="py-0.5 pr-2">
                 {hp && (
                   <span className={favPlayer === hp.name ? 'text-yellow-400 font-bold' : 'text-muted-foreground'}>
                     <span className="font-mono text-muted-foreground/60 mr-1">#{hp.jersey}</span>
                     {hp.name}
                   </span>
                 )}
               </td>
               <td className="py-0.5 pl-2 border-l border-border/30">
                 {ap && (
                   <span className={favPlayer === ap.name ? 'text-yellow-400 font-bold' : 'text-muted-foreground'}>
                     <span className="font-mono text-muted-foreground/60 mr-1">#{ap.jersey}</span>
                     {ap.name}
                   </span>
                 )}
               </td>
             </tr>
           );
         })}
       </tbody>
     </table>
   );
 })()}
 </div>

 {/* RIGHT: Scoreboard */}
 {matchData && currentRally && (
 <div className="flex items-center gap-5 pl-4 border-l border-border/30">
 <div className="text-center min-w-[80px]">
 <img src={getTeamLogo(matchData?.teams?.home || 'Aluron')} alt="" className="w-14 h-14 mx-auto object-contain mb-1" />
 <div className="text-xs font-medium text-muted-foreground leading-tight">{TEAM_FULL_NAMES[matchData?.teams?.home || ''] || matchData?.teams?.home}</div>
 <div className="text-3xl font-bold mt-0.5">{currentRally.score_after.home}</div>
 </div>
 <div className="text-2xl font-bold text-muted-foreground/50">:</div>
 <div className="text-center min-w-[80px]">
 <img src={getTeamLogo(matchData?.teams?.away || 'Bogdanka')} alt="" className="w-14 h-14 mx-auto object-contain mb-1" />
 <div className="text-xs font-medium text-muted-foreground leading-tight">{TEAM_FULL_NAMES[matchData?.teams?.away || ''] || matchData?.teams?.away}</div>
 <div className="text-3xl font-bold mt-0.5">{currentRally.score_after.away}</div>
 </div>
 </div>
 )}

 </div>
 </div>

 {/* ΓòÉΓòÉΓòÉ SECTION 4: Controls ΓòÉΓòÉΓòÉ */}
 {mode === 'demo' && (
 <div className="px-4 py-2 border-b border-border/50 bg-background">
 <div className="flex items-center justify-between mb-2">
 <div className="flex gap-2">
 <button
 onClick={handlePlayPause}
 disabled={isGenerating || !matchData}
 className={`px-4 py-2 rounded-lg font-semibold text-sm text-white transition-all ${
 isPlaying ? 'bg-yellow-500 hover:bg-yellow-600' : 'bg-green-500 hover:bg-green-600'
 } disabled:opacity-50 disabled:cursor-not-allowed`}
 >
 {isPlaying ? 'PAUSE' : currentRallyIndex >= rallies.length ? 'REPLAY' : 'PLAY'}
 </button>
 <button
 onClick={handleReset}
 disabled={isGenerating || !matchData}
 className="px-4 py-2 bg-gray-500 hover:bg-gray-600 text-white rounded-lg font-semibold text-sm transition-all disabled:opacity-50"
 >
 RESET
 </button>
 </div>
 <div className="flex items-center gap-2">
 <span className="text-xs font-semibold">SPEED:</span>
 {[
 { label: 'SLOW', value: 5000 },
 { label: 'NORMAL', value: 3000 },
 { label: 'FAST', value: 1500 },
 ].map((option) => (
 <button
 key={option.value}
 onClick={() => setSpeed(option.value)}
 disabled={!matchData}
 className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all disabled:opacity-50 ${
 speed === option.value ? 'bg-blue-500 text-white' : 'bg-muted hover:bg-muted/80'
 }`}
 >
 {option.label}
 </button>
 ))}
 </div>
 </div>
 <div className="flex justify-between text-xs text-muted-foreground mb-1">
 <span>Rally {currentRallyIndex + 1} / {rallies.length}</span>
 <span>{Math.round(progress)}%</span>
 </div>
 <div className="w-full bg-muted rounded-full h-2">
 <div className="bg-primary h-2 rounded-full transition-all duration-300" style={{ width: `${progress}%` }} />
 </div>
 {isGenerating && (
 <div className="flex items-center gap-2 text-primary mt-2">
 <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
 <span className="text-xs font-medium">Generating AI commentary...</span>
 </div>
 )}
 {isRetranslating && (
 <div className="flex items-center gap-2 text-blue-500 mt-2">
 <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
 <span className="text-xs font-medium">Re-translating...</span>
 </div>
 )}
 </div>
 )}

 </div>
 </div>
 {/* ===== END HEADER ===== */}

 {/* ===== SCROLLABLE CONTENT (flex: 1, takes remaining height) ===== */}
 <div className="flex-1 overflow-y-auto">
 <div className="max-w-7xl mx-auto">
 <div className="flex gap-4 p-6">
 
 {/* LEFT: Commentary 2/3 */}
 <div className="w-2/3">
 <div className="flex items-center justify-between mb-4">
 <h2 className="text-sm font-semibold text-muted-foreground">
 Przebieg meczu - AI Commentary
 </h2>
 <div className="flex items-center gap-3">
 <span className="text-sm text-muted-foreground">
 {commentaries.length} komentarzy
 </span>
 <select
 value={favPlayer || ''}
 onChange={e => { setFavPlayer(e.target.value || null); setOpenFavPopup(null); }}
 className="px-2 py-1 text-xs rounded-lg border border-yellow-500 bg-yellow-400 text-yellow-950 font-semibold cursor-pointer"
 >
 <option value="">-- Ulubiony zawodnik --</option>
 {Object.entries(playersByTeam).map(([team, players]) => (
 <optgroup key={team} label={team}>
 {Array.from(players).sort().map(p => (
 <option key={p} value={p}>{p}</option>
 ))}
 </optgroup>
 ))}
 </select>
 <button
 onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
 className="px-3 py-1 text-xs font-semibold rounded-lg border border-border bg-card text-muted-foreground hover:bg-accent transition-all"
 >
 {sortOrder === 'desc' ? 'Chronologicznie' : 'Najnowsze na gorze'}

 </button>
 </div>
 </div>

 <div
 ref={commentaryRef}
 className="space-y-3"
 >
 {commentaries.length === 0 ? (
 <>
 <div className="text-4xl mb-3"></div>
 <p className="font-medium">Press Play to start AI commentary...</p>
 <p className="text-sm mt-2">Rally-by-rally analysis powered by GPT-4o-mini + RAG</p>
 </>
 ) : (
 (sortOrder === 'desc' ? [...commentaries].reverse() : commentaries).map((commentary, index) => {
 const rally = rallies.find(r => r.rally_number === commentary.rallyNumber);
 const score = rally ? `${rally.score_after.home}:${rally.score_after.away}` : '';
 
 // ========== SET SUMMARY CARD ==========
 if (commentary.type === 'set_summary' && commentary.summaryData) {
   const sd = commentary.summaryData;
   const homeFullName = TEAM_FULL_NAMES[matchData?.teams?.home || ''] || matchData?.teams?.home || 'Home';
   const awayFullName = TEAM_FULL_NAMES[matchData?.teams?.away || ''] || matchData?.teams?.away || 'Away';
   const winnerName = sd.winner === 'home' ? homeFullName : awayFullName;
   return (
     <div key={index} className="bg-gradient-to-r from-emerald-900 via-green-900 to-teal-900 rounded-xl p-5 text-white shadow-lg border border-emerald-500/30 animate-fade-in">
       <div className="text-center mb-3">
         <span className="text-xs font-bold uppercase tracking-widest text-emerald-300">Koniec seta {sd.setNumber}</span>
         <h3 className="text-2xl font-bold mt-1">{sd.finalScore.home} : {sd.finalScore.away}</h3>
         <p className="text-sm text-emerald-300">Wygrywa: {winnerName}</p>
       </div>
       {sd.topScorers.length > 0 && (
         <div className="mt-3 border-t border-emerald-700 pt-3">
           <p className="text-xs font-bold text-emerald-400 mb-1 uppercase">Top punktujacy w secie:</p>
           {sd.topScorers.map((s, i) => (
             <div key={i} className="flex justify-between text-sm py-0.5">
               <span className={favPlayer === s.player ? 'text-yellow-400 font-bold' : ''}>{i+1}. {s.player}</span>
               <span className="text-emerald-300 font-bold">{s.points} pkt</span>
             </div>
           ))}
         </div>
       )}
       <div className="text-center mt-3 text-xs text-emerald-500">
         {sd.totalRallies} akcji w secie
       </div>
     </div>
   );
 }

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
 {getIcon(commentary.icon)}
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
 
 {/* Tags Display - yellow, clickable with pop-ups */}
 {commentary.tags.length > 0 && (
 <div className="flex flex-wrap gap-1.5 mb-2">
 {commentary.tags.map((tag, idx) => {
 const label = TAG_LABELS[tag] || tag;
 const data = commentary.tagData?.[tag];
 const popupId = `${commentary.rallyNumber}-${tag}`;
 const isOpen = openTagPopup === popupId;
 return (
 <div key={idx} className="relative">
 <button
 onClick={() => setOpenTagPopup(isOpen ? null : popupId)}
 className="text-xs font-bold px-2.5 py-1 rounded-md border cursor-pointer bg-yellow-400 text-yellow-950 border-yellow-500 hover:shadow-md hover:scale-105 transition-all"
 >
 {label}
 </button>
 {isOpen && data && (
 <div className="absolute bottom-full left-0 mb-2 z-50 bg-slate-800 border border-slate-600 rounded-lg p-3 min-w-[250px] max-w-[350px] shadow-xl">
 <div className="flex justify-between items-center mb-2">
 <span className="text-sm font-bold text-white">{label}</span>
 <button onClick={() => setOpenTagPopup(null)} className="text-slate-400 hover:text-white text-sm">x</button>
 </div>
 <div className="text-xs text-slate-300 space-y-1">
 {tag === '#seria' && (
 <>
 <p>{data.team} - seria {data.length} punktow z rzedu</p>
 <p>Wynik: {data.score}</p>
 </>
 )}
 {tag === '#comeback' && (
 <>
 <p>{data.team} odrabia straty!</p>
 <p>Roznica: {data.scoreDiff} pkt | Wynik: {data.score}</p>
 </>
 )}
 {tag === '#drama' && (
 <>
 <p>Drama score: {data.dramaScore?.toFixed(1)}/5.0</p>
 {data.isHot && <p>Koncowka seta - kazdy punkt na wage zlota!</p>}
 </>
 )}
 {tag === '#dluga_wymiana' && (
 <p>{data.numTouches} dotkniec pilki w tej wymianie!</p>
 )}
 {tag === '#milestone' && (
 <>
 <p>{data.player}</p>
 <p>{data.achievement}</p>
 </>
 )}
 {tag === '#zmiana' && data.subs && (
 <>
 {data.subs.map((s: any, i: number) => (
 <p key={i}>{s.playerIn} wchodzi za {s.playerOut}</p>
 ))}
 </>
 )}
 {tag === '#koniec_seta' && (
 <>
 <p>Zwyciezca: {data.winner}</p>
 <p>Wynik koncowy: {data.score}</p>
 </>
 )}
 </div>
 </div>
 )}
 </div>
 );
 })}
 </div>
 )}
 
 {/* Favorite player tag */}
 {favPlayer && rally && rally.touches.some(t => t.player === favPlayer) && (() => {
 const isOpen = openFavPopup === commentary.rallyNumber;
 const stats = playerStats[favPlayer] || { blocks: 0, aces: 0, attacks: 0, errors: 0, points: 0, serve: { sum: 0, error: 0, ace: 0 }, reception: { sum: 0, error: 0, positive: 0, perfect: 0 }, attack: { sum: 0, error: 0, blocked: 0, kill: 0 }, block: { pts: 0, touchPlus: 0 }, dig: 0, assist: 0, bp: 0 };
 const touchesInRally = rally.touches.filter(t => t.player === favPlayer);
 return (
 <div className="mb-2 relative inline-block">
 <button
 onClick={() => setOpenFavPopup(isOpen ? null : commentary.rallyNumber)}
 className="text-xs font-bold px-2.5 py-1 rounded-md border cursor-pointer border-yellow-500 hover:shadow-lg hover:scale-105 transition-all"
 style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)', color: '#1a1400' }}
 >
 * {favPlayer}
 </button>
 {isOpen && (
 <div className="absolute bottom-full left-0 mb-2 z-50 border border-yellow-700 rounded-lg p-3 min-w-[280px] shadow-xl" style={{ background: 'linear-gradient(135deg, #2a1f00, #1a1400)' }}>
 <div className="flex justify-between items-center mb-2">
 <span className="text-sm font-bold text-yellow-400">* {favPlayer} - Live Stats</span>
 <button onClick={() => setOpenFavPopup(null)} className="text-slate-400 hover:text-white text-sm">x</button>
 </div>
 <div className="grid grid-cols-3 gap-2 mb-2">
 <div className="bg-white/5 rounded p-2 text-center">
 <div className="text-lg font-bold text-yellow-400">{stats.points}</div>
 <div className="text-[10px] text-slate-400 uppercase">Punkty</div>
 </div>
 <div className="bg-white/5 rounded p-2 text-center">
 <div className="text-lg font-bold text-blue-400">{stats.attacks}</div>
 <div className="text-[10px] text-slate-400 uppercase">Ataki</div>
 </div>
 <div className="bg-white/5 rounded p-2 text-center">
 <div className="text-lg font-bold text-green-400">{stats.aces}</div>
 <div className="text-[10px] text-slate-400 uppercase">Asy</div>
 </div>
 </div>
 <div className="grid grid-cols-2 gap-2">
 <div className="bg-white/5 rounded p-2 text-center">
 <div className="text-sm font-bold text-slate-200">{stats.blocks}</div>
 <div className="text-[10px] text-slate-400 uppercase">Bloki</div>
 </div>
 <div className="bg-white/5 rounded p-2 text-center">
 <div className="text-sm font-bold text-red-400">{stats.errors}</div>
 <div className="text-[10px] text-slate-400 uppercase">Bledy</div>
 </div>
 </div>
 <div className="mt-2 text-[10px] text-slate-500">
 W tym rally: {touchesInRally.map(t => t.action).join(', ')}
 </div>
 </div>
 )}
 </div>
 );
 })()}

 {/* NEW: Milestones Display */}
 {commentary.milestones.length > 0 && (
 <div className="mb-2">
 {commentary.milestones.map((milestone, idx) => (
 <div key={idx} className="flex items-center gap-2 text-xs font-semibold text-blue-600 bg-blue-500/10 px-2 py-1 rounded">
 <span>{milestone}</span>
 </div>
 ))}
 </div>
 )}
 
 <div className="flex items-center justify-between">
 <p className="text-xs text-muted-foreground">
 {commentary.player} {"\u2022"} {commentary.action}
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
 
 {/* VOICE OF CUSTOMER - FEEDBACK WIDGET */}
 <InlineFeedback
 key={`feedback-${commentary.rallyNumber}`}
 matchId={matchData?.match_id || '1104643'}
 rallyNumber={commentary.rallyNumber}
 setNumber={rally?.score_after ? Math.ceil((rally.score_after.home + rally.score_after.away) / 25) : 1}
 commentary={commentary.text}
 />
 </div>
 </div>
 );
 })
 )}
 </div>
 </div>
 {/* END LEFT 2/3 */}
 
 {/* RIGHT: Buddy Panel 1/3 */}
 <div className="w-1/3">
 <div className="sticky top-6 space-y-4 overflow-y-auto" style={{ maxHeight: `calc(100vh - ${headerHeight + 48}px)` }}>
 
 {/* Buddy Header */}
 {favPlayer ? (
 <div className="bg-gradient-to-br from-yellow-900/30 to-amber-900/20 border border-yellow-500/30 rounded-xl p-4">
 <div className="flex items-center gap-2 mb-3">
 <span className="text-yellow-400 text-lg">★</span>
 <h3 className="text-lg font-bold text-yellow-400">BUDDY</h3>
 </div>
 <div className="text-xl font-bold text-foreground mb-1">{favPlayer}</div>
 {(() => {
   // Find player team and jersey from lineup data
   const currentLineup = matchData?.lineups?.find(l => l.setNumber === currentSetNumber) || matchData?.lineups?.[0];
   const homePlayer = currentLineup?.home.find(p => p.name === favPlayer);
   const awayPlayer = currentLineup?.away.find(p => p.name === favPlayer);
   const playerTeam = homePlayer ? (TEAM_FULL_NAMES[matchData?.teams?.home || ''] || matchData?.teams?.home) : awayPlayer ? (TEAM_FULL_NAMES[matchData?.teams?.away || ''] || matchData?.teams?.away) : '';
   const jersey = homePlayer?.jersey || awayPlayer?.jersey || '';
   return (
     <div className="text-sm text-muted-foreground">
       {jersey && <span className="font-mono mr-2">#{jersey}</span>}
       {playerTeam}
     </div>
   );
 })()}
 </div>
 ) : (
 <div className="bg-card border border-dashed border-border rounded-xl p-6 text-center">
 <span className="text-3xl mb-2 block">★</span>
 <p className="text-sm text-muted-foreground">{BUDDY_I18N[language].selectPlayer}</p>
 </div>
 )}
 
 {/* Live Stats ΓÇö Variant A: compact sections with colored left borders */}
 {favPlayer && (() => {
   const defaultStats = {
     blocks: 0, aces: 0, attacks: 0, errors: 0, points: 0,
     serve: { sum: 0, error: 0, ace: 0 },
     reception: { sum: 0, error: 0, positive: 0, perfect: 0 },
     attack: { sum: 0, error: 0, blocked: 0, kill: 0 },
     block: { pts: 0, touchPlus: 0 },
     dig: 0, assist: 0, bp: 0,
   };
   const s = playerStats[favPlayer] || defaultStats;
   
   // Calculated percentages
   const serveEff = s.serve.sum > 0 ? Math.round((s.serve.ace / s.serve.sum) * 100) : 0;
   const recPosRate = s.reception.sum > 0 ? Math.round((s.reception.positive / s.reception.sum) * 100) : 0;
   const recPerfRate = s.reception.sum > 0 ? Math.round((s.reception.perfect / s.reception.sum) * 100) : 0;
   const killRate = s.attack.sum > 0 ? Math.round((s.attack.kill / s.attack.sum) * 100) : 0;
   const attackEff = s.attack.sum > 0 ? Math.round(((s.attack.kill - s.attack.error - s.attack.blocked) / s.attack.sum) * 100) : 0;
   
   const StatSection = ({ title, color, children }: { title: string; color: string; children: React.ReactNode }) => {
     const borderColors: Record<string, string> = {
       green: 'border-green-500/40', blue: 'border-blue-500/40', yellow: 'border-yellow-500/40',
       red: 'border-red-500/40', purple: 'border-purple-500/40', slate: 'border-slate-500/40',
     };
     const titleColors: Record<string, string> = {
       green: 'text-green-400', blue: 'text-blue-400', yellow: 'text-yellow-400',
       red: 'text-red-400', purple: 'text-purple-400', slate: 'text-slate-400',
     };
     return (
       <div className={`border-l-2 ${borderColors[color]} pl-3 py-1`}>
         <div className={`text-[10px] font-bold uppercase tracking-wider ${titleColors[color]} mb-1`}>{title}</div>
         <div className="flex gap-3 flex-wrap">{children}</div>
       </div>
     );
   };
   
   const StatCell = ({ label, value, highlight = false }: { label: string; value: string | number; highlight?: boolean }) => (
     <div className="text-center min-w-[32px]">
       <div className="text-[9px] text-muted-foreground/60 uppercase">{label}</div>
       <div className={`text-sm font-bold ${highlight ? 'text-foreground' : 'text-muted-foreground'}`}>{value}</div>
     </div>
   );
   
   return (
     <div className="bg-card border border-border rounded-xl p-4">
       <h4 className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-3">{BUDDY_I18N[language].statsTitle}</h4>
       <div className="space-y-2.5">
         <StatSection title={BUDDY_I18N[language].points} color="green">
           <StatCell label="Sum" value={s.points} highlight />
           <StatCell label="BP" value={s.bp} />
           <StatCell label="Ratio" value={s.points} />
         </StatSection>
         
         <StatSection title={BUDDY_I18N[language].serve} color="blue">
           <StatCell label="Sum" value={s.serve.sum} />
           <StatCell label="Err" value={s.serve.error} />
           <StatCell label="Ace" value={s.serve.ace} highlight />
           <StatCell label="Eff%" value={`${serveEff}%`} />
         </StatSection>
         
         <StatSection title={BUDDY_I18N[language].reception} color="yellow">
           <StatCell label="Sum" value={s.reception.sum} />
           <StatCell label="Err" value={s.reception.error} />
           <StatCell label="Pos%" value={`${recPosRate}%`} />
           <StatCell label="Perf%" value={`${recPerfRate}%`} />
         </StatSection>
         
         <StatSection title={BUDDY_I18N[language].attack} color="red">
           <StatCell label="Sum" value={s.attack.sum} />
           <StatCell label="Err" value={s.attack.error} />
           <StatCell label="Blk" value={s.attack.blocked} />
           <StatCell label="Kill" value={s.attack.kill} highlight />
           <StatCell label="K%" value={`${killRate}%`} />
           <StatCell label="Eff%" value={`${attackEff}%`} />
         </StatSection>
         
         <StatSection title={BUDDY_I18N[language].block} color="purple">
           <StatCell label="Pts" value={s.block.pts} highlight />
           <StatCell label="Touch+" value={s.block.touchPlus} />
         </StatSection>
         
         <StatSection title={BUDDY_I18N[language].other} color="slate">
           <StatCell label="Dig" value={s.dig} />
           <StatCell label="Assist" value={s.assist} />
         </StatSection>
       </div>
     </div>
   );
 })()}
 
 {/* Expert Knowledge Panel - RAG player profiles from Pinecone */}
 {favPlayer && (
   <div className="bg-card border border-border rounded-xl p-4">
     <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">
       {BUDDY_I18N[language].expertTitle}
     </h4>
     
     {isLoadingProfile ? (
       <div className="flex items-center gap-2 text-xs text-muted-foreground">
         <span className="animate-pulse">{"⏳"}</span>
         <span>{BUDDY_I18N[language].loading}</span>
       </div>
     ) : playerProfile?.found && playerProfile.summary ? (
       <div className="space-y-2">
         {/* GPT-generated structured summary (translated if non-PL) */}
         <div className="text-sm text-foreground whitespace-pre-line leading-relaxed">
           {translatedProfileSummary || playerProfile.summary}
         </div>
         
         {/* RAG confidence indicator */}
         {playerProfile.chunks && playerProfile.chunks.length > 0 && (
           <div className="mt-3 pt-2 border-t border-border">
             <div className="flex items-center gap-1 text-xs text-muted-foreground">
               <span>{"📚"}</span>
               <span>{playerProfile.chunks.length} {playerProfile.chunks.length === 1 ? BUDDY_I18N[language].source1 : playerProfile.chunks.length < 5 ? BUDDY_I18N[language].sources24 : BUDDY_I18N[language].sources}</span>
               <span className="ml-auto text-xs">
                 {playerProfile.chunks[0]?.score > 0.7 ? `★ ${BUDDY_I18N[language].highRelevance}` : 
                  playerProfile.chunks[0]?.score > 0.5 ? `☆ ${BUDDY_I18N[language].medRelevance}` : ''}
               </span>
             </div>
           </div>
         )}
       </div>
     ) : playerProfile?.found === false ? (
       <div className="text-xs text-muted-foreground italic">
         <span className="block mb-1">{"🔌"} {BUDDY_I18N[language].noProfile}</span>
         <span>{BUDDY_I18N[language].addProfile.replace('{player}', favPlayer)}</span>
       </div>
     ) : (
       <p className="text-xs text-muted-foreground italic">
         {BUDDY_I18N[language].profilePending}
       </p>
     )}
   </div>
 )}
 
 </div>
 </div>
 {/* END RIGHT 1/3 */}
 
 </div>
 {/* END FLEX CONTAINER */}
 </div>
 {/* END max-w-7xl */}
 </div>
 {/* END SCROLLABLE CONTENT */}

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