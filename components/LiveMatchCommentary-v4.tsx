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
 homeFullName?: string;
 awayFullName?: string;
 };
 rallies: Rally[];
 lineups?: SetLineup[];
 playerPositions?: Record<string, string>;
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
 ragDebug?: Array<{
   namespace: string;
   query: string;
   topScore: number;
   retrieved: number;
   used: boolean;
   preview: string;
 }>;
 // LINEUP CARD DATA (only when type === 'lineup')
 lineupData?: SetLineup;
 // SET SUMMARY DATA (only when type === 'set_summary')
 summaryData?: {
   setNumber: number;
   finalScore: { home: number; away: number };
   winner: string;
   topScorers: Array<{ player: string; points: number }>;
   totalRallies: number;
   narrative?: string;
   originalNarrative?: string;
 };
 // MATCH SUMMARY DATA (only when type === 'match_summary')
 matchSummaryData?: {
   matchScore: { home: number; away: number };
   setResults: Array<{ setNumber: number; homeScore: number; awayScore: number; homeWon: boolean }>;
   topScorers: Array<{ player: string; points: number; team: 'home' | 'away' }>;
   totalRallies: number;
   winner: string;
   narrative?: string;
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
   setEnd: 'Koniec seta', setWinner: 'Wygrywa', topScorers: 'TOP punktujący', pts: 'pkt', matchEnd: 'KONIEC MECZU', matchWinner: 'Zwycięzca', mvpTitle: 'MVP meczu',
 
   homeLabel: 'GOSPODARZE', awayLabel: 'GOŚCIE', liveStream: 'TRANSMISJA NA ŻYWO', commentaryCount: 'komentarzy', newest: '↓ Najnowsze', chronological: '↑ Chronologicznie', seasonVsMatch: 'Ten mecz vs sezon', thisMatch: 'ten mecz', seasonAvg: 'śr. sezonu', last5: 'punkty w ostatnich 5 meczach sezonu', fullProfile: 'pełny profil sezonu →', singleView: 'Jeden', splitView: 'Podzielony', legend: 'Legenda',
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
   setEnd: 'End of set', setWinner: 'Winner', topScorers: 'TOP scorers', pts: 'pts', matchEnd: 'MATCH OVER', matchWinner: 'Winner', mvpTitle: 'Match MVP',
 
   homeLabel: 'HOME', awayLabel: 'AWAY', liveStream: 'LIVE BROADCAST', commentaryCount: 'comments', newest: '↓ Latest', chronological: '↑ Chronological', seasonVsMatch: 'This match vs season', thisMatch: 'this match', seasonAvg: 'season avg.', last5: 'points in last 5 matches', fullProfile: 'full season profile →', singleView: 'Single', splitView: 'Split', legend: 'Legend',
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
   setEnd: 'Fine del set', setWinner: 'Vince', topScorers: 'TOP marcatori', pts: 'pt', matchEnd: 'FINE PARTITA', matchWinner: 'Vincitore', mvpTitle: 'MVP della partita',
 
   homeLabel: 'CASA', awayLabel: 'OSPITI', liveStream: 'DIRETTA', commentaryCount: 'commenti', newest: '↓ Recenti', chronological: '↑ Cronologico', seasonVsMatch: 'Questa partita vs stagione', thisMatch: 'questa partita', seasonAvg: 'media stag.', last5: 'punti nelle ultime 5 partite', fullProfile: 'profilo stagione →', singleView: 'Singolo', splitView: 'Diviso', legend: 'Legenda',
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
   setEnd: 'Satzende', setWinner: 'Sieger', topScorers: 'TOP Scorer', pts: 'Pkt', matchEnd: 'SPIELENDE', matchWinner: 'Sieger', mvpTitle: 'Spieler des Spiels',
 
   homeLabel: 'HEIM', awayLabel: 'GAST', liveStream: 'LIVE-ÜBERTRAGUNG', commentaryCount: 'Kommentare', newest: '↓ Neueste', chronological: '↑ Chronologisch', seasonVsMatch: 'Dieses Spiel vs Saison', thisMatch: 'dieses Spiel', seasonAvg: 'Saison-Ø', last5: 'Punkte in letzten 5 Spielen', fullProfile: 'vollst. Saisonprofil →', singleView: 'Einzeln', splitView: 'Geteilt', legend: 'Legende',
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
   setEnd: 'Set sonu', setWinner: 'Kazanan', topScorers: 'En iyi skorer', pts: 'puan', matchEnd: 'MAÇ SONU', matchWinner: 'Kazanan', mvpTitle: 'Maçın MVP\'si',
 
   homeLabel: 'EV SAHİBİ', awayLabel: 'MİSAFİR', liveStream: 'CANLI YAYIN', commentaryCount: 'yorum', newest: '↓ En yeni', chronological: '↑ Kronolojik', seasonVsMatch: 'Bu maç vs sezon', thisMatch: 'bu maç', seasonAvg: 'sezon ort.', last5: 'son 5 maçta puan', fullProfile: 'tam sezon profili →', singleView: 'Tekli', splitView: 'Bölünmüş', legend: 'Açıklama',
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
   setEnd: 'Fin del set', setWinner: 'Gana', topScorers: 'TOP anotadores', pts: 'pts', matchEnd: 'FIN DEL PARTIDO', matchWinner: 'Ganador', mvpTitle: 'MVP del partido',
 
   homeLabel: 'LOCAL', awayLabel: 'VISITANTE', liveStream: 'EN VIVO', commentaryCount: 'comentarios', newest: '↓ Más reciente', chronological: '↑ Cronológico', seasonVsMatch: 'Este partido vs temporada', thisMatch: 'este partido', seasonAvg: 'prom. temp.', last5: 'puntos en los últimos 5 partidos', fullProfile: 'perfil completo →', singleView: 'Único', splitView: 'Dividido', legend: 'Leyenda',
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
   setEnd: 'Fim do set', setWinner: 'Vence', topScorers: 'TOP pontuadores', pts: 'pts', matchEnd: 'FIM DO JOGO', matchWinner: 'Vencedor', mvpTitle: 'MVP da partida',
 
   homeLabel: 'MANDANTE', awayLabel: 'VISITANTE', liveStream: 'AO VIVO', commentaryCount: 'comentários', newest: '↓ Mais recente', chronological: '↑ Cronológico', seasonVsMatch: 'Este jogo vs temporada', thisMatch: 'este jogo', seasonAvg: 'méd. temp.', last5: 'pontos nos últimos 5 jogos', fullProfile: 'perfil completo →', singleView: 'Único', splitView: 'Dividido', legend: 'Legenda',
 },
 jp: {
   statsTitle: '試合統計', points: 'ポイント', serve: 'サーブ',
   reception: 'レセプション', attack: 'アタック', block: 'ブロック', other: 'その他',
   expertTitle: '専門知識', loading: '選手プロフィール読込中...',
   noProfile: 'プロフィールなし',
   addProfile: '{player}の情報を追加',
   profilePending: '専門情報まもなく...',
   selectPlayer: 'BUDDYパネルを有効にする選手を選択',
   sources: 'ソース', source1: 'ソース', sources24: 'ソース',
   highRelevance: '高関連性', medRelevance: '中関連性',
   setEnd: 'セット終了', setWinner: '勝者', topScorers: 'TOP得点者', pts: '点', matchEnd: '試合終了', matchWinner: '優勝', mvpTitle: '試合のMVP',
 
   homeLabel: 'ホーム', awayLabel: 'アウェイ', liveStream: 'ライブ配信', commentaryCount: 'コメント', newest: '↓ 最新', chronological: '↑ 時系列', seasonVsMatch: '今試合 vs シーズン', thisMatch: '今試合', seasonAvg: 'シーズン平均', last5: '直近5試合の得点', fullProfile: 'フルプロフィール →', singleView: '単一', splitView: '分割', legend: '凡例',
 },
};

// Unified yellow tags a" readable on dark backgrounds
const TAG_LABELS_I18N: Record<Language, Record<string, string>> = {
 pl: { '#seria': '#seria', '#comeback': '#comeback', '#przelamanie': '#przełamanie',
       '#drama': '#drama', '#dluga_wymiana': '#długa wymiana', '#milestone': '#milestone',
       '#debiut': '#debiut', '#zmiana': '#zmiana', '#koniec_seta': '#koniec seta' },
 en: { '#seria': '#run', '#comeback': '#comeback', '#przelamanie': '#break',
       '#drama': '#drama', '#dluga_wymiana': '#long rally', '#milestone': '#milestone',
       '#debiut': '#debut', '#zmiana': '#sub', '#koniec_seta': '#set over' },
 it: { '#seria': '#serie', '#comeback': '#rimonta', '#przelamanie': '#break',
       '#drama': '#tensione', '#dluga_wymiana': '#lungo scambio', '#milestone': '#traguardo',
       '#debiut': '#debutto', '#zmiana': '#cambio', '#koniec_seta': '#fine set' },
 de: { '#seria': '#Serie', '#comeback': '#Aufholjagd', '#przelamanie': '#Break',
       '#drama': '#Spannung', '#dluga_wymiana': '#langer Ballwechsel', '#milestone': '#Meilenstein',
       '#debiut': '#Debut', '#zmiana': '#Wechsel', '#koniec_seta': '#Satzende' },
 tr: { '#seria': '#seri', '#comeback': '#geri dönüş', '#przelamanie': '#kırılma',
       '#drama': '#heyecan', '#dluga_wymiana': '#uzun rally', '#milestone': '#kilometre taşı',
       '#debiut': '#debut', '#zmiana': '#değişiklik', '#koniec_seta': '#set sonu' },
 es: { '#seria': '#racha', '#comeback': '#remontada', '#przelamanie': '#break',
       '#drama': '#drama', '#dluga_wymiana': '#intercambio largo', '#milestone': '#hito',
       '#debiut': '#debut', '#zmiana': '#cambio', '#koniec_seta': '#fin del set' },
 pt: { '#seria': '#sequência', '#comeback': '#virada', '#przelamanie': '#break',
       '#drama': '#drama', '#dluga_wymiana': '#rally longo', '#milestone': '#marco',
       '#debiut': '#estreia', '#zmiana': '#substituição', '#koniec_seta': '#fim do set' },
 jp: { '#seria': '#連続得点', '#comeback': '#カムバック', '#przelamanie': '#ブレーク',
       '#drama': '#ドラマ', '#dluga_wymiana': '#長いラリー', '#milestone': '#記録',
       '#debiut': '#デビュー', '#zmiana': '#選手交代', '#koniec_seta': '#セット終了' },
};
// Helper: get tag label for current language
const getTagLabel = (tag: string, lang: Language): string => {
 return TAG_LABELS_I18N[lang]?.[tag] || TAG_LABELS_I18N.pl[tag] || tag;
};
// Legacy alias (used in TAG_CLR)
const TAG_LABELS = TAG_LABELS_I18N.pl;

// Action labels i18n (for rally headers)
const ACTION_I18N: Record<Language, Record<string, string>> = {
 pl: { 'Blad serwisu': 'Błąd serwisu', 'Przyjecie error': 'Błąd przyjęcia', 'Blad ataku': 'Błąd ataku',
       'As serwisowy': 'As serwisowy', 'Atak': 'Atak', 'Blok': 'Blok', 'Atak skuteczny': 'Atak' },
 en: { 'Blad serwisu': 'Serve error', 'Przyjecie error': 'Reception error', 'Blad ataku': 'Attack error',
       'As serwisowy': 'Service ace', 'Atak': 'Attack', 'Blok': 'Block', 'Atak skuteczny': 'Kill' },
 it: { 'Blad serwisu': 'Errore al servizio', 'Przyjecie error': 'Errore in ricezione', 'Blad ataku': 'Errore in attacco',
       'As serwisowy': 'Ace', 'Atak': 'Attacco', 'Blok': 'Muro', 'Atak skuteczny': 'Schiacciata' },
 de: { 'Blad serwisu': 'Aufschlagfehler', 'Przyjecie error': 'Annahmefehler', 'Blad ataku': 'Angriffsfehler',
       'As serwisowy': 'Aufschlag-Ass', 'Atak': 'Angriff', 'Blok': 'Block', 'Atak skuteczny': 'Angriff' },
 tr: { 'Blad serwisu': 'Servis hatası', 'Przyjecie error': 'Kabul hatası', 'Blad ataku': 'Hücum hatası',
       'As serwisowy': 'Servis ace', 'Atak': 'Hücum', 'Blok': 'Blok', 'Atak skuteczny': 'Hücum' },
 es: { 'Blad serwisu': 'Error en el saque', 'Przyjecie error': 'Error en recepción', 'Blad ataku': 'Error en ataque',
       'As serwisowy': 'Ace', 'Atak': 'Ataque', 'Blok': 'Bloqueo', 'Atak skuteczny': 'Remate' },
 pt: { 'Blad serwisu': 'Erro no saque', 'Przyjecie error': 'Erro na recepção', 'Blad ataku': 'Erro no ataque',
       'As serwisowy': 'Ace', 'Atak': 'Ataque', 'Blok': 'Bloqueio', 'Atak skuteczny': 'Cortada' },
 jp: { 'Blad serwisu': 'サービスミス', 'Przyjecie error': 'レセプションミス', 'Blad ataku': 'アタックミス',
       'As serwisowy': 'サービスエース', 'Atak': 'アタック', 'Blok': 'ブロック', 'Atak skuteczny': 'スパイク' },
};
const getActionLabel = (action: string, lang: Language): string => {
 return ACTION_I18N[lang]?.[action] || ACTION_I18N.en[action] || action;
};

const TEAM_FULL_NAMES: Record<string, string> = {
 'zaw': 'Aluron CMC Warta Zawiercie',
 'lbn': 'BOGDANKA LUK Lublin',
 'pge': 'PGE Projekt Warszawa',
 'ind': 'Indykpol AZS Olsztyn',
 'jsw': 'JSW Jastrzębski Węgiel',
 'ass': 'Asseco Resovia Rzeszów',
 'aluron': 'Aluron CMC Warta Zawiercie',
 'bogdanka': 'BOGDANKA LUK Lublin',
};

// Normalize team names from VolleyStation JSON (may have encoding issues or missing diacritics)
const TEAM_NAME_FIXES: Record<string, string> = {
 'Jastrzebski Wegiel': 'JSW Jastrzębski Węgiel',
 'JSW Jastrzebski Wegiel': 'JSW Jastrzębski Węgiel',
 'JSW Jastrzebski Węgiel': 'JSW Jastrzębski Węgiel',
 'Asseco Resovia Rzeszow': 'Asseco Resovia Rzeszów',
 'Asseco Resovia Rzeszów': 'Asseco Resovia Rzeszów',
 // Fix Polish genitive form leaking from VolleyStation JSON
 'BOGDANKI LUK Lublin': 'BOGDANKA LUK Lublin',
 'Bogdanki LUK Lublin': 'Bogdanka LUK Lublin',
};

function normalizeTeamName(raw: string): string {
 if (!raw) return raw;
 // Fix common UTF-8 encoding artifacts (Ã³ → ó, Ä™ → ę, etc.)
 let fixed = raw
   .replace(/Ã³/g, 'ó').replace(/Ã\u00b3/g, 'ó')
   .replace(/Ä™/g, 'ę').replace(/Ä\u0099/g, 'ę')
   .replace(/Å„/g, 'ń').replace(/Å\u0084/g, 'ń')
   .replace(/Å›/g, 'ś').replace(/Å\u009b/g, 'ś')
   .replace(/Å¼/g, 'ż').replace(/Å\u00bc/g, 'ż')
   .replace(/Å‚/g, 'ł').replace(/Å\u0082/g, 'ł')
   .replace(/Ä‡/g, 'ć').replace(/Ä\u0087/g, 'ć')
   .replace(/Äa/g, 'ą').replace(/Ä\u0085/g, 'ą');
 // Fix Polish genitive leaking from VolleyStation (e.g. "BOGDANKI" → "BOGDANKA")
 fixed = fixed.replace(/BOGDANKI/g, 'BOGDANKA').replace(/Bogdanki/g, 'Bogdanka');
 // Apply known fixes
 return TEAM_NAME_FIXES[fixed] || fixed;
}

