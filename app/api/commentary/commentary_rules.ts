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
[F36] "Piękny punkt!" po błędzie serwisowym — NIGDY.
[F37] "świetnie!" / "doskonałe!" po błędzie serwisu — NIGDY.
[F38] "Prowadzą/Wyrównują od pierwszej piłki!" bez podmiotu — NIGDY. Zawsze: "[Drużyna] prowadzi/wyrównuje".
[F39] Wymyślone metafory ("przez mur", "przez ścianę") — NIGDY. Tylko to co jest w touch chain.
[F40] "kończy!" przy błędzie serwisu lub ataku — NIGDY. "kończy" = sukces atakującego. Błąd = "myli się", "popełnia błąd", "nie trafia".
[F41] "Fantastyczny/Wspaniały/Piękny punkt!" po błędzie serwisu — NIGDY.
[F42] "powiększa impet" — NIGDY. "impet" to nie jest wynik. Użyj: "buduje przewagę", "wychodzi na prowadzenie", "odskakuje".
[F43] ODMIANA NAZWISK na -EK: Kwolek→Kwolka, Bieniek→Bieńka, Sasek→Saszka. Reguła: -ek odpada.
[F44] "Thales Thales" / "Jan Jan" — duplikat imienia i nazwiska — NIGDY. Zawodnik to "Thales Hoss" lub samo "Thales".
[F45] As serwisowy + "wbija piłkę w boisko" = oksymoron — NIGDY.
[F46] "Kontra zaczęła się od zagrywki" — NIGDY. Zagrywka zawsze zaczyna akcję, kontra to przejście w trakcie.
[F47] "piłka muruje siatkę" — NIGDY. ZAWODNIK muruje siatkę, nie piłka. Poprawnie: "[Bloker] muruje siatkę!"
[F48] "nie odpuszcza" — TYLKO gdy od dłuższego czasu jest seria punkt za punkt. NIE jako ogólna zachęta na końcu komentarza.
[F49] Japońskie/cyrylica w PL komentarzu — NIGDY. Imiona obcokrajowców piszemy łaciną: Demyanenko, nie デミヤネンコ.
[F51] SCORER ≠ OBROŃCA: Gdy ostatni dotyk to nieudana obrona (dig/blok przebity),
      obrońca NIE zdobył punktu. Punkt należy do atakującego. Obrona może być wspomniana
      jako kontekst ("mimo obrony X"), ale scoring verb zawsze = atakujący.
      POPRAWNIE: "Leon wbija piłkę w boisko! Mimo obrony Tavaresa."
      NIGDY: "Tavares wbija piłkę" / "Tavares zdobywa punkt" gdy Tavares bronił.

[F52] "piłka żyje" — ABSOLUTNY ZAKAZ. Użyj: "akcja trwa", "wymiana trwa".

[F53] "nie daje się" / "nie dają się" — ABSOLUTNY ZAKAZ. Brzmi nieprofesjonalnie.
      Użyj: "odpowiada", "nie odpuszcza", "walczy dalej".

[F54] "wraca do gry" — TYLKO gdy drużyna odrabia stratę 5+ punktów (np. z 10:16→11:16).
      Przy zwykłym punkcie: "odpowiada", "zmniejsza stratę", "nie odpuszcza".

[F55] "znowu" / "znów" / "ponownie" — ZAKAZ. GPT nadużywa bez kontekstu powtórzenia.
      Użyj konkretnego opisu akcji zamiast nawiązywać do poprzedniej.

[F56] SCORER przy błędzie: gdy akcja to błąd przyjęcia/ataku/serwisu — NIE używaj
      "[gracz który bronił/serwował] zdobywa punkt". Poprawnie: "[gracz który popełnił błąd]
      myli się" lub "as serwisowy" przy błędzie przyjęcia na zagrywce.

[F57] "znakomicie" / "perfekcyjnie" / "fenomenalnie" — max 1x każde słowo na komentarz.
      Nie używaj 2+ superlatywów w jednym komentarzu. Rotuj: wzorowo, bez zarzutu, pewnie,
      bezbłędnie, czysto, dobrze, dokładnie.

[F58] "powiększa przewagę" — ZAKAZ jako zakończenie komentarza. Użyj konkretnie:
      "odskakuje dwoma punktami", "rośnie w siłę", "dokręca śrubę", "buduje przewagę".

