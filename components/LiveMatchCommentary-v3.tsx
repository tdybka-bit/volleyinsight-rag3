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
 tagData: Record<string, any>;
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
 const [isGenerating, setIsGenerating] = useState(false);
 const [speed, setSpeed] = useState(3000);
 const [language, setLanguage] = useState<Language>('pl');
 const [mode, setMode] = useState<Mode>('demo');
 const commentaryRef = useRef<HTMLDivElement>(null);
 const [isRetranslating, setIsRetranslating] = useState(false);
 const [selectedMatch, setSelectedMatch] = useState('2025-11-12_ZAW-LBN.json');
 const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
 const [openTagPopup, setOpenTagPopup] = useState<string | null>(null);
 const [favPlayer, setFavPlayer] = useState<string | null>(null);
 const [openFavPopup, setOpenFavPopup] = useState<number | null>(null);

 const [playerStats, setPlayerStats] = useState<Record<string, {
 blocks: number;
 aces: number;
 attacks: number;
 errors: number;
 points: number;
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

 // Load match data on mount
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
 
 return { 
 rallies,
 teams: {
 home: homeTeamName,
 away: awayTeamName
 }
 };
 }

 /**
 * NAPRAWIONY PARSER - LICZY PUNKTY zamiast czytaAfaAca'-A! Game Score
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

 const retranslateCommentaries = async () => {
 if (commentaries.length === 0 || isRetranslating) return;
 
 setIsRetranslating(true);
 const currentLanguage = language;
 console.log('Re-translating', commentaries.length, 'commentaries to', currentLanguage);
 
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
 console.log('Re-translation complete in parallel!');
 };

 // Funkcja liczAfaAca'-A|ca wyniki setow do aktualnego rally
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
 // LUB jeAfa|Aca'-Aoli to set 5 i ktoAfa|Aca'-Ao ma 15+ z roznicAfaAca'-A| >= 2
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
 
 // Funkcja liczAfaAca'-A|ca wyniki setow do aktualnego rally

 const updatedStats = calculatePlayerStats(rally);
 
 const rallyIndex = rallies.findIndex(r => r.rally_number === rally.rally_number);
 const recentRallies = rallyIndex >= 0 ? rallies.slice(Math.max(0, rallyIndex - 9), rallyIndex + 1) : [];

 const data = await fetchWithUTF8('/api/commentary', {
 method: 'POST',
 body: JSON.stringify({ rally, language: targetLanguage, playerStats: updatedStats, recentRallies: recentRallies }),
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
 icon: 'Adeg,AA', momentumScore: 0,
 dramaScore: 0,
 };
 }
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
 if (finalTouch && finalTouch.action && !finalTouch.action.toLowerCase().includes('error')) {
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
 const formatScore = (rally: Rally) => `${rally.score_after.home}:${rally.score_after.away}`;

 return (
 <div className="min-h-screen bg-background">
 <div className="max-w-7xl mx-auto">

 {/* MATCH SELECTOR */}
 <div className="sticky top-0 z-50 bg-background border-b-2 border-border shadow-md">
 <div className="p-4 flex items-center gap-4">
 <label className="text-base font-bold text-foreground whitespace-nowrap">
 Wybierz mecz:
 </label>
 <select 
 value={selectedMatch}
 onChange={(e) => {
 setSelectedMatch(e.target.value);
 setCommentaries([]);
 setCurrentRallyIndex(0);
 setIsPlaying(false);
 }}
 className="flex-1 max-w-2xl px-4 py-3 text-base font-semibold bg-card text-foreground border-2 border-border rounded-lg hover:border-primary hover:bg-accent focus:outline-none focus:ring-2 focus:ring-primary transition-all cursor-pointer"
 >
 <option value="2025-11-12_ZAW-LBN.json">
 Aluron Zawiercie vs Bogdanka Lublin (12.11.2025)
 </option>
 <option value="2025-11-26_PGE-Ind.json">
 PGE Projekt Warszawa vs Indykpol Olsztyn (26.11.2025)

 </option>
 <option value="2025-12-06_JSW-Ass.json">
 Jastrzebski Wegiel vs Asseco Rzeszow (06.12.2025)
 </option>
 </select>
 
 <div className="flex items-center gap-2 px-3 py-2 bg-green-500/10 border border-green-500/20 rounded-lg">
 <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
 <span className="text-sm font-medium text-green-600 dark:text-green-400">Live</span>
 </div>
 </div>
 </div>

 {/* Match Header */}
 <div className="p-6 border-b border-border bg-gradient-to-r from-blue-600/20 to-red-600/20">
 <div className="flex items-center justify-between mb-4">
 <div className="flex items-center space-x-4">
 {/* SET INFO - Duzy i widoczny z wynikami setow */}
 {currentRally && (() => {
 const setResults = calculateSetResults(currentRallyIndex);
 const hasCompletedSets = setResults.home > 0 || setResults.away > 0;
 
 return (
 <div className="flex items-center gap-3">
 <div className="bg-gradient-to-r from-blue-500 to-indigo-600 px-6 py-3 rounded-lg shadow-lg">
 <div className="text-white font-bold text-lg">
 SET {currentRally.set_number}
 </div>
 </div>
 
 {hasCompletedSets && (
 <div className="flex items-center gap-2 bg-muted px-4 py-2 rounded-lg">
 <span className="text-sm font-semibold text-muted-foreground">Sets:</span>
 <span className="text-lg font-bold text-foreground">
 {setResults.home}-{setResults.away}
 </span>
 </div>
 )}
 </div>
 );
 })()}
 
 {/* DEMO MODE badge */}
 <div className="flex items-center space-x-2">
 <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
 <span className="text-sm font-semibold text-red-500">
 {mode === 'live' ? 'NA ZYWO' : 'DEMO MODE'}
 </span>
 </div>
 </div>

 {/* Language Switcher */}
 <div className="flex items-center gap-2">
 {languages.map((lang) => (
 <button
 key={lang.code}
 onClick={() => setLanguage(lang.code)}
 className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-all ${
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

 {/* Score Display */}
 {matchData && currentRally && (
 <div className="flex items-center justify-center space-x-8">
 <div className="text-center">
 <div className="mb-2">
 <img 
 src={getTeamLogo(matchData?.teams?.home || 'Aluron')}
 alt="Aluron CMC Warta Zawiercie"
 className="w-16 h-16 mx-auto object-contain"
 />
 </div>
 <div className="text-sm font-medium mb-1">{TEAM_FULL_NAMES[matchData?.teams?.home || ""] || matchData?.teams?.home}</div>
 <div className="text-3xl font-bold">{currentRally.score_after.home}</div>
 </div>

 <div className="text-2xl font-bold text-muted-foreground">:</div>

 <div className="text-center">
 <div className="mb-2">
 <img 
 src={getTeamLogo(matchData?.teams?.away || 'Bogdanka')}
 alt="BOGDANKA LUK Lublin"
 className="w-16 h-16 mx-auto object-contain"
 />
 </div>
 <div className="text-sm font-medium mb-1">{TEAM_FULL_NAMES[matchData?.teams?.away || ""] || matchData?.teams?.away}</div>
 <div className="text-3xl font-bold">{currentRally.score_after.away}</div>
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
 {isPlaying ? 'PAUSE' : currentRallyIndex >= rallies.length ? 'REPLAY' : 'PLAY'}
 </button>
 <button
 onClick={handleReset}
 disabled={isGenerating || !matchData}
 className="px-6 py-3 bg-gray-500 hover:bg-gray-600 text-white rounded-lg font-semibold transition-all disabled:opacity-50"
 >
 RESET
 </button>
 </div>

 <div className="flex items-center gap-4">
 <span className="text-sm font-semibold">SPEED:</span>
 {[
 { label: 'SLOW', value: 5000 },
 { label: 'NORMAL', value: 3000 },
 { label: 'FAST', value: 1500 },
 ].map((option) => (
 <button
 key={option.value}
 onClick={() => setSpeed(option.value)}
 disabled={!matchData}
 className={`px-4 py-2 rounded-lg font-semibold transition-all disabled:opacity-50 ${
 speed === option.value
 ? 'bg-blue-500 text-white'
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
 <span className="font-medium">Adeg,'A Re-translating commentaries...</span>
 </div>
 )}
 </div>
 )}

 {/* Commentary Timeline */}
 <div className="p-6">
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
 className="space-y-3 overflow-y-auto"
 style={{ maxHeight: mode === 'demo' ? '500px' : '700px' }}
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
 const stats = playerStats[favPlayer] || { blocks: 0, aces: 0, attacks: 0, errors: 0, points: 0 };
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