// ============================================================================
// PLAYER DISPLAY NAMES — applied at parser level so correct everywhere
// Maps raw VolleyStation names → proper display names
// Add new mappings here when needed — affects touches, lineup, buddy, intro, TTS
// ============================================================================
const PLAYER_DISPLAY_NAMES: Record<string, string> = {
  'Leon Venero': 'Leon',
  'Venero Leon': 'Leon',
  'Tavares Rodrigues': 'Tavares',
  'Rodrigues Tavares': 'Tavares',
};

/** Clean + normalize player name from VolleyStation JSON */
function normalizePlayerName(rawName: string): string {
  // Step 1: Remove extra info after comma ("Leon Venero, Wilfredo" → "Leon Venero")
  const cleaned = rawName.includes(',') ? rawName.split(',')[0].trim() : rawName.trim();
  // Step 2: Apply display name mapping
  return PLAYER_DISPLAY_NAMES[cleaned] || cleaned;
}

export default function LiveMatchCommentaryV4() {
 const [matchData, setMatchData] = useState<MatchData | null>(null);
 const [rallies, setRallies] = useState<Rally[]>([]);
 const [commentaries, setCommentaries] = useState<CommentaryEntry[]>([]);
 const [currentRallyIndex, setCurrentRallyIndex] = useState(0);
 const [isPlaying, setIsPlaying] = useState(false);
 const [currentSetNumber, setCurrentSetNumber] = useState(0);
 const [isGenerating, setIsGenerating] = useState(false);
 const [speed, setSpeed] = useState(3000);
 const [language, setLanguage] = useState<Language>('pl');
 // Ref to always have current language in async closures (fixes stale closure bug)
 const languageRef = useRef<Language>('pl');
 useEffect(() => { languageRef.current = language; }, [language]);
 const [mode, setMode] = useState<Mode>('demo');
 const commentaryRef = useRef<HTMLDivElement>(null);
 const headerRef = useRef<HTMLDivElement>(null);
 const [headerHeight, setHeaderHeight] = useState(0);
 const [isRetranslating, setIsRetranslating] = useState(false);
 const [selectedMatch, setSelectedMatch] = useState(() => {
   if (typeof window !== 'undefined') return localStorage.getItem('vi_selected_match') || '2025-11-12_ZAW-LBN.json';
   return '2025-11-12_ZAW-LBN.json';
 });
 const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
 const [openTagPopup, setOpenTagPopup] = useState<string | null>(null);
 const [favPlayer, setFavPlayer] = useState<string | null>(null);
 const [openFavPopup, setOpenFavPopup] = useState<number | null>(null);
 const [openRagDebug, setOpenRagDebug] = useState<number | null>(null);
 // TTS State
 const [ttsAutoPlay, setTtsAutoPlay] = useState(false);
 const [ttsPlaying, setTtsPlaying] = useState<number | null>(null); // rallyNumber currently playing
 const ttsAudioRef = useRef<HTMLAudioElement | null>(null);
 // Audit State
 const [auditResult, setAuditResult] = useState<any>(null);
 const [isAuditing, setIsAuditing] = useState(false);
 const [playerProfile, setPlayerProfile] = useState<{
   found: boolean;
   summary: string;
   profile: { name: string; team: string; position: string; nationality: string; content: string } | null;
   chunks: Array<{ content: string; category: string; score: number }>;
 } | null>(null);
 const [isLoadingProfile, setIsLoadingProfile] = useState(false);
 const [translatedProfileSummary, setTranslatedProfileSummary] = useState<string | null>(null);

 const [seasonStats, setSeasonStats] = useState<Record<string, { found: boolean; avgPoints?: number; avgBlocks?: number; avgAces?: number; avgAttackPct?: number; avgRecPct?: number; avgDigs?: number; last5?: number[]; trend?: string; id?: string }>>({});

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
 
 // ── Sync state to localStorage for Cockpit ──────────────────────────────────
 useEffect(() => {
   if (typeof window === 'undefined') return;
   const currentRally = rallies[currentRallyIndex - 1] as any;
   localStorage.setItem('vi_current_set', String(currentSetNumber || 1));
   localStorage.setItem('vi_current_score_home', String(currentRally?.score_after?.home ?? 0));
   localStorage.setItem('vi_current_score_away', String(currentRally?.score_after?.away ?? 0));
 }, [currentSetNumber, currentRallyIndex, rallies]);

 useEffect(() => {
   if (typeof window !== 'undefined') localStorage.setItem('vi_language', language);
 }, [language]);

 // Dynamic team name helpers — prefer JSON full names, fallback to TEAM_FULL_NAMES map
 const getHomeTeamFull = () => matchData?.teams?.homeFullName || TEAM_FULL_NAMES[matchData?.teams?.home || ''] || matchData?.teams?.home || 'Gospodarze';
 const getAwayTeamFull = () => matchData?.teams?.awayFullName || TEAM_FULL_NAMES[matchData?.teams?.away || ''] || matchData?.teams?.away || 'Goscie';
 
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

 // Extract FULL team names from Team Name labels (e.g. "Aluron CMC Warta Zawiercie")
 let homeTeamFullName = '';
 let awayTeamFullName = '';
 for (const inst of instances) {
   const labels = inst.labels || {};
   const teamName = labels['Team Name'];
   if (!teamName || teamName === 'All') continue;
   if (labels['Team'] === 'Home' && !homeTeamFullName) homeTeamFullName = teamName;
   else if (labels['Team'] === 'Away' && !awayTeamFullName) awayTeamFullName = teamName;
   if (homeTeamFullName && awayTeamFullName) break;
 }
 // Normalize team names (fix encoding issues & missing diacritics from VolleyStation)
 homeTeamFullName = normalizeTeamName(homeTeamFullName);
 awayTeamFullName = normalizeTeamName(awayTeamFullName);
 console.log('Full team names:', { home: homeTeamFullName || 'NOT FOUND', away: awayTeamFullName || 'NOT FOUND' });

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
 
 // C1+C3: Extract rotation numbers for this rally
 const homeRotation = parseInt(rallyLabels[`${homeTeamName.toUpperCase()} Rotation`] || rallyLabels[`${homePrefix} Rotation`] || '0');
 const awayRotation = parseInt(rallyLabels[`${awayTeamName.toUpperCase()} Rotation`] || rallyLabels[`${awayPrefix} Rotation`] || '0');
 
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
 const cleanSubName = (n: string) => normalizePlayerName(n); // normalizePlayerName takes first part before comma → matches lineup names
 events.substitutions.push({
 player_out: cleanSubName(playerNames[0]),
 player_in: cleanSubName(playerNames[1]),
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
 // Use ACTION-SPECIFIC grade (not generic first-non-empty!)
 const gradeMap: Record<string, string> = {
   'Serve': labels['Serve Grade'] || '',
   'Receive': labels['Receive Grade'] || '',
   'Attack': labels['Attack Grade'] || '',
   'Block': labels['Block Grade'] || '',
   'Dig': labels['Dig Grade'] || '',
   'Set': '',
   'Freeball': '',
 };
 const grade = gradeMap[actionType] || labels['Serve Grade'] || labels['Receive Grade'] || 
 labels['Attack Grade'] || labels['Block Grade'] || 
 labels['Dig Grade'] || '';
 
 if (actionType === 'Serve') {
 if (grade === 'Fail') {
 action = 'Blad serwisu';
 } else if (grade === 'Perfect' || grade === 'Ace') {
 action = 'As serwisowy';
 } else {
 action = 'Zagrywka';
 }
 } else if (actionType === 'Receive') {
 if (grade === 'Fail') {
 action = 'Przyjecie error';
 } else if (grade === 'Negative' || grade === 'Poor') {
 action = 'Przyjecie negative';
 } else if (grade === 'Positive' || grade === 'Average') {
 action = 'Przyjecie positive';
 } else if (grade === 'Perfect') {
 action = 'Przyjecie perfect';
 } else {
 action = 'Przyjecie';
 }
 } else if (actionType === 'Set') {
 action = 'Rozegranie';
 } else if (actionType === 'Attack') {
 if (grade === 'Fail') {
 action = 'Blad ataku';
 } else if (grade === 'Incomplete' || grade === 'Blocked') {
 action = 'Atak zablokowany';
 } else if (grade === 'Perfect') {
 action = 'Atak skuteczny';
 } else {
 action = 'Atak';
 }
 } else if (actionType === 'Block') {
 if (grade === 'Fail') {
 action = 'Przebity blok';
 } else if (grade === 'Perfect') {
 action = 'Blok punkt';
 } else {
 action = 'Blok';
 }
 } else if (actionType === 'Dig') {
 action = 'Obrona';
 } else if (actionType === 'Freeball') {
 action = 'Wolna pilka';
 }
 
 if (action && playerName) {
 const cleanPlayerName = normalizePlayerName(playerName);
 
 touches.push({
 action,
 player: cleanPlayerName,
 team,
 actionType: actionType,
 grade: grade || '',
 rallyWon: rallyWon || '',
 phase: labels['Phase'] || '',
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
 
 // Determine rally phase from attack touches
 const attackTouch = touches.find((t: any) => t.actionType === 'Attack');
 const rallyPhase = attackTouch?.phase || touches.find((t: any) => t.phase)?.phase || '';
 
 // Build rally object
 const rally = {
 rally_number: i + 1,
 set_number: setNumber,
 score_before,
 score_after,
 team_scored,
 touches,
 final_action,
 phase: rallyPhase,
 homeRotation,
 awayRotation,
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
       
       // Substitution events: add ONLY player_out (they are the starter leaving)
       // player_in is a substitute — do NOT add them to starting lineup
       if (isSubstitution && Array.isArray(nameRaw)) {
         const jerseys = Array.isArray(jerseyRaw) ? jerseyRaw : [jerseyRaw, ''];
         const playerOut = nameRaw[0]; // index 0 = OUT = original starter
         if (playerOut && !map.has(playerOut) && map.size < 14) {
           map.set(playerOut, String(jerseys[0] || ''));
         }
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
     const cleanName = normalizePlayerName(typeof name === 'string' ? name : String(name));
     firstServer = {
       team: prefix === homePrefix ? 'home' : 'away',
       player: cleanName,
       jersey: typeof jersey === 'string' ? jersey : String(jersey),
     };
   }
   
   // Clean player names
   const cleanLineup = (map: Map<string, string>): LineupPlayer[] => {
     return Array.from(map.entries()).slice(0, 7).map(([name, jersey]) => ({
       name: normalizePlayerName(name),
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

 // ========================================================================
 // PLAYER POSITION INFERENCE from action patterns
 // ========================================================================
 const playerPositions: Record<string, string> = {};
 
 // Step 1: Find setters from Assist counts
 const assistCounts: Record<string, number> = {};
 for (const inst of instances) {
   const assist = inst.labels?.Assist || inst.labels?.['Assist'] || '';
   if (assist) {
     const name = normalizePlayerName(typeof assist === 'string' ? assist : String(assist));
     if (name) assistCounts[name] = (assistCounts[name] || 0) + 1;
   }
 }
 
 // Step 2: Track player action profiles
 const pData: Record<string, { srv: number; rcv: number; atk_L: number; atk_R: number; atk_M: number; atk_B: number; atk_P: number }> = {};
 for (const rally of rallies) {
   for (const touch of (rally.touches || [])) {
     const name = touch.player; // Already normalized by parser
     if (!name) continue;
     if (!pData[name]) pData[name] = { srv: 0, rcv: 0, atk_L: 0, atk_R: 0, atk_M: 0, atk_B: 0, atk_P: 0 };
     
     const at = (touch.actionType || '').toLowerCase();
     const loc = touch.attackLocation || '';
     
     if (at === 'serve') pData[name].srv++;
     else if (at === 'receive') pData[name].rcv++;
     else if (at === 'attack') {
       if (loc === 'Middle') pData[name].atk_M++;
       else if (loc === 'Left Side') pData[name].atk_L++;
       else if (loc === 'Right Side') pData[name].atk_R++;
       else if (loc.includes('Back')) pData[name].atk_B++;
       else if (loc === 'Pipe' || loc.toLowerCase().includes('pipe')) pData[name].atk_P++;
     }
   }
 }
 
 // Step 3: Assign positions
 const setterNames = new Set(Object.entries(assistCounts).filter(([, c]) => c >= 50).map(([n]) => n));
 
 for (const [name, d] of Object.entries(pData)) {
   const totalAtk = d.atk_L + d.atk_R + d.atk_M + d.atk_B + d.atk_P;
   
   // Libero detection FIRST — libero never serves and rarely attacks
   const isLibero = d.rcv > 0 && d.srv === 0 && totalAtk <= 3;
   
   // Check if player is a setter (high assist count) — but not if identified as libero
   const isSetter = !isLibero && setterNames.has(name);
   
   if (isLibero) {
     playerPositions[name] = 'libero';
   } else if (isSetter) {
     playerPositions[name] = 'rozgrywający';
   } else if (d.atk_M >= 5 && d.atk_M > (d.atk_L + d.atk_R + d.atk_B + d.atk_P)) {
     playerPositions[name] = 'środkowy';
   } else if ((d.atk_R + d.atk_B) > (d.atk_L + d.atk_P) && (d.atk_R + d.atk_B) >= 5) {
     playerPositions[name] = 'atakujący';
   } else if (d.rcv >= 3 && (d.atk_L >= 3 || d.atk_P >= 2)) {
     playerPositions[name] = 'przyjmujący';
   } else if (d.rcv > 0 && d.srv === 0) {
     playerPositions[name] = 'libero';
   }
 }
 
 console.log('[POSITIONS]', playerPositions);

 return { 
 rallies,
 teams: {
 home: homeTeamName,
 away: awayTeamName,
 homeFullName: homeTeamFullName || undefined,
 awayFullName: awayTeamFullName || undefined,
 },
 lineups,
 playerPositions
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
 
 // C1+C3: Extract rotation numbers for this rally
 const homeRotation = parseInt(rallyLabels[`${homeTeamName.toUpperCase()} Rotation`] || rallyLabels[`${homePrefix} Rotation`] || '0');
 const awayRotation = parseInt(rallyLabels[`${awayTeamName.toUpperCase()} Rotation`] || rallyLabels[`${awayPrefix} Rotation`] || '0');
 
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
 const cleanSubName = (n: string) => normalizePlayerName(n); // normalizePlayerName takes first part before comma → matches lineup names
 events.substitutions.push({
 player_out: cleanSubName(playerNames[0]),
 player_in: cleanSubName(playerNames[1]),
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
 // Use ACTION-SPECIFIC grade (not generic first-non-empty!)
 const gradeMap2: Record<string, string> = {
   'Serve': labels['Serve Grade'] || '',
   'Receive': labels['Receive Grade'] || '',
   'Attack': labels['Attack Grade'] || '',
   'Block': labels['Block Grade'] || '',
   'Dig': labels['Dig Grade'] || '',
   'Set': '',
   'Freeball': '',
 };
 const grade = gradeMap2[actionType] || labels['Serve Grade'] || labels['Receive Grade'] || 
 labels['Attack Grade'] || labels['Block Grade'] || 
 labels['Dig Grade'] || '';
 
 if (actionType === 'Serve') {
 if (grade === 'Fail') {
 action = 'Blad serwisu';
 } else if (grade === 'Perfect' || grade === 'Ace') {
 action = 'As serwisowy';
 } else {
 action = 'Zagrywka';
 }
 } else if (actionType === 'Receive') {
 if (grade === 'Fail') {
 action = 'Przyjecie error';
 } else if (grade === 'Negative' || grade === 'Poor') {
 action = 'Przyjecie negative';
 } else if (grade === 'Positive' || grade === 'Average') {
 action = 'Przyjecie positive';
 } else if (grade === 'Perfect') {
 action = 'Przyjecie perfect';
 } else {
 action = 'Przyjecie';
 }
 } else if (actionType === 'Set') {
 action = 'Rozegranie';
 } else if (actionType === 'Attack') {
 if (grade === 'Fail') {
 action = 'Blad ataku';
 } else if (grade === 'Incomplete' || grade === 'Blocked') {
 action = 'Atak zablokowany';
 } else if (grade === 'Perfect') {
 action = 'Atak skuteczny';
 } else {
 action = 'Atak';
 }
 } else if (actionType === 'Block') {
 if (grade === 'Fail') {
 action = 'Przebity blok';
 } else if (grade === 'Perfect') {
 action = 'Blok punkt';
 } else {
 action = 'Blok';
 }
 } else if (actionType === 'Dig') {
 action = 'Obrona';
 } else if (actionType === 'Freeball') {
 action = 'Wolna pilka';
 }
 
 if (action && playerName) {
          // Clean + normalize player name
 const cleanPlayerName = normalizePlayerName(playerName);
 
 touches.push({
 action,
 player: cleanPlayerName,
 team,
 actionType: actionType,
 grade: grade || '',
 rallyWon: rallyWon || '',
 phase: labels['Phase'] || '',
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
 
 // Determine rally phase from attack touches
 const attackTouch2 = touches.find((t: any) => t.actionType === 'Attack');
 const rallyPhase2 = attackTouch2?.phase || touches.find((t: any) => t.phase)?.phase || '';
 
 // Build rally object
 const rally = {
 rally_number: rallyNumber++,
 set_number: setNumber,
 score_before,
 score_after,
 team_scored,
 touches,
 final_action,
 phase: rallyPhase2,
 homeRotation,
 awayRotation,
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
 
 // Position inference (simplified for old format - no Assist labels available)
 const playerPositions: Record<string, string> = {};
 const pData2: Record<string, { srv: number; rcv: number; atk_L: number; atk_R: number; atk_M: number; atk_B: number; atk_P: number }> = {};
 for (const rally of rallies) {
   for (const touch of (rally.touches || [])) {
     const name = touch.player;
     if (!name) continue;
     if (!pData2[name]) pData2[name] = { srv: 0, rcv: 0, atk_L: 0, atk_R: 0, atk_M: 0, atk_B: 0, atk_P: 0 };
     const at = (touch.actionType || '').toLowerCase();
     const loc = touch.attackLocation || '';
     if (at === 'serve') pData2[name].srv++;
     else if (at === 'receive') pData2[name].rcv++;
     else if (at === 'attack') {
       if (loc === 'Middle') pData2[name].atk_M++;
       else if (loc === 'Left Side') pData2[name].atk_L++;
       else if (loc === 'Right Side') pData2[name].atk_R++;
       else if (loc.includes('Back')) pData2[name].atk_B++;
       else if (loc === 'Pipe' || loc.toLowerCase().includes('pipe')) pData2[name].atk_P++;
     }
   }
 }
 for (const [name, d] of Object.entries(pData2)) {
   const totalAtk = d.atk_L + d.atk_R + d.atk_M + d.atk_B + d.atk_P;
   const isLibero = d.rcv > 0 && d.srv === 0 && totalAtk <= 3;
   if (isLibero) {
     playerPositions[name] = 'libero';
   } else if (d.atk_M >= 5 && d.atk_M > (d.atk_L + d.atk_R + d.atk_B + d.atk_P)) {
     playerPositions[name] = 'środkowy';
   } else if ((d.atk_R + d.atk_B) > (d.atk_L + d.atk_P) && (d.atk_R + d.atk_B) >= 5) {
     playerPositions[name] = 'atakujący';
   } else if (d.rcv >= 3 && (d.atk_L >= 3 || d.atk_P >= 2)) {
     playerPositions[name] = 'przyjmujący';
   } else if (d.rcv > 0 && d.srv === 0) {
     playerPositions[name] = 'libero';
   }
 }
 console.log('[POSITIONS-OLD]', playerPositions);
 
 return { rallies, playerPositions };
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

 // ── FETCH SEASON STATS for leaderboard players ───────────────────────────
 useEffect(() => {
   if (Object.keys(playerStats).length === 0) return;
   // Take top 10 by points from lbEntries - covers all LB categories
   const topNames = Object.entries(playerStats)
     .map(([name, s]) => ({ name, pts: s.points }))
     .sort((a, b) => b.pts - a.pts)
     .slice(0, 10)
     .map(e => e.name);
   const missing = topNames.filter(n => !seasonStats[n]);
   if (missing.length === 0) return;
   fetch(`/api/player-season-stats?names=${encodeURIComponent(missing.join(','))}`)
     .then(r => r.json())
     .then(data => {
       if (data.players) setSeasonStats(prev => ({ ...prev, ...data.players }));
     })
     .catch(() => {});
 }, [Object.keys(playerStats).length, Object.keys(seasonStats).length]);

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
     ...(c.type === 'set_summary' && c.summaryData?.originalNarrative ? {
       summaryData: { ...c.summaryData, narrative: c.summaryData.originalNarrative }
     } : {}),
   })));
   setTranslatedProfileSummary(null);
   return;
 }

 // NEW ARCHITECTURE: commentaries generated natively per language.
 // No Polish original stored → retranslation would corrupt output.
 // Language change requires restart.
 console.log('[RETRANSLATE] Skipping — native arch, no PL source. Restart required.');
 return;
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

 
 // [REMOVED] generateCommentaryInLanguage - dead code, replaced by PL-first pattern in generateCommentary
 
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

 // ========================================================================
 // E1: TEXT-TO-SPEECH
 // ========================================================================
 
 // Returns a Promise that resolves when audio finishes (for sync with rally advancement)
 const playTTS = async (text: string, rallyNumber: number, waitForEnd = false): Promise<void> => {
   // Stop current audio if playing
   if (ttsAudioRef.current) {
     ttsAudioRef.current.pause();
     ttsAudioRef.current = null;
   }
   
   // Toggle off if same rally (manual click only)
   if (!waitForEnd && ttsPlaying === rallyNumber) {
     setTtsPlaying(null);
     return;
   }
   
   setTtsPlaying(rallyNumber);
   
   try {
     const res = await fetch('/api/tts', {
       method: 'POST',
       headers: { 'Content-Type': 'application/json' },
       body: JSON.stringify({ text, language }),
     });
     
     if (!res.ok) {
       console.error('[TTS] API error:', res.status);
       setTtsPlaying(null);
       return;
     }
     
     const data = await res.json();
     if (!data.audioBase64) {
       setTtsPlaying(null);
       return;
     }
     
     // Convert base64 to audio blob and play
     const audioBytes = atob(data.audioBase64);
     const audioArray = new Uint8Array(audioBytes.length);
     for (let i = 0; i < audioBytes.length; i++) {
       audioArray[i] = audioBytes.charCodeAt(i);
     }
     const audioBlob = new Blob([audioArray], { type: 'audio/mp3' });
     const audioUrl = URL.createObjectURL(audioBlob);
     
     const audio = new Audio(audioUrl);
     ttsAudioRef.current = audio;
     
     // Return promise that resolves when audio finishes
     return new Promise<void>((resolve) => {
       audio.onended = () => {
         setTtsPlaying(null);
         URL.revokeObjectURL(audioUrl);
         ttsAudioRef.current = null;
         resolve();
       };
       
       audio.onerror = () => {
         console.error('[TTS] Playback error');
         setTtsPlaying(null);
         URL.revokeObjectURL(audioUrl);
         ttsAudioRef.current = null;
         resolve(); // Resolve anyway so rally advancement continues
       };
       
       audio.play().catch(() => {
         setTtsPlaying(null);
         resolve();
       });
     });
   } catch (err) {
     console.error('[TTS] Error:', err);
     setTtsPlaying(null);
   }
 };

 // ========================================================================
 // GEMINI AUDIT — "Fresh pair of eyes" for commentary quality
 // ========================================================================
 const runAudit = async (setNumber: number) => {
   setIsAuditing(true);
   setAuditResult(null);
   
   // Collect commentaries from this set
   const setCommentaries = commentaries
     .filter(c => c.type !== 'intro' && c.type !== 'set_summary')
     .filter(c => {
       // Find which set this rally belongs to
       const rally = rallies.find(r => r.rally_number === c.rallyNumber);
       return rally?.set_number === setNumber;
     })
     .map(c => ({
       rallyNumber: c.rallyNumber,
       text: c.text,
       score: rallies.find(r => r.rally_number === c.rallyNumber)?.score_after
         ? `${rallies.find(r => r.rally_number === c.rallyNumber)!.score_after.home}:${rallies.find(r => r.rally_number === c.rallyNumber)!.score_after.away}`
         : '',
       teamScored: rallies.find(r => r.rally_number === c.rallyNumber)?.team_scored || '',
       tags: c.tags,
     }));
   
   if (setCommentaries.length === 0) {
     setIsAuditing(false);
     return;
   }
   
   try {
     const res = await fetch('/api/audit', {
       method: 'POST',
       headers: { 'Content-Type': 'application/json' },
       body: JSON.stringify({
         commentaries: setCommentaries,
         homeTeam: getHomeTeamFull(),
         awayTeam: getAwayTeamFull(),
         language,
       }),
     });
     
     if (res.ok) {
       const data = await res.json();
       setAuditResult({ setNumber, ...data });
     } else {
       console.error('[AUDIT] Error:', res.status);
     }
   } catch (err) {
     console.error('[AUDIT] Error:', err);
   }
   setIsAuditing(false);
 };

 const generateCommentary = async (rally: Rally) => {
 try {
 const currentLang = languageRef.current; // Always current, not stale closure
 console.log('Generating commentary for rally #', rally.rally_number, 'directly in', currentLang);
 setIsGenerating(true);
 
 const updatedStats = calculatePlayerStats(rally);
 
 const rallyIndex = rallies.findIndex(r => r.rally_number === rally.rally_number);
 const recentRallies = rallyIndex >= 0 ? rallies.slice(Math.max(0, rallyIndex - 9), rallyIndex + 1) : [];
 
 const rallyAnalysis = analyzeRallyChain(rally);

 // Generate DIRECTLY in target language — no translation step needed
 // Commentary route now has full cultural profiles for all 8 languages
 const data = await fetchWithUTF8('/api/commentary', {
 method: 'POST',
 body: JSON.stringify({ 
 rally, 
 language: currentLang, // Use ref — always current value
 playerStats: updatedStats,
 recentRallies: recentRallies,
 rallyAnalysis: rallyAnalysis,
 homeTeamFullName: getHomeTeamFull(),
 awayTeamFullName: getAwayTeamFull(),
 playerPositions: matchData?.playerPositions || {},
 recentCommentaryTexts: commentaries.filter((c: any) => c.type === 'rally' && c.text && c.text !== '...').slice(-4).map((c: any) => c.text),
 }),
 });

 let finalCommentary = data.commentary || '';
 let finalTags = data.tags || [];
 const polishOriginal = currentLang === 'pl' ? finalCommentary : '';

 setIsGenerating(false);
 console.log('Commentary generated natively in', currentLang, ':', finalCommentary.substring(0, 60));
 
 return {
 commentary: finalCommentary,
 polishOriginal: polishOriginal,
 tags: finalTags,
 originalTags: data.tags || [],
 tagData: data.tagData || {},
 milestones: data.milestones || [],
 icon: data.icon || '', momentumScore: data.momentumScore || 0,
 dramaScore: data.dramaScore || 0,
 ragDebug: data.ragDebug || [],
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
 // Determine serving team (first serve touch in rally)
 const serveTouch = rally.touches.find(t => (t.actionType || '').toLowerCase() === 'serve');
 const servingTeam = serveTouch?.team || '';
 
 rally.touches.forEach(touch => {
 if (!touch.player) return;
 if (!stats[touch.player]) stats[touch.player] = emptyStats();
 const s = stats[touch.player];
 
 const at = (touch.actionType || '').toLowerCase();
 const grade = (touch.grade || '').toLowerCase();
 
 // ============================================================
 // SERVE — Grade: Fail=error, Perfect/Ace=ace
 // ============================================================
 if (at === 'serve') {
   s.serve.sum++;
   if (grade === 'fail') {
     s.serve.error++;
     s.errors++;
   }
   if (grade === 'perfect' || grade === 'ace') {
     s.serve.ace++;
     s.aces++;
   }
 }
 // ============================================================
 // RECEPTION — Grade: Fail=error, Perfect+Positive=pos%, Perfect=perf%
 // ============================================================
 else if (at === 'receive') {
   s.reception.sum++;
   if (grade === 'fail') {
     s.reception.error++;
     s.errors++;
   }
   if (grade === 'positive' || grade === 'perfect') {
     s.reception.positive++;
   }
   if (grade === 'perfect') {
     s.reception.perfect++;
   }
 }
 // ============================================================
 // ATTACK — Grade: Fail=error, Incomplete/Blocked=blocked, Perfect=kill
 // ============================================================
 else if (at === 'attack') {
   s.attack.sum++;
   s.attacks++;
   if (grade === 'fail') {
     s.attack.error++;
     s.errors++;
   }
   if (grade === 'incomplete' || grade === 'blocked') {
     s.attack.blocked++;
   }
   if (grade === 'perfect') {
     s.attack.kill++;
     // BP: kill scored while opponent was serving
     if (touch.team !== servingTeam && servingTeam) {
       s.bp++;
     }
   }
 }
 // ============================================================
 // BLOCK — Grade: Perfect=point, Positive=touch+, Fail=error
 // ============================================================
 else if (at === 'block') {
   if (grade === 'perfect') {
     s.block.pts++;
     s.blocks++;
     // BP: block point scored while opponent was serving
     if (touch.team !== servingTeam && servingTeam) {
       s.bp++;
     }
   } else if (grade === 'positive') {
     s.block.touchPlus++;
   }
 }
 // ============================================================
 // DIG
 // ============================================================
 else if (at === 'dig') {
   s.dig++;
 }
 // ============================================================
 // SET (assist counted below)
 // ============================================================
 else if (at === 'set') {
   // Assist counted separately — only when next attack is a kill
 }
 });
 
 // ============================================================
 // ASSISTS: count sets that led to a kill (attack grade=perfect)
 // ============================================================
 for (let i = 0; i < rally.touches.length - 1; i++) {
   const touch = rally.touches[i];
   const nextTouch = rally.touches[i + 1];
   if ((touch.actionType || '').toLowerCase() === 'set' && touch.player
     && (nextTouch.actionType || '').toLowerCase() === 'attack'
     && (nextTouch.grade || '').toLowerCase() === 'perfect') {
     if (!stats[touch.player]) stats[touch.player] = emptyStats();
     stats[touch.player].assist++;
   }
 }
 });
 
 // ============================================================
 // DERIVED: Points = kill + block.pts + ace (always consistent!)
 // ============================================================
 Object.values(stats).forEach(s => {
   s.points = s.attack.kill + s.block.pts + s.serve.ace;
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
 // INJECT INTRO CARD before the very first rally
 // ========================================================================
 if (currentRallyIndex === 0 && commentaries.length === 0) {
   const homeTeam = getHomeTeamFull();
   const awayTeam = getAwayTeamFull();
   
   // Insert placeholder intro card immediately
   const introEntry: CommentaryEntry = {
     rallyNumber: -999,
     text: '...',
     originalText: '...',
     timestamp: new Date(),
     player: '', team: '', action: '',
     type: 'intro',
     tags: [], originalTags: [], milestones: [], icon: 'MIC',
     momentumScore: 0, dramaScore: 0, tagData: {},
   };
   setCommentaries([introEntry]);
   
   // Fire async GPT call for intro
   (async () => {
     try {
       // Gather real player data to prevent hallucination
       const currentLineup = matchData?.lineups?.find(l => l.setNumber === 1) || matchData?.lineups?.[0];
       const homePlayers = currentLineup?.home?.map(p => p.name) || [];
       const awayPlayers = currentLineup?.away?.map(p => p.name) || [];
       const positions = matchData?.playerPositions || {};
       
       const res = await fetch('/api/intro-commentary', {
         method: 'POST',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify({ 
           homeTeam, 
           awayTeam, 
           language: languageRef.current, // Use ref to avoid stale closure
           homePlayers,
           awayPlayers,
           playerPositions: positions,
         }),
       });
       const data = await res.json();
       if (data.intro) {
         const displayText = data.intro;
         setCommentaries(prev => prev.map(c =>
           c.rallyNumber === -999 && c.type === 'intro'
             ? { ...c, text: displayText, originalText: data.intro }
             : c
         ));
       }
     } catch (err) {
       console.error('[INTRO] API error:', err);
       // Remove placeholder on error
       setCommentaries(prev => prev.filter(c => c.rallyNumber !== -999));
     }
   })();
   
   // Small delay so intro appears before first commentary
   await new Promise(resolve => setTimeout(resolve, 800));
 }
 
 // ========================================================================
 // INJECT LINEUP CARD when entering a new set
 // ========================================================================
 if (rallySetNumber !== currentSetNumber) {
   // If we had a previous set, inject SET SUMMARY first
   if (currentSetNumber > 0) {
     const prevSetRallies = rallies.filter((r: any) => (r.set_number || 1) === currentSetNumber);
     const lastRally = prevSetRallies[prevSetRallies.length - 1];
     if (lastRally) {
       // Calculate top scorers for the set — count kills, blocks, aces per player
       const setScorers: Record<string, number> = {};
       prevSetRallies.forEach((r: any) => {
         r.touches?.forEach((touch: any) => {
           if (!touch.player) return;
           const action = (touch.action || '').toLowerCase();
           const grade = (touch.grade || '').toLowerCase();
           const at = (touch.actionType || '').toLowerCase();
           
           // ACE (serve grade perfect)
           if ((at === 'serve' || action.includes('zagrywka') || action.includes('serwis')) 
             && (action.includes('ace') || grade === 'perfect')) {
             setScorers[touch.player] = (setScorers[touch.player] || 0) + 1;
           }
           // ATTACK KILL (only grade perfect = direct point)
           else if ((at === 'attack' || action.includes('atak'))
             && grade === 'perfect') {
             setScorers[touch.player] = (setScorers[touch.player] || 0) + 1;
           }
           // BLOCK KILL (only grade perfect = direct point)
           else if ((at === 'block' || action.includes('blok'))
             && grade === 'perfect') {
             setScorers[touch.player] = (setScorers[touch.player] || 0) + 1;
           }
         });
       });
       const topScorers = Object.entries(setScorers)
         .sort(([,a], [,b]) => b - a)
         .slice(0, 3)
         .map(([player, points]) => ({ player, points }));
       
       const summaryEntry: CommentaryEntry = {
         rallyNumber: -currentSetNumber - 100, // unique negative ID for summaries
         text: `${BUDDY_I18N[languageRef.current]?.setEnd || 'Set'} ${currentSetNumber} — ${lastRally.score_after.home}:${lastRally.score_after.away}`,
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
           narrative: '...',
         },
       };
       setCommentaries((prev) => [summaryEntry, ...prev]);

       // Fire async API call for GPT narrative
       const summarySetNum = currentSetNumber;
       (async () => {
         try {
           const homeTeam = getHomeTeamFull();
           const awayTeam = getAwayTeamFull();
           const res = await fetch('/api/set-summary', {
             method: 'POST',
             headers: { 'Content-Type': 'application/json' },
             body: JSON.stringify({
               setNumber: summarySetNum,
               finalScore: { home: lastRally.score_after.home, away: lastRally.score_after.away },
               homeTeam,
               awayTeam,
               topScorers,
               rallies: prevSetRallies.map((r: any) => ({
                 rally_number: r.rally_number,
                 team_scored: r.team_scored,
                 score_after: r.score_after,
                 touches: r.touches,
                 final_action: r.final_action,
               })),
               language: languageRef.current, // Use ref to avoid stale closure
             }),
           });
           const data = await res.json();
           if (data.narrative) {
             const displayNarrative = data.narrative;
             const polishNarrative = language === 'pl' ? data.narrative : '';
             
             setCommentaries((prev) => prev.map(c => 
               c.rallyNumber === (-summarySetNum - 100) && c.type === 'set_summary'
                 ? { ...c, summaryData: { ...c.summaryData!, narrative: displayNarrative, originalNarrative: polishNarrative } }
                 : c
             ));
           }
         } catch (err) {
           console.error('[SET-SUMMARY] API error:', err);
         }
       })();
       // Small delay so summary appears before lineup
       await new Promise(resolve => setTimeout(resolve, 500));
     }
   }
   
   // Inject LINEUP CARD for the new set - REMOVED (lineup now in sticky header)
   // Just update current set number
   setCurrentSetNumber(rallySetNumber);
 }

 // PRE-CHECK: Skip rallies without valid touches BEFORE wasting API call
 const preCheckTouch = rally.touches && rally.touches.length > 0 
   ? rally.touches[rally.touches.length - 1] 
   : null;
 
 if (!preCheckTouch || !preCheckTouch.player || !preCheckTouch.action) {
   console.warn(`[SKIP] Rally #${rally.rally_number} missing valid touches!`, {
     touchCount: rally.touches?.length || 0,
     lastTouch: preCheckTouch ? { player: preCheckTouch.player, action: preCheckTouch.action } : 'null',
     score: `${rally.score_after?.home}:${rally.score_after?.away}`,
   });
   // Skip to next rally instead of stopping
   if (currentRallyIndex < rallies.length - 1) {
     setCurrentRallyIndex(currentRallyIndex + 1);
     setTimeout(() => playMatch(), speed);
   } else {
     setIsPlaying(false);
   }
   return;
 }

 const result = await generateCommentary(rally);

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
   
   // Reception error (Przyjecie with Fail grade or error in action)
   if ((finalAction.includes('przyjeci') || finalAction.includes('receive')) && 
       (finalAction.includes('error') || finalAction.includes('fail') || 
        (finalTouch.grade || '').toLowerCase() === 'fail')) {
     return { player: finalTouch.player, action: 'Przyjecie error' };
   }
   
   // Setting error (Rozegranie with Fail grade — e.g. Toniutti botched the set)
   if ((finalAction.includes('rozegran') || finalAction.includes('set') || finalAction.includes('wystaw')) &&
       (finalTouch.grade || '').toLowerCase() === 'fail') {
     return { player: finalTouch.player, action: 'Blad rozegrania' };
   }
   
   // Generic fail on any action = error by that player
   if ((finalTouch.grade || '').toLowerCase() === 'fail') {
     return { player: finalTouch.player, action: 'Blad w grze' };
   }
   
   // Non-scoring action as last touch (Set, Dig, etc.) — look backwards for real action
   if (finalAction.includes('rozegran') || finalAction.includes('wolna') || finalAction.includes('freeball')) {
     for (let i = touches.length - 2; i >= 0; i--) {
       const ta = touches[i].action.toLowerCase();
       if (ta.includes('atak') && !ta.includes('blad') && !ta.includes('zablok')) {
         return { player: touches[i].player, action: 'Atak' };
       }
       if (ta.includes('blok') && !ta.includes('przebity') && !ta.includes('fail')) {
         return { player: touches[i].player, action: 'Blok' };
       }
     }
   }
   
   return { player: finalTouch.player, action: finalTouch.action };
 };
 
 const scoringInfo = findScoringAction(rally);
 
 const newCommentary: CommentaryEntry = {
 rallyNumber: rally.rally_number,
 text: result.commentary,
 originalText: result.polishOriginal || result.commentary,
 timestamp: new Date(),
 player: scoringInfo.player,
 team: rally.team_scored,
 action: scoringInfo.action,
 type: getActionType(scoringInfo.action),
 // NEW FIELDS
 tags: result.tags,
 originalTags: result.originalTags || result.tags,
 tagData: result.tagData || {},
 milestones: result.milestones,
 icon: result.icon,
 momentumScore: result.momentumScore,
 dramaScore: result.dramaScore,
 ragDebug: result.ragDebug || [],
 };

 setCommentaries((prev) => [newCommentary, ...prev]);

 setTimeout(() => {
 if (commentaryRef.current) {
 commentaryRef.current.scrollTop = 0;
 }
 }, 100);

 // RADIO MODE: wait for audio
 if (ttsAutoPlay && newCommentary.text && newCommentary.type !== 'set_summary') {
   await playTTS(newCommentary.text, newCommentary.rallyNumber, true, newCommentary.tags || []);
   await new Promise(resolve => setTimeout(resolve, 800));
 }

 const isLastRally = currentRallyIndex >= rallies.length - 1;

 if (isLastRally) {
   setIsPlaying(false);
   // Calculate match score
   const allSetNums = [...new Set(rallies.map((r: any) => r.set_number || 1))].sort();
   const setResults = allSetNums.map((s: number) => {
     const sRallies = rallies.filter((r: any) => (r.set_number || 1) === s);
     const last = sRallies[sRallies.length - 1];
     const hS = last?.score_after?.home || 0;
     const aS = last?.score_after?.away || 0;
     return { setNumber: s, homeScore: hS, awayScore: aS, homeWon: hS > aS };
   });
   const homeSets = setResults.filter((s: any) => s.homeWon).length;
   const awaySets = setResults.filter((s: any) => !s.homeWon).length;
   // Match-wide top scorers
   const matchScorers: Record<string, { points: number; team: 'home' | 'away' }> = {};
   rallies.forEach((r: any) => {
     r.touches?.forEach((t: any) => {
       if (!t.player) return;
       const g = (t.grade || '').toLowerCase();
       const at = (t.actionType || '').toLowerCase();
       if ((at === 'serve' && g === 'perfect') || (at === 'attack' && g === 'perfect') || (at === 'block' && g === 'perfect')) {
         const team = r.team_scored === 'home' ? 'home' : 'away';
         if (!matchScorers[t.player]) matchScorers[t.player] = { points: 0, team };
         matchScorers[t.player].points++;
       }
     });
   });
   const topMatchScorers = Object.entries(matchScorers).sort(([,a],[,b]) => b.points - a.points).slice(0, 5).map(([player, d]) => ({ player, points: d.points, team: d.team }));
   const homeTeam = getHomeTeamFull(); const awayTeam = getAwayTeamFull();
   const winner = homeSets > awaySets ? homeTeam : awayTeam;
   const matchEntry: CommentaryEntry = {
     rallyNumber: -9999, text: `${winner} — ${homeSets}:${awaySets} ${BUDDY_I18N[languageRef.current]?.matchEnd || 'MATCH OVER'}`,
     originalText: `${winner} wygrywa mecz ${homeSets}:${awaySets}!`,
     timestamp: new Date(), player: '', team: '', action: '',
     type: 'match_summary', tags: ['#koniec_meczu'], originalTags: [], milestones: [],
     icon: 'MATCH_END', momentumScore: 0, dramaScore: 0, tagData: {},
     matchSummaryData: { matchScore: { home: homeSets, away: awaySets }, setResults, topScorers: topMatchScorers, totalRallies: rallies.length, winner, narrative: '...' },
   };
   setCommentaries(prev => [matchEntry, ...prev]);
   (async () => {
     try {
       const res = await fetch('/api/match-summary', { method: 'POST', headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify({ homeTeam, awayTeam, matchScore: { home: homeSets, away: awaySets }, setResults, topScorers: topMatchScorers, totalRallies: rallies.length, language }),
       });
       const data = await res.json();
       if (data.narrative) {
         setCommentaries(prev => prev.map(c => c.rallyNumber === -9999 && c.type === 'match_summary'
           ? { ...c, text: data.narrative, matchSummaryData: { ...c.matchSummaryData!, narrative: data.narrative } } : c));
       }
     } catch (e) { console.error('[MATCH-SUMMARY]', e); }
   })();
   return;
 }

 // Advance to next rally
 if (ttsAutoPlay) {
   setCurrentRallyIndex((prev) => prev + 1);
 } else {
   setTimeout(() => { setCurrentRallyIndex((prev) => prev + 1); }, speed);
 }
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


 // ─── TAG colors for dark theme ───────────────────────────────────────────────
 const TAG_CLR: Record<string, { bg: string; color: string }> = {
   '#seria':         { bg: 'rgba(249,115,22,.15)',  color: '#fb923c' },
   '#comeback':      { bg: 'rgba(6,182,212,.15)',   color: '#22d3ee' },
   '#przelamanie':   { bg: 'rgba(6,182,212,.15)',   color: '#22d3ee' },
   '#drama':         { bg: 'rgba(239,68,68,.15)',   color: '#f87171' },
   '#dluga_wymiana': { bg: 'rgba(168,85,247,.15)',  color: '#c084fc' },
   '#milestone':     { bg: 'rgba(59,130,246,.15)',  color: '#60a5fa' },
   '#debiut':        { bg: 'rgba(16,185,129,.15)',  color: '#34d399' },
   '#zmiana':        { bg: 'rgba(234,179,8,.15)',   color: '#facc15' },
   '#koniec_seta':   { bg: 'rgba(16,185,129,.15)',  color: '#34d399' },
 };

 const POS_CLR: Record<string, string> = {
   'rozgrywający': '#a78bfa', 'setter': '#a78bfa',
   'przyjmujący': '#60a5fa',  'oh': '#60a5fa',
   'atakujący': '#fbbf24',    'op': '#fbbf24',
   'środkowy': '#34d399',     'mb': '#34d399',
   'libero': '#f472b6',
 };

 // Determine set-by-set results for badges
 const setResults: Record<number, { home: number; away: number }> = {};
 rallies.forEach(r => {
   const sn = r.set_number || 1;
   if (!setResults[sn]) setResults[sn] = { home: 0, away: 0 };
   if (r.team_scored === 'home') setResults[sn].home++;
   else if (r.team_scored === 'away') setResults[sn].away++;
 });

 // Player team map
 const playerTeamMap: Record<string, string> = {};
 rallies.forEach(r => r.touches.forEach(t => { if (t.player && t.team) playerTeamMap[t.player] = t.team; }));

 // Current lineup for this set
 const currentLineup = matchData?.lineups?.find(l => l.setNumber === currentSetNumber) || matchData?.lineups?.[0];

 // ── DYNAMIC ACTIVE LINEUP with substitution history ──────────────────────
 // Build: start from lineup, apply all subs up to currentRallyIndex
 interface SubEvent { playerOut: string; playerIn: string; team: 'home'|'away'; scoreHome: number; scoreAway: number; rallyIdx: number; }
 const subHistory: SubEvent[] = [];
 const playedRallies = rallies.slice(0, currentRallyIndex);
 playedRallies.forEach((r: any, idx: number) => {
   if (!r.substitutions) return;
   r.substitutions.forEach((s: any) => {
     subHistory.push({
       playerOut: s.player_out, playerIn: s.player_in,
       team: s.team as 'home'|'away',
       scoreHome: r.score_after?.home ?? 0,
       scoreAway: r.score_after?.away ?? 0,
       rallyIdx: idx,
     });
   });
 });

 // Apply subs to starting lineup
 const startHome = (currentLineup?.home || []).map(p => p.name);
 const startAway = (currentLineup?.away || []).map(p => p.name);
 const activeHome = [...startHome];
 const activeAway = [...startAway];
 subHistory.forEach(s => {
   const arr = s.team === 'home' ? activeHome : activeAway;
   const idx = arr.indexOf(s.playerOut);
   if (idx !== -1) arr[idx] = s.playerIn;
 });

 // Map: who replaced whom (for display)
 const replacedBy: Record<string, string> = {}; // playerOut -> playerIn
 const replacedAt: Record<string, {scoreHome:number; scoreAway:number}> = {};
 subHistory.forEach(s => {
   replacedBy[s.playerOut] = s.playerIn;
   replacedAt[s.playerOut] = { scoreHome: s.scoreHome, scoreAway: s.scoreAway };
 });
 const isSubstitute: Record<string, boolean> = {};
 subHistory.forEach(s => { isSubstitute[s.playerIn] = true; });

 // Leaderboard data
 const lbEntries = Object.entries(playerStats).map(([name, s]) => ({
   name, team: playerTeamMap[name] || '',
   points: s.points, killPct: s.attack.sum > 0 ? Math.round((s.attack.kill / s.attack.sum) * 100) : 0,
   aces: s.serve.ace, blocks: s.block.pts,
   recPct: s.reception.sum >= 3 ? Math.round((s.reception.perfect / s.reception.sum) * 100) : 0,
   recSum: s.reception.sum, recPerfect: s.reception.perfect, digs: s.dig,
   attackSum: s.attack.sum,
 }));
 const enrichLB = (entries: typeof lbEntries) => entries.map(e => {
   const ss = seasonStats[e.name];
   return { ...e, seasonAvg: ss?.avgPoints, last5: ss?.last5, trend: ss?.trend as any, playerId: ss?.id };
 });
 const topScorersLB  = enrichLB([...lbEntries].filter(e => e.points > 0).sort((a, b) => b.points - a.points).slice(0, 3));
 const topAttackLB   = enrichLB([...lbEntries].filter(e => e.attackSum >= 3).sort((a, b) => b.killPct - a.killPct).slice(0, 3));
 const topAcesLB     = enrichLB([...lbEntries].filter(e => e.aces > 0).sort((a, b) => b.aces - a.aces).slice(0, 3));
 const topBlocksLB   = enrichLB([...lbEntries].filter(e => e.blocks > 0).sort((a, b) => b.blocks - a.blocks).slice(0, 3));
 const topRecLB      = enrichLB([...lbEntries].filter(e => e.recSum >= 3).sort((a, b) => b.recPct - a.recPct).slice(0, 3));
 const topDigsLB     = enrichLB([...lbEntries].filter(e => e.digs > 0).sort((a, b) => b.digs - a.digs).slice(0, 3));

 // ─── RIGHT-TAB STATE ─────────────────────────────────────────────────────────
 // (stored as local const since we already have tab state from v3's right side)
 const [rightTab, setRightTab] = useState<'ranking' | 'buddy' | 'set'>('ranking');

 // ─── RANK CARD COMPONENT ─────────────────────────────────────────────────────
 type RankRow = { name: string; team: string; value: number; num?: number; den?: number; seasonAvg?: number; last5?: number[]; trend?: 'up' | 'down' | 'stable'; playerId?: string; };
 const RankCard = ({ title, icon, data, isPercent, barColor, border, avgField }: {
   title: string; icon: string; data: RankRow[]; isPercent: boolean; barColor: string; border: string; avgField?: 'avgPoints' | 'avgAces' | 'avgBlocks' | 'avgAttackPct' | 'avgRecPct' | 'avgDigs';
 }) => {
   if (!data.length) return null;
   const mx = isPercent ? 100 : Math.max(...data.map(d => d.value), 1) + 2;
   return (
     <div style={{ background: 'rgba(255,255,255,.03)', border: `1px solid ${border}`, borderRadius: 14, padding: '10px 12px', marginBottom: 10 }}>
       <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
         <span style={{ fontSize: 13 }}>{icon}</span>
         <span style={{ fontSize: 10, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '.08em' }}>{title}</span>
       </div>
       {data.map((d, i) => {
         const pct   = Math.min((d.value / mx) * 100, 100);
         const lbl   = isPercent && d.num != null ? `${d.value}% (${d.num}/${d.den})` : `${d.value}${isPercent ? '%' : ''}`;
         const ss    = seasonStats[d.name];
         const last5 = ss?.last5 || [];
         const maxL5 = Math.max(...last5, 1);
         const trend = ss?.trend;
         const trendColor  = trend === 'up' ? '#34d399' : trend === 'down' ? '#f87171' : '#94a3b8';
         const trendArrow  = trend === 'up' ? '↑' : trend === 'down' ? '↓' : '→';
         const nameColor   = d.team === 'home' ? '#93c5fd' : '#fcd34d';
         return (
           <div key={d.name} style={{ marginBottom: 10 }}>
             {/* Row 1: rank · name · trend · avg · value */}
             <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
               <span style={{ width: 12, fontSize: 9, fontWeight: 700, color: i === 0 ? '#facc15' : '#64748b', flexShrink: 0 }}>{i + 1}</span>
               <span style={{ fontSize: 12, fontWeight: 700, color: nameColor, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={d.name}>
                 {d.name.split(' ').slice(-1)[0]}
               </span>
               {avgField && ss?.[avgField] != null && (
                 <span style={{ fontSize: 10, color: '#94a3b8', fontFamily: "'JetBrains Mono',monospace", flexShrink: 0 }}>
                   śr.{' '}<span style={{ color: '#cbd5e1', fontWeight: 700 }}>{ss[avgField]}{(avgField === 'avgAttackPct' || avgField === 'avgRecPct') ? '%' : ''}</span>
                 </span>
               )}
               {trend && <span style={{ fontSize: 11, color: trendColor, fontWeight: 800, flexShrink: 0 }}>{trendArrow}</span>}
               <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, color: '#e2e8f0', fontWeight: 700, flexShrink: 0, minWidth: 44, textAlign: 'right' }}>{lbl}</span>
             </div>
             {/* Row 2: sparkline bar + progress bar */}
             <div style={{ display: 'flex', alignItems: 'center', gap: 6, paddingLeft: 18 }}>
               {last5.length > 0 && (
                 <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 16, flexShrink: 0 }}>
                   {last5.map((v, idx) => (
                     <div key={idx} style={{
                       width: 6, borderRadius: 2,
                       height: `${Math.max(3, Math.round((v / maxL5) * 16))}px`,
                       background: idx === last5.length - 1 ? nameColor : 'rgba(255,255,255,.25)',
                     }} />
                   ))}
                 </div>
               )}
               <div style={{ flex: 1, height: 6, borderRadius: 99, overflow: 'hidden', background: 'rgba(255,255,255,.06)' }}>
                 <div style={{ width: `${pct}%`, height: '100%', borderRadius: 99, background: barColor, transition: 'width .7s' }} />
               </div>
               {ss?.id && (
                 <a href={`/player/${ss.id}`} target="_blank" rel="noopener noreferrer"
                   style={{ fontSize: 9, color: '#3b82f6', textDecoration: 'none', flexShrink: 0, opacity: .8 }}>
                   profil →
                 </a>
               )}
             </div>
           </div>
         );
       })}
     </div>
   );
 };

 const ACTION_ICON: Record<string, string> = {
   'ace': '🎯', 'block': '🧱', 'attack': '⚡', 'error': '❌', 'point': '🏐',
 };

 return (
   <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: '#162032', color: '#fff', overflow: 'hidden', fontFamily: "'DM Sans', sans-serif" }}>

     {/* ── TOP BAR ────────────────────────────────────────────────────────────── */}
     <div style={{ flexShrink: 0, background: '#0e1520', borderBottom: '1px solid #0f172a', padding: '5px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', zIndex: 20 }}>
       <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
         <span style={{ fontSize: 13, fontWeight: 700, color: '#475569', letterSpacing: '-.3px' }}>⚡ VolleyInsight</span>
         <div style={{ width: 1, height: 16, background: '#1e293b' }} />
         {/* Match selector */}
         <select
           value={selectedMatch}
           onChange={e => { setSelectedMatch(e.target.value); localStorage.setItem('vi_selected_match', e.target.value); setCommentaries([]); setCurrentRallyIndex(0); setCurrentSetNumber(0); setIsPlaying(false); }}
           style={{ padding: '4px 10px', borderRadius: 7, background: '#1a2740', border: '1px solid rgba(255,255,255,.1)', color: '#e2e8f0', fontSize: 11, fontWeight: 600, cursor: 'pointer', colorScheme: 'dark' as any }}
         >
           <option value="2025-11-12_ZAW-LBN.json" style={{ background: '#1a2740', color: '#e2e8f0' }}>Aluron Zawiercie vs Bogdanka Lublin (12.11)</option>
           <option value="2025-11-26_PGE-Ind.json" style={{ background: '#1a2740', color: '#e2e8f0' }}>PGE Projekt Warszawa vs Indykpol Olsztyn (26.11)</option>
           <option value="2025-12-06_JSW-Ass.json" style={{ background: '#1a2740', color: '#e2e8f0' }}>Jastrzębski Węgiel vs Asseco Rzeszów (06.12)</option>
         </select>
         {/* Live indicator */}
         <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '3px 8px', background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.2)', borderRadius: 6 }}>
           <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#ef4444', display: 'inline-block', animation: 'pulse 1.5s infinite' }} />
           <span style={{ fontSize: 9, color: '#f87171', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.08em' }}>Live</span>
         </div>
         {/* KPI Cockpit link */}
          <button
            onClick={() => window.open('/cockpit', '_blank')}
            style={{ fontSize: 9, fontWeight: 700, color: '#93c5fd', background: 'rgba(59,130,246,.15)', border: '1px solid rgba(59,130,246,.3)', borderRadius: 5, padding: '3px 9px', cursor: 'pointer', letterSpacing: '.05em', display: 'flex', alignItems: 'center', gap: 4 }}
          >
            {'📊 KPIs'}
          </button>
       </div>
       {/* Language switcher */}
       <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
         <span style={{ fontSize: 9, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '.08em', marginRight: 4 }}>Język</span>
         {languages.map(l => (
           <button key={l.code} onClick={() => setLanguage(l.code as Language)}
             style={{ padding: '2px 7px', borderRadius: 5, fontSize: 10, fontWeight: 700, border: 'none', cursor: 'pointer', background: language === l.code ? 'rgba(59,130,246,.2)' : 'transparent', color: language === l.code ? '#93c5fd' : '#94a3b8', outline: language === l.code ? '1px solid rgba(59,130,246,.4)' : 'none' }}>
             {l.code.toUpperCase()}
           </button>
         ))}
       </div>
     </div>

     {/* ── HEADER ─────────────────────────────────────────────────────────────── */}
     <div style={{ flexShrink: 0, background: '#1a2740', borderBottom: '1px solid #0f172a' }}>
       <div style={{ padding: '8px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
         {/* Home */}
         <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1 }}>
           <div style={{ width: 5, height: 32, borderRadius: 99, background: '#3b82f6' }} />
           <img src={getTeamLogo(matchData?.teams?.home || '')} alt="" style={{ width: 32, height: 32, objectFit: 'contain', flexShrink: 0 }} onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
           <div>
             <div style={{ fontSize: 14, fontWeight: 700 }}>{getHomeTeamFull()}</div>
             <div style={{ fontSize: 10, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '.12em' }}>{BUDDY_I18N[language]?.homeLabel || 'GOSPODARZE'}</div>
           </div>
         </div>
         {/* Center: score + controls */}
         <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
           <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 44, fontWeight: 700, color: '#60a5fa' }}>
             {currentRally ? currentRally.score_after.home : 0}
           </span>
           <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
             <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
               <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#ef4444', display: 'inline-block', animation: 'pulse 1.5s infinite' }} />
               <span style={{ fontSize: 9, color: '#f87171', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.08em' }}>Live</span>
             </div>
             <div style={{ fontSize: 10, color: '#94a3b8' }}>Set {currentRally ? (currentRally as any).set_number || 1 : 1}</div>
             {/* Play controls */}
             <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
               <button onClick={handlePlayPause} disabled={isGenerating || !matchData}
                 style={{ padding: '2px 10px', borderRadius: 4, fontSize: 11, fontWeight: 600, border: 'none', cursor: 'pointer',
                   background: isPlaying ? 'rgba(239,68,68,.2)' : 'rgba(16,185,129,.2)',
                   color: isPlaying ? '#f87171' : '#34d399', opacity: !matchData ? .4 : 1 }}>
                 {isPlaying ? '⏸' : currentRallyIndex >= rallies.length ? '↺' : '▶'}
               </button>
               <button onClick={handleReset} disabled={!matchData}
                 style={{ padding: '2px 8px', borderRadius: 4, fontSize: 11, color: '#94a3b8', background: 'transparent', border: 'none', cursor: 'pointer' }}>↺</button>
               {/* Speed */}
               {[{l:'S',v:5000},{l:'N',v:3000},{l:'F',v:1500}].map(opt => (
                 <button key={opt.v} onClick={() => setSpeed(opt.v)}
                   style={{ padding: '1px 6px', borderRadius: 3, fontSize: 9, fontWeight: 700, border: 'none', cursor: 'pointer',
                     background: speed === opt.v ? 'rgba(59,130,246,.3)' : 'rgba(255,255,255,.05)', color: speed === opt.v ? '#93c5fd' : '#94a3b8' }}>
                   {opt.l}
                 </button>
               ))}
               {/* Radio TTS */}
               <button onClick={() => { setTtsAutoPlay(!ttsAutoPlay); if (ttsAutoPlay && ttsAudioRef.current) { ttsAudioRef.current.pause(); ttsAudioRef.current = null; setTtsPlaying(null); } }}
                 style={{ padding: '1px 6px', borderRadius: 3, fontSize: 9, fontWeight: 700, border: 'none', cursor: 'pointer',
                   background: ttsAutoPlay ? 'rgba(16,185,129,.2)' : 'rgba(255,255,255,.05)', color: ttsAutoPlay ? '#34d399' : '#94a3b8' }}>
                 {ttsAutoPlay ? '🔊' : '🔇'}
               </button>
               <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 9, color: '#1e293b' }}>{currentRallyIndex}/{rallies.length}</span>
             </div>
           </div>
           <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 44, fontWeight: 700, color: '#fbbf24' }}>
             {currentRally ? currentRally.score_after.away : 0}
           </span>
         </div>
         {/* Away */}
         <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, justifyContent: 'flex-end' }}>
           <div style={{ textAlign: 'right' }}>
             <div style={{ fontSize: 14, fontWeight: 700 }}>{getAwayTeamFull()}</div>
             <div style={{ fontSize: 10, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '.12em' }}>{BUDDY_I18N[language]?.awayLabel || 'GOŚCIE'}</div>
           </div>
           <img src={getTeamLogo(matchData?.teams?.away || '')} alt="" style={{ width: 32, height: 32, objectFit: 'contain', flexShrink: 0 }} onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
           <div style={{ width: 5, height: 32, borderRadius: 99, background: '#f59e0b' }} />
         </div>
       </div>
       {/* Momentum bar + set badges + progress */}
       <div style={{ padding: '0 16px 6px', display: 'flex', alignItems: 'center', gap: 10 }}>
         {(() => {
           const hp = commentaries.filter(c => c.team === 'home' && c.type !== 'intro' && c.type !== 'set_summary').length;
           const ap = commentaries.filter(c => c.team === 'away' && c.type !== 'intro' && c.type !== 'set_summary').length;
           const tot = hp + ap || 1;
           return <>
             <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 10, color: '#60a5fa', width: 16, textAlign: 'right', flexShrink: 0 }}>{hp}</span>
             <div style={{ flex: 1, height: 4, background: '#1e2d42', borderRadius: 99, overflow: 'hidden' }}>
               <div style={{ height: '100%', background: 'linear-gradient(to right,#1d4ed8,#60a5fa)', borderRadius: 99, width: `${(hp / tot) * 100}%`, transition: 'width .7s' }} />
             </div>
             <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 10, color: '#fbbf24', width: 16, flexShrink: 0 }}>{ap}</span>
           </>;
         })()}
         {/* Set score badges */}
         <div style={{ display: 'flex', gap: 5, marginLeft: 4 }}>
           {Object.entries(setResults).map(([sn, sc]) => {
             const hW = sc.home > sc.away;
             return <span key={sn} style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 9, padding: '1px 5px', borderRadius: 4, background: hW ? 'rgba(59,130,246,.1)' : 'rgba(245,158,11,.1)', color: hW ? '#60a5fa' : '#fbbf24' }}>{sc.home}:{sc.away}</span>;
           })}
         </div>
         {/* Generating indicator */}
         {(isGenerating || isRetranslating) && (
           <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginLeft: 4 }}>
             <div style={{ width: 8, height: 8, borderRadius: '50%', border: '1.5px solid', borderColor: isGenerating ? '#60a5fa transparent' : '#a78bfa transparent', animation: 'spin .8s linear infinite' }} />
             <span style={{ fontSize: 9, color: isGenerating ? '#60a5fa' : '#a78bfa' }}>{isGenerating ? 'AI...' : 'Tłum...'}</span>
           </div>
         )}
       </div>
     </div>

     {/* ── 3-COLUMN BODY ──────────────────────────────────────────────────────── */}
     <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

       {/* LEFT: Lineups */}
       <div style={{ width: 180, flexShrink: 0, borderRight: '1px solid #0f172a', padding: 12, overflowY: 'auto' }}>
         {currentLineup ? (
           <>
             {/* Helper to render one team's lineup */}
             {(['home', 'away'] as const).map(side => {
               const teamColor = side === 'home' ? '#60a5fa' : '#fbbf24';
               const dotColor  = side === 'home' ? '#3b82f6' : '#f59e0b';
               const teamLabel = side === 'home' ? matchData?.teams?.home?.toUpperCase() || 'HOME' : matchData?.teams?.away?.toUpperCase() || 'AWAY';
               const startingPlayers = side === 'home' ? (currentLineup.home || []) : (currentLineup.away || []);
               const activePlayers   = side === 'home' ? activeHome : activeAway;

               // Build full display list: active players + subbed-out players (greyed)
               const subbedOut = startingPlayers.map(p => p.name).filter(n => !activePlayers.includes(n));
               // subs who came in (not in starting lineup)
               const subbedIn  = activePlayers.filter(n => !startingPlayers.map(p => p.name).includes(n));

               return (
                 <div key={side} style={{ marginBottom: 14 }}>
                   <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 7 }}>
                     <div style={{ width: 6, height: 6, borderRadius: '50%', background: dotColor }} />
                     <span style={{ fontSize: 9, fontWeight: 700, color: teamColor, textTransform: 'uppercase', letterSpacing: '.12em' }}>{teamLabel}</span>
                     {subHistory.filter(s => s.team === side).length > 0 && (
                       <span style={{ fontSize: 8, color: '#f59e0b', fontWeight: 700 }}>⇄{subHistory.filter(s => s.team === side).length}</span>
                     )}
                   </div>

                   {/* Starting lineup — each player with inline sub underneath */}
                   {startingPlayers.map(sp => {
                     const name = sp.name;
                     const pos = matchData?.playerPositions?.[name] || '';
                     const isBuddy = favPlayer === name;
                     const subInName = replacedBy[name]; // who replaced this player
                     const subInfo = replacedAt[name];   // at what score
                     const isOnCourt = activePlayers.includes(name); // still playing?
                     const subReturned = subInName && isOnCourt; // original is back

                     // sub who came in — are they still on court?
                     const subIsActive = subInName && activePlayers.includes(subInName);
                     const subIsBuddy = subInName ? favPlayer === subInName : false;

                     const posLabel = pos === 'rozgrywający' ? 'S' : pos === 'przyjmujący' ? 'OH' : pos === 'atakujący' ? 'OP' : pos === 'środkowy' ? 'MB' : pos === 'libero' ? 'L' : '';

                     return (
                       <div key={name} style={{ marginBottom: subInName ? 1 : 2 }}>
                         {/* Original player row */}
                         <button onClick={() => { setFavPlayer(isBuddy ? null : name); if (!isBuddy) setRightTab('buddy'); }}
                           style={{ display: 'flex', alignItems: 'center', gap: 5, width: '100%', padding: '4px 7px', borderRadius: 8, border: 'none', textAlign: 'left', cursor: 'pointer',
                             background: isBuddy ? 'rgba(234,179,8,.1)' : 'transparent',
                             outline: isBuddy ? '1px solid rgba(234,179,8,.3)' : 'none',
                             opacity: !isOnCourt ? 0.75 : 1 }}>
                           <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, color: '#94a3b8', width: 18, textAlign: 'right', flexShrink: 0 }}>
                             {`#${sp.jersey}`}
                           </span>
                           {/* status arrow */}
                           {subReturned && <span style={{ fontSize: 9, color: '#a78bfa', flexShrink: 0 }} title="wrócił na boisko">⇄</span>}
                           {!isOnCourt && subInName && <span style={{ fontSize: 9, color: '#f87171', flexShrink: 0 }}>↓</span>}
                           <span style={{ fontSize: 12, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                             color: isBuddy ? '#fde047' : !isOnCourt ? '#94a3b8' : '#cbd5e1',
                             fontWeight: isBuddy ? 600 : 400,
                             textDecoration: 'none' }}>
                             {name}
                           </span>
                           {posLabel && <span style={{ fontSize: 10, fontWeight: 700, color: POS_CLR[pos] || '#94a3b8', flexShrink: 0 }}>{posLabel}</span>}
                           <span style={{ color: isBuddy ? '#facc15' : '#4b6080', fontSize: 13, flexShrink: 0 }}>{isBuddy ? '★' : '☆'}</span>
                         </button>

                         {/* Sub row — indented, shown only when substitution happened */}
                         {subInName && (
                           <button onClick={() => { setFavPlayer(subIsBuddy ? null : subInName); if (!subIsBuddy) setRightTab('buddy'); }}
                             style={{ display: 'flex', alignItems: 'center', gap: 5, width: '100%', padding: '3px 7px 3px 22px', borderRadius: 8, border: 'none', textAlign: 'left', cursor: 'pointer', marginBottom: 2,
                               background: subIsBuddy ? 'rgba(234,179,8,.1)' : subIsActive ? 'rgba(16,185,129,.06)' : 'transparent',
                               outline: subIsBuddy ? '1px solid rgba(234,179,8,.3)' : subIsActive ? '1px solid rgba(16,185,129,.12)' : 'none',
                               opacity: subIsActive ? 1 : 0.45 }}>
                             <span style={{ fontSize: 9, color: subIsActive ? '#34d399' : '#64748b', flexShrink: 0 }}>
                               {subIsActive ? '↑' : '↕'}
                             </span>
                             <span style={{ fontSize: 11, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                               color: subIsBuddy ? '#fde047' : subIsActive ? '#86efac' : '#64748b' }}>
                               {subInName}
                             </span>
                             {subInfo && <span style={{ fontSize: 8, color: '#475569', flexShrink: 0 }}>{subInfo.scoreHome}:{subInfo.scoreAway}</span>}
                             <span style={{ color: subIsBuddy ? '#facc15' : '#4b6080', fontSize: 13, flexShrink: 0 }}>{subIsBuddy ? '★' : '☆'}</span>
                           </button>
                         )}
                       </div>
                     );
                   })}
                 </div>
               );
             })}


           </>
         ) : (
           <div style={{ fontSize: 11, color: '#94a3b8', textAlign: 'center', marginTop: 40 }}>Naciśnij ▶ żeby rozpocząć</div>
         )}
       </div>

       {/* CENTER: Commentary feed */}
       <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
         {commentaries.length === 0 ? (
           <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, color: '#94a3b8' }}>
             <div style={{ fontSize: 32 }}>🏐</div>
             <div style={{ fontSize: 13, fontWeight: 600, color: '#475569' }}>Naciśnij ▶ żeby rozpocząć transmisję</div>
             <div style={{ fontSize: 11, color: '#94a3b8' }}>Rally-by-rally commentary powered by GPT-4o-mini + RAG</div>
           </div>
         ) : (
           <div ref={commentaryRef} style={{ flex: 1, overflowY: 'auto', padding: '0 16px 16px' }}>
             {/* Sort toggle */}
             <div style={{ position: 'sticky', top: 0, background: '#162032', padding: '6px 0 4px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', zIndex: 5, borderBottom: '1px solid #1a2332', marginBottom: 6 }}>
               <span style={{ fontSize: 11, color: '#475569' }}>{commentaries.length} {BUDDY_I18N[language]?.commentaryCount || 'komentarzy'}</span>
               <button onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
                 style={{ padding: '3px 10px', borderRadius: 6, fontSize: 10, fontWeight: 700, border: '1px solid #1a2332', background: 'transparent', color: '#64748b', cursor: 'pointer' }}>
                 {sortOrder === 'desc' ? (BUDDY_I18N[language]?.newest || '↓ Najnowsze') : (BUDDY_I18N[language]?.chronological || '↑ Chronologicznie')}
               </button>
             </div>
             {(sortOrder === 'desc' ? [...commentaries].reverse() : commentaries).map((commentary, index) => {
               const rally = rallies.find(r => r.rally_number === commentary.rallyNumber);
               const isHome = commentary.team === 'home';
               const isBuddy = favPlayer && rally?.touches.some(t => t.player === favPlayer);
               const actionType = getActionType(commentary.action);
               const icon = ACTION_ICON[actionType] || '🏐';

               // ── INTRO CARD ──────────────────────────────────────────────
               if (commentary.type === 'intro') {
                 return (
                   <div key={index} style={{ background: 'rgba(99,102,241,.1)', border: '1px solid rgba(99,102,241,.2)', borderRadius: 12, padding: '12px 16px', marginBottom: 6 }}>
                     <div style={{ fontSize: 9, fontWeight: 700, color: '#818cf8', textTransform: 'uppercase', letterSpacing: '.12em', marginBottom: 4 }}>{`🎙️ ${BUDDY_I18N[language]?.liveStream || 'TRANSMISJA NA ŻYWO'}`}</div>
                     <p style={{ fontSize: 13, color: commentary.text === '...' ? '#818cf8' : '#c7d2fe', lineHeight: 1.6, margin: 0, fontStyle: 'italic', animation: commentary.text === '...' ? 'pulse 1.5s infinite' : 'none' }}>{commentary.text}</p>
                   </div>
                 );
               }

               // ── SET SUMMARY CARD ────────────────────────────────────────
               // ── MATCH SUMMARY CARD ──────────────────────────────────────
               if (commentary.type === 'match_summary' && commentary.matchSummaryData) {
                 const md = commentary.matchSummaryData;
                 const i18n = BUDDY_I18N[language];
                 return (
                   <div key={index} style={{ background: 'linear-gradient(to right,rgba(88,28,135,.25),rgba(124,58,237,.2),rgba(88,28,135,.25))', border: '2px solid rgba(167,139,250,.35)', borderRadius: 14, padding: 20, marginBottom: 8, textAlign: 'center' }}>
                     <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '.2em', color: '#7c3aed', marginBottom: 6, fontWeight: 800 }}>🏆 {i18n.matchEnd}</div>
                     <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 36, fontWeight: 800, color: '#fff', marginBottom: 4 }}>
                       {md.matchScore.home} <span style={{ color: '#475569', fontSize: 22 }}>:</span> {md.matchScore.away}
                     </div>
                     <div style={{ fontSize: 13, color: '#a78bfa', marginBottom: 10, fontWeight: 700 }}>{i18n.matchWinner}: {md.winner}</div>
                     <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
                       {md.setResults.map(s => (
                         <div key={s.setNumber} style={{ background: s.homeWon ? 'rgba(59,130,246,.15)' : 'rgba(245,158,11,.15)', border: `1px solid ${s.homeWon ? 'rgba(59,130,246,.3)' : 'rgba(245,158,11,.3)'}`, borderRadius: 6, padding: '3px 8px', fontSize: 11, fontFamily: "'JetBrains Mono',monospace", color: s.homeWon ? '#93c5fd' : '#fcd34d' }}>
                           S{s.setNumber} {s.homeScore}:{s.awayScore}
                         </div>
                       ))}
                     </div>
                     {md.narrative && md.narrative !== '...' && (
                       <p style={{ fontSize: 14, color: '#e9d5ff', lineHeight: 1.65, fontStyle: 'italic', margin: '0 0 12px', padding: '0 8px' }}>{md.narrative}</p>
                     )}
                     {md.narrative === '...' && <p style={{ fontSize: 11, color: '#a78bfa', margin: '0 0 12px', animation: 'pulse 1.5s infinite' }}>Generowanie podsumowania meczu...</p>}
                     {md.topScorers.length > 0 && (
                       <div style={{ borderTop: '1px solid rgba(167,139,250,.2)', paddingTop: 10, display: 'inline-block', minWidth: 200, textAlign: 'left' }}>
                         <div style={{ fontSize: 9, fontWeight: 800, color: '#a78bfa', textTransform: 'uppercase', letterSpacing: '.1em', marginBottom: 5 }}>{BUDDY_I18N[language]?.mvpTitle || 'MVP'}:</div>
                         {md.topScorers.slice(0,3).map((s, i) => (
                           <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, padding: '2px 0' }}>
                             <span style={{ color: s.team === 'home' ? '#93c5fd' : '#fcd34d' }}>{i + 1}. {s.player}</span>
                             <span style={{ color: '#a78bfa', fontWeight: 700, marginLeft: 16 }}>{s.points} {BUDDY_I18N[language]?.pts || 'pts'}</span>
                           </div>
                         ))}
                       </div>
                     )}
                   </div>
                 );
               }

               // ── SET SUMMARY CARD ────────────────────────────────────────
               if (commentary.type === 'set_summary' && commentary.summaryData) {
                 const sd = commentary.summaryData;
                 const winnerName = sd.winner === 'home' ? getHomeTeamFull() : getAwayTeamFull();
                 return (
                   <div key={index} style={{ background: 'linear-gradient(to right,rgba(6,78,59,.2),rgba(4,120,87,.15),rgba(6,78,59,.2))', border: '1px solid rgba(16,185,129,.2)', borderRadius: 12, padding: 16, marginBottom: 6, textAlign: 'center' }}>
                     <div style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: '.15em', color: '#065f46', marginBottom: 4 }}>{BUDDY_I18N[language].setEnd} {sd.setNumber}</div>
                     <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 28, fontWeight: 700, color: '#fff', marginBottom: 4 }}>{sd.finalScore.home} : {sd.finalScore.away}</div>
                     <div style={{ fontSize: 11, color: '#34d399', marginBottom: 8 }}>{BUDDY_I18N[language].setWinner}: {winnerName}</div>
                     {sd.narrative && sd.narrative !== '...' && (
                       <p style={{ fontSize: 13, color: '#d1fae5', lineHeight: 1.6, fontStyle: 'italic', margin: '0 0 8px' }}>{sd.narrative}</p>
                     )}
                     {sd.narrative === '...' && <p style={{ fontSize: 11, color: '#34d399', margin: '0 0 8px', animation: 'pulse 1.5s infinite' }}>Generowanie podsumowania...</p>}
                     {sd.topScorers.length > 0 && (
                       <div style={{ borderTop: '1px solid rgba(16,185,129,.2)', paddingTop: 8, textAlign: 'left', display: 'inline-block', minWidth: 180 }}>
                         <div style={{ fontSize: 9, fontWeight: 700, color: '#34d399', textTransform: 'uppercase', marginBottom: 4 }}>{BUDDY_I18N[language].topScorers}:</div>
                         {sd.topScorers.map((s, i) => (
                           <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, padding: '2px 0' }}>
                             <span style={{ color: favPlayer === s.player ? '#fde047' : '#cbd5e1' }}>{i + 1}. {s.player}</span>
                             <span style={{ color: '#34d399', fontWeight: 700, marginLeft: 16 }}>{s.points} {BUDDY_I18N[language].pts}</span>
                           </div>
                         ))}
                       </div>
                     )}

                   </div>
                 );
               }

               // ── REGULAR COMMENTARY CARD ─────────────────────────────────
               return (
                 <div key={index} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '10px 10px', borderRadius: 10, marginBottom: 4, background: index === 0 && sortOrder === 'desc' ? 'rgba(30,41,59,.4)' : 'transparent', outline: index === 0 && sortOrder === 'desc' ? '1px solid rgba(30,41,59,.6)' : 'none', borderLeft: `3px solid ${isBuddy ? 'rgba(234,179,8,.5)' : 'transparent'}`, transition: 'all .25s' }}>
                   {/* Score badge — large, v3-style */}
                   {rally && (
                     <div style={{ flexShrink: 0, minWidth: 64, background: isHome ? 'linear-gradient(135deg,rgba(29,78,216,.25),rgba(59,130,246,.15))' : 'linear-gradient(135deg,rgba(120,53,15,.25),rgba(245,158,11,.15))', border: `1px solid ${isHome ? 'rgba(59,130,246,.35)' : 'rgba(245,158,11,.35)'}`, borderRadius: 8, padding: '6px 8px', textAlign: 'center' }}>
                       <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 20, fontWeight: 700, color: isHome ? '#93c5fd' : '#fcd34d', lineHeight: 1 }}>
                         {rally.score_after.home}<span style={{ color: '#475569', fontSize: 14, margin: '0 1px' }}>:</span>{rally.score_after.away}
                       </div>
                     </div>
                   )}
                   {/* Content */}
                   <div style={{ flex: 1, minWidth: 0 }}>
                     <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3, flexWrap: 'wrap' }}>
                       <span style={{ fontSize: 13 }}>{icon}</span>
                       {commentary.player && (
                         <span style={{ fontSize: 12, padding: '3px 8px', borderRadius: 99, fontWeight: 500, background: isHome ? 'rgba(59,130,246,.1)' : 'rgba(245,158,11,.1)', color: isHome ? '#93c5fd' : '#fcd34d' }}>
                           {commentary.player} · {getActionLabel(commentary.action, language)}
                         </span>
                       )}
                       {/* Tags */}
                       {commentary.tags.map((tag, ti) => {
                         const tc = TAG_CLR[tag] || { bg: 'rgba(30,41,59,.4)', color: '#64748b' };
                         const popupId = `${commentary.rallyNumber}-${tag}`;
                         const isOpen = openTagPopup === popupId;
                         return (
                           <div key={ti} style={{ position: 'relative' }}>
                             <button onClick={() => setOpenTagPopup(isOpen ? null : popupId)}
                               style={{ fontSize: 9, padding: '2px 6px', borderRadius: 99, background: tc.bg, color: tc.color, border: 'none', cursor: 'pointer', fontWeight: 600 }}>
                               {getTagLabel(tag, language)}
                             </button>
                             {isOpen && commentary.tagData?.[tag] && (
                               <div style={{ position: 'absolute', bottom: '100%', left: 0, marginBottom: 6, zIndex: 50, background: '#1a2740', border: '1px solid #1e293b', borderRadius: 10, padding: 12, minWidth: 220, boxShadow: '0 20px 40px rgba(0,0,0,.6)' }}>
                                 <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                                   <span style={{ fontSize: 11, fontWeight: 700, color: '#fff' }}>{getTagLabel(tag, language)}</span>
                                   <button onClick={() => setOpenTagPopup(null)} style={{ fontSize: 10, color: '#64748b', background: 'none', border: 'none', cursor: 'pointer' }}>✕</button>
                                 </div>
                                 <div style={{ fontSize: 10, color: '#94a3b8' }}>
                                   {commentary.tagData[tag] && Object.entries(commentary.tagData[tag]).map(([k, v]) => (
                                     <div key={k}>{k}: {String(v)}</div>
                                   ))}
                                 </div>
                               </div>
                             )}
                           </div>
                         );
                       })}
                       <span style={{ color: isBuddy ? '#facc15' : '#1e293b', fontSize: 10, transition: 'color .2s' }}>{isBuddy ? '★' : '☆'}</span>
                     </div>
                     <p style={{ fontSize: 15, lineHeight: 1.65, margin: '0 0 4px', color: '#e2e8f0' }}>{commentary.text}</p>
                     {/* TTS + InlineFeedback row */}
                     <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                       <button onClick={() => playTTS(commentary.text, commentary.rallyNumber)}
                         style={{ fontSize: 10, padding: '1px 6px', borderRadius: 4, border: 'none', cursor: 'pointer', background: ttsPlaying === commentary.rallyNumber ? 'rgba(16,185,129,.2)' : 'rgba(255,255,255,.05)', color: ttsPlaying === commentary.rallyNumber ? '#34d399' : '#94a3b8' }}>
                         {ttsPlaying === commentary.rallyNumber ? '🔊' : '🔈'}
                       </button>
                       <InlineFeedback
                         matchId={matchData?.match_id || '1104643'}
                         rallyNumber={commentary.rallyNumber}
                         setNumber={rally ? (rally as any).set_number || 1 : 1}
                         commentary={commentary.text}
                       />
                       {/* RAG debug */}
                       {commentary.ragDebug && commentary.ragDebug.length > 0 && (
                         <button onClick={() => setOpenRagDebug(openRagDebug === commentary.rallyNumber ? null : commentary.rallyNumber)}
                           style={{ fontSize: 9, padding: '1px 6px', borderRadius: 4, border: '1px solid #1e293b', color: '#94a3b8', background: 'transparent', cursor: 'pointer', fontFamily: 'monospace' }}>
                           {openRagDebug === commentary.rallyNumber ? '▲ RAG' : '▼ RAG'}
                         </button>
                       )}
                     </div>
                     {/* RAG debug panel */}
                     {openRagDebug === commentary.rallyNumber && commentary.ragDebug && (
                       <div style={{ marginTop: 6, background: '#0a0f1a', border: '1px solid #1e293b', borderRadius: 8, padding: 10, fontSize: 10, fontFamily: 'monospace' }}>
                         {commentary.ragDebug.map((ns, i) => (
                           <div key={i} style={{ display: 'flex', gap: 6, padding: '3px 6px', borderRadius: 4, marginBottom: 2, background: ns.used ? 'rgba(16,185,129,.05)' : ns.retrieved > 0 ? 'rgba(234,179,8,.05)' : 'rgba(255,255,255,.02)' }}>
                             <span style={{ color: ns.used ? '#34d399' : ns.retrieved > 0 ? '#facc15' : '#64748b', width: 10 }}>{ns.used ? '✓' : ns.retrieved > 0 ? '~' : '✗'}</span>
                             <span style={{ color: '#cbd5e1', fontWeight: 700 }}>{ns.namespace}</span>
                             <span style={{ color: '#94a3b8' }}>{ns.topScore > 0 ? ns.topScore.toFixed(3) : '—'}</span>
                           </div>
                         ))}
                       </div>
                     )}
                   </div>
                 </div>
               );
             })}
           </div>
         )}
       </div>

       {/* RIGHT: Tabs */}
       <div style={{ width: 296, flexShrink: 0, borderLeft: '1px solid #0f172a', display: 'flex', flexDirection: 'column' }}>
         <div style={{ display: 'flex', borderBottom: '1px solid #0f172a', flexShrink: 0 }}>
           {(['ranking', 'buddy', 'set'] as const).map(t => (
             <button key={t} onClick={() => setRightTab(t)}
               style={{ flex: 1, padding: '8px 4px', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', border: 'none', cursor: 'pointer', borderBottom: rightTab === t ? '2px solid #3b82f6' : '2px solid transparent', color: rightTab === t ? '#fff' : '#94a3b8', background: rightTab === t ? 'rgba(59,130,246,.05)' : 'transparent' }}>
               {t === 'ranking' ? '📊 Ranking' : t === 'buddy' ? '★ Buddy' : '⚡ Set'}
             </button>
           ))}
         </div>
         <div style={{ flex: 1, overflowY: 'auto', padding: 12 }}>

           {/* ── RANKING TAB ─────────────────────────────────────────────── */}
           {rightTab === 'ranking' && (
             <div>
               {Object.keys(playerStats).length === 0 ? (
                 <div style={{ fontSize: 11, color: '#94a3b8', textAlign: 'center', marginTop: 40 }}>Naciśnij ▶ żeby zobaczyć ranking</div>
               ) : (
                 <>
                   {(() => {
                     const rk = {
                       pl: { pts: 'Punkty', atk: 'Atak K%', srv: 'Zagrywka (asy)', blk: 'Bloki', rec: 'Przyjęcie %', dig: 'Obrony' },
                       en: { pts: 'Points', atk: 'Attack K%', srv: 'Serve (aces)', blk: 'Blocks', rec: 'Reception %', dig: 'Digs' },
                       it: { pts: 'Punti', atk: 'Attacco K%', srv: 'Battuta (ace)', blk: 'Muri', rec: 'Ricezione %', dig: 'Difesa' },
                       de: { pts: 'Punkte', atk: 'Angriff K%', srv: 'Aufschlag (Ass)', blk: 'Blocks', rec: 'Annahme %', dig: 'Abwehr' },
                       tr: { pts: 'Sayılar', atk: 'Hücum K%', srv: 'Servis (ace)', blk: 'Bloklar', rec: 'Kabul %', dig: 'Savunma' },
                       es: { pts: 'Puntos', atk: 'Ataque K%', srv: 'Saque (aces)', blk: 'Bloqueos', rec: 'Recepción %', dig: 'Defensa' },
                       pt: { pts: 'Pontos', atk: 'Ataque K%', srv: 'Saque (aces)', blk: 'Bloqueios', rec: 'Recepção %', dig: 'Defesa' },
                       jp: { pts: '得点', atk: 'アタックK%', srv: 'サーブ(エース)', blk: 'ブロック', rec: 'レセプション%', dig: 'ディグ' },
                     };
                     const r = rk[language as keyof typeof rk] || rk.pl;
                     return (<>
                       <RankCard title={r.pts} icon="🏆" data={topScorersLB.map(e => ({ name: e.name, team: e.team, value: e.points }))} isPercent={false} barColor="linear-gradient(to right,#065f46,#34d399)" border="rgba(16,185,129,.15)" avgField="avgPoints" />
                       <RankCard title={r.atk} icon="💥" data={topAttackLB.map(e => ({ name: e.name, team: e.team, value: e.killPct, num: e.attackSum > 0 ? Math.round(e.killPct * e.attackSum / 100) : 0, den: e.attackSum }))} isPercent={true} barColor="linear-gradient(to right,#7f1d1d,#f87171)" border="rgba(239,68,68,.15)" avgField="avgAttackPct" />
                       <RankCard title={r.srv} icon="🎯" data={topAcesLB.map(e => ({ name: e.name, team: e.team, value: e.aces }))} isPercent={false} barColor="linear-gradient(to right,#3b0764,#c084fc)" border="rgba(139,92,246,.15)" avgField="avgAces" />
                       <RankCard title={r.blk} icon="🧱" data={topBlocksLB.map(e => ({ name: e.name, team: e.team, value: e.blocks }))} isPercent={false} barColor="linear-gradient(to right,#1e3a5f,#60a5fa)" border="rgba(59,130,246,.15)" avgField="avgBlocks" />
                       <RankCard title={r.rec} icon="🛡️" data={topRecLB.map(e => ({ name: e.name, team: e.team, value: e.recPct, num: e.recPerfect, den: e.recSum }))} isPercent={true} barColor="linear-gradient(to right,#713f12,#fbbf24)" border="rgba(234,179,8,.15)" avgField="avgRecPct" />
                       <RankCard title={r.dig} icon="🏊" data={topDigsLB.map(e => ({ name: e.name, team: e.team, value: e.digs }))} isPercent={false} barColor="linear-gradient(to right,#164e63,#22d3ee)" border="rgba(6,182,212,.15)" avgField="avgDigs" />
                     </>);
                   })()}
                 </>
               )}
             </div>
           )}

           {/* ── BUDDY TAB ───────────────────────────────────────────────── */}
           {rightTab === 'buddy' && (
             <div>
               {!favPlayer ? (
                 <div style={{ textAlign: 'center', padding: '40px 16px' }}>
                   <div style={{ fontSize: 24, marginBottom: 8 }}>★</div>
                   <div style={{ fontSize: 11, color: '#94a3b8' }}>{BUDDY_I18N[language].selectPlayer}</div>
                   <div style={{ fontSize: 10, color: '#1e293b', marginTop: 4 }}>Kliknij zawodnika w lewej kolumnie</div>
                 </div>
               ) : (() => {
                 const defaultStats = { blocks: 0, aces: 0, attacks: 0, errors: 0, points: 0, serve: { sum: 0, error: 0, ace: 0 }, reception: { sum: 0, error: 0, positive: 0, perfect: 0 }, attack: { sum: 0, error: 0, blocked: 0, kill: 0 }, block: { pts: 0, touchPlus: 0 }, dig: 0, assist: 0, bp: 0 };
                 const s = playerStats[favPlayer] || defaultStats;
                 const serveEff = s.serve.sum > 0 ? Math.round(((s.serve.ace - s.serve.error) / s.serve.sum) * 100) : 0;
                 const recPosRate = s.reception.sum > 0 ? Math.round((s.reception.positive / s.reception.sum) * 100) : 0;
                 const recPerfRate = s.reception.sum > 0 ? Math.round((s.reception.perfect / s.reception.sum) * 100) : 0;
                 const killRate = s.attack.sum > 0 ? Math.round((s.attack.kill / s.attack.sum) * 100) : 0;
                 const attackEff = s.attack.sum > 0 ? Math.round(((s.attack.kill - s.attack.error - s.attack.blocked) / s.attack.sum) * 100) : 0;
                 const pl = currentLineup?.home.find(p => p.name === favPlayer) || currentLineup?.away.find(p => p.name === favPlayer);
                 const isHomePlayer = !!currentLineup?.home.find(p => p.name === favPlayer);
                 const secs = [
                   { lbl: BUDDY_I18N[language].points, c: '#34d399', rows: [{ l: 'SUM', v: s.points }, { l: 'BP', v: s.bp }, { l: 'Ratio', v: s.points - s.errors }] },
                   { lbl: BUDDY_I18N[language].serve, c: '#facc15', rows: [{ l: 'Sum', v: s.serve.sum }, { l: 'Err', v: s.serve.error }, { l: 'Ace', v: s.serve.ace }, { l: 'Eff%', v: `${serveEff}%` }] },
                   { lbl: BUDDY_I18N[language].reception, c: '#60a5fa', rows: [{ l: 'Sum', v: s.reception.sum }, { l: 'Err', v: s.reception.error }, { l: 'Pos%', v: `${recPosRate}%` }, { l: 'Perf%', v: `${recPerfRate}%` }] },
                   { lbl: BUDDY_I18N[language].attack, c: '#f87171', rows: [{ l: 'Sum', v: s.attack.sum }, { l: 'Err', v: s.attack.error }, { l: 'Blk', v: s.attack.blocked }, { l: 'Kill', v: s.attack.kill }, { l: 'K%', v: `${killRate}%` }, { l: 'Eff%', v: `${attackEff}%` }] },
                   { lbl: BUDDY_I18N[language].block, c: '#c084fc', rows: [{ l: 'Pts', v: s.block.pts }, { l: 'Touch+', v: s.block.touchPlus }] },
                   { lbl: BUDDY_I18N[language].other, c: '#94a3b8', rows: [{ l: 'Dig', v: s.dig }, { l: 'Assist', v: s.assist }] },
                 ];
                 return (
                   <>
                     <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                       <span style={{ color: '#facc15', fontSize: 12 }}>★</span>
                       <span style={{ fontSize: 10, fontWeight: 700, color: '#fde047', textTransform: 'uppercase', letterSpacing: '.1em' }}>Buddy</span>
                     </div>
                     <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4, padding: '3px 10px', borderRadius: 6, display: 'inline-block', background: isHomePlayer ? 'rgba(59,130,246,.1)' : 'rgba(245,158,11,.1)', color: isHomePlayer ? '#93c5fd' : '#fcd34d' }}>
                       {favPlayer}
                     </div>
                     {pl && <div style={{ fontSize: 10, color: '#94a3b8', marginBottom: 10 }}>#{pl.jersey} · {isHomePlayer ? getHomeTeamFull() : getAwayTeamFull()}</div>}
                     <div style={{ fontSize: 9, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '.12em', marginBottom: 8 }}>{BUDDY_I18N[language].statsTitle}</div>
                     {secs.map(sec => (
                       <div key={sec.lbl} style={{ marginBottom: 8, borderRadius: 10, padding: '8px 10px', background: 'rgba(255,255,255,.025)', borderLeft: '2px solid rgba(255,255,255,.07)' }}>
                         <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 6, color: sec.c }}>{sec.lbl}</div>
                         <div style={{ display: 'grid', gridTemplateColumns: `repeat(${sec.rows.length},1fr)`, gap: 4 }}>
                           {sec.rows.map(r => (
                             <div key={r.l} style={{ textAlign: 'center' }}>
                               <div style={{ fontSize: 8, color: '#94a3b8', textTransform: 'uppercase', marginBottom: 2 }}>{r.l}</div>
                               <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 12, fontWeight: 700, color: '#cbd5e1' }}>{r.v}</div>
                             </div>
                           ))}
                         </div>
                       </div>
                     ))}
                     {/* Season vs match comparison */}
                     {(() => {
                       const ss = seasonStats[favPlayer];
                       if (!ss?.found || ss.avgPoints == null) return null;
                       const matchPts = s.points;
                       const avgPts   = ss.avgPoints;
                       const diff     = matchPts - avgPts;
                       const diffPct  = avgPts > 0 ? Math.round((diff / avgPts) * 100) : 0;
                       const isAbove  = diff > 1;
                       const isBelow  = diff < -1;
                       const last5    = ss.last5 || [];
                       const maxL5    = Math.max(...last5, 1);
                       const nameColor = isHomePlayer ? '#93c5fd' : '#fcd34d';
                       return (
                         <div style={{ marginTop: 8, marginBottom: 8, borderRadius: 10, padding: '10px 12px', background: 'rgba(255,255,255,.025)', border: `1px solid ${isAbove ? 'rgba(52,211,153,.2)' : isBelow ? 'rgba(248,113,113,.2)' : 'rgba(255,255,255,.06)'}` }}>
                           <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                             <span style={{ fontSize: 9, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '.1em' }}>{BUDDY_I18N[language]?.seasonVsMatch || 'Ten mecz vs sezon'}</span>
                             <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 7px', borderRadius: 4,
                               background: isAbove ? 'rgba(52,211,153,.15)' : isBelow ? 'rgba(248,113,113,.15)' : 'rgba(255,255,255,.06)',
                               color: isAbove ? '#34d399' : isBelow ? '#f87171' : '#94a3b8' }}>
                               {isAbove ? `+${diffPct}%` : isBelow ? `${diffPct}%` : 'w normie'}
                             </span>
                           </div>
                           {/* Points comparison */}
                           <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                             <div style={{ textAlign: 'center', minWidth: 40 }}>
                               <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 22, fontWeight: 800, color: isAbove ? '#34d399' : isBelow ? '#f87171' : '#cbd5e1' }}>{matchPts}</div>
                               <div style={{ fontSize: 9, color: '#94a3b8' }}>{BUDDY_I18N[language]?.thisMatch || 'ten mecz'}</div>
                             </div>
                             <div style={{ flex: 1, textAlign: 'center' }}>
                               <div style={{ fontSize: 9, color: '#475569', marginBottom: 2 }}>vs</div>
                               <div style={{ height: 1, background: 'rgba(255,255,255,.06)' }} />
                             </div>
                             <div style={{ textAlign: 'center', minWidth: 40 }}>
                               <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 22, fontWeight: 800, color: '#94a3b8' }}>{avgPts}</div>
                               <div style={{ fontSize: 9, color: '#94a3b8' }}>{BUDDY_I18N[language]?.seasonAvg || 'śr. sezonu'}</div>
                             </div>
                           </div>
                           {/* Last 5 sparkline */}
                           {last5.length > 0 && (
                             <div>
                               <div style={{ fontSize: 9, color: '#94a3b8', marginBottom: 6 }}>{BUDDY_I18N[language]?.last5 || 'ostatnich 5 meczów'}</div>
                               <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 36 }}>
                                 {last5.map((v, idx) => (
                                   <div key={idx} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
                                     <div style={{
                                       width: '100%', borderRadius: 2,
                                       height: `${Math.max(3, Math.round((v / maxL5) * 28))}px`,
                                       background: idx === last5.length - 1 ? nameColor : 'rgba(255,255,255,.2)',
                                     }} />
                                     <span style={{ fontSize: 10, color: idx === last5.length - 1 ? nameColor : '#cbd5e1', fontFamily: "'JetBrains Mono',monospace", fontWeight: 700 }}>{v}</span>
                                   </div>
                                 ))}
                               </div>
                             </div>
                           )}
                           {/* Profile link */}
                           {ss.id && (
                             <div style={{ marginTop: 8, textAlign: 'right' }}>
                               <a href={`/player/${ss.id}`} target="_blank" rel="noopener noreferrer"
                                 style={{ fontSize: 10, color: '#3b82f6', textDecoration: 'none', fontWeight: 600 }}>
                                 {BUDDY_I18N[language]?.fullProfile || 'pełny profil sezonu →'}
                               </a>
                             </div>
                           )}
                         </div>
                       );
                     })()}
                     {/* Expert knowledge */}
                     <div style={{ marginTop: 4, background: 'rgba(255,255,255,.02)', border: '1px solid #0f172a', borderRadius: 10, padding: '10px 12px' }}>
                       <div style={{ fontSize: 9, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 6 }}>{BUDDY_I18N[language].expertTitle}</div>
                       {isLoadingProfile ? (
                         <div style={{ fontSize: 11, color: '#94a3b8', animation: 'pulse 1.5s infinite' }}>{BUDDY_I18N[language].loading}</div>
                       ) : playerProfile?.found && playerProfile.summary ? (
                         <div style={{ fontSize: 11, color: '#94a3b8', lineHeight: 1.6, whiteSpace: 'pre-line' }}>{translatedProfileSummary || playerProfile.summary}</div>
                       ) : playerProfile?.found === false ? (
                         <div style={{ fontSize: 10, color: '#94a3b8', fontStyle: 'italic' }}>{BUDDY_I18N[language].noProfile}</div>
                       ) : (
                         <div style={{ fontSize: 10, color: '#94a3b8', fontStyle: 'italic' }}>{BUDDY_I18N[language].profilePending}</div>
                       )}
                     </div>
                   </>
                 );
               })()}
             </div>
           )}

           {/* ── SET TAB ─────────────────────────────────────────────────── */}
           {rightTab === 'set' && (() => {
             // ── COMPUTE SET KPIs from rallies ──────────────────────────────
             const computeSetKPI = (setNum: number, upToIndex?: number) => {
               const allSetRallies = rallies.filter((r: any) => r.set_number === setNum);
               // For live set: only count rallies up to currentRallyIndex
               const setRallies = upToIndex !== undefined
                 ? rallies.slice(0, upToIndex).filter((r: any) => r.set_number === setNum)
                 : allSetRallies;
               let hAtk = 0, hKill = 0, hAce = 0, hBlk = 0, hErr = 0;
               let aAtk = 0, aKill = 0, aAce = 0, aBlk = 0, aErr = 0;
               let hRec = 0, hRecPos = 0, aRec = 0, aRecPos = 0;
               const hScorers: Record<string,number> = {};
               const aScorers: Record<string,number> = {};

               for (const r of setRallies) {
                 if (r.team_scored === 'home' && r.final_action?.player) hScorers[r.final_action.player] = (hScorers[r.final_action.player]||0)+1;
                 if (r.team_scored === 'away' && r.final_action?.player) aScorers[r.final_action.player] = (aScorers[r.final_action.player]||0)+1;

                 for (const t of (r.touches || [])) {
                   const team = t.team;
                   const at = (t.actionType||'').toLowerCase();
                   const grade = t.grade || '';
                   const action = (t.action||'').toLowerCase();

                   if (at === 'attack') {
                     const isKill = grade === 'Perfect';
                     if (team === 'home') { hAtk++; if (isKill) hKill++; }
                     else { aAtk++; if (isKill) aKill++; }
                   }
                   if (at === 'serve') {
                     const isAce = grade === 'Ace' || grade === 'Perfect' || action.includes('ace') || action.includes('as serwis');
                     const isErr = grade === 'Fail' || grade === 'Error';
                     if (team === 'home') { if (isAce) hAce++; if (isErr) hErr++; }
                     else { if (isAce) aAce++; if (isErr) aErr++; }
                   }
                   if (at === 'block') {
                     const isBlkPt = grade === 'Perfect' || grade === 'Positive';
                     if (team === 'home') { if (isBlkPt) hBlk++; }
                     else { if (isBlkPt) aBlk++; }
                   }
                   if (at === 'receive') {
                     const isPos = grade === 'Perfect' || grade === 'Positive' || grade === 'Average';
                     if (team === 'home') { hRec++; if (isPos) hRecPos++; }
                     else { aRec++; if (isPos) aRecPos++; }
                   }
                 }
               }
               const hMvp = Object.entries(hScorers).sort(([,a],[,b])=>b-a)[0];
               const aMvp = Object.entries(aScorers).sort(([,a],[,b])=>b-a)[0];
               const hTotal = setRallies.filter((r:any) => r.team_scored === 'home').length;
               const aTotal = setRallies.filter((r:any) => r.team_scored === 'away').length;
               return {
                 hTotal, aTotal,
                 hKill, aKill, hAce, aAce, hBlk, aBlk, hErr, aErr,
                 hKillPct: hAtk > 0 ? Math.round(hKill/hAtk*100) : 0,
                 aKillPct: aAtk > 0 ? Math.round(aKill/aAtk*100) : 0,
                 hRecPct:  hRec > 0 ? Math.round(hRecPos/hRec*100) : 0,
                 aRecPct:  aRec > 0 ? Math.round(aRecPos/aRec*100) : 0,
                 hMvp: hMvp ? `${hMvp[0].split(' ').slice(-1)[0]} ${hMvp[1]}` : '—',
                 aMvp: aMvp ? `${aMvp[0].split(' ').slice(-1)[0]} ${aMvp[1]}` : '—',
               };
             };

             const hShort = getHomeTeamFull().split(' ').slice(-1)[0];
             const aShort = getAwayTeamFull().split(' ').slice(-1)[0];

             // mini KPI row helper
             const KpiRow = ({ label, hVal, aVal, hBetter }: { label: string; hVal: string; aVal: string; hBetter: boolean }) => (
               <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 3, borderRadius: 4, padding: '1px 0' }}>
                 <div style={{ width: 30, textAlign: 'right', display: 'flex', justifyContent: 'flex-end' }}>
                   <span style={{ fontSize: 11, color: hBetter ? '#93c5fd' : '#cbd5e1', fontFamily: "'JetBrains Mono',monospace", fontWeight: 800,
                     background: hBetter ? 'rgba(147,197,253,.12)' : 'transparent', borderRadius: 3, padding: '0 3px' }}>{hVal}</span>
                 </div>
                 <span style={{ fontSize: 9, color: '#64748b', flex: 1, textAlign: 'center' }}>{label}</span>
                 <div style={{ width: 30 }}>
                   <span style={{ fontSize: 11, color: !hBetter ? '#fcd34d' : '#cbd5e1', fontFamily: "'JetBrains Mono',monospace", fontWeight: 800,
                     background: !hBetter ? 'rgba(252,211,77,.12)' : 'transparent', borderRadius: 3, padding: '0 3px' }}>{aVal}</span>
                 </div>
               </div>
             );

             const completedSets = Object.entries(setResults).filter(([sn]) => Number(sn) < currentSetNumber);
             const hW = completedSets.filter(([, sc]) => sc.home > sc.away).length;
             const aW = completedSets.filter(([, sc]) => sc.away > sc.home).length;

             return (
               <div>
                 {/* Match score header */}
                 <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                   <span style={{ fontSize: 11, fontWeight: 700, color: '#93c5fd' }}>{hShort}</span>
                   <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 20, fontWeight: 800, color: '#fff' }}>{hW} : {aW}</span>
                   <span style={{ fontSize: 11, fontWeight: 700, color: '#fcd34d' }}>{aShort}</span>
                 </div>

                 {/* Per-set cards */}
                 {completedSets
                   .sort(([a], [b]) => Number(a) - Number(b))
                   .map(([sn, sc]) => {
                     const hw = sc.home > sc.away;
                     const kpi = computeSetKPI(Number(sn));
                     return (
                       <div key={sn} style={{ background: 'rgba(255,255,255,.02)', border: `1px solid ${hw ? 'rgba(59,130,246,.12)' : 'rgba(245,158,11,.12)'}`, borderRadius: 10, padding: '8px 10px', marginBottom: 8 }}>
                         {/* Set header */}
                         <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                           <span style={{ fontSize: 8, fontWeight: 800, color: '#475569', textTransform: 'uppercase', letterSpacing: '.1em' }}>Set {sn}</span>
                           <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                             <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 13, fontWeight: 700, color: hw ? '#93c5fd' : '#475569' }}>{sc.home}</span>
                             <span style={{ fontSize: 9, color: '#1e293b' }}>:</span>
                             <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 13, fontWeight: 700, color: !hw ? '#fcd34d' : '#475569' }}>{sc.away}</span>
                           </div>
                           <span style={{ fontSize: 8, padding: '1px 5px', borderRadius: 3, background: hw ? 'rgba(59,130,246,.1)' : 'rgba(245,158,11,.1)', color: hw ? '#60a5fa' : '#fbbf24', fontWeight: 700 }}>
                             {hw ? hShort : aShort}
                           </span>
                         </div>
                         {/* KPIs */}
                         <KpiRow label="Ataki" hVal={String(kpi.hKill)} aVal={String(kpi.aKill)} hBetter={kpi.hKill >= kpi.aKill} />
                         <KpiRow label="Bloki" hVal={String(kpi.hBlk)} aVal={String(kpi.aBlk)} hBetter={kpi.hBlk >= kpi.aBlk} />
                         <KpiRow label="Asy" hVal={String(kpi.hAce)} aVal={String(kpi.aAce)} hBetter={kpi.hAce >= kpi.aAce} />
                         <KpiRow label="Błędy rywali" hVal={String(kpi.aErr)} aVal={String(kpi.hErr)} hBetter={kpi.aErr >= kpi.hErr} />
                         <div style={{ marginTop: 3, marginBottom: 2, borderTop: '1px solid rgba(255,255,255,.04)', paddingTop: 3 }} />
                         <KpiRow label="Atak K%" hVal={`${kpi.hKillPct}%`} aVal={`${kpi.aKillPct}%`} hBetter={kpi.hKillPct >= kpi.aKillPct} />
                         <KpiRow label="Przyjęcie%" hVal={`${kpi.hRecPct}%`} aVal={`${kpi.aRecPct}%`} hBetter={kpi.hRecPct >= kpi.aRecPct} />
                         {/* MVPs */}
                         <div style={{ marginTop: 5, paddingTop: 5, borderTop: '1px solid rgba(255,255,255,.04)' }}>
                           <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                             <span style={{ fontSize: 8, color: '#60a5fa', maxWidth: 70, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>⭐ {kpi.hMvp}</span>
                             <span style={{ fontSize: 8, color: '#fbbf24', maxWidth: 70, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'right' }}>{kpi.aMvp} ⭐</span>
                           </div>
                         </div>
                       </div>
                     );
                 })}

                 {/* Live current set — only if not yet finished */}
                 {currentSetNumber > 0 && (() => {
                   const s = rallies.slice(0, currentRallyIndex).filter((r: any) => r.set_number === currentSetNumber);
                   const hPts = s.filter((r: any) => r.team_scored === 'home').length;
                   const aPts = s.filter((r: any) => r.team_scored === 'away').length;
                   // Don't show as live if set is clearly finished (25+ points)
                   if (Math.max(hPts, aPts) >= 25) return null;
                   if (hPts === 0 && aPts === 0) return null;
                   const kpi = computeSetKPI(currentSetNumber, currentRallyIndex);
                   return (
                     <div style={{ background: 'rgba(59,130,246,.04)', border: '1px solid rgba(59,130,246,.15)', borderRadius: 10, padding: '8px 10px' }}>
                       <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                         <span style={{ fontSize: 8, fontWeight: 800, color: '#3b82f6', textTransform: 'uppercase', letterSpacing: '.1em' }}>● Set {currentSetNumber} live</span>
                         <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 12, fontWeight: 700, color: '#fff' }}>{hPts}:{aPts}</span>
                       </div>
                       <KpiRow label="Ataki" hVal={String(kpi.hKill)} aVal={String(kpi.aKill)} hBetter={kpi.hKill >= kpi.aKill} />
                       <KpiRow label="Bloki" hVal={String(kpi.hBlk)} aVal={String(kpi.aBlk)} hBetter={kpi.hBlk >= kpi.aBlk} />
                       <KpiRow label="Asy" hVal={String(kpi.hAce)} aVal={String(kpi.aAce)} hBetter={kpi.hAce >= kpi.aAce} />
                       <KpiRow label="Błędy rywali" hVal={String(kpi.aErr)} aVal={String(kpi.hErr)} hBetter={kpi.aErr >= kpi.hErr} />
                       <div style={{ marginTop: 3, marginBottom: 2, borderTop: '1px solid rgba(255,255,255,.04)', paddingTop: 3 }} />
                       <KpiRow label="Atak K%" hVal={`${kpi.hKillPct}%`} aVal={`${kpi.aKillPct}%`} hBetter={kpi.hKillPct >= kpi.aKillPct} />
                       <KpiRow label="Przyjęcie%" hVal={`${kpi.hRecPct}%`} aVal={`${kpi.aRecPct}%`} hBetter={kpi.hRecPct >= kpi.aRecPct} />
                     </div>
                   );
                 })()}
               </div>
             );
           })()}
         </div>
       </div>
     </div>

     <style>{`
       @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.4} }
       @keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
       @font-face { font-family: 'DM Sans'; }
     `}</style>
   </div>
 );
}