[F59] "kończy akcję" — ZA OGÓLNE. Zawsze konkretnie: "kończy atakiem", "zamyka blokiem",
      "wbija w boisko", "blokuje punktowo".

[M11] KONTEKST OBRONY: gdy obrońca próbował zatrzymać piłkę po ataku (ale nie zdołał),
      wspomnij OBYDWU — atakującego i obrońcę. Daje to pełen obraz akcji.
      POPRAWNIE: "Tavares próbuje obrony po ataku Sasaka, ale piłka wychodzi poza boisko!"
      POPRAWNIE: "Leon wbija piłkę mimo desperackiej obrony Tavaresa!"
      POPRAWNIE: "Kwolek nie zatrzymuje ataku Bołądzia — piłka ląduje w boisku!"
      ŹLE:       "Tavares próbuje obrony, ale piłka wychodzi" (brak atakującego)
      ŹLE:       "Leon zdobywa punkt" (brak kontekstu obrony gdy była)

[F61] "recepcja" / "recepcji" / "recepcję" / "recepcją" — ABSOLUTNY ZAKAZ.
      To brzydka kalka z angielskiego "reception". Nie istnieje w polskim języku sportowym.
      NIGDY nie używaj w żadnej formie: recepcja, recepcji, recepcję, recepcją, recepcje.

      POLSKIE ODPOWIEDNIKI — używaj zawsze jednego z poniższych:
      • "przyjęcie" / "przyjęcia" / "przyjęciem"  ← PODSTAWOWE
      • "odbiór zagrywki" / "przyjął zagrywkę"    ← gdy chcesz podkreślić kontekst serwisu
      • "obrona serwisu"                           ← rzadziej, przy trudnej zagrywce

      BŁĄD → POPRAWNIE:
      "błąd w recepcji"       → "błąd w przyjęciu"
      "perfekcyjna recepcja"  → "perfekcyjne przyjęcie"
      "dobra recepcja"        → "dobre przyjęcie"
      "wymusza dobrą recepcję"→ "wymusza trudne przyjęcie"
      "błąd recepcji Leona"   → "Leon myli się w przyjęciu"
      "recepcja daleko od siatki" → "przyjęcie daleko od siatki"

[F63] INTERPUNKCJA po zdobyciu punktu — zawsze wykrzyknik, nigdy średnik.
      ŹLE:  "Bołądź zdobywa punkt; BOGDANKA LUK Lublin prowadzi"
      DOBRZE: "Bołądź zdobywa punkt! BOGDANKA LUK Lublin prowadzi"

[F64] "gra się toczy" — ZAKAZ. Użyj: "akcja trwa!", "wymiana trwa!", "piłka żyje!"
      Podobnie: "gra trwa" → "akcja trwa"

[F77] Rozgrywający jako atakujący — właściwa terminologia.

      Gdy rozgrywający atakuje (zamiast wystawiać), rozróżnij:

      A) 2. kontakt (setter atakuje bezpośrednio po przyjęciu):
         "atak z drugiej piłki", "kiwka z drugiej piłki", "wbija z drugiej!"
         ŹLE: "wystawia na lewe skrzydło, Komenda wbija" (Komenda = setter)
         DOBRZE: "Komenda decyduje się na kiwkę z drugiej piłki!"

      B) 3. kontakt sytuacyjny (setter wystawia ale w trudnej sytuacji):
         "wystawienie sytuacyjne", "piłka sytuacyjna", "z daleka od siatki"
         DOBRZE: "daleko od siatki — Janusz zmuszony do wystawienia sytuacyjnego"
         DOBRZE: "Komenda ratuje sytuację wystawieniem z drugiej linii"

      C) Pipe attack (środkowy atakuje za rozgrywającym):
         "atak pipe", "Chiţigoi atakuje pipe za plecami Łomacza"

[F78] "ale piłka wychodzi" bez dopełnienia — ZAKAZ.
      Zawsze dodaj kontekst: "ale piłka wychodzi poza boisko!", "na aut!",
      "za linię boczną!", "poza pole gry!"
      ŹLE:  "Tavares próbuje obrony, ale piłka wychodzi!"
      DOBRZE: "Tavares próbuje obrony, ale piłka wychodzi poza boisko!"

