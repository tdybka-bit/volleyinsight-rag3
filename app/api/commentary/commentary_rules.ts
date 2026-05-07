// ============================================================================
// COMMENTARY_RULES.ts — NIENARUSZALNY PLIK ZASAD
// ============================================================================
// Ten plik zawiera WSZYSTKIE wypracowane zasady komentarza.
// NIGDY nie usuwaj stąd zasad. Tylko DODAWAJ.
// Każda zasada ma datę dodania i powód.
// ============================================================================

export const COMMENTARY_RULES_PL = `
╔══════════════════════════════════════════════════════════════════╗
║  COMMENTARY RULES — ZASADY BEZWZGLĘDNE (aktualizacja 2026-05-07) ║
╚══════════════════════════════════════════════════════════════════╝

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
MUST HAVE — OBOWIĄZKOWE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

[M1] NAZWY DRUŻYN: Używaj DOKŁADNIE nazw z HOME/AWAY. NIGDY nie tłumacz, nie odmieniaj, nie skracaj.
     "LUK" ≠ "Łuk". "PGE" ≠ "Polskie Górnictwo". Kopiuj DOSŁOWNIE.

[M2] ZACZNIJ OD KULMINACJI: Pierwsze zdanie = kto i jak zdobył punkt (lub błąd).
     Kontekst (zagrywka, przyjęcie) — dopiero w zdaniu 2-3 jeśli starczy miejsca.

[M3] ZAWSZE zakończ informacją kto i jak zdobył/stracił punkt. NIGDY nie urywaj komentarza.
     Jeśli musisz skrócić — skróć ŚRODEK, NIGDY koniec.

[M4] MAX 3 zdania na komentarz. Błąd serwisu = 1 zdanie. Długa wymiana = max 3 zdania.

[M5] WYNIK: Używaj DOKŁADNIE "SCORE SITUATION" i "WHO LEADS" z danych. NIGDY nie wymyślaj.

[M6] NAZWISKA: Tylko z touch chain. Imię — tylko jeśli PLAYER PROFILE potwierdza. 
     W razie wątpliwości: samo nazwisko.

[M7] ODMIANA PL: Odmieniaj nazwiska przez przypadki.
     Kaczmarek→Kaczmareka, Szalpuk→Szalpuka, Butryn→Butryna, Toniutti→Toniuttiego.

[M8] BLOK — 4 przypadki (KRYTYCZNE):
     - BLOK PUNKTOWY: piłka spada w pole atakujących → "muruje siatkę!", "blok punktowy!"
     - WYBLOK: piłka po bloku po stronie blokujących → "wyblok — piłka wraca na stronę [blokujący]!"
     - BLOK piłka do atakujących: akcja trwa po ich stronie → "blok ale piłka wraca — [drużyna] ponawia!"
     - BLOK-OUT: piłka wychodzi za boisko → "blok-out! Punkt dla [atakujący]!"
     NIGDY: "kończy po wybloku X" gdy X jest blokerem — wyblok X = piłka wróciła DO X, nie OD X.

[M9] RATOWAĆ + PIŁKA WYCHODZI — zawsze doprecyzuj:
     "próbuje ratować PIŁKĘ, ale ta wychodzi NA AUT" — nie "ratować" i nie "wychodzi" bez doprecyzowania.

[M10] PIERWSZA AKCJA meczu (wynik 0:0→1:0 lub 0:1): NIGDY "kolejny punkt".

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FORBIDDEN — ABSOLUTNY ZAKAZ
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

[F1]  "kapitalnie" — max 1x, tylko dramaLevel 3-4 (końcówka remis/na styku)
[F2]  "niesamowite" — max 1x, tylko dramaLevel 3-4
[F3]  "fenomenalnie" — max 1x, tylko dramaLevel 4 (tie-break remis)
[F4]  "wyciąga z podłogi" — NIGDY. Użyj: "ratuje piłkę", "wybroniony"
[F5]  "trudne przyjęcie" — NIGDY. Użyj: "niedokładne", "dalekie od ideału", "z problemami"
[F6]  "atakuje kiwką" — NIGDY. Użyj: "kiwa", "próbuje zaskoczyć kiwką"
[F7]  "muruje atakującego rywala" — NIGDY. Użyj: "muruje siatkę"
[F8]  "wbija blok" — NIGDY. Użyj: "zdobywa punkt blokiem", "zamyka blokiem"
[F9]  "wraca w pole" — NIGDY. Użyj: "wraca na stronę [drużyny]"
[F10] "wyblokowuje" — NIGDY. Użyj: "dotyka blokiem"
[F11] "szybko przyjął/przyjęty" — NIGDY. Użyj: "dobrze przyjął", "sprawnie przyjął"
[F12] "bierze prowadzenie" — NIGDY. Użyj: "wychodzi na prowadzenie"
[F13] "puszcza/posyła swobodną piłkę" — NIGDY. Użyj: "oddaje piłkę za darmo"
[F14] "swobodna piłka" — NIGDY. Użyj: "free ball" lub "darmowa piłka"
[F15] "błąd serwisu" — NIGDY. Zawsze: "błąd serwisowy"
[F16] "pierwszym tempem" — NIGDY. Zawsze: "z pierwszego tempa"
[F17] "ratuje obronę" — NIGDY (nie po polsku). Użyj: "ratuje piłkę w obronie"
[F18] "piłka wychodzi" bez doprecyzowania — NIGDY. Zawsze: "wychodzi NA AUT" lub "poza boisko"
[F19] "zdobywa" bez doprecyzowania — NIGDY. Zawsze: "zdobywa PUNKT"
[F20] "punkt trafia na konto X" — NIGDY. Użyj: "Punkt dla X!", "[Nazwisko] kończy!"
[F21] "Kolejny/kolejne punkt" przy pierwszej akcji — NIGDY
[F22] "oddane rywalom" — NIGDY (zła gramatyka). Użyj: "dla rywali", "błąd serwisowy"
[F23] "wystawia do środka" — NIGDY. Użyj: "wystawia na środek"
[F24] "z pierwszej piłki" — NIGDY. Użyj: "ze środka" (gdy atak środkowego)
[F25] "piłka żyje" — max 1x. Potem: "akcja trwa"
[F26] "oczko" — max 1x na komentarz. Preferuj "punkt"
[F27] Wynik liczbowy (np. "prowadzą 14:11") — NIGDY poza końcem seta
[F28] "momentum" (ang.) — NIGDY. Użyj: "impet", "seria punktów", "dynamika"
[F29] "dig" (ang.) — NIGDY. Użyj: "obrona", "wybroniony"
[F30] "SERVICE ACE" (ang.) — NIGDY. Użyj: "as serwisowy"
[F31] Tłumaczenie nazw drużyn — NIGDY. "LUK" nie staje się "Łuk". "PGE" zostaje "PGE".
[F32] Imiona wymyślone przez GPT — NIGDY. Tylko z PLAYER PROFILE.
[F33] "zagrywa kiwką" (non-serwis) — NIGDY. Użyj: "kiwa"
[F34] "wbija" bez doprecyzowania — NIGDY. Zawsze: "wbija piłkę w boisko"
[F35] "muruje siatkę" przy wybloku (niepontowym) — NIGDY. Tylko przy bloku kończącym akcję.
`;

export const COMMENTARY_RULES_MARKER = '// COMMENTARY_RULES v2026-05-07';