[F74] "Błąd X i X zdobywa punkt" — NONSENS LOGICZNY (F74).
      Gracz który popełnił błąd NIE zdobywa punktu.
      ŹLE:  "Błąd Poręby i Poręba zdobywa punkt!"
      DOBRZE: "Błąd Poręby! Asseco zdobywa punkt!"

[F75] "zdobywa kolejny punkt" — ukryte "znowu" (F75). ZAKAZ.
      ŹLE:  "Węgiel zdobywa kolejny punkt i rośnie w siłę"
      DOBRZE: "Węgiel zdobywa punkt!" / "Seria trwa!" / "I znów skuteczni!"

[F72] "nie odpuszcza" / "dokręca śrubę" / "rośnie w siłę" / "buduje przewagę" PO BŁĘDZIE SERWISOWYM — ZAKAZ.
      Drużyna dostaje punkt bez wysiłku — żadne z tych określeń nie jest na miejscu.
      ŹLE:  "Szalpuk popełnia błąd serwisowy! JSW nie odpuszcza i zdobywa punkt!"
      ŹLE:  "Błąd serwisowy! Asseco dokręca śrubę i wychodzi na prowadzenie!"
      DOBRZE: "Szalpuk popełnia błąd serwisowy! JSW zdobywa punkt!"
      DOBRZE: "Błąd serwisowy Gierżota! Asseco korzysta z prezentu i zdobywa punkt."
      DOBRZE: "Usowicz myli się w zagrywce — łatwy punkt dla Jastrzębskiego!"
      "nie odpuszcza" rezerwujemy dla punktów zdobytych po trudnej wymianie.

[F73] Podwójne creditowanie scorera — ZAKAZ.
      ŹLE:  "Louati wbija piłkę w boisko! Louati zdobywa punkt!"
            (scorer wymieniony dwa razy w tym samym kontekście)
      DOBRZE: "Louati wbija piłkę w boisko! Asseco Resovia prowadzi!"
      DOBRZE: "Gierżot wbija w boisko — JSW obejmuje prowadzenie!"
      Jedno zdanie na zdobycie punktu. Nie powtarzaj scorer → scoring verb.

[F69] "piłka odpowiada" — bez sensu, nic nie znaczy. ZAKAZ.
      ŹLE:  "wyblok i piłka odpowiada!"
      DOBRZE: "wyblok — akcja trwa!" / "piłka wraca na stronę rywali!"

[F76] WYBLOK — definicja i ZAKAZ nadużywania.

      WYBLOK = TYLKO gdy: piłka dotknęła bloku, a następnie zawodnik drużyny
      ATAKUJĄCEJ dotknął tej piłki → piłka wraca na stronę drużyny BLOKUJĄCEJ.
      Akcja TRWA. Punkt NIE jest przyznany.

      PIĘĆ SCENARIUSZY ATAKU W BLOK:

      A) Attack Error (atak w siatkę/aut) → punkt dla drużyny PRZECIWNEJ
         "X myli się w ataku!", "X posyła piłkę w siatkę!"

      B) Atak bez bloku → punkt dla drużyny ATAKUJĄCEJ
         "X wbija piłkę w boisko!", "czysty atak X!"

      C) Piłka po bloku wpada w boisko drużyny BLOKUJĄCEJ → BLOCK POINT
         Punkt dla drużyny BLOKUJĄCEJ.
         "X zamyka blokiem!", "X muruje siatkę — punkt!"
         NIE używaj "wyblok" tutaj!

      D) Piłka po bloku wpada w boisko drużyny ATAKUJĄCEJ → ATTACK POINT
         Punkt dla drużyny ATAKUJĄCEJ. Blok był nieskuteczny.
         "X przebija blok Y!", "blok Y nieskuteczny — X punktuje!"
         Możesz wspomnieć próbę bloku. NIE używaj "wyblok" tutaj!

      D2) BLOK-OUT — piłka dotknęła bloku i wyleciała OD RAZU na aut → ATTACK POINT
         Punkt dla drużyny ATAKUJĄCEJ (blokujący "wypchnęli" piłkę za boisko).
         "X wbija piłkę w blok i wychodzi za boisko — blok-out, punkt dla X!"
         "Blok wypycha piłkę na aut — punkt dla [drużyna atakująca]!"
         NIE używaj "wyblok" tutaj — akcja się skończyła!

      E) Piłka po bloku dotknięta przez atakującego → WYBLOK (akcja trwa)
         Piłka wraca na stronę drużyny BLOKUJĄCEJ. JEDYNY przypadek dla "wyblok".
         "wyblok — akcja trwa!", "napotyka blok X — wyblok!"

      BEZWZGLĘDNY ZAKAZ:
      ❌ "wyblok i punkt dla [drużyna blokująca]" — sprzeczność!
      ❌ "trafia w blok, ale X dotyka bloku, wyblok" — masło maślane
      ❌ "wyblok" przy block point (C) lub attack point (D)

[F70] Masło maślane przy bloku — ZAKAZ powtarzania tej samej informacji.
      ŹLE:  "atakuje, który trafia w blok, ale Kochanowski dotyka bloku, wyblok"
            (trzy razy mówimy o tym samym kontakcie z blokiem)
      DOBRZE: "atakuje, ale napotyka blok Kochanowskiego — wyblok!"
      DOBRZE: "Kochanowski blokuje! Wyblok, akcja trwa!"
      Zasada: jeden opis kontaktu z blokiem = jedno zdanie, jeden czasownik.

[F71] "X myli się w ataku! X zdobywa punkt" — NONSENS LOGICZNY.
      Gracz który się pomylił NIE zdobywa punktu.
      DOBRZE: "X myli się w ataku! [rywal] zdobywa punkt!"

[F68] "dokręca śrubę" / "rośnie w siłę" / "buduje przewagę" PO BŁĘDZIE SERWISOWYM — semantycznie złe.
      Drużyna dostaje punkt za darmo — nie dzięki własnej grze, wysiłkowi ani presji.
      ŹLE:  "Sasak popełnia błąd serwisowy! Aluron dokręca śrubę!"
      ŹLE:  "Błąd serwisowy! BOGDANKA rośnie w siłę!"
      DOBRZE: "Sasak popełnia błąd serwisowy! Aluron wychodzi na prowadzenie!"
      DOBRZE: "Błąd serwisowy Sasaka! Łatwy punkt dla Aluronu!"
      DOBRZE: "Sasak myli się w zagrywce. Aluron zdobywa punkt!"
      "dokręca śrubę" / "rośnie w siłę" rezerwujemy dla punktów zdobytych wysiłkiem.

[F66] "poza systemem" — ANGLICYZM TECHNICZNY. Nie używamy w polskim komentarzu radiowym.
      ŹLE:  "Henno przyjmuje daleko od siatki i poza systemem"
      ŹLE:  "przyjmuje poza systemem"
      DOBRZE: "Henno przyjmuje daleko od siatki, zmuszając rozgrywającego do trudnego wystawienia"
      DOBRZE: "trudne przyjęcie Henno — Malinowski musi wystawiać z pilki sytuacyjnej"
      DOBRZE: "przyjmuje daleko od siatki"

[F67] "X popełnia błąd w przyjęciu i X zdobywa punkt" — NONSENS LOGICZNY.
      Gracz który popełnił błąd w przyjęciu NIE zdobywa punktu — punkt traci.
      ŹLE:  "Popiwczak popełnia błąd w przyjęciu i Popiwczak zdobywa punkt"
      DOBRZE: "Błąd w przyjęciu Popiwczaka daje punkt rywalowi!"
      DOBRZE: "As serwisowy! Popiwczak nie opanowuje przyjęcia!"

[F65] Pleonazm "przyjętym przyjęciu" — ZAKAZ.
      ŹLE:  "po znakomicie przyjętym przyjęciu Thalesa"
      DOBRZE: "po znakomitym przyjęciu Thalesa"

[F62] "odpowiada" po błędzie serwisowym — SEMANTYCZNIE BŁĘDNE.
      Gdy poprzednia akcja to błąd serwisowy, drużyna przyjmująca dostaje punkt ZA DARMO.
      Nie "odpowiada" — nie musiała nic robić. Nie miała żadnego wkładu w zdobycie punktu.
      BŁĄD: "BOGDANKA odpowiada i powiększa przewagę" (po błędzie serwisowym)
      BŁĄD: "Zawiercie odpowiada, nie odpuszcza!" (po błędzie serwisu rywala)
      POPRAWNIE: "BOGDANKA zdobywa punkt!", "Błąd serwisowy daje punkt Zawierciu!",
                 "Punkt dla BOGDANKI po błędzie serwisowym!"
      UWAGA: "odpowiada" jest POPRAWNE gdy drużyna zdobywa punkt po normalnej wymianie.

[F60] "X popełnia błąd i X zdobywa punkt" — NONSENS LOGICZNY. Nigdy nie łącz błędu i
      zdobycia punktu przez TEN SAM podmiot w jednym zdaniu.

[F50] As serwisowy + "wystawia na..." w jednym komentarzu = BŁĄD LOGICZNY. As = piłka nie przyjęta. Nie może być wystawy. — NIGDY. Kontra = przejście z obrony do ataku w trakcie wymiany. Zagrywka ZAWSZE zaczyna akcję, nie kontrę. + "wbija piłkę w boisko" = oksymoron — NIGDY. As = piłka NIE była przyjęta. Nie "wbił w boisko". Kwolek→Kwolka, Bieniek→Bieńka, Sasek→Saszka. Reguła: -ek odpada. NIGDY Kwoleka, Bienieka. ("przez mur", "przez ścianę") — NIGDY. Tylko to co jest w touch chain. "Piękny punkt!" po błędzie serwisowym — NIGDY. Błąd serwisu to strata, nie osiągnięcie. Nie oceniaj błędów jako pięknych.
`;

export const COMMENTARY_RULES_MARKER = '// COMMENTARY_RULES v2026-05-07';

// ============================================================================
// FEEDBACK LOG — historia wszystkich zmian jakości komentarza
// ============================================================================
// Format: [data] [kto] problem → gdzie naprawione
// NIGDY nie usuwaj starych wpisów. Tylko dodawaj na górze.
// ============================================================================

export const FEEDBACK_LOG = `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
OSTATNIE ZMIANY (najnowsze na górze)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

[2026-05-20] Sesja naprawcza — root cause scorer bug + systematyczne postProcess
→ COMMENTARY_RULES: F51-F60 dodane (scorer≠obrońca, błąd+zdobywa, superlatywy, powiększa przewagę)
→ route.ts: scoringPlayer = lastWinningTouch (nie finalTouch gdy obrona przegrywającego)
→ route.ts: isErrorTouch — przy błędach scoringPlayer = gracz który popełnił błąd
→ route.ts: nuclear scorer fix v2 — podmiana wszystkich scoring verbs
→ route.ts: postProcess — piłka żyje, nie daje się, znowu/znów, wraca do gry, punkt dla
→ route.ts: token cap — isMassiveRally 15+ dotknięć = 90 tokenów
→ route.ts: import COMMENTARY_RULES_PL → inject do basePrompt PL

[2026-05-11] Tomek: "Piękny punkt!" po błędzie serwisu — absurd
→ COMMENTARY_RULES: F36 dodane
→ route.ts: postProcess usuwa "Piękny punkt!" po błędzie serwisowym
[2026-05-20] Sesja naprawcza — root cause scorer bug + systematyczne postProcess
→ COMMENTARY_RULES: F51-F60 dodane (scorer≠obrońca, błąd+zdobywa, superlatywy, powiększa przewagę)
→ route.ts: scoringPlayer = lastWinningTouch (nie finalTouch gdy obrona przegrywającego)
→ route.ts: isErrorTouch — przy błędach scoringPlayer = gracz który popełnił błąd
→ route.ts: nuclear scorer fix v2 — podmiana wszystkich scoring verbs
→ route.ts: postProcess — piłka żyje, nie daje się, znowu/znów, wraca do gry, punkt dla
→ route.ts: token cap — isMassiveRally 15+ dotknięć = 90 tokenów
→ route.ts: import COMMENTARY_RULES_PL → inject do basePrompt PL

[2026-05-11] Tomek: hybryda narracji
→ route.ts: narrativeStyle climax-first/chronological per dramaLevel
→ PHRASE_TRACKER: wbudowany w route.ts, skanuje recentRallies per set

[2026-05-20] Sesja naprawcza — root cause scorer bug + systematyczne postProcess
→ COMMENTARY_RULES: F51-F60 dodane (scorer≠obrońca, błąd+zdobywa, superlatywy, powiększa przewagę)
→ route.ts: scoringPlayer = lastWinningTouch (nie finalTouch gdy obrona przegrywającego)
→ route.ts: isErrorTouch — przy błędach scoringPlayer = gracz który popełnił błąd
→ route.ts: nuclear scorer fix v2 — podmiana wszystkich scoring verbs
→ route.ts: postProcess — piłka żyje, nie daje się, znowu/znów, wraca do gry, punkt dla
→ route.ts: token cap — isMassiveRally 15+ dotknięć = 90 tokenów
→ route.ts: import COMMENTARY_RULES_PL → inject do basePrompt PL

[2026-05-11] Tomek: frazy się powtarzają (muruje, piłka żyje)
→ route.ts: PHRASE_TRACKER — limity per set z alternatywami
→ COMMENTARY_RULES: F25 (piłka żyje max 1x), F35 (muruje tylko blok punkt)

[2026-05-07] Tomek/Ziomkowie: komentarze urwane (brak info kto zdobył)
→ route.ts: max_tokens podniesione (160→200 długie, 120→150 średnie)
→ route.ts: CLIMAX-FIRST touch chain — ostatnia akcja na górze
→ RULES: M2, M3, M4 dodane

[2026-05-07] Tomek: "Bogdanka Łuk Lublin" — GPT tłumaczył nazwy drużyn
→ route.ts: reguła M1 w ZASADY — nazwy drużyn dosłownie
→ COMMENTARY_RULES: M1 dodane

[2026-05-07] Tomek: "kolejne punkt" — zła gramatyka + zły kontekst
→ route.ts: postProcess + prompt M10 (pierwsza akcja = NIGDY kolejny)

[2026-05-07] Tomek: "zdobywa!" bez doprecyzowania
→ route.ts: postProcess: zdobywa → zdobywa punkt (z wyjątkiem "as")

[2026-05-07] Tomek: "oddane rywalom" — zła polska gramatyka
→ route.ts: postProcess: oddane rywalom → dla rywali / błąd serwisowy

[2026-05-07] Tomek: "ratować" i "piłka wychodzi" bez doprecyzowania
→ route.ts: postProcess + RULES F18 (na aut), M9 (ratować piłkę)

[2026-05-06] Tomek: komentarze za długie (>60 słów)
→ route.ts: postProcess hard cut 55 słów / 3 zdania

[2026-05-06] Tomek: CLIMAX-FIRST nie działało (38%)
→ route.ts: touch chain reformat — ★ CLIMAX na górze dla 5+ dotknięć

[2026-05-06] Tomek: "puszcza swobodną piłkę" — kalka z angielskiego
→ route.ts: postProcess: swobodna piłka → free ball / oddaje za darmo

[2026-05-06] Tomek: "atakuje kiwką" — nie po polsku
→ route.ts: postProcess + RULES F6: atakuje kiwką → kiwa

[2026-05-06] Tomek: "muruje atakującego rywala" / "wbija blok"
→ route.ts: postProcess + RULES F7, F8

[2026-05-06] Tomek: "trudne przyjęcie" — RULES F5

[2026-05-05] Tomek: "błąd serwisu" zamiast "serwisowy" — RULES F15
→ route.ts: postProcess

[2026-05-05] Tomek: "wraca w pole" — RULES F9
→ route.ts: postProcess

[2026-05-04] Tomek/Ziomkowie: "kapitalnie" za często
→ route.ts: kontekstowe — max 1x, tylko dramaLevel 3-4 — RULES F1

[2026-05-04] Tomek: "wyblokowuje" — nie po polsku — RULES F10
→ route.ts: postProcess: wyblokowuje → dotyka blokiem

[2026-05-04] Tomek: "pierwszym tempem" zamiast "z pierwszego tempa" — RULES F16
→ route.ts: postProcess (6 wariantów)

[2026-05-04] Tomek: "szybko przyjął" — RULES F11
→ route.ts: postProcess

[2026-05-04] Tomek: "bierze prowadzenie" — RULES F12
→ route.ts: postProcess

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
JAK DODAĆ NOWY FEEDBACK
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. Powiedz Mordo: "fraza X jest zła/powtarza się/brzmi nienaturalnie"
2. Mordo decyduje gdzie to idzie:
   NIGDY tej frazy    → COMMENTARY_RULES.ts [F-lista] + postProcess w route.ts
   za często          → PHRASE_TRACKER w route.ts [limit + alternatywy]  
   zły styl           → nowy MD do Drive/commentary-phrases + Colab sync
3. Mordo dopisuje tutaj z datą
4. Commit obu plików → Vercel deploy → gotowe

`;
